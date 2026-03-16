# CatBus 猫猫巴士 v4 设计文档

> 基于 v3 实战经验 + 6 个开源多 Agent 项目研究重新设计
> 日期：2026-02-21
> 作者：NeFi

## 设计哲学

**Do one thing well**: CatBus 是消息层，不是框架。
借鉴 agent-relay 的哲学 — 只做跨机器 Agent 通信，不做编排逻辑。

**v3 的教训：**
1. AI 收到任务后不知道怎么回报结果（缺 ACK + 回报协议）
2. Bot Token 配置错误导致身份混乱（缺身份验证）
3. 任务发出去不知道对方收没收到（缺送达确认）
4. 只有串行指派，不支持并行派发+汇总
5. 经验无法跨机器人复用

**v4 核心改进：**
- ACK 机制 + 重试升级（借鉴 agent-relay）
- 结构化 Handoff 格式（借鉴 swarm-coordination）
- 并行编排 + 结果汇总（借鉴 qodex-ai orchestration）
- 经验库机读格式（借鉴 Ktao Memory Supersystem）
- 身份自检（解决 Token 错配问题）

---

## 一、系统拓扑（不变）

```
                    ┌─────────────────┐
                    │  MQTT Broker    │
                    │  (浣浣 ge.ovh)  │
                    │  Port 8883 TLS  │
                    └────────┬────────┘
           ┌─────────┬───────┼───────┬─────────┐
           │         │       │       │         │
        ┌──┴──┐  ┌──┴──┐ ┌──┴──┐ ┌──┴──┐  ┌──┴──┐
        │NeFi │  │浣浣 │ │狗子 │ │咪咪 │  │小黑 │
        │ Mac │  │ge.  │ │home │ │la.  │  │us.  │
        │Mgr  │  │ovh  │ │lab  │ │css  │  │ovh  │
        └─────┘  └─────┘ └─────┘ └─────┘  └─────┘
```

5 台机器，1 个 Broker，全网 TLS 加密。不变。

---

## 二、协议 v2（重大升级）

### 2.1 消息信封（不变）

```json
{
  "v": 2,
  "id": "nefi-1771683093487-abc",
  "ts": "2026-02-21T14:11:33Z",
  "from": "nefi",
  "to": "gouzi",
  "type": "task",
  "payload": {}
}
```

7 个必填字段：`v`、`id`、`ts`、`from`、`to`、`type`、`payload`。

### 2.2 消息类型（扩展）

| type | 方向 | 用途 |
|------|------|------|
| `task` | Manager→Worker | 派发任务 |
| `ack` | Worker→Manager | **新增** 确认收到任务（Daemon 级，零 token） |
| `progress` | Worker→Manager | **新增** 执行进度 |
| `result` | Worker→Manager | 返回结果 |
| `review` | Manager→Worker | **新增** 质量反馈（approve/reject/revise） |
| `broadcast` | Any→All | **新增** 广播消息 |
| `claim` | Worker→Manager | **新增** 认领广播任务 |
| `alert` | Any→SRE | 告警 |
| `ping` | Self→Self | 心跳 |
| `gene` | Any→Hub | **新增** 经验发布 |

**可选字段：**
- `priority`: 0-9（0 最高），默认 5。用于优先级队列，alert 默认 0，task 默认 5。

### 2.3 ACK 机制（新增，借鉴 agent-relay）

**关键设计：System ACK（Daemon 级） + Agent Progress（AI 级）**

ACK 由 Daemon 自动发送（零 token 消耗），不经过 AI。当 Daemon 收到 task 消息并成功入队时，立即秒回 ACK：

```json
{
  "v": 2, "id": "gouzi-xxx-ack", "ts": "...",
  "from": "gouzi", "to": "nefi", "type": "ack",
  "payload": {
    "ref_id": "nefi-1771683093487-abc",
    "status": "queued",
    "queue_depth": 0
  }
}
```

ACK status 语义：
- `queued`（queue_depth=0）— 队列空闲，立即执行
- `queued`（queue_depth>0）— 队列繁忙，已排队等待

Manager 可根据 queue_depth 预估 ETA。

AI 的执行状态通过 `progress` 和 `result` 消息反馈（Agent 驱动）：

```json
{
  "v": 2, "id": "gouzi-xxx-prog", "ts": "...",
  "from": "gouzi", "to": "nefi", "type": "progress",
  "payload": {
    "ref_id": "nefi-1771683093487-abc",
    "percent": 40,
    "message": "正在检查第 3/5 台机器"
  }
}
```

**重试升级策略（基于绝对时间，Daemon 自动执行）：**

| 累计耗时 | 动作 |
|---------|------|
| 60s 无 System ACK | 原样重发（前提：本机 MQTT 连接健康） |
| 150s 无 System ACK | 标记 `[RETRY]` 重发 |
| 330s 无 System ACK | 标记 `[URGENT]` + 通知 Manager |
| 630s | 标记 fail，触发熔断计数 |

注意：重试只针对 System ACK 未收到的情况（网络/Daemon 故障）。收到 ACK 后不再重试，等 result 即可。

### 2.4 结构化 Handoff（新增，借鉴 swarm-coordination）

result 消息的 payload 统一格式：

```json
{
  "ref_id": "nefi-xxx-task",
  "status": "done",
  "summary": "检查完成，所有机器健康",
  "findings": [
    {"machine": "homelab", "cpu": "0.02", "mem": "12%", "disk": "2%"},
    {"machine": "ge.ovh", "cpu": "0.22", "mem": "12%", "disk": "9%"}
  ],
  "artifacts": ["/var/log/catbus/results/xxx.json"],
  "next_action": "none",
  "token_used": 1500
}
```

关键字段：
- `summary` — 一句话总结（必填）
- `findings` — 结构化发现（可选）
- `artifacts` — 产出文件路径（可选）
- `next_action` — 建议下一步（可选）
- `token_used` — 消耗统计（可选）

### 2.5 广播与认领（新增，借鉴 EvoMap bounty）

NeFi 不确定谁最合适时，广播任务：

```json
{
  "v": 2, "id": "nefi-xxx-bc", "ts": "...",
  "from": "nefi", "to": "*", "type": "broadcast",
  "payload": {
    "task": "优化 Next.js build 速度",
    "required_skills": ["nextjs", "performance"],
    "deadline_seconds": 3600,
    "claim_window_seconds": 10
  }
}
```

Worker 认领（Daemon 先做 Tag 过滤，required_skills 不匹配则丢弃不唤醒 AI）：

**Tag 过滤数据源**：每台机器的 `/etc/catbus/config.json` 新增 `machine_skills` 字段：

```json
{
  "machine_name": "huanhuan",
  "machine_skills": ["nextjs", "python", "nodejs", "seo", "coding"],
  ...
}
```

各机器 skills 定义：
| 机器 | machine_skills |
|------|---------------|
| 浣浣 | nextjs, python, nodejs, seo, coding |
| 狗子 | sre, monitoring, linux, networking |
| 咪咪 | storage, backup, lightweight |
| 小黑 | compute, ml, heavy-task, python |

**claim 阶段纯 Daemon 自动化（不唤醒 AI）：**
- Daemon 收到 broadcast → 检查 `required_skills` 与 `machine_skills` 交集
- 交集为空 → 丢弃
- 交集非空 → 自动发 claim，confidence = len(交集) / len(required_skills)，reason 用固定模板
- AI 只在收到 task 确认后才介入

Daemon 收到 broadcast 时：取 `required_skills` 与本机 `machine_skills` 求交集，为空则丢弃。

```json
{
  "v": 2, "id": "huanhuan-xxx-claim", "ts": "...",
  "from": "huanhuan", "to": "nefi", "type": "claim",
  "payload": {
    "ref_id": "nefi-xxx-bc",
    "confidence": 0.9,
    "reason": "我有 Next.js 开发经验"
  }
}
```

Manager 在 `claim_window_seconds`（默认 10s）内收集所有 claim，窗口关闭后选最高 confidence 的 Worker，发 task 确认。

---

## 三、Daemon v2（重大升级）

### 3.1 新增模块

```
catbus_daemon.py
├── MQTT 连接管理（增强：可配置参数 + 指数退避重连）
├── Socket 服务（不变）
├── Worker 队列（不变）
├── 熔断器（不变）
├── Context Hydration（不变）
├── ACK 追踪器（新增，Daemon 级自动 ACK）
├── 重试调度器（新增，单调时间）
├── Fan-out 汇总器（新增，带 deadline）
├── 经验库缓存（新增，带衰减纠错）
├── 身份自检（新增，hash 比对）
├── 状态持久化（新增，write-behind dirty flag）
└── 两级队列（新增，防 MQTT 心跳阻塞）
```

**两级队列架构（防 on_message 阻塞 MQTT 心跳线程）：**

```
MQTT 网络线程                调度线程                    AI 执行线程
    │                          │                           │
on_message()              scheduler()                  worker()
    │                          │                           │
 JSON 解析                从 intake 取消息              从 task_queue 取
 合法性校验               Context Hydration             唤醒 AI 执行
    │                     Gene 查询注入                     │
    ▼                     发送 System ACK                   ▼
 intake_queue ──────────► task_queue ──────────────────► AI 处理
 (极速内存队列)            (阻塞执行队列)
```

`on_message` 只做最轻量的 JSON 解析 + 校验，立即推入 `intake_queue`（永不阻塞）。调度线程从 intake 取数据，做 Hydration/Gene 查询等耗时操作，完成后发 System ACK 并放入 AI 执行队列。这样 MQTT 心跳线程永远不会被阻塞。

**队列实现**：必须使用 `queue.Queue`（线程安全），不要用 list + append/pop。

**线程模型（共 4 个线程）：**

| 线程 | 职责 | 阻塞点 |
|------|------|--------|
| MQTT 网络线程 | paho 内部，on_message 回调 | 无（极速推 intake） |
| 调度线程 | intake → Hydration → ACK → task_queue | intake_queue.get() |
| AI 执行线程 | task_queue → 唤醒 AI → 收集结果 | task_queue.get() |
| 维护线程 | 10 秒循环，顺序执行全部维护任务 | time.sleep(10) |

**维护线程（合并所有周期性检查）：**

```python
def maintenance_loop():
    """单一维护循环，避免多线程竞态"""
    while running:
        retry_check()       # ACK 重试
        deadline_check()    # Fan-out 超时
        health_check()      # 心跳 + 告警
        if _state_dirty:    # write-behind 持久化
            _persist_state()
            _state_dirty = False
        time.sleep(10)
```

### 3.2 ACK 追踪器

```python
pending_acks = {}  # {task_id: {"sent_at": ts, "retries": 0, "payload": msg}}

def on_task_sent(task_id, payload):
    pending_acks[task_id] = {
        "sent_at": time.monotonic(),  # 单调时间，防休眠/NTP 漂移
        "retries": 0,
        "payload": payload
    }

def on_ack_received(ref_id):
    pending_acks.pop(ref_id, None)

def retry_check():
    """每 10 秒检查，基于单调时间判断"""
    now = time.monotonic()
    for task_id, info in list(pending_acks.items()):
        elapsed = now - info["sent_at"]
        retries = info["retries"]
        if elapsed > 60 and retries == 0 and mqtt_connected:
            resend(task_id, prefix="")
            info["retries"] = 1
        elif elapsed > 150 and retries == 1:
            resend(task_id, prefix="[RETRY] ")
            info["retries"] = 2
        elif elapsed > 330 and retries == 2:
            resend(task_id, prefix="[URGENT] ")
            notify_manager(task_id)
            info["retries"] = 3
        elif elapsed > 630 and retries >= 3:
            mark_fail(task_id)
            pending_acks.pop(task_id)
    # write-behind：标记 dirty，由本循环统一写盘
    if _state_dirty:
        _persist_state()
        _state_dirty = False
```

**状态持久化（write-behind）**：状态变更时只标记 `_state_dirty = True`，由维护线程 10 秒循环统一写入 `/var/log/catbus/state.json`。

**启动恢复逻辑**：

```python
def load_state():
    """Daemon 启动时恢复未完成的任务状态"""
    if not os.path.exists(STATE_FILE):
        return
    state = json.load(open(STATE_FILE))
    now = time.monotonic()

    # 恢复 pending_acks
    for task_id, info in state.get("pending_acks", {}).items():
        age = now  # monotonic 重启后归零，用 wall clock 差值估算
        wall_age = time.time() - info.get("wall_ts", 0)
        if wall_age > 630:
            mark_fail(task_id)  # 已超最大等待，直接标记失败
        else:
            info["sent_at"] = now - wall_age  # 映射到当前 monotonic
            pending_acks[task_id] = info

    # 恢复 fan_out
    for gid, group in state.get("fan_out", {}).items():
        wall_deadline = group.get("wall_deadline", 0)
        if time.time() > wall_deadline:
            # deadline 已过，强制汇总
            missing = [t for t in group["tasks"] if t not in group["results"]]
            for t in missing:
                group["results"][t] = {"status": "timeout"}
            aggregate_and_notify(gid)
        else:
            remaining = wall_deadline - time.time()
            group["deadline"] = now + remaining
            fan_out[gid] = group
```

注意：state.json 同时存 `wall_ts`（time.time()）用于重启后估算已流逝时间，运行时计算用 `time.monotonic()`。

### 3.3 经验库缓存

```python
# Daemon 启动时订阅 catbus/genes/#，缓存所有 retained 经验
genes_cache = {}  # {topic: gene_json}

def on_gene_message(topic, payload):
    genes_cache[topic] = json.loads(payload)

def _match_key(key, text):
    """中英文分别匹配：英文用 word boundary，中文用子串"""
    if len(key) < 4:
        return False
    if any(ord(c) > 0x7F for c in key):
        return key in text  # 中文：子串匹配
    return bool(re.search(r'\b' + re.escape(key) + r'\b', text, re.I))  # 英文：word boundary

def lookup_gene(error_text):
    """任务执行前查找已知解法"""
    best = None
    best_score = 0
    for topic, gene in genes_cache.items():
        keys = gene.get("trigger_keys", [])
        min_match = gene.get("min_match_count", 1)
        hits = sum(1 for k in keys if _match_key(k, error_text))
        if hits >= min_match and hits > best_score:
            best = gene
            best_score = hits
    return best
```

### 3.4 身份自检（新增，解决 Token 错配）

Daemon 启动时自动验证：

```python
def self_check(force=False):
    """启动时验证身份配置。失败则拒绝启动（除非 --force）"""
    skill_token = extract_token_from_skill()
    config_token = extract_token_from_openclaw_config()
    if skill_token != config_token:
        skill_hash = hashlib.sha256(skill_token.encode()).hexdigest()[:8]
        config_hash = hashlib.sha256(config_token.encode()).hexdigest()[:8]
        msg = f"SKILL.md token (hash:{skill_hash}) != config token (hash:{config_hash})"
        print(f"[catbus] ❌ {msg}")
        if not force:
            print("[catbus] 身份不匹配，拒绝启动。使用 --force 跳过（仅调试用）")
            sys.exit(1)
        print("[catbus] ⚠️ --force 模式，跳过身份检查")

    # 2. 检查 machine_name 是否与 MQTT 用户名一致
    # 3. 发送 self-ping 验证 MQTT 连通性
```

---

## 四、Topic 结构（扩展）

```
catbus/
├── task/{machine}      # 点对点任务
├── result/{machine}    # 点对点结果
├── ack/{machine}       # ACK 确认（新增）
├── broadcast/tasks     # 广播任务（新增）
├── broadcast/claims    # 认领响应（新增）
├── alert/{machine}     # 告警
├── status/{machine}    # 在线状态（retained）
├── genes/{category}/{id}  # 经验库（retained，新增）
└── ping/{machine}      # 心跳
```

---

## 五、Skill v2（重大升级）

### 5.1 SKILL.md 模板

```markdown
# CatBus — 机器人通信 Skill

## 你是谁
你是 {machine_name}，猫猫工坊的 {role}。

## 身份验证
- 你的 Telegram Bot Token: {bot_token}
- 你的机器名: {machine_name}
- **只能用自己的 Bot Token 发消息，绝不能用别人的**

## 通讯录
| 名字 | 机器名 | 角色 |
|------|--------|------|
| 狗子 | gouzi | SRE |
| NeFi | nefi | Manager |
| 浣浣 | huanhuan | 编码执行者 |
| 咪咪 | mimi | 存储/轻量 |
| 小黑 | xiaohei | 重型计算 |

## 收到任务时（必须遵守）

1. **ACK 已由 Daemon 自动发送**（零 token，你不需要管）
2. **执行任务** — 按任务描述执行
3. **回报结果** — 用 catbus_send.py 发 result 消息，必须包含 summary
4. **通知主人** — 用自己的 Bot 给主人发 Telegram 汇报

### Result 示例
python3 scripts/catbus_send.py {from} result '{"ref_id":"{task_id}","status":"done","summary":"一句话总结"}'

## 工具
- catbus_send.py <target> <type> '<payload_json>'
- catbus_read.py <ref_id>
- catbus_status.py
```

### 5.2 关键改进

**v3 的问题**：AI 收到任务后不知道怎么回报，SKILL.md 里没有明确的回报流程。

**v4 的解决**：
1. SKILL.md 里写死了"收到任务时"的 4 步流程（Daemon 自动 ACK→执行→回报→通知）
2. 给出了 Result 的具体命令示例
3. 身份验证章节防止 Token 错配

---

## 六、编排模式（新增）

### 6.1 串行（现有）

```
NeFi → task → 浣浣 → result → NeFi
```

### 6.2 并行 Fan-out/Fan-in（新增）

```
NeFi → task → 浣浣 ─┐
     → task → 小黑 ─┤→ NeFi 汇总
     → task → 咪咪 ─┘
```

NeFi 同时给多个 Worker 发任务，等所有 result 回来后汇总。

Daemon 实现：NeFi 的 Daemon 维护一个 `fan_out` 表：

```python
fan_out = {}  # {group_id: {"tasks": [id1,id2,id3], "results": {}, "callback": fn}}

def fan_out_send(targets, task_payload, timeout_seconds=600):
    group_id = generate_id()
    fan_out[group_id] = {
        "tasks": [],
        "results": {},
        "total": len(targets),
        "deadline": time.monotonic() + timeout_seconds
    }
    for target in targets:
        task_id = send_task(target, task_payload)
        fan_out[group_id]["tasks"].append(task_id)
    _state_dirty = True

def on_result(ref_id, result):
    for gid, group in fan_out.items():
        if ref_id in group["tasks"]:
            group["results"][ref_id] = result
            if len(group["results"]) == group["total"]:
                aggregate_and_notify(gid)
            _state_dirty = True

def deadline_check():
    """扫描过期的 fan_out group，强制汇总"""
    now = time.monotonic()
    for gid, group in list(fan_out.items()):
        if now > group["deadline"] and len(group["results"]) < group["total"]:
            missing = [t for t in group["tasks"] if t not in group["results"]]
            for t in missing:
                group["results"][t] = {"status": "timeout"}
            aggregate_and_notify(gid)
```

### 6.3 广播认领（新增）

```
NeFi → broadcast → 所有 Worker
                    浣浣 → claim (confidence: 0.9)
                    小黑 → claim (confidence: 0.7)
NeFi 选浣浣 → task → 浣浣 → result → NeFi
```

### 6.4 转派（现有）

```
NeFi → task → 狗子 → reassign → 浣浣 → result → NeFi
```

---

## 七、经验库（新增）

### 7.1 Schema

```json
{
  "trigger_keys": ["EACCES", ".next", "permission denied"],
  "category": "nextjs",
  "solution": "sudo rm -rf .next && npm run build",
  "confidence": 0.95,
  "source": "huanhuan",
  "created": "2026-02-21",
  "last_hit": "2026-02-21",
  "hit_count": 1
}
```

### 7.2 写入流程

AI 解决非平凡问题后，输出标记：

```
[CATBUS_GENE] {"trigger_keys":["EACCES",".next"],"category":"nextjs","solution":"...","confidence":0.95}
```

Daemon 检测到标记，发布到 `catbus/genes/{category}/{hash}`（retained）。

### 7.3 查询流程

1. Daemon 启动时订阅 `catbus/genes/#`，缓存所有经验
2. 任务执行前，用 trigger_keys 匹配任务描述
3. 命中则注入 AI context：`"已知解法：{solution}（置信度 {confidence}）"`

### 7.4 经验衰减与纠错

当 Agent 使用某个 Gene 的 solution 但仍然失败时，result 里带差评：

```json
{
  "type": "result",
  "payload": {
    "ref_id": "...",
    "status": "fail",
    "gene_feedback": {
      "gene_topic": "catbus/genes/nextjs/eacces-build",
      "verdict": "ineffective"
    }
  }
}
```

Daemon 收到差评后的处理：

```python
# 衰减系数可配，默认 0.7（比 0.5 更宽容）
GENE_DECAY_FACTOR = 0.7
# 同一 (task_id, worker, gene_topic) 的差评冷却期 5 分钟
GENE_FEEDBACK_COOLDOWN = 300

gene_feedback_log = {}  # {(worker, gene_topic): last_feedback_ts}

def on_gene_feedback(worker, gene_topic, task_id):
    key = (worker, gene_topic)
    now = time.monotonic()
    if key in gene_feedback_log and now - gene_feedback_log[key] < GENE_FEEDBACK_COOLDOWN:
        return  # 冷却期内，忽略重复差评
    gene_feedback_log[key] = now

    gene = genes_cache.get(gene_topic)
    if not gene:
        return
    # hit_count 权重：命中越多的 gene 衰减越慢
    hit_count = gene.get("hit_count", 1)
    effective_decay = 1 - (1 - GENE_DECAY_FACTOR) / max(1, hit_count / 5)
    gene["confidence"] = gene["confidence"] * effective_decay

    if gene["confidence"] < 0.3:
        # 墓碑化：发布空 retained 消息抹除
        publish_retained(gene_topic, b"")
        genes_cache.pop(gene_topic, None)
    else:
        publish_retained(gene_topic, json.dumps(gene))
```

衰减逻辑说明：
- 默认衰减 ×0.7（可配置），比 ×0.5 更宽容
- hit_count 权重：命中 20 次成功的 gene，单次失败衰减极小；命中 2 次的 gene 衰减更大
- 冷却期 5 分钟：同一 Worker 对同一 Gene 的连续差评只生效一次，防毒药数据风暴
- 低于 0.3 时墓碑化抹除

### 7.5 与 NeFi 记忆脱水的关系

- MEMORY.md = 个人记忆（Fact/Belief + 置信度 + 衰减）
- CatBus genes = 集体记忆（跨机器人共享解法库）
- NeFi 脱水时可把通用解法同步发布到 genes

---

## 八、质量反馈（新增）

### 8.1 Review 机制

result 消息可被 Manager 或主人标记：

```json
{
  "type": "review",
  "payload": {
    "ref_id": "task-xxx",
    "verdict": "approve",
    "score": 0.9,
    "comment": "执行准确"
  }
}
```

verdict: `approve` / `reject` / `revise`

### 8.2 Worker 积分

Daemon 累计统计各 Worker 的表现：

```json
{
  "huanhuan": {"total": 15, "approve": 13, "reject": 1, "revise": 1, "score_avg": 0.87},
  "gouzi": {"total": 8, "approve": 7, "reject": 0, "revise": 1, "score_avg": 0.91}
}
```

存储在 Manager 的 `/var/log/catbus/worker_scores.json`，同时发布到 `catbus/status/scores`（retained）作为备份，防 NeFi 重装丢失。

---

## 九、可观测性（新增，P1）

> 今天调了一天的教训：机制都有，但出问题时没有趁手的工具快速定位。

### 9.1 诊断命令（catbus_status.py 扩展）

通过本地 socket 查询 Daemon 内部状态：

```bash
catbus_status.py --pending     # 谁的任务还没 ACK、等了多久
catbus_status.py --last 20     # 最近 20 条消息流水（带时间戳和方向）
catbus_status.py --health      # 各机器最后心跳 + 熔断状态
catbus_status.py --route nefi→gouzi  # 查这条链路最近的通信记录
catbus_status.py --genes       # 经验库缓存条目数 + 最近命中
```

Daemon socket 新增 `diag` action：

```python
# socket 请求
{"action": "diag", "cmd": "pending"}
{"action": "diag", "cmd": "last", "n": 20}
{"action": "diag", "cmd": "health"}
{"action": "diag", "cmd": "route", "from": "nefi", "to": "gouzi"}
```

实现上不复杂 — Daemon 已有 pending_acks、fan_out、genes_cache 等数据，只需暴露查询接口。

### 9.2 结构化日志

所有收发消息统一写一行 JSON log 到 `/var/log/catbus/messages.jsonl`：

```json
{"ts":"2026-02-21T15:30:00Z","dir":"recv","from":"gouzi","to":"nefi","type":"ack","ref_id":"nefi-xxx","id":"gouzi-yyy","latency_ms":47}
{"ts":"2026-02-21T15:30:05Z","dir":"send","from":"nefi","to":"huanhuan","type":"task","ref_id":null,"id":"nefi-zzz","latency_ms":null}
```

字段：
- `dir`: `send` / `recv`
- `latency_ms`: 对于 ack/result，计算从 task 发出到收到的延迟
- 其余字段从消息信封提取

查询示例：
```bash
# 某个 task 的完整生命周期
jq 'select(.ref_id=="nefi-xxx" or .id=="nefi-xxx")' /var/log/catbus/messages.jsonl

# nefi↔gouzi 之间最近 10 条通信
jq 'select(.from=="nefi" and .to=="gouzi" or .from=="gouzi" and .to=="nefi")' /var/log/catbus/messages.jsonl | tail -10

# 所有超过 5 秒的 ACK
jq 'select(.type=="ack" and .latency_ms > 5000)' /var/log/catbus/messages.jsonl
```

日志轮转配置（`/etc/logrotate.d/catbus`）：

```
/var/log/catbus/messages.jsonl {
    daily
    rotate 7
    compress
    missingok
    notifempty
    copytruncate
}
```

用 `copytruncate` 而不是 `create`，因为 Daemon 持续写文件，不需要重启。

### 9.3 自动告警（Telegram 通知）

| 条件 | 告警内容 | 级别 |
|------|---------|------|
| 心跳超时 60s | `{machine} 心跳超时，可能离线` | 🔴 |
| ACK 延迟连续 3 次 >10s | `{machine} ACK 延迟异常，网络可能有问题` | 🟡 |
| 熔断器触发 | `{machine} 已熔断，连续 {n} 次失败` | 🔴 |
| Token 错配 | `{machine} 身份配置不匹配` | 🔴 |
| Fan-out 超时 | `任务组 {group_id} 超时，{n} 个 Worker 未回` | 🟡 |
| Gene 墓碑化 | `经验 {gene_topic} 因多次失败被淘汰` | ⚪ |

实现：Daemon 的 10 秒循环里顺带检查，触发时通过 MQTT 发 alert 到 `catbus/alert/nefi`，NeFi 的 Daemon 收到后用 Telegram Bot 通知主人。

```python
def health_check():
    """10 秒循环里的健康检查"""
    now = time.monotonic()
    for machine, last_ping in last_heartbeats.items():
        if now - last_ping > 60:
            send_alert(f"🔴 {machine} 心跳超时 {int(now - last_ping)}s")

    for machine, delays in recent_ack_delays.items():
        if len(delays) >= 3 and all(d > 10000 for d in delays[-3:]):
            send_alert(f"🟡 {machine} ACK 延迟连续异常: {delays[-3:]}ms")
```

---

## 十、MQTT 连接增强（新增）

### 10.1 连接参数可配置化

`/etc/catbus/config.json` 新增连接参数（不再硬编码）：

```json
{
  "mqtt": {
    "keepalive": 60,
    "clean_start": false,
    "session_expiry": 3600,
    "reconnect_min": 1,
    "reconnect_max": 30
  }
}
```

### 10.2 指数退避重连

```python
def on_disconnect(client, userdata, rc):
    delay = config["mqtt"]["reconnect_min"]  # 1s
    max_delay = config["mqtt"]["reconnect_max"]  # 30s
    while not connected:
        time.sleep(delay)
        try:
            client.reconnect()
        except Exception:
            delay = min(delay * 2, max_delay)  # 1→2→4→8→16→30
```

### 10.3 版本协商

每台机器的 `catbus/status/{machine}` retained 消息新增字段：

```json
{
  "online": true,
  "protocol_version": 2,
  "machine_skills": ["nextjs", "python"]
}
```

Manager 发任务前检查目标的 `protocol_version`，v1 机器发 v1 格式，v2 机器发 v2 格式。未来出 v3 时同理降级。

---

## 十一、安全设计（增强）

### 11.1 不变的
- TLS 加密（Mosquitto 8883）
- 用户名密码认证
- 每台机器独立凭证

### 11.2 新增
- **身份自检**：Daemon 启动时验证 SKILL.md token 与 openclaw config 一致
- **Bot 专属原则**：每个机器人只能用自己的 Bot Token
- **CatBus 通信原则**：机器人之间的消息必须走 CatBus，不能用 Bot API 代发
- **来源验证**：Daemon 检查消息的 `from` 字段是否与 MQTT 用户名一致

---

## 十二、v3 → v4 迁移

### 12.1 协议兼容

v4 协议 `"v": 2`，Daemon 同时支持 v1 和 v2 消息：
- 收到 v1 消息：按旧逻辑处理（不要求 ACK）
- 收到 v2 消息：要求 ACK + 结构化 result

### 12.2 迁移步骤

1. 更新 Daemon（加 ACK 追踪器 + 身份自检）
2. 更新 SKILL.md（加 ACK 流程 + 身份验证）
3. 更新 PROTOCOL.md（v2 消息格式）
4. 逐台部署，先狗子（SRE），再其他

### 12.3 不需要改的
- Broker 配置不变
- Topic 结构向后兼容（新 topic 是新增的）
- catbus_send.py 加 ack/result type 支持即可

---

## 十三、与其他项目的对比

| 维度 | CatBus v4 | agent-relay | agent-mail | qodex-ai |
|------|----------|-------------|------------|----------|
| 通信层 | MQTT（跨机器） | 文件系统（单机） | HTTP API（单机） | 内存（单进程） |
| 延迟 | ~50ms（跨洲） | <5ms（本地） | ~10ms（本地） | <1ms |
| ACK | ✅ 重试升级 | ✅ 重试升级 | ✅ ack_required | ❌ |
| 广播 | ✅ MQTT topic | ✅ TO: * | ❌ | ❌ |
| 经验库 | ✅ retained msg | ❌ | ❌ | ❌ |
| 文件锁 | ❌（不需要） | ❌ | ✅ reserve | ❌ |
| 跨机器 | ✅ 核心能力 | ✅ cloud 版 | ❌ | ❌ |
| 编排 | 串行/并行/广播 | 手动 | 手动 | 4种模式 |
| 可观测性 | ✅ 诊断命令+JSON日志+自动告警 | ✅ Dashboard | ❌ | ❌ |

**CatBus 的独特价值**：唯一一个基于 MQTT 的跨物理机器 AI Agent 通信系统，带经验库和自动衰减。

---

## 十四、实施优先级

| 优先级 | 功能 | 工作量 | 价值 |
|--------|------|--------|------|
| P0 | SKILL.md 加回报流程 | 小 | 解决"任务没回报"的核心问题 |
| P0 | 身份自检阻断启动（exit 1） | 小 | 防 Token 错配发错消息 |
| P1 | Daemon ACK 追踪器+重试（60s 首次） | 中 | 消息可靠性 |
| P1 | 可观测性（诊断命令+JSON日志+自动告警） | 中 | 快速定位问题 |
| P1 | 明确 queue.Queue + 线程模型 | 小 | 防生产竞态 |
| P1 | 启动恢复逻辑（state.json → 恢复/fail） | 小 | 防重启丢任务 |
| P1 | 中文 trigger_keys 匹配 | 小 | 经验库对中文场景有效 |
| P1 | 协议 v2 兼容 | 小 | 平滑升级 |
| P2 | 并行 Fan-out/Fan-in | 中 | 效率提升 |
| P2 | 经验库缓存+查询+衰减纠错 | 中 | 知识复用 |
| P2 | claim 纯 Daemon 化 | 小 | 减少延迟和 token 消耗 |
| P2 | MQTT 连接参数可配置+指数退避 | 小 | 运维友好 |
| P3 | 广播认领 | 小 | 灵活调度 |
| P3 | 质量反馈+积分 | 小 | 长期优化 |
| P3 | 合并维护循环 | 小 | 简化架构 |
| P3 | logrotate 配置 | 小 | 日志管理 |
| P3 | 版本协商 | 小 | 面向未来 |

**建议**：先做 P0（1-2 小时），立即解决最痛的两个问题。
