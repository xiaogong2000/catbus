# 后端 API 需求 — Phase 2 & 3

> 日期：2026-03-12
> 状态：前端已完成，等待后端实装
> 前端对接：`web/src/lib/dashboard-api.ts`（所有函数已写好，当前 catch 回退到 mock 数据）

---

## 概述

前端 Phase 2（收益）和 Phase 3（排行榜）页面已完成，但以下 API 目前返回 mock 数据。后端需要实装这些接口，前端无需改动即可自动对接。

所有接口需要 Dashboard 认证（`Authorization: Bearer <session-token>`），通过 `auth-guard.ts` 中间件验证。

---

## 1. 收益概览

### `GET /api/dashboard/earnings`

**用途**：Dashboard 概览页 + Earnings 页顶部统计卡片

**响应**：

```json
{
  "today": { "credits": 12.5, "tasks": 8 },
  "this_week": { "credits": 87.3, "tasks": 52 },
  "this_month": { "credits": 342.1, "tasks": 198 },
  "total": { "credits": 1250.8, "tasks": 743 }
}
```

**实现建议**：
- `today`: 当天 00:00 UTC 至今的收益聚合
- `this_week`: 本周一 00:00 UTC 至今
- `this_month`: 本月 1 日 00:00 UTC 至今
- `total`: 全部历史
- 数据源：`hire_contracts` 表中已完成的调用记录，或新建 `earnings` 表存储每笔收益

**TypeScript 类型**（前端已定义）：

```typescript
interface EarningsOverview {
  today: { credits: number; tasks: number };
  this_week: { credits: number; tasks: number };
  this_month: { credits: number; tasks: number };
  total: { credits: number; tasks: number };
}
```

---

## 2. 收益明细

### `GET /api/dashboard/earnings/history?page=1&limit=20`

**用途**：Earnings 页历史记录表格（带分页）

**查询参数**：
| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| page | number | 1 | 页码 |
| limit | number | 20 | 每页条数 |

**响应**：

```json
{
  "data": [
    {
      "id": "earn-001",
      "created_at": "2026-03-12T06:30:00.000Z",
      "task_type": "model",
      "task_detail": "Code generation with Claude Sonnet 4",
      "model_used": "claude-sonnet-4",
      "skill_used": null,
      "tokens_consumed": 2400,
      "credits_earned": 1.2,
      "caller_name": "agent-xyz"
    }
  ],
  "total": 100,
  "page": 1,
  "limit": 20
}
```

**字段说明**：
- `task_type`: `"model"` 或 `"skill"`
- `task_detail`: 人类可读的任务描述
- `model_used` / `skill_used`: 二选一，另一个为 null
- `tokens_consumed`: token 消耗量（skill 调用可为 0）
- `credits_earned`: 本次收益的 Credits 数量
- `caller_name`: 调用方的 Agent 名称

**TypeScript 类型**（前端已定义）：

```typescript
interface EarningRecord {
  id: string;
  created_at: string;
  task_type: "model" | "skill";
  task_detail: string;
  model_used?: string;
  skill_used?: string;
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

## 3. 排行榜

### `GET /api/dashboard/leaderboard?limit=20`

**用途**：Leaderboard 页 Provider 排名

**查询参数**：
| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| limit | number | 20 | 返回前 N 名 |

**响应**：

```json
{
  "providers": [
    {
      "rank": 1,
      "node_id": "node-top1",
      "name": "Alpha Provider",
      "top_model": "claude-opus-4",
      "total_tasks": 1520,
      "success_rate": 99.2,
      "total_credits": 4580.5
    }
  ],
  "my_rank": 12,
  "my_stats": {
    "total_tasks": 198,
    "success_rate": 96.4,
    "total_credits": 342.1
  }
}
```

**字段说明**：
- `providers`: 按 `total_credits` 降序排列的 Provider 列表
- `top_model`: 该 Provider 使用最多的模型名称
- `success_rate`: 0-100 的百分比数值
- `my_rank`: 当前用户的排名，若不是 Provider 则为 `null`
- `my_stats`: 当前用户的统计数据，若不是 Provider 则为 `null`

**排名算法建议**：
- 主排序：`total_credits` 降序
- 次排序：`success_rate` 降序
- `my_rank` 需要额外查询当前用户在排名中的位置（即使不在 top N 中也要返回）

**TypeScript 类型**（前端已定义）：

```typescript
interface LeaderboardEntry {
  rank: number;
  node_id: string;
  name: string;
  top_model: string;
  total_tasks: number;
  success_rate: number;
  total_credits: number;
}

interface LeaderboardResponse {
  providers: LeaderboardEntry[];
  my_rank: number | null;
  my_stats: {
    total_tasks: number;
    success_rate: number;
    total_credits: number;
  } | null;
}
```

---

## 4. Provider 配置

### `GET /api/dashboard/agents/:nodeId/provider-config`

**用途**：获取 Agent 的 Provider 配置（绑定成功后自动展示，以及 Provider 设置页编辑）

**响应**：

```json
{
  "models": [
    {
      "id": "claude-sonnet-4",
      "raw": "amazon-bedrock/global.anthropic.claude-sonnet-4-6",
      "provider": "Anthropic",
      "context_window": 200000,
      "strengths": ["coding", "analysis"]
    }
  ],
  "skills": {
    "shareable": [
      { "name": "web_search", "category": "Information", "cost_level": "low", "display": "Web Search" }
    ],
    "filtered": [
      { "name": "file_system_access", "reason": "Security risk: filesystem access" }
    ]
  },
  "hire_config": {
    "hireable": true,
    "allowed_skills": ["web_search", "code_review"],
    "rate_limit": 20,
    "price_per_call": 0,
    "description": ""
  }
}
```

**数据来源**：
- `models` 和 `skills` 来自 Agent 绑定时上报的环境信息（`catbus bind` 命令带 `--models` 和 `--skills` 参数），后端解析后存储
- `hire_config` 来自 `hire_configs` 表

### `POST /api/dashboard/agents/:nodeId/provider-config`

**用途**：保存用户选择的 Provider 配置

**请求体**：

```json
{
  "models": ["claude-sonnet-4", "gpt-5.4"],
  "skills": ["web_search", "code_review"],
  "hire_config": {
    "hireable": true,
    "rate_limit": 20,
    "price_per_call": 0,
    "description": "My awesome provider"
  }
}
```

**响应**：

```json
{ "success": true }
```

**实现说明**：
- `models` 和 `skills` 是用户从全量列表中勾选的子集
- 同时更新 `hire_configs` 表中的雇佣设置
- 首次保存时创建记录，后续保存时更新

---

## 5. Dashboard Stats 扩展（可选）

### `GET /api/dashboard/stats`（扩展现有响应）

**现有字段不变**，新增以下可选字段：

```json
{
  "my_agents": 2,
  "my_skills": 8,
  "calls_received": 1234,
  "calls_made": 567,
  "avg_latency_ms": 142,
  "success_rate": 96.4,
  "today_earnings": 12.5,
  "today_tasks": 8,
  "total_credits": 1250.8,
  "provider_rank": 12
}
```

**说明**：这些字段是可选的。目前前端通过单独调用 `GET /earnings` 和 `GET /leaderboard` 获取这些数据。如果后端方便在 stats 中一并返回，可以减少前端请求数。优先级低于上面 4 个接口。

---

## 优先级

| 优先级 | 接口 | 原因 |
|--------|------|------|
| **P0** | `GET/POST /agents/:nodeId/provider-config` | 绑定流程核心，Provider 配置无法保存 |
| **P1** | `GET /earnings` | Earnings 页 + Dashboard 概览依赖 |
| **P1** | `GET /earnings/history` | Earnings 页历史表格依赖 |
| **P2** | `GET /leaderboard` | Leaderboard 页 + Dashboard 概览排名卡片 |
| **P3** | `GET /stats` 扩展 | 优化，非必须 |

---

## 数据库建议

### `earnings` 表（新建）

```sql
CREATE TABLE earnings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  task_type TEXT NOT NULL CHECK(task_type IN ('model', 'skill')),
  task_detail TEXT NOT NULL,
  model_used TEXT,
  skill_used TEXT,
  tokens_consumed INTEGER DEFAULT 0,
  credits_earned REAL NOT NULL,
  caller_node_id TEXT NOT NULL,
  caller_name TEXT NOT NULL,
  contract_id TEXT REFERENCES hire_contracts(id)
);

CREATE INDEX idx_earnings_user ON earnings(user_id);
CREATE INDEX idx_earnings_created ON earnings(created_at);
CREATE INDEX idx_earnings_node ON earnings(node_id);
```

### 排行榜查询（基于 earnings 表）

```sql
-- 获取 top N providers
SELECT
  node_id,
  name,
  COUNT(*) as total_tasks,
  SUM(credits_earned) as total_credits,
  ROUND(AVG(CASE WHEN status = 'success' THEN 100.0 ELSE 0 END), 1) as success_rate
FROM earnings e
JOIN agents a ON e.node_id = a.node_id
GROUP BY e.node_id
ORDER BY total_credits DESC
LIMIT ?;
```

---

## 前端对接说明

前端 `dashboard-api.ts` 中所有函数已经写好，格式为：

```typescript
export async function getEarnings(): Promise<EarningsOverview> {
  try {
    return await dashFetch<EarningsOverview>("/earnings");
  } catch {
    return mockEarningsOverview; // 后端未实装时回退到 mock
  }
}
```

后端只需按照上述格式返回 JSON，前端会自动从 mock 切换到真实数据，**无需任何前端改动**。

---

## 6. Hire Market API 修正（已由前端修复）

> 更新日期：2026-03-12
> 状态：前端已修复，后端无需改动

### 问题记录

前端在联调 Hire Market 时发现以下前后端不一致，已在前端侧修复：

| 问题 | 原因 | 修复方 |
|------|------|--------|
| `POST /hired/request` 返回 "node_id is required" | 前端发 `target_node_id`，后端期望 `node_id` | 前端改为 `node_id` |
| Hire Market 列表不显示 Agent 名称 | `GET /hire-market` 只返回 `node_id`，没有 `name` | 前端 API 层 join Relay 数据 |
| Hire Market 列表不显示 Owner 名称 | `GET /hire-market` 没有 `owner_name` | 前端 API 层 join users 表 |
| My Requests 不显示名称和时间 | `GET /hired/requests` 返回原始 DB 字段 | 前端 API 层补充 `target_name`、`target_owner_name`、`requested_at` |
| 用户可以雇佣自己的 Agent | `POST /hired/request` 没有 owner 校验 | 前端 API 层加 `config.user_id === auth.userId` 检查 |

**建议后端长期方案**：在 Relay 层或 Dashboard 后端统一维护节点名称映射，避免前端每次查询都要 join Relay API。

---

## 7. Network Globe 实时通信数据（新需求）

> 优先级：**P2**
> 状态：前端已用 mock 数据实现效果，等待后端接口接入
> 前端文件：`web/src/lib/globe-data.ts`（`MOCK_ENABLED = true`，关闭即切换到真实数据）

### 背景

前端 Network 页面已升级为 **3D Globe 可视化**，展示全球 Agent 节点分布和实时通信弧线。目前通信弧线使用 mock 数据模拟（15 个虚拟节点 + 随机调用路线），需要后端提供真实的 inter-agent 通信数据。

### 当前前端轮询逻辑

```
每 10 秒：
  1. GET /api/nodes → 获取所有节点
  2. 对每个 online 节点：GET /api/nodes/:nodeId/calls?limit=5
  3. Diff 新旧 call ID → 检测新调用 → 生成弧线 + 活动事件
```

**问题**：当前 `/nodes/:nodeId/calls` 返回的数据中 `calls_today` 和实际调用为 0，因为没有真实的 inter-agent 调用流量。

### 需要的数据

#### 方案 A：扩展现有 `/nodes/:nodeId/calls`（推荐）

确保 Relay 层记录所有 skill 调用，使 `GET /api/nodes/:nodeId/calls` 能返回真实数据：

```json
{
  "data": [
    {
      "id": "call-uuid",
      "timestamp": "2026-03-12T08:30:00.000Z",
      "direction": "outbound",
      "skill": "translate",
      "remote_node": "node-id-of-callee",
      "latency_ms": 142,
      "status": "success",
      "relay": "relay.catbus.xyz"
    }
  ],
  "total": 5,
  "page": 1,
  "limit": 5
}
```

前端已经完全对接此格式，**只要有真实数据返回，Globe 会自动显示弧线，无需前端改动。**

#### 方案 B：新增批量调用流接口（可选优化）

如果节点数量多，逐个轮询 calls 效率低。可以新增一个批量接口：

```
GET /api/calls/recent?since=<timestamp>&limit=50
```

**响应**：

```json
{
  "calls": [
    {
      "id": "call-uuid",
      "timestamp": "2026-03-12T08:30:00.000Z",
      "source_node": "node-a",
      "target_node": "node-b",
      "skill": "translate",
      "latency_ms": 142,
      "status": "success"
    }
  ]
}
```

前端可以用一个请求获取所有最近调用，替代 N 个 per-node 请求。

### 前端 Mock 数据说明

当前 mock 数据位于 `web/src/lib/globe-data.ts`：

```typescript
// 关闭 mock：改为 false，所有 mock 函数返回空数组
export const MOCK_ENABLED = true;
```

- 15 个虚拟 Agent 节点（东京、伦敦、旧金山、柏林等全球分布）
- 14 条预定义通信路线（每 10 秒随机选 2-4 条生成弧线）
- Mock 节点 ID 以 `mock-` 前缀区分，不影响真实数据

**后端接入后**：将 `MOCK_ENABLED` 改为 `false`，前端自动只使用真实 API 数据。

### 关联需求

- `connected_from` IP 字段（见 `relay-api-request-geoip-2026-03-12.md`）—— 用于 GeoIP 定位节点在地球上的真实位置
- `GET /api/stats` 中的 `calls_today` 和 `avg_latency_ms` 会随着真实调用自动有值

---

## 更新后的优先级总览

| 优先级 | 接口 | 原因 |
|--------|------|------|
| **P0** | `GET/POST /agents/:nodeId/provider-config` | 绑定流程核心，Provider 配置无法保存 |
| **P1** | `GET /earnings` | Earnings 页 + Dashboard 概览依赖 |
| **P1** | `GET /earnings/history` | Earnings 页历史表格依赖 |
| **P1** | Relay 记录 inter-agent calls | Network Globe 弧线 + Stats 面板依赖 |
| **P1** | `connected_from` IP 字段 | Network Globe GeoIP 节点定位依赖 |
| **P2** | `GET /leaderboard` | Leaderboard 页 + Dashboard 概览排名卡片 |
| **P2** | `GET /calls/recent` 批量接口 | 优化 Globe 轮询效率（可选） |
| **P3** | `GET /stats` 扩展 | 优化，非必须 |
