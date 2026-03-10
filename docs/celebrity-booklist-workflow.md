# 书单创建流程

> **主人说"创建书单"时，默认执行此流程**

> 正确流程：先研究真实推荐/主题书籍 → 生成新书 → 创建书单

## 书单类型

| 类型 | 示例 | 研究方法 |
|------|------|----------|
| **名人书单** | Bill Gates、Elon Musk | 搜索名人公开推荐 |
| **作家书单** | Stephen King、Paulo Coelho | 搜索作家代表作 + 推荐 |
| **分类书单** | Best Productivity Books | 搜索该分类热门书籍 |
| **主题书单** | Books on Stoicism | 搜索主题相关经典 |

## 流程概览

```
确定书单类型 → 研究收集书籍 → 检查库存 → 添加到 book_seeds → 触发生成 → 等待完成 → 创建/更新书单 → 部署
```

## 详细步骤

### 1. 研究收集书籍 📚

**目标**：找到**真实、有依据**的书籍列表，不是凭空匹配库存。

**搜索方法**：
```bash
# 名人书单
node skills/tavily-search/scripts/search.mjs "[名人] recommended books reading list" -n 5

# 作家书单
node skills/tavily-search/scripts/search.mjs "[作家] best books must read" -n 5

# 分类书单
node skills/tavily-search/scripts/search.mjs "best [分类] books of all time" -n 5

# 主题书单
node skills/tavily-search/scripts/search.mjs "best books about [主题]" -n 5
```

**信息来源**：
- **名人**：Twitter/X、采访、goodbooks.io、readthistwice.com
- **作家**：Goodreads、Amazon 作者页、维基百科
- **分类/主题**：Goodreads lists、Reddit、专业书评网站

**输出**：每个书单 8-15 本书籍

---

### 2. 检查库存 🔍

**目标**：确定哪些书已存在，哪些需要新生成。

```bash
# 导出现有书籍
ssh fr.ovh "sqlite3 /data/fizzread-seo.db 'SELECT slug FROM generated_books WHERE status=\"completed\"'" > existing_books.txt

# 对比名人书单，标注：
# ✅ 已有
# ❌ 需新生成
```

---

### 3. 添加书籍到生成队列 📖

**目标**：将缺失书籍添加到 `book_seeds` 表。

**脚本模板**：
```javascript
// scripts/add-book-seeds-batchX.js
const Database = require('better-sqlite3');
const db = new Database('/data/fizzread-seo.db');

const books = [
  { title: "Book Title", author: "Author Name", category: "category", priority: 1 },
  // ... more books
];

function slugify(title) {
  return title.toLowerCase().replace(/['']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const insertStmt = db.prepare(`
  INSERT OR IGNORE INTO book_seeds (slug, title, author, category, priority, status)
  VALUES (?, ?, ?, ?, ?, 'pending')
`);

for (const book of books) {
  const slug = slugify(book.title);
  insertStmt.run(slug, book.title, book.author, book.category, book.priority);
  console.log(`✅ 添加: ${book.title} → ${slug}`);
}
db.close();
```

**执行**：
```bash
scp scripts/add-book-seeds-batchX.js fr.ovh:/tmp/
ssh fr.ovh "sudo cp /tmp/add-book-seeds-batchX.js /root/projects/fizzread-seo/scripts/"
ssh fr.ovh "sudo -i bash -c 'cd /root/projects/fizzread-seo && node scripts/add-book-seeds-batchX.js'"
```

---

### 4. 触发书籍生成 🚀

**触发 n8n Workflow**：
```bash
curl -s -X POST "https://n8n.xiai.xyz/webhook/fizzread-seo-run" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Workflow 说明**：
- Webhook 触发 → `process-books.js` 处理队列 → 构建部署 → Telegram 通知
- 自动从 `book_seeds` 表读取 pending 书籍
- 调用 FizzRead API 获取书籍内容
- 写入 `generated_books` 表
- 完成后自动 `npm run build` 并通知

**等待完成**：
- n8n 完成后会发 Telegram 通知
- 或手动检查：`sqlite3 /data/fizzread-seo.db "SELECT COUNT(*) FROM book_seeds WHERE status='pending'"`

---

### 5. 更新书单数据 📋

**前提**：所有书籍已生成完成（status='completed'）。

**数据库插入**：
```javascript
// scripts/add-celebrity-list.js
const list = {
  slug: 'celebrity-name-recommended-books',
  person: 'Celebrity Name',
  category: 'celebrity',
  title: "Celebrity Name's Must-Read Books",
  description: '描述...',
  metaDescription: 'SEO 描述...',
  keywords: 'celebrity name books, celebrity name reading list',
  books: ['book-slug-1', 'book-slug-2', ...], // 必须是已存在的 slug
};

// 插入到 celebrity_lists 表
```

**验证**：
```bash
# 确保所有 book slug 都存在
node -e "
const db = require('better-sqlite3')('/data/fizzread-seo.db');
const books = ['slug1', 'slug2'];
const missing = books.filter(s => !db.prepare('SELECT 1 FROM generated_books WHERE slug=?').get(s));
console.log('Missing:', missing);
"
```

---

### 6. 构建部署 🚀

```bash
# 开发环境验证
ssh ge.ovh "cd /home/debian/projects/fizzread-seo && npm run build"

# 确认后同步到生产
scp ge.ovh:/data/fizzread-seo.db fr.ovh:/data/fizzread-seo.db
ssh fr.ovh "sudo -i bash -c 'cd /root/projects/fizzread-seo && npm run build'"

# 重启服务
ssh fr.ovh "sudo -i bash -c '/root/.npm/_npx/.../pm2/bin/pm2 restart fizzread-seo'"
```

---

## 检查清单

- [ ] **研究**：每个书单有 8-15 本真实书籍（Tavily 搜索）
- [ ] **库存检查**：对比 `generated_books` 表，标注已有/需生成
- [ ] **添加队列**：缺失书籍写入 `book_seeds` 表（status=pending）
- [ ] **触发生成**：`curl -X POST https://n8n.xiai.xyz/webhook/fizzread-seo-run`
- [ ] **等待完成**：收到 Telegram 通知，或检查 pending 数量
- [ ] **更新书单**：用新书 slug 更新 `celebrity_lists.books`
- [ ] **开发验证**：ge.ovh 构建成功
- [ ] **生产部署**：同步 DB + 代码 → fr.ovh 构建 + PM2 重启
- [ ] **线上验证**：访问 /moment/lists 确认

---

## 常见错误

### ❌ 错误做法
用库里已有的书凑书单，而不是根据真实推荐/主题研究。

### ✅ 正确做法
1. 先研究：名人推荐了什么？作家写了什么？该分类有哪些经典？
2. 生成缺失书籍的详情页
3. 再创建书单

---

## 相关文件

- **书籍处理脚本**：`/root/projects/fizzread-seo/scripts/process-books.js`
- **书籍队列添加**：`/root/projects/fizzread-seo/scripts/add-book-seeds-batchX.js`
- **n8n Workflow**：`SSRrZsmY1KanSY6K`（书籍生成）
- **Webhook URL**：`https://n8n.xiai.xyz/webhook/fizzread-seo-run`
- **数据库**：`/data/fizzread-seo.db`
  - `book_seeds` 表：待生成书籍队列
  - `generated_books` 表：已生成书籍详情
  - `celebrity_lists` 表：名人书单

## 快速命令

```bash
# 检查待生成队列
ssh fr.ovh "sudo sqlite3 /data/fizzread-seo.db 'SELECT COUNT(*) FROM book_seeds WHERE status=\"pending\"'"

# 检查已生成书籍数
ssh fr.ovh "sudo sqlite3 /data/fizzread-seo.db 'SELECT COUNT(*) FROM generated_books WHERE status=\"completed\"'"

# 触发生成
curl -s -X POST "https://n8n.xiai.xyz/webhook/fizzread-seo-run" -H "Content-Type: application/json" -d '{}'

# 重启 PM2
ssh fr.ovh "sudo -i bash -c '/root/.npm/_npx/5f7878ce38f1eb13/node_modules/pm2/bin/pm2 restart fizzread-seo'"
```
