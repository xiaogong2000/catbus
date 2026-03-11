# CatBus 前端需求文档 — Provider 功能

> 日期：2026-03-12
> 状态：后端开发中，前端可同步开发页面和交互
> 设计风格：遵循 catbus-ui-design-spec.md（Deep Space Tech）

---

## 概述

新增 Provider 功能模块，让用户把自己的模型和 Skill 共享到 CatBus 网络赚 Credits。核心改动：

1. **绑定流程升级** — 现有 Bind Agent 弹窗改为"一步绑定"模式（复制 prompt 给 Agent）
2. **Provider 配置页** — 绑定成功后展示识别结果，用户确认共享内容
3. **收益页** — Provider 查看赚了多少 Credits
4. **排行榜** — 全网 Provider 排名
5. **Dashboard 概览扩展** — 加 earnings 卡片

---

## 一、绑定流程升级

### 现有流程

```
点击 Bind Agent → 生成 token → 展示 catbus bind <token> → 轮询状态
```

### 新流程

```
点击 Bind Agent → 生成 token → 展示完整 prompt（含 token）→ 用户复制发给 Agent → 轮询状态 → 绑定成功后展示 Provider 配置确认页
```

### 1.1 Bind Agent 弹窗改动

**触发**：Dashboard My Agents 页面点击「Bind Agent」按钮

**弹窗内容**：

```
┌─ Bind Your Agent ──────────────────────────────────────────┐
│                                                            │
│  STEP 1                                                    │
│  Copy & Paste to Your Agent                                │
│                                                            │
│  把下面这段话发给你的 OpenClaw Agent，                       │
│  它会自动完成安装、环境检测和绑定：                           │
│                                                            │
│  ┌────────────────────────────────────────────────────┐    │
│  │ 请帮我完成 CatBus 节点绑定：                        │    │
│  │                                                    │    │
│  │ 1. 检查 catbus 是否已安装，没有则执行：              │    │
│  │    pip install catbus && catbus init               │    │
│  │                                                    │    │
│  │ 2. 检查我当前的环境：                               │    │
│  │    - 我用的什么模型？列出所有模型名称                │    │
│  │    - 我装了哪些 Skill？列出所有 skill 名称          │    │
│  │                                                    │    │
│  │ 3. 执行绑定命令（把环境信息一起上报）：              │    │
│  │    catbus bind {TOKEN} \                           │    │
│  │      --models "模型1,模型2,..." \                  │    │
│  │      --skills "skill1,skill2,..."                  │    │
│  │                                                    │    │
│  │ 4. 确认输出 "Agent bound successfully"              │    │
│  └────────────────────────────────────────────────────┘    │
│                                                            │
│                              [ 复制到剪贴板 ]              │
│                                                            │
│  ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──     │
│                                                            │
│  STEP 2                                                    │
│  Waiting for Binding...                                    │
│                                                            │
│  ⏳ 正在等待你的 Agent 完成绑定...                          │
│     Token 有效期：4:32                                     │
│     每 3 秒自动检查                                        │
│                                                            │
│                                              [ 取消 ]      │
└────────────────────────────────────────────────────────────┘
```

**交互细节**：

- `{TOKEN}` 替换为后端返回的真实 token
- 代码块区域用 `font-mono`，背景 `--c-bg-elevated`，右上角复制按钮
- 复制按钮点击后文字变为 "Copied!" 持续 2 秒
- 倒计时显示 token 剩余有效时间（5 分钟）
- 轮询间隔 3 秒，调用 `GET /api/dashboard/agents/token/{token}/status`
- Token 过期后显示"已过期，请重新生成"+ 重试按钮

### 1.2 绑定成功 → Provider 配置确认

轮询返回 `bound: true` 后，弹窗内容切换为 Provider 配置确认：

```
┌─ Agent Bound Successfully! ─────────────────────────────────┐
│                                                             │
│  🎉 绑定成功                                                │
│                                                             │
│  节点: my-macbook-pro                                       │
│  ID:   a1b2c3d4e5f6                                        │
│                                                             │
│  ── MODELS ─────────────────────────────────────────────── │
│                                                             │
│  ☑ Claude Sonnet 4       Anthropic · 200K ctx              │
│  ☑ Claude Opus 4         Anthropic · 200K ctx              │
│  ☑ GPT 5.4               OpenAI · 128K ctx                 │
│  ☐ GPT 4.1 Mini          OpenAI · 128K ctx                 │
│                                                             │
│  ── SHAREABLE SKILLS ───────────────────────────────────── │
│                                                             │
│  ☑ tavily                Search              Low cost       │
│  ☑ openai-image-gen      Image Generation    High cost      │
│  ☑ openai-whisper-api    Speech to Text      Medium cost    │
│  ☑ weather               Weather Query       Low cost       │
│  ☑ coding-agent          Code Writing        High cost      │
│                                                             │
│  ── FILTERED (not suitable for sharing) ────────────────── │
│                                                             │
│  ☐ check-quotas          Internal ops tool                  │
│  ☐ deploy-bot            Internal ops tool                  │
│  ☐ healthcheck           Internal ops tool                  │
│  ☐ skill-creator         Development tool                   │
│                                                             │
│  ── HIRE SETTINGS ──────────────────────────────────────── │
│                                                             │
│  Accept hiring    [✅ Toggle]                               │
│  Rate limit       [ 20 ] calls/hour                         │
│  Price per call   [ 0  ] Credits                            │
│  Description      [ __________________________ ]            │
│                                                             │
│           [ Save & Start Earning ]    [ Skip for now ]      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**交互细节**：

- 模型和 Skill 列表来自 `GET /api/dashboard/agents/token/{token}/status` 的 `provider_config` 字段
- Checkbox 可勾选/取消，默认：shareable 的打勾，filtered 的不打勾
- Hire Settings 部分复用现有 hire-config 的 UI 组件
- 「Save & Start Earning」→ 调用 `POST /api/dashboard/agents/{nodeId}/provider-config`，然后关闭弹窗，刷新 Agent 列表
- 「Skip for now」→ 只绑定不配置 Provider，关闭弹窗

**数据结构**（来自后端 token/status 接口）：

```typescript
interface BindStatusResponse {
  bound: boolean;
  agent?: Agent;
  provider_config?: {
    models: ParsedModel[];
    skills: {
      shareable: ShareableSkill[];
      filtered: FilteredSkill[];
    };
  };
}

interface ParsedModel {
  id: string;           // "claude-sonnet-4"
  raw: string;          // "amazon-bedrock/global.anthropic.claude-sonnet-4-6"
  provider: string;     // "Anthropic"
  context_window: number;
  strengths: string[];
}

interface ShareableSkill {
  name: string;
  category: string;
  cost_level: "free" | "low" | "medium" | "high";
  display?: string;     // 中文/英文显示名
}

interface FilteredSkill {
  name: string;
  reason: string;       // "Internal ops tool"
}
```

---

## 二、Provider 配置页

### 路径

```
/dashboard/provider
```

或作为 Agent 详情页的一个 Tab：

```
/dashboard/agents/{nodeId}  →  [Overview] [Provider] [Calls]
```

### 页面结构

```
┌─ PROVIDER SETUP ─────────────────────────────────────────────┐
│                                                              │
│  Provider Setup                                              │
│  Share your models and skills to earn Credits                 │
│                                                              │
│  ── MY MODELS ───────────────────────────────────────────── │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Model              Provider    Context    Status      │ │
│  ├────────────────────────────────────────────────────────┤ │
│  │  Claude Sonnet 4    Anthropic   200K       ☑ Shared    │ │
│  │  Claude Opus 4      Anthropic   200K       ☑ Shared    │ │
│  │  GPT 5.4            OpenAI      128K       ☑ Shared    │ │
│  │  GPT 4.1 Mini       OpenAI      128K       ☐ Not shared│ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ── MY SKILLS ───────────────────────────────────────────── │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Skill              Category       Cost      Status    │ │
│  ├────────────────────────────────────────────────────────┤ │
│  │  tavily             Search         Low       ☑ Shared  │ │
│  │  openai-image-gen   AI Generate    High      ☑ Shared  │ │
│  │  weather            Query          Low       ☑ Shared  │ │
│  │  coding-agent       AI Code        High      ☑ Shared  │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ── HIRE SETTINGS ───────────────────────────────────────── │
│                                                              │
│  Accept hiring      [✅]                                     │
│  Rate limit         [ 20 ] calls/hour                        │
│  Price per call     [ 0  ] Credits (0 = free)                │
│  Description        [ ______________________________ ]       │
│                                                              │
│  ── RE-SCAN ─────────────────────────────────────────────── │
│                                                              │
│  环境有变化？重新扫描你的模型和 Skill：                        │
│                                                              │
│  ┌─────────────────────────────────────────────┐            │
│  │  把这段话发给你的 Agent...       [ 复制 ]    │            │
│  └─────────────────────────────────────────────┘            │
│  ┌─────────────────────────────────────────────┐            │
│  │  粘贴 Agent 回复...                          │            │
│  └─────────────────────────────────────────────┘            │
│                                         [ 更新配置 ]        │
│                                                              │
│                                         [ 保存 ]            │
└──────────────────────────────────────────────────────────────┘
```

**交互细节**：

- 数据来源：`GET /api/dashboard/agents/{nodeId}/provider-config`
- 保存时调用：`POST /api/dashboard/agents/{nodeId}/provider-config`
- Hire Settings 同时调用 `PATCH /api/dashboard/hire-config/{nodeId}`
- Re-scan 区域：用户可以重新粘贴 Agent 回复来更新模型/Skill 列表
- Re-scan 粘贴后前端发 `POST /api/dashboard/agents/{nodeId}/provider-config` 带 `raw_models` 和 `raw_skills`，后端重新解析

### Re-scan 粘贴框解析

前端接收用户粘贴的文本，尝试提取 JSON：

```typescript
function parseAgentReply(text: string): { models: string[], skills: string[] } | null {
  // 尝试从文本中提取 JSON
  const jsonMatch = text.match(/\{[\s\S]*"models"[\s\S]*"skills"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {}
  }
  return null;
}
```

解析成功后调用后端 API 获取识别结果，更新页面。
解析失败时提示："无法识别回复格式，请确认 Agent 返回了 JSON 格式的模型和 Skill 列表。"

---

## 三、收益页

### 路径

```
/dashboard/earnings
```

### 页面结构

```
┌─ EARNINGS ──────────────────────────────────────────────────┐
│                                                             │
│  MY EARNINGS                                                │
│  Provider Earnings                                          │
│                                                             │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐           │
│  │ TODAY      │  │ THIS WEEK  │  │ THIS MONTH │           │
│  │ ↗ 127     │  │ ↗ 842     │  │ ↗ 3,240   │           │
│  │ Credits    │  │ Credits    │  │ Credits    │           │
│  │ 15 tasks   │  │ 98 tasks   │  │ 412 tasks  │           │
│  └────────────┘  └────────────┘  └────────────┘           │
│                                                             │
│  ── EARNINGS HISTORY ────────────────────────────────────  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ Time       Task              Used        Credits      │ │
│  ├───────────────────────────────────────────────────────┤ │
│  │ 2h ago     Code analysis     Claude S4   +25          │ │
│  │ 2h 15m     Web search        Tavily      +2           │ │
│  │ 3h ago     Image gen         DALL-E      +50          │ │
│  │ 3h 20m     Translation       Claude S4   +15          │ │
│  │ 3h 40m     JSON format       Skill       +1           │ │
│  │ ...        ...               ...         ...          │ │
│  ├───────────────────────────────────────────────────────┤ │
│  │ Showing 5 / 15          [ ← Prev ]  [ Next → ]       │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**数据源**：

- 统计卡片：`GET /api/dashboard/earnings`
- 历史列表：`GET /api/dashboard/earnings/history?page=1&limit=20`

**交互细节**：

- 统计卡片用 StatCard 组件（已有），数值用 warning 色（黄色，表示 Credits）
- 历史列表用 DataTable 组件（已有），支持分页
- Credits 数值前加 "+" 号，用 success 色（绿色）
- Time 列用相对时间（"2h ago"），tooltip 显示绝对时间
- "Used" 列区分模型调用和 Skill 调用，显示具体模型名或 skill 名

**TypeScript 接口**：

```typescript
interface EarningsOverview {
  today: { credits: number; tasks: number };
  this_week: { credits: number; tasks: number };
  this_month: { credits: number; tasks: number };
  total: { credits: number; tasks: number };
}

interface EarningRecord {
  id: string;
  created_at: string;       // ISO 8601
  task_type: "model" | "skill";
  task_detail: string;      // "代码安全分析" / "网页搜索"
  model_used?: string;      // "claude-sonnet-4"
  skill_used?: string;      // "tavily"
  tokens_consumed: number;
  credits_earned: number;
  caller_name: string;
}

interface EarningsHistoryResponse {
  data: EarningRecord[];
  total: number;
  page: number;
  limit: number;
}
```

---

## 四、排行榜

### 路径

```
/dashboard/leaderboard
```

或嵌入 `/network` 页面作为一个区块。

### 页面结构

```
┌─ LEADERBOARD ───────────────────────────────────────────────┐
│                                                             │
│  TOP PROVIDERS                                              │
│  Provider Leaderboard                                       │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ Rank  Node            Top Model       Tasks   Rate    │ │
│  ├───────────────────────────────────────────────────────┤ │
│  │ #1    gpu-beast-01    Claude Opus 4   2,341   99.2%   │ │
│  │ #2    my-macbook ★    Claude Son. 4   412     93.3%   │ │
│  │ #3    server-tokyo    GPT-4o          389     97.1%   │ │
│  │ #4    linux-box       DeepSeek V3     1,205   91.0%   │ │
│  │ #5    mini-pc         Llama 70B       890     88.5%   │ │
│  │ ...                                                   │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ── MY STATS ─────────────────────────────────────────────  │
│                                                             │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐           │
│  │ MY RANK    │  │ TOTAL TASKS│  │ SUCCESS    │           │
│  │ #2         │  │ 412        │  │ 93.3%      │           │
│  └────────────┘  └────────────┘  └────────────┘           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**交互细节**：

- 当前用户的行高亮显示 + ★ 标记
- Rank 列 #1 用 warning 色，#2-3 用 text 色，其余 text-dim
- Success Rate 列：≥95% 用 success 色，<95% 用 warning 色，<80% 用 danger 色
- My Stats 区域固定在底部或顶部，始终可见

**TypeScript 接口**：

```typescript
interface LeaderboardEntry {
  rank: number;
  node_id: string;
  name: string;
  top_model: string;
  total_tasks: number;
  success_rate: number;    // 0-100
  total_credits: number;
}

interface LeaderboardResponse {
  providers: LeaderboardEntry[];
  my_rank: number | null;  // null if user is not a provider
  my_stats: {
    total_tasks: number;
    success_rate: number;
    total_credits: number;
  } | null;
}
```

---

## 五、Dashboard 概览页扩展

### 现有统计卡片

```
MY AGENTS  |  MY SKILLS  |  CALLS RECEIVED  |  CALLS MADE  |  AVG LATENCY  |  SUCCESS RATE
```

### 新增卡片

在现有卡片行下方或末尾添加 Provider 相关卡片：

```
TODAY'S EARNINGS  |  TOTAL CREDITS  |  PROVIDER RANK
↗ 127 Credits     |  💰 3,240       |  🏆 #2
15 tasks today    |  All time       |  Top 10%
```

**数据源**：扩展 `GET /api/dashboard/stats` 响应

```typescript
// 现有
interface DashboardStatsResponse {
  my_agents: number;
  my_skills: number;
  calls_received: number;
  calls_made: number;
  avg_latency_ms: number;
  success_rate: number;
  // 新增
  today_earnings?: number;      // Credits
  today_tasks?: number;
  total_credits?: number;
  provider_rank?: number | null;
}
```

如果用户不是 Provider（没有配置 provider-config），这些字段为 null，不显示对应卡片。

---

## 六、My Agents 列表扩展

每个 Agent 卡片上增加 Provider 状态标识：

```
┌─ Agent Card ──────────────────────────────────┐
│                                               │
│  my-macbook-pro           🟢 Online           │
│  a1b2c3d4e5f6                                 │
│                                               │
│  Skills: tavily, image-gen, weather +2        │
│  Models: Claude Sonnet 4, GPT 5.4            │  ← 新增行
│                                               │
│  ┌──────────────┐                             │
│  │ PROVIDER ✅  │  20 calls/hr · Free         │  ← 新增标签
│  └──────────────┘                             │
│                                               │
│  [ View Details ]  [ Provider Settings ]      │  ← 新增按钮
│                                               │
└───────────────────────────────────────────────┘
```

- "PROVIDER ✅" badge 用 success 色
- 未配置 Provider 的 Agent 不显示 badge
- "Provider Settings" 链接到 `/dashboard/agents/{nodeId}` 的 Provider tab

---

## 七、导航栏更新

Dashboard 子导航增加入口：

```
现有: Overview | My Agents | Calls | Settings
新增: Overview | My Agents | Calls | Earnings | Settings
```

或者 Earnings 作为 Overview 里的一个区块，不单独导航。根据页面复杂度决定。

---

## 八、新增前端文件

```
src/
├── app/dashboard/
│   ├── earnings/
│   │   └── page.tsx                   # 收益页
│   ├── leaderboard/
│   │   └── page.tsx                   # 排行榜（或嵌入 network 页）
│   └── agents/[id]/
│       └── provider/page.tsx          # Provider 配置（或作为 tab）
│
├── components/
│   ├── provider/
│   │   ├── bind-agent-dialog.tsx      # 升级版绑定弹窗
│   │   ├── provider-config-form.tsx   # Provider 配置表单（模型+Skill+雇佣）
│   │   ├── model-list.tsx             # 模型列表（带 checkbox）
│   │   ├── skill-list.tsx             # Skill 列表（带 checkbox + 分类）
│   │   ├── earnings-stats.tsx         # 收益统计卡片组
│   │   ├── earnings-table.tsx         # 收益明细表格
│   │   ├── leaderboard-table.tsx      # 排行榜表格
│   │   └── prompt-copy-box.tsx        # prompt 展示 + 复制框（复用于绑定和 re-scan）
│   └── ui/
│       └── badge.tsx                  # Provider badge 组件（已有，可能需扩展）
│
└── lib/
    └── dashboard-api.ts               # 新增 API 函数（见下方）
```

---

## 九、新增 API 函数

在 `src/lib/dashboard-api.ts` 中新增：

```typescript
// ── Provider 配置 ──

export async function getProviderConfig(nodeId: string): Promise<ProviderConfig> {
  return fetchDashboardApi(`/agents/${nodeId}/provider-config`);
}

export async function saveProviderConfig(
  nodeId: string,
  config: SaveProviderConfigRequest
): Promise<{ success: boolean }> {
  return fetchDashboardApi(`/agents/${nodeId}/provider-config`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
}

// ── 收益 ──

export async function getEarnings(): Promise<EarningsOverview> {
  return fetchDashboardApi("/earnings");
}

export async function getEarningsHistory(
  params?: { page?: number; limit?: number }
): Promise<EarningsHistoryResponse> {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  return fetchDashboardApi(`/earnings/history${qs ? `?${qs}` : ""}`);
}

// ── 排行榜 ──

export async function getLeaderboard(
  limit?: number
): Promise<LeaderboardResponse> {
  const qs = limit ? `?limit=${limit}` : "";
  return fetchDashboardApi(`/leaderboard${qs}`);
}
```

**类型定义**见各章节的 TypeScript 接口部分。统一放在 `src/lib/types.ts`。

---

## 十、API 接口汇总

### 已有（无改动）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/dashboard/agents/token` | 生成绑定 Token |
| GET | `/api/dashboard/hire-config/:nodeId` | 获取雇佣配置 |
| PATCH | `/api/dashboard/hire-config/:nodeId` | 更新雇佣配置 |

### 已有（后端扩展响应，前端需适配）

| 方法 | 路径 | 改动 |
|------|------|------|
| GET | `/api/dashboard/agents/token/:token/status` | 新增 `provider_config` 字段 |
| POST | `/api/dashboard/agents/bind` | 新增 `models` + `skills` 字段 |
| GET | `/api/dashboard/stats` | 新增 `today_earnings` 等字段 |

### 新增

| 方法 | 路径 | 说明 | Phase |
|------|------|------|-------|
| GET | `/api/dashboard/agents/:nodeId/provider-config` | 获取 Provider 配置 | 1 |
| POST | `/api/dashboard/agents/:nodeId/provider-config` | 保存 Provider 配置 | 1 |
| GET | `/api/dashboard/earnings` | 收益概览 | 2 |
| GET | `/api/dashboard/earnings/history` | 收益明细 | 2 |
| GET | `/api/dashboard/leaderboard` | 排行榜 | 3 |

---

## 十一、开发优先级

### Phase 1（与后端同步开发）

```
□ 升级 bind-agent-dialog（prompt 模式 + Provider 确认页）
□ Provider 配置页（模型/Skill 列表 + 雇佣设置）
□ prompt-copy-box 组件
□ model-list / skill-list 组件
□ My Agents 卡片加 Provider badge
□ 对接 provider-config API
□ 对接扩展后的 bind 和 token/status API
```

### Phase 2

```
□ 收益页（earnings-stats + earnings-table）
□ Dashboard 概览加 earnings 卡片
□ 导航加 Earnings 入口
□ 对接 earnings API
```

### Phase 3

```
□ 排行榜页面
□ 对接 leaderboard API
```
