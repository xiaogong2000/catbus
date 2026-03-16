# FizzRead SEO — 批量导入书籍种子方案

## 背景

当前 FizzRead SEO 站点已生成约 388 本书的 SEO 页面。FizzRead App 共有 ~8,777 本英文书（以 en_US CSV 导出为准）。目标：将剩余书籍全部纳入 SEO 页面生成流水线。

## 数据来源

| 数据源 | 数量 | 说明 |
|--------|------|------|
| en_US CSV | 8,777 | App 工程师导出的当前可用英文书 UUID 列表 |
| Bulk Fetch (admin API) | 10,825 en-US | 包含已下架书籍，比 CSV 多 2,049 本 |
| generated_books (已生成) | ~388 | 已有 SEO 页面 |

**决定：以 en_US CSV 为准**，排除已下架书籍。

## 数据库改动

### book_seeds 表新增字段

```sql
ALTER TABLE book_seeds ADD COLUMN uuid TEXT;
ALTER TABLE book_seeds ADD COLUMN book_id_num INTEGER;  -- 备用，暂不使用
```

原表结构不变，新增 `uuid` 字段用于存储 FizzRead 书籍 UUID。

### 导入逻辑

1. 读取 CSV 的 8,777 个 UUID
2. 排除 `generated_books` 表中已有的（`book_id` 字段存的就是 UUID）
3. 剩余约 8,448 个 UUID 写入 `book_seeds`，status = `pending`
4. slug/title/author 暂用占位符，生成时由 API 自动填充

```sql
-- 导入示例
INSERT INTO book_seeds (slug, title, author, uuid, status)
VALUES ('uuid-ca33b84a', '[pending]', '[unknown]', 'ca33b84a-1967-44ab-acf2-ec8d32ae252a', 'pending');
```

## process-books.js 改动

核心改动：新增 UUID mode，与原有 search mode 并存。

### 原流程（search mode）
```
book_seeds (title) → Search API (title→UUID) → Preview API (UUID→内容) → generated_books
```

### 新流程（UUID mode）
```
book_seeds (uuid) → Preview API (UUID→内容) → 回填 title/author/slug → generated_books
```

### 关键发现

Preview API 的 `id` 参数直接接受 UUID，无需数字 ID：
```
GET https://www.fizzread.ai/api/v1/book/preview?id=<UUID>&locale=en-US
```

### 代码逻辑

```javascript
// 主循环中的判断
if (seed.uuid) {
  // UUID mode: 跳过 Search API，直接用 UUID 调 Preview API
  previewData = await getBookPreview(seed.uuid);
  
  // 从 API 返回数据填充 title/author/slug
  const realTitle = previewData.full_title || previewData.title;
  const realAuthor = previewData.author;
  const realSlug = slugify(realTitle);
  
  // 回写 book_seeds
  db.prepare('UPDATE book_seeds SET title=?, author=?, slug=? WHERE id=?')
    .run(realTitle, realAuthor, realSlug, seed.id);
} else {
  // 原有 search mode，不变
  searchResult = await searchBook(seed.title);
  previewData = await getBookPreview(searchResult.id);
}

// 后续组装 content、写入 generated_books、upsert author 逻辑不变
```

### 向后兼容

- 有 `uuid` 的种子走 UUID mode
- 没有 `uuid` 的种子走原有 search mode
- 两种模式共存，不影响现有数据

## 开发环境测试结果

在 ge.ovh 上测试 10 本书，全部成功：

| 书名 | 作者 | 状态 |
|------|------|------|
| The Feynman Lectures on Physics | Richard P. Feynman | ✅ |
| Gödel, Escher, Bach | Douglas R. Hofstadter | ✅ |
| The Elegant Universe | Brian Greene | ✅ |
| The Immortal Life of Henrietta Lacks | Rebecca Skloot | ✅ |
| The Emperor of All Maladies | Siddhartha Mukherjee | ✅ |
| The Sixth Extinction | Elizabeth Kolbert | ✅ |
| The Vital Question | Nick Lane | ✅ |
| I Contain Multitudes | Ed Yong | ✅ |
| The Gene: An Intimate History | Siddhartha Mukherjee | ✅ |
| Seven Brief Lessons on Physics | Carlo Rovelli | ✅ |

注意：CSV 前几个 UUID（book_id 1-14）返回 404，这些书已下架，符合预期。

## 生成与提交节奏

| 环节 | 每日量 | 说明 |
|------|--------|------|
| 页面生成 | 200 本/天 | n8n Workflow 1 `--limit 200`，预计 ~42 天完成全部 |
| GSC 提交 | 100 URL/天 | OpenClaw cron 03:00 CST，Indexing API 配额 ~190/天 |

生成速度 > 提交速度，确保 GSC 始终有新页面可提交。全部生成完（~42 天）后，GSC 还需约 ~42 天追完提交队列。

**整体时间线：**
- 第 1-42 天：每天生成 200 页 + 提交 100 URL
- 第 43-84 天：生成完毕，每天继续提交 100 URL
- ~第 84 天：全部 ~8,448 页生成并提交完毕

## 部署计划

1. **开发环境验证**（ge.ovh）— ✅ 已完成
2. **代码同步到生产**（ge.ovh → fr.ovh）
   - `process-books.js` 改动
   - `book_seeds` 表 ALTER TABLE
3. **批量导入 UUID** 到 fr.ovh 的 `book_seeds` 表
4. **调整 n8n Workflow 1** 的 `--limit` 参数为 200
5. **GSC 提交 cron 保持 100/天不变**
6. **监控**：检查失败率、API 限流、磁盘空间

## 风险点

| 风险 | 影响 | 应对 |
|------|------|------|
| 部分 UUID 对应的书已下架 | 生成失败，标记为 failed | 脚本已有 try/catch，失败不影响后续 |
| Preview API 限流 | 生成变慢 | 每本间隔 500ms，可调整 |
| slug 重复 | INSERT 失败 | 需要加 slug 去重逻辑（当前用 UNIQUE 约束） |
| 磁盘空间 | 数据库增长 | 每本约 5-10KB，10,000 本约 50-100MB |

## 文件清单

| 文件 | 位置 | 改动 |
|------|------|------|
| process-books.js | `/root/projects/fizzread-seo/scripts/` | 新增 UUID mode |
| book_seeds 表 | `/data/fizzread-seo.db` | 新增 uuid, book_id_num 字段 |
| 导入脚本 | 一次性脚本 | 读 CSV → 写 book_seeds |
