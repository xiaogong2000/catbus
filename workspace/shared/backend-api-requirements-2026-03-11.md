# CatBus 后端待开发 API 需求文档

**日期**: 2026-03-11
**状态**: 前端已完成，等待后端实现
**前端代码位置**: `web/src/lib/dashboard-api.ts`

---

## 概述

前端 Dashboard 中有两组功能使用了桩函数（stub），需要后端实现对应的 API 接口：

1. **Token 绑定** — 用户通过生成一次性 Token，在终端执行 `catbus bind <token>` 来绑定自己的 Agent
2. **雇佣智能体** — 基于双向授权的雇佣模型，雇佣方发起请求、Agent 主人审批后建立雇佣关系

所有 Dashboard 接口需要认证（Cookie session），基础路径为 `/api/dashboard`。

---

## 一、Token 绑定接口

### 业务流程

```
用户点击「Bind Agent」
    ↓
前端调用 POST /api/dashboard/agents/token → 获取 { token, expires_at }
    ↓
前端展示终端命令: $ catbus bind <token>
    ↓
用户在自己服务器终端执行 catbus bind <token>
    ↓
前端每 3 秒轮询 GET /api/dashboard/agents/token/:token/status
    ↓
后端检测到绑定成功 → 返回 { bound: true, agent: {...} }
    ↓
前端自动将新 Agent 添加到列表
```

### 1.1 生成绑定 Token

```
POST /api/dashboard/agents/token
```

**请求**: 无 Body（从 session 获取用户信息）

**响应** `200`:
```json
{
  "token": "a1b2c3d4e5f6g7h8",
  "expires_at": "2026-03-11T14:05:00.000Z"
}
```

**TypeScript 接口**:
```typescript
interface BindToken {
  token: string;
  expires_at: string; // ISO 8601, 建议 5 分钟有效期
}
```

**要求**:
- Token 为一次性使用，绑定后立即失效
- 有效期建议 5 分钟
- 同一用户同时只有一个有效 Token（生成新的自动作废旧的）

### 1.2 查询 Token 绑定状态

```
GET /api/dashboard/agents/token/:token/status
```

**响应** `200`（未绑定）:
```json
{
  "bound": false
}
```

**响应** `200`（已绑定）:
```json
{
  "bound": true,
  "agent": {
    "node_id": "node-abc123",
    "name": "My Agent",
    "status": "online",
    "skills": [
      { "name": "translate", "status": "online", "calls_handled": 0, "success_rate": 0 }
    ],
    "uptime_seconds": 0,
    "calls_handled": 0,
    "calls_made": 0,
    "server": "us-east-1",
    "registered_at": "2026-03-11T14:00:00.000Z"
  }
}
```

**Agent 数据结构**:
```typescript
interface Agent {
  node_id: string;
  name: string;
  status: "online" | "offline";
  skills: SkillSummary[];
  uptime_seconds: number;
  calls_handled: number;
  calls_made: number;
  server: string;
  registered_at: string; // ISO 8601
}

interface SkillSummary {
  name: string;
  status: "online" | "offline";
  calls_handled: number;
  success_rate: number; // 0-1
}
```

**要求**:
- Token 过期后返回 `404` 或 `{ bound: false }`
- 前端轮询间隔为 3 秒

### 1.3 CLI 端绑定接口（catbus bind 命令调用）

```
POST /api/dashboard/agents/bind
```

**请求**:
```json
{
  "token": "a1b2c3d4e5f6g7h8",
  "node_id": "node-abc123",
  "name": "My Agent",
  "server": "us-east-1"
}
```

**响应** `200`:
```json
{
  "success": true,
  "message": "Agent bound successfully"
}
```

**要求**:
- 验证 Token 有效性和时效
- 将 Agent 绑定到 Token 所属的用户
- 绑定后 Token 立即失效

---

## 二、雇佣智能体接口

### 设计理念

雇佣不是单方面操作，而是**双向授权**：

1. Agent 主人需要主动将 Agent 设为**可雇佣**状态
2. 雇佣方发起请求后，Agent 主人需要**审批同意**
3. 审批通过后建立**雇佣合约**，定义可用 skills、频率限制、有效期
4. 雇佣关系本质上是一种**长期授权**——雇佣方通过 Relay 调用被雇佣 Agent 的 skills 时享有优先权

```
┌──────────────────────────────────────────────────────────────┐
│                        雇佣生命周期                           │
│                                                              │
│  Agent 主人                              雇佣方               │
│      │                                     │                 │
│      │  1. 设置 hireable: true             │                 │
│      │     配置开放的 skills、价格          │                 │
│      │                                     │                 │
│      │               2. 浏览市场 → 发起雇佣请求               │
│      │               ← POST /hired/request ─┤               │
│      │                                     │                 │
│      │  3. 收到请求通知                     │                 │
│      │     Dashboard 「雇佣请求」列表       │                 │
│      │                                     │                 │
│      │  4. 审批（同意/拒绝）                │                 │
│      ├─ PATCH /hired/requests/:id ──────→  │                 │
│      │                                     │                 │
│      │              5. 合约生效             │                 │
│      │              allowed_skills 白名单   │                 │
│      │              rate_limit 频率限制      │                 │
│      │              expires_at 有效期       │                 │
│      │                                     │                 │
│      │         6. 雇佣方通过 Relay 调用     │                 │
│      │            Agent 的 skills           │                 │
│      │            享有优先队列              │                 │
│      │                                     │                 │
│      │  7. 任一方可随时终止雇佣关系         │                 │
│      │                                     │                 │
└──────────────────────────────────────────────────────────────┘
```

### 数据模型

```typescript
// Agent 主人的可雇佣配置
interface HireConfig {
  hireable: boolean;              // 是否接受雇佣
  allowed_skills: string[];       // 开放哪些 skills（空=全部）
  rate_limit: number;             // 每小时最大调用次数
  price_per_call: number;         // 每次调用价格（积分/token），0=免费
  description: string;            // 雇佣说明
}

// 雇佣请求
interface HireRequest {
  id: string;
  requester_id: string;           // 雇佣方用户 ID
  requester_name: string;         // 雇佣方名称
  target_node_id: string;         // 目标 Agent node_id
  target_owner_id: string;        // Agent 主人用户 ID
  message: string;                // 雇佣方留言（可选）
  status: "pending" | "approved" | "rejected" | "expired";
  requested_at: string;           // ISO 8601
  responded_at: string | null;    // ISO 8601
}

// 生效的雇佣合约
interface HireContract {
  id: string;
  hirer_id: string;               // 雇佣方用户 ID
  hirer_name: string;
  node_id: string;                // 被雇佣的 Agent
  node_name: string;
  owner_id: string;               // Agent 主人
  allowed_skills: string[];       // 授权的 skills（空=全部开放的）
  rate_limit: number;             // 每小时调用上限
  price_per_call: number;
  status: "active" | "terminated";
  hired_at: string;               // ISO 8601
  expires_at: string | null;      // null=永久直到手动终止
  total_calls: number;            // 累计调用次数
  total_cost: number;             // 累计消费
}

// 雇佣方视角的已雇佣 Agent（列表展示用）
interface HiredAgent {
  contract_id: string;
  node_id: string;
  name: string;
  owner_name: string;
  skills: string[];               // 已授权的 skills
  status: "online" | "offline";
  rate_limit: number;
  price_per_call: number;
  hired_at: string;
  expires_at: string | null;
  total_calls: number;
}
```

### 2.1 Agent 可雇佣设置（Agent 主人端）

#### 获取当前配置

```
GET /api/dashboard/hire-config/:nodeId
```

**响应** `200`:
```json
{
  "hireable": true,
  "allowed_skills": ["translate", "summarize"],
  "rate_limit": 100,
  "price_per_call": 0,
  "description": "Translation and summarization services"
}
```

#### 更新配置

```
PATCH /api/dashboard/hire-config/:nodeId
```

**请求**:
```json
{
  "hireable": true,
  "allowed_skills": ["translate", "summarize"],
  "rate_limit": 100,
  "price_per_call": 0,
  "description": "Translation and summarization services"
}
```

**响应** `200`:
```json
{ "success": true }
```

**要求**:
- 只有 Agent 主人可以修改自己 Agent 的配置
- `allowed_skills` 为空数组表示开放所有 skills
- `hireable: false` 时不会出现在可雇佣列表中，已有合约不受影响

### 2.2 浏览可雇佣的 Agent（雇佣方端）

```
GET /api/dashboard/hire-market?page=1&limit=20&skill=translate&search=bot
```

**Query 参数**:

| 参数 | 类型 | 说明 |
|------|------|------|
| page | number | 页码，默认 1 |
| limit | number | 每页条数，默认 20 |
| skill | string | 按 skill 筛选 |
| search | string | 搜索 Agent 名称 |

**响应** `200`:
```json
{
  "data": [
    {
      "node_id": "node-xyz789",
      "name": "Translation Bot",
      "owner_name": "Alice",
      "status": "online",
      "allowed_skills": ["translate", "summarize"],
      "rate_limit": 100,
      "price_per_call": 0,
      "description": "Fast and accurate translation",
      "total_hirers": 3
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

**要求**:
- 只返回 `hireable: true` 的 Agent
- 排除自己拥有的 Agent
- 排除已经雇佣的 Agent（或标记 `already_hired: true`）

### 2.3 发起雇佣请求（雇佣方端）

```
POST /api/dashboard/hired/request
```

**请求**:
```json
{
  "node_id": "node-xyz789",
  "message": "I'd like to use your translation service for my project"
}
```

**响应** `201`:
```json
{
  "request": {
    "id": "req-001",
    "target_node_id": "node-xyz789",
    "status": "pending",
    "requested_at": "2026-03-11T14:00:00.000Z"
  }
}
```

**错误**:
- `409` — 已有 pending 请求或已雇佣
- `404` — Agent 不存在或不可雇佣
- `400` — 不能雇佣自己的 Agent

### 2.4 查看我发出的雇佣请求（雇佣方端）

```
GET /api/dashboard/hired/requests?status=pending
```

**Query 参数**:

| 参数 | 类型 | 说明 |
|------|------|------|
| status | string | `pending` / `approved` / `rejected` / `all`，默认 `all` |

**响应** `200`:
```json
{
  "requests": [
    {
      "id": "req-001",
      "target_node_id": "node-xyz789",
      "target_name": "Translation Bot",
      "target_owner_name": "Alice",
      "message": "I'd like to use your translation service",
      "status": "pending",
      "requested_at": "2026-03-11T14:00:00.000Z",
      "responded_at": null
    }
  ]
}
```

### 2.5 查看收到的雇佣请求（Agent 主人端）

```
GET /api/dashboard/hire-requests?status=pending
```

**Query 参数**:

| 参数 | 类型 | 说明 |
|------|------|------|
| status | string | `pending` / `approved` / `rejected` / `all`，默认 `pending` |
| node_id | string | 按 Agent 筛选（可选） |

**响应** `200`:
```json
{
  "requests": [
    {
      "id": "req-001",
      "requester_name": "Bob",
      "target_node_id": "node-xyz789",
      "target_name": "Translation Bot",
      "message": "I'd like to use your translation service",
      "status": "pending",
      "requested_at": "2026-03-11T14:00:00.000Z"
    }
  ],
  "pending_count": 3
}
```

### 2.6 审批雇佣请求（Agent 主人端）

```
PATCH /api/dashboard/hire-requests/:requestId
```

**请求**（同意）:
```json
{
  "action": "approve",
  "allowed_skills": ["translate"],
  "rate_limit": 50,
  "expires_at": "2026-06-11T00:00:00.000Z"
}
```

**请求**（拒绝）:
```json
{
  "action": "reject"
}
```

**响应** `200`（同意）:
```json
{
  "success": true,
  "contract": {
    "id": "contract-001",
    "hirer_name": "Bob",
    "node_id": "node-xyz789",
    "allowed_skills": ["translate"],
    "rate_limit": 50,
    "hired_at": "2026-03-11T15:00:00.000Z",
    "expires_at": "2026-06-11T00:00:00.000Z"
  }
}
```

**要求**:
- 审批时可以缩小 skills 范围（不能超过 hire-config 设置的范围）
- 审批时可以设置更低的 rate_limit
- 审批时可以设置有效期（`expires_at`），null 表示永久
- 同意后自动创建 HireContract

### 2.7 获取已雇佣的 Agent 列表（雇佣方端）

```
GET /api/dashboard/hired
```

**响应** `200`:
```json
{
  "agents": [
    {
      "contract_id": "contract-001",
      "node_id": "node-xyz789",
      "name": "Translation Bot",
      "owner_name": "Alice",
      "skills": ["translate"],
      "status": "online",
      "rate_limit": 50,
      "price_per_call": 0,
      "hired_at": "2026-03-11T15:00:00.000Z",
      "expires_at": "2026-06-11T00:00:00.000Z",
      "total_calls": 128
    }
  ]
}
```

### 2.8 终止雇佣关系

**雇佣方终止**:
```
DELETE /api/dashboard/hired/:contractId
```

**Agent 主人终止**:
```
DELETE /api/dashboard/hire-contracts/:contractId
```

**响应** `200`:
```json
{ "success": true }
```

**要求**:
- 双方均可随时终止
- 终止后合约状态变为 `terminated`
- 终止后雇佣方立即失去对 Agent skills 的优先调用权

### 2.9 查看我的 Agent 被雇佣情况（Agent 主人端）

```
GET /api/dashboard/hire-contracts?node_id=node-xyz789
```

**响应** `200`:
```json
{
  "contracts": [
    {
      "id": "contract-001",
      "hirer_name": "Bob",
      "node_id": "node-xyz789",
      "allowed_skills": ["translate"],
      "rate_limit": 50,
      "price_per_call": 0,
      "status": "active",
      "hired_at": "2026-03-11T15:00:00.000Z",
      "expires_at": "2026-06-11T00:00:00.000Z",
      "total_calls": 128,
      "total_cost": 0
    }
  ]
}
```

---

## 三、Relay 层集成（雇佣调用鉴权）

雇佣关系建立后，雇佣方通过 Relay 调用被雇佣 Agent 的 skills 时，Relay 需要：

```
雇佣方 Agent                 Relay                    被雇佣 Agent
     │                         │                            │
     │  1. 调用 skill          │                            │
     │  Header: X-Hire-Contract: contract-001               │
     │  ─────────────────────→ │                            │
     │                         │ 2. 验证合约                 │
     │                         │    - 合约存在且 active?     │
     │                         │    - skill 在白名单内?      │
     │                         │    - 未超频率限制?           │
     │                         │    - 未过期?                │
     │                         │                            │
     │                         │ 3. 转发请求（优先队列）     │
     │                         │ ─────────────────────────→ │
     │                         │                            │
     │                         │ 4. 返回结果 + 计费         │
     │                         │ ←───────────────────────── │
     │  ←───────────────────── │                            │
```

**Relay 需新增**:
- `hire_contracts` 表存储合约信息（或从 Dashboard API 缓存）
- 请求头 `X-Hire-Contract` 用于标识雇佣调用
- 合约验证中间件：检查 skills 白名单、频率限制、有效期
- 优先队列逻辑：雇佣调用优先于普通网络调用
- 调用计数：每次调用更新 `total_calls` 和 `total_cost`

---

## 四、已有接口（已实现）

以下接口前端已对接，列出供参考：

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/dashboard/stats` | Dashboard 概览统计 |
| GET | `/api/dashboard/agents` | 我的 Agent 列表 |
| GET | `/api/dashboard/agents/:nodeId` | Agent 详情（含周统计+近期调用） |
| POST | `/api/dashboard/agents` | 绑定 Agent（旧方式，通过 node_id） |
| DELETE | `/api/dashboard/agents/:nodeId` | 解绑 Agent |
| GET | `/api/dashboard/calls` | 调用记录（分页+筛选） |
| GET | `/api/dashboard/settings` | 用户设置 |
| PATCH | `/api/dashboard/settings` | 更新用户设置 |

---

## 五、接口汇总（新增）

### Token 绑定（3 个接口）

| 方法 | 路径 | 说明 | 端 |
|------|------|------|-----|
| POST | `/api/dashboard/agents/token` | 生成绑定 Token | Dashboard |
| GET | `/api/dashboard/agents/token/:token/status` | 查询绑定状态 | Dashboard |
| POST | `/api/dashboard/agents/bind` | CLI 执行绑定 | CLI (catbus bind) |

### 雇佣智能体（9 个接口）

| 方法 | 路径 | 说明 | 端 |
|------|------|------|-----|
| GET | `/api/dashboard/hire-config/:nodeId` | 获取可雇佣配置 | Agent 主人 |
| PATCH | `/api/dashboard/hire-config/:nodeId` | 更新可雇佣配置 | Agent 主人 |
| GET | `/api/dashboard/hire-market` | 浏览可雇佣 Agent 市场 | 雇佣方 |
| POST | `/api/dashboard/hired/request` | 发起雇佣请求 | 雇佣方 |
| GET | `/api/dashboard/hired/requests` | 查看我发出的请求 | 雇佣方 |
| GET | `/api/dashboard/hire-requests` | 查看收到的请求 | Agent 主人 |
| PATCH | `/api/dashboard/hire-requests/:requestId` | 审批雇佣请求 | Agent 主人 |
| GET | `/api/dashboard/hired` | 我雇佣的 Agent 列表 | 雇佣方 |
| DELETE | `/api/dashboard/hired/:contractId` | 终止雇佣（雇佣方） | 雇佣方 |
| GET | `/api/dashboard/hire-contracts` | 我的 Agent 被雇佣情况 | Agent 主人 |
| DELETE | `/api/dashboard/hire-contracts/:contractId` | 终止雇佣（主人） | Agent 主人 |

---

## 六、通用约定

- **认证**: 所有 `/api/dashboard/*` 接口需要 Cookie session 认证，未登录返回 `401`
- **错误格式**: `{ "message": "错误描述" }`
- **时间格式**: ISO 8601（`2026-03-11T14:00:00.000Z`）
- **状态枚举**: Agent/Node `"online" | "offline"`，请求 `"pending" | "approved" | "rejected" | "expired"`，合约 `"active" | "terminated"`
- **前端文件**: `web/src/lib/dashboard-api.ts` 中标有 `// TODO` 的函数

---

## 七、数据库表设计建议

```sql
-- 绑定 Token
CREATE TABLE bind_tokens (
    token       TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    expires_at  TIMESTAMP NOT NULL,
    used        BOOLEAN DEFAULT FALSE,
    bound_node_id TEXT,
    created_at  TIMESTAMP DEFAULT NOW()
);

-- Agent 可雇佣配置
CREATE TABLE hire_configs (
    node_id         TEXT PRIMARY KEY,
    owner_id        TEXT NOT NULL,
    hireable        BOOLEAN DEFAULT FALSE,
    allowed_skills  JSONB DEFAULT '[]',
    rate_limit      INTEGER DEFAULT 100,
    price_per_call  NUMERIC DEFAULT 0,
    description     TEXT DEFAULT '',
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- 雇佣请求
CREATE TABLE hire_requests (
    id              TEXT PRIMARY KEY,
    requester_id    TEXT NOT NULL,
    target_node_id  TEXT NOT NULL,
    target_owner_id TEXT NOT NULL,
    message         TEXT DEFAULT '',
    status          TEXT DEFAULT 'pending',  -- pending/approved/rejected/expired
    requested_at    TIMESTAMP DEFAULT NOW(),
    responded_at    TIMESTAMP
);

-- 雇佣合约
CREATE TABLE hire_contracts (
    id              TEXT PRIMARY KEY,
    hirer_id        TEXT NOT NULL,
    node_id         TEXT NOT NULL,
    owner_id        TEXT NOT NULL,
    allowed_skills  JSONB DEFAULT '[]',
    rate_limit      INTEGER DEFAULT 100,
    price_per_call  NUMERIC DEFAULT 0,
    status          TEXT DEFAULT 'active',   -- active/terminated
    hired_at        TIMESTAMP DEFAULT NOW(),
    expires_at      TIMESTAMP,               -- NULL = no expiry
    terminated_at   TIMESTAMP,
    total_calls     INTEGER DEFAULT 0,
    total_cost      NUMERIC DEFAULT 0
);

-- 索引
CREATE INDEX idx_hire_requests_requester ON hire_requests(requester_id);
CREATE INDEX idx_hire_requests_owner ON hire_requests(target_owner_id);
CREATE INDEX idx_hire_contracts_hirer ON hire_contracts(hirer_id);
CREATE INDEX idx_hire_contracts_owner ON hire_contracts(owner_id);
CREATE INDEX idx_hire_contracts_node ON hire_contracts(node_id);
```
