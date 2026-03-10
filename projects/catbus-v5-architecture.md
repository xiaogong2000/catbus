# CatBus v5 — 分布式 AI Agent 协作系统

> 基于第一性原理的全新设计，不兼容 v4，不妥协
> 版本：Draft v0.5 | 日期：2026-02-23

---

## 0. 设计哲学

**三条第一性原理：**

1. **能直连就不中转** — P2P 优先，中继是 fallback
2. **同步状态而非传递消息** — 声明期望状态，系统自动收敛
3. **最少组件** — 每多一个组件就多一个故障点

**一句话定义：**

> 一个基于 Zenoh 的 P2P 网状网络，Agent 通过 Pull 模型自主领取任务，
> 用状态同步替代命令传递，用 Agent Card 实现动态服务发现。

**设计原则：**

| 原则 | 含义 |
|------|------|
| **State over Message** | 写期望状态，系统收敛；不发命令等回复 |
| **Pull over Push** | Worker 主动拉任务；不由 Manager 推送 |
| **Peer over Hub** | 直连优先；Router 只是桥梁，不是中心 |
| **Self-describing** | 节点自报能力（Agent Card）；不靠硬编码通讯录 |
| **One process** | 每个节点一个进程；不拆微服务 |

---

## 1. 节点模型

CatBus 不关心具体有几台机器、叫什么名字。只定义两种节点类型：

### 1.1 节点类型

| 类型 | 网络特征 | Zenoh 角色 | 职责 |
|------|---------|-----------|------|
| **Router Node** | 有公网 IP，稳定在线 | `router` | 中继跨网段流量 + 持久化存储 + 参与任务；其中一个 Router 担任 Arbiter（任务领取 + 超时仲裁） |
| **Peer Node** | 可能在 NAT 后 | `peer` | 连接 Router 加入网络 + 参与任务 |

**关键设计：Router 不是中心，只是桥梁。**

- 任何有公网 IP 的节点都可以是 Router
- 多个 Router 之间互联，形成骨干网
- Peer 连接任意一个 Router 即可加入全网
- Router 挂了，Peer 自动切到其他 Router
- 局域网内的 Peer 之间自动直连，不经 Router

### 1.2 网络拓扑

```
              ┌─────────────────────────────────┐
              │         公网骨干 (WAN)            │
              │                                  │
              │  ┌────────┐ ┌────────┐ ┌────────┐│
              │  │Router A│─│Router B│─│Router C││
              │  └───┬────┘ └───┬────┘ └───┬────┘│
              │      │         │         │      │
              └──────┼─────────┼─────────┼──────┘
                     │         │         │
        ┌────────────┤         │         │
        │            │         │         │
   ┌────┴────┐  ┌────┴────┐   │    ┌────┴────┐
   │ Peer D  │  │ Peer E  │   │    │ Peer F  │
   │ (NAT)   │  │ (NAT)   │   │    │ (NAT)   │
   └────┬────┘  └─────────┘   │    └─────────┘
        │                      │
        │  局域网直连           │
   ┌────┴────┐                 │
   │ Peer G  │            ┌────┴────┐
   │ (NAT)   │            │ Peer H  │
   └─────────┘            │ (公网)  │
                          └─────────┘
```

**自动行为：**
- D 和 G 在同一局域网 → mDNS scouting → 直连（微秒级延迟）
- D 到 Peer E → 经 Router A 中继（或 NAT Hole Punching 直连）
- Router A/B/C 互联 → 全网任意两点可达
- Router A 挂了 → D/E 自动通过 Router B 或 C 重连

### 1.3 节点配置

**Peer 节点：**
```json
{
  "mode": "peer",
  "connect": { "endpoints": ["tcp/router-a:7447", "tcp/router-b:7447"] },
  "scouting": { "multicast": { "enabled": true } }
}
```

**Router 节点：**
```json
{
  "mode": "router",
  "listen": { "endpoints": ["tcp/[::]:7447"] },
  "connect": { "endpoints": ["tcp/other-router:7447"] },
  "plugins": {
    "storage_manager": {
      "storages": {
        "catbus": {
          "key_expr": "catbus/**",
          "volume": { "id": "rocksdb", "dir": "/var/lib/catbus/zenoh" }
        }
      }
    }
  }
}
```

> **为什么 Router 需要 Storage 插件：** Zenoh 的 "retained" 语义依赖 Storage Backend。Router 配置 RocksDB 后，`catbus/**` 下的所有数据（Agent Card、队列任务、状态树）在 Router 重启后不丢失。Peer 节点不需要——它们从 Router 同步即可。

### 1.4 加入网络

新节点加入只需三步：

```bash
1. pip install catbus          # 安装
2. catbus init --router tcp/router-a:7447   # 生成配置
3. catbus start                # 启动，自动发布 Agent Card，开始领取任务
```

不需要改任何已有节点的配置。

---

## 2. Agent Card（动态服务发现）

每个节点启动时发布自己的 Agent Card 到 Zenoh key space。这是整个系统的"黄页"。

### 2.1 Agent Card Schema

```json
{
  "schema_version": 1,
  "name": "unique-agent-name",
  "node_type": "peer",

  "skills": ["ssh-ops", "browser", "heavy-compute", "coding", "seo"],
  "queues": ["general", "dev"],

  "resources": {
    "cpu_cores": 8,
    "memory_gb": 32,
    "gpu": false,
    "public_ip": false,
    "browser": true,
    "disk_gb": 200
  },

  "ai_provider": {
    "primary": "anthropic/claude-sonnet-4",
    "fallback": "openai/gpt-4o"
  },

  "auth": {
    "type": "hmac-sha256",
    "key_id": "a1b2c3d4"
  },

  "status": "idle",
  "load": 0.0,
  "max_concurrent": 2,
  "current_tasks": 0,
  "last_heartbeat": "2026-02-23T07:30:00Z",
  "started_at": "2026-02-23T06:00:00Z",
  "version": "5.0.0"
}
```

**设计要点：**

- `skills`：声明能力标签（与 Task 的 `required_skills` 匹配）
- `queues`：声明订阅的队列（Worker 只从这些队列 Pull）
- `resources`：硬件能力（用于智能路由，比如找有 GPU 的节点）
- `ai_provider`：当前使用的 AI 模型（不暴露 API Key，只暴露模型名）
- `status`：`idle` | `busy` | `offline`（由节点自己更新）
- `load`：0.0~1.0，`current_tasks / max_concurrent`

### 2.2 发布与发现

**Key space：**
```
catbus/cards/{name}     # 每个节点发布自己的 Card
```

**生命周期：**

```python
# 启动时发布（cached/retained，Zenoh Storage 持久化）
session.put(f"catbus/cards/{my_name}", card_json,
            congestion_control=CongestionControl.BLOCK)

# 每 30s 心跳刷新（更新 status/load/last_heartbeat）
def heartbeat_loop():
    while True:
        my_card["last_heartbeat"] = now()
        my_card["load"] = current_tasks / max_concurrent
        my_card["status"] = "busy" if current_tasks > 0 else "idle"
        session.put(f"catbus/cards/{my_name}", json.dumps(my_card))
        sleep(30)

# 下线时删除
session.delete(f"catbus/cards/{my_name}")
```

**发现 & 智能路由：**

```python
# 查询所有在线 Agent
cards = [json.loads(r.payload) for r in session.get("catbus/cards/*")]

# 找一个有浏览器能力、当前空闲的节点
candidates = [c for c in cards
              if "browser" in c["skills"]
              and c["status"] == "idle"]
best = min(candidates, key=lambda c: c["load"])

# 判断节点是否存活（心跳超过 90s 视为离线）
alive = [c for c in cards
         if (now() - c["last_heartbeat"]).seconds < 90]
```

> **关于 TTL：** Zenoh Storage 本身不支持 key 级 TTL 自动过期。存活判断通过 `last_heartbeat` 字段在应用层实现，而不是依赖基础设施。节点正常下线时主动 `delete` Card；异常崩溃时，其他节点通过心跳超时判断其离线。

---

## 3. Task Queue（Pull 模型）

### 3.1 Key Space

```
catbus/queue/{queue_name}/{task_id}     # 任务（retained）
catbus/results/{task_id}                # 结果（retained）
```

预定义队列（可自由扩展）：
- `general` — 通用任务，所有节点可领取
- `sre` — 运维任务
- `heavy` — 重型计算（GPU/大内存）
- `dev` — 开发编码任务

### 3.2 Task Schema

```json
{
  "id": "a1b2c3d4",
  "submitted_by": "agent-name",
  "submitted_at": "2026-02-23T07:30:00Z",
  "queue": "sre",
  "priority": 5,
  "ttl_seconds": 3600,
  "fan_out": 1,

  "instruction": "修复目标节点的 gateway 配置",
  "required_skills": ["ssh-ops"],
  "context": {
    "target": "some-node",
    "issue": "missing remote.token"
  },

  "state": "submitted",
  "claimed_by": null,
  "claimed_at": null,
  "progress": null,
  "completed_at": null,
  "error": null
}
```

**字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | UUID，全局唯一 |
| `submitted_by` | string | 提交者的 Agent name |
| `queue` | string | 目标队列 |
| `priority` | int | 1-10，10 最高（默认 5） |
| `ttl_seconds` | int | 任务在队列中的最大存活时间 |
| `fan_out` | int | 需要几个 Worker 同时执行（默认 1） |
| `instruction` | string | 自然语言任务描述（给 AI 看的） |
| `required_skills` | string[] | 需要的能力标签（与 Agent Card skills 匹配） |
| `context` | object | 任意上下文数据 |
| `state` | string | 当前状态（见状态机） |
| `progress` | object | `{"percent": 35, "message": "分析中..."}` |

### 3.3 Task 状态机

```
                    ┌──── timeout ────┐
                    ▼                 │
submitted ──► claimed ──► working ──►┤
                                     ├──► completed
                                     ├──► failed
                                     └──► canceled
```

| 状态 | 含义 | 写入者 | 下一步 |
|------|------|--------|--------|
| `submitted` | 在队列中等待领取 | 提交者 | → claimed / canceled / timeout |
| `claimed` | 被 Worker 锁定，准备执行 | Worker（CAS） | → working / timeout |
| `working` | 正在执行 | Worker | → completed / failed / canceled |
| `completed` | 成功完成，result 已写入 | Worker | 终态 |
| `failed` | 执行失败，error 已写入 | Worker | 终态 |
| `canceled` | 被取消 | 提交者或 Worker | 终态 |

**timeout 处理：**
- `claimed` 超过 60s 未变为 `working` → 回到 `submitted`（Worker 可能领取后崩溃了）
- `working` 超过 `ttl_seconds` 未完成 → 标记 `failed`（error: "timeout"）
- `submitted` 超过 `ttl_seconds` 无人领取 → 标记 `failed`（error: "no worker available"）

**Timeout Sweep 的分片执行：**

所有节点都跑 sweep loop，按 `task_id` hash 分片发现超时任务。但状态变更统一走 Arbiter 仲裁（避免 hash 重分配时多节点并发写入产生重复事件）：

```python
def timeout_sweep_loop():
    while True:
        alive_nodes = get_alive_nodes()
        my_index = sorted(alive_nodes).index(my_name)
        total = len(alive_nodes)
        
        all_tasks = session.get("catbus/queue/**")
        for r in all_tasks:
            task = json.loads(r.payload)
            
            # 分片：只检查 hash 到自己的任务
            if hash(task["id"]) % total != my_index:
                continue
            
            action = check_timeout(task)
            if action:
                # 状态变更走 Arbiter（原子性，避免多节点并发写入）
                request_timeout_action(task, action)
        
        sleep(60)


def check_timeout(task):
    """检测任务是否超时，返回需要的动作"""
    if task["state"] == "claimed":
        age = (now() - parse_time(task["claimed_at"])).total_seconds()
        if age > 60:
            return "reclaim"  # claimed 太久没开始工作
    
    elif task["state"] == "working":
        age = (now() - parse_time(task["claimed_at"])).total_seconds()
        if age > task["ttl_seconds"]:
            return "timeout_fail"  # 执行超时
    
    elif task["state"] == "submitted":
        age = (now() - parse_time(task["submitted_at"])).total_seconds()
        if age > task["ttl_seconds"]:
            return "no_worker_fail"  # 无人领取超时
    
    elif task["state"] in ("completed", "failed", "canceled"):
        if task.get("completed_at"):
            age = (now() - parse_time(task["completed_at"])).total_seconds()
            if age > GC_MAX_AGE:
                return "gc"  # 过期，需要清理
    
    return None


def request_timeout_action(task, action):
    """通过 Arbiter 执行超时处理（如果 Arbiter 不可达，本地执行）"""
    reply = session.get(
        f"catbus/timeout/{task['id']}?action={action}&requester={my_name}",
        timeout=5.0
    )
    if not reply:
        # Arbiter 不可达，本地直接执行（幂等操作，重复执行无害）
        execute_timeout_action_local(task, action)
```

**Arbiter 端增加 Timeout Queryable：**

```python
@session.declare_queryable("catbus/timeout/*")
def handle_timeout(query):
    """原子性超时处理 — 防止多节点重复触发"""
    task_id = query.key_expr.split("/")[-1]
    action = query.parameters.get("action")
    
    with claim_lock:  # 复用同一把锁
        results = session.get(f"catbus/queue/*/{task_id}")
        if not results:
            query.reply(json.dumps({"ok": False, "reason": "task not found"}))
            return
        
        task = json.loads(results[0].payload)
        task_key = f"catbus/queue/{task['queue']}/{task_id}"
        
        if action == "reclaim" and task["state"] == "claimed":
            task["state"] = "submitted"
            task["claimed_by"] = None
            task["claimed_at"] = None
            session.put(task_key, json.dumps(task))
            emit_event("task.reclaimed", {"task_id": task_id, "reason": "claim_timeout"})
        
        elif action == "timeout_fail" and task["state"] == "working":
            task["state"] = "failed"
            task["error"] = "execution timeout"
            task["completed_at"] = now_iso()
            session.put(task_key, json.dumps(task))
            emit_event("task.failed", {"task_id": task_id, "error": "timeout"})
        
        elif action == "no_worker_fail" and task["state"] == "submitted":
            task["state"] = "failed"
            task["error"] = "no worker available"
            task["completed_at"] = now_iso()
            session.put(task_key, json.dumps(task))
            emit_event("task.failed", {"task_id": task_id, "error": "no_worker"})
        
        elif action == "gc" and task["state"] in ("completed", "failed", "canceled"):
            session.delete(task_key)
            session.delete(f"catbus/results/{task_id}")
            emit_event("task.gc", {"task_id": task_id})
        
        # else: 状态已变更（其他节点先处理了），跳过
        
        query.reply(json.dumps({"ok": True}))
```

> **为什么 hash 分片 + Arbiter 双保险：**
> - Hash 分片减少 Arbiter 请求量（5 个节点只有 1 个会发请求）
> - Arbiter 的 `with claim_lock` + 状态前置检查保证幂等（即使 hash 重分配导致两个节点同时发请求，只有第一个生效）
> - Arbiter 不可达时，本地直接执行——超时操作本身是幂等的，重复执行最多多一条日志

### 3.4 Pull 机制

**提交任务（任何节点都可以）：**

```python
def submit(queue, instruction, context=None, 
           required_skills=None, priority=5, fan_out=1):
    group_id = uuid() if fan_out > 1 else None
    
    for i in range(fan_out):
        task = {
            "id": uuid(),
            "submitted_by": my_name,
            "submitted_at": now_iso(),
            "queue": queue,
            "priority": priority,
            "ttl_seconds": 3600,
            "fan_out": fan_out,
            "group_id": group_id,
            "group_index": i if fan_out > 1 else None,
            "instruction": instruction,
            "required_skills": required_skills or [],
            "context": context or {},
            "state": "submitted"
        }
        session.put(f"catbus/queue/{queue}/{task['id']}", json.dumps(task))
```

**Worker Pull Loop：**

```python
def worker_loop():
    # 1. 订阅新任务通知（实时响应）
    for q in my_card["queues"]:
        session.declare_subscriber(f"catbus/queue/{q}/*", on_new_task)
    
    # 2. 定期轮询已有任务（处理积压 + 补漏）
    while True:
        if current_tasks >= max_concurrent:
            sleep(POLL_INTERVAL)
            continue
        
        for q in my_card["queues"]:
            tasks = query_sorted(f"catbus/queue/{q}/*")
            for task in tasks:
                if not skills_match(task, my_card):
                    continue
                if try_claim(task):
                    execute(task)
                    break  # 领到一个就跳出，下轮再领
        
        sleep(POLL_INTERVAL)  # 默认 5s


def query_sorted(key_expr):
    """查询队列中的任务，按 priority DESC, submitted_at ASC 排序"""
    results = session.get(key_expr)
    tasks = [json.loads(r.payload) for r in results]
    tasks = [t for t in tasks if t["state"] == "submitted"]
    tasks.sort(key=lambda t: (-t["priority"], t["submitted_at"]))
    return tasks
```

### 3.5 任务领取 — Router 仲裁

Zenoh 的 `put` 是 last-writer-wins，没有原生 CAS。用 Zenoh Queryable 在 Router 上实现轻量仲裁服务。

**⚠️ 关键约束：全网只有一个 Claim Arbiter。**

多 Router 骨干网中，如果每个 Router 都注册 `catbus/claim/*` Queryable，Zenoh 会把不同 Worker 的请求路由到不同 Router，各自的本地锁互相隔离 → 两人同时抢单成功（脑裂）。因此：

- 全网可以有多个 Router 负责中继和 Storage
- **只有一个 Router 开启 Claim Arbiter**（配置项 `claim_arbiter: true`）
- Arbiter 挂了 → 全网降级走字典序仲裁 fallback（见下方）

```json
// 浣浣 Router 配置（唯一的 Arbiter）
{
  "mode": "router",
  "listen": { "endpoints": ["tcp/[::]:7447"] },
  "catbus": { "claim_arbiter": true }
}

// 其他 Router 配置（仅中继 + 存储）
{
  "mode": "router",
  "listen": { "endpoints": ["tcp/[::]:7447"] },
  "catbus": { "claim_arbiter": false }
}
```

**Arbiter 端（单点，本地锁保证原子性）：**

```python
import threading

claim_lock = threading.Lock()

@session.declare_queryable("catbus/claim/*")
def handle_claim(query):
    """原子性任务领取仲裁 — 全网只有一个实例"""
    task_id = query.key_expr.split("/")[-1]
    worker = query.parameters.get("worker")
    
    with claim_lock:
        results = session.get(f"catbus/queue/*/{task_id}")
        if not results:
            query.reply(json.dumps({"ok": False, "reason": "task not found"}))
            return
        
        task = json.loads(results[0].payload)
        
        if task["state"] != "submitted":
            query.reply(json.dumps({
                "ok": False, 
                "reason": f"already {task['state']} by {task.get('claimed_by')}"
            }))
            return
        
        task["state"] = "claimed"
        task["claimed_by"] = worker
        task["claimed_at"] = now_iso()
        session.put(f"catbus/queue/{task['queue']}/{task_id}", json.dumps(task))
        
        query.reply(json.dumps({"ok": True, "task": task}))
```

**Worker 端：**

```python
def try_claim(task):
    """通过 Arbiter 领取任务，不可达时降级为字典序仲裁"""
    replies = session.get(
        f"catbus/claim/{task['id']}?worker={my_name}",
        timeout=5.0
    )
    
    if replies:
        result = json.loads(replies[0].payload)
        return result["ok"]
    
    # Arbiter 不可达，降级
    log.warn("Claim Arbiter unreachable, falling back to lexicographic tiebreak")
    return try_claim_fallback(task)


def try_claim_fallback(task):
    """降级方案：字典序仲裁（确定性，不依赖时钟，不会无限循环）"""
    task_key = f"catbus/queue/{task['queue']}/{task['id']}"
    latest = read_task(task_key)
    if not latest or latest["state"] != "submitted":
        return False
    
    latest["state"] = "claimed"
    latest["claimed_by"] = my_name
    latest["claimed_at"] = now_iso()
    session.put(task_key, json.dumps(latest))
    
    sleep(0.5)  # 等待传播
    verify = read_task(task_key)
    
    if verify["claimed_by"] == my_name:
        return True
    # 冲突：name 字典序小的赢
    if my_name < verify["claimed_by"]:
        session.put(task_key, json.dumps(latest))
        return True
    return False  # 对方赢，让步
```

### 3.6 任务执行

```python
def execute(task):
    """执行任务的完整流程"""
    task_key = f"catbus/queue/{task['queue']}/{task['id']}"
    
    # 1. 更新状态为 working
    task["state"] = "working"
    task["progress"] = {"percent": 0, "message": "开始执行"}
    session.put(task_key, json.dumps(task))
    current_tasks += 1
    refresh_card()
    
    # 2. 查找经验库
    gene = lookup_gene(task["instruction"], task.get("context", {}))
    if gene:
        task["context"]["known_solution"] = gene["solution"]
    
    # 3. 交给 AI 执行
    try:
        result = call_ai(
            instruction=task["instruction"],
            context=task["context"],
            on_progress=lambda p, m: update_progress(task, p, m)
        )
        
        # 4. 写入结果
        session.put(f"catbus/results/{task['id']}", json.dumps({
            "task_id": task["id"],
            "completed_by": my_name,
            "completed_at": now_iso(),
            "summary": result["summary"],
            "output": result.get("output"),
            "artifacts": result.get("artifacts", []),
            "token_used": result.get("token_used", 0)
        }))
        
        # 5. 更新任务状态为 completed
        task["state"] = "completed"
        task["completed_at"] = now_iso()
        session.put(task_key, json.dumps(task))
        
        # 6. 保存经验
        maybe_save_gene(task, result)
        
    except Exception as e:
        task["state"] = "failed"
        task["error"] = str(e)
        task["completed_at"] = now_iso()
        session.put(task_key, json.dumps(task))
    
    finally:
        current_tasks -= 1
        refresh_card()


def update_progress(task, percent, message):
    """实时更新进度（其他节点可以订阅看到）"""
    task_key = f"catbus/queue/{task['queue']}/{task['id']}"
    task["progress"] = {"percent": percent, "message": message}
    session.put(task_key, json.dumps(task))
```

### 3.7 Fan-out（扇出并行）

```python
# 提交 3 份相同任务到 heavy 队列
group_id, task_ids = submit(queue="heavy", instruction="跑 benchmark", fan_out=3)
# → 生成 3 个 task（共享 group_id），3 个空闲 Worker 各领一份

# 等待 fan-out 全部完成（subscriber 模式，精确监听）
def wait_fan_out(task_ids, timeout=600):
    """监听特定 task_id 的结果，不做全量扫描"""
    results = {}
    done = threading.Event()
    
    def on_result(sample):
        result = json.loads(sample.payload)
        results[result["task_id"]] = result
        if len(results) >= len(task_ids):
            done.set()
    
    # 只订阅自己关心的 task_id，O(fan_out) 不是 O(全部结果)
    subs = []
    for tid in task_ids:
        subs.append(session.declare_subscriber(f"catbus/results/{tid}", on_result))
    
    # 也检查已经完成的（提交时可能已经有结果了）
    for tid in task_ids:
        existing = session.get(f"catbus/results/{tid}")
        if existing:
            on_result(existing[0])
    
    done.wait(timeout=timeout)
    
    for s in subs:
        s.undeclare()
    
    return list(results.values())
```

### 3.8 为什么 Pull 解决了信任问题

```
v4 的问题：
  NeFi 发指令给狗子 → 狗子的 AI 认为是"外部不可信指令" → 拒绝/变形

v5 的解法：
  任务在队列里 → 狗子主动领取 → 通过本地 AI session 执行 → 天然信任
  类比：不是老板把活硬塞给你，是你自己从任务板上拿的
```

---

## 4. State Sync（状态同步）

### 4.1 核心思想

**不发命令，改状态。系统自动收敛。**

```
传统方式：
  A 节点 → "B 节点，把 OpenClaw 升级到 v2.0"
  （需要：发送、确认、执行、汇报，任何一步可能失败）

状态同步方式：
  A 节点写入：desired/node-b/openclaw_version = "v2.0"
  B 节点发现 drift → 自动执行升级 → 更新 actual → drift 消失
  （全程无需 A 在线，B 断网重连后自动收敛）
```

这和 Kubernetes 的 controller 模型一样：声明期望状态，reconciler 负责收敛。

### 4.2 状态树

```
catbus/state/
├── desired/                    # 期望状态（声明式，任何 admin 可写）
│   ├── {node}/                 # 某个节点的期望状态
│   │   ├── openclaw_version    # "v2.0"
│   │   ├── catbus_version      # "v5.0.0"
│   │   ├── services/{name}     # "running" | "stopped"
│   │   └── config/{key}        # 任意配置项
│   └── global/                 # 全局期望状态
│       ├── primary_model       # "anthropic/claude-sonnet-4"
│       ├── alert_channel       # "telegram"
│       └── log_level           # "info"
│
├── actual/                     # 实际状态（各节点自己上报）
│   └── {node}/
│       ├── openclaw_version    # "v1.9"
│       ├── catbus_version      # "v5.0.0"
│       ├── cpu_pct             # 23.5
│       ├── mem_pct             # 61.2
│       ├── disk_pct            # 45.0
│       ├── uptime_seconds      # 86400
│       └── services/{name}     # "running" | "stopped" | "crashed"
│
└── drift/                      # 漂移记录（自动生成）
    └── {node}/
        └── {key}               # {"desired": "v2.0", "actual": "v1.9", "since": "..."}
```

### 4.3 Actual 上报（Diff-based）

每个节点只上报**发生变化**的状态，减少 90%+ 的无效写入：

```python
_last_reported = {}  # 内存缓存上次上报的值
_last_full_sync = 0  # 上次全量同步时间

def report_actual_loop():
    global _last_full_sync
    while True:
        actual = collect_actual_state()
        force_full = (time.time() - _last_full_sync) > 300  # 每 5 分钟全量
        
        for key, value in actual.items():
            if force_full or _last_reported.get(key) != value:
                session.put(f"catbus/state/actual/{my_name}/{key}", 
                           json.dumps(value))
                _last_reported[key] = value
        
        if force_full:
            _last_full_sync = time.time()
        
        sleep(30)

def collect_actual_state():
    return {
        "openclaw_version": get_openclaw_version(),
        "catbus_version": CATBUS_VERSION,
        "cpu_pct": psutil.cpu_percent(),
        "mem_pct": psutil.virtual_memory().percent,
        "disk_pct": psutil.disk_usage('/').percent,
        "uptime_seconds": time.time() - STARTED_AT,
        # ... 其他指标
    }
```

> **为什么 Diff + 定期全量：** Diff 过滤掉大部分无变化写入（CPU/磁盘大多数时间稳定）。每 5 分钟全量确保新节点或 Storage 重启后拿到完整状态。进程重启后 `_last_reported` 清空 → 自动触发一次全量。

### 4.4 Drift 检测与自愈

每个节点持续运行 reconciliation loop：

```python
def reconcile_loop():
    while True:
        # 读取跟自己相关的 desired 状态
        desired = get_all(f"catbus/state/desired/{my_name}/*")
        actual = get_all(f"catbus/state/actual/{my_name}/*")
        # 也读取 global desired
        global_desired = get_all("catbus/state/desired/global/*")
        
        for key, desired_val in {**global_desired, **desired}.items():
            actual_val = actual.get(key)
            
            if desired_val == actual_val:
                # 一致，清除 drift（如果有的话）
                session.delete(f"catbus/state/drift/{my_name}/{key}")
                continue
            
            # 发现漂移
            session.put(f"catbus/state/drift/{my_name}/{key}", json.dumps({
                "desired": desired_val,
                "actual": actual_val,
                "since": now_iso()
            }))
            
            # 尝试自愈
            if can_self_heal(key):
                try:
                    self_heal(key, desired_val)
                    # 自愈成功，actual 会在下一个上报周期更新
                except Exception as e:
                    log.error(f"Self-heal failed for {key}: {e}")
                    # 自己修不了，提交任务到队列让别人帮忙
                    submit(
                        queue="sre",
                        instruction=f"修复 {my_name} 的 {key} 漂移: "
                                   f"期望 {desired_val}，实际 {actual_val}",
                        context={
                            "node": my_name,
                            "key": key,
                            "desired": desired_val,
                            "actual": actual_val
                        }
                    )
        
        sleep(30)


def can_self_heal(key):
    """判断某个 drift 是否能本地自愈"""
    healable = {
        "openclaw_version": heal_openclaw_version,
        "catbus_version": heal_catbus_version,
        "services/*": heal_service,
    }
    return any(key == k or fnmatch(key, k) for k in healable)
```

### 4.5 断网容错

```
时间线：
  T0: 全网正常，状态一致
  T1: Peer D 断网
  T2: Admin 写入 desired/peer-d/openclaw_version = "v2.0"
  T3: 状态同步到所有在线节点，Peer D 收不到
  T4: Peer D 重新上线
  T5: Zenoh Storage 自动同步最新 desired 到 Peer D
  T6: Peer D 的 reconcile loop 发现 drift
  T7: Peer D 自动执行升级
  T8: actual 更新，drift 清除，状态收敛

全程无需人工干预。
```

---

## 5. Gene Store（经验库）

AI Agent 执行任务时积累的经验，供全网共享复用。

### 5.1 Key Space

```
catbus/genes/{category}/{gene_id}    # 经验条目（retained）
```

### 5.2 Gene Schema

```json
{
  "id": "nextjs-eacces-build",
  "category": "nextjs",
  "trigger_pattern": {
    "keywords": ["EACCES", ".next", "permission denied"],
    "min_match": 2
  },
  "solution": "sudo rm -rf .next && npm run build",
  "confidence": 0.95,
  "source": "some-agent",
  "created_at": "2026-02-23T07:30:00Z",
  "hit_count": 12,
  "last_used": "2026-02-22T15:00:00Z"
}
```

### 5.3 使用流程

```python
def lookup_gene(instruction, context=None):
    """从经验库查找匹配的已知解决方案"""
    text = f"{instruction} {json.dumps(context or {})}"
    genes = [json.loads(r.payload) for r in session.get("catbus/genes/**")]
    
    for gene in genes:
        pattern = gene["trigger_pattern"]
        matched = sum(1 for kw in pattern["keywords"] if kw.lower() in text.lower())
        if matched >= pattern["min_match"] and gene["confidence"] >= 0.3:
            # 命中，增加 hit_count
            gene["hit_count"] += 1
            gene["last_used"] = now_iso()
            session.put(f"catbus/genes/{gene['category']}/{gene['id']}", 
                       json.dumps(gene))
            return gene
    
    return None


def maybe_save_gene(task, result):
    """任务完成后，判断是否值得保存为经验"""
    if result.get("is_novel_solution"):
        gene = {
            "id": f"{task['queue']}-{short_uuid()}",
            "category": task["queue"],
            "trigger_pattern": {
                "keywords": extract_keywords(task["instruction"]),
                "min_match": 2
            },
            "solution": result["summary"],
            "confidence": 0.7,  # 初始信心
            "source": my_name,
            "created_at": now_iso(),
            "hit_count": 1,
            "last_used": now_iso()
        }
        session.put(f"catbus/genes/{gene['category']}/{gene['id']}", 
                   json.dumps(gene))
```

### 5.4 信心衰减

```python
def decay_gene(gene, success):
    """任务使用了 gene 后，根据结果更新信心"""
    if success:
        gene["confidence"] = min(1.0, gene["confidence"] * 1.05)  # 成功微增
    else:
        # 加权衰减：命中越多次的经验，单次失败的惩罚越小
        penalty = 0.3 / math.sqrt(gene["hit_count"])
        gene["confidence"] *= (1 - penalty)
    
    if gene["confidence"] < 0.2:
        # 信心太低，淘汰
        session.delete(f"catbus/genes/{gene['category']}/{gene['id']}")
    else:
        session.put(f"catbus/genes/{gene['category']}/{gene['id']}", 
                   json.dumps(gene))
```

---

## 6. 可观测性

### 6.1 事件流

所有状态变更自动发布到事件 topic（非持久化，纯实时流）：

```
catbus/events/{event_type}      # 实时事件流
```

```python
# Daemon 内部，每次状态变更时发布事件
def emit_event(event_type, data):
    event = {
        "type": event_type,
        "source": my_name,
        "ts": now_iso(),
        **data
    }
    session.put(f"catbus/events/{event_type}", json.dumps(event))

# 事件类型
emit_event("task.submitted", {"task_id": "xxx", "queue": "general"})
emit_event("task.claimed",   {"task_id": "xxx", "claimed_by": "agent-a"})
emit_event("task.completed", {"task_id": "xxx", "token_used": 1500})
emit_event("task.failed",    {"task_id": "xxx", "error": "timeout"})
emit_event("drift.detected", {"node": "agent-b", "key": "openclaw_version"})
emit_event("drift.resolved", {"node": "agent-b", "key": "openclaw_version"})
emit_event("agent.online",   {"name": "agent-c"})
emit_event("agent.offline",  {"name": "agent-c", "reason": "heartbeat_timeout"})
```

### 6.2 本地日志

每个节点将事件写入本地 JSONL 文件（按天轮转）：

```
/var/log/catbus/events-2026-02-23.jsonl
```

### 6.3 告警

通知系统是一个特殊的 subscriber，监听 `catbus/events/*` 并过滤需要告警的事件：

```python
# 告警规则（可配置）
ALERT_RULES = [
    {"match": "agent.offline",    "notify": "telegram", "message": "⚠️ {name} 已离线"},
    {"match": "task.failed",      "notify": "telegram", "message": "❌ 任务失败: {error}"},
    {"match": "drift.detected",   "notify": "telegram", "message": "🔀 {node}/{key} 漂移"},
    {"match": "task.submitted",   "when": lambda e: queue_age(e) > 600,
     "notify": "telegram",        "message": "⏰ 任务排队超过 10 分钟"},
]
```

告警 subscriber 可以运行在任意节点上。建议运行在 Router 节点（最稳定在线）。

---

## 7. 安全模型

### 7.1 传输安全

```
Zenoh 原生支持：
  - TLS（TCP 上）
  - QUIC（自带加密）
  - mTLS（双向证书认证）

推荐配置：
  - Router 节点：开启 TLS listener + 持有证书
  - Peer 节点：连接时自动协商 TLS
  - 局域网内 Peer 直连：可选明文（同一内网，信任网络）
```

### 7.2 应用层认证 — HMAC 签名

**⚠️ 绝对不在 Payload 中传递明文 Token。** Pub/Sub 网络中，任何订阅者都能看到 JSON payload，明文 token 等于裸奔（重放攻击）。

**方案：HMAC 签名 + 时间戳窗口。**

每个节点本地持有 secret（不传输），Agent Card 中只存 `key_id`（用于查找对应的验证密钥）。

**提交任务时签名：**

```python
import hmac, hashlib

def sign_task(task, my_secret):
    """用本地 secret 对任务签名（secret 绝不离开本机）"""
    message = f"{task['id']}:{task['submitted_at']}"
    task["signature"] = hmac.new(
        my_secret.encode(), message.encode(), hashlib.sha256
    ).hexdigest()
    return task
```

**验证签名：**

```python
def verify_task(task):
    """验证任务签名合法性"""
    submitter = task["submitted_by"]
    shared_secret = load_shared_secret(submitter)  # 从本地密钥表查
    if not shared_secret:
        return False
    
    # 1. 验证签名
    expected = hmac.new(
        shared_secret.encode(),
        f"{task['id']}:{task['submitted_at']}".encode(),
        hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(task.get("signature", ""), expected):
        return False
    
    # 2. 时间戳窗口：拒绝超过 5 分钟的签名（防重放）
    if abs((now() - parse_time(task["submitted_at"])).total_seconds()) > 300:
        return False
    
    return True
```

**密钥管理：**

```
每个节点本地:
  /etc/catbus/secret        → 自己的 secret（随机 64 字符）
  /etc/catbus/secrets.json  → 预共享密钥表（部署时一次性分发）
    { "agent-a": "a-secret", "agent-b": "b-secret", ... }

Agent Card 中（公开，仅用于身份识别）:
  "auth": { "type": "hmac-sha256", "key_id": "first-8-of-sha256" }
```

> **为什么不用非对称加密：** 5~20 个节点规模，预共享对称密钥足够简单。未来扩展可升级为 Ed25519（Card 中存公钥，签名用私钥）。

### 7.3 权限模型

```
角色        | 提交任务 | 领取任务 | 写 desired | 写 actual（自己）| 写 genes
------------|---------|---------|-----------|----------------|----------
admin       | 所有队列 | 所有队列 | 全局+节点  | ✅             | ✅
worker      | general | 自己订阅的| 自己节点   | ✅             | ✅
monitor     | ❌      | ❌      | ❌        | ✅             | ❌
```

角色通过 Agent Card 的 `role` 字段声明，通过 HMAC 签名验证。

---

## 8. 系统架构总览

### 8.1 节点内部架构

```
┌────────────────────────────────────────────────────────┐
│                   CatBus v5 Node                       │
│                                                        │
│  ┌────────────────┐  ┌─────────────────────────────┐  │
│  │ Agent Card     │  │ Task Worker                  │  │
│  │ publish +      │  │ subscribe + poll → claim →   │  │
│  │ heartbeat loop │  │ execute → report result      │  │
│  └────────────────┘  └─────────────────────────────┘  │
│                                                        │
│  ┌────────────────────────────────────────────────┐   │
│  │ State Sync                                      │   │
│  │ report actual → detect drift → self-heal/submit │   │
│  └────────────────────────────────────────────────┘   │
│                                                        │
│  ┌──────────────────┐  ┌──────────────────────────┐   │
│  │ Gene Cache       │  │ Event Emitter            │   │
│  │ lookup + save    │  │ log + alert              │   │
│  └──────────────────┘  └──────────────────────────┘   │
│                                                        │
│  ┌────────────────────────────────────────────────┐   │
│  │ Claim + Timeout Arbitration (仅 Arbiter Router)  │   │
│  │ Zenoh Queryable + 本地锁 → 原子任务领取/超时处理  │   │
│  └────────────────────────────────────────────────┘   │
│                                                        │
│  ┌────────────────────────────────────────────────┐   │
│  │ Zenoh Runtime (嵌入式)                          │   │
│  │ P2P mesh + discovery + NAT traversal + storage  │   │
│  └────────────────────────────────────────────────┘   │
│                                                        │
│  ┌────────────────────────────────────────────────┐   │
│  │ AI Executor                                     │   │
│  │ call_ai() → provider SDK → parse result         │   │
│  └────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────┘
```

**一个进程，七个并发循环：**

| 循环 | 周期 | 职责 | 运行在 |
|------|------|------|--------|
| Heartbeat | 30s | 刷新 Agent Card | 所有节点 |
| Worker Poll | 5s | 查询队列 + 领取任务 | 所有节点 |
| Actual Report | 30s | 上报实际状态 | 所有节点 |
| Reconcile | 30s | 检测 drift + 自愈 | 所有节点 |
| Timeout Sweep + GC | 60s | 清理超时任务 + 回收过期数据（hash 分片） | 所有节点 |
| Event Listener | 实时 | 告警 + 日志 | 所有节点（告警建议仅 Router） |
| Claim + Timeout Arbitration | 实时 | Queryable 仲裁任务领取 + 超时处理 | 仅 Arbiter Router |

### 8.2 完整 Key Space

```
catbus/
├── cards/{name}                        # Agent Card（retained）
├── queue/{queue_name}/{task_id}        # 任务队列（retained）
├── results/{task_id}                   # 任务结果（retained）
├── state/
│   ├── desired/{node|global}/{key}     # 期望状态（retained）
│   ├── actual/{node}/{key}             # 实际状态（retained）
│   └── drift/{node}/{key}             # 漂移记录（retained）
├── genes/{category}/{gene_id}          # 经验库（retained）
└── events/{event_type}                 # 实时事件流（不持久化）
```

---

## 9. SKILL.md（给 AI Agent 看的说明）

每个节点的 AI Agent 只需要知道极少的信息：

```markdown
# CatBus — 你的协作能力

## 你是谁
你是 {machine_name}，一个 CatBus 网络中的 AI Agent。

## 你收到的任务来自哪里
你的 Daemon 从任务队列中为你领取了这个任务。
任务是你自愿领取的，不是别人强制派给你的。

## 完成任务后
1. 执行任务中描述的工作
2. 调用 catbus_result 回报结果
3. 发 Telegram 通知主人

## 你的工具
catbus result <task_id> '{"summary":"一句话总结", "output":"详细结果"}'
catbus submit --queue <q> --instruction '任务描述'    # 你也可以提交子任务
catbus cards                                          # 查看谁在线
catbus drift                                          # 查看状态漂移

## 重要
- 你不需要发 ACK — Daemon 已处理
- 你不需要知道其他节点的信息 — Agent Card 自动发现
- 你只需要：执行 → 回报结果
```

---

## 10. CLI 接口

```bash
# 节点管理
catbus start                                    # 启动节点
catbus stop                                     # 停止节点
catbus status                                   # 本节点状态

# 服务发现
catbus cards                                    # 列出所有在线 Agent
catbus cards --skill browser                    # 筛选有浏览器能力的 Agent
catbus cards --queue heavy                      # 筛选能做重型计算的 Agent
catbus cards --idle                             # 只看空闲的

# 任务
catbus submit "分析 SEO" --queue general
catbus submit "跑 benchmark" --queue heavy --fan-out 3
catbus submit "修复 nginx" --queue sre --priority 10
catbus tasks                                    # 列出所有任务
catbus tasks --state working                    # 筛选执行中
catbus tasks --queue sre                        # 筛选某个队列
catbus result <task_id>                         # 查看任务结果

# 状态同步
catbus state                                    # 查看全网状态树
catbus state desired                            # 查看期望状态
catbus state actual                             # 查看实际状态
catbus drift                                    # 查看所有漂移
catbus set desired/<node>/<key> <value>         # 设置期望状态
catbus set desired/global/primary_model claude-sonnet-4

# 经验库
catbus genes                                    # 列出所有经验
catbus genes --category sre                     # 按分类筛选

# 实时监控
catbus watch                                    # 订阅所有事件，实时输出
catbus watch --filter task.*                    # 只看任务相关事件
```

---

## 11. 一键安装 & 自动角色判定

### 11.1 安装命令

```bash
curl -fsSL https://catbus.openclaw.net/install.sh | bash -s -- --router tcp/router-a:7447
```

一行命令，完成以下全部步骤：

```
1. 检测 OS 和架构（Linux amd64/arm64, macOS arm64）
2. 安装 zenoh-python + catbus 包
3. 自动判定节点角色（Router or Peer）
4. 生成 /etc/catbus/config.json
5. 生成 /etc/catbus/secret（随机 64 字符）
6. 注册 systemd service（Linux）或 launchd plist（macOS）
7. 启动 catbus daemon
8. 打印 Agent Card + 加入网络的确认信息
```

### 11.2 自动角色判定

安装脚本自动检测网络环境，判定应该是 Router 还是 Peer：

```bash
#!/bin/bash
# install.sh 中的角色判定逻辑

detect_role() {
    # 1. 用户显式指定 → 最优先
    if [ "$CATBUS_ROLE" = "router" ]; then echo "router"; return; fi
    if [ "$CATBUS_ROLE" = "peer" ];   then echo "peer";   return; fi
    
    # 2. 检测公网 IP
    PUBLIC_IP=$(curl -s --max-time 5 https://ifconfig.me)
    LOCAL_IP=$(hostname -I | awk '{print $1}')
    
    if [ -z "$PUBLIC_IP" ]; then
        echo "peer"  # 无法获取公网 IP → 肯定是 NAT 后面
        return
    fi
    
    # 3. 检测本机 IP 是否就是公网 IP（非 NAT）
    if echo "$LOCAL_IP" | grep -q "$PUBLIC_IP"; then
        echo "router"  # 本机直接持有公网 IP → 可以当 Router
        return
    fi
    
    # 4. 尝试监听端口测试（确认公网可达）
    timeout 10 bash -c "nc -l 7447 &>/dev/null &"
    NC_PID=$!
    sleep 1
    if curl -s --max-time 5 "http://$PUBLIC_IP:7447" &>/dev/null; then
        echo "router"  # 端口可达 → 可以当 Router
    else
        echo "peer"    # 端口不可达（防火墙/NAT）→ Peer
    fi
    kill $NC_PID 2>/dev/null
}

ROLE=$(detect_role)
echo "🔍 检测到节点角色: $ROLE"
```

**判定逻辑优先级：**

| 优先级 | 条件 | 结果 |
|--------|------|------|
| 1 | 用户通过 `CATBUS_ROLE=router` 显式指定 | 按指定 |
| 2 | 无法获取公网 IP | Peer |
| 3 | 本机 IP == 公网 IP（云服务器/VPS） | Router |
| 4 | 端口 7447 从公网可达 | Router |
| 5 | 以上都不满足（家庭网络/办公网络） | Peer |

### 11.3 生成的配置

**Peer 节点：**

```bash
$ curl -fsSL https://catbus.openclaw.net/install.sh | bash -s -- --router tcp/router-a:7447
🔍 检测到节点角色: peer
📝 生成配置: /etc/catbus/config.json
🔑 生成密钥: /etc/catbus/secret
🚀 启动 catbus daemon...
✅ 节点 "myhost-a1b2" 已加入 CatBus 网络 (peer)
   连接到: tcp/router-a:7447
   Agent Card 已发布
```

```json
// /etc/catbus/config.json (自动生成)
{
  "name": "myhost-a1b2",
  "mode": "peer",
  "connect": { "endpoints": ["tcp/router-a:7447"] },
  "scouting": { "multicast": { "enabled": true } },
  "skills": [],
  "queues": ["general"],
  "max_concurrent": 2,
  "claim_arbiter": false
}
```

**Router 节点：**

```bash
$ CATBUS_ROLE=router curl -fsSL https://catbus.openclaw.net/install.sh | bash
🔍 检测到节点角色: router
📝 生成配置: /etc/catbus/config.json (含 RocksDB Storage)
🔑 生成密钥: /etc/catbus/secret
🚀 启动 catbus daemon...
✅ 节点 "ovh-fr-c3d4" 已加入 CatBus 网络 (router)
   监听: tcp/0.0.0.0:7447
   Storage: /var/lib/catbus/zenoh (RocksDB)
```

### 11.4 安装后配置

自动生成的配置是最小可用的。安装后可以通过 CLI 调整：

```bash
# 声明技能
catbus config set skills '["coding", "browser", "ssh-ops"]'

# 订阅更多队列
catbus config set queues '["general", "heavy", "dev"]'

# 调整并发数
catbus config set max_concurrent 3

# 开启 Arbiter（仅 Router，全网只需一个）
catbus config set claim_arbiter true

# 加入其他 Router 的密钥（用于 HMAC 验证）
catbus secret add agent-name their-secret

# 重启生效
catbus restart
```

### 11.5 首个 Router 的 Bootstrap

全新部署时，第一个 Router 是"鸡蛋"——没有其他 Router 可连：

```bash
# 第一个 Router：不需要 --router 参数
CATBUS_ROLE=router curl -fsSL https://catbus.openclaw.net/install.sh | bash

# 后续 Router：连接已有 Router
CATBUS_ROLE=router curl -fsSL https://catbus.openclaw.net/install.sh | bash -s -- --router tcp/first-router:7447

# 所有 Peer：连接任意 Router
curl -fsSL https://catbus.openclaw.net/install.sh | bash -s -- --router tcp/first-router:7447
```

---

## 12. OpenClaw 集成

### 12.1 架构关系

```
┌──────────────────────────────────────────────┐
│              一台物理/虚拟机                    │
│                                               │
│  ┌───────────────────────────────────────┐   │
│  │ OpenClaw (AI Agent Runtime)            │   │
│  │                                        │   │
│  │  ┌────────────┐  ┌─────────────────┐  │   │
│  │  │ AI Session  │  │ Tools/Skills    │  │   │
│  │  │ (Claude,    │  │ - bash          │  │   │
│  │  │  GPT, etc.) │  │ - browser       │  │   │
│  │  │             │  │ - catbus CLI ◄──┼──┼───┼── CatBus 提供的工具
│  │  └──────┬──────┘  └─────────────────┘  │   │
│  │         │                               │   │
│  │         │ 执行任务 / 返回结果            │   │
│  │         │                               │   │
│  └─────────┼───────────────────────────────┘   │
│            │                                    │
│  ┌─────────┼───────────────────────────────┐   │
│  │ CatBus Daemon                            │   │
│  │         │                                │   │
│  │   pull task from queue                   │   │
│  │         │                                │   │
│  │   ┌─────▼──────┐                        │   │
│  │   │ 构造 prompt │ ──► 调用 OpenClaw API  │   │
│  │   │ + context   │ ◄── 获取 AI 执行结果   │   │
│  │   └─────────────┘                        │   │
│  │                                          │   │
│  │   write result → catbus/results/{id}     │   │
│  │                                          │   │
│  └──────────────────────────────────────────┘   │
│                                               │
│  ┌──────────────────────────────────────┐    │
│  │ Zenoh Runtime (嵌入式，在 Daemon 中)  │    │
│  └──────────────────────────────────────┘    │
└──────────────────────────────────────────────┘
```

**关键边界：**
- **CatBus Daemon** 负责：网络、队列、领取、状态同步、经验库
- **OpenClaw** 负责：AI 执行（调用模型、使用工具、生成结果）
- **连接点**：Daemon 通过 OpenClaw 的 API/CLI 提交任务给 AI

### 12.2 集成方式

CatBus Daemon 领取任务后，需要让 OpenClaw 的 AI Agent 执行。三种集成方式（从简到深）：

**方式 A：CLI 调用（最简单，推荐起步）**

Daemon 通过 `openclaw run` 命令启动一个 AI session 执行任务：

```python
def call_ai(instruction, context, on_progress=None):
    """通过 OpenClaw CLI 执行任务"""
    
    # 构造 prompt（包含 CatBus 上下文）
    prompt = build_prompt(instruction, context)
    
    # 调用 OpenClaw
    result = subprocess.run(
        ["openclaw", "run", 
         "--model", my_card["ai_provider"]["primary"],
         "--prompt", prompt,
         "--tools", "bash,browser,catbus",  # catbus CLI 作为可用工具
         "--json"],  # 输出 JSON 格式
        capture_output=True, text=True, timeout=context.get("timeout", 3600)
    )
    
    output = json.loads(result.stdout)
    return {
        "summary": output["summary"],
        "output": output["content"],
        "token_used": output["usage"]["total_tokens"],
        "artifacts": output.get("artifacts", [])
    }


def build_prompt(instruction, context):
    """构造给 AI 的 prompt"""
    prompt = f"""你收到了一个 CatBus 任务。

## 任务
{instruction}

## 上下文
{json.dumps(context, ensure_ascii=False, indent=2)}

## 要求
1. 完成任务
2. 用 `catbus result <task_id> '<json>'` 回报结果
3. 结果必须包含 summary 字段
"""
    # 如果经验库有匹配的解决方案
    if "known_solution" in context:
        prompt += f"""
## 已知解决方案（来自经验库，可参考）
{context['known_solution']}
"""
    return prompt
```

**方式 B：Python SDK 调用（更紧密集成）**

如果 OpenClaw 提供 Python SDK：

```python
from openclaw import Agent

def call_ai(instruction, context, on_progress=None):
    """通过 OpenClaw SDK 执行任务"""
    agent = Agent(
        model=my_card["ai_provider"]["primary"],
        tools=["bash", "browser", "catbus"],
        system_prompt=CATBUS_SKILL_PROMPT
    )
    
    result = agent.run(
        message=instruction,
        context=context,
        on_token=lambda t: on_progress(estimate_percent(t), "执行中...") if on_progress else None
    )
    
    return {
        "summary": result.summary,
        "output": result.content,
        "token_used": result.usage.total_tokens,
        "artifacts": result.artifacts
    }
```

**方式 C：CatBus 作为 OpenClaw 的 Skill（最深度）**

把 CatBus 注册为 OpenClaw 的一个 Skill/Tool，AI 可以主动使用：

```yaml
# openclaw/skills/catbus/skill.yaml
name: catbus
description: 分布式任务协作系统
tools:
  - name: catbus_submit
    description: 提交任务到 CatBus 队列
    parameters:
      queue: { type: string, required: true }
      instruction: { type: string, required: true }
  - name: catbus_result  
    description: 回报任务执行结果
    parameters:
      task_id: { type: string, required: true }
      result: { type: object, required: true }
  - name: catbus_cards
    description: 查看所有在线 Agent
  - name: catbus_drift
    description: 查看状态漂移
```

这样 AI Agent 不仅能被动接收任务，还能**主动**：
- 把子任务分发给其他节点：`catbus_submit("heavy", "帮我跑这个 benchmark")`
- 查看谁在线：`catbus_cards()` → 决定把任务发到哪个队列
- 检查系统健康：`catbus_drift()` → 主动发现问题

### 12.3 CatBus 给 AI 提供的工具

无论用哪种集成方式，AI Agent 看到的工具接口是一样的：

```bash
# AI 执行任务后回报结果（必须）
catbus result <task_id> '{"summary": "一句话", "output": "详细内容"}'

# AI 主动提交子任务（可选）
catbus submit "子任务描述" --queue general

# AI 查看系统状态（可选）
catbus cards                    # 谁在线
catbus cards --skill browser    # 谁有浏览器
catbus drift                    # 状态漂移
catbus tasks --state working    # 正在跑的任务
```

这些 CLI 命令底层直接调用 Zenoh session，不经过 HTTP/REST。

### 12.4 安装时的 OpenClaw 集成

安装脚本自动检测 OpenClaw 是否已安装，如果存在则自动集成：

```bash
# install.sh 中的 OpenClaw 检测
setup_openclaw_integration() {
    if ! command -v openclaw &>/dev/null; then
        echo "⚠️  未检测到 OpenClaw，跳过集成"
        echo "   CatBus 将以 standalone 模式运行（仅队列/状态同步）"
        echo "   安装 OpenClaw 后运行 'catbus integrate openclaw' 即可"
        return
    fi
    
    OPENCLAW_VERSION=$(openclaw --version)
    echo "✅ 检测到 OpenClaw $OPENCLAW_VERSION"
    
    # 1. 把 catbus CLI 注册为 OpenClaw 的工具
    mkdir -p ~/.openclaw/skills/catbus/
    cp /usr/local/lib/catbus/skill.yaml ~/.openclaw/skills/catbus/
    
    # 2. 把 SKILL.md 放到 OpenClaw 能读到的地方
    cp /usr/local/lib/catbus/SKILL.md ~/.openclaw/skills/catbus/
    
    echo "✅ CatBus 已注册为 OpenClaw skill"
    echo "   AI Agent 现在可以使用 catbus 工具了"
}
```

### 12.5 AI Agent 的完整任务执行流程

```
1. CatBus Daemon pull loop 从队列拉到一个任务
2. Daemon 检查经验库（Gene Store），找到匹配的解决方案（如果有）
3. Daemon 构造 prompt：任务描述 + 上下文 + 已知方案
4. Daemon 调用 OpenClaw（CLI/SDK）启动 AI session
5. AI Agent 开始执行：
   a. 读懂任务
   b. 使用工具（bash, browser, catbus CLI...）
   c. 执行 catbus result <task_id> '{"summary": "..."}' 回报结果
   d. （可选）发 Telegram 通知主人
6. Daemon 收到 AI 执行完成的信号
7. Daemon 更新 Task 状态为 completed
8. Daemon 判断是否保存新经验到 Gene Store
9. Daemon 更新 Agent Card（load 降低，status 变 idle）
```

**如果 OpenClaw 未安装（standalone 模式）：**

CatBus 仍然可以运行，但 step 4 降级为直接执行 `instruction` 中的 shell 命令（如果是简单的运维脚本），或者跳过执行、标记 `failed`（error: "no AI executor available"）。

---

## 13. 设计决策记录

| 决策 | 选择 | 弃选 | 理由 |
|------|------|------|------|
| 通信协议 | Zenoh | MQTT, NATS, gRPC | P2P 原生 + NAT 穿透 + Query + Storage + 极轻量 |
| 调度模型 | Pull | Push | 解决信任问题 + 自然负载均衡 + 消灭 Manager 单点 |
| 状态管理 | Desired/Actual/Drift | 命令式消息 | 声明式 + 断网自愈 + 最终一致 + 与 K8s 理念一致 |
| 节点类型 | Router + Peer | 单一类型 | 最简分类：有公网 IP = Router，NAT 后 = Peer |
| 竞争控制 | Router Queryable 仲裁 | 乐观锁 CAS | Router 本地锁保证原子性，任意规模正确；降级方案用字典序仲裁 |
| 持久化 | Router RocksDB | 每节点本地存储 | 集中在 Router 上，Peer 无状态 |
| 认证 | HMAC 签名 + 时间戳窗口 | Bearer Token, mTLS | 防重放攻击，secret 不离开本机；未来可升级 Ed25519 |
| 语言 | Python | Rust, Go | 与 AI Agent 生态一致，开发速度优先 |
| 经验库 | Zenoh KV | SQLite, Redis | 不引入额外依赖 |
| OpenClaw 集成 | CLI 调用（起步） | SDK, 深度内嵌 | 松耦合，OpenClaw 升级不影响 CatBus |
| 兼容 v4 | **不兼容** | 渐进迁移 | 趁小全面重构，不背历史包袱 |

---

## 14. 实现计划

| Phase | 内容 | 工时 | 交付物 |
|-------|------|------|--------|
| 1 | Zenoh P2P 网络 + 节点发现 + NAT 穿透验证 | 4h | 两个节点能互相 put/get |
| 2 | Agent Card + Task Queue + Pull Worker + Arbiter | 6h | 提交任务 → 自动领取 → 返回结果 |
| 3 | OpenClaw 集成 + SKILL 注册 | 3h | AI Agent 能执行 CatBus 任务 |
| 4 | State Sync + Drift 检测 + 自愈 | 4h | 改 desired → 节点自动收敛 |
| 5 | Gene Store + 可观测性 + 告警 | 3h | 经验复用 + Telegram 告警 |
| 6 | CLI + 一键安装脚本 + 全网部署 | 4h | `curl ... \| bash` 一行加入网络 |
| **总计** | | **24h** | |

**建议顺序：** Phase 1 → 2 → 3 → 6 → 4 → 5。先跑通最小闭环（安装→加入→领取→AI执行→结果），再加状态同步和经验库。

---

## 15. 一句话总结

> CatBus v5 = Zenoh P2P 网状网络 + Pull 任务队列 + Desired/Actual 状态同步 + 经验库
>
> 没有 Manager，没有 Broker，没有中心。
> 任务放在那里，谁空谁来拿。
> 状态写在那里，谁偏谁自愈。
> `curl ... | bash` 一行加入网络。

---

*这是一个通用的分布式 AI Agent 协作系统设计。
不绑定具体节点数量或名称，可水平扩展。
新节点加入只需：`curl -fsSL https://catbus.openclaw.net/install.sh | bash -s -- --router tcp/your-router:7447`*
