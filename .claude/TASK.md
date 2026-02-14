# TASK.md - 任务清单

> 所有 Claude Code 实例共享此文件。开始/完成任务时更新状态。
> 通过 `sudo sync-claude` 同步。认领任务后立即同步。

## 当前阶段: Phase 2 - 批量生产 + 内容扩展 🚀

---

## ✅ 已完成

- [x] SQLite 数据库初始化 + 94 本书种子导入 | fr.ovh | DONE
- [x] 数据层迁移: lib/db.ts + lib/api.ts + lib/types.ts | fr.ovh | DONE
- [x] 首页分页功能 (25本/页) | fr.ovh | DONE
- [x] BookCard 高度一致性修复 | fr.ovh | DONE
- [x] 书单索引页面 /moment/lists | fr.ovh | DONE
- [x] scripts/insert-book.js 本地插入脚本 | fr.ovh | DONE
- [x] scripts/process-books.js 批量处理脚本 (v1) | fr.ovh | DONE
- [x] scripts/submit-gsc.js GSC 提交脚本 | fr.ovh | DONE
- [x] n8n Workflow 1 全链路测试 + 激活 | fr.ovh | DONE
- [x] 开发环境搭建 (ge.ovh) | ge.ovh | DONE
- [x] sync-claude 双向同步机制 | 全部 | DONE
- [x] 多环境协作规范 ENV-GUIDE.md | 全部 | DONE
- [x] 西班牙语内容修复 (5本) | ge.ovh→fr.ovh | DONE
- [x] Favicon 修复 (/moment/favicon.ico) | fr.ovh+ge.ovh | DONE
- [x] GSC 批量提交 36 本已生成书籍 | fr.ovh | DONE
- [x] SEO 内容质量检查（英文、meta 格式）| ge.ovh | DONE
- [x] 书单扩充至 306 本 (竞品关键词提取 128 本新书) | NeFi | DONE
- [x] 数据修复: generated_books category 统一 + 9本 book_seeds 补录 | NeFi | DONE
- [x] 分类数据层: lib/categories.ts + api.ts 新增分类函数 | NeFi | DONE
- [x] 分类列表页 /moment/category/[slug] (4列×5行, 分页) | NeFi | DONE
- [x] 面包屑增强: 书籍页 4 级 (Home > Moment > Category > Book) | NeFi | DONE
- [x] BreadcrumbList JSON-LD 自动同步 4 级 | NeFi | DONE
- [x] 分类页 + 面包屑 生产部署完成 | NeFi | DONE
- [x] memory_search 配置 (Azure OpenAI text-embedding-3-small) | NeFi | DONE

---

## 🔴 P0 — 作者页 + Workflow 1.1 (当前优先)

> 目标：新增 /moment/author/[slug] 作者页，升级 process-books.js 自动采集作者数据。
> 在 ge.ovh 开发，测试通过后由 NeFi 协调部署到 fr.ovh。

### 任务 1: 升级 process-books.js → v1.1 | ge.ovh | TODO
- [ ] 从 Preview API 额外提取 `about_author` 字段
- [ ] 语言检测: 如果 about_author 非英文或太短(<50字)，调 Claude Haiku 生成英文版作者介绍
  - Haiku API: 用 Azure Claude 或 newcli-aws/claude-haiku-4-5-20251001
  - Prompt: 根据作者名 + 书名生成 2-3 段英文介绍 (150-300 words)
  - 包含: 作者背景、主要成就、写作风格、代表作品
- [ ] 处理完每本书后，检查 authors 表:
  - 作者不存在 → 插入新记录 (slug, name, bio, meta_title, meta_description, categories)
  - 作者已存在 → 更新 total_books 计数和 categories
- [ ] author slug 生成规则: 名字小写 + 连字符 (如 "James Clear" → "james-clear")
- [ ] authors 表 content JSON 结构:
  ```json
  {
    "bio": "2-3 段英文介绍",
    "short_bio": "1 句话简介 (用于列表页)",
    "source": "api" | "ai_generated"
  }
  ```
- [ ] 同一作者多本书时，bio 只生成一次（检查 authors 表是否已有）
- [ ] 错误处理: Haiku API 失败时 fallback 到 API 原文（即使非英文）

### 任务 2: 回填现有 36 本书的作者数据 | ge.ovh | TODO
- [ ] 创建 `scripts/backfill-authors.js`
- [ ] 遍历 generated_books 所有已完成的书
- [ ] 用 book_id 调 Preview API 获取 about_author
- [ ] 非英文/太短 → Claude Haiku 生成
- [ ] 写入 authors 表
- [ ] 去重: 同一作者只处理一次
- [ ] 输出: 处理了多少作者，成功/失败数

### 任务 3: 作者数据层 | ge.ovh | TODO
- [ ] lib/api.ts 新增函数:
  - `getAllAuthors()` — 返回所有作者 (slug, name, total_books, short_bio)
  - `getAuthorBySlug(slug)` — 获取单个作者详情 + 该作者所有书
  - `getAuthorSlugsWithBooks()` — 用于 generateStaticParams
- [ ] 数据来源: authors 表 + generated_books 表 JOIN

### 任务 4: 作者详情页 /moment/author/[slug] | ge.ovh | TODO
- [ ] 新建 `app/moment/author/[slug]/page.tsx`
- [ ] 页面结构 (参考设计稿):
  - 面包屑: Home > Moment > Authors > {Author Name}
  - 作者头像 (首字母圆形)
  - H1: {Author Name}
  - 统计: X books on Fizz Moment · ~Y min total read
  - 短简介 (1-2句)
  - "Books by {Author}" — BookCard grid (4列)
  - "About {Author}" — 完整 bio (2-3段)
  - CTA: Download FizzRead App
- [ ] SEO metadata:
  - title: "Books by {Author Name} | Fizz Moment"
  - description: 动态生成
  - canonical: /moment/author/{slug}
- [ ] JSON-LD: Person schema + BreadcrumbList (4级)
- [ ] generateStaticParams: 预生成所有有书的作者页

### 任务 5: 作者索引页 /moment/authors (可选) | ge.ovh | TODO
- [ ] 所有作者列表页，按书籍数量排序
- [ ] 每个作者卡片: 头像 + 名字 + 书籍数 + 短简介

### 任务 6: 书籍页增加作者链接 | ge.ovh | TODO
- [ ] 书籍详情页的作者名改为链接，指向 /moment/author/{slug}
- [ ] 增强内链网络

### 任务 7: 测试 + 部署 | ge.ovh → fr.ovh | TODO
- [ ] ge.ovh 本地测试: 作者页渲染、面包屑、分页
- [ ] 回填脚本测试通过
- [ ] process-books.js v1.1 测试: 新书自动写入 authors 表
- [ ] SEO 检查: canonical、JSON-LD、meta
- [ ] 通知 NeFi 部署到生产

---

## ⏸ 暂缓 — AI 内容增强 (process-books-v2.js)

> 当前导入内容已是 AI 生成，质量够用。后续如需进一步优化再启动。

## 🟡 P1 — 并行任务

- [ ] 名人书单页 (Gap 1) | ge.ovh | TODO
- [ ] Core Web Vitals 审计 (Gap 9) | 待分配 | TODO
- [ ] 反向链接建设 (Gap 10) | 待分配 | TODO
- [ ] 内链网络 (Gap 7) | ge.ovh | TODO
- [ ] Lighthouse SEO ≥ 95 | 待分配 | TODO
- [ ] 分类索引入口 | ge.ovh | TODO

## 🟢 P2 — 后续迭代

- [ ] 主题聚合页自动生成
- [ ] 独立语录页 /moment/quotes/[slug]
- [ ] Workflow 2 作者聚合 (已被 Workflow 1.1 替代)
- [ ] Workflow 3 名人书单

---

## n8n Workflow 1 状态

- ID: SSRrZsmY1KanSY6K
- 状态: **active** ✅
- 触发: webhook + OpenClaw cron 每天 02:00 UTC+8
- 批量: 20 本/天
- GSC: ✅ 自动提交
- 进度: 36/306 已完成，280 pending，预计 14 天跑完
- **升级计划: v1.1 加入作者数据采集**

---

## 开发分工

- ge.ovh Claude Code (`/home/debian/.local/bin/claude`) → 写代码、测试
- NeFi → 下发任务（TASK.md）、审核结果、协调部署到 fr.ovh
- 开发在 ge.ovh，生产在 fr.ovh，严格隔离

---

## 快速命令

```bash
# 查看生产进度
sqlite3 /data/fizzread-seo.db "SELECT status, COUNT(*) FROM book_seeds GROUP BY status"

# 查看分类分布
sqlite3 /data/fizzread-seo.db "SELECT category, COUNT(*) FROM generated_books GROUP BY category ORDER BY COUNT(*) DESC"

# 查看作者数据
sqlite3 /data/fizzread-seo.db "SELECT name, total_books FROM authors ORDER BY total_books DESC"

# 手动处理
sudo bash -c 'cd /root/projects/fizzread-seo && node scripts/process-books.js --limit 3'

# 手动构建
sudo bash -c 'cd /root/projects/fizzread-seo && npm run build && /root/.npm/_npx/5f7878ce38f1eb13/node_modules/pm2/bin/pm2 restart fizzread-seo'

# 手动提交 GSC
sudo bash -c 'cd /root/projects/fizzread-seo && node scripts/submit-gsc.js slug1 slug2'

# 同步协作文件
sudo sync-claude
```
