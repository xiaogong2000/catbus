# CatBus 项目全景上下文

> 给新接手的 Claude Code 架构师阅读。涵盖项目背景、功能设计、部署环境、API 现状和当前工作进展。
> 最后更新：2026-03-10

---

## 一、项目定位

**CatBus** — "AI Agent 的 Uber"。让 AI agent 之间能互相发现、调用、协作。

核心理念：
- 一个 agent 把自己的 skill 注册到网络
- 另一个 agent 需要某个能力时，通过 relay 找到提供者并发送任务
- 路由全自动，调用方不需要知道谁在执行

目标用户：OpenClaw 用户（个人 AI 助理），让他们的 agent 之间能无缝协作。

---

## 二、整体架构

```
┌─────────────────────────────────────────────────────┐
│                     catbus.xyz                       │
│            Web 前端（Next.js 16）                    │
│  注册/登录 · Dashboard · 绑定 Agent · 查看调用历史   │
└───────────────────┬─────────────────────────────────┘
                    │ Next.js API Routes /api/dashboard/*
                    │
┌───────────────────▼─────────────────────────────────┐
│              relay.catbus.xyz                        │
│           Relay Server（Python）                     │
│   节点注册 · 技能发现 · 任务路由 · REST API          │
│   wss://relay.catbus.xyz（测试）                     │
│   wss://relay.catbus.ai（生产，同一台机器）          │
└─────────────────────────────────────────────────────┘
           ▲                    ▲
           │ WebSocket          │ WebSocket
┌──────────┴──────┐    ┌───────┴──────────┐
│  ge-ovh-test    │    │    xiaohei       │
│  (浣浣 ge.ovh)  │    │  (小黑 fr.ovh)  │
│  catbus client  │    │  catbus client   │
│  8 OpenClaw     │    │  4 test skills   │
│  skills         │    │  (echo/translate │
│                 │    │  /json/text_stats│
└─────────────────┘    └──────────────────┘
```

---

## 三、组件详解

### 3.1 catbus client（pip 包）

- **安装**：`pip install catbus`（v0.1.0）
- **配置**：`~/.catbus/config.yaml`
- **启动**：`catbus serve --daemon`（本地 daemon，默认端口 9800）
- **本地 HTTP**：`http://localhost:9800/health` `http://localhost:9800/status`

config.yaml 关键字段：
```yaml
name: xiaohei               # 节点名称
port: 9800                  # 本地 HTTP 端口
server: wss://relay.catbus.xyz  # relay 地址
skills:
  - name: echo
    handler: python:catbus.builtin_skills.echo
    ...
```

**切换测试/生产 relay：**
```bash
# 切测试
sed -i 's|wss://relay.catbus.ai|wss://relay.catbus.xyz|' ~/.catbus/config.yaml
# 切回生产
sed -i 's|wss://relay.catbus.xyz|wss://relay.catbus.ai|' ~/.catbus/config.yaml
```

**OpenClaw 集成（T8/T9）：**
- T8：catbus client 通过 `handler: gateway:default` 把任务转发给本机 OpenClaw Gateway
- T9：`catbus scan --add` 将每个 OpenClaw skill 单独注册为独立的 catbus skill（不再合并成一个 agent）
- daemon 每 5 分钟检测 skill 变更，有变化才重新注册

### 3.2 relay server

- **语言**：Python
- **代码仓库**：`github.com/xiaogong2000/catbus-server`（私有）
- **部署**：mimi (la.css, 23.94.9.58)，systemd 管理
  - 测试：`wss://relay.catbus.xyz` + `https://relay.catbus.xyz/api`
  - 生产：`wss://relay.catbus.ai` + `https://relay.catbus.ai/api`（同机不同域名）
- **功能**：节点注册、心跳维持、技能路由、REST API

### 3.3 catbus.xyz 网站

- **代码路径**：`~/catbus-web`（ge.ovh, 51.75.146.33）
- **框架**：Next.js 16 (App Router) + React 19 + TypeScript
- **认证**：NextAuth v4（JWT session）—— 支持邮箱注册 + GitHub OAuth + Google OAuth
- **数据库**：SQLite (better-sqlite3)，WAL 模式，路径 `data/users.db`
- **部署**：PM2 + Caddy，`https://catbus.xyz`

---

## 四、Relay REST API 现状

Base URL：`https://relay.catbus.xyz/api`

| 端点 | 说明 | 示例响应 |
|------|------|---------|
| `GET /stats` | 全网统计 | `{"online_nodes":2,"total_skills":12,"calls_today":0}` |
| `GET /nodes` | 节点列表（分页） | `{"data":[...],"total":2}` |
| `GET /nodes/:nodeId` | 单节点详情 | status/skills/uptime/connected_at |
| `GET /skills` | 技能列表（分页） | 按 skill name 聚合，含 providers |
| `GET /skills/:name` | 单技能详情 | providers 列表 |

**当前在线节点（测试环境）：**
```json
[
  { "node_id": "a635df6578c9", "name": "ge-ovh-test", "status": "online",
    "skills": ["add-newcli-provider","daily-briefing","find-skills","n8n-hub",
               "proactive-agent","seo-competitor-analysis","tavily","agent"] },
  { "node_id": "6f72bce2510d", "name": "xiaohei", "status": "online",
    "skills": ["echo","translate","json_format","text_stats"] }
]
```

**尚未实现的 relay 接口（后端需要 mock 过渡）：**
```
GET /nodes/:nodeId/calls          — 节点调用记录
GET /nodes/:nodeId/stats/daily    — 每日调用统计
GET /nodes/:nodeId/calls/summary  — 调用汇总
```

---

## 五、catbus.xyz 后端现状

### 已实现
```
src/app/api/auth/[...nextauth]/route.ts   — NextAuth（邮箱+GitHub+Google）
src/app/api/register/route.ts             — 邮箱注册
```

### 数据库表（已存在）
```sql
-- users（已有）
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,  -- OAuth 用户为空字符串
  name TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- user_agents（刚加）
CREATE TABLE user_agents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  node_id TEXT NOT NULL,
  name TEXT NOT NULL,
  bound_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, node_id)
);

-- user_settings（刚加）
CREATE TABLE user_settings (
  user_id INTEGER PRIMARY KEY REFERENCES users(id),
  github_username TEXT,
  notify_agent_offline INTEGER DEFAULT 1,
  notify_daily_report INTEGER DEFAULT 0,
  notify_weekly_report INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now'))
);
```

### Dashboard 页面（当前 mock 数据）
```
src/app/dashboard/page.tsx              — 概览统计
src/app/dashboard/agents/page.tsx       — 我的 Agents
src/app/dashboard/agents/[id]/page.tsx  — Agent 详情
src/app/dashboard/calls/page.tsx        — 调用历史
src/app/dashboard/settings/page.tsx     — 用户设置
src/lib/mock-data-dashboard.ts          — mock 数据源（后续删除）
```

---

## 六、当前正在开发的后端 API

Claude Code 正在实现 Phase 1 + Phase 2，目标文件结构：

```
src/lib/
├── auth-guard.ts              # 认证检查（requireAuth()）
├── relay-api.ts               # Relay API 封装 + mock 降级
│                              # RELAY_CALLS_READY=false 开关
└── relay-mock.ts              # 确定性 mock 数据生成器

src/app/api/dashboard/
├── stats/route.ts             # GET → DashboardStatsResponse
├── agents/
│   ├── route.ts               # GET → 列表 / POST → 绑定
│   └── [nodeId]/route.ts      # GET → 详情 / DELETE → 解绑
├── calls/route.ts             # GET → 调用历史（分页+筛选）
└── settings/route.ts          # GET → 读取 / PATCH → 更新
```

### 关键接口格式

**GET /api/dashboard/stats**
```typescript
interface DashboardStatsResponse {
  my_agents: number;
  my_skills: number;
  calls_received: number;
  calls_made: number;
  avg_latency_ms: number;
  success_rate: number;  // 0-100
}
```

**GET /api/dashboard/agents**
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
  registered_at: string;
}
```

**GET /api/dashboard/calls**（支持分页+筛选）
```typescript
interface CallRecord {
  id: string;
  timestamp: string;
  direction: "inbound" | "outbound";
  skill: string;
  remote_node: string;
  agent_name: string;
  latency_ms: number;
  status: "success" | "error" | "timeout";
  relay: string;
}
```

所有接口统一错误格式：
```typescript
interface ApiError {
  error: string;   // "UNAUTHORIZED" | "NOT_FOUND" | "VALIDATION_ERROR" | ...
  message: string;
}
```

---

## 七、开发规范

### 认证
所有 `/api/dashboard/*` 必须验证 session：
```typescript
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
const session = await getServerSession(authOptions);
if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });
const userId = Number((session.user as { id: string }).id);
```

### Relay API 调用
- 统一通过 `src/lib/relay-api.ts` 调用
- 所有调用设 5s 超时（`AbortSignal.timeout(5000)`）
- 使用 `Promise.allSettled` 并发，失败降级不阻断
- 新接口（calls/daily/summary）通过 `RELAY_CALLS_READY` 开关控制 mock/real 切换

### HTTP 状态码
| 码 | 场景 |
|----|------|
| 200 | 成功 |
| 201 | 绑定成功 |
| 400 | 参数错误 |
| 401 | 未登录 |
| 403 | 无权限 |
| 404 | 不存在 |
| 409 | 重复绑定 |
| 500 | 服务器错误 |

---

## 八、已知风险点

1. **OAuth 用户与 users 表**：GitHub/Google 登录用户需在 signIn callback 中写入 users 表（password_hash=''），否则 user_agents 外键失败
2. **relay 新接口未实现**：calls/daily/summary 用 mock 数据过渡，`RELAY_CALLS_READY=false`
3. **SQLite 并发**：写操作用 better-sqlite3 同步 API，天然串行，WAL 模式支持读写并发
4. **session.user.id 类型**：JWT 中 id 可能是 string，db 查询时统一 `Number(userId)`
5. **多 agent 调用延迟**：用 `Promise.allSettled` 并发 + 5s 超时缓解

---

## 九、部署环境

| 组件 | 机器 | 地址 | 管理 |
|------|------|------|------|
| catbus.xyz 网站 | ge.ovh (浣浣) | 51.75.146.33 | PM2 `catbus-web` |
| relay server（测试+生产） | mimi (咪咪) | 23.94.9.58 | systemd `catbus-server` |
| catbus client（测试节点） | ge.ovh (浣浣) | — | systemd `catbus-client` |
| catbus client（测试节点） | fr.ovh (小黑) | 37.187.31.49 | 手动 `catbus serve` |

**代码仓库：**
- catbus client：`github.com/xiaogong2000/catbus`（公开）
- relay server：`github.com/xiaogong2000/catbus-server`（私有）
- catbus.xyz 网站：`~/catbus-web`（ge.ovh 本地，暂未上 GitHub）

**ClawHub skill：**
- 地址：`https://clawhub.ai/xiaogong2000/catbus`
- 当前版本：v0.2.3
- 安装命令：`clawhub install catbus`

---

## 十、Phase 3 前端对接（待做）

后端 API 完成后，前端需改动文件：

```
src/lib/api.ts              — 新增 8 个 API 调用函数
src/app/dashboard/page.tsx  — 替换 mock → getDashboardStats() + getMyAgents()
src/app/dashboard/agents/page.tsx        — getMyAgents()
src/app/dashboard/agents/[id]/page.tsx   — getAgentDetail(nodeId)
src/app/dashboard/calls/page.tsx         — getCallHistory(filters)
src/app/dashboard/settings/page.tsx      — getUserSettings() + updateUserSettings()
src/lib/mock-data-dashboard.ts           — 全部完成后删除
```
