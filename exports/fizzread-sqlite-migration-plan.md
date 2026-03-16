# FizzRead SQLite 数据迁移方案

> 目标：将 8296 本书的数据从静态构建文件迁移到 SQLite，统一数据读取层，为后续扩展（Skill、API）打基础。

---

## 背景

### 当前问题

FizzRead SEO 站点（us.ovh）的书籍数据目前 bake 在 Next.js 构建产物里：

```
.next/server/app/moment/{slug}.rsc  ×8296 个文件
```

- SQLite DB（`data/fizzread.db`）是空的，未使用
- 音频 URL 藏在 RSC 文件里，格式：`nccgpub.blob.core.windows.net/media/xxx.mp3`
- 无法按需查询、过滤、搜索

### 目标架构

```
RSC 文件（一次性迁移）
        ↓
    SQLite DB
        ↓
    lib/api.ts（统一读取层）
        ↓
  Next.js 页面 / 未来 Skill
```

---

## 一、SQLite Schema 设计

```sql
CREATE TABLE IF NOT EXISTS books (
  id            TEXT PRIMARY KEY,          -- FizzRead App UUID
  slug          TEXT UNIQUE NOT NULL,      -- URL slug（如 atomic-habits）
  title         TEXT NOT NULL,
  subtitle      TEXT,
  author        TEXT NOT NULL,
  about         TEXT,                      -- 书籍简介
  about_author  TEXT,                      -- 作者简介
  introduction  TEXT,                      -- 导言（JSON: {title, content}）
  chapters      TEXT,                      -- 章节 key ideas（JSON 数组）
  chapter_titles TEXT,                     -- 章节标题列表（JSON 数组）
  chapter_count INTEGER DEFAULT 0,
  cover_url     TEXT,                      -- 封面 URL（600px）
  cover_urls    TEXT,                      -- 多尺寸封面（JSON: {1x,2x,3x}）
  cover_color   TEXT,
  genres        TEXT,                      -- 分类标签（JSON 对象）
  locale        TEXT DEFAULT 'en-US',
  has_audio     INTEGER DEFAULT 0,         -- 0/1
  audio_url     TEXT,                      -- Azure Blob MP3 URL（~10分钟）
  audio_duration INTEGER DEFAULT 0,       -- 秒数
  search_volume INTEGER DEFAULT 0,
  status        TEXT DEFAULT 'completed',
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_books_slug ON books(slug);
CREATE INDEX IF NOT EXISTS idx_books_has_audio ON books(has_audio);
CREATE INDEX IF NOT EXISTS idx_books_search_volume ON books(search_volume DESC);

-- 全文搜索
CREATE VIRTUAL TABLE IF NOT EXISTS books_fts USING fts5(
  slug, title, author, about,
  content='books', content_rowid='rowid'
);
```

---

## 二、迁移脚本

**文件**：`scripts/migrate-rsc-to-sqlite.ts`

### 流程

```
读取 .next/server/app/moment/*.rsc
        ↓
正则提取 JSON 数据块
（audioUrl / title / author / chapters / cover_url 等）
        ↓
批量写入 SQLite（UPSERT，可重复跑）
        ↓
重建 FTS 索引
```

### 核心提取逻辑

RSC 文件是 Next.js Server Component 序列化格式，关键字段提取：

| 字段 | 来源 |
|------|------|
| `audioUrl` | `"audioUrl":"https://nccgpub.blob.core.windows.net/media/..."` |
| `title/author` | Schema.org JSON-LD 块 |
| `chapters` | RSC payload 中的 `first_chapters` 数组 |
| `cover_url` | `nccgpub.blob.core.windows.net/cover/...` |
| `audio_duration` | `"duration":"PT10M0S"` → 转换为秒 |

### 运行方式

```bash
# 安装依赖
npm install better-sqlite3 @types/better-sqlite3

# 运行迁移（在 us.ovh 生产机器上执行）
npx ts-node scripts/migrate-rsc-to-sqlite.ts

# 预计耗时：8296 个文件，约 2-5 分钟
# 支持断点续跑（UPSERT）
```

---

## 三、lib/api.ts 重构

### 读取优先级

```typescript
// 伪代码
async function getBooks(): Promise<Book[]> {
  const db = openDB('data/fizzread.db')
  const count = db.prepare('SELECT COUNT(*) FROM books').get()

  if (count > 0) {
    return db.prepare('SELECT * FROM books WHERE status="completed"').all()
  }

  // Fallback：SQLite 为空时读 JSON
  return require('../data/books.json')
}
```

### 变更范围

| 函数 | 当前 | 重构后 |
|------|------|--------|
| `getAllBooks()` | 读 books.json | 优先 SQLite |
| `getBookBySlug(slug)` | 遍历 JSON | SQLite 索引查询 |
| `searchBooks(q)` | 内存过滤 | FTS5 全文搜索 |
| `getBooksByGenre(genre)` | 内存过滤 | SQL WHERE |

---

## 四、Skill 集成方案

数据入库后，第三方 OpenClaw Skill 无需我们新建 API，直接用现有资源：

### 方案 A：用现有 FizzRead App API（推荐）

```
GET https://www.fizzread.ai/api/v1/book/search?q=xxx
GET https://www.fizzread.ai/api/v1/book/preview?id=xxx
```
- 需要给 Skill 开发者提供一个 API Key
- FizzRead 后端确认返回 `audio_url` 字段（目前 preview 端点未暴露，需后端配合）

### 方案 B：Skill 直接 web_fetch 页面

```
GET https://www.fizzread.ai/moment/atomic-habits
```
- 页面公开可访问，无需鉴权
- Skill 用 web_fetch 抓 HTML，AI 解析出摘要/音频链接
- 无需任何后端改动

---

## 五、执行步骤

| 步骤 | 执行人 | 环境 | 说明 |
|------|--------|------|------|
| 1. 写迁移脚本 | 浣浣（Claude Code）| ge.ovh | 在开发环境写代码 |
| 2. 重构 lib/api.ts | 浣浣（Claude Code）| ge.ovh | 向后兼容 fallback |
| 3. 本地测试 | 浣浣 | ge.ovh | book.xiai.xyz 验证 |
| 4. 在生产机器跑迁移 | 浣浣 SSH 到 us.ovh | us.ovh | 执行 migrate 脚本 |
| 5. 生产部署 | 浣浣 | us.ovh | npm run build + pm2 restart |
| 6. 验证 | 自动 | — | 检查 DB 8296 条记录 + 有 audio_url |

---

## 六、预期收益

| 方面 | 迁移前 | 迁移后 |
|------|--------|--------|
| 数据查询 | 无法查询（静态文件）| SQL 任意查询 |
| 音频 URL | 藏在 RSC，难以访问 | DB 字段，直接读取 |
| 搜索 | N/A | FTS5 全文搜索 |
| 新增书籍 | 重新 build | INSERT 写 DB |
| Skill 支持 | 无 | ✅ 有完整数据支撑 |

---

*方案设计：NeFi / 执行：浣浣（ge.ovh Claude Code）*
