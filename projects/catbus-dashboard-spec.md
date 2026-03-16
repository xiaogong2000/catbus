# CatBus Dashboard 方案 v2

> 基于 v1 反馈修订。变更标记 `[v2]`。

## 目标
一个 Web 页面，实时展示 5 台机器人的全部状态，替代手动查询。

## 数据来源

### 已有数据（零成本获取）
| 数据 | 来源 | 方式 |
|------|------|------|
| Provider 健康状态 | MQTT `catbus/provider/{robot}/status` | 已有，retain 消息 |
| 当前 primary/fallbacks | 同上 | 已有 |
| Provider 探测延迟 | 同上 | 已有 |
| CatBus Daemon 心跳 | MQTT `catbus/heartbeat/{robot}` | `[v2]` 已有，daemon 自带 |

### 需要新增采集的数据
| 数据 | 来源 | 方式 |
|------|------|------|
| OpenClaw 版本 | `openclaw status --json` → gateway.self.version | 新增上报 |
| Gateway 状态 | `openclaw status --json` → gateway.reachable | 新增上报 |
| OS 信息 | `openclaw status --json` → os.label | 新增上报 |
| Session 数量/Token | `openclaw status --json` → sessions | 新增上报 |
| Skills 列表 | `openclaw skills list --json` → skills[].name | 新增上报 |
| 机器基本信息 | `uptime` / `df -h` / `free -m` | 新增上报 |

### `[v2]` P0 前置验证
**在写任何代码之前**，先在 5 台机器上各跑一次：
```bash
openclaw status --json 2>&1 | head -5
openclaw skills list --json 2>&1 | head -5
```
确认：
- 所有机器的 OpenClaw 版本是否支持 `--json`
- 输出格式是否一致（字段差异）
- 命令执行耗时（>5s 则需要降低采集频率）

### `[v2]` Token 消耗统计（增量方案）
~~每天定时快照~~ → 改为 **实时增量上报**。

原因：session 被清理（膨胀超限自动清理）时累计值归零，每日快照会丢数据。

**增量方案：**
```
collector 每 60s 上报时：
  current_tokens = sum(所有 session 的 totalTokens)
  delta = current_tokens - last_reported_tokens
  → MQTT 发送 delta
  → dashboard-api 侧 SQLite 累加

即使 session 被清理，之前的增量已经落库。
```

## 架构

```
各机器 (5台)                    浣浣 ge.ovh                    浏览器
┌─────────────┐               ┌──────────────┐               ┌─────────┐
│ collector.py │──MQTT──→     │ dashboard-api │──HTTP──→     │ 静态页面 │
│ (每60s上报)  │              │ (Python)      │              │ (HTML)   │
└─────────────┘               │ + SQLite 存储 │              └─────────┘
                              └──────────────┘
```

### 为什么放浣浣？
- 已有公网 IP + Caddy 反代
- 是 MQTT Broker 所在机器，订阅零延迟
- 已有 Python 环境

### `[v2]` 存储：直接 SQLite
~~内存 dict + 可选 SQLite~~ → **一开始就 SQLite**。

Token 历史必须持久化，dashboard-api 重启不能丢数据。SQLite 对这个量级零负担。
当前状态用内存 cache 加速读取，写入一定落 SQLite。

### `[v2]` 安全：Cloudflare Access + basicauth fallback
Dashboard 公网可访问，展示了机器 IP、Provider 列表、系统信息。

**首选**：Cloudflare Access（零成本，邮箱 OTP 验证）
**备选**：Caddy basicauth
```
dashboard.xiai.xyz {
    basicauth {
        rocs $2a$14$...
    }
    reverse_proxy localhost:8901
}
```

## 页面设计

### 顶部：全局概览
```
🟢 5/5 Online | Primary: azure-claude | 今日 Token: 125K | 本周: 890K
```

### `[v2]` 主体：5 台机器卡片（含离线检测 + CatBus 状态）
```
┌─ nefi (Mac Studio) ──────────────────────────┐
│ 🟢 Online | 最后上报: 30s 前                   │
│ OpenClaw 2026.2.19-2 | macOS arm64            │
│                                                │
│ CatBus: 🟢 daemon running | 心跳: 15s 前      │
│                                                │
│ Provider: azure-claude/claude-opus-4-6  ✅     │
│ Fallbacks: newcli-aws ✅ | azure-openai ✅     │
│ Latency: 2.9s                                  │
│                                                │
│ Token: 今日 25K | 本周 180K | 本月 520K        │
│ Sessions: 37 | Gateway: running                │
│                                                │
│ Skills: catbus, tavily, seo, n8n-api +14       │
│ Uptime: 3d 12h | Disk: 45% | Mem: 8.2G        │
└────────────────────────────────────────────────┘

┌─ xiaohei (US OVH) ───────────────────────────┐
│ 🔴 Offline | 最后上报: 8 分钟前                │  ← 超 3 分钟变红
│ ...（数据变灰，标记 stale）                     │
└────────────────────────────────────────────────┘
```

**离线判定规则：**
- < 90s：🟢 Online
- 90s ~ 180s：🟡 Delayed
- > 180s：🔴 Offline（卡片变灰）

### 底部：Provider 全局矩阵
```
Provider          nefi    gouzi   huanhuan  mimi    xiaohei
azure-claude      ✅ 2.9s  ✅ 3.2s  ✅ 2.2s   ✅ 2.0s  ✅ 1.4s
azure-openai      ✅ 1.4s  ✅ 1.3s  ✅ 1.6s   ✅ 1.5s  ✅ 1.2s
newcli-aws        ✅ 2.1s  ✅ 3.5s  ✅ 2.5s   ✅ 2.3s  ✅ 1.9s
openai            ❌ 403   —       ❌ 403    ❌ 403   ❌ 403
```

## MQTT Topic 结构

```
catbus/provider/{robot}/status          # Provider 状态（已有）
catbus/dashboard/{robot}/full           # [v2] 完整状态上报（新增）
catbus/dashboard/{robot}/token_delta    # [v2] Token 增量（新增）
```

### full payload 示例
```json
{
  "robot": "nefi",
  "ts": "2026-02-22T04:30:00Z",
  "openclaw": {
    "version": "2026.2.19-2",
    "gateway": "running",
    "sessions_count": 37,
    "total_tokens": 523400
  },
  "os": {
    "label": "macos 26.3 (arm64)",
    "uptime": "3d 12h",
    "disk_used_pct": 45,
    "mem_used_mb": 8200
  },
  "skills": ["catbus", "tavily", "seo", "n8n-api", "..."],
  "catbus_daemon": {
    "status": "running",
    "last_heartbeat": "2026-02-22T04:29:45Z"
  }
}
```

## 实现步骤

### `[v2]` P0 前置验证（30 分钟）
0. 在 5 台机器上跑 `openclaw status --json` 和 `openclaw skills list --json`
1. 对比输出格式差异、确认字段可用性、测量执行耗时
2. 记录结果，决定哪些字段可用、哪些需要 fallback

### P0：数据采集 + API（3-4 小时）
1. 写 `collector.py`：采集 openclaw + 系统信息 + token 增量 → MQTT 上报
2. 部署 collector 到 5 台机器（集成到现有 provider-watchdog 进程）
3. 浣浣上写 `dashboard-api.py`：订阅 MQTT → SQLite 存储 → HTTP JSON API
4. Caddy 反代 `dashboard.xiai.xyz` → localhost:8901 + 认证

### P1：前端页面（2-3 小时）
5. 单文件 `index.html`（Tailwind CDN + vanilla JS）
6. 每 30 秒 fetch API 刷新
7. 离线检测 + 卡片状态变色
8. Provider 全局矩阵

### P2：Token 历史趋势（1 小时）
9. SQLite schema：`token_history(robot, ts, delta, cumulative)`
10. API 端点：`/api/tokens?range=day|week|month`
11. Chart.js 趋势图

## 技术选型
- 后端：Python + http.server（stdlib）
- 存储：SQLite（持久化 token 历史 + 状态快照）
- 前端：单文件 HTML + Tailwind CDN + Chart.js
- 认证：Cloudflare Access（首选）/ Caddy basicauth（备选）
- 部署：systemd + Caddy 反代
- 域名：`dashboard.xiai.xyz`

## `[v2]` 预估工作量
| 阶段 | 时间 | 产出 |
|------|------|------|
| P0 前置验证 | 30min | 5 台 `openclaw --json` 输出对比 |
| P0 数据采集+API | 3-4h | 5 台数据汇聚到浣浣 SQLite |
| P1 前端页面 | 2-3h | 可访问的 Dashboard |
| P2 Token 历史 | 1h | 日/周/月趋势图 |
| 总计 | ~6-8h | 完整 Dashboard |
