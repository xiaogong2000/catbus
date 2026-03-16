# CatBus 设计方案总结

> 日期：2026-03-13
> 状态：方案定稿，Phase 1 开发中
整份方案的核心逻辑链：
定位：AI Agent 的 Uber，把闲置的模型算力和 Skill 能力变现。
切入点：从模型能力差切入 — DeepSeek 用户想用 Claude，Claude 用户额度闲着。不从 Skill 切，因为模型是每个用户已有的资产，零额外成本。
只做三件事：查（搜索/天气/股价）、生（图片/语音/翻译）、抓（网页/字幕）。不碰写操作和需要用户授权的事。
Provider 优先：飞轮从供给侧启动。Provider 想赚 Credits 就主动配好节点，一次粘贴 prompt 给 Agent 就完成注册。
Credits = Token：不需要人为定价，按实际 token 消耗算。提供能力赚 Credits，使用能力花 Credits，以物换物自循环。
派单策略：先到先得 → 批量匹配 → 信誉加权，跟滴滴的演进路径一致。
现状：核心链路已通，Provider 功能后端和前端同步开发中。


---

## 一、一句话定义

**CatBus 是 AI Agent 的 Uber。你的 Agent 闲着也是闲着，挂到网络上帮别人干活赚钱。**

---


## 二、解决什么问题

### 用户现状

每个 OpenClaw 用户都被锁在自己的模型和 Skill 里：

- 用户 A 跑本地 DeepSeek，免费但弱，复杂任务搞不定
- 用户 B 买了 Claude Pro，强但贵，每月额度经常用不完
- 用户 C 装了 Tavily 搜索，但没装图片生成
- 用户 D 装了 DALL-E，但没装搜索

每个人都有闲置的能力，同时又缺少别人拥有的能力。

### CatBus 做的事

把闲置的模型算力和 Skill 能力共享到网络，让 Agent 之间互相调用。

```
用户 A（DeepSeek）："帮我深度分析这份合同"
  → A 的模型搞不定
  → CatBus 网络 → B 的 Claude 接单执行
  → 专业级分析结果返回给 A
  → A 扣 Credits，B 赚 Credits
```

**本质：把闲置资源变现。** Uber 是闲置的车，Airbnb 是闲置的房，CatBus 是闲置的 API 额度和算力。

---

## 三、整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                      catbus.xyz                              │
│               Web 平台（Next.js 16）                         │
│   注册/登录 · Dashboard · Provider 配置 · 雇佣市场 · 收益    │
└─────────────────────┬───────────────────────────────────────┘
                      │ /api/dashboard/*
┌─────────────────────▼───────────────────────────────────────┐
│                   relay.catbus.xyz                            │
│                Relay Server（Python）                         │
│   节点注册 · 能力匹配 · 任务路由 · 抢单派单 · REST API       │
└─────────────────────────────────────────────────────────────┘
         ▲ WebSocket              ▲ WebSocket
┌────────┴──────────┐    ┌───────┴──────────────┐
│  Provider 节点     │    │   Caller 节点         │
│  catbus daemon    │    │   catbus daemon       │
│  localhost:9800   │    │   localhost:9800      │
│                   │    │                       │
│  本地模型 + Skill  │    │   CatBus SKILL.md    │
│  接单执行         │    │   发任务到网络         │
└───────────────────┘    └───────────────────────┘
```

### 三大组件

| 组件 | 运行位置 | 职责 |
|------|---------|------|
| **Relay Server** | 云端 VPS（mimi, 23.94.9.58） | WebSocket 中继 + 任务路由 + REST API |
| **CatBus Daemon** | 用户本地 | 常驻进程，连 Relay，暴露 localhost HTTP API |
| **CatBus SKILL.md** | OpenClaw 内 | 教 Agent 在本地做不了时把任务发到 CatBus |

### 技术优势 vs Google A2A

Google A2A 要求每个 Agent 有公网 HTTP 地址。CatBus 用 WebSocket Relay 中转，局域网 / NAT 后面的节点天然支持。这恰好是 OpenClaw 用户（个人电脑、家用网络）的真实场景。

---

## 四、最锋利的切入点：模型能力差

不从 Skill 切入，从**模型差异**切入。

每个 OpenClaw 用户已经有的东西就是一个大模型。模型就是他的"车"：

```
Claude Opus    — 顶级全能，月费贵
Claude Sonnet  — 代码/分析强，性价比高
GPT-4o         — 视觉理解强
DeepSeek V3    — 便宜，中文好
Llama 本地     — 免费，但能力有限
```

**供需天然存在**：用便宜模型的人想用好模型的能力，用好模型的人有闲置额度想回本。

**Credits = Token**：你用了我 2000 token 的 Claude，扣你 20 Credits。成本完全透明，不需要人为定价。

---

## 五、CatBus 只做三件事

从 ClawHub 13,000+ skills 分析，Call 类（需要外部 API/远程服务）共 178 个。CatBus 只接管其中 110 个，归为三类：

| 类型 | 数量 | 说明 | 举例 |
|------|------|------|------|
| **查** | ~60 | 查询实时信息，只读无副作用 | 搜索、天气、股价、新闻、汇率 |
| **生** | ~35 | 调用 AI 生成内容 | 生成图片、语音合成、AI 翻译、代码生成 |
| **抓** | ~15 | 抓取网页数据 | 网页截图、爬取内容、YouTube 字幕 |

### 不做的事

| 类别 | 原因 |
|------|------|
| 写操作（发邮件/发推文/操作账号） | 需要用户授权，安全风险 |
| 监控类（持续运行的任务） | 不适合 request-response 模式 |
| Install 类（本地工具） | 本地执行更快，不需要网络 |

---

## 六、用户请求的四个出口

```
用户："帮我做 X"

出口1 → 大模型自己做（翻译、写作、推理）
         CatBus 不干预

出口2 → 本地已装 Skill 做（装了 tavily 走 tavily）
         CatBus 不干预

出口3 → CatBus 网络找别人做 ★ 拦截这里 ★
         本地做不了，网络上有节点能帮忙

出口4 → 推荐去 ClawHub 安装
         网络上也没人能做
```

CatBus 精确插在**出口2失败之后、出口4之前**。

---

## 七、SKILL.md 设计

### 核心原则

跟 Tavily、stock-price 等所有现有 skill 保持一模一样的模式：**Agent 匹配上后直接一条 curl，一步直达。**

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
```

### 智能分工

```
Agent（大模型）     — 只负责：判断"做不了" + 一条 curl
CatBus Daemon      — 负责：自然语言 → skill name 映射
CatBus Relay       — 负责：粗筛节点 + 派单
Provider 节点       — 负责：判断"我能做" + 抢单 + 执行
```

Agent 端极简，复杂逻辑全部下沉到 daemon 和 relay。大模型不需要学任何新行为。

---

## 八、Uber 派单策略

### 协议（新增消息类型）

```
TASK_OFFER    — relay 推送给候选节点
BID           — 节点抢单
TASK_ASSIGN   — relay 确认派单
RESULT        — 执行结果（沿用现有）
```

### 分阶段演进

| 阶段 | 策略 | 说明 |
|------|------|------|
| Demo | 先到先得 | relay 粗筛后推给候选节点，第一个 BID 的直接派单 |
| 成长 | 批量匹配 | 2 秒窗口收集需求 + 节点，二分图全局最优匹配 |
| 成熟 | 信誉加权 | 服务分影响派单优先级 + Credits 动态定价 |

参考 Uber/滴滴的核心区别：Uber 的匹配维度是**物理距离**（70% 给最近的司机），CatBus 的维度是**能力匹配度**（模型/Skill 是否匹配 + 历史表现）。

---

## 九、Provider 是核心

### 飞轮逻辑

```
Provider 来了（因为能赚钱）
  → 网络上的能力变多
  → Caller 体验好（什么都能做）
  → Caller 变多
  → Provider 接单更多
  → 更多人来当 Provider
```

**起点是 Provider，不是 Caller。** 跟 Uber 早期先找司机一样。

### Provider 注册：一次粘贴，全部搞定

不需要在终端和网页之间来回切换，不需要手动编辑配置文件。

```
1. catbus.xyz 注册账号
2. Dashboard 点「Bind Agent」→ 复制一段 prompt
3. 粘贴给自己的 OpenClaw Agent
4. Agent 自动完成：安装 catbus → 收集模型和 Skill → 执行 catbus bind
5. Dashboard 展示识别结果 → 用户勾选确认 → 完成
```

整个过程 5 分钟。Agent 自己知道自己有什么模型、装了什么 Skill，让它自己汇报。

### 环境信息安全收集

**不扫描任何文件，不碰任何密钥。** 所有信息由 Agent 自行收集上报。

模型名称（如 `amazon-bedrock/global.anthropic.claude-sonnet-4-6`）通过内置 MODEL_DB 模糊匹配自动识别为 `claude-sonnet-4`，自动补全 provider/context_window/strengths。

Skill 列表通过内置 SKILL_DB 自动分类：
- **可共享**（110 个 Call 类）：tavily、image-gen、weather...
- **不可共享**（运维/授权类）：check-quotas、deploy-bot、github...

用户只需在 Dashboard 上看一眼自动识别的结果，勾选确认。

---

## 十、Credits 经济

### Credits = Token

Provider 帮你做一件事，成本就是 token：

```
搜索一次（Tavily）       → 1-2 Credits
翻译一段话（LLM）        → 5-10 Credits
生成一张图（DALL-E）     → 50-100 Credits
深度研究（多轮搜索+LLM） → 200-500 Credits
```

### 赚 Credits

| 行为 | Credits |
|------|---------|
| 接单完成（按 token 消耗） | 实际成本 × 1.5 |
| 首次上线奖励 | 100 |
| 连续在线 7 天 | 50 |
| 成功率 >95% 月度奖励 | 200 |
| 邀请新 Provider | 50/人 |

### 花 Credits

| 行为 | Credits |
|------|---------|
| 使用别人的大模型 | 按 token 消耗 |
| 使用别人的 Skill | 按 cost_level |
| 新用户赠送 | 100 |
| 充值 | Credits → 真实货币（未来） |

### 最优雅的闭环

**不想花钱买 Credits？把你闲置的 Skill 贡献出来赚。** 纯以物换物，网络自循环。只有纯 Caller（只用不提供）的人才需要充值。

---

## 十一、付费 API 分布

110 个 Call 类 Skill 中：

| 类别 | 数量 | 说明 |
|------|------|------|
| 完全免费 | ~20 | Wikipedia、CoinGecko、USGS |
| 有免费额度够用 | ~40 | Tavily 1000次/月、OpenWeatherMap 1000次/天 |
| 必须付费 | ~50 | DALL-E、ElevenLabs、Firecrawl... |

50 个付费 Skill 是 CatBus 最大的商业价值。用户自己用：注册 10 个 API + 配 key + 每月 $100+。用 CatBus：什么都不装，直接用。

---

## 十二、现有系统状态

### 已完成

| 组件 | 状态 |
|------|------|
| CatBus Client（pip 包） | ✅ v0.1.0，ClawHub v0.2.3 |
| Relay Server（WebSocket + REST API） | ✅ 在线运行 |
| 两个测试节点（浣浣 + 小黑） | ✅ 在线 |
| catbus.xyz 网站（注册/登录/Dashboard） | ✅ PM2 + Caddy |
| Dashboard 后端 API Phase 1+2 | ✅ 6 个 route |
| Relay 三个新端点（calls/summary/daily） | ✅ 已实现 |
| Token 绑定前端 | ✅ 已实现 |
| 雇佣市场前端 | ✅ 已实现 |

### 开发中

| 任务 | 负责 |
|------|------|
| catbus bind 扩展（--models/--skills） | 后端（我们） |
| provider_configs 表 + API | 后端（我们） |
| MODEL_DB / SKILL_DB 解析逻辑 | 后端（我们） |
| earnings / leaderboard API | 后端（我们） |
| Provider 配置确认页 | 前端工程师 |
| 绑定弹窗升级（prompt 模式） | 前端工程师 |
| 收益页 + 排行榜 | 前端工程师 |

### 部署环境

| 组件 | 机器 | 地址 |
|------|------|------|
| catbus.xyz | ge.ovh（浣浣） | 51.75.146.33 |
| relay server | mimi（咪咪） | 23.94.9.58 |
| 测试节点 1 | ge.ovh（浣浣） | 8 OpenClaw skills |
| 测试节点 2 | fr.ovh（小黑） | 4 demo skills |

---

## 十三、开发路线图

### Phase 1：Provider 上线接单

```
后端：
  □ catbus bind --models --skills
  □ provider_configs 表 + 迁移
  □ POST/GET provider-config API
  □ bind API 扩展（解析 models/skills）
  □ token/status API 扩展（返回 provider_config）
  □ MODEL_DB + SKILL_DB + extractBaseModel()
  □ REGISTER 消息携带 models + skills

前端：
  □ 绑定弹窗升级（prompt 模式）
  □ Provider 配置确认页
  □ My Agents 加 Provider badge
```

### Phase 2：收益可见

```
后端：
  □ earnings + credits 表
  □ 接单记录 token 消耗
  □ GET earnings / earnings/history API
  □ stats 接口扩展 earnings 字段

前端：
  □ 收益页
  □ Dashboard 概览加 earnings 卡片
  □ catbus earnings CLI 命令
```

### Phase 3：市场 + 排行

```
后端：
  □ GET leaderboard API
  □ 信誉分计算
  □ hire-market 展示模型信息

前端：
  □ 排行榜页面
  □ hire-market 展示 Provider 模型/Skill
```

### Phase 4：Credits 闭环

```
□ Caller 端扣 Credits
□ 新用户赠送 100 Credits
□ Credits 充值
□ SKILL.md 发布 + Uber 模式协议
□ 端到端验证
```

---

## 十四、参考项目

| 项目 | 参考价值 |
|------|---------|
| Uber / 滴滴 | 派单策略演进、供给侧先行的增长模型 |
| Tavily Skill | SKILL.md 写法、接管机制 |
| EvoMap / Evolver | Agent 间协作网络、Bounty 机制、Credits 体系 |
| Google A2A | 协议设计、Agent Card 概念、未来兼容方向 |
| OpenClaw Skill 生态 | 触发机制、用户行为、能力分类 |
