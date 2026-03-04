# 🚌 CatBus

> 你的 AI 机器人，不应该被困在一台机器里。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/)
[![Zenoh](https://img.shields.io/badge/networking-Zenoh-orange.svg)](https://zenoh.io/)
[![GitHub Stars](https://img.shields.io/github/stars/xiaogong2000/catbus?style=social)](https://github.com/xiaogong2000/catbus)

**CatBus** 是一个开源工具，让运行在不同物理机器上的 AI 机器人互相发现、通信和协作 — 无需中心服务器，无需属于同一个主人。

市面上的多智能体框架（CrewAI、AutoGen、LangGraph）把所有 agent 跑在同一个进程、同一台机器里。但现实世界不是这样的 — 你的 agent 散布在不同机器、不同城市、甚至属于不同的人。**CatBus 让它们连接起来。**

**English Docs** → [README.md](./README.md)

---

## 30 秒看懂 CatBus

**没有 CatBus** — 你的机器人各自孤立：

```
  机器 A                 机器 B                 机器 C
  ┌──────────┐          ┌──────────┐          ┌──────────┐
  │ Agent 🤖 │          │ Agent 🤖 │          │ Agent 🤖 │
  │          │          │          │          │          │
  │ （孤岛）  │          │ （孤岛）  │          │ （孤岛）  │
  └──────────┘          └──────────┘          └──────────┘
       ✗ 互相看不见，无法协作
```

**有了 CatBus** — 它们自动发现彼此，协同工作：

```
  机器 A                 机器 B                 机器 C
  ┌──────────┐          ┌──────────┐          ┌──────────┐
  │ Agent 🤖 │◄────────►│ Agent 🤖 │◄────────►│ Agent 🤖 │
  │          │          │          │          │          │
  │ CatBus 🚌│          │ CatBus 🚌│          │ CatBus 🚌│
  └──────────┘          └──────────┘          └──────────┘
       ✓ 发现 · 通信 · 协作
```

不需要中心服务器。不依赖云。机器人直接对话。

---

## 为什么选 CatBus？

别的多智能体框架把所有 agent 跑在同一个进程里。CatBus 不一样：

|  | CrewAI / AutoGen / LangGraph | CatBus |
|---|---|---|
| agent 在哪里 | 同一进程、同一台机器 | **不同机器、不同地域** |
| 怎么连接 | 代码内的函数调用 | **P2P 网络，无需云服务器** |
| 谁来控制 | 一个中心编排脚本 | **每个机器人自治** |
| 适合什么 | 开发时的 agent 流水线 | **生产环境的多机器人部署** |

---

## 核心能力

### 🔍 发现

机器人加入网络后自动互相发现。不需要注册中心，不需要手动配置。

```python
from catbus import CatBusNode

# 启动节点 — 立即发现网络上的其他机器人
node = CatBusNode(name="my-robot", capabilities=["seo", "translation"])
node.start()

# 看看网络上有谁
peers = node.discover()
# → [{"name": "alice-bot", "capabilities": ["writing", "research"]},
#    {"name": "bob-bot",  "capabilities": ["coding", "testing"]}]
```

### 💬 通信

机器人之间互相发消息 — 请求、响应、事件、状态更新。

```python
# 向指定机器人发送请求
response = node.ask("alice-bot", {
    "type": "request",
    "task": "把这段话翻译成法语",
    "payload": {"text": "Hello world"}
})

# 或者广播给任何有能力处理的机器人
response = node.ask("any", {
    "type": "request",
    "capability": "translation",
    "payload": {"text": "Hello world", "target_lang": "fr"}
})
```

### 🤝 协作

机器人之间互相委托任务，协同完成复杂工作流。

```python
# 提交任务 — 立即返回，在最合适的节点上异步执行
task_id = node.submit(
    target="any",
    task_type="seo_analysis",
    payload={"url": "https://example.com"}
)

# 任务在网络中流转：
#   PENDING → CLAIMED（被合适的节点认领）→ RUNNING → DONE
result = node.wait(task_id, timeout=120)
```

---

## 架构设计

CatBus 由四层构成，每层职责清晰：

```
┌──────────────────────────────────────────────────────┐
│  协作层 Collaboration                                 │
│  任务委托 · 工作流编排 · 费用均衡                       │
├──────────────────────────────────────────────────────┤
│  通信层 Communication                                 │
│  请求/响应 · 发布/订阅 · 事件通知                       │
├──────────────────────────────────────────────────────┤
│  发现层 Discovery                                     │
│  节点发现 · 能力声明 · 身份标识                         │
├──────────────────────────────────────────────────────┤
│  传输层 Transport (Zenoh P2P)                         │
│  物理连接 · NAT 穿透 · Gossip 路由                     │
└──────────────────────────────────────────────────────┘
```

**为什么用 Zenoh？** CatBus 的传输层基于 [Zenoh](https://zenoh.io/) — 一个 P2P 协议，能自动处理节点发现、消息路由和 NAT 穿透，无需中心 Broker。这意味着你的机器人可以跨家庭网络、VPS 和数据中心直接通信，不需要额外基础设施。

### 状态模型：Desired / Actual / Drift

每个机器人维护一棵三层状态树：

```
┌──────────────────┐
│  Desired 期望状态  │ ← 机器人应该在做什么
├──────────────────┤
│  Actual 实际状态   │ ← 它现在实际在做什么
├──────────────────┤
│  Drift 偏差       │ ← 两者的差距（差距过大时触发告警）
└──────────────────┘
```

这让你一眼就能看清整个机器人舰队的状态 — 哪些偏离了预期行为，立刻可见。

---

## 快速开始

### 环境要求

- Python 3.10+
- 安装 [Zenoh](https://zenoh.io/docs/getting-started/installation/)

### 安装

```bash
pip install catbus-agent
```

或从源码安装：

```bash
git clone https://github.com/xiaogong2000/catbus.git
cd catbus
pip install -e .
```

### 配置你的机器人

```bash
cp config.example.yaml config.yaml
```

```yaml
node:
  name: "my-robot"          # 机器人在网络中的名字
  location: "cn-beijing"    # 它在哪里
  capabilities:             # 它能做什么
    - seo_analysis
    - content_writing

zenoh:
  mode: peer
  endpoints:
    - "tcp/0.0.0.0:7447"

agent:
  provider: openai
  model: gpt-4o
```

### 加入网络

```bash
catbus start
```

你的机器人现在可以被网络上任何能到达它的 CatBus 节点发现了。就这么简单。

### 连接第二个机器人

在另一台机器上安装 CatBus，指向第一个节点，启动：

```yaml
# 机器 B 上的 config.yaml
node:
  name: "helper-bot"
  capabilities: ["research", "coding"]

zenoh:
  mode: peer
  connect:
    - "tcp/机器A的IP:7447"    # 只需要能连到一个节点
```

```bash
catbus start
```

两个机器人现在可以互相发现、交换消息、委托任务。

---

## 真实验证

CatBus 不是原型 — 它 7×24 运行着一个跨三大洲的 5 节点舰队：

| 机器人 | 位置 | 能力 |
|-------|------|------|
| Nefi    | 家庭（主节点） | 编排、SEO |
| 狗子    | OVH 法国 | 通用任务 |
| 咪咪    | 洛杉矶 | 内容生成 |
| 浣浣    | 家庭 | 监控 |
| *(更多)* | 各地 | 各类任务 |

舰队每天处理数百个任务。当某个节点过载时，任务自动流向有空闲的节点。API 费用在全网络自动追踪和均衡。

---

## 监控面板

```bash
catbus dashboard --port 8080
```

内置面板可查看：
- 哪些机器人在线、在做什么
- 任务在网络中的流转情况
- 每个机器人的 API 费用明细（按天）
- 通过 Zenoh pub/sub 汇总的 24 小时健康报告

---

## 多节点部署

每个节点只需要能连到至少一个 peer，Zenoh 的 Gossip 协议会处理剩下的事：

```yaml
# 法国的机器人
zenoh:
  connect:
    - "tcp/home-node:7447"

# 洛杉矶的机器人
zenoh:
  connect:
    - "tcp/home-node:7447"
    - "tcp/france-node:7447"
```

不需要路由表。不需要服务发现基础设施。节点自动互相发现。

---

## 项目结构

```
catbus/
├── catbus/
│   ├── core/
│   │   ├── node.py              # 机器人生命周期与身份
│   │   ├── task.py              # 任务提交与追踪
│   │   └── state.py             # Desired / Actual / Drift 状态树
│   ├── transport/
│   │   └── zenoh_transport.py   # Zenoh P2P 通信
│   ├── discovery/
│   │   └── capabilities.py      # 能力声明与匹配
│   ├── agents/
│   │   └── openclaw.py          # OpenClaw 智能体集成
│   └── dashboard/               # 监控 Web UI
├── examples/
│   ├── two_robots/              # 最小双机器人示例
│   ├── team_fleet/              # 团队部署（5+ 节点）
│   └── seo_workflow/            # 真实 SEO 工作流
├── config.example.yaml
└── docs/
```

---

## Docker 部署

```bash
docker-compose -f docker-compose.example.yml up
```

或自行构建：

```bash
docker build -t catbus .
docker run -v $(pwd)/config.yaml:/app/config.yaml catbus
```

---

## 配置项参考

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `node.name` | *(必填)* | 机器人在网络中的身份 |
| `node.capabilities` | `[]` | 机器人能做什么 |
| `zenoh.mode` | `peer` | Zenoh 会话模式 |
| `zenoh.endpoints` | `[]` | 本地监听端点 |
| `zenoh.connect` | `[]` | 要连接的远程节点 |
| `agent.provider` | `openai` | AI 提供商 |
| `catbus.max_concurrent_tasks` | `3` | 最大并发任务数 |
| `catbus.health_report_interval` | `3600` | 健康报告周期（秒） |
| `catbus.telegram_token` | `""` | Telegram 通知 |

完整配置文档 → [docs/configuration.md](./docs/configuration.md)

---

## 开发计划

**Phase 1 — 团队工具** *（当前阶段）*
- [x] 基于 Zenoh 的 P2P 节点发现
- [x] 异步任务提交与执行
- [x] 三层状态树（Desired / Actual / Drift）
- [x] 拉取式任务分发与认领机制
- [x] 全舰队费用追踪
- [ ] 基于能力的任务路由
- [ ] 健康数据 Schema 版本管理
- [ ] Provider 故障转移优化
- [ ] Web 任务提交界面

**Phase 2 — 开放网络** *（未来）*
- [ ] 公开能力注册表
- [ ] 跨团队机器人协作
- [ ] 信任与权限模型
- [ ] 机器人能力市场

> **我们的方向：** 今天，CatBus 让你团队内的机器人协作起来。未来，我们要构建一个开放网络 — 任何 AI 机器人都能发现并与其他机器人协作。一个 AI 机器人的互联网。

---

## 参与贡献

欢迎贡献！请先阅读 [CONTRIBUTING.md](./CONTRIBUTING.md)。

```bash
git clone https://github.com/xiaogong2000/catbus.git
cd catbus
pip install -e ".[dev]"
pre-commit install
```

特别欢迎以下方面的贡献：
- 更多智能体集成（OpenClaw 之外的框架）
- 工作流示例
- 文档改进
- Windows / ARM 平台测试

---

## 开源协议

MIT License — 详见 [LICENSE](./LICENSE)

---

## 致谢

- [Zenoh](https://zenoh.io/) — 让一切成为可能的 P2P 网络层
- [OpenClaw](https://github.com/openclaw) — 驱动舰队的 AI 智能体框架

---

<p align="center">
  为分布式 AI 社区用心打造 ❤️
</p>
