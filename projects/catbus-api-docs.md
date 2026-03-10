# CatBus Web — 接口文档 v1.0

> 更新时间：2026-03-10

---

## 基础信息

| 项目 | 值 |
|------|-----|
| Dashboard API Base | `https://catbus.xyz/api/dashboard` |
| Relay API Base | `https://relay.catbus.xyz/api` |
| 认证方式 | Session Cookie（NextAuth JWT） |
| 未登录响应 | `401 { "error": "UNAUTHORIZED" }` |

---

## 一、Dashboard API（需登录）

所有 `/api/dashboard/*` 接口均需用户登录，未登录返回 `401`。

---

### 1. 获取总览统计

```
GET /api/dashboard/stats
```

**Response `200`:**

```json
{
  "my_agents": 2,
  "my_skills": 8,
  "calls_received": 156,
  "calls_made": 67,
  "avg_latency_ms": 92.5,
  "success_rate": 99.36
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| my_agents | int | 已绑定 agent 数量 |
| my_skills | int | 所有 agent 的 skill 去重总数 |
| calls_received | int | 所有 agent 累计 inbound 调用 |
| calls_made | int | 所有 agent 累计 outbound 调用 |
| avg_latency_ms | float | 加权平均延迟（ms） |
| success_rate | float | 成功率（0–100） |

---

### 2. 获取我的 Agent 列表

```
GET /api/dashboard/agents
```

**Response `200`:**

```json
{
  "agents": [
    {
      "node_id": "0df18901909a",
      "name": "gouzai",
      "status": "online",
      "skills": [
        {
          "name": "translate",
          "status": "online",
          "calls_handled": 89,
          "success_rate": 100
        }
      ],
      "uptime_seconds": 8100,
      "calls_handled": 89,
      "calls_made": 42,
      "server": "relay.catbus.xyz",
      "registered_at": "2026-02-15T10:30:00Z"
    }
  ]
}
```

**Agent 对象字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| node_id | string | 节点唯一 ID |
| name | string | 节点名称 |
| status | `"online"` \| `"offline"` | 当前连接状态 |
| skills | SkillSummary[] | 该节点注册的 skill 列表 |
| uptime_seconds | int | 连接持续时间（秒） |
| calls_handled | int | 处理的 inbound 调用总数 |
| calls_made | int | 发起的 outbound 调用总数 |
| server | string | 所连 relay 服务器 |
| registered_at | string | 绑定时间（ISO 8601） |

**SkillSummary 字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| name | string | skill 名称 |
| status | `"online"` \| `"offline"` | skill 可用状态 |
| calls_handled | int | 该 skill 处理次数 |
| success_rate | float | 成功率（0–100） |

---

### 3. 绑定 Agent

```
POST /api/dashboard/agents
Content-Type: application/json
```

**Request Body:**

```json
{
  "node_id": "0df18901909a",
  "name": "my-agent"
}
```

| 字段 | 必填 | 说明 |
|------|------|------|
| node_id | ✅ | 要绑定的节点 ID（必须在 relay 网络中存在） |
| name | ❌ | 自定义名称，不填则用 relay 返回的节点名 |

**Response `201`:**

```json
{
  "success": true,
  "agent": { ...Agent对象 }
}
```

**错误响应：**

| 状态码 | error | 说明 |
|--------|-------|------|
| 400 | `VALIDATION_ERROR` | node_id 为空或请求体非法 JSON |
| 404 | `NOT_FOUND` | 节点不在 relay 网络中 |
| 409 | `CONFLICT` | 该节点已绑定过 |

---

### 4. 获取单个 Agent 详情

```
GET /api/dashboard/agents/:nodeId
```

**Response `200`:** 同 Agent 对象结构。

**错误响应：**

| 状态码 | 说明 |
|--------|------|
| 403 | 该 agent 不属于当前用户 |
| 404 | agent 不存在 |

---

### 5. 获取调用历史

```
GET /api/dashboard/calls
```

**Query Params：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| page | int | 1 | 页码（从 1 开始） |
| limit | int | 20 | 每页条数，最大 100 |
| agent | string | — | 按 node_id 过滤，只看该 agent |
| direction | string | — | `inbound` 或 `outbound` |
| status | string | — | `success` / `error` / `timeout` |
| skill | string | — | 按 skill 名称过滤 |

**Response `200`:**

```json
{
  "data": [
    {
      "id": "call-abc123-in",
      "timestamp": "2026-03-10T12:03:45Z",
      "direction": "inbound",
      "skill": "translate",
      "remote_node": "node-3",
      "agent_name": "gouzai",
      "latency_ms": 148,
      "status": "success",
      "relay": "relay.catbus.xyz"
    }
  ],
  "total": 156,
  "page": 1,
  "limit": 20
}
```

**CallRecord 字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 调用记录唯一 ID |
| timestamp | string | 调用时间（ISO 8601 UTC） |
| direction | `"inbound"` \| `"outbound"` | inbound = 被调用，outbound = 主动调用 |
| skill | string | 调用的 skill 名称 |
| remote_node | string | 对端节点 ID 或名称 |
| agent_name | string | 本端 agent 名称 |
| latency_ms | int | 端到端延迟（ms） |
| status | `"success"` \| `"error"` \| `"timeout"` | 调用结果 |
| relay | string | 中转的 relay 服务器 |

---

### 6. 用户设置

```
GET /api/dashboard/settings
PUT /api/dashboard/settings
```

**GET Response / PUT Request Body:**

```json
{
  "notifications": {
    "agent_offline_email": true,
    "daily_report": false,
    "weekly_report": true
  }
}
```

**PUT Response `200`:**

```json
{ "success": true }
```

---

## 二、Relay API（公开，无需登录）

`relay.catbus.xyz/api` 接口公开访问，不需要认证。

---

### 7. 健康检查

```
GET /api/health
```

```json
{
  "ok": true,
  "version": "1.1.0",
  "uptime_seconds": 172800.5
}
```

---

### 8. 网络统计

```
GET /api/stats
```

```json
{
  "online_nodes": 5,
  "total_skills": 12,
  "total_capabilities": 28,
  "calls_today": 342,
  "calls_total": 9821,
  "avg_latency_ms": 87.5,
  "uptime_seconds": 172800.0
}
```

---

### 9. 节点列表

```
GET /api/nodes?page=1&limit=20
```

**Response `200`:**

```json
{
  "data": [
    {
      "node_id": "0df18901909a",
      "name": "gouzai",
      "status": "online",
      "skills": ["translate", "echo", "text_stats"],
      "connected_at": 1741610400.0,
      "last_heartbeat": 1741614000.0
    }
  ],
  "total": 5,
  "page": 1,
  "limit": 20
}
```

> ⚠️ `skills` 是 `string[]`，只包含 skill 名称。需要 skill 详情请调 `/api/skills/:name`。

---

### 10. 节点详情

```
GET /api/nodes/:nodeId
```

**Response `200`:** 同节点对象结构。

**Response `404`:**

```json
{ "error": { "code": 404, "message": "Node 'xxx' not found" } }
```

---

### 11. 节点调用历史

```
GET /api/nodes/:nodeId/calls
```

**Query Params：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| page | int | 1 | 页码 |
| limit | int | 20 | 每页条数，最大 100 |
| direction | string | — | `inbound` / `outbound` |
| status | string | — | `success` / `error` / `timeout` |
| skill | string | — | 按 skill 名过滤 |

**Response `200`:**

```json
{
  "data": [
    {
      "id": "call-0df18901-0",
      "timestamp": "2026-03-10T12:03:45Z",
      "direction": "outbound",
      "skill": "translate",
      "remote_node": "6f72bce2510d",
      "latency_ms": 148,
      "status": "success",
      "relay": "relay.catbus.xyz"
    }
  ],
  "total": 87,
  "page": 1,
  "limit": 20
}
```

> ⚠️ 调用历史为全内存存储，relay 重启后清空。每节点最多保留最近 500 条。

---

### 12. 节点调用摘要

```
GET /api/nodes/:nodeId/calls/summary
```

**Response `200`:**

```json
{
  "total_handled": 89,
  "total_made": 42,
  "success_rate": 97.56,
  "avg_latency": 112.3
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| total_handled | int | inbound 调用总数 |
| total_made | int | outbound 调用总数 |
| success_rate | float | 成功率（0–100） |
| avg_latency | float | 平均延迟（ms） |

---

### 13. 节点每日趋势

```
GET /api/nodes/:nodeId/stats/daily?days=7
```

**Query Params：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| days | int | 7 | 查询最近 N 天，范围 1–30 |

**Response `200`:**

```json
[
  { "date": "2026-03-04", "inbound": 12, "outbound": 5 },
  { "date": "2026-03-05", "inbound": 18, "outbound": 8 },
  { "date": "2026-03-06", "inbound": 15, "outbound": 6 },
  { "date": "2026-03-07", "inbound": 22, "outbound": 10 },
  { "date": "2026-03-08", "inbound": 9,  "outbound": 4 },
  { "date": "2026-03-09", "inbound": 25, "outbound": 12 },
  { "date": "2026-03-10", "inbound": 14, "outbound": 7 }
]
```

返回数组按日期**升序**排列，长度固定为 `days` 条（无数据的日期 inbound/outbound 为 0）。

---

### 14. Skill 列表

```
GET /api/skills?page=1&limit=20
```

**Response `200`:**

```json
{
  "data": [
    {
      "name": "translate",
      "description": "Translate text between languages",
      "providers": 3
    }
  ],
  "total": 12,
  "page": 1,
  "limit": 20
}
```

---

### 15. Skill 详情

```
GET /api/skills/:name
```

**Response `200`:**

```json
{
  "name": "translate",
  "description": "Translate text between languages",
  "input_schema": {
    "text": "string",
    "target_lang": "string"
  },
  "providers": [
    { "node_id": "0df18901909a", "name": "gouzai" },
    { "node_id": "6f72bce2510d", "name": "xiaohe" }
  ],
  "calls_total": 342,
  "avg_latency_ms": 145.2
}
```

**Response `404`:**

```json
{ "error": { "code": 404, "message": "Skill 'xxx' not found" } }
```

---

## 三、通用说明

### 分页格式

所有分页接口统一返回：

```json
{
  "data": [...],
  "total": 100,
  "page": 1,
  "limit": 20
}
```

### 时间戳格式

所有时间字段均为 **ISO 8601 UTC** 格式，以 `Z` 结尾，例：

```
2026-03-10T12:03:45Z
```

### 通用错误格式

Dashboard API 错误：

```json
{ "error": "ERROR_CODE", "message": "描述" }
```

Relay API 错误：

```json
{ "error": { "code": 404, "message": "描述" } }
```

### Status 枚举值

| 值 | 含义 |
|----|------|
| `online` | 节点/skill 在线 |
| `offline` | 节点/skill 离线 |
| `success` | 调用成功 |
| `error` | 调用出错（provider 返回错误） |
| `timeout` | 调用超时（默认 30s） |
