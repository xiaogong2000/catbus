# FizzRead SEO 站点架构文档

> 更新时间: 2026-03-03

## 一、项目概览

| 项目 | 说明 |
|------|------|
| **域名** | `www.fizzread.ai` |
| **技术栈** | Next.js 16.1.6 + React 19 + TypeScript + TailwindCSS + SQLite |
| **数据库** | SQLite (`/data/fizzread-seo.db`), better-sqlite3, readonly 模式 |
| **渲染模式** | ISR (Incremental Static Regeneration), `revalidate=3600` |
| **部署方式** | `output: "standalone"` → `node .next/standalone/server.js` → PM2 |
| **端口** | 3001 (生产) / 3002 (开发) |
| **生产服务器** | us.ovh `147.135.15.43` (PM2 进程名 `fizzread-seo`) |
| **开发服务器** | ge.ovh `51.75.146.33` (PM2 进程名 `fizzread-seo-dev`, 域名 `book.xiai.xyz`) |
| **语言** | 仅英文 (`en`), 无多语言支持 |

## 二、目录结构

```
fizzread-seo/
├── app/                              # Next.js App Router
│   ├── globals.css                   # 全局样式 (CSS 变量 + Tailwind)
│   ├── layout.tsx                    # 全局布局 (html lang="en")
│   ├── page.tsx                      # 根首页 www.fizzread.ai/
│   ├── robots.txt/route.ts           # robots.txt (Route Handler)
│   └── moment/                       # 主内容目录
│       ├── page.tsx                  # 书籍列表首页 /moment
│       ├── [slug]/page.tsx           # 书籍详情页 /moment/:slug
│       ├── author/[slug]/page.tsx    # 作者页 /moment/author/:slug
│       ├── authors/page.tsx          # 作者列表 /moment/authors
│       ├── category/[slug]/page.tsx  # 分类页 /moment/category/:slug
│       ├── compare/[slug]/page.tsx   # 对比页 /moment/compare/:slug
│       ├── comparisons/page.tsx      # 对比列表 /moment/comparisons
│       ├── letter/[letter]/page.tsx  # 字母索引 /moment/letter/:letter
│       ├── lists/page.tsx            # 名人书单列表 /moment/lists
│       ├── lists/[topic]/page.tsx    # 书单详情 /moment/lists/:topic
│       └── sitemap.xml/route.ts      # 动态 sitemap
│
├── components/                       # UI 组件 (全英文硬编码)
│   ├── Header.tsx                    # 顶部导航 (Moments / Top Lists / Sign In / Ask AI)
│   ├── Footer.tsx                    # 页脚
│   ├── BookCard.tsx                  # 书籍卡片
│   ├── BookCover.tsx                 # 封面图组件
│   ├── CompareCard.tsx               # 对比卡片
│   ├── AudioPlayer.tsx               # 音频播放器
│   ├── AuthorSection.tsx             # 作者区块
│   ├── Breadcrumb.tsx                # 面包屑导航
│   ├── ChapterList.tsx               # 章节列表
│   ├── DownloadSummary.tsx           # 下载摘要 CTA
│   ├── FAQ.tsx                       # FAQ 组件
│   ├── KeyQuotes.tsx                 # 核心引用
│   ├── RelatedBooks.tsx              # 相关推荐
│   ├── SearchBox.tsx                 # 搜索框
│   ├── SmartCTA.tsx                  # 智能行动号召
│   └── TrustSignals.tsx              # 信任标识 (评分/用户数)
│
├── lib/                              # 业务逻辑层
│   ├── db.ts                         # SQLite 连接 (单例, readonly)
│   ├── api.ts                        # 数据查询 (556 行, 25+ 函数)
│   ├── types.ts                      # TypeScript 类型定义
│   ├── categories.ts                 # 分类映射表 (20 个基础分类)
│   └── seo.ts                        # JSON-LD 结构化数据生成
│
├── scripts/                          # 数据生成 & 运维脚本
│   ├── process-books.js              # 批量书籍生成 (Search API → Preview API → DB)
│   ├── generate-comparisons-v2.js    # AI 对比内容生成 (OpenAI gpt-4.1)
│   ├── generate-homepage-data.js     # 首页数据生成 (homepage.json)
│   ├── submit-gsc-batch.js           # GSC 批量提交 (书籍页)
│   ├── submit-gsc-authors.js         # GSC 批量提交 (作者页)
│   ├── submit-gsc-comparisons.js     # GSC 批量提交 (对比页)
│   ├── build-celebrity-lists-v2.js   # 名人书单生成
│   ├── backfill-authors.js           # 作者数据回填
│   ├── fetch-audio-urls.js           # 音频 URL 获取
│   ├── daily-refresh.sh              # 每日刷新脚本
│   ├── insert-book.js                # 单本插入
│   ├── fix-categories.js             # 分类修复
│   ├── fix-content-quality.js        # 内容质量修复
│   └── split-authors.js              # 作者拆分
│
├── data/                             # 本地数据 (dev)
├── public/moment/                    # 静态资源
│   ├── api/homepage.json             # 首页动态数据
│   ├── audio/                        # 音频文件
│   ├── logo.png / logo-3x.png       # Logo
│   ├── favicon.ico                   # 图标
│   └── icons/                        # 图标集
│
├── next.config.ts                    # Next.js 配置
├── package.json                      # 依赖
└── tsconfig.json                     # TypeScript 配置
```

## 三、数据库 Schema

### 3.1 generated_books (8,296 行) — 核心书籍表

| 列名 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增 ID |
| book_id | TEXT | FizzRead API book ID |
| slug | TEXT UNIQUE | URL slug (e.g. `atomic-habits`) |
| title | TEXT | 书名 |
| author | TEXT | 作者 |
| category | TEXT | 分类 slug |
| meta_title | TEXT | SEO 标题 |
| meta_description | TEXT | SEO 描述 |
| keywords | TEXT | 关键词 |
| search_volume | INTEGER | 搜索量 |
| keyword_difficulty | INTEGER | 关键词难度 |
| content | TEXT | 完整页面内容 (HTML/Markdown) |
| cover_url | TEXT | 封面图 URL |
| page_count | INTEGER | 页数 |
| publish_year | TEXT | 出版年份 |
| isbn | TEXT | ISBN |
| status | TEXT | 状态 (默认 'completed') |
| has_audio | INTEGER | 是否有音频 (0/1) |
| audio_url | TEXT | 音频 URL |
| generated_at | DATETIME | 生成时间 |
| updated_at | DATETIME | 更新时间 |
| gsc_submitted_at | DATETIME | GSC 提交时间 |

**⚠️ 无 `locale` 列，所有内容为英文。**

### 3.2 authors (7,783 行) — 作者表

| 列名 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增 ID |
| slug | TEXT UNIQUE | URL slug |
| name | TEXT | 作者名 |
| meta_title | TEXT | SEO 标题 |
| meta_description | TEXT | SEO 描述 |
| content | TEXT | 作者介绍 (AI 生成) |
| total_books | INTEGER | 收录书籍数 |
| categories | TEXT | 擅长分类 |
| generated_at / updated_at / gsc_submitted_at | DATETIME | 时间戳 |

### 3.3 comparisons (77 行) — 书籍对比表

| 列名 | 类型 | 说明 |
|------|------|------|
| slug | TEXT PK | URL slug (e.g. `atomic-habits-vs-power-of-habit`) |
| title | TEXT | 对比标题 |
| description | TEXT | 简介 |
| meta_description | TEXT | SEO 描述 |
| book1_slug / book2_slug | TEXT FK | 两本书 slug |
| comparison_data | TEXT | 对比维度 JSON (8-10 维度) |
| deep_analysis | TEXT | 深度分析 (AI 生成, 800-1000 字) |
| faq_data | TEXT | FAQ JSON (5-7 问) |
| verdict | TEXT | 总结 |
| key_differences | TEXT | 关键差异 JSON |
| reading_order | TEXT | 阅读顺序建议 |
| reader_profiles | TEXT | 读者画像 JSON |
| related_slugs | TEXT | 相关对比 |
| category | TEXT | 分类 |

### 3.4 celebrity_lists (87 行) — 名人书单表

| 列名 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增 ID |
| slug | TEXT UNIQUE | URL slug |
| person | TEXT | 名人姓名 |
| category | TEXT | 分类 |
| content | TEXT | 完整内容 |
| books | TEXT | 书籍列表 JSON |
| total_books | INTEGER | 书籍数 |
| meta_title / meta_description / keywords | TEXT | SEO 字段 |
| search_volume / keyword_difficulty | INTEGER | SEO 指标 |

### 3.5 book_seeds (8,914 行) — 书籍种子队列

| 列名 | 类型 | 说明 |
|------|------|------|
| slug | TEXT UNIQUE | 目标 slug |
| title / author | TEXT | 书名/作者 |
| search_volume / keyword_difficulty | INTEGER | SEO 指标 |
| priority | INTEGER | 优先级 (默认 3) |
| status | TEXT | pending / completed / failed |
| uuid | TEXT | FizzRead book UUID |
| book_id_num | INTEGER | FizzRead book ID |

### 3.6 gsc_submissions (186 行) — GSC 提交记录

| 列名 | 类型 | 说明 |
|------|------|------|
| url | TEXT UNIQUE | 已提交的 URL |
| type | TEXT | 页面类型 (book/author/comparison) |
| slug | TEXT | 对应 slug |
| submitted_at | DATETIME | 提交时间 |
| status | TEXT | 状态 |

## 四、页面类型 & URL 结构

| 页面类型 | URL Pattern | 数量 | 数据源 |
|----------|-------------|------|--------|
| 根首页 | `/` | 1 | homepage.json |
| 书籍列表 | `/moment` | 1 | homepage.json + generated_books |
| 书籍详情 | `/moment/:slug` | 8,296 | generated_books |
| 作者页 | `/moment/author/:slug` | 7,783 | authors + generated_books |
| 作者列表 | `/moment/authors` | 1 | authors |
| 分类页 | `/moment/category/:slug` | ~100 | generated_books (按 category 分组) |
| 对比页 | `/moment/compare/:slug` | 77 | comparisons |
| 对比列表 | `/moment/comparisons` | 1 | comparisons |
| 名人书单 | `/moment/lists/:topic` | 87 | celebrity_lists |
| 书单列表 | `/moment/lists` | 1 | celebrity_lists |
| 字母索引 | `/moment/letter/:letter` | 26 | generated_books (按首字母) |

**总页面数: ~16,373**

## 五、API 查询层 (lib/api.ts)

共 25+ 导出函数，全部基于 SQLite 同步查询（better-sqlite3）。

**关键函数：**
- `getAllBooks()` — 全量书籍列表 (带分页)
- `getBookBySlug(slug)` — 单本书详情
- `getBooksByCategory(slug, page, pageSize)` — 分类书籍
- `getBooksByAuthor(name, excludeSlug, limit)` — 同作者书籍
- `getAllAuthors()` / `getAuthorBySlug(slug)` — 作者查询
- `getComparison(slug)` / `getAllComparisons()` — 对比查询
- `getComparisonsForBook(bookSlug, limit)` — 书籍相关对比
- `getBooksByLetter(letter, page, pageSize)` — 字母索引

**⚠️ 所有函数均无 `locale` 参数。**

## 六、分类体系

### 基础分类映射 (lib/categories.ts, 20 个)

```
self-help, fiction, business, romance, psychology, non-fiction, philosophy,
memoir, health, finance, thriller, productivity, relationships, leadership,
fantasy, science, history, sports, parenting, design
```

### 实际 DB 分类 (generated_books.category, ~100+ 个)

Top 10: leadership(600), classics(497), bestsellers(430), biographies(351), politics(324), world_history(318), economics(292), popular_sci(280), mental_health(225), western_phil(216)

分类粒度比映射表细得多，存在大量细分分类。

## 七、内容生成流程

### 7.1 书籍生成 (`process-books.js`)

```
book_seeds (pending)
    → FizzRead Search API (找到 book_id)
    → FizzRead Preview API (获取内容)
    → 组装 HTML content (章节标题 + 摘要 + 作者介绍)
    → 写入 generated_books
    → 提取作者信息 → 写入 authors
    → 更新 book_seeds 状态为 completed
```

### 7.2 对比生成 (`generate-comparisons-v2.js`)

```
选取两本书 slug
    → 读取两本书的 content
    → 调用 OpenAI gpt-4.1 生成对比内容
    → 8-10 个对比维度 + 深度分析 + FAQ + 关键差异 + 阅读顺序 + 读者画像
    → 写入 comparisons
```

### 7.3 首页数据 (`generate-homepage-data.js`)

```
DB 随机查询
    → rootFeatured (3本精选)
    → popularThisWeek (基于周 seed 的伪随机)
    → categories (Top 8 分类 + 计数)
    → comparisons (3组精选)
    → 写入 public/moment/api/homepage.json
    → 同步到 .next/standalone/public/moment/api/homepage.json
```

## 八、SEO 体系

### 8.1 Metadata

每个页面独立生成 `title` / `description` / `canonical` / `openGraph` / `twitter` metadata。

### 8.2 结构化数据 (JSON-LD)

- `Book` schema (书名/作者/评分/页数/音频)
- `Review` schema (评分/评论)
- 通过 `lib/seo.ts` 生成

### 8.3 Sitemap

动态生成，覆盖所有页面类型，每日更新 lastmod。

### 8.4 GSC 提交

三个脚本每日 cron 提交新页面：
- 书籍页 70 条/天
- 作者页 30 条/天
- 对比页 (手动触发)

## 九、部署架构

### 生产环境 (us.ovh 147.135.15.43)

```
PM2 (fizzread-seo, port 3001)
    └── node .next/standalone/server.js
        ├── .next/standalone/.next/server/  (SSR + ISR 缓存)
        └── .next/standalone/public/        (静态资源)
```

### 开发环境 (ge.ovh 51.75.146.33)

```
PM2 (fizzread-seo-dev, port 3002, root PM2)
    └── npm start (next start)
        └── book.xiai.xyz (Caddy 反代)
```

### Cron 定时任务 (生产 us.ovh)

| 时间 | 任务 | 说明 |
|------|------|------|
| 02:00 | n8n webhook 触发 | 每日书籍生成 |
| 03:00 | submit-gsc-batch.js --limit 70 | GSC 提交书籍 |
| 03:30 | submit-gsc-authors.js --limit 30 | GSC 提交作者 |
| 04:30 | generate-homepage-data.js | 首页数据更新 |
| 04:35 | 清 ISR 缓存 + PM2 restart | 首页强制刷新 |
| 每 6h | backup.sh db | 数据库热备 |
| 01:30 | backup.sh code | 代码打包 |
| 05:00 | backup.sh sync | 异地同步到 ge.ovh |

### Dev 定时任务 (ge.ovh)

| 时间 | 任务 | 说明 |
|------|------|------|
| 04:30 | daily-refresh.sh | 开发环境每日刷新 |

## 十、依赖清单

```json
{
  "@types/better-sqlite3": "^7.6.13",
  "better-sqlite3": "^12.6.2",
  "google-auth-library": "^10.5.0",  // GSC 提交
  "next": "16.1.6",
  "openai": "^6.25.0",               // AI 内容生成
  "react": "19.2.3",
  "react-dom": "19.2.3"
}
```

## 十一、样式体系

- **框架**: TailwindCSS (CDN-free, 内置)
- **配色**: 深绿主题 (`#003223` 背景, `#00C850` 品牌绿, `#004b3c` 卡片)
- **字体**: Inter (Google Fonts)
- **CSS 变量**: `globals.css` 定义 10 个主题变量
- **响应式**: 移动优先，断点 `md:` (768px), `lg:` (1024px)

## 十二、当前局限

1. **单语言** — 全站硬编码英文，无 i18n 机制
2. **无 locale 字段** — DB 没有语言标识，无法存储多语言内容
3. **组件文案硬编码** — Header/Footer/CTA 等文案直接写在 TSX 里
4. **API 层无语言参数** — 所有查询函数不支持按语言筛选
5. **Sitemap 单语言** — 无 hreflang 标注
6. **FizzRead API 依赖** — 数据源 `x-locale: en-US` 固定英文

## 十三、关键路径 & 数据流

```
[FizzRead App API]
      │ (Search + Preview, x-locale: en-US)
      ▼
[process-books.js] ──► [SQLite: generated_books] ◄── [generate-comparisons-v2.js]
                              │                               │
                              ▼                               ▼
                    [SQLite: authors]              [SQLite: comparisons]
                              │
                              ▼
                    [generate-homepage-data.js]
                              │
                              ▼
                    [homepage.json]
                              │
                              ▼
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
         [app/page.tsx]  [app/moment/     [app/moment/
          根首页          page.tsx]        [slug]/page.tsx]
                          书籍列表          书籍详情
                              │
                              ▼
                    [Next.js ISR Cache]
                              │
                              ▼
                    [用户浏览器]
```
