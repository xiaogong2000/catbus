# ClawHub Skill 重写 + `catbus ask` CLI 命令

## 背景

当前 ClawHub SKILL.md 是运维手册，不是能力接口。agent 读完不知道什么时候该调用 CatBus，也不知道怎么简洁地调用。

本次改动两件事：
1. 重写 SKILL.md — 让 agent 能正确触发
2. 新增 `catbus ask` 命令 — agent 一行 shell 调用，不用拼 curl + JSON

---

## 任务 1：实现 `catbus ask` CLI 命令

### 功能

```bash
catbus ask <selector> "<task>"
```

示例：

```bash
# 用最强模型
catbus ask model/best "解释 Python 的 GIL 机制"

# 用最快模型
catbus ask model/fast "把这段话翻译成英文：今天天气很好"

# 用视觉模型
catbus ask model/vision "描述这张图片的内容"

# 调用远程 skill
catbus ask tavily-web-search "latest AI agent frameworks 2026"
```

### 行为

```
catbus ask model/best "解释 GIL"
    ↓
向 localhost:8767/request 发 POST
    ↓
body: {"skill": "model/best", "input": {"task": "解释 GIL"}}
    ↓
等待响应
    ↓
提取 result 字段，纯文本输出到 stdout
```

### 要求

- 输出**只有结果文本**，不带 JSON 包装、不带 metadata。agent 拿到 stdout 就是答案，不需要再解析
- 如果失败，输出 `[CatBus Error] <原因>` 到 stderr，exit code 非 0
- 超时默认 120 秒，可通过 `--timeout` 覆盖
- 如果 daemon 没启动（localhost:8767 连不上），输出明确错误：`[CatBus Error] daemon 未运行，请先执行 catbus serve --daemon`

### 参考实现

```python
# 在 catbus CLI 入口（click 或 argparse）加子命令

@cli.command()
@click.argument("selector")
@click.argument("task")
@click.option("--timeout", default=120, help="请求超时秒数")
def ask(selector, task, timeout):
    """Send a task to the CatBus network and print the result."""
    import requests

    daemon_url = f"http://localhost:{get_port()}/request"

    try:
        resp = requests.post(
            daemon_url,
            json={"skill": selector, "input": {"task": task}},
            timeout=timeout
        )
    except requests.ConnectionError:
        click.echo("[CatBus Error] daemon 未运行，请先执行 catbus serve --daemon", err=True)
        sys.exit(1)
    except requests.Timeout:
        click.echo(f"[CatBus Error] 请求超时（{timeout}s）", err=True)
        sys.exit(1)

    if resp.status_code != 200:
        click.echo(f"[CatBus Error] {resp.status_code}: {resp.text}", err=True)
        sys.exit(1)

    data = resp.json()

    # 提取纯文本结果——根据实际返回结构调整字段名
    result = data.get("result") or data.get("output") or data.get("text") or str(data)
    click.echo(result)
```

> **注意：** `data` 的具体字段名取决于 daemon `/request` 接口的实际返回格式，请根据代码确认后调整提取逻辑。核心原则是 stdout 只输出结果文本。

### 验证

```bash
# daemon 运行中
catbus ask model/best "1+1等于几"
# 期望：stdout 输出答案文本，exit code 0

# daemon 未运行
catbus serve --stop  # 或 kill daemon
catbus ask model/best "test"
# 期望：stderr 输出错误信息，exit code 1

# 超时
catbus ask model/best "test" --timeout 1
# 期望：stderr 输出超时错误，exit code 1
```

---

## 任务 2：重写 SKILL.md

用以下内容**完整替换**现有 SKILL.md：

```markdown
---
name: catbus
description: >
  Access stronger AI models and remote skills from the CatBus network when local
  capabilities are insufficient. Provides virtual selectors like model/best
  (strongest available), model/fast (lowest latency), model/vision (image understanding),
  model/chinese (Chinese optimized). Also provides access to remote skills not
  installed locally (web search, data analysis, etc).
metadata:
  homepage: https://github.com/xiaogong2000/catbus
  source: https://github.com/xiaogong2000/catbus
  openclaw:
    requires:
      bins: ["python3", "pip", "catbus"]
    primaryEnv: "CATBUS_SERVER"
---

# CatBus — AI Agent Network

Access models and skills beyond your local setup through the CatBus distributed network.

## Use when

1. 用户要求使用更强的模型（"用最好的模型"、"用更强的"、"用 Claude/GPT 回答"）
2. 用户提到虚拟选择器：model/best, model/fast, model/vision, model/chinese
3. 本地模型无法完成任务，需要更强的推理、编码、视觉或长上下文能力
4. 用户需要本地未安装的 skill（如 web search、特定数据查询工具）
5. 用户明确提到 CatBus、网络调用、远程模型、其他节点

## Virtual Selectors

| Selector | 用途 | 适用场景 |
|----------|------|----------|
| model/best | 综合最强模型 | 复杂推理、编码、分析（默认选择） |
| model/fast | 速度优先 | 简单翻译、格式转换、快速问答 |
| model/vision | 视觉能力 | 图片描述、OCR、视觉分析 |
| model/chinese | 中文优化 | 中文写作、翻译、中文语境理解 |

## How to call

### 调用远程模型

```bash
catbus ask model/best "你的任务描述"
```

示例：

```bash
catbus ask model/best "解释 Python 的 GIL 机制，给出代码示例"
catbus ask model/fast "把以下内容翻译成英文：分布式系统的核心挑战"
catbus ask model/vision "描述这张架构图的内容"
catbus ask model/chinese "写一篇关于 AI Agent 发展趋势的分析"
```

### 调用远程 skill

```bash
catbus ask <skill-name> "任务描述"
```

示例：

```bash
catbus ask tavily-web-search "latest AI agent frameworks 2026"
```

### 查看网络中可用的 skill

```bash
curl -s http://localhost:8767/network/skills | python3 -m json.tool
```

## Output

`catbus ask` 直接输出结果文本到 stdout，无需解析 JSON。

成功时 exit code = 0，失败时 exit code = 1 且错误信息输出到 stderr。

## Prerequisites

CatBus daemon 必须在本地运行：

```bash
curl -s http://localhost:8767/health
```

如果未运行：

```bash
catbus serve --daemon
```

## Setup (first time only)

```bash
pip install catbus
catbus init
catbus serve --daemon
```
```

---

## 任务 3：部署验证

### 3.1 在开发环境验证 `catbus ask`

```bash
# 确认命令注册成功
catbus ask --help

# 实际调用
catbus ask model/best "1+1等于几"
```

### 3.2 把新 SKILL.md 部署到所有测试节点

```bash
# 所有装了 ClawHub skill 的节点都需要更新 SKILL.md
# 具体路径取决于 OpenClaw skill 安装位置
```

### 3.3 端到端测试

在一个 OpenClaw agent 上测试以下对话：

```
用户：用最好的模型解释一下 Python 的 GIL 机制
```

期望行为：
1. agent 匹配到 CatBus skill 的 "Use when" 条件
2. agent 执行 `catbus ask model/best "解释 Python 的 GIL 机制"`
3. relay 按 ELO 路由到最强在线节点
4. 结果返回给用户

如果 agent 没有触发 CatBus skill，说明 description 的关键词不够，需要调整。

---

## 不做的事

- ❌ 不做 `catbus ask` 的异步模式（长任务走 catbusin，不走 ClawHub skill）
- ❌ 不做 `catbus ask` 的流式输出（Phase 3 再考虑）
- ❌ 不改 daemon 的 `/request` 接口（`catbus ask` 是客户端 wrapper，不改服务端）
- ❌ 不改 relay 的任何逻辑

---

## 预估工作量

| 任务 | 工作量 |
|------|--------|
| `catbus ask` CLI 命令 | 1-2 小时 |
| SKILL.md 替换 | 10 分钟 |
| 部署 + 端到端测试 | 30 分钟 |

总计：半天内完成。
