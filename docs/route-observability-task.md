# 路由可观测性 — 路由日志 + 响应来源信息

## 背景

虚拟选择器路由已上线，端到端验证通过。但现在无法得知：
- relay 选了哪个节点、为什么选它
- 用户拿到的结果是哪台机器、哪个模型生成的

需要加两层可观测性：relay 侧日志（给运维看）、响应元数据（给用户看）。

---

## 任务 1：relay 路由日志

**文件：** `server.py` 中 `resolve_virtual_selector` 函数

在 `resolve_virtual_selector` 返回前加一行日志：

```python
def resolve_virtual_selector(capability, candidates):
    config = SELECTOR_CONFIGS.get(capability)
    if config is None:
        config = SELECTOR_CONFIGS["model/best"]
        logger.info(f"[ROUTE] selector={capability} (未实现, fallback→model/best)")

    # ... 现有过滤和排序逻辑 ...

    # 在 return 前加这行
    if candidates:
        chosen = candidates[0]
        logger.info(
            f"[ROUTE] selector={capability} "
            f"candidates={[(c[0], c[1].meta.get('arena_elo', '?')) for c in candidates[:5]]} "
            f"→ chosen={chosen[0]} "
            f"(model={chosen[1].meta.get('model_name', '?')}, "
            f"elo={chosen[1].meta.get('arena_elo', '?')}, "
            f"strategy={config.get('sort_by', '?')})"
        )
    else:
        logger.info(f"[ROUTE] selector={capability} → NO CANDIDATES")

    return candidates
```

### 日志输出示例

```
[ROUTE] selector=model/best candidates=[('ge-ovh-test', 1550), ('xiaohei', 1350)] → chosen=ge-ovh-test (model=claude-opus-4-6, elo=1550, strategy=arena_elo)
[ROUTE] selector=model/chinese candidates=[('xiaohei', 1390)] → chosen=xiaohei (model=qwen3.5-397b, elo=1390, strategy=arena_elo)
[ROUTE] selector=model/vision → NO CANDIDATES
[ROUTE] selector=model/math (未实现, fallback→model/best)
```

### 要求

- 日志级别用 `INFO`，不要用 DEBUG（生产环境默认能看到）
- candidates 最多显示前 5 个，防止节点多了日志太长
- 每个字段都有 fallback 值（`'?'`），缺字段不报错

---

## 任务 2：响应中附带 provider 元数据

**文件：** relay 转发结果回消费者的逻辑

当 relay 拿到 provider 的执行结果后，在返回给消费者的数据中附加 `_catbus_meta` 字段：

```python
# relay 拿到 provider 返回的 result 后，附加元数据
response["_catbus_meta"] = {
    "provider_node": provider_node_id,      # 响应的节点 ID/名称
    "model_used": provider_model_name,       # 实际使用的模型
    "arena_elo": provider_arena_elo,         # 该模型的 ELO
    "selector": original_capability,         # 用户请求的选择器
    "latency_ms": round(elapsed_ms),         # 从发到收的耗时
}
```

### 字段说明

| 字段 | 来源 | 示例 |
|------|------|------|
| `provider_node` | 实际响应的节点标识 | `"ge-ovh-test"` |
| `model_used` | 该节点注册的模型名 | `"claude-opus-4-6"` |
| `arena_elo` | MODEL_DB 中的 ELO | `1550` |
| `selector` | 消费者原始请求的 capability | `"model/best"` |
| `latency_ms` | relay 从发送到收到结果的毫秒数 | `3420` |

### 要求

- 字段名用 `_catbus_meta`（下划线前缀），和业务数据区分开
- 任何字段取不到时填 `null`，不要省略字段
- 不改变现有 `result` 字段的结构，元数据是额外附加的

---

## 任务 3：`catbus ask` 显示来源信息

**文件：** `cli.py` 中 `ask` 命令

在输出结果文本之前，从响应中提取 `_catbus_meta`，打印一行来源信息到 **stderr**：

```python
@cli.command()
@click.argument("selector")
@click.argument("task")
@click.option("--timeout", default=120)
def ask(selector, task, timeout):
    # ... 发请求，拿到 data ...

    # 提取元数据，打印到 stderr（不影响 stdout 的纯文本结果）
    meta = data.get("_catbus_meta")
    if meta:
        node = meta.get("provider_node", "unknown")
        model = meta.get("model_used", "unknown")
        elo = meta.get("arena_elo", "?")
        latency = meta.get("latency_ms", "?")
        click.echo(
            f"[CatBus] 由 {node} 响应 ({model}, ELO {elo}, {latency}ms)",
            err=True  # 输出到 stderr
        )

    # 结果文本输出到 stdout
    result = data.get("result") or data.get("output") or data.get("text") or str(data)
    click.echo(result)
```

### 用户看到的效果

```bash
$ catbus ask model/best "解释 Python 的 GIL"
[CatBus] 由 ge-ovh-test 响应 (claude-opus-4-6, ELO 1550, 3420ms)

Python GIL（全局解释器锁）是 CPython 解释器中的一把互斥锁...
```

### 要求

- 来源信息输出到 **stderr**（`err=True`），stdout 保持纯文本结果
- 这样 agent 解析 stdout 不受影响，人在终端能看到来源
- 如果响应中没有 `_catbus_meta`（比如旧版 relay），不显示来源行，不报错
- `--quiet` 可选参数：加了就不显示来源行（给纯程序调用场景用）

---

## 任务 4：验证

### relay 日志验证

```bash
# 发一次请求
catbus ask model/best "test"

# 查 relay 日志
ssh relay-server
grep "[ROUTE]" /path/to/relay/logs | tail -5
```

期望看到：
```
[ROUTE] selector=model/best candidates=[...] → chosen=ge-ovh-test (model=claude-opus-4-6, elo=1550, strategy=arena_elo)
```

### 响应来源验证

```bash
# 正常调用，stderr 显示来源
catbus ask model/best "1+1"
# 期望 stderr: [CatBus] 由 ge-ovh-test 响应 (claude-opus-4-6, ELO 1550, 1234ms)
# 期望 stdout: 2

# 安静模式
catbus ask --quiet model/best "1+1"
# 期望 stderr: 无输出
# 期望 stdout: 2
```

### 完整测试矩阵

- [ ] `model/best` → 日志显示按 ELO 选了最高的节点
- [ ] `model/fast` → 日志显示按 latency 选了最快的节点
- [ ] `model/chinese` → 日志显示按 strength 过滤后选了 chinese 节点
- [ ] 响应中 `_catbus_meta` 字段完整（5 个字段都有值或 null）
- [ ] `catbus ask` 终端显示来源行
- [ ] `catbus ask --quiet` 不显示来源行
- [ ] agent 通过 `catbus ask` 调用时 stdout 不含来源信息（不干扰 agent 解析）

---

## 不做的事

- ❌ 不做日志持久化或日志轮转（relay 现有的日志机制够用）
- ❌ 不做 dashboard 或 web UI 展示路由数据
- ❌ 不做调用统计或计费相关的数据采集

---

## 预估工作量

| 任务 | 工作量 |
|------|--------|
| 任务 1：relay 路由日志 | 30 分钟 |
| 任务 2：响应附带元数据 | 1 小时 |
| 任务 3：`catbus ask` 显示来源 | 30 分钟 |
| 任务 4：验证 | 30 分钟 |

总计：半天内完成。
