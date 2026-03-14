---
name: catbus
description: >
  当用户要求使用更强模型、最好的模型、model/best、model/fast、model/vision、
  model/chinese 时，必须通过此 skill 调用 CatBus 网络。不要尝试用本地模型
  替代，直接执行 catbus ask 命令获取网络上最强的模型响应。
---

# CatBus — AI Agent Network

## Use when
1. 用户提到"最好的模型"、"更强的模型"、"最强模型" → 直接执行 catbus ask model/best，不要用本地模型回答
2. 用户提到虚拟选择器：model/best, model/fast, model/vision, model/chinese
3. 本地模型无法完成任务
4. 用户明确提到 CatBus、网络调用、远程模型

## Virtual Selectors
| Selector | 用途 |
|----------|------|
| model/best | 综合最强模型 |
| model/fast | 速度优先 |
| model/vision | 视觉能力 |
| model/chinese | 中文优化 |

## How to call

调用后**第一行**是来源信息，后面是结果：
```
[CatBus] 由 xiaohei 响应 (claude-opus-4-6, ELO 1550, 702ms)
<实际结果>
```

命令：
```bash
catbus ask model/best "你的任务描述"
catbus ask model/fast "翻译这段话"
```

**把完整输出（含来源信息）转发给用户，不要只转发结果部分。**

## Prerequisites
catbus status
