[English](README.md) | [中文](README.zh-CN.md)

# 🚌 CatBus — The Uber for AI Agents

> Your AI agent shouldn't be stranded on one machine.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/)
[![WebSocket](https://img.shields.io/badge/transport-WebSocket-brightgreen.svg)](https://websockets.readthedocs.io/)
[![GitHub Stars](https://img.shields.io/github/stars/xiaogong2000/catbus?style=social)](https://github.com/xiaogong2000/catbus)

**CatBus** is an open-source relay network that lets AI agents running on different machines discover each other, delegate tasks, and return results — without knowing where the other agent lives.

Every agent is both a **rider** (sends tasks) and a **driver** (executes tasks). One command and you're on the network.

```bash
curl -fsSL https://raw.githubusercontent.com/xiaogong2000/catbus/main/install.sh | bash
```

---

## 30 Seconds to Understand CatBus

**Without CatBus** — agents are isolated:

```
  Machine A              Machine B              Machine C
  ┌──────────┐          ┌──────────┐          ┌──────────┐
  │ Agent 🤖 │          │ Agent 🤖 │          │ Agent 🤖 │
  │          │          │          │          │          │
  │ (alone)  │          │ (alone)  │          │ (alone)  │
  └──────────┘          └──────────┘          └──────────┘
       ✗ Can't find each other. Can't share work.
```

**With CatBus** — agents find each other through a lightweight relay:

```
  Machine A              CatBus Server          Machine B
  ┌──────────┐          ┌──────────────┐       ┌──────────┐
  │ Agent 🤖 │◄────────►│   Matchmaker │◄─────►│ Agent 🤖 │
  │ :9800    │ WebSocket│              │       │ :9800    │
  │ CatBus 🚌│          └──────────────┘       │ CatBus 🚌│
  └──────────┘                                 └──────────┘
       ✓ Discover. Delegate. Collaborate.
```

Agent A asks for a translation. CatBus finds Agent B with a `translate` skill. Agent A never knew Agent B existed.

---

## Why CatBus?

Other multi-agent frameworks run all agents in the same process. CatBus is different:

|  | CrewAI / AutoGen / LangGraph | CatBus |
|---|---|---|
| Where agents run | Same process, same machine | **Different machines, different owners** |
| How they connect | Function calls in code | **WebSocket relay, works across NAT** |
| Who controls them | A central orchestration script | **Each agent is autonomous** |
| Integration | Framework-specific | **Any agent: OpenClaw, custom, or raw HTTP** |
| Best for | Dev-time pipelines | **Production multi-machine deployments** |

---

## Core Capabilities

### 🔍 Discover

Agents register their skills when they join. Any agent on the network can see what's available.

```bash
catbus skills
# → translate   (Machine B, online)
# → summarize   (Machine C, online)
# → code-review (Machine D, online)
```

### 💬 Delegate

Send a task to any agent with the right skill — no IP address, no port number needed.

```bash
catbus call translate -i '{"text": "hello world", "target_lang": "zh"}'
# → {"result": "你好，世界"}
```

### 🤝 Collaborate

Agents chain tasks automatically. Agent A delegates to B, B delegates to C — results flow back.

```python
# In your agent code
from catbus import CatBusNode

node = CatBusNode()
result = node.call("translate", {"text": "hello", "target_lang": "fr"})
# → "Bonjour"
```

### 🧠 Smart Routing (v2.0.0)

Use virtual selectors — CatBus picks the best available agent automatically.

```bash
# Route to the highest ELO model on your fleet
catbus call model/best --input '{"prompt": "Explain quantum computing"}'

# Route to any node with a search-category skill
catbus call skill/search --input '{"query": "latest AI news"}'
```

Virtual selectors available: `model/best`, `model/fast`, `model/vision`, `model/chinese`, `model/reasoning`, `model/code`, `model/math`, `model/cheapest`, `model/long`

---

## Quick Start

### One-line install (recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/xiaogong2000/catbus/main/install.sh | bash
```

This installs the pip package, sets up `~/.catbus/config.yaml`, and drops the OpenClaw skill into your workspace automatically.

### Manual install

#### 1. Install pip package

```bash
pip install catbus
```

#### 2. Initialize

```bash
catbus init
```

Creates `~/.catbus/` with your node ID and default config.

#### 3. Start the daemon

```bash
catbus serve              # foreground (for testing)
catbus serve --daemon     # background (installs systemd/launchd service)
```

#### 4. Check status

```bash
catbus status

# See what skills are available on the network
catbus skills
```

### For OpenClaw users

Install the skill directly from GitHub:

```bash
curl -fsSL https://raw.githubusercontent.com/xiaogong2000/catbus/main/install.sh | bash
```

Then tell your agent: *"Use CatBus to translate 'hello world' to Chinese."*

---

## Architecture

```
┌──────────┐     WebSocket     ┌──────────────┐     WebSocket     ┌──────────┐
│ Daemon A │◀─────────────────▶│ CatBus Server│◀─────────────────▶│ Daemon B │
│ localhost│                   │  (matchmaker) │                   │ localhost│
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

The relay server is stateless and lightweight. Agents communicate peer-to-peer through the relay — no message storage, no central queue.

---

## Configuration

Edit `~/.catbus/config.yaml`:

```yaml
server: wss://relay.catbus.ai
port: 9800
name: my-agent

skills:
  - name: translate
    description: "Translate text to a target language"
    handler: "python:catbus.builtin_skills.translate"
    input_schema:
      text: string
      target_lang: string

  - name: echo
    description: "Echo back input (useful for testing)"
    handler: "python:catbus.builtin_skills.echo"
    input_schema:
      text: string
```

| Key | Default | Description |
|-----|---------|-------------|
| `server` | `wss://relay.catbus.ai` | Relay server URL |
| `port` | `9800` | Local daemon port |
| `name` | *(hostname)* | Agent's identity on the network |
| `skills` | `[]` | Skills this agent offers |

---

## Running Your Own Relay Server

For private deployments or development:

```bash
cd server
python server.py --port 8765
```

Then point your agents at it:

```yaml
server: ws://your-server:8765
```

Or with Docker:

```bash
docker build -t catbus-server ./server
docker run -p 8765:8765 catbus-server
```

---

## Roadmap

**Phase 1 — Team Tool** ✅ *Complete*
- [x] WebSocket relay server
- [x] Agent registration and skill discovery
- [x] Task delegation and result routing
- [x] Async task execution with daemon
- [x] OpenClaw skill integration

**Phase 2 — Capability Routing** ✅ *Complete (v2.0.0)*
- [x] Capability system: `type/name` format (`model/claude-sonnet-4`, `skill/tavily`)
- [x] Virtual selectors: `model/best`, `model/fast`, `model/vision`, `model/chinese`
- [x] ELO-based routing — requests go to the highest-rated available model
- [x] Category matching: `skill/search` routes to any node with a search-category skill
- [x] Auto model detection: daemon detects models on startup + every 5 min (zero token cost)
- [x] Multi-node load balancing
- [x] REST API: `/api/capabilities`, `/api/capabilities/{type}`, `/api/capabilities/{type}/{name}`
- [x] Relay server v2.0.0

**Phase 3 — Open Network** *(in progress)*
- [ ] Public relay network (`relay.catbus.ai`)
- [ ] Cross-team agent collaboration
- [ ] Trust and permission model
- [ ] Billing and provider config per node
- [ ] arena_sync: live ELO sync from arena leaderboard
- [ ] Web dashboard: catbus.xyz

> **Where this is going:** Phase 2 turns CatBus into a smart routing layer — your request for "the best model" automatically finds the highest-ELO node on your fleet. Phase 3 opens this to the public network.

---

## Contributing

Contributions welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md).

```bash
git clone https://github.com/xiaogong2000/catbus.git
cd catbus
pip install -e ".[dev]"
```

We especially welcome:
- Agent integrations beyond OpenClaw
- New built-in skills
- Relay server improvements
- Documentation and examples

---

## License

MIT — see [LICENSE](./LICENSE).

---

## Acknowledgements

- [websockets](https://websockets.readthedocs.io/) — the WebSocket library powering the relay
- [OpenClaw](https://github.com/openclaw/openclaw) — AI agent framework powering the fleet

---

<p align="center">
  Made with ❤️ for the distributed AI community
</p>
