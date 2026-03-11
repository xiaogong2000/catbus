# CatBus Provider Management Skill — 完整技术方案

> **版本：v2.0** — 整合三轮专家审核意见，基于实际踩坑经验修订

## 1. 背景与问题

OpenClaw 目前有 5 个 AI 机器人分布在不同地理位置：

| 机器人 | 位置 | 角色 |
|--------|------|------|
| gouzi | 家庭 SRE 服务器 | 运维管理，全局监控 |
| Nefi | 家庭 Mac M2 Max | 任务调度，主力工作节点 |
| huanhuan | 德国 OVH 服务器 | 工作节点 |
| mimi | 洛杉矶 | 工作节点（大容量存储） |
| xiaohei | 美国 OVH 服务器 | 工作节点 |

**当前痛点：**

- 每台机器人独立管理自己的 LLM Provider（Anthropic、OpenAI、Google 等），配置格式不统一
- Provider 命名混乱（如 Nefi 叫 `azure-claude`，其他机器叫 `azure-anthropic`），导致 fallback 匹配失败
- 心跳和任务执行可能使用不同的 Provider，管理混乱
- 各机器人各自运行 Provider Watchdog，逻辑重复但实现不一
- 缺乏全局视角，无法一览所有机器人的 Provider 健康状况
- 手动指定 Provider 和自动切换之间没有清晰的模式区分
- VPN 断线导致所有 API 不通时，Watchdog 误判为所有 Provider 故障
- Session 膨胀、Gateway 进程挂掉等问题不在 Watchdog 监控范围内

---

## 2. 设计目标

1. **统一配置源** — 以 `openclaw.json` 为唯一 Provider 配置源，不引入重复配置
2. **标准化 Watchdog** — 一套探测/切换/恢复逻辑，每台机器本地运行
3. **全链路探测** — 同家族廉价模型验证 Provider 可达性，覆盖网络自检、响应体校验、429 分类
4. **双模式运行** — 自动模式（故障切换 + 恢复切回）与锁定模式（只监控不切换）
5. **与 OpenClaw 原生机制对齐** — Watchdog 切换时同步更新 fallback 链和清除 Session Override
6. **全局可观测** — gouzi 作为 SRE 汇总全局 Provider 状态，支持批量操作
7. **一键部署** — `catbus skill install provider` 完成安装配置
8. **低摩擦扩展** — 新增机器人只需运行 install script，gouzi 自动发现，无需手动注册

---

## 3. 架构概览

```
┌──────────────────────────────────────────────────────┐
│                    你（运维者）                        │
│                       │                               │
│              运维指令 / 状态查询                        │
│                       ▼                               │
│  ┌─────────────────────────────────────────────────┐  │
│  │              gouzi（SRE 角色）                    │  │
│  │                                                  │  │
│  │  provider-fleet-manager:                         │  │
│  │  - 汇总全局 Provider 状态                         │  │
│  │  - 全局告警（识别 Provider 侧全面故障）             │  │
│  │  - 批量操作（全部 pin / unpin）                    │  │
│  │  - 运维报告（可用率、切换次数）                     │  │
│  └──────────────────────┬──────────────────────────┘  │
│                         │ CatBus (MQTT TLS 8883)      │
│            ┌────────────┼────────────┐                │
│            ▼            ▼            ▼                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │  Nefi    │  │ huanhuan │  │ mimi ... │            │
│  │          │  │          │  │          │            │
│  │ 本地      │  │ 本地      │  │ 本地      │            │
│  │ Provider │  │ Provider │  │ Provider │            │
│  │ Skill    │  │ Skill    │  │ Skill    │            │
│  └──────────┘  └──────────┘  └──────────┘            │
│                                                       │
│  每台机器人独立运行，自己探测、切换、恢复                  │
└──────────────────────────────────────────────────────┘
```

### 3.1 职责划分

| 角色 | Provider 管理职责 |
|------|-------------------|
| **每台机器人（含 Nefi）** | 本地运行 Provider Skill：探测、故障切换、恢复切回、模式管理 |
| **gouzi（SRE）** | 全局监控：状态汇总、告警聚合、批量操作、运维报告 |
| **Nefi（Task Manager）** | 路由时参考 `provider_state` 跳过 `all_down` 的机器人（见 3.3） |

### 3.2 CatBus 依赖关系

| 组件 | 是否需要 CatBus |
|------|----------------|
| Registry（配置读取） | ❌ 纯本地 |
| Watchdog（健康探测） | ❌ 纯本地 |
| Switcher（故障切换） | ❌ 纯本地 |
| Recovery（恢复切回） | ❌ 纯本地 |
| Pin/Unpin（模式切换） | ❌ 纯本地 |
| Telegram 通知 | ❌ 直接调 Telegram API |
| gouzi 状态汇总 | ✅ MQTT 状态上报 |
| gouzi 批量控制（pin/unpin/switch） | ✅ MQTT 下发指令 |

**结论：本地 Provider Skill 零 CatBus 依赖，可独立部署和运行。CatBus 仅用于 gouzi 的全局运维功能。**

### 3.3 与 CatBus v4 心跳联动

为避免 Nefi 把任务派给 Provider 全挂的机器人浪费重试机会，将 Provider 状态注入 CatBus 心跳：

```json
// catbus_daemon.py 发送的 status Retained 消息中增加字段
{
  "robot": "huanhuan",
  "status": "online",
  "provider_state": "healthy",
  "primary_provider": "anthropic-main"
}
```

**Nefi 路由策略：**

- `provider_state == "healthy"` → 正常派任务
- `provider_state == "degraded"` → 可派任务，但优先选其他健康节点
- `provider_state == "all_down"` → 跳过，不派任务
- `provider_state == "network_down"` → 跳过，不派任务（机器网络断了）

这样 Nefi 不需要"管理" Provider，但能在路由层面做出更优决策，避免触发 Daemon 的熔断计数。

---

## 4. 与 OpenClaw 原生机制的协作

### 4.1 Fallback 链同步

OpenClaw 自身已有 fallback 链机制（处理 401/429/timeout/billing），配置在 `openclaw.json` 的 `agents.defaults.model.fallbacks[]` 中。

**核心原则：Watchdog 和 OpenClaw 原生 fallback 不是两套独立系统，而是同一个配置的两种视角。**

Switcher 切换时必须同步更新：

```
1. agents.defaults.model.primary — 主模型
2. agents.defaults.model.fallbacks[] — fallback 链顺序
3. models.providers — provider 定义（如需）
```

确保 Watchdog 的 priority 排序始终 = OpenClaw fallback 链顺序。

### 4.2 Session Model Override 陷阱

**已知踩坑（2/15）：** 手动执行 `/model xxx` 会在 session 里写入 `providerOverride`，之后无论怎么改全局配置都不生效。

**Switcher 切换后必须清除所有活跃 Session 的 model override：**

```python
def do_switch(self, new_primary):
    # 1. 改写 openclaw.json（primary + fallbacks）
    # 2. 清除所有活跃 session 的 providerOverride
    #    → openclaw session list → 逐个 session_status(model="default")
    # 3. 平滑重载 gateway（见 5.5）
    # 4. 验证切换生效（见 5.5）
    # 5. 通知
```

如果不清除 session override，切了等于没切。

### 4.3 Provider 命名统一规则

**硬性规则：** 所有机器人必须使用全局统一的 Provider 名字。禁止本地起别名。

```
✅ 正确：所有机器人都用 "azure-anthropic"
❌ 错误：Nefi 用 "azure-claude"，其他机器用 "azure-anthropic"
```

install.sh 安装时自动校验：检测本机 `openclaw.json` 里的 provider 名字是否与全局 catalog 一致，不一致则告警并提示修正。

---

## 5. 本地 Provider Skill 详细设计

### 5.1 目录结构

```
catbus-skill-provider/
├── SKILL.md                    # Skill 说明文档
├── install.sh                  # 一键部署脚本
├── config/
│   └── provider-watchdog.yaml.template  # Watchdog 参数模板
├── src/
│   ├── watchdog.py             # 健康探测引擎（含网络自检、429 分类）
│   ├── switcher.py             # 切换执行器（含 session override 清除）
│   ├── recovery.py             # 恢复检测器
│   ├── health_monitor.py       # Session 膨胀 + Gateway 存活检查
│   ├── reporter.py             # 状态上报（MQTT，P2）
│   └── cli.py                  # 命令行接口
└── tests/
    ├── test_watchdog.py
    ├── test_switcher.py
    └── test_recovery.py
```

### 5.2 配置策略：openclaw.json 为唯一 Provider 配置源

**设计决策：不引入独立的 `providers.yaml` 来定义 Provider 列表。**

理由：OpenClaw 实际读的是 `openclaw.json` 里的 `models.providers` 和 `agents.defaults.model`。如果再维护一份 `providers.yaml`，两份配置迟早不一致。

**配置分工：**

| 配置项 | 存储位置 | 说明 |
|--------|----------|------|
| Provider 列表、endpoint、优先级 | `openclaw.json` | OpenClaw 原生配置，唯一真相源 |
| Watchdog 运行参数 | `~/.catbus/provider-watchdog.yaml` | 独立于 OpenClaw 的监控参数 |
| Provider 运行时状态 | `~/.catbus/provider-state.json` | Watchdog 自动维护的状态数据 |

**provider-watchdog.yaml（只存 Watchdog 参数）：**

```yaml
# ~/.catbus/provider-watchdog.yaml

robot: nefi
mode: auto                     # auto | pinned
pinned_to: null                # pinned 模式下锁定的 provider name

watchdog:
  check_interval: 60           # 探测间隔（秒）
  fail_threshold: 3            # 连续失败几次触发切换
  recovery_interval: 300       # 恢复探测间隔（秒），默认 5 分钟
  recovery_threshold: 3        # 连续成功几次确认恢复
  cooldown: 300                # 切回后冷却期（秒），防抖动
  max_recovery_threshold: 30   # 抖动退避上限（最多需要 30 次连续成功才切回）

  # Session 和 Gateway 监控
  session_size_limit_mb: 4     # Session 文件超过此大小自动清理
  session_paths:               # Session 文件搜索路径（可配置，适应 OpenClaw 版本变化）
    - "~/.openclaw/agents/*/sessions*"
  gateway_check: true          # 是否检查 Gateway 进程存活
  gateway_url: "http://127.0.0.1:18789/"

  # 网络自检目标（用于区分本机网络故障 vs Provider 故障）
  network_check_target: "1.1.1.1"

# Provider 列表直接读 openclaw.json，不在此重复定义

notify:
  telegram: true
  mqtt: false                  # P2 阶段开启
```

**provider-state.json（Watchdog 自动维护）：**

```json
{
  "current_primary": "anthropic-main",
  "original_primary": null,
  "mode": "auto",
  "fail_count": 0,
  "recovery_count": 0,
  "flap_count": 0,
  "last_switch_time": null,
  "last_probe_time": "2026-02-22T10:00:00Z",
  "provider_states": {
    "anthropic-main": {"status": "healthy", "latency_ms": 230, "fail_count": 0},
    "openai-backup": {"status": "healthy", "latency_ms": 180, "fail_count": 0}
  }
}
```

### 5.3 双模式状态机

#### 自动模式（mode: auto）

```
正常运行                故障检测                自动切换              恢复检测

┌──────────┐  连续3次   ┌──────────┐  找到可用   ┌─────────────┐
│ PRIMARY  │  探测失败  │ FAILING  │  fallback  │ ON_FALLBACK │
│ (healthy)│ ────────→ │          │ ─────────→ │             │
└──────────┘           └──────────┘            └──────┬──────┘
     ↑                                                │
     │                                                │ 每5分钟探测原 primary
     │                                                │
     │     原 primary 连续3次探测成功 + 冷却期结束         │
     └────────────────────────────────────────────────┘
                      自动切回

     ↓ 所有 fallback 都不可用
┌──────────┐
│ ALL_DOWN │ → 发 Telegram 告警 + CatBus 心跳标记 provider_state: "all_down"
└──────────┘

     网络自检失败（独立于上述流程）
┌─────────────┐
│ NETWORK_DOWN│ → 跳过所有 Provider 探测，不计 fail_count
│             │ → CatBus 心跳标记 provider_state: "network_down"
└──────┬──────┘ → Nefi 路由时跳过（同 all_down）
       │ 网络恢复
       ▼
  恢复正常探测
```

#### 锁定模式（mode: pinned）

```
┌──────────┐  连续3次   ┌──────────┐
│ PINNED   │  探测失败  │ PINNED   │ → 只发告警，不切换
│ (healthy)│ ────────→ │(degraded)│
└──────────┘           └──────────┘

用户执行 unpin → 回到自动模式
```

#### 抖动防护（Anti-Flapping）

当 Provider 在健康和故障之间反复切换时：

```
切回后进入冷却期（默认 5 分钟）
冷却期内再次失败 → flap_count += 1
下次恢复探测阈值翻倍：

  recovery_threshold = min(base_threshold × 2^flap_count, max_recovery_threshold)

  正常：连续 3 次探测成功即切回
  第1次抖动：连续 6 次成功才切回（= 30 分钟）
  第2次抖动：连续 12 次成功才切回（= 60 分钟）
  ...
  上限：连续 30 次成功才切回（= 150 分钟）

  max_recovery_threshold 的含义：最多需要多少次连续成功探测才确认恢复
```

### 5.4 探测逻辑

**核心原则：全链路探测，同家族廉价模型验证 Provider 可达性，区分故障类型。**

#### 5.4.1 网络自检前置

```python
def run_cycle(self):
    # 第 0 步：网络自检
    if not self.network_check():
        # 本机网络故障（如 VPN 断线），不计入 fail_count
        self.report_status("local_network_down")
        self.notify.alert("⚠️ 本机网络不通，暂停 Provider 探测")
        return  # 跳过本轮探测，不触发切换

    # 正常探测 primary
    result = self.probe(self.primary)
    ...

def network_check(self) -> bool:
    """
    多目标网络自检，任一通过即认为网络正常。
    使用 443 端口（HTTPS），比 53（DNS）在更多网络环境下可用。
    """
    targets = [("1.1.1.1", 443), ("8.8.8.8", 443), ("223.5.5.5", 443)]
    for host, port in targets:
        try:
            socket.create_connection((host, port), timeout=3)
            return True
        except:
            continue
    return False
```

**解决的实际问题：** Nefi 走 VPN，VPN 切线路时所有 API 都不通，Watchdog 误判为所有 Provider 故障触发告警。加网络自检后，这种情况只报"本机网络不通"，不触发切换。

#### 5.4.2 探测模型选择：同家族廉价模型

**设计决策：使用同 Provider 最便宜的同家族模型探测 Provider 连通性。单模型熔断交给 OpenClaw 原生 failover 处理。**

职责分工：
- **Watchdog** 负责检测 Provider 是否可达（endpoint、auth、网络、路由）
- **OpenClaw 原生 fallback** 负责处理单模型熔断（请求级别重试，粒度更细）

用廉价模型探测足以验证全链路（鉴权 → 路由 → 推理），而单模型过载（如 Opus 被挤爆但 Haiku 正常）由 OpenClaw 在请求级别做 failover，不需要 Watchdog 介入切换整个 Provider。

```python
# 同家族最便宜模型映射表
PROBE_MODEL_MAP = {
    "claude-opus-4-6": "claude-haiku-4-5-20251001",
    "claude-sonnet-4-20250514": "claude-haiku-4-5-20251001",
    "gpt-5.1-codex": "gpt-4.1-mini",
    "gpt-4o": "gpt-4o-mini",
    "gemini-2.0-pro": "gemini-2.0-flash",
}

def get_probe_model(self, provider) -> str:
    """
    从 openclaw.json 读取当前工作模型，映射到同家族最便宜的模型。
    如果映射表里没有，用工作模型本身（可能本身就是便宜模型）。
    """
    work_model = self.read_work_model_from_config()
    return PROBE_MODEL_MAP.get(work_model, work_model)
```

探测成本对比（5 台机器 × 每分钟 1 次 × 24 小时 = 7,200 次/天）：
- Haiku 探测：~$0.07/天
- Opus 探测：~$1.44/天
- **选 Haiku，省 95% 成本，且随机器人增加线性可控**

#### 5.4.3 HTTP 状态码判定规则

```python
def evaluate_response(self, status_code, headers, body, provider) -> ProbeResult:
    """
    完整的状态码判定矩阵
    """

    # === 健康 ===
    # HTTP 2xx + 响应体包含有效内容 → 全链路通
    if 200 <= status_code < 300:
        if self.validate_body(body, provider.type):
            return ProbeResult(status="healthy", latency_ms=...)
        else:
            # 200 但 body 为空或包含错误（如代理层返回 "暂不支持"）
            return ProbeResult(status="unhealthy", reason="invalid_response_body")

    # === 429 限流：分类处理，不一刀切 ===
    if status_code == 429:
        return self.handle_rate_limit(headers, body)

    # === 明确不健康 ===
    if status_code == 401 or status_code == 403:
        return ProbeResult(status="unhealthy", reason="auth_error")

    if status_code == 404:
        return ProbeResult(status="unhealthy", reason="endpoint_not_found")

    if status_code == 529:
        # Anthropic 过载
        return ProbeResult(status="unhealthy", reason="provider_overloaded")

    if status_code >= 500:
        return ProbeResult(status="unhealthy", reason="server_error")

    # === 400 系列其他错误 ===
    # 注意：不再把 400 一律视为"健康"
    # 400 可能是模型名配错、Payload 格式变更等，需要检查
    if status_code == 400:
        # Azure content filter 拒绝等情况 → Provider 本身可用
        if self.is_content_filter(body):
            return ProbeResult(status="healthy")
        # 模型不存在、格式错误等 → 配置问题
        return ProbeResult(status="unhealthy", reason="bad_request")

    # 其他未知状态码
    return ProbeResult(status="unhealthy", reason=f"unexpected_{status_code}")
```

#### 5.4.4 响应体校验

```python
def validate_body(self, body, provider_type) -> bool:
    """
    确认响应体包含有效推理结果，而非空响应或代理层错误

    不同 API 类型的有效响应标志：
    - anthropic-messages: body 包含 "content"
    - openai-completions: body 包含 "choices"
    - google-generative-ai: body 包含 "candidates"
    """
    if not body:
        return False
    if provider_type == "anthropic-messages":
        return "content" in body
    elif provider_type == "openai-completions":
        return "choices" in body
    elif provider_type == "google-generative-ai":
        return "candidates" in body
    return False
```

#### 5.4.5 429 限流分类处理

```python
def handle_rate_limit(self, headers, body) -> ProbeResult:
    """
    429 不是故障，需要分类处理：

    1. insufficient_quota（余额不足/额度耗尽）
       → 立刻记为 3 次失败，瞬间触发切换
       → 不会自动恢复，需要人工充值

    2. rate_limit_exceeded（并发超限）
       → 不计入 Watchdog 的 fail_count
       → 并发限流应由 OpenClaw 执行层做 Exponential Backoff
       → Watchdog 只记录，不切换
    """
    error_type = self.parse_error_type(body)

    if error_type == "insufficient_quota":
        return ProbeResult(
            status="unhealthy",
            reason="quota_exhausted",
            force_fail_count=3
        )

    # 并发限流 → 不计入 fail_count
    retry_after = int(headers.get("retry-after", 60))
    return ProbeResult(
        status="throttled",
        reason="rate_limited",
        retry_after=retry_after,
        count_as_fail=False
    )

def parse_error_type(self, body) -> str:
    """
    解析错误类型，防御非 JSON 响应。

    注意：API 网关（Cloudflare、Azure Gateway、Nginx）在极端过载时
    可能返回 HTML 错误页面而非 JSON。必须严格防御。
    """
    # 1. 尝试 JSON 解析
    try:
        data = json.loads(body) if isinstance(body, str) else body
        # Anthropic: {"error": {"type": "...", "message": "..."}}
        error_type = data.get("error", {}).get("type", "")
        if "insufficient_quota" in error_type or "billing" in error_type:
            return "insufficient_quota"
        # OpenAI: {"error": {"code": "insufficient_quota"}}
        error_code = data.get("error", {}).get("code", "")
        if "insufficient_quota" in error_code or "quota" in error_code:
            return "insufficient_quota"
    except (json.JSONDecodeError, TypeError, AttributeError):
        pass

    # 2. JSON 解析失败（可能是 HTML），用正则回退
    body_str = str(body) if body else ""
    if re.search(r'insufficient.quota|quota.exhausted|billing', body_str, re.I):
        return "insufficient_quota"

    # 3. 无法判定，默认为并发限流（更安全的默认值）
    return "rate_limit_exceeded"
```

#### 5.4.6 探测状态总结

| 场景 | HTTP 码 | 响应体 | 判定 | 是否计入 fail_count |
|------|---------|--------|------|-------------------|
| 正常推理 | 2xx | 包含 content/choices/candidates | ✅ 健康 | 否（归零） |
| 响应体为空 | 2xx | 空 | ❌ 不健康 | 是 |
| 代理层返回"暂不支持" | 2xx | 包含错误信息 | ❌ 不健康 | 是 |
| 参数错误（content filter） | 400 | Azure content filter | ✅ 健康 | 否（归零） |
| 模型名配错 | 400 | model not found | ❌ 不健康 | 是 |
| 认证失败 | 401/403 | — | ❌ 不健康 | 是 |
| Endpoint 配错 | 404 | — | ❌ 不健康 | 是 |
| 并发限流 | 429 | rate_limit_exceeded | ⚠️ 限流 | **否** |
| 余额不足 | 429 | insufficient_quota | ❌ 不健康 | **直接 = 3** |
| Anthropic 过载 | 529 | overloaded_error | ❌ 不健康 | 是 |
| 服务端错误 | 5xx | — | ❌ 不健康 | 是 |
| 本机网络故障 | — | — | 🔌 网络断 | **否**（跳过探测） |

### 5.5 切换执行

```python
class Switcher:
    def do_switch(self, new_primary):
        """
        完整切换流程（含 session override 清除 + 验证）
        """
        old_primary = self.current_primary

        # 1. 改写 openclaw.json：primary + fallbacks 链顺序
        self.update_openclaw_config(new_primary)

        # 2. 清除所有活跃 session 的 providerOverride
        #    防止已有 session 继续走旧 provider
        self.clear_session_overrides()

        # 3. 平滑重载 gateway
        #    发送信号后，gateway 应等待当前请求完成再应用新配置
        self.reload_gateway()

        # 4. 轮询验证切换是否生效（防止高负载机器重启慢导致误判）
        if not self.wait_for_switch(new_primary, timeout=10, interval=2):
            # 超时仍未生效，强制重启 gateway
            self.restart_gateway()
            self.notify.warn("⚠️ 热加载 10 秒内未生效，已强制重启 gateway")

    def wait_for_switch(self, expected_primary, timeout=10, interval=2) -> bool:
        """轮询验证 gateway 是否已切换到新 primary"""
        elapsed = 0
        while elapsed < timeout:
            time.sleep(interval)
            elapsed += interval
            actual = self.get_current_primary_from_gateway()
            if actual == expected_primary.name:
                return True
        return False

        # 5. 通知
        self.notify.switch(old_primary, new_primary)

        # 6. (P2) MQTT 状态变更广播
        if self.config.notify.mqtt:
            self.reporter.broadcast_switch(old_primary, new_primary)

    def update_openclaw_config(self, new_primary):
        """
        同步更新 primary 和 fallback 链

        确保 Watchdog 的 priority 排序 = OpenClaw fallback 链顺序
        """
        config = self.read_openclaw_config()
        all_providers = self.get_sorted_providers()  # 按 priority 排序

        config["agents"]["defaults"]["model"]["primary"] = new_primary.model
        config["agents"]["defaults"]["model"]["fallbacks"] = [
            p.model for p in all_providers if p.name != new_primary.name
        ]
        self.write_openclaw_config(config)

    def clear_session_overrides(self):
        """
        直接编辑 sessions.json 文件，清除所有 model/provider override。

        注意：OpenClaw 没有 CLI 命令来批量重置 session override，
        必须直接操作文件。直接读写 JSON 文件瞬间完成，
        避免循环调用子进程阻塞 Watchdog 主循环。
        """
        for sessions_file in glob("~/.openclaw/agents/*/sessions.json"):
            try:
                with open(sessions_file) as f:
                    sessions = json.load(f)
                modified = False
                for sid, s in sessions.items():
                    if "modelOverride" in s or "providerOverride" in s:
                        s.pop("modelOverride", None)
                        s.pop("providerOverride", None)
                        modified = True
                if modified:
                    with open(sessions_file, 'w') as f:
                        json.dump(sessions, f, indent=2)
            except (json.JSONDecodeError, IOError) as e:
                self.notify.warn(f"⚠️ 清除 session override 失败: {e}")

    def reload_gateway(self):
        """
        平滑重载 gateway

        注意：必须是 Graceful Reload，等待当前连接处理完毕再应用新配置。
        如果 gateway 正在执行耗时任务（如 3 分钟的代码生成），
        USR1 不能打断该任务，只对下一个请求生效。

        如果 OpenClaw gateway 不支持 USR1 信号，改用：
        openclaw gateway restart
        """
        pid = self.get_gateway_pid()
        if pid:
            os.kill(pid, signal.SIGUSR1)
        else:
            subprocess.run(["openclaw", "gateway", "restart"])
```

**切换时机梳理：**

| 触发条件 | 动作 | 通知 |
|----------|------|------|
| 自动模式，primary 连续 N 次失败 | 切换 primary + 同步 fallback 链 + 清除 session override | 🔄 切换通知 |
| 自动模式，原 primary 恢复 | 切回 + 同步 fallback 链 + 清除 session override | ✅ 恢复通知 |
| 锁定模式，primary 连续 N 次失败 | 不切换 | ⚠️ 告警通知 |
| 自动模式，所有 provider 不可用 | 无法切换，标记 all_down | 🚨 紧急告警 |
| 429 余额不足 | 立即切换（force_fail_count=3） | 🔄 切换通知 |
| 429 并发限流 | 不切换 | 仅记录 |
| 本机网络故障 | 不切换，跳过探测 | ⚠️ 网络告警 |

### 5.6 恢复检测

```python
class RecoveryChecker:
    """
    仅在自动模式 + 当前运行在 fallback 上时激活。

    工作流程：
    1. 每 recovery_interval（默认 5 分钟）对原 primary 执行一次探测
    2. 连续 recovery_threshold 次成功 → 确认恢复
    3. 检查冷却期是否结束
    4. 满足条件 → 执行切回（同样走完整的 Switcher 流程）
    5. 切回后重置 recovery_count，进入冷却期
    """
```

**恢复探测的调度：**

恢复探测与常规探测共用同一个定时循环，通过 cycle 计数控制频率：

```
常规探测：每 60 秒（每个 cycle）
恢复探测：每 300 秒（每 5 个 cycle）

cycle 0: 探测 primary
cycle 1: 探测 primary
cycle 2: 探测 primary
cycle 3: 探测 primary
cycle 4: 探测 primary + 探测原 primary（恢复检测）
cycle 5: 探测 primary
...
```

### 5.7 Session 膨胀 + Gateway 存活监控

**来源于实际踩坑：** Nefi 的主要问题经常不是 Provider 挂了，而是 session 膨胀到 4.6MB 导致 agent 卡死，或 gateway 重启后 agent 消失。

```python
class HealthMonitor:
    """与 Provider 探测一起运行的本机健康检查"""

    def check_session_health(self):
        """
        检查 session 文件大小，超限自动清理。
        路径从 provider-watchdog.yaml 的 session_paths 读取（可配置）。
        只清理非活跃 session（最后修改时间超过 24 小时），避免丢失当前对话上下文。
        """
        for pattern in self.config.session_paths:
            for f in glob(os.path.expanduser(pattern)):
                size_mb = os.path.getsize(f) / 1024 / 1024
                if size_mb > self.config.session_size_limit_mb:
                    # 只清理非活跃 session
                    mtime = os.path.getmtime(f)
                    if time.time() - mtime > 86400:  # 24 小时未更新
                        self.backup_and_clear(f)
                        self.notify.alert(
                            f"⚠️ Session {f} 膨胀到 {size_mb:.1f}MB，已备份并清理"
                        )
                    else:
                        self.notify.warn(
                            f"⚠️ 活跃 Session {f} 已达 {size_mb:.1f}MB，需手动处理"
                        )

    def check_gateway(self) -> bool:
        """
        检查 Gateway 进程是否存活。

        连续 3 次（15 秒内）都不通才重启，防止瞬时抖动。
        注意：Gateway 重启会断开所有活跃 WebSocket 连接，
        中断正在执行的 AI 请求，所以必须谨慎。
        """
        for attempt in range(3):
            try:
                r = requests.get(self.config.gateway_url, timeout=5)
                if r.status_code == 200:
                    return True
            except:
                pass
            if attempt < 2:
                time.sleep(5)

        # 连续 3 次不通，确认 gateway 挂了
        self.notify.alert("🚨 Gateway 连续 15 秒无响应，正在重启...")
        subprocess.run(["openclaw", "gateway", "restart"])
        return False
```

**执行时机：** 与 Watchdog 探测同步，每个 cycle（60 秒）执行一次。

### 5.8 Watchdog 自身故障保护

```
Watchdog 自保措施：

1. systemd 注册为 Restart=always 服务
   → 进程挂了自动重启

2. Watchdog 进程每次探测后写入心跳文件
   → ~/.catbus/watchdog-heartbeat（跨平台，无需 sudo）

3. gouzi 巡检时检查各机器人 Watchdog 最后心跳时间
   → 超过 5 分钟没心跳 → 告警

4. 启动时自动恢复上次状态
   → 从 provider-state.json 读取，不丢失 fail_count 等信息
```

### 5.9 命令行接口

```bash
# 查看当前状态
catbus provider status
# 输出示例：
# robot: nefi
# mode: auto
# primary: anthropic-main (healthy, latency: 230ms)
# fallback: openai-backup (healthy), google-fallback (healthy)
# gateway: running | sessions: 3 (max 1.2MB)

# 查看详细信息
catbus provider status --detail
# 输出示例：
# robot: nefi | mode: auto | network: ok
# ┌──────────────────┬──────────┬────────────┬───────────┐
# │ Provider         │ Status   │ Latency    │ Priority  │
# ├──────────────────┼──────────┼────────────┼───────────┤
# │ anthropic-main   │ healthy  │ 230ms      │ 1 ★       │
# │ openai-backup    │ healthy  │ 180ms      │ 2         │
# │ google-fallback  │ healthy  │ 310ms      │ 3         │
# └──────────────────┴──────────┴────────────┴───────────┘
# last_switch: none | fail_count: 0 | uptime: 3d 12h

# 锁定到指定 provider
catbus provider pin openai-backup
# → 🔒 已锁定到 openai-backup

# 解除锁定
catbus provider unpin
# → 🔓 已解除锁定，恢复自动模式

# 手动切换（一次性，自动模式继续生效）
catbus provider switch google-fallback
# → 已切换到 google-fallback（自动模式保持）

# 手动触发一次全量探测
catbus provider probe
# → network: ok
# → anthropic-main: healthy (232ms)
# → openai-backup: healthy (175ms)
# → google-fallback: healthy (308ms)
# → gateway: running | sessions: 3 (max 1.2MB)
```

---

## 6. gouzi 全局管理设计（P2 阶段）

### 6.1 设计原则：轻量实用，不过度设计

**P2 只做四件事：**

1. **状态上报** — 每次探测后通过 MQTT 上报
2. **gouzi 汇总展示** — 收集各机器状态，统一展示
3. **批量 pin/unpin/switch** — 通过 MQTT 下发控制指令
4. **告警聚合** — 同一 Provider 多机故障合并通知 + Watchdog 心跳巡检

**明确不做：**

- ~~CRUD 指令（add/remove/update/set_priority/reset）~~ — 增删 Provider 是极低频操作（几个月一次），且每次都涉及环境变量配置需要 SSH 上去，用 `scp + ssh` 同步配置文件更简单可靠
- ~~Provider Catalog / Assignment Table~~ — 5 台机器手动管理完全够用，过早抽象
- ~~ConfigManager 本地校验逻辑~~ — 随 CRUD 一起砍掉

### 6.2 MQTT Topic 设计

```
# 各机器人状态上报（由本地 Provider Skill 发布）
catbus/provider/{robot}/status

# gouzi 下发控制指令
catbus/provider/{robot}/command

# 机器人回报指令执行结果
catbus/provider/{robot}/command_result

# 全局告警（由 gouzi 发布）
catbus/provider/alerts
```

**gouzi 自动发现机制：** gouzi 订阅 `catbus/provider/+/status`（MQTT 通配符），无需维护机器人列表。新机器人安装 Provider Skill 后自动出现在 gouzi 的监控范围内。

### 6.3 状态上报消息格式

```json
{
  "robot": "nefi",
  "timestamp": "2026-02-22T10:00:00Z",
  "mode": "auto",
  "primary": "anthropic-main",
  "original_primary": null,
  "network": "ok",
  "gateway": "running",
  "provider_state": "healthy",
  "session_max_size_mb": 1.2,
  "providers": {
    "anthropic-main": {
      "status": "healthy",
      "latency_ms": 230,
      "fail_count": 0
    },
    "openai-backup": {
      "status": "healthy",
      "latency_ms": 180,
      "fail_count": 0
    }
  },
  "watchdog_heartbeat": "2026-02-22T10:00:00Z"
}
```

### 6.4 批量控制指令

```json
{"action": "pin", "provider_name": "openai-backup"}
{"action": "unpin"}
{"action": "switch", "provider_name": "google-fallback"}
{"action": "probe"}
```

**幂等设计（CatBus 有 4 级重试，同一条指令可能被送达多次）：**

- `pin` 重复执行 → 如果已 pinned 到同一目标，返回 ok
- `unpin` 重复执行 → 如果已是 auto 模式，返回 ok
- `switch` 重复执行 → 如果已是该 primary，返回 ok
- `probe` 重复执行 → 无副作用

### 6.5 gouzi 全局功能

**告警聚合：**

```
如果同一个 Provider（如 Anthropic）在 2 台以上机器人同时标记为 unhealthy：
→ 判定为 Provider 侧全面故障
→ 发送一条汇总告警，而非每台机器人各发一条

示例：
🚨 [全局] Anthropic API 疑似故障
  - nefi: 连续 3 次失败，已切换到 openai-backup
  - huanhuan: 连续 2 次失败
  - mimi: 正常
```

**Watchdog 心跳巡检：**

```
gouzi 每 5 分钟检查各机器人的 watchdog_heartbeat 时间戳
超过 5 分钟没更新 → 告警：

⚠️ [全局] xiaohei 的 Watchdog 进程疑似挂掉
  最后心跳：2026-02-22 09:52:00 UTC（8 分钟前）
  建议：SSH 检查 systemd 服务状态
```

**运维报告（每日/按需）：**

```
📊 Provider 运维日报 — 2026-02-22

整体可用率：
  Anthropic: 99.2%（nefi 有 1 次短暂中断，持续 8 分钟）
  OpenAI: 100%
  Google: 100%

切换事件：
  10:32 nefi anthropic-main → openai-backup（自动，原因：server_error）
  10:40 nefi openai-backup → anthropic-main（自动恢复）

限流事件：
  14:15 huanhuan anthropic-main 429 rate_limited（持续 30 秒，未切换）

当前状态：
  nefi:     anthropic-main ✅ auto     | gateway ✅ | watchdog ✅
  huanhuan: anthropic-main ✅ auto     | gateway ✅ | watchdog ✅
  mimi:     anthropic-main ✅ auto     | gateway ✅ | watchdog ✅
  xiaohei:  openai-backup  🔒 pinned  | gateway ✅ | watchdog ✅
```

**gouzi 操作流程示例：**

```
你 → gouzi：各机器人 provider 什么状态？
gouzi：
  nefi:     anthropic-main ✅ (auto)
  huanhuan: openai-backup ⚠️ (auto, anthropic 30min前挂了，已自动切换)
  mimi:     anthropic-main ✅ (auto)
  xiaohei:  openai-backup 🔒 (pinned)

你 → gouzi：全部 pin 到 openai
gouzi → 向 nefi、huanhuan、mimi、xiaohei 下发 pin 指令
gouzi：
  ✅ nefi: pinned to openai-backup
  ✅ huanhuan: 已在 openai-backup 上，确认 pinned
  ✅ mimi: pinned to openai-backup
  ❌ xiaohei: openai-backup 不在其 provider 列表中

你 → gouzi：给 xiaohei 加上 openai
gouzi：增删 Provider 需要 SSH 操作，我来帮你生成命令：
  ssh xiaohei "vim ~/.openclaw/openclaw.json"  # 添加 provider
  ssh xiaohei "export OPENAI_API_KEY=xxx >> ~/.bashrc"
  ssh xiaohei "catbus provider probe"  # 验证
```

### 6.6 Key 管理安全边界

| 规则 | 原因 |
|------|------|
| **Key 永远不通过 MQTT 传输** | 最小权限原则（CatBus 虽已 TLS 加密，但 Key 传输无必要） |
| **Key 永远不存在 gouzi 上** | gouzi 不需要知道其他机器人的 key |
| **增删 Provider 通过 SSH 操作** | 涉及环境变量配置，MQTT 无法完成 |
| **gouzi 只下发控制指令** | pin/unpin/switch/probe，不涉及配置修改 |

---

## 7. Telegram 通知规范

所有通知统一格式，按严重级别区分：

```
# 自动切换
🔄 [nefi] provider 切换
  anthropic-main → openai-backup
  原因：连续 3 次探测失败（server_error）
  时间：2026-02-22 10:32:15 UTC

# 自动恢复
✅ [nefi] provider 恢复
  openai-backup → anthropic-main（切回）
  原因：原 primary 连续 3 次探测成功
  离线时长：8 分钟

# 余额不足紧急切换
🔄 [nefi] provider 紧急切换（余额不足）
  anthropic-main → openai-backup
  原因：HTTP 429 insufficient_quota
  ⚠️ 需要充值 Anthropic 账户

# 锁定模式告警
⚠️ [nefi] provider 异常（锁定模式，未切换）
  anthropic-main 连续 3 次探测失败
  当前模式：pinned
  操作建议：手动检查或 unpin 启用自动切换

# 全部不可用
🚨 [nefi] 所有 provider 不可用！
  anthropic-main: 连续 5 次失败（server_error）
  openai-backup: 连续 3 次失败（auth_error）
  google-fallback: 连续 3 次失败（server_error）
  需要人工介入

# 本机网络故障
🔌 [nefi] 本机网络不通
  网络自检失败（1.1.1.1 不可达）
  Provider 探测已暂停，不触发切换
  可能原因：VPN 断线

# Session 膨胀
⚠️ [nefi] Session 自动清理
  ~/.openclaw/agents/main/sessions/abc.jsonl 膨胀到 4.6MB
  已备份到 ~/.openclaw/backups/ 并清空

# Gateway 异常
🚨 [nefi] Gateway 无响应，已自动重启

# 手动操作确认
🔒 [nefi] 手动锁定到 openai-backup
🔓 [nefi] 解除锁定，恢复自动模式

# gouzi 全局告警
🚨 [全局] Anthropic API 疑似全面故障
  受影响：nefi, huanhuan（已自动切换）
  mimi, xiaohei：暂未受影响

# gouzi Watchdog 心跳告警
⚠️ [全局] xiaohei 的 Watchdog 疑似挂掉（最后心跳 8 分钟前）
```

---

## 8. 部署方案

### 8.1 一键安装

```bash
catbus skill install provider
```

install.sh 执行以下步骤：

0. **检测并停止旧版 watchdog**（provider-watchdog.js），清理旧 systemd/launchd 服务
1. 复制 Skill 代码到 `~/.catbus/skills/provider/`
2. 生成 `~/.catbus/provider-watchdog.yaml`（Watchdog 参数模板）
3. **校验 `openclaw.json` 中的 Provider 命名是否符合全局规范**（不符合则告警）
4. 自动检测本地已有的环境变量（`ANTHROPIC_API_KEY` 等）
5. 使用同家族廉价模型对已配置的 Provider 执行一次探测，确认全链路连通
6. 检查 Gateway 存活状态
7. 注册为 systemd 服务（`Restart=always`），macOS 注册 launchd
8. 输出配置摘要

### 8.2 安装输出示例

```
$ catbus skill install provider

[0/8] Checking for legacy watchdog...
  Found provider-watchdog.js (pid 12345)              🔄 stopping...
  Removed systemd service provider-watchdog            ✅
[1/8] Installing provider skill...                    ✅
[2/8] Generating provider-watchdog.yaml...            ✅
[3/8] Validating provider names in openclaw.json...
  anthropic-main                                      ✅ matches catalog
  openai-backup                                       ✅ matches catalog
  ⚠️  azure-claude → 建议重命名为 azure-anthropic（与其他机器人统一）
[4/8] Detecting API keys...
  ANTHROPIC_API_KEY                                   ✅ found
  OPENAI_API_KEY                                      ✅ found
  GOOGLE_API_KEY                                      ❌ not set
[5/8] Probing providers (probe model: claude-haiku-4-5-20251001)...
  anthropic-main: healthy (235ms)
  openai-backup: healthy (182ms)
[6/8] Checking gateway...                             ✅ running
[7/8] Registering systemd service (Restart=always)... ✅
[8/8] Summary

Provider Skill installed.
  Config: ~/.catbus/provider-watchdog.yaml
  Provider source: ~/.openclaw/openclaw.json
  Mode: auto
  Primary: anthropic-main (priority 1)
  Fallback: openai-backup (priority 2)

Run 'catbus provider status' to check anytime.
```

### 8.3 新机器人接入流程

**设计原则：新增一台机器人，只需要两步，不需要改 gouzi 或其他机器人的任何配置。**

```
新机器人接入 = 配好 OpenClaw + 运行 install script

第 1 步：在新机器上配置 OpenClaw（已有流程，与本 Skill 无关）
  - 安装 OpenClaw
  - 配置 openclaw.json（provider 列表、API key 环境变量）
  - 确认 gateway 正常运行

第 2 步：安装 Provider Skill
  $ catbus skill install provider
  → 自动读取 openclaw.json 中的 provider 列表
  → 自动校验命名规范
  → 自动探测所有 provider
  → 自动注册 systemd 服务
  → 自动通过 MQTT 上报状态（P2 阶段）

完成。gouzi 自动发现新机器人，无需手动注册。
```

**gouzi 如何自动发现新机器人：**

gouzi 订阅 `catbus/provider/+/status`（MQTT 通配符），任何新机器人开始上报状态，gouzi 立即看到。不维护机器人列表，不需要注册步骤。

```
新机器人 dahuang 上线：
  1. dahuang 运行 install script
  2. dahuang 的 Watchdog 开始向 catbus/provider/dahuang/status 发消息
  3. gouzi 收到消息，dahuang 自动出现在全局状态面板

你 → gouzi：各机器人状态？
gouzi：
  nefi:     anthropic-main ✅ (auto)
  huanhuan: anthropic-main ✅ (auto)
  mimi:     anthropic-main ✅ (auto)
  xiaohei:  openai-backup  🔒 (pinned)
  dahuang:  anthropic-main ✅ (auto)    ← 自动出现，无需配置
```

**批量操作也自动覆盖新机器人：**

gouzi 的批量 pin/unpin 指令发往 `catbus/provider/+/command` 或逐个发送给已发现的机器人列表。新机器人加入后自动纳入批量操作范围。

**扩展不需要的东西：**

| 不需要 | 原因 |
|--------|------|
| 在 gouzi 上注册新机器人 | MQTT 通配符订阅自动发现 |
| 中心化的机器人列表 | gouzi 从 MQTT 消息动态构建 |
| 给新机器人分配 Provider | 新机器人自带 openclaw.json，自己管自己 |
| 修改其他机器人的配置 | 每台机器独立自治 |
| 新的部署脚本或流程 | 同一个 install script，所有机器通用 |

---

## 9. 实施计划

| 阶段 | 内容 | 交付物 | 预估工时 |
|------|------|--------|---------|
| **P0** | 标准化 Watchdog + Switcher | watchdog.py（网络自检 + 同家族模型探测 + 429 分类 + 响应体校验）、switcher.py（改写 openclaw.json + 同步 fallback 链 + 清除 session override + 平滑重载 + 轮询验证 + Telegram 通知）、provider-watchdog.yaml 格式定义 | 1.5 天 |
| **P1** | 恢复检测 + 双模式 + 健康监控 + CLI + 部署 | recovery.py、pin/unpin 逻辑、抖动防护、health_monitor.py（session 膨胀 + gateway 存活）、cli.py 命令行工具、install.sh（含旧 watchdog 迁移 + Provider 命名校验）、systemd/launchd 服务注册 | 1 天 |
| **P2** | CatBus 集成 + gouzi 全局管理 | reporter.py（MQTT 状态上报 + CatBus 心跳 provider_state 注入）、gouzi 状态汇总展示、批量 pin/unpin/switch（幂等设计）、告警聚合、Watchdog 心跳巡检 | 1 天 |
| **P3** | 运维增强 | 每日运维报告、可用率统计、延迟趋势 | 0.5 天 |

**建议：P0 + P1 先部署到全部 5 台机器人验证，再推进 P2。**

---

## 10. 风险与应对

| 风险 | 影响 | 应对 |
|------|------|------|
| 恢复后再次故障（抖动） | 频繁切换影响服务稳定性 | 冷却期 + 指数退避，最长需 30 次连续成功（150 分钟） |
| VPN/网络断线导致所有 API 不通 | 误判为所有 Provider 故障 | 网络自检前置，网络故障时跳过探测，不计入 fail_count |
| 探测模型与工作模型不一致（单模型熔断） | Watchdog 判健康但业务失败 | 同家族廉价模型检测 Provider 可达性，单模型熔断由 OpenClaw 原生 failover 处理 |
| 429 并发限流被误判为故障 | 不必要的切换 | 429 分类处理：并发限流不计入 fail_count，余额不足立即切换 |
| 200 但响应体无效（代理层错误） | 误判为健康 | 响应体校验，必须包含 content/choices/candidates |
| Session providerOverride 导致切换无效 | 已有 session 继续走旧 provider | Switcher 切换后清除所有 session override |
| Gateway 热加载未生效 | 实际仍在用旧 provider | 轮询验证（每 2 秒查一次，最多 10 秒），不生效则强制重启 |
| Session 膨胀导致 agent 卡死 | 机器人无法工作 | HealthMonitor 监控 session 大小，超限自动清理 |
| Gateway 进程挂掉 | 机器人完全失联 | HealthMonitor 检测到后立即重启 |
| Watchdog 进程自身挂掉 | 失去 Provider 监控能力 | systemd Restart=always + gouzi 巡检心跳 |
| Provider 命名不统一 | fallback 匹配失败 | install.sh 校验命名 + 全局命名规范 |
| MQTT 指令重复送达 | 操作被执行多次 | 所有控制指令幂等设计 |
| 所有 Provider 同时不可用 | 机器人完全失联 | 立即告警 + CatBus 心跳标记 all_down + gouzi 全局可见 |
| Watchdog 与 OpenClaw 原生 fallback 打架 | 两套切换逻辑冲突 | Switcher 同步更新 primary + fallbacks[]，保持一致 |

---

## 11. 关键设计决策摘要

1. **openclaw.json 为唯一 Provider 配置源** — 不引入 providers.yaml 重复定义，避免双源不一致
2. **同家族廉价模型探测** — Watchdog 检测 Provider 可达性（endpoint + auth + 路由），单模型熔断交给 OpenClaw 原生 failover 处理，成本低 20 倍
3. **只认 2xx + 有效响应体为健康** — 不再把 400 一律视为健康，补充 404/529/body 校验
4. **429 分类处理** — 并发限流不切换，余额不足立即切换
5. **网络自检前置** — 区分本机网络故障 vs Provider 故障，避免 VPN 断线误判
6. **切换后清除 Session Override** — 防止已有 session 继续走旧 provider
7. **切换后验证 + 平滑重载** — 确认热加载生效，不打断正在执行的任务
8. **Switcher 同步更新 fallback 链** — Watchdog 和 OpenClaw 原生 fallback 是同一配置的两种视角
9. **Provider 全局统一命名** — 禁止本地起别名，install.sh 校验
10. **本地 Skill 零 CatBus 依赖** — 每台机器人独立自治
11. **P2 轻量化** — 砍掉 CRUD 指令体系，增删 Provider 通过 SSH 操作
12. **CatBus 心跳注入 provider_state** — Nefi 路由时跳过 all_down 节点
13. **Watchdog 自保** — systemd Restart=always + gouzi 巡检心跳
14. **Session 膨胀 + Gateway 存活监控** — 纳入 Watchdog 统一管理
15. **双模式（auto / pinned）** — 自动运行为主，手动锁定为辅
16. **Key 永远不离开本地** — 最小权限原则
17. **抖动防护** — 冷却期 + 指数退避，`max_recovery_threshold: 30` 表示最多需要 30 次连续成功探测才切回
18. **MQTT 指令幂等** — 适配 CatBus 4 级重试机制
19. **零注册扩展** — 新机器人运行 install script 即接入，gouzi 通过 MQTT 通配符自动发现，不维护机器人列表

---

## 附录 A：v1 → v2 变更记录

| 变更项 | v1 方案 | v2 方案 | 来源 |
|--------|---------|---------|------|
| Provider 配置源 | 独立 providers.yaml | openclaw.json 为唯一源 | 审核 1+2 |
| 探测模型 | ping_model（廉价模型） | 同家族廉价模型（检测 Provider 可达性，单模型熔断由 OpenClaw 原生 failover 处理） | 审核 3+5+6 |
| 400 状态码 | 一律视为健康 | 分类判定，仅 content filter 等场景视为健康 | 审核 2+3 |
| 429 处理 | 一律视为不健康 | 分类：并发限流不计 fail，余额不足立即切换 | 审核 1+2+3 |
| 响应体校验 | 无 | 必须包含 content/choices/candidates | 审核 2 |
| 网络自检 | 无 | 多目标 any-pass（443 端口），网络故障不计 fail | 审核 1+5+6 |
| Session Override | 无 | 切换后清除所有 session override | 审核 2 |
| 切换后验证 | 无 | 轮询验证（每 2s × 5 次），不生效强制重启 | 审核 1+5 |
| Fallback 链同步 | 只改 primary | 同步更新 primary + fallbacks[] | 审核 2 |
| Session 膨胀监控 | 无 | 可配置路径 + 只清理非活跃 session（24h 未更新） | 审核 1+5 |
| Gateway 存活检查 | 无 | 连续 3 次（15 秒）不通才重启 | 审核 1+5 |
| Watchdog 自保 | 无 | systemd Restart=always + 心跳 | 审核 2 |
| Provider 命名校验 | 无 | install.sh 校验 + 全局命名规范 | 审核 1 |
| P2 CRUD 体系 | 完整 CRUD 指令 | 砍掉，用 SSH 操作 | 审核 2 |
| Nefi 路由 | 完全不感知 Provider | 心跳注入 provider_state | 审核 3 |
| 热加载方式 | kill -USR1 | 平滑重载 + 确认支持 USR1 否则用 restart | 审核 2+3 |
| Token 消耗描述 | "零消耗" | "极低消耗"（约 10 input token） | 审核 2 |
| MQTT 安全理由 | "明文传输风险" | "最小权限原则"（CatBus 已 TLS） | 审核 2 |
| max_flap_backoff 含义 | 不清晰 | 改为 max_recovery_threshold: 30（次数） | 审核 2 |
| MQTT 指令幂等 | 无 | 所有控制指令幂等设计 | 审核 1 |
| 旧 watchdog 迁移 | 无 | install.sh 自动停止旧 watchdog.js + 清理服务 | 审核 6 |
| Session 路径 | 硬编码 | provider-watchdog.yaml 可配置 session_paths | 审核 5 |
| Session 清理策略 | 直接清空 | 只清理非活跃 session（24h 未更新），活跃的只告警 | 审核 5 |
| 状态上报 | 无 session 信息 | 加 session_max_size_mb 字段 | 审核 6 |
| JSON 解析防御 | 无 | parse_error_type 含 try-except + 正则回退 | 审核 5 |
| P0/P1 工时 | P0: 1天, P1: 0.5天 | P0: 1.5天（核心 watchdog+switcher），P1: 1天（加入 health_monitor） | 审核 5 |
