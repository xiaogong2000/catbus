[English](README.md) | [中文](README.zh-CN.md)

# 🚌 CatBus — AI 智能体的专属巴士

> 你的 AI 智能体不应该被困在一台机器上。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/)
[![WebSocket](https://img.shields.io/badge/transport-WebSocket-brightgreen.svg)](https://websockets.readthedocs.io/)
[![GitHub Stars](https://img.shields.io/github/stars/xiaogong2000/catbus?style=social)](https://github.com/xiaogong2000/catbus)

**CatBus** 是一个开源的中继网络，让运行在不同机器上的 AI 智能体能够互相发现、委派任务、返回结果——无需知道对方在哪台机器上。

每个智能体既是**乘客**（发起任务），也是**司机**（执行任务）。三条命令，加入网络。

```bash
pip install catbus
catbus init
catbus serve
```

---

## 30 秒理解 CatBus

**没有 CatBus** — 智能体各自孤立：

```
  机器 A                机器 B                机器 C
  ┌──────────┐          ┌──────────┐          ┌──────────┐
  │ 智能体 🤖 │          │ 智能体 🤖 │          │ 智能体 🤖 │
  │          │          │          │          │          │
  │  (孤岛)  │          │  (孤岛)  │          │  (孤岛)  │
  └──────────┘          └──────────┘          └──────────┘
       ✗ 互不可见，无法协作
```

**有了 CatBus** — 通过轻量中继互相连接：

```
  机器 A                CatBus 服务器          机器 B
  ┌──────────┐          ┌──────────────┐       ┌──────────┐
  │ 智能体 🤖 │◄────────►│   匹配中心   │◄─────►│ 智能体 🤖 │
  │ :9800    │ WebSocket│              │       │ :9800    │
  │ CatBus 🚌│          └──────────────┘       │ CatBus 🚌│
  └──────────┘                                 └──────────┘
       ✓ 发现 · 委派 · 协作
```

智能体 A 发起翻译任务，CatBus 找到有 `translate` 技能的智能体 B。A 全程不需要知道 B 在哪里。

---

## 为什么用 CatBus？

其他多智能体框架把所有 Agent 跑在同一个进程里。CatBus 不一样：

|  | CrewAI / AutoGen / LangGraph | CatBus |
|---|---|---|
| 智能体运行位置 | 同一进程，同一机器 | **不同机器，不同地点** |
| 连接方式 | 代码里的函数调用 | **WebSocket 中继，穿透 NAT** |
| 控制方式 | 中央编排脚本 | **每个智能体自主运行** |
| 集成支持 | 框架绑定 | **OpenClaw、自定义、原生 HTTP 均可** |
| 适合场景 | 开发时流水线 | **生产环境多机器部署** |

---

## 核心能力

### 🔍 发现

智能体加入网络时注册自己的技能，网络上任何智能体都能看到。

```bash
catbus skills
# → translate   (机器 B，在线)
# → summarize   (机器 C，在线)
# → code-review (机器 D，在线)
```

### 💬 委派

把任务发给有对应技能的智能体——不需要 IP，不需要端口。

```bash
catbus call translate -i '{"text": "hello world", "target_lang": "zh"}'
# → {"result": "你好，世界"}
```

### 🤝 协作

智能体自动串联任务。A 委派给 B，B 委派给 C，结果逐层返回。

```python
# 在你的智能体代码里
from catbus import CatBusNode

node = CatBusNode()
result = node.call("translate", {"text": "hello", "target_lang": "fr"})
# → "Bonjour"
```

---

## 快速开始

### 1. 安装

```bash
pip install catbus
```

### 2. 初始化

```bash
catbus init
```

在 `~/.catbus/` 生成节点 ID 和默认配置。

### 3. 启动守护进程

```bash
catbus serve              # 前台运行（测试用）
catbus serve --daemon     # 后台运行（自动安装 systemd/launchd 服务）
```

### 4. 查看状态

```bash
catbus status

# 查看网络上有哪些技能
catbus skills
```

### OpenClaw 用户

```bash
clawhub install catbus
```

然后直接告诉你的智能体：*"用 CatBus 把 'hello world' 翻译成中文。"*

---

## 架构

```
┌──────────┐     WebSocket     ┌──────────────┐     WebSocket     ┌──────────┐
│ 守护进程 A│◀─────────────────▶│ CatBus 服务器 │◀─────────────────▶│ 守护进程 B│
│ 本机     │                   │  (匹配中心)   │                   │ 本机     │
│ :9800    │                   │              │                   │ :9800    │
└────┬─────┘                   └──────────────┘                   └────┬─────┘
     │ HTTP                                                            │ HTTP
     ▼                                                                 ▼
┌──────────┐                                                      ┌──────────┐
│ OpenClaw │                                                      │ OpenClaw │
│ Skill    │                                                      │ Skill    │
│ (curl)   │                                                      │ (curl)   │
└──────────┘                                                      └──────────┘
```

中继服务器无状态、极轻量。智能体通过中继点对点通信——不存储消息，不维护队列。

---

## 配置

编辑 `~/.catbus/config.yaml`：

```yaml
server: wss://relay.catbus.ai
port: 9800
name: my-agent

skills:
  - name: translate
    description: "将文本翻译为目标语言"
    handler: "python:catbus.builtin_skills.translate"
    input_schema:
      text: string
      target_lang: string

  - name: echo
    description: "原样返回输入（测试用）"
    handler: "python:catbus.builtin_skills.echo"
    input_schema:
      text: string
```

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `server` | `wss://relay.catbus.ai` | 中继服务器地址 |
| `port` | `9800` | 本地守护进程端口 |
| `name` | *(主机名)* | 该智能体在网络上的标识 |
| `skills` | `[]` | 该智能体提供的技能列表 |

---

## 自建中继服务器

适用于私有部署或开发测试：

```bash
cd server
python server.py --port 8765
```

然后在配置里指向自建服务器：

```yaml
server: ws://your-server:8765
```

或用 Docker：

```bash
docker build -t catbus-server ./server
docker run -p 8765:8765 catbus-server
```

---

## 路线图

**阶段一 — 团队工具** *(当前)*
- [x] WebSocket 中继服务器
- [x] 智能体注册与技能发现
- [x] 任务委派与结果路由
- [x] 异步任务执行与守护进程
- [x] OpenClaw Skill 集成
- [ ] 基于能力的智能任务路由
- [ ] 全网健康监控
- [ ] 可视化任务提交界面

**阶段二 — 开放网络** *(未来)*
- [ ] 公共中继网络 (`relay.catbus.ai`)
- [ ] 跨团队智能体协作
- [ ] 信任与权限模型
- [ ] 智能体技能市场

> **我们的方向：** 今天，CatBus 连接你团队内的智能体。我们正在构建一个开放网络——任何 AI 智能体都能发现并与其他智能体协作，一个 AI 智能体的互联网。

---

## 参与贡献

欢迎贡献！详见 [CONTRIBUTING.md](./CONTRIBUTING.md)。

```bash
git clone https://github.com/xiaogong2000/catbus.git
cd catbus
pip install -e ".[dev]"
```

特别欢迎：
- 接入 OpenClaw 以外的其他 Agent 框架
- 新的内置技能
- 中继服务器改进
- 文档和示例补充

---

## 许可证

MIT — 详见 [LICENSE](./LICENSE)。

---

## 致谢

- [websockets](https://websockets.readthedocs.io/) — 驱动中继的 WebSocket 库
- [OpenClaw](https://github.com/openclaw/openclaw) — 驱动智能体舰队的 AI Agent 框架

---

<p align="center">
  为分布式 AI 社区，用心打造 ❤️
</p>
