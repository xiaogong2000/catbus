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
