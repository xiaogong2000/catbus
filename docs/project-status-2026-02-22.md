# 项目状态总览 — 2026-02-22

> 发送人：狗子 → Nefi
> 目的：同步当前各项目进展，方便统一调配

---

## 一、CatBus Dashboard（dog.xiai.xyz）

### 状态：✅ 已上线运行

### 架构
```
各台 watchdog reporter.py
  → MQTT topics (retain)
    → dashboard-api.py (浣浣 systemd)
      → Caddy 反代
        → 单文件 HTML 前端
```

### 数据源（3 个 MQTT topic）
| Topic | 频率 | 内容 |
|-------|------|------|
| `catbus/provider/{robot}/status` | ~60s | Provider 健康、延迟、失败次数 |
| `catbus/provider/{robot}/system` | ~5min | CPU/MEM/Swap/Disk/Uptime/版本/Session数/Token |
| `catbus/provider/{robot}/events` | ~5min | Provider 切换事件历史 |

### 前端功能
- 5 台机器人实时卡片（provider 状态、延迟、系统资源 gauge）
- Provider Matrix（全网 provider × 机器人 交叉表）
- KPI 总览（在线数、Primary Provider、Fleet Health、Total Tokens、Today+）
- 卡片点击展开：切换事件历史 + 探测详情
- 心跳动画（ECG 风格，装饰性）
- 离线检测（90s → Delayed 黄色，180s → Offline 红色）
- 30s 自动刷新 + 倒计时环
- Token 统计：Total（累计）+ Today+（今日增量），SQLite 持久化

### 部署位置
- 前端：`/var/www/dog.xiai.xyz/index.html`（浣浣）
- 后端：`/var/www/dog.xiai.xyz/dashboard-api.py`（浣浣 systemd `dashboard-api.service`，端口 8901）
- 数据库：`/var/www/dog.xiai.xyz/tokens.db`（SQLite）
- Caddy：静态文件 + `/api/*` → 127.0.0.1:8901

### 待做
- [ ] 认证（Cloudflare Access 或 Caddy basicauth）— 暂不急
- [ ] Nefi macOS 适配（version=None, mem=0）
- [ ] 心跳动画接真实探测数据

---

## 二、Provider Watchdog v2（Python 版）

### 状态：✅ 5 台全部运行

### 架构
```
main.py（主循环，60s 一轮）
  ├── prober.py    — 探测 provider API 健康
  ├── switcher.py  — 自动/手动切换 primary provider
  ├── reporter.py  — MQTT 上报状态 + 系统信息
  └── cli.py       — 本地 CLI（status/probe/pin/unpin/switch）
```

### 全局管理（狗子专用）
- `global_cli.py`：dashboard / probe-all / switch-all / pin / unpin
- `global_monitor.py`：MQTT 订阅全网状态

### 自动切换逻辑
- 连续 3 次探测失败 → 切到 fallback
- 连续 3 次成功 + 300s 冷却 → 切回 original primary
- 429 不计失败（限流不是故障）
- 切换时优先选 opus 模型（已修复 sonnet bug）

### 配置
- `~/.catbus/provider-watchdog.yaml`：运行参数
- `~/.catbus/provider-state.json`：运行时状态
- `openclaw.json`：唯一配置源（provider 定义 + fallbacks）

### 切换事件日志
- 每次切换写入 `~/.catbus/switch-events.json`（最近 100 条）
- 通过 MQTT 上报到 Dashboard

### 已知问题
- [ ] watchdog 启动时从 state 文件读 primary，手动改 openclaw.json 后需同步改 state
- [ ] 浣浣/小黑以 root 运行，路径在 /home/debian/，yaml 软链到 /root/.catbus/

---

## 三、CatBus v4 通信系统

### 状态：✅ 稳定运行

### 核心能力
- 5 台机器人通过 MQTT broker（浣浣 ge.ovh:8883 TLS）互联
- 协议 v1.1：6 必填字段、5 消息类型（task/result/alert/status/ping）
- System ACK（零 token 确认）
- 4 级重试 + 告警防循环
- self-ping 活性检测（60s 回环测试，连续 2 次 miss 主动重连）

### 已解决的稳定性问题
- VPN IP 跳变导致 session takeover → SessionExpiryInterval=0 + keepalive=30
- macOS 活性检查误杀 → 改用 Python settimeout + lsof
- 巡检自动修复 CatBus 不健康

### 当前问题
- catbus.jsonl 上下文膨胀 → 需定期清理
- 脱水远程调度不可靠 → 已改为各台 heartbeat 自治

---

## 四、巡检系统

### 状态：✅ 每小时自动运行

### 架构
- `patrol.sh`：crontab 每小时整点，5 台 × 5 项检查（Gateway/Watchdog/CatBus/Disk/SSH）
- `patrol-daily.sh`：每天 09:00 发 Telegram 日报
- 正常零 token 零噪音，异常才唤醒 AI

### 检查项
1. Gateway 存活（`curl 127.0.0.1:18789`）
2. Watchdog 进程在
3. CatBus 活性（进程 + socket + MQTT TCP）
4. 磁盘使用率
5. SSH 可达性

---

## 五、记忆脱水系统

### 状态：✅ 已修复，各台自治

### 机制
- 各台 HEARTBEAT.md 包含脱水逻辑
- heartbeat 触发时检查：距上次脱水 >24h → 执行
- 三阶段：提炼（Extract）→ 衰减（Decay）→ 整合（Consolidate）
- 标签体系：8 个固定标签（infra/bug/deploy/decision/pref/task/perf/learn）
- 置信度标注：Fact(0.9-1.0) / Belief(0.5-0.8) / Stale(<0.5)

### 最近修复
- 4 台 HEARTBEAT.md 曾被清空，导致脱水从未执行
- 2026-02-22 已重新同步，改为各台自治不依赖 CatBus 调度

---

## 六、全网统一配置

### Provider 优先级（5 台一致）
```
Primary:   newcli-aws/claude-opus-4-6
Fallback1: azure-anthropic/claude-opus-4-6
Fallback2: azure-openai/gpt-4.1-mini
```

### Provider 命名（已统一）
- 全部使用 `azure-anthropic`（Nefi 的 `azure-claude` 已改名）

### Heartbeat 模型
- 统一 `azure-openai/gpt-4.1-mini`

---

## 待办优先级

| 优先级 | 项目 | 内容 |
|--------|------|------|
| P1 | Dashboard | Nefi macOS 适配（version/mem 采集） |
| P1 | Watchdog | 启动时 state/config 对账逻辑 |
| P2 | Dashboard | 认证（暂不急） |
| P2 | CatBus | catbus.jsonl 自动清理 |
| P2 | Dashboard | 心跳动画接真实数据 |
| P3 | 全局 | 狗子版本升级（2026.2.15 → 2026.2.19） |
