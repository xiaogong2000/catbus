# 模型自动探测与持续扫描 — 部署文档

> 日期：2026-03-14
> 范围：两个改动点，涉及 3 个文件

---

## 改了什么

### 改动 1：catbus init 自动探测并注册

之前 `catbus init` 只生成 node_id 和一个带 echo skill 的空 config.yaml，用户必须手动编辑才能注册模型。

现在 `catbus init` 在创建 config 后立即执行：
1. 探测本机模型（三层 fallback：Gateway API → 自我识别 prompt → 响应指纹）
2. 扫描本机 OpenClaw skills
3. 把探测结果**写入 config.yaml**

用户装完 `pip install catbus && catbus init`，config.yaml 里就已经有正确的 models 和 skills，不需要任何手动配置。

### 改动 2：daemon 每 5 分钟轻探测模型

之前 daemon 的 heartbeat loop 每 5 分钟扫描 skill 目录变更，但**完全不检测模型**。用户换了模型（Claude → GPT），relay 侧不知道。

现在 heartbeat loop 里 skill 扫描和模型轻探测同频执行（都是每 5 分钟一次）。轻探测只执行 `GET /v1/models`，不发 prompt，零 token 消耗，耗时 <0.1 秒。检测到变更后自动重新注册到 relay。

---

## 涉及文件

| 文件 | 状态 | 改动说明 |
|------|------|---------|
| `cli.py` | 修改 | `cmd_init()` 增加 detect + scan + 写 config.yaml |
| `daemon.py` | 修改 | `_heartbeat_loop()` 增加模型轻探测，`SCAN_INTERVAL = 300` |
| `detector.py` | 新增 | 三层探测引擎（`cli.py` 和 `daemon.py` 都调它） |

`detector.py` 是新文件，`cli.py` 和 `daemon.py` 是在已有文件基础上改的。

---

## 部署步骤

### 1. 把 3 个文件传到节点

```bash
CATBUS_DIR=$(python3 -c "import catbus, os; print(os.path.dirname(catbus.__file__))")

# 备份
cp "$CATBUS_DIR/cli.py" "$CATBUS_DIR/cli.py.bak"
cp "$CATBUS_DIR/daemon.py" "$CATBUS_DIR/daemon.py.bak"

# 覆盖
cp detector.py "$CATBUS_DIR/"
cp cli.py "$CATBUS_DIR/"
cp daemon.py "$CATBUS_DIR/"
```

浣浣和小黑都要部署。

### 2. 验证 detector 可用

```bash
python3 -c "from catbus.detector import detect_models; print('OK')"
```

### 3. 重新 init（可选但推荐）

如果想让已有节点也享受自动探测：

```bash
# 备份现有 config
cp ~/.catbus/config.yaml ~/.catbus/config.yaml.bak

# 重新 init（node_id 不变，只重写 config.yaml）
catbus init
```

预期输出：

```
🔑 Node ID already exists: a1b2c3d4e5f6
📁 Config already exists: ~/.catbus/config.yaml

🔍 Detecting installed models...
  🟢 model/claude-sonnet-4 (gateway_api, high)

🔍 Scanning OpenClaw skills...
  ✅ skill/tavily
  ✅ skill/echo
  ✅ skill/agent

📝 Config updated: 1 model(s) + 3 skill(s)
✅ CatBus initialized
```

如果 Gateway 没跑，探测会 graceful fail，config.yaml 只有 skills 没有 models，不影响启动。

### 4. 重启 daemon

```bash
catbus serve --daemon
```

启动日志里会多一段：

```
🔍 Startup model detection...
  🧠 Detected: model/claude-sonnet-4 (gateway_api, high)
📋 Registered: ['model/claude-sonnet-4', 'skill/tavily', 'skill/echo']
```

之后每 5 分钟会在心跳日志里看到轻探测（只有变更时才打日志）：

```
🔄 Skill change detected
📡 Re-registering with relay...
```

或

```
🆕 Models added: {'model/gpt-4o'}
📡 Re-registering with relay...
```

---

## 探测时机全览

部署完成后，模型探测在以下时机触发：

| 时机 | 探测方式 | 成本 | 触发条件 |
|------|---------|------|---------|
| `catbus init` | 完整三层 | ~5s, ~100 token | 用户首次安装 |
| daemon 启动 | 完整三层 | ~5s, ~100 token | 每次 `catbus serve` |
| 心跳（每 5 分钟） | 只 GET /v1/models | <0.1s, 0 token | 自动，与 skill 扫描同频 |
| model/ 任务 Gateway 报错 | 只 GET /v1/models | <0.1s, 0 token | 502/503/timeout 时触发 |
| `POST localhost:9800/detect` | 完整三层 | ~5s, ~100 token | Dashboard 手动触发 |
| `catbus detect` | 完整三层 | ~5s, ~100 token | 用户手动执行 |

日常运行只有"每 5 分钟轻探测"在跑，和读一次 skill 目录一样轻量。

---

## daemon.py 改动详解

heartbeat loop 的 before/after：

```python
# ═══ 改之前 ═══
async def _heartbeat_loop(self):
    scan_interval = 300
    last_scan = time.time()
    last_capabilities = self._get_current_capabilities()  # 只扫 skill 目录

    while True:
        await asyncio.sleep(30)
        # ... 发心跳 ...

        if time.time() - last_scan > scan_interval:
            last_scan = time.time()
            current = self._get_current_capabilities()    # 只扫 skill 目录
            if current != last_capabilities:
                last_capabilities = current
                await self._send_register()


# ═══ 改之后 ═══
async def _heartbeat_loop(self):
    last_scan = time.time()
    last_skill_dirs = self._get_current_skill_dirs()

    while True:
        await asyncio.sleep(30)
        # ... 发心跳 ...

        now = time.time()
        if now - last_scan < SCAN_INTERVAL:         # SCAN_INTERVAL = 300 (5分钟)
            continue

        last_scan = now
        need_reregister = False

        # Skill 目录变更（跟之前一样）
        current_dirs = self._get_current_skill_dirs()
        if current_dirs != last_skill_dirs:
            last_skill_dirs = current_dirs
            need_reregister = True

        # 模型轻探测（新增，GET /v1/models，零 token）
        model_changed = await self._detect_models_light()
        if model_changed:
            need_reregister = True

        if need_reregister:
            await self._send_register()
```

关键点：skill 和 model 共用一个 `SCAN_INTERVAL = 300`，共用一个 `need_reregister` 标志，变了才重新注册。

---

## cli.py cmd_init 改动详解

```python
# ═══ 改之前 ═══
def cmd_init(args):
    # 1. 生成 node_id
    # 2. 写默认 config.yaml（只有 echo skill）
    # 完了


# ═══ 改之后 ═══
def cmd_init(args):
    # 1. 生成 node_id（不变）
    # 2. 写默认 config.yaml（不变）
    # 3. 探测模型 ← 新增
    from .detector import detect_models
    results = asyncio.run(detect_models())
    # 4. 扫描 skills ← 新增
    from .scanner import scan_to_capabilities
    skill_caps = scan_to_capabilities()
    # 5. 把探测结果写入 config.yaml ← 新增
    #    合并：手动配置 + 探测模型 + 扫描 skills → 去重 → yaml.dump
```

---

## 验证命令

```bash
# 1. 确认 init 自动探测生效
catbus init
cat ~/.catbus/config.yaml | grep "model/"
# 应该看到类似：name: model/claude-sonnet-4

# 2. 确认 daemon 启动时探测
catbus serve  # 前台跑，看日志
# 日志里应该有：
# 🔍 Startup model detection...
# 🧠 Detected: model/claude-sonnet-4 (gateway_api, high)

# 3. 确认 5 分钟扫描在跑
# 等 5 分钟，或者中途切换模型配置看日志
# 如果模型没变，不会打日志（静默）
# 如果模型变了：
# 🆕 Models added: {'model/gpt-4o'}
# 📡 Re-registering with relay...

# 4. 确认 status 显示探测结果
catbus status
# 应该看到 Detected: ['model/claude-sonnet-4']

# 5. 确认手动探测
catbus detect
catbus detect --json
```

---

## 回滚

```bash
CATBUS_DIR=$(python3 -c "import catbus, os; print(os.path.dirname(catbus.__file__))")
cp "$CATBUS_DIR/cli.py.bak" "$CATBUS_DIR/cli.py"
cp "$CATBUS_DIR/daemon.py.bak" "$CATBUS_DIR/daemon.py"
rm "$CATBUS_DIR/detector.py"
catbus serve --daemon
```

config.yaml 不需要回滚，新增的 `capabilities:` 字段会被老版代码忽略。
