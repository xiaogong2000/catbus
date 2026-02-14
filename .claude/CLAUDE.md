# CLAUDE.md - FizzRead SEO 项目上下文

> 任何 Claude Code 实例启动时必读此文件。这是项目的 Single Source of Truth。

---

## 项目概述

FizzRead 是一款图书摘要 App。本项目是独立的 Next.js SSR 系统（代号 "Fizz Moment"），用于批量生成 SEO 优化的书籍摘要页、作者聚合页、名人书单页。

- 生产域名: `www.fizzread.ai`
- SEO 路由: `/moment/*`（通过 Cloudflare Workers 反向代理到本机 :3001）
- 技术栈: Next.js 16 + React 19 + Tailwind CSS 4 + TypeScript + SQLite
- 进程管理: pm2 (名称: fizzread-seo)
- 反向代理: Caddy2

## 架构

```
n8n 工作流 (自动化内容生成)
    ↓ 写入
SQLite (/data/fizzread-seo.db)
    ↓ 读取
Next.js SSR (本项目)
    ↓ 部署
Caddy → :3001 → Cloudflare Workers → www.fizzread.ai/moment/*
```

## 路由结构

| 路由 | 数据源 | 说明 |
|------|--------|------|
| `/moment` | generated_books | 书籍列表首页 |
| `/moment/[slug]` | generated_books | 书籍详情页 |
| `/moment/authors/[slug]` | authors | 作者聚合页 |
| `/moment/lists/[slug]` | celebrity_lists | 名人书单页 |
| `/moment/compare/[slug]` | generated_books | 书籍对比页 |
| `/moment/sitemap.xml` | 全部表 | 动态 Sitemap |

## 设计系统

- Primary: #00C850
- Background: #003223
- Text: #FFFFFF / #C8C8C8 / #A0C8A0
- Border: #004b3c
- Font: Inter
- CTA 按钮全部指向 App Store (ID: 6755955369)
- GA: G-7043B1KDQ7

## 数据库

路径: `/data/fizzread-seo.db` (SQLite)

### 表结构

**book_seeds** — 待处理书籍种子（94本已导入）
- slug(PK), title, author, search_volume, keyword_difficulty, priority(1-3)
- category, keywords(JSON), status(pending/processing/completed/skipped)

**generated_books** — 已生成的书籍页面
- book_id(UUID), slug(PK), title, author, category
- meta_title, meta_description, keywords(JSON)
- content(JSON: h1_title, intro, key_ideas, summary, faqs, author_bio)
- cover_url, page_count, publish_year, isbn, status

**authors** — 作者聚合页
- slug(PK), name, meta_title, meta_description
- content(JSON: h1_title, author_intro, writing_style, key_themes, why_read)
- total_books, categories(JSON)

**celebrity_lists** — 名人书单页
- slug(PK), person, category, meta_title, meta_description
- keywords(JSON), search_volume, keyword_difficulty
- content(JSON: h1_title, intro, reading_philosophy, key_themes)
- books(JSON: recommended_books数组), total_books

## FizzRead API

认证 Headers:
```
Authorization: Bearer {JWT_TOKEN}
x-app-version: 1.0.5
x-locale: en-US
x-platform: ios
```

### 搜索接口
```
GET https://www.fizzread.ai/api/v1/book/search?query={keyword}&mode=simple&page=1&page_size=5
返回: { code, msg, data: { data: [{id, title, author, about, about_author, cover_urls, genre, publish_year, ...}], page, page_size } }
```

### 预览接口
```
GET https://www.fizzread.ai/api/v1/book/preview?id={uuid}&locale=en-US
返回: { code, data: { ...基础字段, full_title, genres(对象), has_audio, preview_data: { introduction, chapter_titles, first_chapters, total_chapters } } }
```

search 用于匹配书籍获取 UUID，preview 用于获取引言+章节内容供 AI 生成。

## 开发规范

- 构建: `npm run build` → `pm2 restart fizzread-seo`
- 数据读取: 使用 better-sqlite3（需安装）从 /data/fizzread-seo.db 读取
- 所有页面必须 SSR（getServerSideProps 或 App Router server component）
- JSON-LD 结构化数据: Book, Review, BreadcrumbList, FAQPage
- 封面图片: Azure Blob `nccgpub.blob.core.windows.net/cover/` (200/400/600px WebP)
- CTA 按钮统一指向: `https://apps.apple.com/app/id6755955369?utm_source=web&utm_medium=moment&utm_campaign={slug}`

## 协作规则

- 开始任务前: 读 CLAUDE.md + TASK.md
- 完成任务后: 更新 TASK.md 状态 + 追加 PROGRESS.md
- 做了架构决策: 记录到 DECISIONS.md
- 文件冲突: 以 git 最新提交为准

## 现有代码架构

```
data/books.json        ← 旧数据源（11本，即将废弃）
    ↓
lib/api.ts             ← 数据读取（需改为 SQLite）
lib/types.ts           ← 类型定义（需适配 SQLite 字段）
lib/seo.ts             ← JSON-LD 生成（保持不变）
    ↓
app/moment/[slug]/page.tsx        ← 书籍详情页
app/moment/lists/[topic]/page.tsx ← 榜单页
app/moment/compare/[slug]/page.tsx← 对比页
app/moment/page.tsx               ← 列表首页
app/moment/sitemap.xml/route.ts   ← Sitemap
    ↓
components/BookCard.tsx    ← 书籍卡片
components/FAQ.tsx         ← FAQ 组件
components/Breadcrumb.tsx  ← 面包屑
components/SmartCTA.tsx    ← CTA 按钮（→ App Store）
components/BookCover.tsx   ← 封面组件
components/AuthorSection.tsx
components/ChapterList.tsx
components/RelatedBooks.tsx
components/TrustSignals.tsx
components/Header.tsx
components/Footer.tsx
```

### 核心改动点

只改数据层，UI 层不动：
- `lib/api.ts`: JSON 读取 → SQLite 查询
- `lib/types.ts`: 适配 generated_books 表字段
- 新增 `lib/db.ts`: SQLite 连接模块
