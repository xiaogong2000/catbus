# CLAUDE.md - CatBus Client (Python SDK + CLI)

> 任何 Claude Code 实例启动时必读此文件。这是项目的 Single Source of Truth。

---

## 项目概述

CatBus 是 "The Uber for AI Agents" — 一个分布式网络系统，让不同机器上的 AI Agent 能够互相发现、互相调用能力，无需知道对方的位置或框架。本仓库是 CatBus 的 Python 客户端 SDK 和 CLI 工具。

- **仓库**: https://github.com/xiaogong2000/catbus
- **版本**: 0.3.0
- **协议**: MIT
- **Python**: >=3.10
- **安装**: `pip install catbus` 或 `pip install -e .`

## 架构

```
┌─────────────────────────────────────────────────┐
│               CatBus 网络                        │
│                                                  │
│  Agent A (机器1)    WebSocket    Agent B (机器2)  │
│  ┌──────────┐      ↔ Relay ↔    ┌──────────┐    │
│  │ Daemon   │    Server(无状态) │ Daemon   │    │
│  │ :9800    │    (Matchmaker)   │ :9800    │    │
│  └────┬─────┘                   └────┬─────┘    │
│       │ HTTP                         │ HTTP      │
│       ▼                              ▼           │
│  ┌──────────┐                  ┌──────────┐     │
│  │ OpenClaw │                  │ OpenClaw │     │
│  │ Skills   │                  │ Skills   │     │
│  └──────────┘                  └──────────┘     │
└─────────────────────────────────────────────────┘
```

**三个核心组件:**
1. **Server** (`server/server.py`) — WebSocket Relay，无状态 Matchmaker
2. **Daemon** (`catbus/daemon.py`) — 本地 Agent 进程，默认端口 9800
3. **Capability System** — 统一能力模型 (`type/name` 格式)

## 技术栈

| 组件 | 技术 |
|------|------|
| 语言 | Python 3.10+ |
| 构建 | hatchling (pyproject.toml) |
| 网络 | websockets (WebSocket), aiohttp (HTTP) |
| 配置 | PyYAML |
| 异步 | asyncio |
| 入口 | `catbus.__main__:main` |

## 目录结构

```
catbus/                    # 主 Python 包 (~3,856 行)
├── __init__.py            # 版本: "0.3.0"
├── __main__.py            # CLI 入口
├── cli.py                 # 命令行接口 (618行)
├── config.py              # 配置加载 (~/.catbus/config.yaml)
├── daemon.py              # 核心守护进程 (711行)
├── executor.py            # 能力执行引擎 (260行)
├── detector.py            # 4层模型检测 (536行)
├── gateway.py             # OpenClaw Gateway 桥接 (175行)
├── scanner.py             # OpenClaw Skill 扫描 (116行)
├── capability_db.py       # 模型/Skill 数据库 (540行)
├── builtin_skills.py      # 内置演示 Skill (echo, translate等)
├── arena_sync.py          # Arena.ai 排行榜同步
└── service.py             # systemd/launchd 安装器

server/                    # WebSocket Relay Server
├── server.py              # Relay 实现
└── Dockerfile             # 容器化部署

skill/                     # OpenClaw Skill 集成规范
docs/                      # 项目文档
install.sh                 # 一键安装脚本
```

## CLI 命令

```bash
catbus init                # 初始化: 检测模型、扫描 Skill、写 config.yaml
catbus serve               # 启动 Daemon (前台)
catbus serve --daemon      # 安装为 systemd/launchd 服务并后台运行
catbus status              # 查看本地 Daemon 状态
catbus detect              # 手动检测已安装模型
catbus call <capability>   # 调用远程能力
catbus ask <skill> "query" # 简化调用语法
catbus bind <token>        # 绑定到 catbus.xyz 仪表盘
catbus scan                # 查看本地 OpenClaw Skill
catbus scan --add          # 注册 Skill 到网络
catbus skills              # 查看网络上所有可用 Skill
```

## 配置文件 (~/.catbus/config.yaml)

```yaml
server: wss://relay.catbus.ai          # Relay 服务器地址
port: 9800                             # 本地 Daemon HTTP 端口
name: my-agent                         # 人类可读名称
node_id: abc123def456                  # 唯一 12 字符标识符

capabilities:
  - type: model
    name: model/claude-opus-4-6
    handler: gateway:default           # 通过 OpenClaw Gateway 执行
    meta:
      provider: anthropic
      cost_tier: premium
      arena_elo: 1550
  - type: skill
    name: skill/translate
    handler: gateway:default
    meta:
      category: utility
      shareable: true
      source: openclaw
```

## WebSocket 消息协议

```
register → 注册节点 + 能力到 Server
REQUEST  → 发起能力调用请求
TASK     → Server 分配任务给 Provider
RESULT   → Provider 返回执行结果
heartbeat → 每 30s 心跳保活
```

## 模型检测 (4 层回退)

1. Layer 0: OpenClaw 配置文件
2. Layer 1: Gateway `/v1/models` API
3. Layer 2: Self-identification prompt
4. Layer 3: Response fingerprint 分析

## Handler 类型

- `python:module.func` — 执行 Python 函数
- `shell:command` — 执行 Shell 命令
- `gateway:default` — 通过 OpenClaw Gateway 执行 AI 任务

## 开发

```bash
git clone https://github.com/xiaogong2000/catbus.git
cd catbus
pip install -e ".[dev]"
```

## 与其他组件的关系

| 组件 | 仓库/位置 | 关系 |
|------|-----------|------|
| catbus-web | /home/debian/catbus-web | 前端仪表盘，通过 Relay API 交互 |
| catbusin | /opt/catbusin | v5 Zenoh 版 Daemon (替代本项目的 WebSocket 版) |
| Relay Server | relay.catbus.xyz | 本项目的 server/ 目录 |
| OpenClaw | ~/.openclaw/ | AI Gateway，Skill 执行引擎 |

## 当前状态

- 版本: 0.3.0
- Relay: wss://relay.catbus.ai (WebSocket)
- 安装脚本: https://catbus.xyz/install.sh
- 内置模型库: ~50+ 模型 (Anthropic, OpenAI 等)
- 一键安装支持 Linux (systemd) + macOS (launchd)

## 已完成的里程碑

- [x] WebSocket Relay Server
- [x] Python Daemon + CLI
- [x] 统一 Capability 模型 (type/name)
- [x] 4 层模型自动检测
- [x] OpenClaw Gateway 集成
- [x] Skill 扫描与注册
- [x] systemd/launchd 服务安装
- [x] catbus.xyz 绑定流程
- [x] Arena.ai 排行榜同步
- [x] 一键安装脚本 (install.sh)

## Git 仓库

- **仓库**: https://github.com/xiaogong2000/catbus (开发仓库)
- **公开仓库**: https://github.com/xiaogong2000/CatBusPub (remote: pub)
- **分支**: main
- **远程**: origin (私有), pub (公开)

每次修改完成后，提交并推送到 GitHub：
```bash
cd /home/debian/catbus-client
git add -A
git commit -m "简洁描述本次改动"
git push origin main
```

## 指令

每次完成一个开发任务后：
1. 更新本文件的"当前状态"和"已完成的里程碑"部分
2. 提交所有改动并推送到 GitHub
