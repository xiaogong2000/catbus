# 🚌 CatBus — 猫猫巴士通信系统 v3

> 基于 MQTT 的 OpenClaw 机器人间通信框架
> 让任意机器人可以直接、高效、结构化地互相通信，不依赖 Telegram，不依赖自然语言。
> v3: 整合 Agent 角色体系、层级拓扑、熔断器、反模式防护等生产级设计。

---

## 一、系统拓扑

CatBus 采用 **层级式（Hierarchical）** 拓扑，不是网格式，不是群体式。

```
你（Supervisor，最高权限）
  │
  ├── 狗子（独立 SRE，监控整个系统，直接向你汇报）
  │
  └── Nefi（Manager，唯一的任务分发者）
        ├── 浣浣（Worker — 编码执行）
        ├── 咪咪（Worker — 存储/轻量）
        └── 小黑（Worker — 重型计算）
```

**拓扑规则：**
- 只有 Nefi 可以向 Worker 派发 `[TASK]`
- Worker 之间不互相派活（禁止 Chain Delegation）
- Worker 收到任务后执行并回报，不做二次分发
- Worker 觉得任务不适合自己时，回报 `reassign` 给 Nefi 决策
- 狗子独立运作，负责监控整个系统（包括监控 Nefi）
- 你（Supervisor）可以直接给任何机器人派发任务，覆盖一切规则

**物理架构：**

```
家里 (<1ms)                          海外
┌──────────────────────┐     ┌─────────────────────────────┐
│ 狗子 (运维SRE)       │     │ 浣浣 (法国) Worker+Broker    │
│ Nefi (Mac) Manager   │     │ 咪咪 (洛杉矶) Worker        │
└──────────────────────┘     │ 小黑 (美国) Worker           │
                              └─────────────────────────────┘

                    ┌─────────────────┐
                    │  MQTT Broker    │
                    │  (浣浣 ge.ovh)  │
                    │  port 8883 TLS  │
                    └─────────────────┘
```

---

## 二、Agent 角色定义

每个 Agent 用三要素定义：role（角色）、goal（目标）、boundary（边界）。

### 🐱 狗子（gouzi）— 运维 SRE + Supervisor

| 项目 | 详情 |
|------|------|
| 主机 | 本机 Debian，Xeon E-2246G，6核/8G/313G |
| 位置 | 家里（大陆） |
| Primary | azure-anthropic/claude-opus-4-6 |
| 月费(API) | ~$0（Azure 免费额度） |

```
role: 运维 SRE + 系统监控者
goal: 保障所有机器和服务的可用性，主动发现并修复问题，减少人工干预
boundary:
  - 不写业务代码
  - 不做架构设计
  - 不向 Worker 派发业务任务
  - 收到非运维任务时回报 fail 并建议转发给 nefi
can_delegate: false
supervises: [nefi, huanhuan, mimi, xiaohei]
```

**Supervisor 巡检职责（每小时自动执行）：**

| 异常 | 条件 | 告警级别 |
|------|------|---------|
| 机器离线 | status 显示 offline 超过 10 分钟 | warn |
| 任务积压 | 某台机器队列深度 > 5 | warn |
| 连续失败 | 某台机器连续 3 次 fail | error |
| 通信中断 | Broker 不可达 | critical |
| 成本异常 | 单日 token 消耗超过 $5 | warn |

不需要主人指令，自主巡检。发现问题先尝试自行修复（重启服务、清理磁盘），修复不了再通过 Telegram 告警主人。

---

### 🍎 Nefi（nefi）— 架构师 + Manager

| 项目 | 详情 |
|------|------|
| 主机 | Mac M2 Max，12核CPU/30核GPU/大内存 |
| 位置 | 家里局域网 |
| Primary | azure-claude/claude-opus-4-6 |
| 月费(API) | ~$18（最大消耗源） |

```
role: 架构师 + Manager
goal: 设计技术方案并将执行工作高效分发给合适的 Worker，控制整体质量和成本
boundary:
  - 方案设计和技术决策自己做
  - 符合派发条件的执行工作必须派出去，不当 God Agent
  - 审查 Worker 回报的结果，不满意时可以追加修改任务
  - 不直接操作生产服务（除非紧急且所有 Worker 离线）
can_delegate: true
delegates_to: [huanhuan, mimi, xiaohei]
```

**Nefi 派发判断（三问原则）：**
1. 这个任务必须在远程服务器上执行吗？→ 否则自己做
2. 这个任务我能在本地完成吗？→ 能则自己做
3. 派发这个任务比自己做更高效吗？→ 否则自己做

只有三个问题都指向"派发"时，才发 `[TASK]`。

**任务路由表：**

| 任务特征 | 派给 |
|---------|------|
| 改代码 / 部署服务 / 跑测试 | huanhuan |
| 备份数据 / 归档日志 / 定时采集 | mimi |
| 压测 / CI 构建 / 实验性任务 | xiaohei |
| 服务器故障 / 监控告警 / 运维操作 | gouzi |

**特殊规则：**
- 不确定发给谁 → 自己先做
- 目标机器离线 → 等待或选择备选（huanhuan ↔ xiaohei 可互为备援）
- 不要为了派发而派发

**熔断规则（Daemon 层面自动执行，不依赖 AI 维护计数器）：**
- Daemon 内存维护 `fail_counter`：每次收到 `status=fail` 的 result，对应机器 +1
- 每次收到 `status=done`，重置为 0；`reassign` 不计入失败
- 连续 3 次 fail → Daemon 标记为"熔断"，后续 `catbus_send` 到该目标会被 Daemon 拦截
- 拦截时返回 `{"ok": false, "error": "Circuit open: ..."}`，AI 收到后通知主人
- 1 小时后自动解除，或主人手动解除

---

### 🦝 浣浣（huanhuan）— 编码执行者

| 项目 | 详情 |
|------|------|
| 主机 | ge.ovh（法国 OVH），8核/32G/410G |
| 位置 | 法国，延迟 ~148ms |
| Primary | newcli-aws/claude-opus-4-6 |
| 月费(API) | ~$3 |

```
role: 编码执行者
goal: 在 ge.ovh 服务器上可靠执行编码和部署任务，确保服务稳定
boundary:
  - 只执行收到的任务，不主动发起业务任务
  - 执行过程中发现服务器故障 → 发 alert
  - 执行过程中发现方案有问题 → 回报 fail 并说明原因
  - 如果任务明显不适合自己 → 回报 reassign 并建议目标
can_delegate: false
```

**同时承载 MQTT Broker 角色（Docker 中运行 Mosquitto）。**

---

### 🐱 咪咪（mimi）— 存储与轻量任务

| 项目 | 详情 |
|------|------|
| 主机 | la.css（洛杉矶），Xeon E3-1240 v3，8核/32G/916G |
| 位置 | 洛杉矶，延迟 ~176ms |
| Primary | openai/gpt-5.1-codex-mini |
| 月费(API) | ~$0.3 |

```
role: 存储与轻量任务执行者
goal: 利用大磁盘优势处理数据备份、日志归档、定时采集等存储密集型任务
boundary:
  - 只处理数据/存储相关任务
  - 不做复杂编码或部署
  - 收到不适合的任务 → 回报 reassign
can_delegate: false
```

---

### 🖤 小黑（xiaohei）— 重型计算与实验

| 项目 | 详情 |
|------|------|
| 主机 | us.ovh（美国 OVH），Xeon E3-1270 v6，8核/32G/410G |
| 位置 | 美国，延迟 ~218ms |
| Primary | openai/gpt-5.1-codex |
| 月费(API) | ~$2 |

```
role: 重型计算与实验
goal: 利用较新 CPU 处理压测、CI 构建、实验性任务等计算密集型工作
boundary:
  - 只处理计算密集型任务
  - 不做生产部署（生产环境在浣浣上）
  - 收到不适合的任务 → 回报 reassign
can_delegate: false
```

---

## 三、核心组件

### 3.1 MQTT Broker（Mosquitto）

部署在浣浣的 Docker 中，负责消息路由。

```yaml
# docker-compose.yml (浣浣上)
services:
  mosquitto:
    image: eclipse-mosquitto:2
    container_name: catbus-broker
    restart: always
    ports:
      - "8883:8883"     # TLS
      # 不开放 1883，强制加密
    volumes:
      - ./mosquitto/config:/mosquitto/config
      - ./mosquitto/data:/mosquitto/data
      - ./mosquitto/log:/mosquitto/log
      - ./mosquitto/certs:/mosquitto/certs
```

Mosquitto 配置：
```
# mosquitto/config/mosquitto.conf
listener 8883
certfile /mosquitto/certs/server.crt
keyfile /mosquitto/certs/server.key
cafile /mosquitto/certs/ca.crt

allow_anonymous false
password_file /mosquitto/config/passwd

persistence true
persistence_location /mosquitto/data/

log_dest file /mosquitto/log/mosquitto.log
```

每台机器一个账号：
```bash
mosquitto_passwd -c /mosquitto/config/passwd gouzi
mosquitto_passwd    /mosquitto/config/passwd nefi
mosquitto_passwd    /mosquitto/config/passwd huanhuan
mosquitto_passwd    /mosquitto/config/passwd mimi
mosquitto_passwd    /mosquitto/config/passwd xiaohei
```

### 3.2 CatBus Daemon

每台机器上的后台进程。用 Python 实现，职责：
1. 维持与 Broker 的 MQTT 长连接（含 MQTTv5 会话持久化）
2. 订阅本机相关的 topic（精准路由，不收无关消息）
3. 收到消息时入队，由 worker 线程顺序调用 `openclaw agent --message` 唤醒本地 AI（防并发 OOM）
4. 暴露一个本地 ThreadingUnixStreamServer，供 skill 脚本安全并发调用

```
catbus-daemon
├── 对外：MQTT 长连接 ←→ Broker
├── 对内：Unix Socket /tmp/catbus.sock ←→ skill 脚本
├── 桥接：收到 MQTT 消息 → 任务队列 → worker 线程 → openclaw agent --message
└── 保护：MAX_WORKERS 并发控制 + 600s 超时 + Session Expiry 持久化
```

为什么用 Unix Socket 而不是 HTTP：
- 不占端口，不怕端口冲突
- 只有本机进程能访问，天然安全
- 零网络开销

### 3.3 CatBus Skill

OpenClaw skill，给 AI 提供三个工具：

| 工具 | 用途 | 示例 |
|------|------|------|
| `catbus_send` | 发消息给其他机器人 | 给浣浣发一个编码任务 |
| `catbus_read` | 读取某个 topic 的最新消息 | 查看浣浣的任务执行结果 |
| `catbus_status` | 查看所有机器人在线状态 | 确认浣浣是否在线 |

AI 视角极其简单：
```
我要给浣浣派一个编码任务
→ 调用 catbus_send，target=huanhuan，payload=任务JSON
→ 完成
```

---

## 四、Topic 结构

```
catbus/
├── task/{target}/              # 派发任务（QoS 1）
│   例: catbus/task/huanhuan
│
├── result/{target}/{source}/   # 任务结果（QoS 1，精准投递）
│   例: catbus/result/nefi/huanhuan  ← 浣浣发给 Nefi 的结果
│
├── status/{source}/            # 在线状态（QoS 0, retained）
│   例: catbus/status/nefi
│
├── alert/{source}/             # 告警（QoS 1）
│   例: catbus/alert/gouzi
│
└── broadcast/                  # 全局广播（QoS 0）
    例: catbus/broadcast
```

命名规则：
- `{target}` = 消息接收方的机器名
- `{source}` = 消息发送方的机器名
- result topic 使用 `{target}/{source}` 双层路由，broker 端精准投递，避免无效广播
- 机器名固定为：`gouzi`, `nefi`, `huanhuan`, `mimi`, `xiaohei`

每台机器的 daemon 默认订阅：
```
catbus/task/{自己的名字}      # 收别人派来的任务
catbus/result/{自己的名字}/# # 只收发给自己的结果（精准路由）
catbus/status/#              # 收所有状态
catbus/alert/#               # 收所有告警
catbus/broadcast             # 收广播
```

---

## 五、消息格式（JSON Schema）

所有消息都是 JSON，统一信封格式：

```json
{
  "v": 1,
  "id": "nefi-1708425000123-a3f1",
  "ts": "2026-02-20T14:30:00Z",
  "from": "nefi",
  "to": "huanhuan",
  "type": "task",
  "payload": { ... }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `v` | int | 协议版本，当前为 1 |
| `id` | string | 消息 ID，格式 `{from}-{timestamp_ms}-{random_hex}`，如 `nefi-1708425000123-a3f1` |
| `ts` | string | ISO 8601 时间戳 |
| `from` | string | 发送方机器名 |
| `to` | string | 接收方机器名，广播时为 `"*"` |
| `type` | string | 消息类型，见下表 |
| `payload` | object | 具体内容，结构因 type 而异 |

### 消息类型

#### task — 任务派发

```json
{
  "type": "task",
  "payload": {
    "task_type": "code|deploy|script|fix|data",
    "project": "zfc-web",
    "actions": [
      {"op": "edit", "file": "src/api/auth.ts", "content": "..."},
      {"op": "create", "file": "src/api/middleware.ts", "content": "..."},
      {"op": "run", "cmd": "npm test"}
    ],
    "expect": {
      "test_pass": true
    },
    "context_refs": ["nefi-1708425000123-a3f1"],
    "max_retry": 2,
    "retry_count": 0
  }
}
```

| 新增字段 | 说明 |
|---------|------|
| `context_refs` | 前置任务 ID 数组，接收方可读取前置结果理解背景 |
| `max_retry` | 最大重试次数，默认 2（首次 + 2 次重试 = 最多 3 次执行） |
| `retry_count` | 当前已重试次数，Nefi 重派时 +1 |

#### result — 任务结果

```json
{
  "type": "result",
  "payload": {
    "ref_id": "nefi-1708425000123-a3f1",
    "status": "done|fail|partial|reassign",
    "results": [
      {"op": "edit", "ok": true, "diff_summary": "+42 -8"},
      {"op": "create", "ok": true, "lines": 67},
      {"op": "run", "ok": true, "exit_code": 0, "stdout_tail": "3/3 passed"}
    ],
    "error": null,
    "report_path": "/home/debian/catworks/reports/20260220-001.md",
    "token_used": {
      "input": 2340,
      "output": 890,
      "model": "newcli-aws/claude-opus-4-6",
      "est_cost_usd": 0.015
    }
  }
}
```

| 新增字段 | 说明 |
|---------|------|
| `status: "reassign"` | Worker 建议转派给其他机器 |
| `token_used` | 本次任务的 token 消耗，用于成本追踪 |

#### result — reassign（转派建议）

当 Worker 发现任务不适合自己时：

```json
{
  "type": "result",
  "payload": {
    "ref_id": "nefi-1708425042000-b7e2",
    "status": "reassign",
    "suggest_target": "xiaohei",
    "reason": "任务需要大量 CPU 计算，我的 v3 处理器跑不动，建议转给小黑（v6）",
    "results": []
  }
}
```

Nefi 收到 reassign 后：
1. 读取 suggest_target 和 reason
2. 判断建议是否合理
3. 合理 → 重新派发给建议的目标
4. 不合理 → 坚持原派发或调整方案

#### status — 状态心跳（retained）

```json
{
  "type": "status",
  "payload": {
    "online": true,
    "uptime_hours": 72,
    "cpu_pct": 12,
    "mem_pct": 45,
    "disk_pct": 33,
    "active_tasks": 0,
    "last_ai_session": "2026-02-20T14:00:00Z"
  }
}
```

#### alert — 告警

```json
{
  "type": "alert",
  "payload": {
    "level": "warn|error|critical",
    "message": "磁盘使用率超过 90%",
    "detail": "..."
  }
}
```

---

## 六、Daemon 实现

### 6.1 主程序 catbus_daemon.py

```python
#!/usr/bin/env python3
"""CatBus Daemon v3 — MQTT ↔ OpenClaw 桥接"""

import json
import os
import signal
import socketserver
import subprocess
import threading
import time
from pathlib import Path
from queue import Queue

import paho.mqtt.client as mqtt

# ── 配置 ──
CONFIG_PATH = os.environ.get("CATBUS_CONFIG", "/etc/catbus/config.json")

def load_config():
    with open(CONFIG_PATH) as f:
        return json.load(f)

config = load_config()

MACHINE_NAME = config["machine_name"]           # e.g. "nefi"
BROKER_HOST  = config["broker_host"]             # e.g. "ge.ovh"
BROKER_PORT  = config["broker_port"]             # 8883
BROKER_USER  = config["broker_user"]
BROKER_PASS  = config["broker_pass"]
CA_CERT      = config.get("ca_cert", "/etc/catbus/ca.crt")
SOCKET_PATH  = config.get("socket_path", "/tmp/catbus.sock")
DELIVER_TG   = config.get("deliver_telegram", False)  # 是否推送到 Telegram
LOG_DIR      = config.get("log_dir", "/var/log/catbus")
MAX_WORKERS  = config.get("max_workers", 1)             # 最大并行 AI 进程数

# ── 任务队列（防止并发 OOM） ──
task_queue = Queue()

# ── 熔断器（Daemon 层面维护，不依赖 AI） ──
fail_counter = {}       # {"huanhuan": 2}
circuit_open = set()    # 熔断中的机器名
CIRCUIT_THRESHOLD = 3
CIRCUIT_RESET_SEC = 3600  # 1 小时自动解除
circuit_open_time = {}  # {"huanhuan": timestamp}

# ── MQTT 回调 ──
def on_connect(client, userdata, flags, rc, properties=None):
    if rc == 0:
        print(f"[catbus] Connected as {MACHINE_NAME}")
        # 订阅本机相关 topic
        client.subscribe(f"catbus/task/{MACHINE_NAME}", qos=1)
        client.subscribe(f"catbus/result/{MACHINE_NAME}/#", qos=1)  # 精准路由
        client.subscribe("catbus/status/#", qos=0)
        client.subscribe("catbus/alert/#", qos=1)
        client.subscribe("catbus/broadcast", qos=0)
        # 发布上线状态
        publish_status(client)
    else:
        print(f"[catbus] Connect failed: rc={rc}")

def on_message(client, userdata, msg):
    """收到 MQTT 消息的处理"""
    try:
        data = json.loads(msg.payload.decode())
    except json.JSONDecodeError:
        print(f"[catbus] Bad JSON on {msg.topic}")
        return

    msg_type = data.get("type", "")
    msg_from = data.get("from", "unknown")

    # 不处理自己发的消息（防回环）
    if msg_from == MACHINE_NAME:
        return

    # 日志
    log_message(data, direction="recv")

    # 按类型处理
    if msg_type == "task":
        handle_task(data)
    elif msg_type == "result":
        handle_result(data)
    elif msg_type == "alert":
        handle_alert(data)
    # status 类型只存储，不唤醒 AI

def hydrate_context(data):
    """Context Hydration: 把 context_refs 引用的前置结果拼接到 payload 中"""
    refs = data.get("payload", {}).get("context_refs", [])
    if not refs:
        return data
    hydrated = []
    result_dir = Path(LOG_DIR) / "results"
    for ref_id in refs:
        ref_file = result_dir / f"{ref_id}.json"
        if ref_file.exists():
            try:
                ref_data = json.loads(ref_file.read_text())
                # 只取摘要，不超过 2KB
                summary = json.dumps(ref_data.get("payload", {}), ensure_ascii=False)[:2048]
                hydrated.append({"ref_id": ref_id, "summary": summary})
            except Exception:
                hydrated.append({"ref_id": ref_id, "summary": "(read error)"})
        else:
            hydrated.append({"ref_id": ref_id, "summary": "(not found locally)"})
    data["payload"]["_hydrated_context"] = hydrated
    return data

def handle_task(data):
    """收到任务 → Context Hydration → 入队"""
    data = hydrate_context(data)
    payload_str = json.dumps(data, ensure_ascii=False)

    cmd = [
        "openclaw", "agent",
        "--message", f"[CATBUS_TASK] {payload_str}",
    ]
    if DELIVER_TG:
        cmd.extend(["--deliver", "--reply-channel", "telegram"])

    task_queue.put((data, cmd))  # 同时入队原始 data，用于超时回传
    print(f"[catbus] Task {data['id']} from {data['from']} → queued (depth: {task_queue.qsize()})")

def handle_result(data):
    """收到结果 → 更新熔断计数 → 存储 → 唤醒 AI 审查"""
    ref_id = data.get("payload", {}).get("ref_id", "")
    status = data.get("payload", {}).get("status", "")
    source = data.get("from", "")

    # 熔断器计数（Daemon 层面维护）
    if status == "done":
        fail_counter[source] = 0
        circuit_open.discard(source)
    elif status == "fail":
        fail_counter[source] = fail_counter.get(source, 0) + 1
        if fail_counter[source] >= CIRCUIT_THRESHOLD:
            circuit_open.add(source)
            circuit_open_time[source] = time.time()
            print(f"[catbus] ⚠️ Circuit OPEN for {source} (consecutive fails: {fail_counter[source]})")
    # reassign 不计入失败

    # 存到本地结果目录
    result_dir = Path(LOG_DIR) / "results"
    result_dir.mkdir(parents=True, exist_ok=True)
    result_file = result_dir / f"{ref_id}.json"
    result_file.write_text(json.dumps(data, ensure_ascii=False, indent=2))

    # 唤醒 AI 审查结果
    cmd = [
        "openclaw", "agent",
        "--message", f"[CATBUS_RESULT] {json.dumps(data, ensure_ascii=False)}",
    ]
    if DELIVER_TG:
        cmd.extend(["--deliver", "--reply-channel", "telegram"])
    task_queue.put((data, cmd))
    print(f"[catbus] Result {ref_id} from {source} (status={status}) → queued for AI")

def handle_alert(data):
    """收到告警 → 狗子和 Nefi 都处理"""
    if MACHINE_NAME in ("gouzi", "nefi"):
        cmd = [
            "openclaw", "agent",
            "--message", f"[CATBUS_ALERT] {json.dumps(data, ensure_ascii=False)}",
        ]
        if DELIVER_TG:
            cmd.extend(["--deliver", "--reply-channel", "telegram"])
        task_queue.put((data, cmd))

# ── 超时/失败自动回传 ──
def send_fail_result(data, error_msg):
    """Daemon 层面主动回传失败结果，不依赖 AI"""
    sender = data.get("from", "")
    if not sender or sender == MACHINE_NAME:
        return
    fail_payload = {
        "v": 1,
        "id": f"{MACHINE_NAME}-{int(time.time()*1000)}-fail",
        "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "from": MACHINE_NAME,
        "to": sender,
        "type": "result",
        "payload": {
            "ref_id": data.get("id", ""),
            "status": "fail",
            "results": [],
            "error": error_msg,
            "token_used": {"input": 0, "output": 0, "model": "daemon", "est_cost_usd": 0}
        }
    }
    topic = f"catbus/result/{sender}/{MACHINE_NAME}"
    try:
        mqtt_client_ref.publish(topic, json.dumps(fail_payload, ensure_ascii=False), qos=1)
        print(f"[catbus] Sent fail result to {sender}: {error_msg}")
    except Exception as e:
        print(f"[catbus] Failed to send fail result: {e}")

# ── Worker 线程（超时回传 + 进程组 kill 防僵尸） ──
def task_worker():
    """顺序执行队列中的 AI 任务"""
    while True:
        data, cmd = task_queue.get()
        try:
            print(f"[catbus] Worker executing: {cmd[3][:80]}...")
            proc = subprocess.Popen(
                cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                preexec_fn=os.setsid  # 新进程组，超时时可 kill 整棵进程树
            )
            try:
                proc.wait(timeout=600)
                print(f"[catbus] Worker done, exit={proc.returncode}")
            except subprocess.TimeoutExpired:
                print(f"[catbus] Worker timeout, killing process group...")
                os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
                send_fail_result(data, "Task timeout after 600s")
        except Exception as e:
            print(f"[catbus] Worker error: {e}")
            send_fail_result(data, str(e))
        finally:
            task_queue.task_done()

def publish_status(client):
    """发布本机状态（retained）"""
    import shutil
    status = {
        "v": 1,
        "id": f"status-{MACHINE_NAME}",
        "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "from": MACHINE_NAME,
        "to": "*",
        "type": "status",
        "payload": {
            "online": True,
            "disk_pct": round(shutil.disk_usage("/").used / shutil.disk_usage("/").total * 100),
            "queue_depth": task_queue.qsize(),
            "circuit_open": list(circuit_open),
        }
    }
    client.publish(
        f"catbus/status/{MACHINE_NAME}",
        json.dumps(status),
        qos=0,
        retain=True
    )

# ── Unix Socket 服务（供 skill 脚本调用，线程安全） ──
class CatBusHandler(socketserver.StreamRequestHandler):
    """处理来自 skill 脚本的单次请求"""
    def handle(self):
        try:
            raw = self.request.recv(65536).decode()
            request = json.loads(raw)
            action = request.get("action")

            if action == "send":
                topic = request["topic"]
                payload = request["payload"]
                qos = request.get("qos", 1)

                # 熔断器拦截：只拦截 task 类型，result/alert 不拦截
                msg_type = payload.get("type", "")
                target = payload.get("to", "")
                if msg_type == "task" and target in circuit_open:
                    # 检查是否自动解除（超过 CIRCUIT_RESET_SEC）
                    if time.time() - circuit_open_time.get(target, 0) > CIRCUIT_RESET_SEC:
                        circuit_open.discard(target)
                        fail_counter[target] = 0
                        print(f"[catbus] Circuit auto-reset for {target}")
                    else:
                        self.request.sendall(json.dumps({
                            "ok": False,
                            "error": f"Circuit open: {target} has {fail_counter.get(target,0)} consecutive fails"
                        }).encode())
                        return

                self.server.mqtt_client.publish(topic, json.dumps(payload), qos=qos)
                self.request.sendall(b'{"ok": true}')

            elif action == "read":
                ref_id = request.get("ref_id")
                result_file = Path(LOG_DIR) / "results" / f"{ref_id}.json"
                if result_file.exists():
                    self.request.sendall(result_file.read_bytes())
                else:
                    self.request.sendall(b'{"ok": false, "error": "not found"}')

            elif action == "status":
                status_dir = Path(LOG_DIR) / "status"
                statuses = {}
                if status_dir.exists():
                    for f in status_dir.glob("*.json"):
                        statuses[f.stem] = json.loads(f.read_text())
                self.request.sendall(json.dumps(statuses).encode())

        except Exception as e:
            self.request.sendall(json.dumps({"ok": False, "error": str(e)}).encode())

def start_socket_server(mqtt_client):
    """启动线程安全的 Unix Socket 服务"""
    if os.path.exists(SOCKET_PATH):
        os.remove(SOCKET_PATH)
    server = socketserver.ThreadingUnixStreamServer(SOCKET_PATH, CatBusHandler)
    server.mqtt_client = mqtt_client
    os.chmod(SOCKET_PATH, 0o666)  # 允许普通用户的 skill 脚本访问
    threading.Thread(target=server.serve_forever, daemon=True).start()
    print(f"[catbus] Socket listening on {SOCKET_PATH}")

# ── 状态消息本地缓存 ──
def cache_status(client, userdata, msg):
    """缓存收到的 status 消息到本地"""
    try:
        data = json.loads(msg.payload.decode())
        source = data.get("from", "unknown")
        status_dir = Path(LOG_DIR) / "status"
        status_dir.mkdir(parents=True, exist_ok=True)
        (status_dir / f"{source}.json").write_text(
            json.dumps(data, ensure_ascii=False, indent=2)
        )
    except Exception:
        pass

# ── 日志 ──
def log_message(data, direction="recv"):
    log_dir = Path(LOG_DIR) / "messages"
    log_dir.mkdir(parents=True, exist_ok=True)
    log_file = log_dir / f"{time.strftime('%Y%m%d')}.jsonl"
    entry = {"direction": direction, "data": data}
    with open(log_file, "a") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")

def publish_status_offline(client):
    """发布离线状态（graceful shutdown 时调用）"""
    offline = json.loads(make_will())
    client.publish(f"catbus/status/{MACHINE_NAME}", json.dumps(offline), qos=1, retain=True)

# ── 状态心跳定时发送 ──
def heartbeat_loop(client):
    while True:
        time.sleep(300)  # 每 5 分钟
        publish_status(client)

# ── Last Will（遗嘱） ──
def make_will():
    return json.dumps({
        "v": 1,
        "id": f"will-{MACHINE_NAME}",
        "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "from": MACHINE_NAME,
        "to": "*",
        "type": "status",
        "payload": {"online": False}
    })

# ── 全局 MQTT 客户端引用（供 send_fail_result 使用） ──
mqtt_client_ref = None

# ── 主入口 ──
def main():
    global mqtt_client_ref
    Path(LOG_DIR).mkdir(parents=True, exist_ok=True)

    client = mqtt.Client(
        client_id=f"catbus-{MACHINE_NAME}",
        protocol=mqtt.MQTTv5
    )
    client.username_pw_set(BROKER_USER, BROKER_PASS)
    client.tls_set(ca_certs=CA_CERT)

    # MQTTv5 会话持久化：离线期间 broker 暂存 QoS 1 消息，上线后自动重发
    from paho.mqtt.properties import Properties
    from paho.mqtt.packettypes import PacketTypes
    connect_props = Properties(PacketTypes.CONNECT)
    connect_props.SessionExpiryInterval = 3600  # 离线 1 小时内消息不丢

    # 遗嘱
    client.will_set(
        f"catbus/status/{MACHINE_NAME}",
        make_will(),
        qos=1,
        retain=True
    )

    client.on_connect = on_connect
    client.on_message = on_message
    client.message_callback_add("catbus/status/#", cache_status)

    client.connect(BROKER_HOST, BROKER_PORT, properties=connect_props)
    mqtt_client_ref = client

    # 启动 worker 线程
    for i in range(MAX_WORKERS):
        t = threading.Thread(target=task_worker, daemon=True, name=f"worker-{i}")
        t.start()
    print(f"[catbus] {MAX_WORKERS} worker(s) started")

    # 启动 socket 服务
    start_socket_server(client)

    # 启动心跳线程
    hb_thread = threading.Thread(target=heartbeat_loop, args=(client,), daemon=True)
    hb_thread.start()

    # 阻塞运行（支持 graceful shutdown）
    import signal
    def handle_signal(sig, frame):
        print("[catbus] Shutting down gracefully...")
        # 发布离线状态
        publish_status_offline(client)
        client.disconnect()
    signal.signal(signal.SIGTERM, handle_signal)
    signal.signal(signal.SIGINT, handle_signal)

    client.loop_forever()

if __name__ == "__main__":
    main()
```

### 6.2 配置文件

```json
// /etc/catbus/config.json（每台机器不同）
{
  "machine_name": "nefi",
  "broker_host": "ge.ovh 的公网IP或域名",
  "broker_port": 8883,
  "broker_user": "nefi",
  "broker_pass": "随机强密码",
  "ca_cert": "/etc/catbus/ca.crt",
  "socket_path": "/tmp/catbus.sock",
  "deliver_telegram": true,
  "log_dir": "/var/log/catbus",
  "max_workers": 1
}
```

### 6.3 服务管理

**Linux（狗子、浣浣、咪咪、小黑）— systemd：**

```ini
# /etc/systemd/system/catbus.service
[Unit]
Description=CatBus MQTT Daemon
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
ExecStart=/usr/bin/python3 /opt/catbus/catbus_daemon.py
Restart=always
RestartSec=5
Environment=CATBUS_CONFIG=/etc/catbus/config.json
Environment="PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/root/.local/bin"

[Install]
WantedBy=multi-user.target
```

**macOS（Nefi）— launchd：**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.catbus.daemon</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/python3</string>
        <string>/opt/catbus/catbus_daemon.py</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
        <key>CATBUS_CONFIG</key>
        <string>/etc/catbus/config.json</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/var/log/catbus/daemon.log</string>
    <key>StandardErrorPath</key>
    <string>/var/log/catbus/daemon.log</string>
</dict>
</plist>
```

`install-client.sh` 自动检测 OS：Linux 用 systemd，macOS 用 launchd。

---

## 七、Skill 实现

### 7.1 SKILL.md（通用模板，每台机器根据角色定制 "你是谁" 部分）

```markdown
---
name: catbus
description: >
  通过 CatBus 消息总线与其他机器人通信。可以给其他机器人派发任务、
  读取任务结果、查看所有机器人的在线状态。
---

# CatBus — 机器人通信 Skill

## 你是谁

你是猫猫工坊的一员。通过 CatBus 消息总线，你可以与其他机器人通信。

## 通讯录

| 名字 | 机器名 | 角色 | 接什么活 | can_delegate |
|------|--------|------|---------|-------------|
| 狗子 | gouzi | 运维 SRE + Supervisor | 巡检、监控、故障修复 | ❌ |
| Nefi | nefi | 架构师 + Manager | 方案设计、任务分发、代码审查 | ✅ |
| 浣浣 | huanhuan | 编码执行者 | 写代码、部署、跑服务 | ❌ |
| 咪咪 | mimi | 存储/轻量执行 | 数据备份、日志归档、定时采集 | ❌ |
| 小黑 | xiaohei | 重型计算 | 压测、CI构建、实验 | ❌ |

## 工具

### catbus_send

给另一个机器人发消息。

参数：
- target (string): 目标机器名
- task_type (string): 任务类型 code|deploy|script|fix|data
- payload (object): 任务内容

调用方式：运行 scripts/catbus_send.py

### catbus_read

读取某个任务的结果。

参数：
- ref_id (string): 任务 ID

调用方式：运行 scripts/catbus_read.py

### catbus_status

查看所有机器人在线状态。

调用方式：运行 scripts/catbus_status.py

## 使用原则

1. 派发任务前先用 catbus_status 确认目标机器在线
2. payload 中的 actions 要具体明确，不要含糊
3. 如果任务涉及大文件（>4KB），先通过 SSH 传输文件，payload 中只放文件路径引用
4. 派发后不要阻塞等待，结果会通过 [CATBUS_RESULT] 消息回来
5. 收到 [CATBUS_TASK] 开头的消息时，解析 JSON 并执行任务，执行完用 catbus_send 发回结果
6. 前置任务的结果可以通过 context_refs 中的 ID 在 /var/log/catbus/results/ 目录查阅

## 收到任务时的处理流程

当你被唤醒且消息以 [CATBUS_TASK] 开头时：
1. 解析 JSON payload
2. 如果 payload 中有 `_hydrated_context`，直接阅读（Daemon 已自动拼接前置任务结果）
3. 按 actions 数组顺序执行每个操作
4. 收集每步的结果和 token 消耗
5. 用 catbus_send 发回 result 类型消息（含 token_used）
6. 如果执行失败，status 设为 "fail"，附带错误信息
7. 如果任务不适合自己，status 设为 "reassign"，说明原因并建议目标
8. 任何任务执行超过 10 分钟，发一次进度消息

## 收到结果时的处理流程

当你被唤醒且消息以 [CATBUS_RESULT] 开头时：
1. 解析 JSON payload
2. 检查 status：
   - "done" → 审查结果是否符合预期
   - "fail" → 分析错误原因，检查 retry_count < max_retry 则重新派发
   - "reassign" → 评估建议，决定是否转派
   - "partial" → 评估已完成部分，决定后续动作

## 反模式警告（所有机器人必须遵守）

1. **God Agent**：一个机器人试图做所有事情。
   Nefi 不动手执行，Worker 不做架构决策。

2. **Chatty Agents**：消息过于频繁或冗长。
   结果回报只发摘要（< 1KB），详细内容写文件放路径。

3. **Chain Delegation**：Worker 把任务转给另一个 Worker。
   只有 Nefi 有派发权。Worker 觉得不合适就 reassign 回 Nefi。

4. **无限重试**：任务失败后不停重试。
   max_retry 默认 2 次，连续 3 次 fail 触发熔断。**熔断由 Daemon 自动执行，AI 无需维护计数器。**
   发送时 Daemon 会拦截并返回 `{"ok": false, "error": "Circuit open: ..."}`。

5. **脱离监督**：长时间运行没有汇报。
   任何任务执行超过 10 分钟必须发一次进度消息。
```

### 7.2 Skill 脚本

#### catbus_send.py

```python
#!/usr/bin/env python3
"""CatBus Skill: 发送消息"""
import json
import os
import socket
import sys
import time

SOCKET_PATH = "/tmp/catbus.sock"

def send(target, msg_type, payload, machine_name=None):
    """通过 daemon 发送 MQTT 消息"""
    if machine_name is None:
        import os
        config_path = os.environ.get("CATBUS_CONFIG", "/etc/catbus/config.json")
        with open(config_path) as f:
            machine_name = json.load(f)["machine_name"]

    msg_id = f"{machine_name}-{int(time.time()*1000)}-{os.urandom(2).hex()}"

    envelope = {
        "v": 1,
        "id": msg_id,
        "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "from": machine_name,
        "to": target,
        "type": msg_type,
        "payload": payload
    }

    # 确定 topic
    if msg_type == "task":
        topic = f"catbus/task/{target}"
    elif msg_type == "result":
        topic = f"catbus/result/{target}/{machine_name}"  # 精准投递
    elif msg_type == "alert":
        topic = f"catbus/alert/{machine_name}"
    else:
        topic = f"catbus/broadcast"

    # 通过 Unix Socket 发给 daemon
    sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    sock.connect(SOCKET_PATH)
    request = json.dumps({"action": "send", "topic": topic, "payload": envelope})
    sock.sendall(request.encode())
    response = sock.recv(4096).decode()
    sock.close()

    result = json.loads(response)
    if result.get("ok"):
        print(json.dumps({"ok": True, "msg_id": msg_id}))
    else:
        print(json.dumps({"ok": False, "error": result.get("error")}))

    return msg_id

if __name__ == "__main__":
    # 用法: catbus_send.py <target> <type> '<payload_json>'
    target = sys.argv[1]
    msg_type = sys.argv[2]
    payload = json.loads(sys.argv[3])
    send(target, msg_type, payload)
```

#### catbus_read.py

```python
#!/usr/bin/env python3
"""CatBus Skill: 读取结果"""
import json
import socket
import sys

SOCKET_PATH = "/tmp/catbus.sock"

def read(ref_id):
    sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    sock.connect(SOCKET_PATH)
    request = json.dumps({"action": "read", "ref_id": ref_id})
    sock.sendall(request.encode())
    response = sock.recv(65536).decode()
    sock.close()
    print(response)

if __name__ == "__main__":
    read(sys.argv[1])
```

#### catbus_status.py

```python
#!/usr/bin/env python3
"""CatBus Skill: 查看在线状态"""
import json
import socket

SOCKET_PATH = "/tmp/catbus.sock"

def status():
    sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    sock.connect(SOCKET_PATH)
    request = json.dumps({"action": "status"})
    sock.sendall(request.encode())
    response = sock.recv(65536).decode()
    sock.close()

    statuses = json.loads(response)
    for name, info in statuses.items():
        online = info.get("payload", {}).get("online", False)
        icon = "🟢" if online else "🔴"
        print(f"{icon} {name}: {'online' if online else 'offline'}")

if __name__ == "__main__":
    status()
```

---

## 八、消息流示例

### 示例 1：Nefi 给浣浣派编码任务（正常流程）

```
1. 你对 Nefi 说："帮我在 zfc-web 加个 JWT 刷新"
2. Nefi 设计方案（自己做，不派发设计工作）
3. Nefi 三问判断：需要远程执行 ✓ 本地做不了 ✓ 派发更高效 ✓ → 派发
4. Nefi 调用 catbus_status → 确认浣浣在线
5. Nefi 调用 catbus_send:
   target=huanhuan, type=task, payload={task_type: "code", actions: [...]}
6. Nefi daemon → MQTT → Broker → 浣浣 daemon → 入队
7. 浣浣 worker 线程执行: openclaw agent --message "[CATBUS_TASK] {...}"
8. 浣浣 AI 被唤醒，解析任务，按 actions 顺序执行
9. 浣浣 AI 调用 catbus_send:
   target=nefi, type=result, payload={status: "done", results: [...], token_used: {...}}
10. 浣浣 daemon → MQTT catbus/result/nefi/huanhuan → Broker → Nefi daemon
11. Nefi AI 被唤醒，审查结果，确认满意
12. Nefi 通过 Telegram 告诉你："✅ JWT 刷新已部署完成"
```

### 示例 2：任务转派（reassign）

```
1. Nefi 给浣浣派了一个压测任务
2. 浣浣 AI 分析后发现需要大量 CPU，自己的 v3 跑不动
3. 浣浣回报: status=reassign, suggest_target=xiaohei,
   reason="CPU 密集型任务建议转给小黑（v6）"
4. Nefi AI 被唤醒，评估建议 → 合理
5. Nefi 重新派发给小黑（retry_count 不变，这不算失败）
6. 小黑执行 → 回报 done
```

### 示例 3：任务失败 + 熔断

```
1. Nefi 给浣浣派任务 → 浣浣回报 fail（npm test 失败）
2. Nefi 分析错误，调整方案，重新派发（retry_count: 1）
3. 浣浣再次 fail（依赖包冲突）
4. Nefi 再次调整，重新派发（retry_count: 2 = max_retry）
5. 浣浣第三次 fail
6. Nefi 触发熔断：浣浣连续 3 次 fail，暂停派发
7. Nefi 通过 Telegram 通知你：
   "⚠️ 浣浣连续 3 次任务失败，已暂停派发。最后一次错误：依赖包冲突"
8. 你排查后解决问题，告诉 Nefi 解除熔断
```

### 示例 4：狗子自主巡检

```
1. 狗子定时执行 catbus_status
2. 发现小黑 offline 超过 10 分钟
3. 狗子尝试 SSH 到小黑检查 → 连接超时
4. 狗子通过 Telegram 告警你："⚠️ 小黑离线超过 10 分钟，SSH 不可达"
5. 同时狗子在 CatBus 发 alert，Nefi 收到后自动将小黑从可派发列表移除
```

---

## 九、安全设计

| 层面 | 措施 |
|------|------|
| 传输加密 | TLS 8883，不开放 1883 明文端口 |
| 认证 | 每台机器独立用户名密码 |
| 本地通信 | Unix Socket + ThreadingUnixStreamServer，只有本机进程可访问 |
| 消息验证 | daemon 忽略 from 字段等于自己的消息（防回环） |
| 并发控制 | 任务队列 + worker 线程，MAX_WORKERS 默认 1，防 OOM |
| 任务超时 | 单个任务最长 600 秒，超时 kill 整个进程组（`os.killpg`）并回传 fail |
| 重试上限 | max_retry 默认 2，防止无限重试 |
| 熔断器 | **Daemon 层面维护**，连续 3 次 fail 自动拦截发送，1 小时自动解除或手动解除 |
| 层级权限 | 只有 Nefi 可派发，Worker 不可互派（禁止 Chain Delegation） |
| 执行限制 | AI 收到任务时走正常 OpenClaw 安全规则 |
| 会话持久化 | MQTTv5 SessionExpiryInterval=3600，离线 1 小时内消息不丢 |
| 精准路由 | result topic 双层路由，broker 端过滤，减少无效广播 |
| 日志审计 | 所有消息记录到 /var/log/catbus/messages/ |
| 成本监控 | result 消息含 token_used，狗子监控单日消耗异常 |
| Graceful Shutdown | SIGTERM/SIGINT 信号处理，优雅发布离线状态后断开 |

---

## 十、一键部署

CatBus 的部署设计目标：**两条命令搞定一切**。

### 10.1 部署流程总览

```
步骤 1：在 Broker 机器上（浣浣）执行一条命令，安装 Broker
         ↓
步骤 2：用 catbus-add 命令注册每个机器人，自动生成安装命令
         ↓
步骤 3：到每台机器上执行生成的安装命令，自动完成全部配置
         ↓
         完成 ✅
```

### 10.2 步骤 1：安装 Broker（在浣浣上）

```bash
curl -fsSL https://your-repo/catbus/install-broker.sh | bash
```

这条命令自动完成：
- 检查并安装 Docker（如未安装）
- 生成 TLS 自签证书
- 写入 Mosquitto 配置（TLS 8883，禁止匿名）
- 启动 Mosquitto Docker 容器
- 检测本机公网 IP
- 安装 `catbus-add` / `catbus-list` / `catbus-remove` 三个管理命令

安装完成后显示：
```
🚌 CatBus Broker 安装完成！

  Broker 地址: 203.0.113.50:8883
  管理命令:
    catbus-add <机器名>     添加机器人，生成安装命令
    catbus-list             列出已注册机器人
    catbus-remove <机器名>  移除机器人
```

### 10.3 步骤 2：注册机器人（在浣浣上）

```bash
catbus-add nefi
```

这条命令自动完成：
- 生成随机强密码
- 在 Broker 中创建账号
- 把 CA 证书编码为 base64
- 拼装出一条完整的客户端安装命令

执行后显示：
```
✅ 已添加机器人: nefi

在 nefi 的机器上执行以下命令即可接入：

────────────────── 复制下面这条命令 ──────────────────

curl -fsSL https://your-repo/catbus/install-client.sh | bash -s -- \
  --name nefi \
  --host 203.0.113.50 \
  --port 8883 \
  --user nefi \
  --pass aK7xM2nQ9pR4wY6z \
  --ca eyJjZXJ0Ijoi...（base64 编码的 CA 证书）

─────────────────────────────────────────────────────
```

每个机器人执行一次 `catbus-add`：
```bash
catbus-add gouzi
catbus-add nefi
catbus-add huanhuan    # 浣浣自己也要注册为客户端
catbus-add mimi
catbus-add xiaohei
```

### 10.4 步骤 3：安装客户端（在每台机器人上）

把步骤 2 生成的命令粘贴到目标机器上执行，一条命令搞定。

这条命令自动完成：
- 安装 Python 依赖（paho-mqtt）
- 解码并写入 CA 证书到 `/etc/catbus/ca.crt`
- 生成 `/etc/catbus/config.json`（含机器名、Broker 地址、账号密码）
- 下载并安装 `catbus_daemon.py`
- 下载并安装 skill 脚本（catbus_send.py / catbus_read.py / catbus_status.py）
- 创建并启动 systemd 服务
- 自动连接 Broker 并验证连通性
- 安装 OpenClaw skill 目录（自动检测 OpenClaw 安装路径）

安装完成后显示：
```
🚌 CatBus 客户端安装完成！

  机器名: nefi
  Broker: 203.0.113.50:8883
  状态: 🟢 已连接

  验证: catbus-status
  Skill 已安装到: /path/to/openclaw/skills/catbus/

  ⚠️  请编辑 SKILL.md 中的 "你是谁" 部分，写入本机角色定义。
```

### 10.5 安装后：配置角色

唯一需要手动做的事：编辑本机 SKILL.md 中的"你是谁"部分。

这一步不自动化，因为每台机器的角色需要你来决定。参见第二章各 Agent 的
role/goal/boundary 定义，复制对应内容到 SKILL.md 即可。

未来可以在 `catbus-add` 时传入角色参数，自动生成 SKILL.md：
```bash
catbus-add nefi --role manager --goal "设计技术方案并分发执行工作"
```
但当前版本先手动配置，确保你对每个角色有完全控制。

### 10.6 管理命令速查

所有管理命令都在 Broker 机器（浣浣）上执行：

| 命令 | 用途 | 示例 |
|------|------|------|
| `catbus-add <名字>` | 注册新机器人，生成安装命令 | `catbus-add xiaobai` |
| `catbus-list` | 列出已注册的机器人 | `catbus-list` |
| `catbus-remove <名字>` | 移除机器人 | `catbus-remove xiaobai` |

在任意客户端机器上可执行：

| 命令 | 用途 |
|------|------|
| `catbus-status` | 查看所有机器人在线状态 |
| `systemctl status catbus` | 查看本机 daemon 状态 |
| `journalctl -u catbus -f` | 查看本机 daemon 日志 |

### 10.7 安装脚本清单

需要开发以下脚本，托管在 Git 仓库中：

| 脚本 | 用途 | 运行位置 |
|------|------|---------|
| `install-broker.sh` | 一键安装 Broker + 管理命令 | Broker 机器 |
| `install-client.sh` | 一键安装 Daemon + Skill | 客户端机器 |
| `catbus-add` | 注册机器人，生成安装命令 | Broker 机器 |
| `catbus-list` | 列出已注册机器人 | Broker 机器 |
| `catbus-remove` | 移除机器人 | Broker 机器 |

`install-client.sh` 接受以下参数（由 `catbus-add` 自动拼装）：
- `--name` 机器名
- `--host` Broker 地址
- `--port` Broker 端口
- `--user` MQTT 用户名
- `--pass` MQTT 密码
- `--ca` CA 证书的 base64 编码

---

## 十一、未来扩展

- **ACL 权限控制**: Mosquitto 支持 per-topic ACL，限制谁能往哪个 topic 发消息
- **消息加密**: payload 层面加 AES 加密，broker 只转发密文
- **Web Dashboard**: 订阅 catbus/# 做一个实时监控面板
- **新机器接入**: `catbus-add` + 一条命令，零改动现有系统
- **非 OpenClaw AI 接入**: 任何能发 MQTT 的程序都能加入，不限于 OpenClaw
- **成本分析面板**: 基于 token_used 数据做可视化，追踪各 Worker 成本趋势
- **自适应路由**: Nefi 根据各 Worker 历史表现（成功率、响应速度、成本）动态调整派发策略
- **catbus-add 角色参数**: `catbus-add nefi --role manager` 自动生成 SKILL.md 角色定义

### EvoMap 启发（2026-02-21）

参考 [EvoMap.ai](https://evomap.ai) 的 AI Agent 能力继承机制，CatBus 可借鉴以下三点：

**1. 经验复用（Experience Reuse）**

当前问题：浣浣解决了一个 Next.js build 问题，下次狗子遇到同样问题还是从头来。

方案：任务完成后，Daemon 自动提取关键解法（trigger + solution + confidence），存到共享 topic `catbus/genes/{category}`（MQTT retained message）。其他机器人遇到类似 trigger 时先查库再动手。

```
catbus/genes/nextjs    → {"trigger":"EACCES .next/build","solution":"sudo rm -rf .next && rebuild","confidence":0.95}
catbus/genes/sqlite    → {"trigger":"readonly database","solution":"chown + chmod 666 db files","confidence":0.90}
```

轻量实现：不需要 SHA256 content-addressing，用 MQTT retained message 天然去重（同 topic 新消息覆盖旧消息）。

**2. 质量反馈（Quality Feedback）**

当前问题：任务完成后没有质量评价，不知道哪个机器人擅长什么。

方案：task_result 消息增加 `review` 字段（approve/reject/revise），由 Manager 或主人标记。累计统计各 Worker 的成功率，用于未来的自适应路由。

**3. 任务广播与自动认领（Task Broadcast）**

当前问题：Nefi 硬指派任务给特定 Worker，不确定谁最合适时效率低。

方案：新增 `catbus/tasks/open` topic，Nefi 发布任务但不指定 assignee。各 Worker 根据自身能力和负载决定是否认领（先到先得，发 claim 消息）。适合不确定谁最合适的通用任务。

### 机读记忆格式（受 Ktao Memory Supersystem 启发）

参考 [openclaw_memory_supersystem](https://github.com/ktao732084-arch/openclaw_memory_supersystem-v1.0) 的双格式设计（MD 人读 + JSONL 机读），CatBus 的经验库采用 JSON 机读格式。

**为什么需要机读：**
- Daemon 需要程序化匹配 trigger → 查找已有解法，纯 Markdown 无法精确匹配
- MQTT retained message 本身就是 JSON，天然适配
- 机器人之间共享经验需要结构化数据，不是给人看的

**经验库 Schema：**

```json
{
  "trigger": "EACCES .next/build/package.json",
  "category": "nextjs",
  "solution": "sudo rm -rf .next && npm run build",
  "confidence": 0.95,
  "source": "huanhuan",
  "created": "2026-02-21",
  "last_hit": "2026-02-21",
  "hit_count": 1
}
```

**Daemon 查询流程：**
1. 任务执行前，Daemon 订阅 `catbus/genes/#` 获取所有 retained 经验
2. 用 trigger 关键词匹配当前任务的错误信息
3. 命中则注入到 AI 的 context：`"已知解法：{solution}（置信度 {confidence}）"`
4. 未命中则正常执行，完成后提取新经验发布到对应 topic

**与 NeFi 记忆脱水的关系：**
- NeFi 的 MEMORY.md 是个人记忆（Fact/Belief + 置信度 + 衰减）
- CatBus genes 是集体记忆（跨机器人共享的解法库）
- 两者互补：NeFi 脱水时可以把通用解法同步发布到 CatBus genes
