# CatBus API v2 对接测试报告

> 测试时间：2026-03-13 14:30 GMT+8
> 测试环境：catbus.xyz（生产）
> 测试账号：demo@catbus.ai
> Base URL：`https://catbus.xyz/api/v2`
> 参考文档：`pt-catbus-web-api-v2-2026-03-13.md`

---

## 测试总结

| 状态 | 数量 | 接口 |
|------|------|------|
| ✅ 通过 | 10 | #1, #2, #3, #5, #6, #7, #8, #12, #14, #15 |
| ❌ 需修复 | 3 | #10, #11, #13 |
| ⏭️ 跳过 | 2 | #4（空数据，符合 TODO）, #9（破坏性操作） |

---

## ❌ 需修复的接口（3 个）

### 10. GET `/network` — 两个问题

**问题 1：`nodes` 返回分页对象，不是数组**

Spec 定义：
```json
{ "nodes": [ { "node_id": "...", ... } ] }
```

实际返回：
```json
{
  "nodes": {
    "data": [ { "node_id": "...", ... } ],
    "total": 2,
    "page": 1,
    "limit": 100
  }
}
```

前端期望 `nodes` 是一个数组。当前写法会导致 `nodes.map()` 报错。

**建议修复**：去掉分页包装，直接返回数组。nodes 不需要分页（已有 `nodes_limit` 参数控制数量）。

**问题 2：缺少 `skills` 字段**

Spec 定义了 `skills[]` 数组（Skill 列表页、地球仪浮窗都需要），但实际响应中没有这个字段。

实际 keys：`['stats', 'nodes']`

**建议修复**：添加 `skills` 字段，结构为：
```json
{
  "skills": [
    { "name": "translate", "description": "...", "providers": 15 }
  ]
}
```

---

### 11. GET `/network/nodes/:nodeId` — 结构不符

**Spec 定义：**
```json
{
  "node": { ... },
  "summary": { "total_handled": 1580, "total_made": 420, "success_rate": 97.5, "avg_latency": 180 },
  "daily_stats": [ { "date": "2026-03-07", "inbound": 23, "outbound": 5 }, ... ],
  "recent_calls": [ { "id": "call-001", ... }, ... ]
}
```

**实际返回：**
```json
{
  "node_id": "a635df6578c9",
  "name": "ge-ovh-test",
  "skills": [...],
  "status": "online",
  "uptime_seconds": 0,
  "connected_at": 1773127910,
  "last_heartbeat": 1773383471,
  "calls_summary": { "total_handled": 1886, "total_made": 1550, "success_rate": 91.02, "avg_latency_ms": 286.45 }
}
```

**差异：**

| 问题 | 说明 |
|------|------|
| 缺少外层 `node` 包装 | 节点信息直接平铺在根级，应包在 `node` 对象中 |
| `calls_summary` → `summary` | 字段名不一致，spec 用 `summary`，返回用 `calls_summary` |
| `avg_latency_ms` → `avg_latency` | summary 内字段名不一致 |
| 缺少 `daily_stats` | 节点详情页需要 7 天折线图数据，完全缺失 |
| 缺少 `recent_calls` | 节点详情页需要最近 10 条调用记录，完全缺失 |

**建议修复**：
1. 用 `{ node, summary, daily_stats, recent_calls }` 嵌套结构
2. `daily_stats` 可从 calls 表按天聚合，返回最近 7 天的 inbound/outbound 计数
3. `recent_calls` 可复用 `/network/nodes/:nodeId/calls?limit=10` 的逻辑内联返回

---

### 13. GET `/network/skills/:name` — 404 路由不存在

```
GET https://catbus.xyz/api/v2/network/skills/translate → 404 (HTML not found)
```

这个接口用于 Skill 详情页（`/network/skills/[name]`），展示：
- Skill 描述 + input_schema
- 提供该 Skill 的节点列表（node_id, name, status）
- 调用统计（calls_total, avg_latency_ms）

**建议实现**：从 relay 获取 skill 元数据，关联 nodes 表找到 providers 列表。

---

## ✅ 通过的接口（10 个）

### 1. GET `/dashboard` ✅

结构完全匹配：`stats` + `agents` + `recent_tasks` + `earnings` + `my_rank`

注意事项：
- `earnings` 全部为 0，`my_rank` 为 null（符合 TODO）
- `skills[].calls_handled` 全部为 0（符合 TODO）

### 2. GET `/dashboard/agents/:nodeId` ✅

返回 `agent` + `weekly_stats`（7 天）+ `recent_calls` 完整

### 3. GET `/dashboard/tasks` ✅

分页正常，`direction` 和 `status` 筛选正常

### 5. GET `/dashboard/settings` ✅

### 6. PATCH `/dashboard/settings` ✅

写入后读回验证一致

### 7. POST `/dashboard/bind` ✅

返回 `token` + `expires_at`

### 8. GET `/dashboard/bind/:token` ✅

返回 `bound: false`，结构正确

### 12. GET `/network/nodes/:nodeId/calls` ✅

分页正常，`direction` 筛选正常

### 14. GET `/reward` ✅

`sort_by` 和 `limit` 参数生效（当前 mock 数据）

### 15. POST `/auth/login` ✅

返回 user 信息 + 提示走 NextAuth callback

---

## 额外发现的字段差异（非阻塞，建议对齐）

这些不影响功能，但 spec 和实际返回不完全一致，建议后续对齐。

| 接口 | 差异 | 建议 |
|------|------|------|
| `GET /dashboard` | agents 多了 `calls_today`、`avg_latency_ms` | 保留，前端可用 |
| `GET /dashboard` | `recent_tasks` 返回 10 条（spec 说 5） | 保留 10 条，更新 spec |
| `GET /dashboard` | agents[].`uptime_seconds` 返回 0 | 应从 `connected_at` 计算 |
| `GET /dashboard/tasks` | data 元素多了 `node_id` 字段 | 保留，前端可用 |
| `GET /dashboard/settings` | 多了 `user` 对象 | 保留，前端可用 |
| `GET /dashboard/bind/:token` | 多了 `status`、`expired` 字段 | 保留，前端可用 |
| `GET /dashboard/earnings/history` | 多了 `aggregated` 汇总 | 好设计，前端可直接用，不用再调 dashboard 拿 earnings |
| `GET /network` | `stats.uptime_seconds` 是浮点数 | 建议取整 |
| `GET /network/nodes/:nodeId` | `uptime_seconds` 返回 0 | 应从 `connected_at` 计算 |

---

## 前端适配优先级

| 优先级 | 工作 | 依赖 |
|--------|------|------|
| **P0** | 后端修复 #10 `/network`（nodes 格式 + skills 字段） | 后端 |
| **P0** | 后端修复 #11 `/network/nodes/:nodeId`（嵌套结构 + daily_stats + recent_calls） | 后端 |
| **P0** | 后端实现 #13 `/network/skills/:name` | 后端 |
| **P1** | 前端从 v1 mock API 切换到 v2 真实 API | 上述 P0 完成后 |
| **P2** | 后端实现 earnings 真实数据 | 后端 |
| **P2** | 后端接入 reward 真实数据替换 mock | 后端 |
