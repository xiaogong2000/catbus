# CatBus Backend API Requirements

> 本文档定义了 CatBus Web 前端所需的全部后端 API 接口、数据格式和业务逻辑。
> 目标：将 dashboard 页面从 mock 数据切换为真实后端 API。

---

## 当前状态

### 已有（真实数据）

| 模块 | 状态 | 实现方式 |
|------|------|----------|
| 用户注册 | ✅ 真实 | SQLite + bcryptjs，`POST /api/register` |
| 邮箱登录 | ✅ 真实 | NextAuth credentials provider |
| OAuth 登录 | ✅ 真实 | GitHub + Google OAuth |
| 会话管理 | ✅ 真实 | NextAuth JWT |
| 公共网络页面 | ✅ 真实 | 调用 `relay.catbus.xyz/api`（stats/nodes/skills） |

### 待开发（当前 mock 数据）

| 模块 | 文件 | 说明 |
|------|------|------|
| Dashboard 概览 | `src/app/dashboard/page.tsx` | 用户的 agent 统计、调用统计 |
| 我的 Agents | `src/app/dashboard/agents/page.tsx` | 用户绑定的 agent 列表 |
| Agent 详情 | `src/app/dashboard/agents/[id]/page.tsx` | 单个 agent 详情 + 调用图表 |
| 调用历史 | `src/app/dashboard/calls/page.tsx` | 调用记录列表、筛选 |
| 用户设置 | `src/app/dashboard/settings/page.tsx` | 通知偏好、agent 绑定 |

Mock 数据文件：`src/lib/mock-data-dashboard.ts`（开发完成后可删除）

---

## 技术约束

```
前端框架：Next.js 16 (App Router) + React 19 + TypeScript
认证：NextAuth v4 (JWT session)
当前数据库：SQLite (better-sqlite3)，仅存储 users 表
部署：PM2 + Caddy on 51.75.146.33
Relay API：relay.catbus.xyz/api（公共网络数据，已有）
```

### 认证上下文

所有 `/api/dashboard/*` 接口必须验证 JWT session，从 token 中提取 `user.id`：

```typescript
// 在 API route 中获取当前用户
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const session = await getServerSession(authOptions);
if (!session?.user) {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
const userId = (session.user as { id: string }).id;
```

---

## 数据库 Schema

### 现有表

```sql
-- 已存在，无需修改
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

### 需要新增的表

```sql
-- 用户绑定的 Agent
CREATE TABLE user_agents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  node_id TEXT NOT NULL,           -- relay 网络中的 node_id
  name TEXT NOT NULL,              -- agent 显示名称
  bound_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, node_id)
);

-- 用户设置
CREATE TABLE user_settings (
  user_id INTEGER PRIMARY KEY REFERENCES users(id),
  github_username TEXT,
  notify_agent_offline INTEGER DEFAULT 1,  -- boolean: 0/1
  notify_daily_report INTEGER DEFAULT 0,
  notify_weekly_report INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now'))
);
```

> **注意**：Agent 的实时状态（skills、uptime、calls）从 relay API 获取，不存本地。
> 调用历史同样从 relay API 获取，按 node_id 过滤属于当前用户的记录。

---

## API 接口定义

### 1. Dashboard 概览

**`GET /api/dashboard/stats`**

聚合当前用户的所有 agent 数据，返回概览统计。

**响应格式：**

```typescript
interface DashboardStatsResponse {
  my_agents: number;        // 用户绑定的 agent 数量
  my_skills: number;        // 所有 agent 提供的 skill 总数（去重）
  calls_received: number;   // 今日所有 agent 的入站调用总数
  calls_made: number;       // 今日所有 agent 的出站调用总数
  avg_latency_ms: number;   // 平均响应延迟
  success_rate: number;     // 成功率（0-100，如 99.36）
}
```

**实现逻辑：**

```
1. 从 user_agents 表获取当前用户绑定的所有 node_id
2. 对每个 node_id 调用 relay API: GET /nodes/{node_id}
3. 聚合数据：
   - my_agents = 绑定数量
   - my_skills = 所有 agent 的 skills 数组合并去重后的长度
   - calls_received / calls_made = 从 relay 调用记录 API 统计
   - avg_latency_ms = 所有调用的平均延迟
   - success_rate = 成功调用数 / 总调用数 * 100
```

---

### 2. 我的 Agents 列表

**`GET /api/dashboard/agents`**

**响应格式：**

```typescript
interface AgentListResponse {
  agents: Agent[];
}

interface Agent {
  node_id: string;
  name: string;              // 用户自定义名称
  status: "online" | "offline";
  skills: SkillSummary[];
  uptime_seconds: number;
  calls_handled: number;     // 该 agent 处理的总调用数
  calls_made: number;        // 该 agent 发出的总调用数
  server: string;            // relay 服务器地址
  registered_at: string;     // ISO 时间戳
}

interface SkillSummary {
  name: string;
  status: "online" | "offline";
  calls_handled: number;
  success_rate: number;      // 0-100
}
```

**实现逻辑：**

```
1. 从 user_agents 获取用户的 node_id 列表
2. 对每个 node_id 调用 relay API 获取实时数据
3. 合并本地名称和远程状态数据
4. 若 relay 返回 404，标记 status 为 "offline"
```

---

### 3. 单个 Agent 详情

**`GET /api/dashboard/agents/:nodeId`**

**响应格式：**

```typescript
interface AgentDetailResponse {
  agent: Agent;                    // 同上面的 Agent 接口
  weekly_stats: DailyCallStat[];   // 最近 7 天的调用统计
  recent_calls: CallRecord[];      // 最近 20 条调用记录
}

interface DailyCallStat {
  date: string;       // "YYYY-MM-DD"
  inbound: number;
  outbound: number;
}
```

**前置检查：** 验证该 node_id 属于当前用户（从 user_agents 表查）。

---

### 4. 调用历史

**`GET /api/dashboard/calls`**

**Query 参数：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `page` | number | 1 | 页码 |
| `limit` | number | 20 | 每页数量（max 100） |
| `agent` | string | 空 | 按 node_id 筛选 |
| `direction` | string | 空 | `inbound` / `outbound` |
| `status` | string | 空 | `success` / `error` / `timeout` |
| `skill` | string | 空 | 按 skill 名称筛选 |

**响应格式：**

```typescript
interface CallHistoryResponse {
  data: CallRecord[];
  total: number;
  page: number;
  limit: number;
}

interface CallRecord {
  id: string;                                // 唯一标识
  timestamp: string;                         // ISO 时间戳
  direction: "inbound" | "outbound";
  skill: string;                             // skill 名称
  remote_node: string;                       // 对方 node_id
  agent_name: string;                        // 本方 agent 名称
  latency_ms: number;
  status: "success" | "error" | "timeout";
  input?: string;                            // 调用输入（可选）
  output?: string;                           // 调用输出（可选）
  relay: string;                             // 经过的 relay 节点
}
```

**实现逻辑：**

```
1. 获取用户的所有 node_id
2. 从 relay API 获取这些 node_id 的调用记录
3. 应用筛选条件
4. 分页返回
```

---

### 5. Agent 绑定/解绑

**`POST /api/dashboard/agents`** — 绑定 Agent

```typescript
// 请求体
interface BindAgentRequest {
  node_id: string;
  name?: string;    // 可选，默认用 relay 返回的 name
}

// 响应
interface BindAgentResponse {
  success: boolean;
  agent: Agent;
}
```

**实现逻辑：**

```
1. 验证 node_id 在 relay 网络中存在：GET /nodes/{node_id}
2. 验证该 node_id 未被其他用户绑定（或允许共享绑定，取决于业务需求）
3. 写入 user_agents 表
4. 返回完整的 Agent 数据
```

**`DELETE /api/dashboard/agents/:nodeId`** — 解绑 Agent

```typescript
// 响应
{ success: boolean }
```

---

### 6. 用户设置

**`GET /api/dashboard/settings`**

```typescript
interface UserSettingsResponse {
  github_username: string | null;
  email: string;
  notifications: {
    agent_offline_email: boolean;
    daily_report: boolean;
    weekly_report: boolean;
  };
  bound_agents: {
    node_id: string;
    name: string;
  }[];
}
```

**`PATCH /api/dashboard/settings`**

```typescript
// 请求体（所有字段可选，只更新传入的字段）
interface UpdateSettingsRequest {
  github_username?: string;
  name?: string;
  notifications?: {
    agent_offline_email?: boolean;
    daily_report?: boolean;
    weekly_report?: boolean;
  };
}

// 响应
{ success: boolean }
```

---

### 7. Relay API 扩展需求

当前 relay API (`relay.catbus.xyz/api`) 已提供的接口：

```
GET /stats              → 全网统计
GET /nodes              → 节点列表（分页）
GET /nodes/:nodeId      → 单节点详情
GET /skills             → 技能列表（分页）
GET /skills/:name       → 单技能详情
```

**需要 relay 新增或确认的接口：**

```
GET /nodes/:nodeId/calls?page=1&limit=20&since=2026-03-01
→ 返回指定节点的调用记录（CallRecord[]），支持时间范围筛选

GET /nodes/:nodeId/stats/daily?days=7
→ 返回指定节点最近 N 天的每日调用统计（DailyCallStat[]）

GET /nodes/:nodeId/calls/summary
→ 返回指定节点的调用汇总（total_handled, total_made, success_rate, avg_latency）
```

> 如果 relay 暂不支持这些接口，后端可先用 mock 数据过渡，
> 但接口格式必须与上述定义一致，方便后续无缝切换。

---

## 前端对接指南

### 文件修改清单

完成后端 API 后，前端需要修改以下文件：

```
src/lib/api.ts
  ├── 新增 getDashboardStats()
  ├── 新增 getMyAgents()
  ├── 新增 getAgentDetail(nodeId)
  ├── 新增 getCallHistory(filters)
  ├── 新增 bindAgent(nodeId, name?)
  ├── 新增 unbindAgent(nodeId)
  ├── 新增 getUserSettings()
  └── 新增 updateUserSettings(data)

src/app/dashboard/page.tsx
  └── 替换 mock 导入 → 调用 getDashboardStats() + getMyAgents()

src/app/dashboard/agents/page.tsx
  └── 替换 mock 导入 → 调用 getMyAgents()

src/app/dashboard/agents/[id]/page.tsx
  └── 替换 mock 导入 → 调用 getAgentDetail(nodeId)

src/app/dashboard/calls/page.tsx
  └── 替换 mock 导入 → 调用 getCallHistory(filters)

src/app/dashboard/settings/page.tsx
  └── 替换 mock 导入 → 调用 getUserSettings() + updateUserSettings()

src/lib/mock-data-dashboard.ts
  └── 全部完成后删除此文件
```

### API 调用模式

Dashboard API 走内部路由（`/api/dashboard/*`），不走 relay：

```typescript
// src/lib/api.ts 新增

async function fetchDashboardApi<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api/dashboard${path}`, {
    credentials: "include",  // 携带 session cookie
    ...options,
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error("Unauthorized");
    throw new Error(`Dashboard API error: ${res.status}`);
  }
  return res.json();
}

export async function getDashboardStats(): Promise<DashboardStatsResponse> {
  return fetchDashboardApi("/stats");
}

export async function getMyAgents(): Promise<AgentListResponse> {
  return fetchDashboardApi("/agents");
}

// ... 其他函数同理
```

---

## API 路由文件结构

```
src/app/api/
├── auth/[...nextauth]/route.ts     # 已有
├── register/route.ts               # 已有
└── dashboard/
    ├── stats/route.ts              # GET  → DashboardStatsResponse
    ├── agents/
    │   ├── route.ts                # GET  → AgentListResponse
    │   │                           # POST → BindAgentResponse
    │   └── [nodeId]/
    │       └── route.ts            # GET    → AgentDetailResponse
    │                               # DELETE → { success: boolean }
    ├── calls/route.ts              # GET  → CallHistoryResponse
    └── settings/route.ts           # GET   → UserSettingsResponse
                                    # PATCH → { success: boolean }
```

---

## 错误响应格式

所有 API 统一错误格式：

```typescript
interface ApiError {
  error: string;      // 错误码，如 "UNAUTHORIZED", "NOT_FOUND", "VALIDATION_ERROR"
  message: string;    // 人类可读的描述
}
```

**HTTP 状态码规范：**

| 状态码 | 场景 |
|--------|------|
| 200 | 成功 |
| 201 | 创建成功（绑定 agent） |
| 400 | 请求参数错误 |
| 401 | 未登录 |
| 403 | 无权限（如访问别人的 agent） |
| 404 | 资源不存在 |
| 409 | 冲突（如重复绑定） |
| 500 | 服务器内部错误 |

---

## 开发优先级建议

```
Phase 1 — 基础 CRUD（可独立完成，不依赖 relay 扩展）
  1. 数据库迁移：创建 user_agents、user_settings 表
  2. POST /api/dashboard/agents（绑定 agent）
  3. DELETE /api/dashboard/agents/:nodeId（解绑）
  4. GET /api/dashboard/agents（列表，合并 relay 数据）
  5. GET/PATCH /api/dashboard/settings

Phase 2 — 数据聚合（需要 relay API 配合）
  6. GET /api/dashboard/stats（聚合统计）
  7. GET /api/dashboard/agents/:nodeId（详情 + 图表数据）
  8. GET /api/dashboard/calls（调用历史）

Phase 3 — 前端对接
  9. 修改 dashboard 各页面，替换 mock → 真实 API
  10. 删除 mock-data-dashboard.ts
  11. 端到端测试
```

---

## 环境变量

```env
# 已有
NEXTAUTH_SECRET=<secret>
NEXTAUTH_URL=https://catbus.xyz
GITHUB_CLIENT_ID=<id>
GITHUB_CLIENT_SECRET=<secret>
GOOGLE_CLIENT_ID=<id>
GOOGLE_CLIENT_SECRET=<secret>

# 可能需要新增
RELAY_API_URL=https://relay.catbus.xyz/api    # relay API 地址（当前硬编码在 api.ts 中）
DATABASE_PATH=./data/users.db                  # 数据库路径（当前硬编码在 db.ts 中）
```
