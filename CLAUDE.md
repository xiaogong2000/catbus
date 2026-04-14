# 多人协同开发规范

> Claude Code 在每次开发任务前，必须阅读并严格遵守以下规则。
> **自主操作模式（Telegram 远程控制时）**：分支规范、提交规范、保护规则照常执行，但跳过所有"询问用户确认"的步骤，自主判断并执行。

---

## 一、开发前的强制检查

在写任何一行代码之前，依次完成：

1. **确认当前分支**：`git branch --show-current`
   - 如果在 `main` / `master` / `dev`，**不得直接在此分支开发**
2. **同步远程最新代码**：`git fetch origin && git status`
   - 落后于远程时先 `git pull origin <当前分支>`
3. **确认在功能分支上开发**：
   ```bash
   git checkout dev && git pull origin dev
   git checkout -b feature/<功能名称>
   ```

**分支命名规则：**

| 类型 | 前缀 | 示例 |
|------|------|------|
| 新功能 | `feature/` | `feature/user-login` |
| Bug 修复 | `fix/` | `fix/payment-crash` |
| 重构 | `refactor/` | `refactor/db-schema` |
| 紧急热修复 | `hotfix/` | `hotfix/api-timeout` |

---

## 二、分支结构与保护规则

```
main/master   ← 生产环境，只接受来自 dev 的 PR，禁止直接 push
  └─ dev      ← 集成测试分支，所有功能在此汇合验证
       ├─ feature/xxx    ← 功能开发分支
       ├─ fix/xxx        ← Bug 修复分支
       └─ hotfix/xxx     ← 紧急修复（从 main 切出，修完同时合回 main 和 dev）
```

**铁律：**
- 永远不直接 push 到 `main` / `master`
- 永远不直接 push 到 `dev`
- 只在自己的 `feature/` 或 `fix/` 分支上开发和提交

---

## 三、代码提交规范

### 提交频率
- 小步提交，每完成一个独立功能点就 commit 一次
- 不要等整个大功能写完才提交

### Commit Message 格式

```
<类型>(<范围>): <简短描述>
```

类型：`feat` | `fix` | `refactor` | `style` | `docs` | `test` | `chore`

### 提交前必须执行
```bash
git diff --stat                    # 确认改动范围
git add <具体文件>                  # 不要 git add .
git commit -m "feat(auth): 完成用户注册 API"
```

---

## 四、合并前的同步流程

将分支合并到 `dev` 之前，必须先同步：

```bash
git fetch origin
git merge origin/dev
# 有冲突则解决后：
git add <冲突文件>
git commit -m "merge: 同步 dev 最新代码并解决冲突"
git push origin feature/<功能名称>
```

### 冲突解决原则
- 保留双方改动，不要简单选择一边丢弃另一边
- 如果无法判断，保留对方代码并标注 `// TODO: 需确认` 让用户决定
- **锁文件冲突**（`package-lock.json` / `yarn.lock`）：不要手动合并，接受对方版本后重新 `npm install` 生成

---

## 五、Pull Request 流程

1. `git push origin feature/<功能名称>`
2. 创建 PR，**目标分支：`dev`**（不是 `main`）
3. Review 通过后合并
4. 合并后删除功能分支

---

## 六、AI 辅助开发额外规则

### 涉及以下文件时必须额外谨慎
- 数据库 Schema / Migration 文件
- 环境配置文件（`.env`, `config.yaml` 等）
- 路由/权限相关文件
- `package.json` / `requirements.txt` 等依赖文件

### 环境变量与敏感文件
- `.env` 文件永远不提交到 git
- 新增环境变量时，更新 `.env.example`（只写变量名，不写真实值）
- 密钥、token、密码禁止出现在代码或 commit 中

### 多实例并行开发
- 多个 Claude Code 实例同时开发时，分支名必须包含实例标识或任务ID，避免撞名
- 示例：`feature/nefi-user-login`、`feature/claude2-payment-fix`
- 开发前先 `git fetch origin && git branch -r` 确认没有同名分支

### PR Review
- PR 由用户（项目负责人）Review 后合并
- 如果用户指定其他 Claude 实例 Review，reviewer 只提建议，最终合并权归用户

### 绝不执行的操作
- `git push --force`（除非用户明确要求且解释了原因）
- `git reset --hard` 到远程已有的 commit
- 直接 push 到 `main` / `master` / `dev`
- 修改 `.gitignore` 导致已追踪的敏感文件被暴露

---

## 七、发布流程

### 1. feature → dev（功能合并）
```bash
git push origin feature/<功能名称>
# 在 GitHub 创建 PR，目标分支：dev
# Review 通过后合并，删除功能分支
```

### 2. dev 集成验证
- 在 dev 分支上确认所有合并的功能正常运行
- 发现问题则在新的 `fix/` 分支修复后再合回 dev

### 3. dev → main（正式发布）
```bash
# 在 GitHub 创建 PR，从 dev 合并到 main
# PR 标题带版本号：release: v2.1.0
# 合并后打 tag：
git tag v2.1.0
git push origin v2.1.0
```

### 4. 部署生产
- 各项目按自己的部署方式执行（Docker rebuild / pm2 restart / etc.）

### 5. hotfix 特殊流程
- 生产紧急问题：从 `main` 切出 `hotfix/xxx`
- 修完后**同时合回 `main` 和 `dev`**，确保 dev 不丢失修复

---

## 八、紧急回滚

```bash
# 优先使用 revert（安全，保留历史）
git revert <commit_hash>
git push origin <分支名>

# 仅在自己的功能分支上、未 push 时使用 reset
git reset --soft HEAD~1
```

---

# CLAUDE.md - CatBus Client (Python SDK + CLI)

> 任何 Claude Code 实例启动时必读此文件。这是项目的 Single Source of Truth。

---

## 项目概述

CatBus 是 "The Uber for AI Agents" — 一个分布式网络系统，让不同机器上的 AI Agent 能够互相发现、互相调用能力，无需知道对方的位置或框架。本仓库是 CatBus 的 Python 客户端 SDK 和 CLI 工具。

- **仓库**: https://github.com/xiaogong2000/catbus
- **版本**: 0.3.0
- **协议**: MIT
- **Python**: >=3.10
- **安装**: `pip install catbus` 或 `pip install -e .`

## 架构

```
┌─────────────────────────────────────────────────┐
│               CatBus 网络                        │
│                                                  │
│  Agent A (机器1)    WebSocket    Agent B (机器2)  │
│  ┌──────────┐      ↔ Relay ↔    ┌──────────┐    │
│  │ Daemon   │    Server(无状态) │ Daemon   │    │
│  │ :9800    │    (Matchmaker)   │ :9800    │    │
│  └────┬─────┘                   └────┬─────┘    │
│       │ HTTP                         │ HTTP      │
│       ▼                              ▼           │
│  ┌──────────┐                  ┌──────────┐     │
│  │ OpenClaw │                  │ OpenClaw │     │
│  │ Skills   │                  │ Skills   │     │
│  └──────────┘                  └──────────┘     │
└─────────────────────────────────────────────────┘
```

**三个核心组件:**
1. **Server** (`server/server.py`) — WebSocket Relay，无状态 Matchmaker
2. **Daemon** (`catbus/daemon.py`) — 本地 Agent 进程，默认端口 9800
3. **Capability System** — 统一能力模型 (`type/name` 格式)

## 技术栈

| 组件 | 技术 |
|------|------|
| 语言 | Python 3.10+ |
| 构建 | hatchling (pyproject.toml) |
| 网络 | websockets (WebSocket), aiohttp (HTTP) |
| 配置 | PyYAML |
| 异步 | asyncio |
| 入口 | `catbus.__main__:main` |

## 目录结构

```
catbus/                    # 主 Python 包 (~3,856 行)
├── __init__.py            # 版本: "0.3.0"
├── __main__.py            # CLI 入口
├── cli.py                 # 命令行接口 (618行)
├── config.py              # 配置加载 (~/.catbus/config.yaml)
├── daemon.py              # 核心守护进程 (711行)
├── executor.py            # 能力执行引擎 (260行)
├── detector.py            # 4层模型检测 (536行)
├── gateway.py             # OpenClaw Gateway 桥接 (175行)
├── scanner.py             # OpenClaw Skill 扫描 (116行)
├── capability_db.py       # 模型/Skill 数据库 (540行)
├── builtin_skills.py      # 内置演示 Skill (echo, translate等)
├── arena_sync.py          # Arena.ai 排行榜同步
└── service.py             # systemd/launchd 安装器

server/                    # WebSocket Relay Server
├── server.py              # Relay 实现
└── Dockerfile             # 容器化部署

skill/                     # OpenClaw Skill 集成规范
docs/                      # 项目文档
install.sh                 # 一键安装脚本
```

## CLI 命令

```bash
catbus init                # 初始化: 检测模型、扫描 Skill、写 config.yaml
catbus serve               # 启动 Daemon (前台)
catbus serve --daemon      # 安装为 systemd/launchd 服务并后台运行
catbus status              # 查看本地 Daemon 状态
catbus detect              # 手动检测已安装模型
catbus call <capability>   # 调用远程能力
catbus ask <skill> "query" # 简化调用语法
catbus bind <token>        # 绑定到 catbus.xyz 仪表盘
catbus scan                # 查看本地 OpenClaw Skill
catbus scan --add          # 注册 Skill 到网络
catbus skills              # 查看网络上所有可用 Skill
```

## 配置文件 (~/.catbus/config.yaml)

```yaml
server: wss://relay.catbus.ai          # Relay 服务器地址
port: 9800                             # 本地 Daemon HTTP 端口
name: my-agent                         # 人类可读名称
node_id: abc123def456                  # 唯一 12 字符标识符

capabilities:
  - type: model
    name: model/claude-opus-4-6
    handler: gateway:default           # 通过 OpenClaw Gateway 执行
    meta:
      provider: anthropic
      cost_tier: premium
      arena_elo: 1550
  - type: skill
    name: skill/translate
    handler: gateway:default
    meta:
      category: utility
      shareable: true
      source: openclaw
```

## WebSocket 消息协议

```
register → 注册节点 + 能力到 Server
REQUEST  → 发起能力调用请求
TASK     → Server 分配任务给 Provider
RESULT   → Provider 返回执行结果
heartbeat → 每 30s 心跳保活
```

## 模型检测 (4 层回退)

1. Layer 0: OpenClaw 配置文件
2. Layer 1: Gateway `/v1/models` API
3. Layer 2: Self-identification prompt
4. Layer 3: Response fingerprint 分析

## Handler 类型

- `python:module.func` — 执行 Python 函数
- `shell:command` — 执行 Shell 命令
- `gateway:default` — 通过 OpenClaw Gateway 执行 AI 任务

## 开发

```bash
git clone https://github.com/xiaogong2000/catbus.git
cd catbus
pip install -e ".[dev]"
```

## 与其他组件的关系

| 组件 | 仓库/位置 | 关系 |
|------|-----------|------|
| catbus-web | /home/debian/catbus-web | 前端仪表盘，通过 Relay API 交互 |
| catbusin | /opt/catbusin | v5 Zenoh 版 Daemon (替代本项目的 WebSocket 版) |
| Relay Server | relay.catbus.xyz | 本项目的 server/ 目录 |
| OpenClaw | ~/.openclaw/ | AI Gateway，Skill 执行引擎 |

## 当前状态

- 版本: 0.3.0
- Relay: wss://relay.catbus.ai (WebSocket)
- 安装脚本: https://catbus.xyz/install.sh
- 内置模型库: ~50+ 模型 (Anthropic, OpenAI 等)
- 一键安装支持 Linux (systemd) + macOS (launchd)

## 已完成的里程碑

- [x] WebSocket Relay Server
- [x] Python Daemon + CLI
- [x] 统一 Capability 模型 (type/name)
- [x] 4 层模型自动检测
- [x] OpenClaw Gateway 集成
- [x] Skill 扫描与注册
- [x] systemd/launchd 服务安装
- [x] catbus.xyz 绑定流程
- [x] Arena.ai 排行榜同步
- [x] 一键安装脚本 (install.sh)

## Git 仓库

- **仓库**: https://github.com/xiaogong2000/catbus (开发仓库)
- **公开仓库**: https://github.com/xiaogong2000/CatBusPub (remote: pub)
- **分支**: main (生产) / dev (集成) / feature/* (开发)
- **远程**: origin (私有), pub (公开)

## 指令

每次完成一个开发任务后：
1. 更新本文件的"当前状态"和"已完成的里程碑"部分
2. 在功能分支上提交改动，推送后创建 PR 到 dev
