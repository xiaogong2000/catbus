# 🚌 CatBus

> 分布式 AI 智能体编排系统 — 轻松管理跨全球的 AI 机器人团队

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/)
[![Zenoh](https://img.shields.io/badge/networking-Zenoh-orange.svg)](https://zenoh.io/)
[![GitHub Stars](https://img.shields.io/github/stars/xiaogong2000/catbus?style=social)](https://github.com/xiaogong2000/catbus)

**CatBus** 是一个开源的分布式 AI 智能体编排框架。基于 [Zenoh P2P](https://zenoh.io/) 网络构建，你可以将任务提交到舰队中的任意节点并异步追踪结果 —— 无需中心 Broker，无单点故障。

**English Docs** → [README.md](./README.md)

---

## ✨ 核心特性

- **🌐 真正的 P2P 网络** — 基于 Zenoh，节点之间无需中心 Broker 即可互相发现
- **⚡ 异步任务执行** — 提交任务立即返回 `task_id`，结果就绪后自动推送
- **🧠 三层状态树** — `Desired / Actual / Drift` 三层结构让每个节点的状态一目了然
- **📡 拉取式任务分发** — 节点在有空闲时主动认领任务，不会被推送压垮
- **💰 成本追踪** — 内置 API 费用监控，覆盖整个舰队
- **🌍 多地域部署** — 经过 OVH 法国、洛杉矶 VPS 与家庭节点同时运行的真实验证
- **🤖 兼容 OpenClaw** — 开箱即用地编排 [OpenClaw](https://github.com/openclaw) AI 智能体

---

## 🏗️ 架构设计

```
                        ┌─────────────────────────┐
                        │      CatBus 网络层        │
                        │    (Zenoh P2P Fabric)    │
                        └────────────┬────────────┘
                                     │
          ┌──────────────────────────┼──────────────────────────┐
          │                          │                          │
    ┌─────▼──────┐            ┌──────▼─────┐            ┌──────▼─────┐
    │  节点: Nefi │            │  节点: 狗子  │            │  节点: 咪咪  │
    │  (主节点)   │            │  (OVH 法国) │            │  (洛杉矶)   │
    │             │            │            │            │            │
    │ ┌─────────┐ │            │ ┌────────┐ │            │ ┌────────┐ │
    │ │Desired  │ │            │ │Desired │ │            │ │Desired │ │
    │ │Actual   │ │            │ │Actual  │ │            │ │Actual  │ │
    │ │Drift    │ │            │ │Drift   │ │            │ │Drift   │ │
    │ └─────────┘ │            │ └────────┘ │            │ └────────┘ │
    └─────────────┘            └────────────┘            └────────────┘
```

每个节点维护自己的**三层状态树**：
- **Desired**（期望状态） — 节点应该在做什么
- **Actual**（实际状态） — 节点现在实际在做什么
- **Drift**（偏差）— 两者之间的差异（触发告警）

---

## 🚀 快速开始

### 环境要求

- Python 3.10+
- 安装 [Zenoh](https://zenoh.io/docs/getting-started/installation/)
- 至少配置一个 [OpenClaw](https://github.com/openclaw) 智能体

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

### 配置

```bash
cp config.example.yaml config.yaml
# 编辑 config.yaml，填入节点名称、Zenoh 端点和智能体配置
```

最小化 `config.yaml` 示例：

```yaml
node:
  name: "my-node"           # 节点唯一名称
  location: "cn-beijing"    # 节点位置标签

zenoh:
  mode: peer                # peer | client | router
  endpoints:
    - "tcp/0.0.0.0:7447"

agent:
  provider: openai          # AI 提供商
  model: gpt-4o

catbus:
  task_timeout: 300         # 超时时间（秒）
  max_concurrent_tasks: 3   # 最大并发任务数
```

### 启动节点

```bash
catbus start
```

### 提交任务

```python
from catbus import CatBusClient

client = CatBusClient()

# 提交任务 — 立即返回 task_id，不阻塞
task_id = client.submit(
    target="any",               # "any" 或指定节点名称
    task_type="seo_analysis",
    payload={"url": "https://example.com"}
)

print(f"任务已提交: {task_id}")

# 等待结果（或使用回调/webhook）
result = client.wait(task_id, timeout=120)
print(result)
```

---

## 📡 任务生命周期

```
submit()                      节点认领任务
   │                              │
   ▼                              ▼
task_id ──────────────► PENDING ──► CLAIMED ──► RUNNING ──► DONE
立即返回                                                       │
                                                         结果存入
                                                         Zenoh KV
```

CatBus 是**完全异步**的 —— 提交任务永远不会阻塞。节点在有空闲时拉取任务并执行，结果发布回 Zenoh 网络。

---

## 🖥️ 监控面板

CatBus 内置监控面板：

```bash
catbus dashboard --port 8080
```

访问 `http://localhost:8080` 可查看：
- 舰队各节点实时状态
- 每个节点的任务队列深度
- API 费用明细（按节点、按天）
- 通过 Zenoh pub/sub 汇总的 24 小时健康报告

---

## 🌐 多节点部署

CatBus 专为地理分布式部署设计，每个节点只需能连接到至少一个对等节点：

```yaml
# 法国 OVH 节点
zenoh:
  mode: peer
  connect:
    - "tcp/your-home-node-ip:7447"

# 洛杉矶节点
zenoh:
  mode: peer
  connect:
    - "tcp/your-home-node-ip:7447"
    - "tcp/france-node-ip:7447"
```

节点通过 Zenoh 的 Gossip 协议自动互相发现，无需手动配置路由表。

---

## 📊 真实使用案例

CatBus 驱动着一个 5 节点全球舰队，每天运行 SEO 分析工作流：

| 节点 | 位置 | 角色 |
|------|------|------|
| Nefi | 家庭 | 主节点 / 编排器 |
| 狗子 | OVH 法国 | 工作节点 |
| 咪咪 | 洛杉矶 | 工作节点 |
| 浣浣 | 家庭 | 工作节点 |
| *(更多)* | 各地 | 工作节点 |

系统每天处理数百个任务，并在各节点间自动均衡 API 费用。

---

## 📁 项目结构

```
catbus/
├── catbus/
│   ├── core/
│   │   ├── node.py              # 节点生命周期管理
│   │   ├── task.py              # 任务提交与追踪
│   │   └── state.py             # 三层状态树（Desired/Actual/Drift）
│   ├── transport/
│   │   └── zenoh_transport.py   # Zenoh P2P 通信层
│   ├── agents/
│   │   └── openclaw.py          # OpenClaw 智能体集成
│   └── dashboard/               # 监控 Web UI
├── examples/
│   ├── single_node/             # 单节点入门示例
│   ├── multi_node/              # 分布式部署示例
│   └── seo_workflow/            # 真实 SEO 工作流示例
├── config.example.yaml
├── docker-compose.example.yml
└── docs/
```

---

## 🐳 Docker 部署

```bash
# 单节点快速启动
docker-compose -f docker-compose.example.yml up

# 或自行构建
docker build -t catbus .
docker run -v $(pwd)/config.yaml:/app/config.yaml catbus
```

---

## 🛠️ 配置项参考

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `node.name` | *(必填)* | 节点唯一标识符 |
| `zenoh.mode` | `peer` | Zenoh 会话模式 |
| `zenoh.endpoints` | `[]` | 本地监听端点 |
| `zenoh.connect` | `[]` | 要连接的远程对等节点 |
| `agent.provider` | `openai` | AI 提供商 |
| `catbus.max_concurrent_tasks` | `3` | 每个节点最大并发任务数 |
| `catbus.health_report_interval` | `3600` | 健康报告周期（秒） |
| `catbus.telegram_token` | `""` | Telegram Bot Token（用于通知） |

完整配置文档 → [docs/configuration.md](./docs/configuration.md)

---

## 🤝 参与贡献

欢迎贡献！请先阅读 [CONTRIBUTING.md](./CONTRIBUTING.md)。

```bash
# 开发环境搭建
git clone https://github.com/xiaogong2000/catbus.git
cd catbus
pip install -e ".[dev]"
pre-commit install
```

特别欢迎以下方面的贡献：
- 更多智能体集成（OpenClaw 之外的框架）
- 更多工作流示例
- 文档改进
- Windows / ARM 平台测试

---

## 📋 开发计划

- [ ] 智能体能力匹配（自动将任务路由到有对应能力的节点）
- [ ] 健康数据的 Schema 版本管理
- [ ] 改进 Provider 故障转移逻辑
- [ ] 基于 Web 的任务提交界面
- [ ] 市场模式 / "AI 机器人 Uber" 模式

---

## 📄 开源协议

MIT License — 详见 [LICENSE](./LICENSE)

---

## 🙏 致谢

- [Zenoh](https://zenoh.io/) — 让一切成为可能的 P2P 网络层
- [OpenClaw](https://github.com/openclaw) — 驱动团队的 AI 智能体框架

---

<p align="center">
  为分布式 AI 社区用心打造 ❤️
</p>
