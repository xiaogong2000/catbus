# CatBus Dashboard 前端接口指南

**版本**: 2026-03-11  
**状态**: 后端待实现（前端用桩函数占位中）  
**前端代码**: `web/src/lib/dashboard-api.ts`（搜 `TODO` 找到所有桩函数位置）

---

## 快速导航

| 模块 | 接口数 | 状态 |
|------|--------|------|
| [一、Token 绑定](#一token-绑定) | 3 个 | ⏳ 等后端 |
| [二、雇佣市场（雇佣方）](#二雇佣市场雇佣方) | 5 个 | ⏳ 等后端 |
| [三、雇佣管理（Agent 主人）](#三雇佣管理agent-主人) | 4 个 | ⏳ 等后端 |
| [四、已实现接口参考](#四已实现接口参考) | 8 个 | ✅ 可用 |

---

## 通用约定

### 认证
- 所有 `/api/dashboard/*` 需要 Cookie session
- 未登录 → `401 Unauthorized`

### 错误格式
```typescript
// 所有错误统一格式
interface ApiError {
  message: string;
}
// 示例: { "message": "Agent not found" }
```

### 时间格式
- 统一 ISO 8601：`"2026-03-11T14:00:00.000Z"`

### 状态枚举速查
```typescript
type AgentStatus    = "online" | "offline";
type RequestStatus  = "pending" | "approved" | "rejected" | "expired";
type ContractStatus = "active" | "terminated";
```

---

## 一、Token 绑定

**用户场景**：用户在 Dashboard 点击「Bind Agent」→ 生成一次性 Token → 复制到终端执行 `catbus bind <token>` → 前端轮询直到绑定成功，新 Agent 自动出现在列表。

### 流程图
```
[用户点击 Bind Agent]
        ↓
POST /agents/token  ──→  { token, expires_at }
        ↓
前端展示: $ catbus bind <token>
        ↓
每 3 秒轮询 GET /agents/token/:token/status
        ↓
{ bound: true, agent: {...} }  ──→  添加到 Agent 列表
```

---

### 1.1 生成绑定 Token

```
POST /api/dashboard/agents/token
```

**请求**：无 Body

**成功响应** `200`:
```typescript
interface BindTokenResponse {
  token: string;       // e.g. "a1b2c3d4e5f6g7h8"
  expires_at: string;  // ISO 8601，5 分钟后过期
}
```

**注意事项**：
- 同一用户只有一个有效 Token，调用此接口会使旧 Token 失效
- Token 绑定成功后立即失效（一次性使用）

---

### 1.2 查询 Token 绑定状态（轮询）

```
GET /api/dashboard/agents/token/:token/status
```

**轮询间隔**：3 秒

**响应** `200`（等待中）:
```typescript
{ bound: false }
```

**响应** `200`（绑定成功）:
```typescript
interface BoundResponse {
  bound: true;
  agent: Agent;  // 见下方 Agent 类型
}
```

**响应** `404`：Token 过期或不存在 → 停止轮询，提示用户重新生成

**Agent 完整类型**：
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
  registered_at: string;  // ISO 8601
}

interface SkillSummary {
  name: string;
  status: "online" | "offline";
  calls_handled: number;
  success_rate: number;  // 0 ~ 1，例如 0.98 表示 98%
}
```

---

### 1.3 CLI 绑定接口（仅供 `catbus bind` 命令调用）

> ⚠️ 前端不调用此接口，这是 catbus CLI 工具在用户终端执行时调用的

```
POST /api/dashboard/agents/bind
```

**请求 Body**：
```typescript
{
  token: string;    // 用户粘贴的 Token
  node_id: string;  // Agent 的节点 ID
  name: string;     // Agent 名称
  server: string;   // 所在 server
}
```

**响应** `200`：`{ success: true, message: "Agent bound successfully" }`  
**响应** `400`：Token 无效或已过期

---

## 二、雇佣市场（雇佣方）

**用户场景**：我想雇用别人的 Agent 来帮我干活 → 浏览市场 → 发起请求 → 等待审批 → 查看已雇用的 Agent 列表 → 随时可以解雇。

---

### 2.1 浏览可雇佣 Agent 市场

```
GET /api/dashboard/hire-market
```

**Query 参数**：
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| page | number | 1 | 页码 |
| limit | number | 20 | 每页条数 |
| skill | string | — | 按 skill 名称筛选 |
| search | string | — | 搜索 Agent 名称 |

**示例**：`GET /api/dashboard/hire-market?skill=translate&page=1`

**成功响应** `200`:
```typescript
interface HireMarketResponse {
  data: HireMarketItem[];
  total: number;
  page: number;
  limit: number;
}

interface HireMarketItem {
  node_id: string;
  name: string;
  owner_name: string;
  status: "online" | "offline";
  allowed_skills: string[];   // 该 Agent 开放的 skills
  rate_limit: number;          // 每小时最大调用次数
  price_per_call: number;      // 0 = 免费
  description: string;
  total_hirers: number;        // 已被多少人雇用
}
```

**过滤规则**（后端处理，前端了解即可）：
- 只返回 `hireable: true` 的 Agent
- 自动排除当前用户自己的 Agent
- 自动排除已雇用的 Agent（或标记 `already_hired: true`）

---

### 2.2 发起雇佣请求

```
POST /api/dashboard/hired/request
```

**请求 Body**：
```typescript
{
  node_id: string;   // 目标 Agent
  message?: string;  // 可选的留言
}
```

**成功响应** `201`:
```typescript
interface HireRequestCreated {
  request: {
    id: string;
    target_node_id: string;
    status: "pending";
    requested_at: string;
  }
}
```

**错误响应**：
| 状态码 | 含义 | 处理建议 |
|--------|------|---------|
| 400 | 不能雇用自己的 Agent | 提示用户 |
| 404 | Agent 不存在或不可雇佣 | 提示刷新市场 |
| 409 | 已有 pending 请求或已雇用 | 提示查看请求列表 |

---

### 2.3 查看我发出的雇佣请求

```
GET /api/dashboard/hired/requests
```

**Query 参数**：
| 参数 | 类型 | 说明 |
|------|------|------|
| status | string | `pending` / `approved` / `rejected` / `all`，默认 `all` |

**成功响应** `200`:
```typescript
interface MyHireRequestsResponse {
  requests: MyHireRequest[];
}

interface MyHireRequest {
  id: string;
  target_node_id: string;
  target_name: string;
  target_owner_name: string;
  message: string;
  status: "pending" | "approved" | "rejected" | "expired";
  requested_at: string;
  responded_at: string | null;  // 未审批时为 null
}
```

---

### 2.4 查看已雇用的 Agent 列表

```
GET /api/dashboard/hired
```

**成功响应** `200`:
```typescript
interface HiredAgentsResponse {
  agents: HiredAgent[];
}

interface HiredAgent {
  contract_id: string;
  node_id: string;
  name: string;
  owner_name: string;
  skills: string[];          // 已授权可用的 skills
  status: "online" | "offline";
  rate_limit: number;
  price_per_call: number;
  hired_at: string;
  expires_at: string | null; // null = 永久有效
  total_calls: number;
}
```

---

### 2.5 终止雇用关系（雇佣方主动终止）

```
DELETE /api/dashboard/hired/:contractId
```

**成功响应** `200`：`{ success: true }`

**注意**：终止后立即失去对该 Agent skills 的调用权

---

## 三、雇佣管理（Agent 主人）

**用户场景**：我有 Agent，想开放给别人用 → 配置可雇佣选项 → 收到请求后审批 → 查看谁在用我的 Agent → 随时可以终止合约。

---

### 3.1 获取 / 更新 Agent 可雇佣配置

#### 获取配置

```
GET /api/dashboard/hire-config/:nodeId
```

**成功响应** `200`:
```typescript
interface HireConfig {
  hireable: boolean;
  allowed_skills: string[];  // 空数组 = 开放全部 skills
  rate_limit: number;         // 每小时最大调用次数
  price_per_call: number;     // 每次调用价格，0 = 免费
  description: string;
}
```

#### 更新配置

```
PATCH /api/dashboard/hire-config/:nodeId
```

**请求 Body**：`HireConfig`（同上，全量或部分字段均可）

**成功响应** `200`：`{ success: true }`

**注意**：
- 只有 Agent 主人能修改
- `hireable: false` 后不再出现在市场，但**已有合约不受影响**
- `allowed_skills: []` 表示开放所有 skills

---

### 3.2 查看收到的雇佣请求

```
GET /api/dashboard/hire-requests
```

**Query 参数**：
| 参数 | 类型 | 说明 |
|------|------|------|
| status | string | `pending` / `approved` / `rejected` / `all`，默认 `pending` |
| node_id | string | 筛选指定 Agent（可选） |

**成功响应** `200`:
```typescript
interface IncomingHireRequestsResponse {
  requests: IncomingHireRequest[];
  pending_count: number;  // 待审批总数（用于 badge 展示）
}

interface IncomingHireRequest {
  id: string;
  requester_name: string;
  target_node_id: string;
  target_name: string;
  message: string;
  status: "pending" | "approved" | "rejected" | "expired";
  requested_at: string;
}
```

---

### 3.3 审批雇佣请求

```
PATCH /api/dashboard/hire-requests/:requestId
```

**请求 Body（同意）**：
```typescript
{
  action: "approve";
  allowed_skills?: string[];  // 可缩小范围，不能超过 hire-config 设置的范围
  rate_limit?: number;        // 可设更低限制
  expires_at?: string | null; // null = 永久有效
}
```

**请求 Body（拒绝）**：
```typescript
{
  action: "reject";
}
```

**成功响应** `200`（同意）：
```typescript
interface ApproveResponse {
  success: true;
  contract: {
    id: string;
    hirer_name: string;
    node_id: string;
    allowed_skills: string[];
    rate_limit: number;
    hired_at: string;
    expires_at: string | null;
  }
}
```

**成功响应** `200`（拒绝）：`{ success: true }`

---

### 3.4 查看 Agent 被雇佣情况（合约列表）

```
GET /api/dashboard/hire-contracts
```

**Query 参数**：`node_id`（可选，筛选指定 Agent）

**成功响应** `200`:
```typescript
interface HireContractsResponse {
  contracts: HireContract[];
}

interface HireContract {
  id: string;
  hirer_name: string;
  node_id: string;
  allowed_skills: string[];
  rate_limit: number;
  price_per_call: number;
  status: "active" | "terminated";
  hired_at: string;
  expires_at: string | null;
  total_calls: number;
  total_cost: number;
}
```

#### 终止合约（Agent 主人主动终止）

```
DELETE /api/dashboard/hire-contracts/:contractId
```

**成功响应** `200`：`{ success: true }`

---

## 四、已实现接口参考

以下接口已可用，前端已对接：

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/dashboard/stats` | Dashboard 概览统计 |
| GET | `/api/dashboard/agents` | 我的 Agent 列表 |
| GET | `/api/dashboard/agents/:nodeId` | Agent 详情（含周统计 + 近期调用） |
| POST | `/api/dashboard/agents` | 绑定 Agent（旧方式，通过 node_id） |
| DELETE | `/api/dashboard/agents/:nodeId` | 解绑 Agent |
| GET | `/api/dashboard/calls` | 调用记录（分页 + 筛选） |
| GET | `/api/dashboard/settings` | 用户设置 |
| PATCH | `/api/dashboard/settings` | 更新用户设置 |

---

## 五、前端接入 Checklist

在 `web/src/lib/dashboard-api.ts` 中完成以下 TODO：

### Token 绑定模块
- [ ] `generateBindToken()` → `POST /api/dashboard/agents/token`
- [ ] `pollBindStatus(token)` → `GET /api/dashboard/agents/token/:token/status`（每 3 秒）

### 雇佣方模块
- [ ] `getHireMarket(params)` → `GET /api/dashboard/hire-market`
- [ ] `createHireRequest(nodeId, message)` → `POST /api/dashboard/hired/request`
- [ ] `getMyHireRequests(status)` → `GET /api/dashboard/hired/requests`
- [ ] `getHiredAgents()` → `GET /api/dashboard/hired`
- [ ] `terminateHire(contractId)` → `DELETE /api/dashboard/hired/:contractId`

### Agent 主人模块
- [ ] `getHireConfig(nodeId)` → `GET /api/dashboard/hire-config/:nodeId`
- [ ] `updateHireConfig(nodeId, config)` → `PATCH /api/dashboard/hire-config/:nodeId`
- [ ] `getIncomingHireRequests(status)` → `GET /api/dashboard/hire-requests`
- [ ] `approveHireRequest(requestId, options)` → `PATCH /api/dashboard/hire-requests/:requestId`
- [ ] `getHireContracts(nodeId?)` → `GET /api/dashboard/hire-contracts`
- [ ] `terminateContract(contractId)` → `DELETE /api/dashboard/hire-contracts/:contractId`

---

## 六、常见问题

**Q: `allowed_skills: []` 是"没有权限"还是"全部权限"？**  
A: 全部权限。空数组表示开放所有 skills。

**Q: 合约的 `expires_at: null` 是什么意思？**  
A: 永久有效，直到任一方手动终止。

**Q: Token 绑定轮询要怎么处理超时？**  
A: 收到 `404` 时停止轮询并提示用户 Token 已过期，需重新生成（Token 有效期 5 分钟）。

**Q: 雇佣审批时 `allowed_skills` 能比 hire-config 设置的范围更大吗？**  
A: 不能，只能缩小或保持相同。后端会校验。

**Q: `price_per_call: 0` 是什么意思？**  
A: 免费，当前阶段大部分 Agent 都是 0。积分/计费系统后续实现。

---

*本文档由 NeFi 根据后端需求文档 `backend-api-requirements-2026-03-11.md` 整理生成。*  
*有疑问找 Lebron（后端）或查看原始需求文档。*
