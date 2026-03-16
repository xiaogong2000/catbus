# CatBus Provider 需求文档 v3

> 版本：v3.0
> 日期：2026-03-12
> 核心改动：绑定 + 环境收集 + Provider 配置合并为一步完成

---

## 一、设计理念

**一次粘贴，全部搞定。**

用户不需要在终端和网页之间来回切换，不需要手动编辑任何配置文件，不需要知道自己有什么模型。

用户的 OpenClaw Agent 有 exec 能力，能执行终端命令，也最了解自己的环境。让 Agent 自己完成安装、收集、绑定全过程。

---

## 二、Provider 注册完整流程

### 前置：用户已有 catbus.xyz 账号

注册/登录支持邮箱 + GitHub OAuth + Google OAuth（已实现）。

### 唯一操作：复制 prompt → 粘贴给 Agent

```
用户登录 Dashboard
  → 点击「Bind Agent」
  → 页面生成 token + 显示一段 prompt + [复制到剪贴板] 按钮
  → 用户复制，粘贴给自己的 OpenClaw Agent
  → Agent 自动执行全部操作
  → Dashboard 轮询检测绑定成功
  → 展示完整结果（模型 + Skill + 状态）
  → 完成
```

### Dashboard 展示的 prompt

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  把下面这段话发给你的 OpenClaw Agent，它会自动完成所有配置：    │
│                                                              │
│  ──────────────────────────────────────────────────────────  │
│                                                              │
│  请帮我完成 CatBus 节点绑定：                                 │
│                                                              │
│  1. 检查 catbus 是否已安装，没有则执行：                       │
│     pip install catbus && catbus init                        │
│                                                              │
│  2. 检查我当前的环境：                                        │
│     - 我用的什么模型？列出所有模型名称                         │
│     - 我装了哪些 Skill？列出所有 skill 名称                   │
│                                                              │
│  3. 执行绑定命令（把环境信息一起上报）：                        │
│     catbus bind abc123xyz \                                  │
│       --models "模型1,模型2,..." \                           │
│       --skills "skill1,skill2,..."                           │
│                                                              │
│  4. 确认输出 "Agent bound successfully" 后告诉我结果           │
│                                                              │
│  ──────────────────────────────────────────────────────────  │
│                                                              │
│                                       [复制到剪贴板]         │
│                                                              │
│  ⏳ 等待绑定中... (每 3 秒自动检查)                           │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

其中 `abc123xyz` 是后端生成的一次性 token（5 分钟有效）。

### Agent 执行过程（用户不需要关心）

```
Agent 收到 prompt 后自动执行：

Step 1 — 检查安装
  $ which catbus
  如果没有：
  $ pip install catbus
  $ catbus init

Step 2 — 收集环境
  Agent 读取自己的运行配置，得到：
  models: ["amazon-bedrock/global.anthropic.claude-sonnet-4-6", "azure-openai/gpt-5.4", ...]
  skills: ["tavily", "openai-image-gen", "weather", "coding-agent", "check-quotas", ...]

Step 3 — 执行绑定
  $ catbus bind abc123xyz \
      --models "amazon-bedrock/global.anthropic.claude-sonnet-4-6,azure-openai/gpt-5.4" \
      --skills "tavily,openai-image-gen,weather,coding-agent,check-quotas"

  输出: ✅ Agent bound successfully

Step 4 — 告诉用户完成
  Agent: "CatBus 节点绑定成功！你的节点 ID 是 a1b2c3d4e5f6，
         已上报 5 个模型和 5 个 skill。"
```

### Dashboard 检测到绑定成功后的展示

轮询 `GET /api/dashboard/agents/token/:token/status` 返回 `bound: true` 后：

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  🎉 绑定成功！                                               │
│                                                              │
│  节点: my-macbook-pro                                        │
│  ID:   a1b2c3d4e5f6                                         │
│  状态: 🟢 在线                                               │
│                                                              │
│  ── 模型 ──────────────────────────────────────────────────  │
│                                                              │
│  ☑ Claude Sonnet 4       Anthropic · 200K ctx · 代码/分析    │
│  ☑ Claude Opus 4         Anthropic · 200K ctx · 全能         │
│  ☑ GPT 5.4               OpenAI · 128K ctx · 通用           │
│  ☑ GPT 4.1 Mini          OpenAI · 128K ctx · 轻量           │
│                                                              │
│  ── 建议共享的 Skill ──────────────────────────────────────  │
│                                                              │
│  ☑ tavily                搜索                 低成本         │
│  ☑ openai-image-gen      图片生成              高成本         │
│  ☑ openai-whisper-api    语音转文字            中成本         │
│  ☑ weather               天气查询              低成本         │
│  ☑ coding-agent          代码编写              高成本         │
│                                                              │
│  ── 已过滤（不适合共享） ──────────────────────────────────  │
│                                                              │
│  ☐ check-quotas          内部运维工具                         │
│  ☐ deploy-bot            内部运维工具                         │
│  ☐ healthcheck           内部运维工具                         │
│  ☐ skill-creator         开发工具                             │
│                                                              │
│  ── 雇佣设置 ──────────────────────────────────────────────  │
│                                                              │
│  接受雇佣      [✅ 开启]                                     │
│  调用上限      [20] 次/小时                                   │
│  每次价格      [0] Credits (免费)                             │
│  服务说明      [                              ]              │
│                                                              │
│                 [保存并开始接单]    [稍后设置]                 │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

用户勾选确认 → 点「保存并开始接单」→ 节点出现在雇佣市场。

如果用户不想当 Provider，点「稍后设置」→ 节点只绑定到账号做管理用途（查看状态/调用历史），不出现在市场。

---

## 三、catbus bind 命令改动

### 新增参数

```bash
catbus bind <token> [--models "model1,model2,..."] [--skills "skill1,skill2,..."]
```

所有参数都是可选的。没有 --models 和 --skills 也能绑定成功（裸绑定），用户后续在 Dashboard 补充。

### 命令执行逻辑

```python
def cmd_bind(args):
    token = args.token
    node_id = load_node_id()
    if not node_id:
        print("❌ Not initialized. Run 'catbus init' first.")
        sys.exit(1)

    config = load_config()

    payload = {
        "token": token,
        "node_id": node_id,
        "name": config.node_name or f"node-{node_id[:6]}",
        "server": config.server,
    }

    # 可选：模型和 skill 列表
    if args.models:
        payload["models"] = [m.strip() for m in args.models.split(",") if m.strip()]
    if args.skills:
        payload["skills"] = [s.strip() for s in args.skills.split(",") if s.strip()]

    # POST 到 catbus.xyz
    resp = http_post("https://catbus.xyz/api/dashboard/agents/bind", payload)

    if resp.get("success"):
        print(f"✅ Agent bound successfully")
        print(f"   Node ID: {node_id}")
        print(f"   Models:  {len(payload.get('models', []))} reported")
        print(f"   Skills:  {len(payload.get('skills', []))} reported")
        print(f"   Dashboard: https://catbus.xyz/dashboard")
    else:
        print(f"❌ Bind failed: {resp.get('message', 'Unknown error')}")
        sys.exit(1)
```

---

## 四、后端 API

### 4.1 生成绑定 Token（已有，无改动）

```
POST /api/dashboard/agents/token
```

响应：
```json
{ "token": "abc123xyz", "expires_at": "2026-03-12T14:05:00.000Z" }
```

### 4.2 查询绑定状态（已有，扩展响应）

```
GET /api/dashboard/agents/token/:token/status
```

未绑定：
```json
{ "bound": false }
```

已绑定（扩展：返回识别后的模型和 Skill）：
```json
{
  "bound": true,
  "agent": {
    "node_id": "a1b2c3d4e5f6",
    "name": "my-macbook-pro",
    "status": "online",
    "skills": [...],
    "uptime_seconds": 0,
    "calls_handled": 0,
    "calls_made": 0,
    "server": "relay.catbus.xyz",
    "registered_at": "2026-03-12T14:00:00.000Z"
  },
  "provider_config": {
    "models": [
      { "id": "claude-sonnet-4", "raw": "amazon-bedrock/global.anthropic.claude-sonnet-4-6", "provider": "Anthropic", "context_window": 200000, "strengths": ["code","analysis","writing"] },
      { "id": "gpt-5.4", "raw": "azure-openai/gpt-5.4", "provider": "OpenAI", "context_window": 128000, "strengths": ["general"] }
    ],
    "skills": {
      "shareable": [
        { "name": "tavily", "category": "search", "cost_level": "low" },
        { "name": "openai-image-gen", "category": "ai-generate", "cost_level": "high" },
        { "name": "weather", "category": "query", "cost_level": "low" }
      ],
      "filtered": [
        { "name": "check-quotas", "reason": "内部运维工具" },
        { "name": "deploy-bot", "reason": "内部运维工具" }
      ]
    }
  }
}
```

### 4.3 CLI 绑定接口（改动：接收 models + skills）

```
POST /api/dashboard/agents/bind
```

请求：
```json
{
  "token": "abc123xyz",
  "node_id": "a1b2c3d4e5f6",
  "name": "my-macbook-pro",
  "server": "relay.catbus.xyz",
  "models": [
    "amazon-bedrock/global.anthropic.claude-sonnet-4-6",
    "newcli-aws/claude-sonnet-4-5",
    "amazon-bedrock/claude-opus-4-6-v1",
    "azure-openai/gpt-5.4",
    "azure-openai/gpt-4.1-mini"
  ],
  "skills": [
    "check-quotas",
    "deploy-bot",
    "tavily",
    "coding-agent",
    "healthcheck",
    "openai-image-gen",
    "openai-whisper-api",
    "skill-creator",
    "weather"
  ]
}
```

后端处理逻辑：

```
1. 验证 token 有效性和时效
2. 写入 user_agents 表（绑定节点到用户）
3. 解析 models：模糊匹配 MODEL_DB，提取基础模型名 + 自动补全详情
4. 解析 skills：匹配 SKILL_SHAREABLE_DB，自动分类为 shareable / filtered
5. 写入 provider_configs 表
6. 标记 token 已使用
7. 返回 success
```

响应：
```json
{
  "success": true,
  "message": "Agent bound successfully"
}
```

### 4.4 保存 Provider 最终配置（用户在 Dashboard 确认后）

```
POST /api/dashboard/agents/:nodeId/provider-config
```

请求（用户勾选确认后提交）：
```json
{
  "models": ["claude-sonnet-4", "claude-opus-4", "gpt-5.4"],
  "skills": ["tavily", "openai-image-gen", "weather", "coding-agent"],
  "hire_config": {
    "hireable": true,
    "rate_limit": 20,
    "price_per_call": 0,
    "description": "Claude Sonnet/Opus + Tavily + Image Gen"
  }
}
```

后端处理：
```
1. 更新 provider_configs 表（最终确认的模型和 skill）
2. 更新 hire_configs 表（雇佣设置）
3. 通知 relay 更新该节点的注册信息
```

响应：
```json
{ "success": true }
```

### 4.5 获取 Provider 配置

```
GET /api/dashboard/agents/:nodeId/provider-config
```

响应：
```json
{
  "models": [
    { "id": "claude-sonnet-4", "provider": "Anthropic", "context_window": 200000, "strengths": ["code","analysis","writing"] },
    { "id": "gpt-5.4", "provider": "OpenAI", "context_window": 128000, "strengths": ["general"] }
  ],
  "skills": [
    { "name": "tavily", "category": "search", "cost_level": "low" },
    { "name": "openai-image-gen", "category": "ai-generate", "cost_level": "high" }
  ],
  "hire_config": {
    "hireable": true,
    "rate_limit": 20,
    "price_per_call": 0,
    "description": "Claude Sonnet/Opus + Tavily + Image Gen"
  }
}
```

### 4.6 收益 API

```
GET /api/dashboard/earnings
```

响应：
```json
{
  "today": { "credits": 127, "tasks": 15 },
  "this_week": { "credits": 842, "tasks": 98 },
  "this_month": { "credits": 3240, "tasks": 412 },
  "total": { "credits": 3240, "tasks": 412 }
}
```

```
GET /api/dashboard/earnings/history?page=1&limit=20
```

响应：
```json
{
  "data": [
    {
      "id": "earn_001",
      "created_at": "2026-03-12T14:32:00.000Z",
      "task_type": "model",
      "task_detail": "代码安全分析",
      "model_used": "claude-sonnet-4",
      "tokens_consumed": 3200,
      "credits_earned": 25,
      "caller_name": "Bob"
    },
    {
      "id": "earn_002",
      "created_at": "2026-03-12T14:15:00.000Z",
      "task_type": "skill",
      "task_detail": "网页搜索",
      "skill_used": "tavily",
      "tokens_consumed": 0,
      "credits_earned": 2,
      "caller_name": "Alice"
    }
  ],
  "total": 15,
  "page": 1,
  "limit": 20
}
```

### 4.7 排行榜 API

```
GET /api/dashboard/leaderboard?limit=20
```

响应：
```json
{
  "providers": [
    {
      "rank": 1,
      "node_id": "xxx",
      "name": "gpu-beast-01",
      "top_model": "Claude Opus 4",
      "total_tasks": 2341,
      "success_rate": 99.2,
      "total_credits": 28450
    }
  ],
  "my_rank": 2,
  "my_stats": {
    "total_tasks": 412,
    "success_rate": 93.3,
    "total_credits": 3240
  }
}
```

---

## 五、数据库

### 新增表

```sql
-- Provider 配置
CREATE TABLE provider_configs (
    node_id         TEXT PRIMARY KEY,
    owner_id        INTEGER NOT NULL REFERENCES users(id),
    raw_models      TEXT DEFAULT '[]',      -- 原始上报的模型名（JSON array）
    parsed_models   TEXT DEFAULT '[]',      -- 解析后的模型详情（JSON array）
    raw_skills      TEXT DEFAULT '[]',      -- 原始上报的 skill 名（JSON array）
    shareable_skills TEXT DEFAULT '[]',     -- 筛选后可共享的（JSON array）
    filtered_skills  TEXT DEFAULT '[]',     -- 筛选掉的（JSON array）
    confirmed       INTEGER DEFAULT 0,      -- 用户是否已在 Dashboard 确认
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now'))
);

-- 收益记录
CREATE TABLE earnings (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    node_id         TEXT NOT NULL,
    owner_id        INTEGER NOT NULL,
    contract_id     TEXT,
    task_type       TEXT NOT NULL,           -- "model" / "skill"
    task_detail     TEXT NOT NULL,
    model_used      TEXT,
    skill_used      TEXT,
    tokens_consumed INTEGER DEFAULT 0,
    credits_earned  REAL NOT NULL,
    caller_id       INTEGER,
    caller_name     TEXT,
    created_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_earnings_node ON earnings(node_id);
CREATE INDEX idx_earnings_owner ON earnings(owner_id);
CREATE INDEX idx_earnings_date ON earnings(created_at);

-- Credits 余额
CREATE TABLE credits (
    user_id         INTEGER PRIMARY KEY REFERENCES users(id),
    balance         REAL DEFAULT 0,
    total_earned    REAL DEFAULT 0,
    total_spent     REAL DEFAULT 0,
    updated_at      TEXT DEFAULT (datetime('now'))
);
```

### 内置数据表（代码里的常量，不在数据库）

```typescript
// MODEL_DB — 模型信息自动补全
const MODEL_DB: Record<string, ModelInfo> = {
  "claude-sonnet-4":     { provider: "Anthropic", context_window: 200000, strengths: ["code","analysis","writing","general"] },
  "claude-sonnet-4-5":   { provider: "Anthropic", context_window: 200000, strengths: ["code","analysis","writing","general"] },
  "claude-sonnet-4-6":   { provider: "Anthropic", context_window: 200000, strengths: ["code","analysis","writing","general"] },
  "claude-opus-4":       { provider: "Anthropic", context_window: 200000, strengths: ["code","analysis","writing","reasoning","general"] },
  "claude-opus-4-6":     { provider: "Anthropic", context_window: 200000, strengths: ["code","analysis","writing","reasoning","general"] },
  "gpt-4o":              { provider: "OpenAI",    context_window: 128000, strengths: ["vision","code","general"] },
  "gpt-4.1-mini":        { provider: "OpenAI",    context_window: 128000, strengths: ["fast","general"] },
  "gpt-5.4":             { provider: "OpenAI",    context_window: 128000, strengths: ["general"] },
  "deepseek-v3":         { provider: "DeepSeek",  context_window: 64000,  strengths: ["code","chinese","general"] },
  "deepseek-r1":         { provider: "DeepSeek",  context_window: 64000,  strengths: ["reasoning","math"] },
  "llama-3.3-70b":       { provider: "Meta",      context_window: 128000, strengths: ["general"] },
  "llama-3.1-8b":        { provider: "Meta",      context_window: 128000, strengths: ["fast","general"] },
  "gemini-2.5-pro":      { provider: "Google",    context_window: 1000000,strengths: ["long-context","general"] },
  "qwen-2.5":            { provider: "Alibaba",   context_window: 32000,  strengths: ["chinese","general"] },
};

// 模型名提取函数
function extractBaseModel(rawName: string): string | null {
  // "amazon-bedrock/global.anthropic.claude-sonnet-4-6" → "claude-sonnet-4-6"
  // "azure-openai/gpt-5.4" → "gpt-5.4"
  // "newcli-aws/claude-sonnet-4-5" → "claude-sonnet-4-5"
  const lastSegment = rawName.split("/").pop() || rawName;
  const afterDots = lastSegment.split(".").pop() || lastSegment;
  // 在 MODEL_DB 里找匹配
  if (MODEL_DB[afterDots]) return afterDots;
  // 模糊匹配：去掉尾部版本号差异
  for (const key of Object.keys(MODEL_DB)) {
    if (afterDots.startsWith(key) || key.startsWith(afterDots)) return key;
  }
  return null; // 未识别的模型，保留原始名
}

// SKILL_DB — Skill 分类和共享判断
const SKILL_DB: Record<string, SkillInfo> = {
  // 可共享 — 查询类
  "tavily":              { shareable: true, category: "search",       cost_level: "low",    display: "搜索" },
  "web-search":          { shareable: true, category: "search",       cost_level: "low",    display: "网页搜索" },
  "weather":             { shareable: true, category: "query",        cost_level: "low",    display: "天气查询" },
  "news-search":         { shareable: true, category: "search",       cost_level: "low",    display: "新闻搜索" },
  
  // 可共享 — 生成类
  "openai-image-gen":    { shareable: true, category: "ai-generate",  cost_level: "high",   display: "图片生成" },
  "image-gen":           { shareable: true, category: "ai-generate",  cost_level: "high",   display: "图片生成" },
  "openai-whisper-api":  { shareable: true, category: "ai-audio",     cost_level: "medium", display: "语音转文字" },
  "coding-agent":        { shareable: true, category: "ai-code",      cost_level: "high",   display: "代码编写" },
  
  // 不可共享 — 运维/内部
  "check-quotas":        { shareable: false, reason: "内部运维工具" },
  "deploy-bot":          { shareable: false, reason: "内部运维工具" },
  "healthcheck":         { shareable: false, reason: "内部运维工具" },
  "skill-creator":       { shareable: false, reason: "开发工具" },
  
  // 不可共享 — 需要用户授权
  "github":              { shareable: false, reason: "需要用户账号授权" },
  "obsidian":            { shareable: false, reason: "本地个人数据" },
  "slack":               { shareable: false, reason: "需要用户账号授权" },
  "google-calendar":     { shareable: false, reason: "需要用户账号授权" },
  "notion":              { shareable: false, reason: "需要用户账号授权" },
  
  // ... 基于 110 个 Call 类 skill 的完整列表持续补充
};
```

---

## 六、API 路由文件结构

```
src/app/api/dashboard/
├── agents/
│   ├── route.ts                       # GET 列表 / POST 绑定（旧）
│   ├── token/
│   │   └── route.ts                   # POST 生成 token
│   ├── token/[token]/
│   │   └── status/route.ts            # GET 查询绑定状态（扩展响应）
│   ├── bind/
│   │   └── route.ts                   # POST CLI 绑定（扩展：接收 models+skills）
│   └── [nodeId]/
│       ├── route.ts                   # GET 详情 / DELETE 解绑
│       └── provider-config/
│           └── route.ts               # GET 获取 / POST 保存 Provider 配置
├── hire-config/
│   └── [nodeId]/route.ts              # GET / PATCH 雇佣设置（已有）
├── hire-market/
│   └── route.ts                       # GET 市场列表（已有）
├── hire-requests/
│   └── route.ts                       # GET 收到的请求（已有）
│   └── [requestId]/route.ts           # PATCH 审批（已有）
├── hired/
│   ├── route.ts                       # GET 已雇佣列表（已有）
│   ├── request/route.ts               # POST 发起雇佣（已有）
│   ├── requests/route.ts              # GET 发出的请求（已有）
│   └── [contractId]/route.ts          # DELETE 终止（已有）
├── hire-contracts/
│   ├── route.ts                       # GET 被雇佣情况（已有）
│   └── [contractId]/route.ts          # DELETE 终止（已有）
├── earnings/
│   ├── route.ts                       # GET 收益概览
│   └── history/route.ts              # GET 收益明细
├── leaderboard/
│   └── route.ts                       # GET 排行榜
├── stats/route.ts                     # GET 概览统计（已有，扩展加 earnings）
├── calls/route.ts                     # GET 调用历史（已有）
└── settings/route.ts                  # GET/PATCH 用户设置（已有）
```

---

## 七、用户完整旅程

```
=== Day 0 — 5 分钟上线 ===

1. catbus.xyz 注册账号（30 秒）
2. 点「Bind Agent」→ 复制 prompt（5 秒）
3. 粘贴给 OpenClaw Agent（5 秒）
4. Agent 自动安装 + 收集环境 + 执行绑定（30 秒）
5. Dashboard 显示结果 → 勾选确认 → 保存（1 分钟）
6. catbus serve --daemon（Agent 可能已自动执行）
7. ✅ 节点上线，出现在雇佣市场

=== Day 1 — 收到第一单 ===

8. Dashboard 通知：「Alice 请求雇佣你的 Agent」
9. 查看请求 → 点「Approve」
10. Alice 通过 CatBus 调用你的 tavily 搜索
11. Dashboard「接单记录」出现第一条，赚 2 Credits

=== Day 7 — 查看收益 ===

12. Dashboard 收益页：本周 45 单，320 Credits
13. 排行榜 #8

=== Day 30 — 用 Credits 消费 ===

14. 自己需要 Claude Opus 的能力（但只有 Sonnet）
15. 用积累的 Credits 调用排行榜 #1 的 Opus 节点
16. 闭环完成：提供能力 → 赚 Credits → 消费 Credits
```

---

## 八、开发优先级

### Phase 1：一步绑定 + Provider 配置

```
□ catbus bind 支持 --models 和 --skills 参数
□ provider_configs 数据库表 + 迁移脚本
□ POST /api/dashboard/agents/bind 扩展（接收+解析 models/skills）
□ GET /api/dashboard/agents/token/:token/status 扩展响应
□ POST/GET /api/dashboard/agents/:nodeId/provider-config
□ 模型名解析函数（extractBaseModel）+ MODEL_DB
□ Skill 分类函数 + SKILL_DB
□ Dashboard Provider 配置确认页（前端）
□ REGISTER 消息携带 models + skills
```

### Phase 2：收益系统

```
□ earnings + credits 数据库表
□ 每次接单记录 token 消耗和 Credits
□ GET /api/dashboard/earnings
□ GET /api/dashboard/earnings/history
□ Dashboard 收益页（前端）
□ Dashboard 概览页加 Today's Earnings 卡片
□ catbus earnings CLI 命令
```

### Phase 3：市场 + 排行

```
□ GET /api/dashboard/leaderboard
□ hire-market 展示 Provider 的模型信息
□ Dashboard 排行榜页面
□ Provider 信誉分计算
```

### Phase 4：Credits 闭环

```
□ Caller 端扣 Credits
□ 新用户赠送 100 Credits
□ Credits 充值
□ Provider 提现（未来）
```

---

## 九、接口总览（新增部分）

| 方法 | 路径 | 说明 | Phase |
|------|------|------|-------|
| POST | `/api/dashboard/agents/bind` | CLI 绑定（扩展） | 1 |
| GET | `/api/dashboard/agents/token/:token/status` | 绑定状态（扩展） | 1 |
| POST | `/api/dashboard/agents/:nodeId/provider-config` | 保存 Provider 配置 | 1 |
| GET | `/api/dashboard/agents/:nodeId/provider-config` | 获取 Provider 配置 | 1 |
| GET | `/api/dashboard/earnings` | 收益概览 | 2 |
| GET | `/api/dashboard/earnings/history` | 收益明细 | 2 |
| GET | `/api/dashboard/leaderboard` | 排行榜 | 3 |
