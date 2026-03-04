# 🚌 CatBus

> Your AI robots shouldn't be trapped on one machine.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/)
[![Zenoh](https://img.shields.io/badge/networking-Zenoh-orange.svg)](https://zenoh.io/)
[![GitHub Stars](https://img.shields.io/github/stars/xiaogong2000/catbus?style=social)](https://github.com/xiaogong2000/catbus)

**CatBus** is an open-source tool that lets AI robots running on different physical machines discover each other, communicate, and collaborate — no central server, no single owner required.

Most multi-agent frameworks (CrewAI, AutoGen, LangGraph) run all agents inside one process on one machine. That's not how the real world works. Your agents live on different machines, in different cities, owned by different people. **CatBus connects them.**

**中文文档** → [README_zh.md](./README_zh.md)

---

## 30 Seconds to Understand CatBus

**Without CatBus** — your robots are isolated:

```
  Machine A              Machine B              Machine C
  ┌──────────┐          ┌──────────┐          ┌──────────┐
  │ Agent 🤖 │          │ Agent 🤖 │          │ Agent 🤖 │
  │          │          │          │          │          │
  │ (alone)  │          │ (alone)  │          │ (alone)  │
  └──────────┘          └──────────┘          └──────────┘
       ✗ Can't see each other. Can't work together.
```

**With CatBus** — they find each other and collaborate:

```
  Machine A              Machine B              Machine C
  ┌──────────┐          ┌──────────┐          ┌──────────┐
  │ Agent 🤖 │◄────────►│ Agent 🤖 │◄────────►│ Agent 🤖 │
  │          │          │          │          │          │
  │ CatBus 🚌│          │ CatBus 🚌│          │ CatBus 🚌│
  └──────────┘          └──────────┘          └──────────┘
       ✓ Discover. Communicate. Collaborate.
```

No central server. No cloud dependency. Just robots talking to robots.

---

## Why CatBus?

Other multi-agent frameworks run all agents in the same process. CatBus is different:

|  | CrewAI / AutoGen / LangGraph | CatBus |
|---|---|---|
| Where agents run | Same process, same machine | **Different machines, different locations** |
| How they connect | Function calls in code | **P2P network, no cloud needed** |
| Who controls them | A central orchestration script | **Each robot is autonomous** |
| Best for | Dev-time agent pipelines | **Production multi-machine deployments** |

---

## Core Capabilities

### 🔍 Discover

Robots find each other automatically when they join the network. No registration server, no manual config.

```python
from catbus import CatBusNode

# Start a node — it immediately discovers peers on the network
node = CatBusNode(name="my-robot", capabilities=["seo", "translation"])
node.start()

# See who's out there
peers = node.discover()
# → [{"name": "alice-bot", "capabilities": ["writing", "research"]},
#    {"name": "bob-bot",  "capabilities": ["coding", "testing"]}]
```

### 💬 Communicate

Robots send messages to each other — requests, responses, events, status updates.

```python
# Send a message to a specific robot
response = node.ask("alice-bot", {
    "type": "request",
    "task": "translate this paragraph to French",
    "payload": {"text": "Hello world"}
})

# Or broadcast to anyone who can help
response = node.ask("any", {
    "type": "request",
    "capability": "translation",
    "payload": {"text": "Hello world", "target_lang": "fr"}
})
```

### 🤝 Collaborate

Robots delegate tasks to each other and work together on complex workflows.

```python
# Submit a task — returns immediately, executes on the best available node
task_id = node.submit(
    target="any",
    task_type="seo_analysis",
    payload={"url": "https://example.com"}
)

# The task flows through the network:
#   PENDING → CLAIMED (by a capable node) → RUNNING → DONE
result = node.wait(task_id, timeout=120)
```

---

## Architecture

CatBus is built as a four-layer stack. Each layer serves a clear purpose:

```
┌──────────────────────────────────────────────────────┐
│  Collaboration Layer                                 │
│  Task delegation · Workflows · Cost balancing        │
├──────────────────────────────────────────────────────┤
│  Communication Layer                                 │
│  Request/Response · Pub/Sub · Event notification     │
├──────────────────────────────────────────────────────┤
│  Discovery Layer                                     │
│  Peer discovery · Capability announcement · Identity │
├──────────────────────────────────────────────────────┤
│  Transport Layer (Zenoh P2P)                         │
│  Physical connectivity · NAT traversal · Gossip      │
└──────────────────────────────────────────────────────┘
```

**Why Zenoh?** CatBus uses [Zenoh](https://zenoh.io/) as its transport layer — a peer-to-peer protocol that handles node discovery, message routing, and NAT traversal without a central broker. This means your robots can connect across home networks, VPS providers, and data centers without any special infrastructure.

### State Model: Desired / Actual / Drift

Each robot maintains a three-layer state tree:

```
┌──────────────────┐
│  Desired State   │ ← What the robot should be doing
├──────────────────┤
│  Actual State    │ ← What it's actually doing right now
├──────────────────┤
│  Drift           │ ← The gap (triggers alerts if too large)
└──────────────────┘
```

This makes it easy to monitor a fleet of robots at a glance — you immediately see which ones have drifted from their expected behavior.

---

## Quick Start

### Prerequisites

- Python 3.10+
- [Zenoh](https://zenoh.io/docs/getting-started/installation/) installed

### Install

```bash
pip install catbus-agent
```

Or from source:

```bash
git clone https://github.com/xiaogong2000/catbus.git
cd catbus
pip install -e .
```

### Configure Your Robot

```bash
cp config.example.yaml config.yaml
```

```yaml
node:
  name: "my-robot"          # Your robot's name on the network
  location: "us-west"       # Where it lives
  capabilities:             # What it can do
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

### Join the Network

```bash
catbus start
```

Your robot is now discoverable by any other CatBus node it can reach. That's it.

### Connect a Second Robot

On another machine, install CatBus, point it at the first node, and start:

```yaml
# config.yaml on Machine B
node:
  name: "helper-bot"
  capabilities: ["research", "coding"]

zenoh:
  mode: peer
  connect:
    - "tcp/machine-a-ip:7447"    # Just needs to reach one peer
```

```bash
catbus start
```

The two robots can now discover each other, exchange messages, and delegate tasks.

---

## Real-World Proof

CatBus isn't a prototype — it runs a 5-node fleet across three continents 24/7:

| Robot | Location | Capabilities |
|-------|----------|-------------|
| Nefi    | Home (Primary) | Orchestration, SEO |
| Gouzi   | OVH France | General tasks |
| Mimi    | Los Angeles | Content generation |
| Huanhu  | Home | Monitoring |
| *(+ more)* | Various | Various |

The fleet processes hundreds of tasks daily. When one node is overloaded, tasks automatically flow to nodes with available capacity. API costs are tracked and balanced across the network.

---

## Monitoring

```bash
catbus dashboard --port 8080
```

The built-in dashboard shows:
- Which robots are online and what they're doing
- Task flow across the network
- API cost breakdown per robot, per day
- 24-hour health reports aggregated via Zenoh pub/sub

---

## Multi-Node Deployment

Every node just needs to reach at least one peer. Zenoh's gossip protocol handles the rest:

```yaml
# Robot in France
zenoh:
  connect:
    - "tcp/home-node:7447"

# Robot in Los Angeles
zenoh:
  connect:
    - "tcp/home-node:7447"
    - "tcp/france-node:7447"
```

No routing tables. No service discovery infrastructure. Nodes find each other automatically.

---

## Project Structure

```
catbus/
├── catbus/
│   ├── core/
│   │   ├── node.py              # Robot lifecycle & identity
│   │   ├── task.py              # Task submission & tracking
│   │   └── state.py             # Desired / Actual / Drift state tree
│   ├── transport/
│   │   └── zenoh_transport.py   # Zenoh P2P communication
│   ├── discovery/
│   │   └── capabilities.py      # Capability announcement & matching
│   ├── agents/
│   │   └── openclaw.py          # OpenClaw agent integration
│   └── dashboard/               # Monitoring web UI
├── examples/
│   ├── two_robots/              # Minimal two-robot setup
│   ├── team_fleet/              # Team deployment with 5+ nodes
│   └── seo_workflow/            # Real-world SEO pipeline
├── config.example.yaml
└── docs/
```

---

## Docker

```bash
docker-compose -f docker-compose.example.yml up
```

Or build your own:

```bash
docker build -t catbus .
docker run -v $(pwd)/config.yaml:/app/config.yaml catbus
```

---

## Configuration Reference

| Key | Default | Description |
|-----|---------|-------------|
| `node.name` | *(required)* | Robot's identity on the network |
| `node.capabilities` | `[]` | What this robot can do |
| `zenoh.mode` | `peer` | Zenoh session mode |
| `zenoh.endpoints` | `[]` | Local listen endpoints |
| `zenoh.connect` | `[]` | Peers to connect to |
| `agent.provider` | `openai` | AI provider |
| `catbus.max_concurrent_tasks` | `3` | Max parallel tasks |
| `catbus.health_report_interval` | `3600` | Health report cadence (seconds) |
| `catbus.telegram_token` | `""` | Telegram notifications |

Full reference → [docs/configuration.md](./docs/configuration.md)

---

## Roadmap

**Phase 1 — Team Tool** *(current)*
- [x] P2P node discovery via Zenoh
- [x] Async task submission and execution
- [x] Three-layer state tree (Desired/Actual/Drift)
- [x] Pull-based task distribution with claim mechanism
- [x] Cost tracking across fleet
- [ ] Capability-based task routing
- [ ] Schema versioning for health data
- [ ] Provider failover improvements
- [ ] Web-based task submission UI

**Phase 2 — Open Network** *(future)*
- [ ] Public capability registry
- [ ] Cross-team robot collaboration
- [ ] Trust and permission model
- [ ] Marketplace for robot capabilities

> **Where this is going:** Today, CatBus connects your robots within your team. We're building toward an open network where any AI robot can discover and collaborate with any other — an internet of AI robots.

---

## Contributing

Contributions welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md).

```bash
git clone https://github.com/xiaogong2000/catbus.git
cd catbus
pip install -e ".[dev]"
pre-commit install
```

We especially welcome:
- Agent integrations beyond OpenClaw
- Workflow examples
- Documentation improvements
- Windows / ARM testing

---

## License

MIT — see [LICENSE](./LICENSE).

---

## Acknowledgements

- [Zenoh](https://zenoh.io/) — the P2P networking layer that makes this possible
- [OpenClaw](https://github.com/openclaw) — AI agent framework powering the fleet

---

<p align="center">
  Made with ❤️ for the distributed AI community
</p>
