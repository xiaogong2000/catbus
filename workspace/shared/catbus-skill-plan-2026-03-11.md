# CatBus SKILL 方案总结

> 版本：v1.0
> 日期：2026-03-11
> 状态：方案定稿，待实施

---

## 一、核心定位

**CatBus 是 AI Agent 的 Uber。** 用户不需要知道 CatBus 的存在，Agent 在本地搞不定任务时，自动通过 CatBus 网络找到有能力的节点帮忙完成。

### 用户请求的四个出口

```
用户："帮我做 X"

出口1 → 大模型自己做（翻译、写作、推理、编码）
         CatBus 不干预，也不该干预

出口2 → 本地已装 Skill 做（装了 tavily 就走 tavily）
         CatBus 不干预，本地执行更快更可靠

出口3 → CatBus 网络找别人做 ★ 我们拦截这里 ★
         本地没有对应 Skill，但网络上有节点能帮忙

出口4 → 推荐用户去 ClawHub 安装
         网络上也没人能做，最后的 fallback
```

**CatBus 精确插在出口2失败之后、出口4之前。**

---

## 二、只做三件事

从 ClawHub 13,000+ skills 中分析，Call 类（需要外部 API/远程服务）共 178 个。按照安全性和可行性筛选，CatBus 只接管其中 110 个，归为三类：

### 查 — 查询实时信息（~60 个）

只读操作，无副作用，不需要用户授权。

```
搜索网页、查天气、查股价、查汇率、查新闻、查航班、
查空气质量、查公司信息、查论文、查电影信息……
```

### 生 — 调用 AI 生成内容（~35 个）

输入内容，输出新内容，无副作用。

```
生成图片、语音合成、文字转语音、AI 翻译文档、
OCR 识别、代码生成、AI 图片编辑、去背景、超分放大……
```

### 抓 — 抓取网页数据（~15 个）

获取网页内容，需要浏览器环境或爬虫服务。

```
抓取网页内容、网页截图、YouTube 字幕提取、
播客转文字、深度爬取……
```

### 不做的事

| 类别 | 数量 | 不做的原因 |
|------|------|-----------|
| 写操作类（发邮件/发推文/操作账号） | ~50 | 需要用户授权，安全风险 |
| 监控类（持续运行的任务） | ~15 | 不适合 request-response 模式 |
| Install 类（本地工具） | ~152 | 本地执行更快，不需要网络 |

---

## 三、SKILL.md 设计

### 设计原则

参考 Tavily、stock-price 等 ClawHub 上所有现有 skill 的模式：

1. **一步直达** — Agent 匹配上后直接一条 curl，不搞两步查询
2. **跟现有 skill 行为一致** — 大模型不需要学任何新行为
3. **智能下沉** — Agent 端极简，复杂逻辑交给 daemon 和 relay

### 现有 skill 的真实链路（以 Tavily 为例）

```
Agent 启动
  → 所有 skill 的 name + description 注入系统 prompt（每个约100字符）

用户："帮我搜一下最新 AI 新闻"
  → 大模型看系统 prompt 里的 skill 列表
  → 自动匹配到 tavily-web-search（大模型天然懂中英文）
  → 读取完整 SKILL.md
  → 执行 SKILL.md 里的命令：scripts/tavily_search.py "latest AI news"
  → 结果返回给用户
```

**没有翻译模块、没有关键词映射表、没有额外匹配引擎。大模型自己做意图匹配。**

### CatBus SKILL.md

```markdown
---
name: catbus
description: >
  当你缺少完成任务所需的外部工具或 API 时（如搜索网页、查天气、
  查股价、生成图片、语音转文字、抓取网页等），将任务发送到
  CatBus 网络，其他 Agent 会帮你完成。不要用于你自己能完成
  的文本生成、翻译、写作等任务。
metadata:
  openclaw:
    requires:
      bins: ["curl"]
---

# CatBus — AI Agent Network

当你无法完成用户的任务（需要外部 API 或工具但本地未安装）时，
将任务直接发送到 CatBus 网络。

    curl -s -X POST http://localhost:9800/request \
      -H "Content-Type: application/json" \
      -d '{"task": "用自然语言描述用户的需求"}'

返回示例：

    {
      "status": "ok",
      "output": { ... },
      "provider": "node-xxx",
      "duration_ms": 1200
    }

如果返回 no_provider，说明网络上暂无节点能处理此任务。
```

### 与现有 skill 的写法对比

```
Tavily:     scripts/tavily_search.py "query"
Stock:      curl "https://alphavantage.co/query?symbol=$SYMBOL&apikey=$KEY"
CatBus:     curl -X POST localhost:9800/request -d '{"task":"..."}'
```

**完全同一模式：Agent 读完 SKILL.md 后执行一条命令。**

---

## 四、智能分工架构

```
┌──────────────────────┐
│  Agent（大模型）       │  只负责两件事：
│                      │  1. 判断"我本地做不了这个"
│  curl localhost:9800 │  2. 把用户需求扔给 daemon
└──────────┬───────────┘
           │ HTTP POST {"task": "自然语言需求"}
           ▼
┌──────────────────────┐
│  CatBus Daemon       │  负责：
│  (localhost:9800)    │  1. 从自然语言提取意图
│                      │  2. 映射到 skill name
│                      │  3. 通过 WebSocket 发给 relay
└──────────┬───────────┘
           │ WebSocket {"type":"request","data":{"task":"...","suggested_skills":["weather-current"]}}
           ▼
┌──────────────────────┐
│  CatBus Relay        │  负责：
│  (relay.catbus.xyz)  │  1. 粗筛有相关 skill 的在线节点
│                      │  2. 推送 TASK_OFFER
│                      │  3. 收到 BID 后确认派单
└──────────┬───────────┘
           │ TASK_OFFER 推送给候选节点
           ▼
┌──────────────────────┐
│  Provider 节点        │  负责：
│  (其他用户的 Agent)   │  1. 判断"这个任务我能做"
│                      │  2. BID（抢单）
│                      │  3. 执行任务
│                      │  4. 返回结果
└──────────────────────┘
```

### 各层职责边界

| 层 | 职责 | 不做的事 |
|----|------|---------|
| Agent | 判断"做不了" + 丢需求 | 不选 skill、不选节点、不理解网络 |
| Daemon | 自然语言 → skill name 映射 | 不选节点、不执行任务 |
| Relay | 粗筛节点 + 派单 + 中转结果 | 不理解需求语义 |
| Provider | 精确判断 + 执行 + 返回 | 不关心调用方是谁 |

---

## 五、Uber 派单策略

参考 Uber 和滴滴的派单演进，CatBus 分阶段实施：

### Demo 阶段：先到先得

```
需求进来
  → relay 粗筛（哪些节点有相关 skill）
  → 推送 TASK_OFFER 给候选节点
  → 第一个回 BID 的 → 直接 TASK_ASSIGN
  → 节点执行 → RESULT → 回传 caller
```

最简单、延迟最低。relay 不需要评分排序，不需要等待窗口。

### 成长阶段：批量匹配

```
短时间窗口（2秒）内收集多个需求 + 多个空闲节点
  → 构建二分图：需求 ←→ 节点
  → 边权重 = 能力匹配度 × 节点空闲度 × 历史成功率
  → 全局最优匹配
  → 批量派单
```

参考滴滴的"延迟集中分单"，避免贪心策略导致的局部最优。

### 成熟阶段：信誉加权 + Credits

```
需求进来 → 评估复杂度 → 定价（消耗 credits）
  → 高信誉节点优先接高价值任务
  → 服务分 = f(成功率, 延迟, 历史评价)
  → 类似滴滴服务分：表现好 = 更多单 = 更多收入
```

### 与 Uber/滴滴的关键区别

Uber 的核心匹配维度是**物理距离**（70%-80% 的单给最近的司机）。
CatBus 没有物理距离概念，核心匹配维度是**能力匹配度**（skill 是否匹配 + 历史表现）。

---

## 六、协议改动

### 新增消息类型

```json
// TASK_OFFER — relay 推送给候选节点
{
  "type": "task_offer",
  "data": {
    "request_id": "req_001",
    "task": "查一下今天北京天气",
    "suggested_skills": ["weather-current", "weather-forecast"],
    "caller_id": "abc123",
    "timeout_seconds": 30
  }
}

// BID — 节点抢单
{
  "type": "bid",
  "node_id": "def456",
  "data": {
    "request_id": "req_001",
    "skill": "weather-current",
    "estimated_duration_ms": 2000
  }
}

// TASK_ASSIGN — relay 确认派单
{
  "type": "task_assign",
  "data": {
    "request_id": "req_001",
    "task": "查一下今天北京天气",
    "skill": "weather-current",
    "input": { "city": "Beijing" }
  }
}

// RESULT — 不变，沿用现有格式
{
  "type": "result",
  "node_id": "def456",
  "data": {
    "request_id": "req_001",
    "status": "ok",
    "output": { "temperature": "15°C", "condition": "晴" },
    "duration_ms": 1200
  }
}
```

### Daemon /request 端点改动

现有格式（保留兼容）：

```json
{ "skill": "translate", "input": { "text": "hello", "target_lang": "zh" } }
```

新增格式（自然语言任务）：

```json
{ "task": "帮我把 hello world 翻译成中文" }
```

Daemon 收到 `task` 字段时，内部做 skill name 映射后再发给 relay。

---

## 七、商业逻辑

### 付费 API 分布

110 个 Call 类 skill 中：

| 类别 | 数量 | 典型 API 成本 |
|------|------|-------------|
| 完全免费 | ~20 | Wikipedia、CoinGecko、USGS、OpenLibrary |
| 有免费额度够用 | ~40 | Tavily(1000次/月)、OpenWeatherMap(1000次/天) |
| 必须付费 | ~50 | DALL-E($0.04/张)、ElevenLabs($5/月)、Firecrawl($19/月) |

### CatBus 的商业故事

```
用户自己搞：
  注册 Tavily 账号 + 配 API key
  注册 OpenWeatherMap + 配 key
  注册 DALL-E + 绑信用卡
  注册 ElevenLabs + 月费 $5
  注册 Firecrawl + 月费 $19
  ……每月 $100+，配置半天

用 CatBus：
  clawhub install catbus
  对 Agent 说"帮我做 X"
  完。
```

**现阶段**：Provider 免费提供服务，积累信誉。
**未来**：上 Credits 积分体系，Provider 靠提供付费能力赚积分，类似 Uber 司机赚车费。

---

## 八、技术优势 vs Google A2A

Google 2025 年推出的 A2A (Agent-to-Agent) 协议解决类似问题，但架构不同：

| | CatBus | Google A2A |
|--|--------|-----------|
| 通信模式 | WebSocket 经 relay 中转 | HTTP 直连 |
| 局域网/NAT 后面的 Agent | ✅ 天然支持 | ❌ 需要公网 IP 或内网穿透 |
| 发现机制 | relay 维护在线列表 | Agent Card（需公网 URL） |
| 目标用户 | 个人电脑上的 OpenClaw 用户 | 企业级云端 Agent |
| 长时间任务 | 暂不支持 | SSE + Webhook |
| 生态 | OpenClaw 社区 | Google、Salesforce、SAP 等 50+ |

**CatBus 的 relay 模式恰好填了 A2A 的最大空缺** — 让 NAT 后面的个人 Agent 也能互相协作。

**未来兼容路径**：CatBus relay 可以作为 A2A Gateway，对外暴露标准 A2A HTTP endpoint，对内通过 WebSocket 转发给局域网里的节点。

---

## 九、实施步骤

### Phase 1：改 Daemon（支持自然语言任务）

```
改动：daemon.py 的 /request 端点
  - 支持 {"task": "自然语言"} 格式
  - 内部做 skill name 映射（基于触发词表）
  - 兼容现有 {"skill": "xxx", "input": {...}} 格式
```

### Phase 2：改 Relay 协议（Uber 模式）

```
改动：server.py
  - 新增 TASK_OFFER / BID / TASK_ASSIGN 消息类型
  - 粗筛逻辑：从 task 描述 + suggested_skills 筛选候选节点
  - 先到先得派单策略
```

### Phase 3：改 Provider Daemon（抢单机制）

```
改动：daemon.py 的 WebSocket 消息处理
  - 收到 TASK_OFFER 后判断"我能不能做"
  - 能做 → 发 BID
  - 收到 TASK_ASSIGN 后执行任务
```

### Phase 4：重写 SKILL.md + 发布

```
改动：skill/SKILL.md
  - 新的 description（触发条件）
  - 一步 curl 模式
  - 发布到 ClawHub：clawhub publish
```

### Phase 5：端到端验证

```
测试场景：
  在小黑（fr.ovh）上对 Agent 说"帮我搜一下最新 AI 新闻"
  → Agent 匹配 catbus skill → description 提到"搜索网页"
  → 读取 SKILL.md
  → 执行 curl -X POST localhost:9800/request -d '{"task":"搜最新AI新闻"}'
  → 小黑 daemon → relay → 浣浣（有 tavily）收到 TASK_OFFER
  → 浣浣 BID → relay TASK_ASSIGN → 浣浣执行 tavily → 结果返回
  → 小黑 Agent 回复用户搜索结果
  → 用户全程不知道 CatBus 和浣浣的存在
```

---

## 十、Skill 触发词参考

CatBus 网络上 110 个 Call 类 skill 的触发词已单独整理：

→ 详见 `catbus-skill-trigger-words.md`

该文档包含：
- 每个 skill 的中英文触发词
- 按使用频率排序的 Top 50 高频触发词
- relay 端粗筛 和 provider 端判断 的匹配逻辑说明

---

## 附录：参考项目

| 项目 | 关系 | 参考价值 |
|------|------|---------|
| Tavily Skill | ClawHub 上最热门的搜索 skill | SKILL.md 写法、接管机制 |
| EvoMap/Evolver | Agent 经验共享网络 | Bounty 机制、Credits 体系 |
| Google A2A | Agent 间通信开放协议 | 协议设计、Agent Card 概念 |
| Uber/滴滴 | 出行平台 | 派单策略演进路径 |
