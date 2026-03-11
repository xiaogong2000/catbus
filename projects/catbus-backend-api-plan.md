# CatBus Backend API 实现方案

> 基于 `/tmp/backend-requirements.md` 需求文档，结合当前项目结构分析

---

## 一、数据库迁移方案

### 当前状态

- 数据库：SQLite (better-sqlite3)，WAL 模式
- 文件位置：`data/users.db`
- 现有表：`users`（id, email, password_hash, name, created_at）
- 数据库初始化：`src/lib/db.ts` 中 `getDb()` 使用单例模式，首次连接时执行 `CREATE TABLE IF NOT EXISTS`

### 迁移策略

**方案：在 `getDb()` 中追加建表语句（与现有 users 表建表逻辑一致）**

理由：
- 当前项目无 migration 框架（无 Prisma/Drizzle/Knex）
- 现有模式已经是 `CREATE TABLE IF NOT EXISTS`，是幂等的
- SQLite 单文件数据库，不需要复杂迁移工具
- 保持架构简单，不引入额外依赖

```sql
-- 新增表 1：user_agents
CREATE TABLE IF NOT EXISTS user_agents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  node_id TEXT NOT NULL,
  name TEXT NOT NULL,
  bound_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, node_id)
);

-- 新增表 2：user_settings
CREATE TABLE IF NOT EXISTS user_settings (
  user_id INTEGER PRIMARY KEY REFERENCES users(id),
  github_username TEXT,
  notify_agent_offline INTEGER DEFAULT 1,
  notify_daily_report INTEGER DEFAULT 0,
  notify_weekly_report INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 性能索引
CREATE INDEX IF NOT EXISTS idx_user_agents_user_id ON user_agents(user_id);
CREATE INDEX IF NOT EXISTS idx_user_agents_node_id ON user_agents(node_id);
```

### 实施步骤

1. 修改 `src/lib/db.ts`，在 `getDb()` 的初始化块中追加上述 SQL
2. 新增数据访问函数（见下文 db.ts 修改方案）
3. 部署后首次访问自动建表，无需手动迁移

---

## 二、API 路由实现思路

### 公共辅助：认证中间件抽取

所有 dashboard API 都需要认证检查。抽取为通用函数：

```
src/lib/auth-guard.ts

export async function requireAuth(): Promise<{ userId: number } | Response>
- 调用 getServerSession(authOptions)
- 未登录返回 401 Response
- 已登录返回 { userId }
```

### 公共辅助：Relay API 调用封装

```
src/lib/relay-api.ts

- fetchRelayNode(nodeId): 获取单节点详情
- fetchRelayNodeCalls(nodeId, params): 获取节点调用记录
- fetchRelayNodeDailyStats(nodeId, days): 获取每日统计
- fetchRelayNodeCallsSummary(nodeId): 获取调用汇总
```

所有 relay 调用函数内置 mock 降级逻辑（见第三节）。

---

### 路由 1：GET /api/dashboard/stats

**文件**：`src/app/api/dashboard/stats/route.ts`

**实现思路**：
1. `requireAuth()` 获取 userId
2. 从 `user_agents` 查询用户所有 node_id
3. 对每个 node_id 并发调用 `fetchRelayNode(nodeId)` 获取实时数据
4. 对每个 node_id 并发调用 `fetchRelayNodeCallsSummary(nodeId)` 获取调用汇总
5. 聚合计算：
   - `my_agents`：user_agents 记录数
   - `my_skills`：所有 agent 的 skills 合并去重
   - `calls_received` / `calls_made`：从 summary 累加
   - `avg_latency_ms`：加权平均
   - `success_rate`：总成功数 / 总调用数 × 100
6. 返回 `DashboardStatsResponse`

**边界处理**：
- 用户无绑定 agent 时返回全零统计
- 某个 node relay 返回 404 时跳过该节点

---

### 路由 2：GET /api/dashboard/agents

**文件**：`src/app/api/dashboard/agents/route.ts`（GET handler）

**实现思路**：
1. `requireAuth()` 获取 userId
2. 从 `user_agents` 查出所有绑定记录 `{ node_id, name }`
3. 对每个 node_id 并发调用 `fetchRelayNode(nodeId)`
4. 合并本地 name + relay 返回的实时数据（status, skills, uptime 等）
5. relay 返回 404 的节点标记为 `status: "offline"`，其他字段设默认值
6. 调用 `fetchRelayNodeCallsSummary(nodeId)` 获取 calls_handled / calls_made
7. 返回 `AgentListResponse`

**性能考虑**：
- 使用 `Promise.allSettled` 并发请求，单个失败不影响整体
- relay 请求设置 5s 超时

---

### 路由 3：POST /api/dashboard/agents

**文件**：`src/app/api/dashboard/agents/route.ts`（POST handler，与 GET 同文件）

**实现思路**：
1. `requireAuth()` 获取 userId
2. 解析请求体 `{ node_id, name? }`
3. 验证 node_id 非空
4. 调用 `fetchRelayNode(nodeId)` 确认节点存在（404 → 返回 404 "Node not found in network"）
5. 检查 `user_agents` 是否已存在 `(user_id, node_id)` 组合（存在 → 409 Conflict）
6. name 默认取 relay 返回的 node name
7. INSERT INTO user_agents
8. 返回 201 + 完整 Agent 数据

**绑定策略**：
- 允许多用户绑定同一 node_id（共享绑定），因需求文档未明确禁止
- UNIQUE 约束仅限同一用户不能重复绑定

---

### 路由 4：GET /api/dashboard/agents/[nodeId]

**文件**：`src/app/api/dashboard/agents/[nodeId]/route.ts`（GET handler）

**实现思路**：
1. `requireAuth()` 获取 userId
2. 从 URL params 获取 nodeId
3. **权限检查**：查 `user_agents` 确认 `(user_id, node_id)` 存在，否则 403
4. 并发请求：
   - `fetchRelayNode(nodeId)` → agent 基本信息
   - `fetchRelayNodeDailyStats(nodeId, 7)` → 7 天每日统计
   - `fetchRelayNodeCalls(nodeId, { limit: 20 })` → 最近 20 条调用
   - `fetchRelayNodeCallsSummary(nodeId)` → 调用汇总
5. 组装 `AgentDetailResponse`

---

### 路由 5：DELETE /api/dashboard/agents/[nodeId]

**文件**：`src/app/api/dashboard/agents/[nodeId]/route.ts`（DELETE handler，与 GET 同文件）

**实现思路**：
1. `requireAuth()` 获取 userId
2. 从 URL params 获取 nodeId
3. DELETE FROM user_agents WHERE user_id = ? AND node_id = ?
4. 检查 affected rows，0 → 404 "Agent not bound"
5. 返回 `{ success: true }`

---

### 路由 6：GET /api/dashboard/calls

**文件**：`src/app/api/dashboard/calls/route.ts`

**实现思路**：
1. `requireAuth()` 获取 userId
2. 解析 query 参数：page, limit, agent, direction, status, skill
3. 验证 limit ≤ 100
4. 从 `user_agents` 获取用户所有 node_id
5. 若指定了 `agent` 参数，验证该 node_id 属于用户
6. 对相关 node_id 并发调用 `fetchRelayNodeCalls(nodeId, params)`
7. 合并所有调用记录，按 timestamp 倒序
8. 应用筛选条件（direction, status, skill）
9. 在合并结果上执行分页
10. 返回 `CallHistoryResponse`

**性能注意**：
- 若用户绑定了很多 agent，需要限制并发数（如 max 10 并发）
- 考虑后续优化：让 relay API 支持批量查询

---

### 路由 7：GET /api/dashboard/settings

**文件**：`src/app/api/dashboard/settings/route.ts`（GET handler）

**实现思路**：
1. `requireAuth()` 获取 userId
2. 从 `users` 表获取 email
3. 从 `user_settings` 表获取设置（不存在则返回默认值）
4. 从 `user_agents` 获取绑定的 agent 列表 `{ node_id, name }`
5. 组装 `UserSettingsResponse`

**默认值处理**：
- `user_settings` 记录可能不存在（用户未修改过设置）
- 查询返回 null 时使用默认值：`{ notify_agent_offline: true, notify_daily_report: false, notify_weekly_report: false }`

---

### 路由 8：PATCH /api/dashboard/settings

**文件**：`src/app/api/dashboard/settings/route.ts`（PATCH handler，与 GET 同文件）

**实现思路**：
1. `requireAuth()` 获取 userId
2. 解析请求体，过滤允许更新的字段
3. 若包含 `name`，更新 `users.name`
4. 若包含 `github_username` 或 `notifications`，使用 UPSERT：
   ```sql
   INSERT INTO user_settings (user_id, ...) VALUES (?, ...)
   ON CONFLICT(user_id) DO UPDATE SET ... , updated_at = datetime('now')
   ```
5. 返回 `{ success: true }`

---

## 三、Relay API Mock 过渡方案

### 问题

需求文档第 7 节指出 relay API 需要新增三个接口：
- `GET /nodes/:nodeId/calls` — 调用记录
- `GET /nodes/:nodeId/stats/daily` — 每日统计
- `GET /nodes/:nodeId/calls/summary` — 调用汇总

这些接口当前不存在于 relay.catbus.xyz。

### 方案：relay-api.ts 内置透明 mock 降级

在 `src/lib/relay-api.ts` 中为每个 relay 调用函数实现：

```
async function fetchRelayNodeCalls(nodeId, params) {
  try {
    const res = await fetch(`${RELAY_URL}/nodes/${nodeId}/calls?...`, { signal: AbortSignal.timeout(5000) });
    if (res.ok) return await res.json();
    // 404 或其他错误，降级到 mock
  } catch {
    // 网络错误或超时，降级到 mock
  }
  return generateMockCalls(nodeId, params);
}
```

### Mock 数据生成策略

**`generateMockCalls(nodeId, params)`**：
- 基于 nodeId 哈希生成确定性伪随机数据（同一 nodeId 每次返回一致结果）
- 调用记录的 timestamp 在最近 7 天内分布
- skill 名称从 relay 已知的 skill 列表中随机选取
- latency 在 50-500ms 间正态分布
- success_rate 在 85-100% 间

**`generateMockDailyStats(nodeId, days)`**：
- 返回最近 N 天的 `{ date, inbound, outbound }`
- 数值基于 nodeId 哈希的确定性随机

**`generateMockCallsSummary(nodeId)`**：
- 返回 `{ total_handled, total_made, success_rate, avg_latency }`
- 基于 nodeId 哈希生成

### 切换机制

- 在 relay-api.ts 顶部设置常量 `RELAY_CALLS_READY = false`
- 当 `RELAY_CALLS_READY = true` 时直接调用 relay，不走 mock
- 当 `false` 时跳过 relay 请求，直接返回 mock（避免无意义的超时等待）
- 未来 relay 接口就绪后，改为 `true` 即可切换，无需修改任何 API 路由代码

### 已有 relay 接口（无需 mock）

以下接口已存在且正常工作，直接调用：
- `GET /nodes/:nodeId` → 节点基本信息、skills、status、uptime
- `GET /nodes` → 节点列表
- `GET /skills` → 技能列表

---

## 四、需要新建的文件清单

```
src/lib/
├── auth-guard.ts              # 认证检查辅助函数
├── relay-api.ts               # Relay API 调用封装 + mock 降级
└── relay-mock.ts              # Mock 数据生成器（从 relay-api.ts 导入）

src/app/api/dashboard/
├── stats/
│   └── route.ts               # GET /api/dashboard/stats
├── agents/
│   ├── route.ts               # GET + POST /api/dashboard/agents
│   └── [nodeId]/
│       └── route.ts           # GET + DELETE /api/dashboard/agents/:nodeId
├── calls/
│   └── route.ts               # GET /api/dashboard/calls
└── settings/
    └── route.ts               # GET + PATCH /api/dashboard/settings
```

**共计 8 个新文件**

---

## 五、需要修改的现有文件

| 文件 | 修改内容 |
|------|----------|
| `src/lib/db.ts` | 追加 `user_agents` 和 `user_settings` 建表语句 + 索引；新增数据访问函数：`getUserAgents(userId)`, `addUserAgent(userId, nodeId, name)`, `removeUserAgent(userId, nodeId)`, `getUserSettings(userId)`, `upsertUserSettings(userId, data)` |
| `src/lib/api.ts` | 将 `RELAY_API_URL` 硬编码提取为环境变量 `process.env.RELAY_API_URL`，保留原有默认值 |

**注意**：Phase 1-2 阶段不修改任何 dashboard 前端页面，前端对接在 Phase 3 单独进行。

---

## 六、关键风险点和注意事项

### 1. SQLite 并发写入

**风险**：SQLite 不支持高并发写入。多个 API 请求同时写入 `user_agents` 可能触发 `SQLITE_BUSY`。

**缓解**：
- 已启用 WAL 模式（读写并发安全）
- 写操作较少（仅绑定/解绑/设置更新），读多写少场景 SQLite 完全胜任
- better-sqlite3 是同步 API，天然串行化写入
- 若未来并发增长，考虑设置 `busy_timeout`

### 2. Relay API 超时与稳定性

**风险**：dashboard/stats 和 agents 列表需要对每个 node 调用 relay API。若用户绑定了 10+ agent，会产生 10+ 次 relay 请求，总延迟可能很高。

**缓解**：
- 所有 relay 请求使用 `Promise.allSettled` 并发
- 每个请求设置 5 秒超时 (`AbortSignal.timeout(5000)`)
- 失败的请求降级为默认值/mock，不阻塞整体响应
- 后续优化：为 relay 数据增加短时缓存（如 30 秒 in-memory cache）

### 3. 权限模型

**风险**：用户只能访问自己绑定的 agent 数据。需确保每个路由都做权限检查。

**实施**：
- `/agents` GET：只查当前用户的 user_agents
- `/agents/:nodeId` GET/DELETE：显式验证 `(user_id, node_id)` 存在
- `/calls` GET：只查用户绑定的 node_id 的调用
- `/settings` GET/PATCH：user_id 直接从 session 取

### 4. OAuth 用户无 password_hash

**风险**：当前 `users` 表 `password_hash` 字段为 `NOT NULL`。但 OAuth 用户（GitHub/Google 登录）没有密码。

**现状分析**：查看 auth.ts，OAuth 登录似乎绕过了本地用户创建（NextAuth 内置处理）。需确认 OAuth 用户是否存在于 `users` 表中。如果不存在，绑定 agent 时 `REFERENCES users(id)` 外键将失败。

**缓解**：
- 检查当前 OAuth 登录流程中是否有 `signIn` 回调创建本地用户记录
- 如未处理，需在 NextAuth callbacks 中新增：OAuth 首次登录时自动在 `users` 表创建记录（password_hash 设为空字符串或特殊标记）
- **这是必须在 Phase 1 之前确认并解决的问题**

### 5. Session 中的 user.id 类型

**风险**：需求文档中 userId 类型为 string (`(session.user as { id: string }).id`)，但 SQLite 中 `users.id` 是 INTEGER。

**缓解**：
- 确认 NextAuth JWT token 中存储的 id 类型
- 查看现有 auth.ts callback，id 可能已被转为 string
- 在 db 查询时统一使用 `Number(userId)` 或确保类型一致

### 6. node_id 绑定验证

**风险**：需求文档提到 settings 页面有 verification token 流程（输入 node_id → 生成 token → 运行 `catbus verify {token}`），但 API 需求中未定义 verification 端点。

**缓解**：
- Phase 1 暂不实现 verification 流程，绑定仅需 node_id 在 relay 网络中存在即可
- 后续需新增 `POST /api/dashboard/agents/verify` 端点
- 在绑定 API 中预留 `verification_token` 可选参数

### 7. 环境变量

**注意**：
- `RELAY_API_URL` 当前硬编码在 `src/lib/api.ts` 中为 `https://relay.catbus.xyz/api`
- 建议提取为环境变量但保留硬编码默认值，避免部署时遗漏配置
- `DATABASE_PATH` 同理，可保留当前硬编码 `data/users.db` 作为默认值

### 8. 调用历史分页的准确性

**风险**：调用历史需要从多个 agent 的 relay 调用记录中合并、排序、分页。当 relay 接口就绪后，服务端分页需要精确控制。

**缓解（mock 阶段）**：
- Mock 阶段在内存中合并排序后分页，完全可控
- Relay 就绪后，考虑两种方案：
  - A. 拉取所有记录后服务端合并分页（简单但不适合大量数据）
  - B. 请求 relay 提供按多 node_id 批量查询的接口（推荐）

---

## 七、开发顺序建议

```
Phase 1 — 基础 CRUD（预计 1-2 天）
  ✅ 确认/解决 OAuth 用户的 users 表问题
  ✅ 修改 db.ts：建表 + 数据访问函数
  ✅ 新建 auth-guard.ts
  ✅ POST /api/dashboard/agents（绑定）
  ✅ DELETE /api/dashboard/agents/:nodeId（解绑）
  ✅ GET /api/dashboard/agents（列表，合并 relay 节点信息）
  ✅ GET + PATCH /api/dashboard/settings

Phase 2 — 数据聚合 + Mock（预计 1-2 天）
  ✅ 新建 relay-api.ts + relay-mock.ts
  ✅ GET /api/dashboard/stats
  ✅ GET /api/dashboard/agents/:nodeId（详情 + 图表）
  ✅ GET /api/dashboard/calls

Phase 3 — 前端对接（由前端负责）
  修改 dashboard 页面替换 mock 导入
  删除 mock-data-dashboard.ts
  端到端测试
```

---

## 八、API 测试检查清单

每个 API 完成后应测试以下场景：

| 场景 | 预期 |
|------|------|
| 未登录访问 | 401 |
| 正常请求 | 200 + 正确数据 |
| 无绑定 agent 时 | 200 + 空数组/零统计 |
| 访问他人 agent | 403 |
| 绑定不存在的 node_id | 404 |
| 重复绑定 | 409 |
| 无效参数 | 400 |
| Relay 超时 | 200 + 降级数据 |

可使用 `curl` + 本地 session cookie 进行手动测试，或后续补充 API 测试。
