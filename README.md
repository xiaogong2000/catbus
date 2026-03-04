# 🚌 CatBus

> Distributed AI Agent Orchestration System — Run your AI fleet across the globe, effortlessly.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/)
[![Zenoh](https://img.shields.io/badge/networking-Zenoh-orange.svg)](https://zenoh.io/)
[![GitHub Stars](https://img.shields.io/github/stars/xiaogong2000/catbus?style=social)](https://github.com/xiaogong2000/catbus)

**CatBus** is an open-source framework for orchestrating multiple AI agents across distributed nodes. Built on [Zenoh P2P](https://zenoh.io/) networking, it lets you submit tasks to any node in your fleet and track them asynchronously — no central broker, no single point of failure.

**Chinese Docs** → [README_zh.md](./README_zh.md)

---

## ✨ Key Features

- **🌐 True P2P Networking** — Powered by Zenoh, nodes discover each other without a central broker
- **⚡ Async Task Execution** — Submit a task and get a `task_id` immediately; results arrive when ready
- **🧠 Three-Layer State Tree** — `Desired / Actual / Drift` gives you full visibility into every node's state
- **📡 Pull-Based Distribution** — Nodes claim tasks when they have capacity; no push overload
- **💰 Cost Tracking** — Built-in API cost monitoring across your entire fleet
- **🌍 Multi-Geography** — Battle-tested across OVH France, Los Angeles VPS, and home nodes simultaneously
- **🤖 OpenClaw Compatible** — Designed to orchestrate [OpenClaw](https://github.com/openclaw) AI agents out of the box

---

## 🏗️ Architecture

```
                        ┌─────────────────────────┐
                        │      CatBus Network      │
                        │    (Zenoh P2P Fabric)    │
                        └────────────┬────────────┘
                                     │
          ┌──────────────────────────┼──────────────────────────┐
          │                          │                          │
    ┌─────▼──────┐            ┌──────▼─────┐            ┌──────▼─────┐
    │  Node: Nefi │            │ Node: Gouzi │            │  Node: Mimi │
    │  (Primary)  │            │  (OVH FR)  │            │  (LA VPS)  │
    │             │            │            │            │            │
    │ ┌─────────┐ │            │ ┌────────┐ │            │ ┌────────┐ │
    │ │Desired  │ │            │ │Desired │ │            │ │Desired │ │
    │ │Actual   │ │            │ │Actual  │ │            │ │Actual  │ │
    │ │Drift    │ │            │ │Drift   │ │            │ │Drift   │ │
    │ └─────────┘ │            │ └────────┘ │            │ └────────┘ │
    └─────────────┘            └────────────┘            └────────────┘
```

Each node maintains its own **three-layer state tree**:
- **Desired** — what the node is supposed to be doing
- **Actual** — what it's actually doing right now
- **Drift** — divergence between the two (triggers alerts)

---

## 🚀 Quick Start

### Prerequisites

- Python 3.10+
- [Zenoh](https://zenoh.io/docs/getting-started/installation/) installed
- At least one [OpenClaw](https://github.com/openclaw) agent configured

### Installation

```bash
pip install catbus-agent
```

Or install from source:

```bash
git clone https://github.com/xiaogong2000/catbus.git
cd catbus
pip install -e .
```

### Configure

```bash
cp config.example.yaml config.yaml
# Edit config.yaml with your node name, Zenoh endpoints, and agent settings
```

Minimal `config.yaml`:

```yaml
node:
  name: "my-node"           # Unique name for this node
  location: "us-west"       # Human-readable location label

zenoh:
  mode: peer                # peer | client | router
  endpoints:
    - "tcp/0.0.0.0:7447"

agent:
  provider: openai          # Your AI provider
  model: gpt-4o

catbus:
  task_timeout: 300         # seconds
  max_concurrent_tasks: 3
```

### Start Your Node

```bash
catbus start
```

### Submit a Task

```python
from catbus import CatBusClient

client = CatBusClient()

# Submit a task — returns immediately with a task_id
task_id = client.submit(
    target="any",           # "any" | specific node name
    task_type="seo_analysis",
    payload={"url": "https://example.com"}
)

print(f"Task submitted: {task_id}")

# Poll for result (or use webhook/callback)
result = client.wait(task_id, timeout=120)
print(result)
```

---

## 📡 Task Lifecycle

```
submit()                    node claims task
   │                              │
   ▼                              ▼
task_id ──────────────► PENDING ──► CLAIMED ──► RUNNING ──► DONE
returned immediately                                          │
                                                         result stored
                                                         in Zenoh KV
```

CatBus is **fully asynchronous** — submitting a task never blocks. Nodes pull tasks when they have capacity, execute them, and publish results back to the Zenoh fabric.

---

## 🖥️ Monitoring Dashboard

CatBus ships with a built-in monitoring dashboard:

```bash
catbus dashboard --port 8080
```

View at `http://localhost:8080`:
- Real-time node status across your fleet
- Task queue depth per node
- API cost breakdown (per node, per day)
- 24-hour health aggregation via Zenoh pub/sub

---

## 🌐 Multi-Node Deployment

CatBus is designed for geographically distributed deployments. Each node just needs to reach at least one peer:

```yaml
# Node in France (OVH)
zenoh:
  mode: peer
  connect:
    - "tcp/your-home-node-ip:7447"

# Node in Los Angeles
zenoh:
  mode: peer
  connect:
    - "tcp/your-home-node-ip:7447"
    - "tcp/france-node-ip:7447"
```

Nodes self-discover via Zenoh's gossip protocol. No manual routing tables needed.

---

## 📊 Real-World Usage

CatBus powers a 5-node global fleet running daily SEO analysis workflows:

| Node | Location | Role |
|------|----------|------|
| Nefi   | Home | Primary / Orchestrator |
| Gouzi  | OVH France | Worker |
| Mimi   | Los Angeles | Worker |
| Huanhu | Home | Worker |
| *(+ more)* | Various | Workers |

The system processes hundreds of tasks daily with automatic cost balancing across nodes.

---

## 📁 Project Structure

```
catbus/
├── catbus/
│   ├── core/
│   │   ├── node.py          # Node lifecycle management
│   │   ├── task.py          # Task submission & tracking
│   │   └── state.py         # Three-layer state tree (Desired/Actual/Drift)
│   ├── transport/
│   │   └── zenoh_transport.py   # Zenoh P2P communication layer
│   ├── agents/
│   │   └── openclaw.py      # OpenClaw agent integration
│   └── dashboard/           # Monitoring web UI
├── examples/
│   ├── single_node/         # Getting started example
│   ├── multi_node/          # Distributed setup
│   └── seo_workflow/        # Real-world workflow example
├── config.example.yaml
├── docker-compose.example.yml
└── docs/
```

---

## 🐳 Docker

```bash
# Single node quickstart
docker-compose -f docker-compose.example.yml up

# Or build your own
docker build -t catbus .
docker run -v $(pwd)/config.yaml:/app/config.yaml catbus
```

---

## 🛠️ Configuration Reference

| Key | Default | Description |
|-----|---------|-------------|
| `node.name` | *(required)* | Unique node identifier |
| `zenoh.mode` | `peer` | Zenoh session mode |
| `zenoh.endpoints` | `[]` | Local listen endpoints |
| `zenoh.connect` | `[]` | Remote peers to connect to |
| `agent.provider` | `openai` | AI provider |
| `catbus.max_concurrent_tasks` | `3` | Max parallel tasks per node |
| `catbus.health_report_interval` | `3600` | Health report cadence (seconds) |
| `catbus.telegram_token` | `""` | Telegram bot token for notifications |

Full reference → [docs/configuration.md](./docs/configuration.md)

---

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) first.

```bash
# Development setup
git clone https://github.com/xiaogong2000/catbus.git
cd catbus
pip install -e ".[dev]"
pre-commit install
```

Key areas where help is appreciated:
- More agent integrations (beyond OpenClaw)
- Additional workflow examples
- Documentation improvements
- Windows/ARM support testing

---

## 📋 Roadmap

- [ ] Agent capability matching (auto-route tasks to capable nodes)
- [ ] Schema versioning for health data
- [ ] Improved provider failover logic
- [ ] Web-based task submission UI
- [ ] Marketplace / "Uber for AI Bots" mode

---

## 📄 License

MIT License — see [LICENSE](./LICENSE) for details.

---

## 🙏 Acknowledgements

- [Zenoh](https://zenoh.io/) — the incredible P2P networking layer that makes all of this possible
- [OpenClaw](https://github.com/openclaw) — AI agent framework powering the fleet

---

<p align="center">
  Made with ❤️ for the distributed AI community
</p>
