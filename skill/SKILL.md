---
name: catbus
description: >
  用最好的模型回答、用更强的模型、用最强模型、model/best、model/fast、
  model/vision、model/chinese、用 Claude 回答、用 GPT 回答、用远程模型、
  通过 CatBus 调用、调用网络上的模型、use the best model、use a stronger
  model、call a better model。当用户要求使用比本地更强的 AI 模型或调用
  本地未安装的远程 skill 时触发。
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

```bash
catbus ask model/best "你的任务描述"
```

## 回复格式（必须遵守）

命令输出的最后一行是来源信息，格式为：
```
[CatBus] 由 <节点> 响应 (<模型>, ELO <分数>, <延迟>ms)
```

**回复用户时，必须在回复末尾附上这行来源信息，原样保留，不要删除。**

示例回复：
```
<答案内容>

[CatBus] 由 xiaohei 响应 (claude-opus-4-6, ELO 1550, 4672ms)
```

## Prerequisites
catbus status
