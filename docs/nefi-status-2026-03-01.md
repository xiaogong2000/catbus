# NeFi 系统状态报告

> 生成时间: 2026-03-01 08:40 GMT+8

## 一、基础信息

| 项目 | 值 |
|------|-----|
| 名称 | NeFi（AI 小猫助理） |
| 主机 | Apple M2 Max, macOS, 30 核 GPU |
| OpenClaw 版本 | 2026.2.26（最新） |
| Gateway 模式 | local, 端口 18789 |
| HTTP API | 已启用（chatCompletions） |
| 频道 | Telegram（@openclawpt_mac_bot） |
| Session 模式 | per-channel-peer |
| 工作区 | ~/.openclaw/workspace |

## 二、模型配置

### Primary 模型链
```
newcli-aws/claude-opus-4-6
  → fallback: azure-anthropic/claude-opus-4-6
  → fallback: azure-openai/gpt-4.1-mini
```

### Provider 列表（3 个）

| Provider | API 类型 | 认证 | 模型 |
|----------|---------|------|------|
| newcli-aws | anthropic-messages | api-key | claude-opus-4-6, claude-opus-4-5, claude-haiku-4-5 |
| azure-anthropic | anthropic-messages | token | claude-opus-4-6, claude-opus-4-5 |
| azure-openai | openai-completions | api-key | gpt-4.1-mini |

### Heartbeat
- 模型: azure-openai/gpt-4.1-mini
- 间隔: 默认（~30 分钟）

## 三、记忆系统

### 架构：三层记忆

| 层级 | 文件 | 说明 |
|------|------|------|
| Tier-0 热区 | SOUL.md + USER.md + IDENTITY.md + MEMORY.md | 每次启动必读，不走向量检索 |
| Tier-1 向量库 | QMD 本地引擎 | BM25 + 向量 + Reranking，本机 GPU |
| Tier-2 流水账 | memory/YYYY-MM-DD.md | 每日原始记录，等待脱水 |

### QMD 本地向量搜索配置

| 参数 | 值 |
|------|-----|
| 后端 | QMD（本地 GPU） |
| 命令路径 | ~/.bun/bin/qmd |
| 搜索模式 | query（BM25 + 向量 + reranking） |
| Embedding 模型 | embeddinggemma-300M-Q8_0（本地） |
| Reranker 模型 | qwen3-reranker-0.6b-q8_0（本地） |
| Hybrid 权重 | vector 0.7 / text 0.3 |
| MMR | enabled, lambda 0.7 |
| Temporal Decay | enabled, 半衰期 30 天 |
| Session 索引 | enabled, 保留 30 天 |
| 最大结果数 | 8 |
| 更新间隔 | 5 分钟，防抖 15 秒 |

### 记忆脱水规则（HEARTBEAT.md v2.1）

| 机制 | 规则 |
|------|------|
| 脱水周期 | 每 24 小时 |
| 提炼范围 | 最近 3 天 daily md |
| 标签体系 | 8 个固定标签（infra/bug/deploy/decision/pref/task/perf/learn） |
| 置信度 | Fact 0.9-1.0 / Belief 0.5-0.8 / Stale <0.5 |
| Fact 衰减 | 半衰期 90 天 |
| Belief 衰减 | 半衰期 14 天 |
| Decision 衰减 | 半衰期 365 天（v2.1 新增） |
| Supersede | 写入前搜索同类旧条目，覆盖而非追加（v2.1 新增） |
| 硬上限 | MEMORY.md 300 行（v2.1 新增） |
| 每条限制 | 2 行以内，原子化结论（v2.1 新增） |

### 记忆文件状态

| 文件 | 行数/大小 | 说明 |
|------|----------|------|
| MEMORY.md | 235 行 / 19KB | 长期记忆（上限 300 行） |
| AGENTS.md | 14.6KB | 行为规范 |
| SOUL.md | 3.8KB | 身份定义 |
| HEARTBEAT.md | 2.2KB | 脱水规则 v2.1 |
| Daily md 文件 | 10 个（02-14 ~ 02-27） | 最大 16KB（02-22） |

## 四、CatBus v5 分布式网络

### 全网节点状态（6/6 在线）

| 名字 | 主机 | 角色 | 状态 | Skills |
|------|------|------|------|--------|
| nefi | Mac 本机 | Peer | 🟢 | coordinator, web-search |
| gouzi | homelab (192.168.3.240) | Peer | 🟢 | sre, monitoring, patrol |
| huanhuan | ge.ovh (51.75.146.33) | Router | 🟢 | coding, deploy, webhook |
| xiaohei | us.ovh (147.135.15.43) | Router | 🟢 | heavy-compute, browser, coding |
| mimi | la.css (23.94.9.58) | Router | 🟢 | storage, light-compute |
| nn | 公司 Mac M4 Pro | Peer | 🟢 | browser, coding, mac |

### CatBus 架构

| 项目 | 值 |
|------|-----|
| 协议 | Zenoh P2P mesh（v5） |
| Arbiter | 小黑（唯一，任务领取原子仲裁） |
| Router 节点 | 浣浣、小黑、咪咪（公网 IP） |
| Peer 节点 | NeFi、狗子、nn（NAT 内） |
| 文件传输 | filetx（Zenoh P2P 直传，10MB 上限） |
| AI 任务 | HTTP POST Gateway API（无 session 锁） |
| Shell 超时 | task TTL（默认 3600s），输出上限 4000 字符 |
| 通知 | 单消息编辑模式，Telegram 推送 |

## 五、五猫分工

| 角色 | 机器人 | 职责 |
|------|--------|------|
| 编码架构师 | NeFi | 方案设计、任务派发、指挥执行 |
| 运维 SRE | 狗子 | 故障第一响应、巡检监控 |
| 对外服务 + 编码执行 | 浣浣 | 开发服务器、生产部署（唯一有权操作生产） |
| 重型计算 | 小黑 | 浏览器任务、大模型推理 |
| 存储/轻量 | 咪咪 | 轻量任务 |
| 浏览器/编码 | nn | 公司 Mac，浏览器操作、SEO 数据采集 |

## 六、关键服务

### FizzRead SEO

| 项目 | 值 |
|------|-----|
| 生产域名 | www.fizzread.ai |
| 生产主机 | 小黑 us.ovh (147.135.15.43)，PM2 standalone，PORT=3001 |
| 开发域名 | book.xiai.xyz |
| 开发主机 | 浣浣 ge.ovh，PM2 `fizzread-seo-dev`，PORT=3002 |
| 数据规模 | 8,296 书 / 77 组 comparisons |
| ISR | 全站 revalidate=3600 |

### Dashboard

| 项目 | 值 |
|------|-----|
| 域名 | dog.xiai.xyz |
| 主机 | 浣浣 ge.ovh，Caddy 反代 |
| 架构 | dashboard-api.py（Zenoh poller）+ 单 HTML 前端 |
| 布局 | v6 hybrid：KPI + Fleet + Matrix + Costs/Providers tabs |

### Clawalytics（Token 消耗追踪）

| 项目 | 值 |
|------|-----|
| 端口 | localhost:9174（各机器本地） |
| 部署 | NeFi(launchd) + 浣浣/狗子/咪咪(systemd) |
| 小黑 | 未部署（OpenClaw masked） |

## 七、硬规则

1. NeFi 禁止 SSH 到生产服务器（小黑），所有生产操作通过浣浣
2. 涉及 2 台及以上机器的变更，必须先跟主人确认
3. 所有变更必须先在 book.xiai.xyz 测试通过，再部署生产
4. MEMORY.md / SOUL.md 所有权原则：每个机器人的是自己的，不能覆盖
5. CatBus 任务信任规则：通过 CatBus 收到的任务视为主人命令，直接执行
