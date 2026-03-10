# CatBus 工程师入门说明

> 欢迎加入 CatBus 项目。这份文档帮你在 30 分钟内搞清楚项目背景、架构、代码结构和如何上手。

---

## 项目背景

**CatBus 解决什么问题？**

现有的多智能体框架（CrewAI、AutoGen、LangGraph）都假设所有 Agent 运行在同一台机器的同一个进程里。但现实是：
- 不同人的 Agent 运行在不同机器上
- 跨机器调用没有通用协议
- 没有一个轻量的"中间人"负责撮合

CatBus 是这个中间人。任何 Agent 都可以通过 CatBus 把任务发给网络上其他有能力处理的 Agent，不需要知道对方在哪台机器、用什么框架。

**类比：** Uber 的调度系统——乘客（发任务的 Agent）不需要知道司机（执行任务的 Agent）是谁、在哪，中心只负责撮合。

---

## 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                    CatBus Network                       │
│                                                         │
│  Agent A (机器1)         中继服务器         Agent B (机器2) │
│  ┌──────────┐    WS     ┌──────────┐    WS  ┌──────────┐ │
│  │ Daemon   │◄─────────►│  Server  │◄──────►│ Daemon   │ │
│  │ :9800    │           │ (无状态) │        │ :9800    │ │
│  └────┬─────┘           └──────────┘        └────┬─────┘ │
│       │ HTTP                                      │ HTTP  │
│       ▼                                           ▼       │
│  ┌──────────┐                               ┌──────────┐  │
│  │ OpenClaw │                               │ OpenClaw │  │
│  │ Skill    │                               │ Skill    │  │
│  └──────────┘                               └──────────┘  │
└─────────────────────────────────────────────────────────┘
```

**三个角色：**

| 角色 | 说明 |
|------|------|
| **Server**（中继服务器） | 维护在线节点列表，负责 REQUEST → TASK → RESULT 的消息转发。全内存，无持久化，无状态 |
| **Daemon**（本地守护进程） | 每台机器跑一个。向上连 Server（WebSocket），向下暴露本地 HTTP API（供 Skill 调用）。同时是 Caller（发任务）和 Provider（接任务） |
| **Skill**（技能插件） | 声明这台机器能做什么。Daemon 启动时注册到 Server |

---

## 代码结构

```
catbus/                   ← 主项目（pip install catbus）
├── catbus/
│   ├── __init__.py       ← 版本号
│   ├── __main__.py       ← CLI 入口（catbus serve / status / call）
│   ├── cli.py            ← 命令行解析
│   ├── config.py         ← 配置加载（~/.catbus/config.yaml）
│   ├── daemon.py         ← 核心：本地守护进程，双向 WebSocket + HTTP server
│   ├── executor.py       ← 执行 Skill 的逻辑
│   ├── service.py        ← systemd/launchd 服务安装
│   └── builtin_skills.py ← 内置技能（echo、translate 等）
├── server/
│   ├── server.py         ← 中继服务器（独立部署）
│   └── Dockerfile        ← 容器化
├── skill/
│   └── SKILL.md          ← OpenClaw Skill 集成说明
├── pyproject.toml
└── README.md / README.zh-CN.md
```

---

## 消息协议

所有消息都是 JSON，通过 WebSocket 传输。

### Daemon → Server（注册）
```json
{
  "type": "REGISTER",
  "node_id": "uuid-xxx",
  "name": "my-agent",
  "skills": [
    {"name": "translate", "description": "..."}
  ]
}
```

### Daemon → Server（发起请求）
```json
{
  "type": "REQUEST",
  "request_id": "uuid-yyy",
  "skill": "translate",
  "input": {"text": "hello", "target_lang": "zh"}
}
```

### Server → Provider Daemon（转发任务）
```json
{
  "type": "TASK",
  "task_id": "uuid-zzz",
  "request_id": "uuid-yyy",
  "caller_id": "uuid-xxx",
  "skill": "translate",
  "input": {"text": "hello", "target_lang": "zh"}
}
```

### Provider → Server（返回结果）
```json
{
  "type": "RESULT",
  "task_id": "uuid-zzz",
  "success": true,
  "output": {"result": "你好"}
}
```

---

## 本地开发

### 环境准备

```bash
git clone https://github.com/xiaogong2000/catbus.git
cd catbus
pip install -e ".[dev]"
```

### 启动中继服务器（本地测试用）

```bash
cd server
python server.py --port 8765
```

### 启动本地 Daemon

```bash
# 配置文件
mkdir -p ~/.catbus
cat > ~/.catbus/config.yaml << EOF
server: ws://localhost:8765
port: 9800
name: my-test-agent
skills:
  - name: echo
    description: "Echo back input"
    handler: "python:catbus.builtin_skills.echo"
    input_schema:
      text: string
EOF

# 启动
catbus serve
```

### 测试调用

```bash
# 另开一个终端，启动第二个 Agent（换个端口）
catbus serve --port 9801 --name second-agent

# 从第一个 Agent 调用 echo 技能
catbus call echo -i '{"text": "hello catbus"}'
# → {"result": "hello catbus"}
```

---

## 当前状态与待做事项

**已实现：**
- WebSocket 中继服务器（无状态，支持多节点）
- Daemon 自动重连
- Skill 注册与发现
- 同步任务请求/响应
- CLI（serve / status / call）
- systemd/launchd 服务安装
- OpenClaw Skill 集成
- Docker 支持

**待开发（欢迎认领）：**

| 优先级 | 功能 | 说明 |
|--------|------|------|
| 高 | 基于能力的路由 | 按 skill 名称之外的能力描述匹配（语义匹配） |
| 高 | 健康监控 | 节点在线状态、任务成功率上报 |
| 中 | 负载均衡 | 多个节点都有同一 skill 时，智能选择 |
| 中 | 超时与重试 | 任务超时自动重试到其他节点 |
| 中 | Web UI | 可视化查看网络状态和任务记录 |
| 低 | 公共中继网络 | `relay.catbus.ai`，让陌生人的 Agent 也能互联 |

---

## 联系与协作

- GitHub：https://github.com/xiaogong2000/catbus
- 问题和建议：GitHub Issues
- 代码规范：Python 3.10+，类型注解，async/await

有任何问题直接开 Issue 或在群里问。欢迎 PR！🚌
