# CatBus 后端待开发 API 需求文档

**日期**: 2026-03-11
**状态**: 前端已完成，等待后端实现
**前端代码位置**: `web/src/lib/dashboard-api.ts`

---

## 概述

前端 Dashboard 中有两组功能使用了桩函数（stub），需要后端实现对应的 API 接口：

1. **Token 绑定** — 用户通过生成一次性 Token，在终端执行 `catbus bind <token>` 来绑定自己的 Agent
2. **雇佣智能体** — 用户从网络中浏览并雇佣其他人的 Agent 为自己工作

所有接口均需要认证（Cookie session），基础路径为 `/api/dashboard`。

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

### 业务流程

```
用户进入「Hired Agents」页面
    ↓
点击「Browse Network」→ 前端调用 Relay API 获取网络节点列表
    ↓
用户选择一个节点点击「Hire」
    ↓
前端调用 POST /api/dashboard/hired → 建立雇佣关系
    ↓
被雇佣的 Agent 出现在「My Hired」列表中
    ↓
用户可以「Release」解除雇佣关系
```

### 2.1 获取已雇佣的 Agent 列表

```
GET /api/dashboard/hired
```

**响应** `200`:
```json
{
  "agents": [
    {
      "node_id": "node-xyz789",
      "name": "Translation Bot",
      "skills": ["translate", "summarize"],
      "status": "online",
      "hired_at": "2026-03-10T08:00:00.000Z"
    }
  ]
}
```

**TypeScript 接口**:
```typescript
interface HiredAgent {
  node_id: string;
  name: string;
  skills: string[];          // 技能名称列表
  status: "online" | "offline";
  hired_at: string;          // ISO 8601
}
```

### 2.2 雇佣一个 Agent

```
POST /api/dashboard/hired
```

**请求**:
```json
{
  "node_id": "node-xyz789"
}
```

**响应** `200`:
```json
{
  "success": true,
  "agent": {
    "node_id": "node-xyz789",
    "name": "Translation Bot",
    "skills": ["translate", "summarize"],
    "status": "online",
    "hired_at": "2026-03-11T14:00:00.000Z"
  }
}
```

**错误** `409`:
```json
{
  "message": "Agent already hired"
}
```

**要求**:
- 不能雇佣自己的 Agent
- 不能重复雇佣同一个 Agent
- 需验证目标 node_id 存在于网络中

### 2.3 解除雇佣关系

```
DELETE /api/dashboard/hired/:nodeId
```

**响应** `200`:
```json
{
  "success": true
}
```

**错误** `404`:
```json
{
  "message": "Hired agent not found"
}
```

---

## 三、已有接口（已实现）

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

## 四、通用约定

- **认证**: 所有 `/api/dashboard/*` 接口需要 Cookie session 认证，未登录返回 `401`
- **错误格式**: `{ "message": "错误描述" }`
- **时间格式**: ISO 8601（`2026-03-11T14:00:00.000Z`）
- **状态枚举**: `"online" | "offline"`（Agent 和 HiredAgent）
- **前端文件**: `web/src/lib/dashboard-api.ts` 中标有 `// TODO: replace with real API call` 的函数
