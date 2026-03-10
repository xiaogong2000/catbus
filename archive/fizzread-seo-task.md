# FizzRead SEO 系统开发任务

## 项目目标
为 FizzRead.ai 搭建独立的 SEO 系统，部署在 www.fizzread.ai/books/* 路径下。

## Phase 1 MVP 目标
- 10 个图书摘要页
- 2 个主题榜单页
- 1 个竞品对比页
- 共 13 个精品页面

## 技术栈
- Next.js 14+ (App Router)
- TypeScript
- Tailwind CSS
- ISR (Incremental Static Regeneration)

## 项目结构
```
fizzread-seo/
├── app/
│   ├── books/
│   │   └── [slug]/
│   │       └── page.tsx          # 图书摘要页
│   ├── lists/
│   │   └── [topic]/
│   │       └── page.tsx          # 主题榜单页
│   ├── compare/
│   │   └── [slug]/
│   │       └── page.tsx          # 竞品对比页
│   ├── layout.tsx
│   ├── page.tsx                  # 首页
│   └── sitemap.ts
├── components/
│   ├── BookCard.tsx
│   ├── SmartCTA.tsx
│   ├── FAQ.tsx
│   ├── Breadcrumb.tsx
│   └── ...
├── lib/
│   ├── api.ts                    # FizzRead API Client
│   └── seo.ts                    # SEO 工具函数
├── data/
│   └── books.json                # MVP 阶段的静态数据 (10本书)
└── public/
```

## 页面结构 (图书摘要页)
1. 面包屑导航: Home > 分类 > 书名
2. Hero 区: 封面图 + 书名 + 作者 + 阅读时间 + CTA
3. 摘要区: 前 30% 展示，剩余折叠
4. Key Takeaways: 要点列表
5. FAQ 区: 5 个问答 (带 FAQPage schema)
6. 相关书籍: 6 本推荐 (内链)

## SEO 要求
- 每页动态 meta title/description
- JSON-LD: Book + Review + FAQPage + BreadcrumbList
- 语义化 HTML: h1, h2, article, section
- URL 格式: /books/atomic-habits (slug)

## 视觉风格 (复刻 FizzRead 主站)
- 深绿色背景: #0a1f14
- 绿色强调色
- 白色文字
- 圆角卡片

## MVP 数据 (10 本高搜索量书籍)
1. Atomic Habits - James Clear
2. The Psychology of Money - Morgan Housel
3. Think Again - Adam Grant
4. The 7 Habits of Highly Effective People - Stephen Covey
5. Deep Work - Cal Newport
6. Thinking, Fast and Slow - Daniel Kahneman
7. The Lean Startup - Eric Ries
8. Start with Why - Simon Sinek
9. Sapiens - Yuval Noah Harari
10. The Power of Habit - Charles Duhigg

## 榜单页 (2 个)
1. /lists/best-productivity-books - 最佳效率书籍
2. /lists/best-psychology-books - 最佳心理学书籍

## 对比页 (1 个)
1. /compare/atomic-habits-vs-power-of-habit - 习惯养成书籍对比

## 开发步骤
1. npx create-next-app@latest fizzread-seo --typescript --tailwind --app
2. 配置 Tailwind 主题 (FizzRead 配色)
3. 创建基础组件 (Header, Footer, BookCard, SmartCTA)
4. 创建图书摘要页模板 /books/[slug]
5. 添加 10 本书的静态数据
6. 实现 JSON-LD schema
7. 创建榜单页模板 /lists/[topic]
8. 创建对比页模板 /compare/[slug]
9. 生成 sitemap.xml
10. 配置 ISR revalidate

## 部署
- 项目目录: ~/projects/fizzread-seo
- 运行端口: 3001
- Caddy 反代: seo.fizzread.ai -> localhost:3001

开始开发吧！
