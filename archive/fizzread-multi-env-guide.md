# FizzRead SEO — 多环境协作规范

> 本文档供所有 Claude Code 实例阅读，理解自己的角色和协作方式。
> 位置: `.claude/ENV-GUIDE.md`

---

## 环境架构

```
┌─────────────────────────────────────────────────┐
│  NeFi (Mac Studio / OpenClaw)                   │
│  角色: 决策中心 + 调度员                          │
│  职责: 拆任务、写 TASK.md、验证、协调部署          │
└──────────┬──────────────────┬────────────────────┘
           │                  │
     ┌─────▼─────┐     ┌─────▼──────┐
     │  ge.ovh   │     │  fr.ovh    │
     │  开发环境  │────▶│  生产环境   │
     │  自由开发  │代码  │  只做部署   │
     │           │同步  │  共享源     │
     └───────────┘     └────────────┘
```

| 项目 | 生产 fr.ovh | 开发 ge.ovh |
|------|------------|------------|
| IP | 37.187.31.49 | 51.75.146.33 |
| 域名 | www.fizzread.ai/moment/* | book.xiai.xyz |
| 端口 | :3001 | :3002 |
| pm2 名称 | fizzread-seo | fizzread-seo-dev |
| 代码路径 | /root/projects/fizzread-seo | /root/projects/fizzread-seo |
| 数据库 | /data/fizzread-seo.db | /data/fizzread-seo.db (副本) |
| n8n 指向 | ✅ Workflow 1 每天 02:00 | ❌ 不接 n8n |
| .claude/ | ✅ 共享源 (权威版本) | ↔ 双向同步 |

---

## .claude/ 共享目录 + 任务锁

`.claude/` 是所有实例的协作中枢，通过 `sync-claude` 命令在三台机器间双向同步。

**fr.ovh 是共享源** — 所有同步以 fr.ovh 上的 `.claude/` 为权威版本。

### 目录结构

```
.claude/
├── CLAUDE.md      ← 项目上下文 (NeFi 维护，其他实例只读)
├── TASK.md        ← 任务清单 + 任务锁 (所有实例读写)
├── PROGRESS.md    ← 开发日志 (所有实例追加写)
├── DECISIONS.md   ← 架构决策 (所有实例追加写)
└── ENV-GUIDE.md   ← 本文档 (NeFi 维护)
```

### 同步命令

每台机器都已安装 `sync-claude`，开工前和收工后各跑一次：

```bash
# ge.ovh / fr.ovh
sudo sync-claude

# Mac (OpenClaw)
/Users/tangpeng/.openclaw/workspace/scripts/sync-claude.sh
```

逻辑: 比较每个文件的修改时间，谁新用谁，自动拉取或推送。

### 任务锁机制

TASK.md 中的任务通过状态标记实现"锁"，防止多个实例做同一件事：

```markdown
- [ ] 任务描述 | 待分配 | TODO
- [ ] 任务描述 | ge.ovh | IN PROGRESS ← 已被 ge.ovh 认领
- [x] 任务描述 | ge.ovh | DONE
- [ ] 任务描述 | ge.ovh | BLOCKED: 原因
```

**规则:**
1. 只认领状态为 `TODO` 的任务
2. 认领时改为 `你的机器名 | IN PROGRESS`
3. 认领后立即 `sync-claude` 推送，防止其他实例重复认领
4. 完成后改为 `DONE`，再 `sync-claude`

---

## 角色定义

### 如果你在 ge.ovh (开发环境)

你是**开发者**，可以自由修改代码：

- ✅ 随便改代码、加功能、重构
- ✅ 随便 build、restart、测试
- ✅ 可以改数据库结构、插入测试数据
- ✅ 可以装新依赖
- ❌ 不要 SSH 到 fr.ovh 改代码
- ❌ 不要操作 n8n 工作流

**开工流程:**
```
1. sudo sync-claude              ← 拉取最新任务
2. 读 .claude/CLAUDE.md          ← 了解项目
3. 读 .claude/TASK.md            ← 找到你的任务
4. 认领任务 → 改状态为 IN PROGRESS
5. sudo sync-claude              ← 推送认领状态
6. 开始开发...
```

**收工流程:**
```
1. 更新 .claude/TASK.md          ← 标记 DONE
2. 追加 .claude/PROGRESS.md      ← 记录做了什么
3. 如有架构决策 → 追加 DECISIONS.md
4. sudo sync-claude              ← 推送所有更新
```

### 如果你在 fr.ovh (生产环境)

你是**运维员**，只做最小化操作：

- ✅ 接收代码同步 (NeFi 操作)
- ✅ `npm run build && pm2 restart fizzread-seo`
- ✅ 查看日志、排查线上问题
- ✅ 运行 scripts/ 下已有的脚本
- ✅ 维护 .claude/ 共享文件
- ❌ 不要直接改业务代码 (app/, components/, lib/)
- ❌ 不要改数据库结构
- ❌ 不要装新依赖 (除非 NeFi 指示)

---

## 代码部署流程

```
ge.ovh 开发完成 + sync-claude
    ↓
NeFi 验证 book.xiai.xyz 效果
    ↓
NeFi 执行代码同步:
    ge.ovh 打包 → scp → fr.ovh 解压
    ↓
fr.ovh: npm install && npm run build && pm2 restart fizzread-seo
    ↓
NeFi 验证 www.fizzread.ai 效果
    ↓
NeFi 更新 TASK.md 标记上线完成
```

**重要**: 代码同步由 NeFi 统一操作，Claude Code 不要自行跨机器部署。

---

## n8n 工作流

n8n 只有一套 (23.80.90.84, https://n8n.xiai.xyz)，不分环境。

- 生产工作流 SSH 指向 **fr.ovh**
- 测试时: 在 n8n 复制一份工作流，SSH 目标改成 ge.ovh，跑通后改回 fr.ovh
- 重逻辑放 `scripts/` 本地脚本，n8n 只做调度和通知

| 工作流 | ID | 状态 | SSH 目标 |
|--------|-----|------|---------|
| Workflow 1 书籍生成 | SSRrZsmY1KanSY6K | ✅ 运行中 | fr.ovh |
| Workflow 2 作者聚合 | MkJnRjmQtUWZtg0c | ⏸ 暂停 | fr.ovh |
| Workflow 3 名人书单 | nC4QjuhV3zPRdWZC | ⏸ 暂停 | fr.ovh |

---

## 脚本规范

所有脚本在 `scripts/` 目录下：

| 脚本 | 用途 | 参数 |
|------|------|------|
| process-books.js | 批量处理书籍 (v1, 生产在跑) | --limit N |
| insert-book.js | 单本插入 | /tmp/book-data.json |
| submit-gsc.js | GSC 提交 | slug1 slug2... |

**新脚本规则:**
- v2 版本用新文件名: `process-books-v2.js`，不改 v1
- 测试时 `--limit 1`，生产时 `--limit 20`
- 脚本在 ge.ovh 测通后，随代码同步到 fr.ovh

---

## 数据库注意事项

- 开发库是生产库的**快照副本**，不实时同步
- 开发环境可以随意改 schema、加表、加字段
- 改 schema 时记录到 DECISIONS.md，方便同步到生产
- **向后兼容**: 新字段必须可选，旧数据没有新字段时页面不能报错
- 生产数据库 schema 变更由 NeFi 统一执行

---

## 当前项目状态 (2026-02-12)

- 94 本书种子，36 本已生成，68 本 pending
- Workflow 1 每天 02:00 自动跑 20 本，预计 3-4 天跑完
- 技术栈: Next.js 16 + React 19 + Tailwind 4 + SQLite (better-sqlite3)
- 下一步: v2 内容增强 (AI 改写 + key_takeaways + 个性化 meta)

详细项目上下文见 `.claude/CLAUDE.md`
