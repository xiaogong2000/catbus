# FizzRead SEO 行动计划

> 基于 Semrush 深度诊断报告 + 462 个竞品关键词分析
> 制定日期：2026-02-16
> 目标：3 个月内从 0 → 500-1,000 关键词，月流量 200-500

---

## 🔴 P0 — 紧急（本周内）

### T1. 清理有毒外链 + Google Disavow
- **问题**：98% 引荐域名 AS 0-10，72% 来自新加坡，网络图标记"危险"
- **行动**：
  1. 从 Semrush Backlink Analytics 导出所有 62 个外链
  2. 标记垃圾链接（.space/.sbs/.monster TLD、网站价值查询站、SEO 垃圾站、短链接站）
  3. 保留 fizzread.com 自有链接 + booksreadr.org
  4. 生成 disavow.txt 文件
  5. 提交到 Google Search Console Disavow Tool
- **负责**：NeFi
- **预计耗时**：2 小时

### T2. 修复作者页 title 重复
- **问题**：`Books by James Clear | Fizz Moment | Fizz Moment`（重复了 "Fizz Moment"）
- **行动**：修改 `app/moment/author/[slug]/page.tsx` 的 metadata 生成逻辑
- **负责**：ge.ovh Claude Code
- **预计耗时**：15 分钟

### T3. 修复书单页 title/meta
- **问题**：书单页 title 显示为通用的 `Fizz Moment - AI Book Summaries`，没有书单名
- **行动**：修改 `app/moment/lists/[topic]/page.tsx` 的 metadata，格式改为 `{名人名} Book Recommendations - Best Books Picked by {名人名} | Fizz Moment`
- **负责**：ge.ovh Claude Code
- **预计耗时**：30 分钟

### T4. 添加 robots.txt
- **问题**：/moment/robots.txt 返回 404
- **行动**：在 `app/moment/` 下创建 robots.txt 路由（或 public 目录），内容包含 sitemap 指向
- **负责**：ge.ovh Claude Code
- **预计耗时**：15 分钟

### T5. 添加 llms.txt
- **问题**：/moment/llms.txt 返回 404，Semrush Site Audit 报告格式问题
- **行动**：创建 llms.txt，描述网站内容结构，帮助 AI 爬虫理解
- **负责**：ge.ovh Claude Code
- **预计耗时**：30 分钟

### T6. 确认 Google 索引状态
- **问题**：Semrush 显示 US 市场 0 个关键词排名，需确认页面是否被 Google 收录
- **行动**：
  1. 在 GSC 检查索引覆盖率报告
  2. 确认 sitemap.xml 已提交且被处理
  3. 抽查 10 个页面的索引状态
  4. 检查是否有 noindex 或 crawl 错误
- **负责**：NeFi（通过 GSC API 或手动检查）
- **预计耗时**：1 小时

---

## 🟡 P1 — 短期（1-3 周）

### T7. 优化书籍页 H1 标签
- **问题**：Site Audit 报告 1 个页面缺少 H1
- **行动**：
  1. 排查哪个页面缺 H1
  2. 确保所有书籍页 H1 格式为 `{书名}` 或 `{书名} Summary`
  3. 确保 H1 包含目标关键词
- **负责**：ge.ovh Claude Code
- **预计耗时**：1 小时

### T8. 增强内部链接网络
- **问题**：Site Audit 报告有页面只有 1 个内部链接，内链不足
- **行动**：
  1. 书籍页底部 "You Might Also Like" 改为基于关键词相关性推荐（不只是同 category）
  2. 书籍页添加 "More by {Author}" 区块，链接到同作者其他书
  3. 作者页确保列出所有书籍并内链
  4. 书单页每本书都链接到书籍详情页
  5. 首页/分类页增加热门书籍内链
- **负责**：ge.ovh Claude Code
- **预计耗时**：4 小时

### T9. 作者页 SEO 增强
- **问题**：作者页内容太薄，只有书籍列表
- **行动**：
  1. 添加作者简介（从 generated_books 的 author_bio 字段提取或生成）
  2. Title 格式：`Books by {Author} - Complete List & Summaries | Fizz Moment`
  3. Meta description 包含作者名 + 书籍数量 + "summary" 关键词
  4. 添加 Person schema（JSON-LD）
  5. 目标关键词：`{author name} books`（竞品数据显示这类词有排名）
- **负责**：ge.ovh Claude Code
- **预计耗时**：3 小时

### T10. 书单页 SEO 增强
- **问题**：书单页缺少针对性的 SEO 优化
- **行动**：
  1. Title 格式：`{Celebrity}'s Top Book Picks - Must-Read Recommendations | Fizz Moment`
  2. Meta description 包含名人名 + 书籍数量 + "book recommendations"
  3. 添加 ItemList schema（JSON-LD）
  4. 页面增加简短介绍段落（为什么这个名人的书单值得关注）
  5. 目标关键词：`{celebrity name} book recommendations`、`{celebrity name} reading list`
- **负责**：ge.ovh Claude Code
- **预计耗时**：3 小时

### T11. 分类页 SEO 增强
- **问题**：分类页可以覆盖 "best {category} books" 类关键词
- **行动**：
  1. Title 格式：`Best {Category} Books - Top Summaries & Reviews | Fizz Moment`
  2. 添加分类描述段落
  3. 添加 ItemList schema
  4. 目标关键词：`best {category} books`、`top {category} books`
- **负责**：ge.ovh Claude Code
- **预计耗时**：2 小时

### T12. 创建 "Books Like X" 页面类型（新功能）
- **问题**：竞品 meetnewbooks.com 靠 "books like {title}" 关键词获取流量
- **行动**：
  1. 新建路由 `/moment/similar/{slug}`
  2. 基于同 category + 同作者 + 相关标签推荐相似书籍
  3. Title：`Books Like {Title} - Similar Reads & Recommendations | Fizz Moment`
  4. 目标关键词：`books like {title}`、`books similar to {title}`
  5. 先为 Top 50 热门书籍创建
- **负责**：ge.ovh Claude Code
- **预计耗时**：6 小时
- **优先级说明**：这是新页面类型，可以后排

---

## 🟢 P2 — 中期（1-3 个月）

### T13. 创建 "Best Books" 博客内容
- **问题**：blinkist 靠 /magazine/ 博客获取大量流量，我们没有博客
- **行动**：
  1. 新建路由 `/moment/blog/{slug}`
  2. 先创建 10 篇高价值文章：
     - "Best Self-Help Books of 2026"
     - "Best Psychology Books for Beginners"
     - "Best Leadership Books for Managers"
     - "Best Finance Books for Young Adults"
     - "Best Productivity Books to Read This Year"
     - "Atomic Habits vs The Power of Habit - Which is Better?"
     - "10 Books That Will Change Your Life"
     - "Best Books About Habits and Behavior Change"
     - "Best Books for Personal Development"
     - "Top Audiobooks Worth Listening To"
  3. 每篇 800-1,500 字，包含书籍内链
  4. 目标关键词来自竞品数据：`best leadership books`(3.6K搜索量)、`self help books`(33.1K)、`motivational books`(3.6K) 等
- **负责**：ge.ovh Claude Code + NeFi 审核
- **预计耗时**：每篇 2 小时，共 20 小时

### T14. 外链建设
- **问题**：AS=2，48 个引荐域名几乎全是垃圾
- **行动**：
  1. Product Hunt 发布 FizzRead
  2. Reddit r/books、r/booksuggestions 参与讨论（自然提及）
  3. 创建可链接资产：年度最佳书籍信息图
  4. 联系 5-10 个书评博客做 Guest Post
  5. 在 Medium 发布 3-5 篇书籍相关文章
- **负责**：主人决策 + NeFi 执行
- **预计耗时**：持续进行

### T15. AI 搜索优化
- **问题**：AI 可见度 = 0，竞品 befreed=19，blinkist=33
- **行动**：
  1. 确保 llms.txt 格式正确
  2. 在 Reddit/Medium 建立品牌存在感（AI 引用主要来源）
  3. 添加 FAQ schema 到所有页面类型（已有书籍页，扩展到作者/书单/分类页）
  4. 内容结构化：清晰的 H2/H3 层级，便于 AI 引用
- **负责**：ge.ovh Claude Code + NeFi
- **预计耗时**：持续进行

---

## 🔵 P3 — 长期（3-6 个月）

### T16. 国际化 SEO
- 添加西班牙语、德语内容
- hreflang 标签

### T17. 品牌建设
- 建立 "FizzRead" 品牌搜索量
- 社交媒体运营
- 邮件列表

### T18. 内容持续扩展
- 每月新增 20 篇博客
- 每月新增 200+ 书籍页面（已在自动化中）

---

## 关键词优先级矩阵

基于竞品数据，按 ROI 排序的关键词类型：

| 优先级 | 关键词类型 | 示例 | 搜索量 | KD | 我们的页面 |
|--------|-----------|------|--------|-----|-----------|
| ⭐⭐⭐ | [书名] summary | atomic habits summary | 5.4K | 18 | ✅ 已有 741 个书籍页 |
| ⭐⭐⭐ | [书名] pdf | she comes first pdf | 1K | 13 | ✅ 已有（title 已包含 PDF） |
| ⭐⭐⭐ | [作者] books | james clear books | 中等 | 低 | ✅ 已有 718 个作者页 |
| ⭐⭐ | best [类别] books | best leadership books | 3.6K | 42 | ❌ 需要博客/分类页优化 |
| ⭐⭐ | book summary / book summaries | book summaries | 4.4K | 76 | ⚠️ 首页可优化 |
| ⭐⭐ | [名人] book recommendations | bill gates books | 中等 | 低 | ✅ 已有 41 个书单页 |
| ⭐ | books like [书名] | books like atomic habits | 低 | 低 | ❌ 需要新页面类型 |
| ⭐ | [书名] review | atomic habits review | 中等 | 中等 | ⚠️ 可在现有页面优化 |
| ⭐ | book recommendations | book recommendations | 301K | 84 | ❌ 竞争太大，长期目标 |

---

## 执行顺序建议

**第 1 周**：T1(Disavow) → T2(作者title) → T3(书单title) → T4(robots.txt) → T5(llms.txt) → T6(索引检查)
**第 2 周**：T7(H1修复) → T8(内链) → T9(作者页增强) → T10(书单页增强)
**第 3 周**：T11(分类页增强) → T13 开始写博客
**第 4 周+**：T12(Similar Books) → T13 继续 → T14(外链) → T15(AI优化)

---

## 数据基线（2026-02-16）

| 指标 | 当前值 | 3 个月目标 |
|------|--------|-----------|
| Authority Score | 2 | 8-12 |
| 自然关键词 (US) | 0 | 500-1,000 |
| 月自然流量 | 0 | 200-500 |
| 已索引页面 | 待确认 | 1,500+ |
| 引荐域名（有效） | ~3 | 50+ |
| AI 可见度 | 0 | 5+ |

---

*参考竞品：befreed.ai (AS=25, 15.6K 关键词, 6.4K 月流量) — 这是 12 个月后的合理目标。*
