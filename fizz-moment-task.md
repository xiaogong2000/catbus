# Fizz Moment SEO 系统开发任务

> 你正在开发 Fizz Moment —— FizzRead 的 SEO 优化内容系统。
> 这是一个独立的 Next.js 14 项目，通过 Cloudflare Workers 反向代理挂载到主域名 `/moment/*` 路径。

---

## 🎯 项目背景

**问题**：FizzRead 主站是 uni-app CSR 架构，无法支持 SEO
**方案**：独立 Next.js SSG 系统，生成 SEO 友好的静态页面
**定位**：Fizz Moment 不只是书籍摘要，未来可承载新闻、播客、知识卡片等内容

---

## 📁 项目结构

```
fizzread-seo/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # 全局 layout
│   │   ├── page.tsx                # 首页 redirect
│   │   ├── moment/
│   │   │   └── [slug]/
│   │   │       └── page.tsx        # 内容详情页
│   │   ├── sitemap.ts              # 动态 sitemap
│   │   ├── robots.ts               # robots.txt
│   │   └── not-found.tsx           # 404 页面
│   ├── components/
│   │   ├── SmartCTA.tsx            # 智能下载按钮
│   │   ├── Breadcrumb.tsx          # 面包屑
│   │   ├── ContentCard.tsx         # 内容卡片
│   │   ├── FAQ.tsx                 # FAQ 手风琴
│   │   ├── ContentHero.tsx         # Hero 区
│   │   ├── KeyIdeas.tsx            # Key Ideas
│   │   ├── AuthorSection.tsx       # 作者信息
│   │   ├── RelatedContent.tsx      # 相关推荐
│   │   ├── TrustSignals.tsx        # 信任信号
│   │   └── Footer.tsx              # 页脚
│   ├── lib/
│   │   ├── api.ts                  # API 封装
│   │   ├── types.ts                # 类型定义
│   │   └── mock-data.ts            # Mock 数据
│   └── styles/
│       └── globals.css             # 全局样式
├── public/
│   └── (从 h5/static 复制的资源)
├── .env.local
├── .env.example
├── next.config.js
├── tailwind.config.ts
├── Dockerfile
└── docker-compose.yml
```

---

## 🎨 设计规范

### 配色 (从 h5/assets/main-*.css 提取)

```css
:root {
  --primary-color: #00C850;           /* 品牌绿 / CTA */
  --background-dark-green: #003223;   /* 主背景 */
  --background-light-green: #00C850;  /* 按钮背景 */
  --background-green: #005028;        /* 中绿 */
  --text-primary: #FFFFFF;            /* 主文字 */
  --text-gray: #C8C8C8;               /* 次要文字 */
  --text-genre: #A0C8A0;              /* 标签文字 */
  --text-active: #00C850;             /* 激活态 */
  --border-color: #004b3c;            /* 分割线 */
}
```

### Tailwind 配置

```typescript
// tailwind.config.ts
const config = {
  theme: {
    extend: {
      colors: {
        primary: '#00C850',
        'primary-dark': '#003223',
        'primary-light': '#005028',
        'text-primary': '#FFFFFF',
        'text-gray': '#C8C8C8',
        'text-muted': '#A0C8A0',
        border: '#004b3c',
      },
      fontFamily: {
        sans: ['PingFang SC', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
    },
  },
}
```

### 关键样式参数

| 元素 | 值 |
|------|-----|
| 封面宽度 | `15rem` |
| 标题字号 | `1.5rem`, `font-semibold` |
| 作者字号 | `1rem`, `#C8C8C8` |
| CTA 按钮 | 高 `2.25rem`, 圆角 `1.125rem`, 背景 `#00C850` |
| 响应式断点 | `1024px`, `768px` |

---

## 🔗 API 接口

### 现有 API (可直接使用)

**GET** `https://www.fizzread.ai/api/v1/book/preview?id={uuid}&locale=en-US`

```json
{
  "code": 200,
  "data": {
    "id": "uuid",
    "title": "书名",
    "author": "作者",
    "cover_url": "https://...",
    "cover_urls": { "1x": "...", "2x": "...", "3x": "..." },
    "about": "摘要",
    "about_author": "作者简介",
    "genre": "biographies,popular_sci",
    "genres": { "biographies": "Biography & Memoir", ... },
    "audio_duration": 785,
    "chapter_count": 11,
    "preview_data": {
      "introduction": { "title": "...", "content": "..." },
      "chapter_titles": ["...", "..."],
      "first_chapters": [{ "title": "...", "content": "..." }]
    }
  }
}
```

### 需要后端新增

1. **slug 字段** — Book 表添加 `slug VARCHAR(255) UNIQUE`
2. **支持 slug 查询** — `GET /api/v1/book/preview?slug={slug}`
3. **slug 列表 API** — `GET /api/v1/seo/slugs` 返回所有 slug

---

## 📱 CTA 跳转策略

**所有设备统一跳转 App Store**：

```
https://apps.apple.com/us/app/fizzread/id6755955369
```

按钮文案：
- Primary: **"Get Free Summary"** 或 **"Download App"**
- Secondary: **"Listen on App"**

添加 UTM 追踪：
```
?utm_source=seo&utm_medium=moment_page&utm_campaign={slug}
```

---

## 📋 开发任务清单

### Phase 1: 项目初始化 (30min)

```bash
cd ~/projects
npx create-next-app@14 fizzread-seo --typescript --tailwind --app --src-dir
cd fizzread-seo
```

- [ ] 创建项目目录结构
- [ ] 配置 tailwind.config.ts (使用上述配色)
- [ ] 配置 next.config.js (images.remotePatterns, output: 'standalone')
- [ ] 创建 .env.example
- [ ] 从 ~/projects/h5/static 复制 logo、icons 到 public/

### Phase 2: 类型定义 & API 层 (1h)

**src/lib/types.ts**
```typescript
export interface Content {
  id: string;
  slug: string;
  title: string;
  author: string;
  coverUrl: string;
  summary: string;
  keyIdeas: string[];
  readingTime: string;
  tags: string[];
  authorBio: string;
  chapterTitles: string[];
  introduction: { title: string; content: string };
}

export interface RelatedContent {
  slug: string;
  title: string;
  author: string;
  coverUrl: string;
}

export interface FAQ {
  question: string;
  answer: string;
}
```

**src/lib/api.ts**
- getContentBySlug(slug): Promise<Content | null>
- getAllSlugs(): Promise<string[]>
- getRelatedContent(slug): Promise<RelatedContent[]>
- 添加 mock 模式开关
- ISR revalidate = 86400

### Phase 3: Mock 数据 (1h)

**src/lib/mock-data.ts**

创建 10 本书的完整 mock 数据：
1. Atomic Habits (James Clear)
2. Deep Work (Cal Newport)
3. Thinking, Fast and Slow (Daniel Kahneman)
4. The Psychology of Money (Morgan Housel)
5. Sapiens (Yuval Noah Harari)
6. The 7 Habits of Highly Effective People (Stephen Covey)
7. How to Win Friends and Influence People (Dale Carnegie)
8. Rich Dad Poor Dad (Robert Kiyosaki)
9. The Lean Startup (Eric Ries)
10. Start with Why (Simon Sinek)

每本书包含：
- 完整 Content 类型数据
- 2-3 段有意义的 summary
- 5-7 条 keyIdeas
- 3-5 个 FAQ

### Phase 4: UI 组件 (3h)

**src/components/SmartCTA.tsx**
- 统一跳转 App Store
- Primary/Secondary 两种样式
- UTM 参数追踪

**src/components/Breadcrumb.tsx**
- 首页 > Fizz Moment > {标题}
- BreadcrumbList JSON-LD

**src/components/ContentCard.tsx**
- 封面图 + 标题 + 作者
- Next.js Image 优化
- hover 效果

**src/components/FAQ.tsx**
- 手风琴展开/收起
- FAQPage JSON-LD
- 纯 CSS/useState 实现

**src/components/ContentHero.tsx**
- 左: 封面图 (priority loading)
- 右: 标题(h1) + 作者 + 阅读时间 + 标签
- 下: SmartCTA 按钮组
- 移动端: 垂直布局

**src/components/KeyIdeas.tsx**
- h2 "Key Ideas"
- 有序列表

**src/components/AuthorSection.tsx**
- h2 "About the Author"
- 作者名 + 简介

**src/components/RelatedContent.tsx**
- h2 "You Might Also Like"
- 横向滚动卡片

**src/components/TrustSignals.tsx**
- "5M+ readers" / "4.8★ App Store" / "10,000+ summaries"

**src/components/Footer.tsx**
- Logo + 品牌
- App Store 下载链接

### Phase 5: 核心页面 (2h)

**src/app/moment/[slug]/page.tsx**

```typescript
// generateStaticParams - 预生成 10 页
// generateMetadata - 动态 meta
// revalidate = 86400

// JSON-LD Schema:
// - Book schema
// - BreadcrumbList
// - FAQPage
```

页面布局：
1. Breadcrumb
2. ContentHero
3. TrustSignals
4. Summary 区 (h2 "What's it about?")
5. KeyIdeas 区
6. AuthorSection
7. FAQ 区
8. RelatedContent
9. 底部 CTA
10. Footer

HTML 语义化：
- `<main>` 包裹整体
- `<article>` 包裹内容
- 只有一个 `<h1>`
- `<section>` 分隔各区块

### Phase 6: SEO 配置 (30min)

**src/app/sitemap.ts**
```typescript
export default async function sitemap() {
  const slugs = await getAllSlugs();
  return slugs.map(slug => ({
    url: `https://www.fizzread.ai/moment/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.8,
  }));
}
```

**src/app/robots.ts**
```typescript
export default function robots() {
  return {
    rules: { userAgent: '*', allow: '/moment/', disallow: ['/app/', '/api/'] },
    sitemap: 'https://www.fizzread.ai/sitemap.xml',
  };
}
```

**src/app/not-found.tsx**
- 404 页面
- "Content not found" + 返回首页

### Phase 7: 全局 Layout (30min)

**src/app/layout.tsx**
- html lang="en"
- 字体配置
- Google Analytics (可选)
- viewport meta

**src/styles/globals.css**
- Tailwind imports
- CSS 变量
- 滚动条样式

### Phase 8: 部署配置 (1h)

**Dockerfile**
```dockerfile
FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:18-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

**docker-compose.yml**
```yaml
services:
  fizzread-seo:
    build: .
    ports:
      - "3000:3000"
    environment:
      - API_BASE_URL=${API_BASE_URL}
    restart: unless-stopped
```

**cloudflare-worker.js**
```javascript
export default {
  async fetch(request) {
    const url = new URL(request.url);
    
    // SEO 路由转发
    if (url.pathname.startsWith('/moment/') ||
        url.pathname === '/sitemap.xml' ||
        url.pathname === '/robots.txt') {
      return fetch(`https://seo.fizzread.ai${url.pathname}`, request);
    }
    
    // 其他请求走主站
    return fetch(request);
  }
}
```

---

## 🔧 环境变量

**.env.example**
```
API_BASE_URL=https://www.fizzread.ai/api/v1
NEXT_PUBLIC_SITE_URL=https://www.fizzread.ai
NEXT_PUBLIC_APP_STORE_URL=https://apps.apple.com/us/app/fizzread/id6755955369
```

**.env.local (开发)**
```
API_BASE_URL=mock
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_APP_STORE_URL=https://apps.apple.com/us/app/fizzread/id6755955369
```

---

## ✅ 验收标准

- [ ] 10 个 /moment/{slug} 页面正常渲染
- [ ] 不存在的 slug 返回 404
- [ ] Lighthouse SEO ≥ 95
- [ ] Lighthouse Performance ≥ 90
- [ ] 移动端显示正常
- [ ] JSON-LD 通过 Google 结构化数据测试
- [ ] sitemap.xml 列出所有页面
- [ ] robots.txt 正确
- [ ] SmartCTA 跳转 App Store 正常

---

## 📂 参考资源

H5 源码位置：`~/projects/h5/`
- 设计截图: `~/projects/h5/static/screenshots/`
- Logo: `~/projects/h5/static/icons/logo.svg`
- App Icons: `~/projects/h5/static/icons/icon-*.png`
- CSS 变量: `~/projects/h5/assets/main-*.css`
- 详情页样式: `~/projects/h5/assets/detail-*.css`

---

## 🚀 开始开发

```bash
cd ~/projects
npx create-next-app@14 fizzread-seo --typescript --tailwind --app --src-dir
cd fizzread-seo
npm run dev
```

按 Phase 1-8 顺序执行，使用 mock 数据完成全部开发。
