# 工作交接文档 (2026-02-14)

快速掌握当前工作状态。

---

## 🎯 当前项目：FizzRead SEO

**目标**：为 FizzRead 阅读 App 建设 SEO 内容站，吸引自然流量。

**站点**：https://fizzread.ai/moment/

### 数据规模
- 📚 388 本书籍详情页
- 👤 348 个作者页
- 📋 22 个书单（20 名人 + 2 主题）
- 🗺️ Sitemap: 803 URLs

### 技术栈
- Next.js 14 (App Router)
- SQLite (better-sqlite3)
- PM2 进程管理
- n8n 自动化工作流

---

## 🖥️ 服务器环境

| 服务器 | IP | 用途 | SSH |
|--------|-----|------|-----|
| ge.ovh | 51.75.146.33 | 开发环境 | `ssh ge.ovh` |
| fr.ovh | 37.187.31.49 | 生产环境 | `ssh fr.ovh` |

- 用户：debian（sudo 免密码）
- 两台机器已配置 SSH 互通
- 代码目录：`/root/projects/fizzread-seo/`

### 开发流程
1. **ge.ovh 开发** → 写代码、测试
2. **fr.ovh 生产** → 部署上线
3. **数据同步**：fr.ovh → ge.ovh（单向）
4. **代码同步**：ge.ovh → fr.ovh（单向）

---

## ✅ 已完成功能

- [x] 书籍详情页 `/moment/book/[slug]`
- [x] 作者页 `/moment/author/[slug]`
- [x] 书单页 `/moment/list/[slug]`（22 个名人/主题书单）
- [x] 分类页 `/moment/category/[slug]`
- [x] 4 级面包屑导航
- [x] JSON-LD 结构化数据
- [x] Sitemap 自动生成
- [x] 分页（省略号样式）
- [x] 移动端响应式

---

## 🔄 自动化任务

### n8n Workflows (n8n.xiai.xyz)
1. **Workflow 1** — 每日书籍生成（02:00 UTC+8，OpenClaw cron 触发）
2. **Workflow 2** — GSC 批量提交（inactive，待激活）

### GSC 提交状态
- 已提交：186 URLs
- 待提交：617 URLs
- 每日配额：~190 个

---

## 📋 待处理任务

1. **Workflow 2 激活** — GSC 每日提交 30 个
2. **Backlink 策略** — Product Hunt launch、Reddit/Medium 内容营销
3. **书单数据迁移** — 从 lib/api.ts 硬编码迁移到数据库
4. **主题书单扩充** — 目前 2 个，可扩到 10 个

---

## 📁 关键文件

```
/root/projects/fizzread-seo/
├── app/moment/           # 页面路由
├── components/           # React 组件
├── lib/api.ts           # 数据 API + 书单硬编码
├── scripts/             # 工具脚本
│   ├── process-books.js      # 书籍处理
│   ├── backfill-authors.js   # 作者数据填充
│   ├── submit-gsc-batch.js   # GSC 批量提交
│   └── build-celebrity-lists-v2.js  # 名人书单生成
└── data/fizzread-seo.db # SQLite 数据库
```

---

## 🔑 重要配置

- **GSC Service Account**: `fizzread-indexing@gen-lang-client-0589157348.iam.gserviceaccount.com`
- **GSC Key**: fr.ovh `/root/projects/fizzread-seo/config/gsc-service-account.json`
- **n8n API**: `https://n8n.xiai.xyz/api/v1` (key in env: N8N_API_KEY)
- **FizzRead API**: `www.fizzread.ai/api/v1/book/search` (需 Bearer token)

---

## 📖 详细记录

- 长期记忆：`MEMORY.md`
- 每日日志：`memory/2026-02-XX.md`
- 工具配置：`TOOLS.md`

---

*生成时间：2026-02-14 08:38 UTC+8*
