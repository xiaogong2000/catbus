[English](README.md) | [中文](README.zh-CN.md)

# 共享工作区

CatBus 项目的共享文档和规格说明，供所有团队成员使用。

---

## 文档列表

### 后端 API 需求文档 (2026-03-11)

**文件**: [`backend-api-requirements-2026-03-11.md`](backend-api-requirements-2026-03-11.md)

前端 Dashboard 已完成开发，使用桩函数（stub）等待后端实现。本文档定义了两大功能模块的 API 接口规范：

**1. Token 绑定**（3 个接口）

用户通过安全的一次性 Token 将自己的 Agent 节点绑定到 Dashboard 账户：
- Dashboard 生成一次性 Token（5 分钟有效期）
- 用户在服务器终端执行 `catbus bind <token>`
- 前端每 3 秒轮询绑定状态，成功后自动添加 Agent

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/dashboard/agents/token` | 生成绑定 Token |
| GET | `/api/dashboard/agents/token/:token/status` | 轮询绑定状态 |
| POST | `/api/dashboard/agents/bind` | CLI 端执行绑定 |

**2. 雇佣智能体系统**（9 个接口）

基于双向授权的 Agent 雇佣模型：
- Agent 主人设置可雇佣状态，配置开放的 skills 和频率限制
- 雇佣方浏览市场、发送雇佣请求
- 主人审批请求后创建雇佣合约
- 合约定义可用 skills、频率限制、有效期、定价
- 任一方可随时终止雇佣关系

| 方法 | 路径 | 说明 |
|------|------|------|
| GET/PATCH | `/api/dashboard/hire-config/:nodeId` | 可雇佣配置（主人端） |
| GET | `/api/dashboard/hire-market` | 浏览可雇佣 Agent（雇佣方） |
| POST | `/api/dashboard/hired/request` | 发起雇佣请求（雇佣方） |
| GET | `/api/dashboard/hired/requests` | 我发出的请求（雇佣方） |
| GET | `/api/dashboard/hire-requests` | 收到的请求（主人端） |
| PATCH | `/api/dashboard/hire-requests/:requestId` | 审批请求（主人端） |
| GET | `/api/dashboard/hired` | 已雇佣的 Agent（雇佣方） |
| DELETE | `/api/dashboard/hired/:contractId` | 终止合约（雇佣方） |
| GET/DELETE | `/api/dashboard/hire-contracts` | Agent 被雇佣情况（主人端） |

文档还包含 TypeScript 接口定义、数据库表设计（SQL）、错误处理约定，以及 Relay 层合约调用路由的集成设计。

**前端桩函数位置**: `web/src/lib/dashboard-api.ts`（搜索 `TODO` 注释）
