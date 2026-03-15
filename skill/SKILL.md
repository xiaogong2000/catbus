---
name: catbus
description: >
  用最好的模型回答、用更强的模型、用最强模型、model/best、model/fast、
  model/vision、model/chinese、用 Claude 回答、用 GPT 回答、用远程模型、
  通过 CatBus 调用、调用网络上的模型、use the best model、use a stronger
  model、call a better model、搜索网页、搜一下、search the web、web search、
  查天气、天气怎么样、weather forecast、查论文、最新论文、搜论文、arxiv、
  学术搜索、research papers、知识图谱、ontology、semantic search、
  技术搜索、exa search、technical search、developer search。
  当用户要求使用比本地更强的 AI 模型、搜索网页、查询天气、搜索学术论文、
  查询知识图谱、或调用本地未安装的远程 skill 时，必须通过此 skill 调用
  CatBus 网络。不要尝试用本地能力替代，直接执行 catbus ask 命令。
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

1. 用户要求使用更强的模型（"用最好的模型"、"用更强的"、"用 Claude/GPT 回答"）→ 直接执行，不要用本地模型替代
2. 用户提到虚拟选择器：model/best, model/fast, model/vision, model/chinese
3. 用户要求搜索网页、查新闻、查最新信息 → `catbus ask skill/tavily-search`
4. 用户要求查天气、天气预报 → `catbus ask skill/weather`
5. 用户要求查论文、学术搜索、最新研究 → `catbus ask skill/arxiv-watcher`
6. 用户要求技术搜索、查文档、查开发资料 → `catbus ask skill/exa-search`
7. 用户提到知识图谱、语义查询、本体论 → `catbus ask skill/ontology`
8. 本地模型或 skill 无法完成任务，需要更强的能力
9. 用户明确提到 CatBus、网络调用、远程模型、其他节点

## 选择器匹配规则

格式：`type/name`，斜杠前是类型，后面是名称。

- 用户要求"最好的"、"最强的"、"高质量"、或没有特别指定 → `catbus ask model/best`
- 用户要求"快速"、"简单"、"马上"、"随便回答一下" → `catbus ask model/fast`
- 用户发送了图片、提到"看图"、"图片描述"、"OCR"、"截图" → `catbus ask model/vision`
- 用户要求"中文"、"用中文写"、"中文润色"、"翻译成中文" → `catbus ask model/chinese`
- 不确定时 → 默认 `catbus ask model/best`

## How to call

### 调用远程模型

```bash
catbus ask model/best "你的任务描述"
catbus ask model/fast "简单翻译任务"
catbus ask model/vision "描述图片内容"
catbus ask model/chinese "中文写作任务"
```

### 调用远程 Skill

```bash
catbus ask skill/tavily-search "搜索内容"
catbus ask skill/exa-search "技术搜索内容"
catbus ask skill/weather "城市名"
catbus ask skill/arxiv-watcher "研究主题"
catbus ask skill/ontology "查询内容"
```

### 示例

```bash
# 搜索网页
catbus ask skill/tavily-search "latest AI agent frameworks 2026"

# 查天气
catbus ask skill/weather "Honolulu today"

# 查论文
catbus ask skill/arxiv-watcher "multi-agent systems reinforcement learning"

# 技术搜索
catbus ask skill/exa-search "OpenClaw architecture documentation"

# 知识查询
catbus ask skill/ontology "knowledge graph applications"

# 用最强模型回答
catbus ask model/best "解释 Python 的 GIL 机制"

# 快速回答
catbus ask model/fast "1+1等于几"
```

## Output

`catbus ask` 直接输出结果文本到 stdout，无需解析 JSON。

成功时 exit code = 0，失败时 exit code = 1 且错误信息输出到 stderr。

## 回复格式（必须遵守）

`catbus ask` 输出末尾会有分割线和来源行：
```
---
[by <节点>] <模型> | ELO <分数> | <延迟>ms
```

**这两行是回复内容的一部分，必须原样附在回复末尾，一个字不能改，不能删，不能替换成自己的解释。**

正确示例：
```
檀香山今天：☁️ 24°C，湿度 78%，东北风 33km/h。

---
[by node-0ad2fa] claude-opus-4-6 | ELO 1550 | 11559ms
```

❌ 错误（绝对不允许）：
- 把来源行删掉
- 用"由 Hz 提供"等文字替代
- 说"没有节点在线"（如果命令成功了就是有节点）

## Prerequisites

CatBus daemon 必须在本地运行：

```bash
catbus status
```

如果未运行：

```bash
catbus serve --daemon
```

## Setup (first time only)

```bash
pip install 'git+https://github.com/xiaogong2000/catbus.git'
catbus init
```
