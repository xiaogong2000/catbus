# FizzRead SEO 项目说明

> 最后更新: 2026-02-27

## 基本信息

- **域名**: www.fizzread.ai
- **技术栈**: Next.js 16.1.6 + React 19 + TypeScript + Tailwind CSS 4 + better-sqlite3
- **数据库**: /data/fizzread-seo.db（SQLite）
- **生产环境**: fr.ovh（37.187.31.49），PM2 管理，root 用户
- **开发环境**: ge.ovh（51.75.146.33），浣浣负责
- **GSC Service Account**: fizzread-indexing@gen-lang-client-0589157348.iam.gserviceaccount.com

## 数据规模

- 书籍: 8,296 本（全部 completed）
- 对比页: 47 组
- 分类: 多个（categories.ts 定义）

## 页面结构（Next.js App Router）

| 路径 | 说明 |
|------|------|
| `/` | 根首页，推荐书籍 + 分类 + 对比 |
| `/moment` | Moment 首页，每日随机推荐 |
| `/moment/[slug]` | 单本书摘要页 |
| `/moment/author/[slug]` | 作者页 |
| `/moment/authors` | 作者列表 |
| `/moment/category/[slug]` | 分类页 |
| `/moment/compare/[slug]` | 书籍对比页 |
| `/moment/comparisons` | 对比列表 |
| `/moment/lists/[topic]` | 主题书单 |
| `/moment/lists` | 书单列表 |
| `/moment/sitemap.xml` | 动态 sitemap |
| `/robots.txt` | robots 配置 |

## 组件（16个）

AudioPlayer, AuthorSection, BookCard, BookCover, Breadcrumb, ChapterList, CompareCard, DownloadSummary, FAQ, Footer, Header, KeyQuotes, RelatedBooks, SearchBox, SmartCTA, TrustSignals

## 核心库

- `lib/api.ts` — 数据查询（getAllBooks, getBookBySlug, getPopularComparisons 等）
- `lib/db.ts` — SQLite 连接
- `lib/types.ts` — 类型定义
- `lib/seo.ts` — SEO 工具函数
- `lib/categories.ts` — 分类映射

## 定时任务（crontab，fr.ovh root）

| 时间 | 脚本 | 说明 |
|------|------|------|
| 02:00 | n8n webhook | 每日生成新书（通过 n8n 触发） |
| 03:00 | submit-gsc-batch.js --limit 70 | 提交 70 本书到 GSC |
| 03:30 | submit-gsc-authors.js --limit 30 | 提交 30 个作者页到 GSC |
| 04:30 | generate-homepage-data.js | 生成首页随机推荐数据 |

## 关键脚本

| 脚本 | 用途 |
|------|------|
| process-books.js | 批量生成书籍内容 |
| generate-homepage-data.js | 生成首页 JSON（featured + categories + comparisons） |
| generate-comparisons.js | 生成书籍对比内容 |
| submit-gsc-batch.js | 批量提交书籍 URL 到 GSC |
| submit-gsc-authors.js | 批量提交作者 URL 到 GSC |
| generate-by-uuid.js | 按 UUID 生成单本书 |
| generate-priority.js | 优先级生成 |
| insert-book.js | 插入新书种子 |

## 部署流程

1. 浣浣在 ge.ovh 改代码、测试
2. scp 到 fr.ovh
3. fr.ovh: `node scripts/generate-homepage-data.js` → `npm run build` → PM2 restart
4. 验证 https://www.fizzread.ai/

## ⚠️ 生产硬规则

- **禁止**在 fr.ovh 执行 `rm -rf .next`、`pm2 stop/delete/kill`、直接修改生产代码
- **只有浣浣**有权 SSH 操作 fr.ovh，其他机器人禁止直接 SSH
- 部署通过 CatBus 或 Telegram 通知浣浣执行

## 当前待做（TASK.md）

- T26: 首页改英文 + 多语言
- T27: 外链建设
- T33: Footer A-Z 索引
- T28: 话题聚焦
