# FizzRead SEO 任务列表

> 基于 2026-02-27 SEO 分析报告（Ahrefs + Semrush 数据）
> 创建时间: 2026-02-27

## P0 — 紧急（本周）

### 1. Disavow 垃圾外链
- **状态**: ✅ 已完成（2026-02-27）— 45 个垃圾域名已提交 GSC Disavow，后补充 10 个（dsnylu/hzdlpq/bmwyng/qhtycw/sitescooponline/backlinker.shop/rankpilot.shop/rankyour.website/simplewebdirectory/alljobs.info）
- **原因**: 96% 引荐域名 AS 在 0-10，72% 来自新加坡，存在 PBN 特征，有被 Google 惩罚风险
- **操作**: 在 GSC 提交 Disavow 文件，拒绝以下域名：
  - PBN 网络: dsnylu.com, hzdlpq.com, kgzxkf.com, bmwyng.com, qhtycw.com, sitescooponline.com
  - SEO 垃圾站: backlinker.shop, rankpilot.shop, rankyour.website
  - 低质量目录: simplewebdirectory.com, getwebsiteworth.com, alljobs.info, tunca.org
- **负责**: 主人（需 GSC 权限）

### 2. 优化排名最好的对比页
- **状态**: ✅ 已完成（2026-02-27）— Compare V2 升级，内容量 8-10x，新增 Key Differences/Who Should Read/Reading Order 三模块
- **目标**: `atomic-habits-vs-power-of-habit` 排名 18→TOP 10
- **当前数据**: 关键词 "the power of habit vs atomic habits"，搜索量 50，KD 21
- **操作**:
  - 优化 title/meta description，包含精确匹配关键词
  - 增加内容深度（已完成 V2 升级，内容量 8-10x）
  - 增加内链从其他 book/author 页面指向此页
  - 添加 Schema.org 结构化数据
- **负责**: NeFi + 浣浣

### 3. Compare V2 生产部署
- **状态**: ✅ 已完成（2026-02-27）— 77 个对比页 dev 验证通过，浣浣完成生产部署
- **内容**: 77 个对比页，含 Key Differences / Who Should Read / Reading Order 三个新模块
- **注意**: 部署包必须排除 next.config.ts（dev 和 prod 配置不同）
- **操作**:
  - 只同步业务代码: types.ts, api.ts, page.tsx, scripts/
  - 单独处理数据库同步（dev 13MB vs prod 90MB，需合并而非覆盖）
  - 通过浣浣执行 build + PM2 restart
- **负责**: NeFi 打包 → 浣浣部署

## P1 — 高优先级（1-2 周）

### 4. 批量提交 GSC 索引
- **状态**: ⏳ 待执行
- **操作**:
  - 运行 `submit-gsc-comparisons.js --all` 提交 77 个 compare 页
  - 提交所有 book summary 页（1151 个）和 author 页到 GSC
  - 提交 /moment/comparisons 列表页
  - 加入 fr.ovh crontab 定期提交新页面
- **负责**: 浣浣（fr.ovh）

### 5. 注册产品目录站 & 外链建设（扩充版）
- **状态**: ⏳ 待执行
- **原因**: befreed.ai 在目录站有大量反链，fizzread.ai 在所有竞品引荐域名中反链数为 0，可快速复制
- **负责**: 主人（需产品信息和账号注册）

#### 第一批：必做（免费，高权威，1-2 天完成）

| # | 平台 | AS | 费用 | 竞品反链 | 说明 |
|---|------|-----|------|---------|------|
| 1 | alternativeto.net | 59 | 免费 | blinkist 1条, befreed 1条 | 标记为 Blinkist/Speechify/BeFreed 的替代品 |
| 2 | topai.tools | 38 | 免费 | befreed 541条 | AI 工具排行榜，befreed 反链最多的站 |
| 3 | webcatalog.io | 58 | 免费 | blinkist 51条, befreed 56条 | 提交 URL 自动生成页面，最省事 |
| 4 | theresanaiforthat.com | — | 免费 | — | 最大 AI 工具目录之一 |
| 5 | Product Hunt | 49 | 免费 | blinkist 19条, befreed 7条 | 做一次正式 Launch，多条外链 |
| 6 | saashub.com | 36 | 免费 | blinkist 255条 | 自动生成 vs 竞品对比页 |
| 7 | Crunchbase | 72 | 免费 | blinkist 2条, befreed 1条 | 注册公司 profile，AS 极高 |

#### 第二批：高优（免费，1 周内完成）

| # | 平台 | AS | 费用 | 说明 |
|---|------|-----|------|------|
| 8 | futurepedia.io | — | 免费 | AI 工具百科 |
| 9 | futuretools.io | — | 免费 | AI 工具目录 |
| 10 | G2.com | — | 免费 | 企业软件评测，用户评价越多权重越高 |
| 11 | Capterra.com | — | 免费 | 软件评测平台 |
| 12 | Softonic.com | 97 | 免费 | 老牌软件下载站，befreed 6条反链 |
| 13 | BetaList | — | 免费 | 新产品发布平台 |
| 14 | aitools.fyi | — | 免费 | AI 工具聚合 |
| 15 | aicollection.org | — | 免费 | GitHub AI 工具集合，提 PR 即可 |

#### 第三批：中优（部分付费）

| # | 平台 | AS | 费用 | 说明 |
|---|------|-----|------|------|
| 16 | toolify.ai | 42 | $99 | 6 条 dofollow 外链 + 多语言页面，48h 上架 |
| 17 | SaaSWorthy | — | 免费 | SaaS 评测对比站 |
| 18 | StartupStash | — | 免费 | 创业工具目录 |
| 19 | StackShare | — | 免费 | 技术栈分享平台 |
| 20 | Slant.co | — | 免费 | 产品推荐对比站 |
| 21 | IndieHackers | — | 免费 | 独立开发者社区，发产品故事 |

#### 第四批：长期内容平台（发文获取外链）

| # | 平台 | AS | 说明 |
|---|------|-----|------|
| 22 | Medium.com | 96 | blinkist 193条反链，发书籍相关文章 |
| 23 | Substack.com | 84 | blinkist 479条反链，创建 newsletter |
| 24 | Beehiiv.com | 51 | blinkist 1299条反链，newsletter 平台 |
| 25 | Dev.to | — | 发 AI TTS 技术文章 |
| 26 | HackerNews | 73 | Show HN 帖子，blinkist 19条反链 |
| 27 | Reddit | — | r/books, r/productivity, r/selfimprovement |
| 28 | Podscan.fm | 34 | 播客搜索引擎，blinkist 43条反链 |

### 7. 优化排名 20-50 位的高搜索量页面
- **状态**: ⏳ 待执行
- **重点 5 个页面**:
  - `/moment/author/mike-weinberg` — 排名 34，搜索量 4.4K（唯一带流量的词）
  - `/moment/author/ken-coleman` — 排名 48，搜索量 4.4K
  - `/moment/author/jack-campbell` — 排名 54，搜索量 1.9K
  - `/moment/the-mountain-is-you` — 排名 40，搜索量 720
  - `/moment/author/jeff-olson` — 排名 49，搜索量 880
- **操作**: 优化内容深度、meta 标签、内链结构
- **负责**: NeFi + 浣浣

## P2 — 中期（1-3 个月）

### 8. 扩充对比类内容至 150+
- **状态**: ⏳ 待执行
- **当前**: 77 个对比页
- **原因**: 对比类内容是排名最好的类型（排名 18-20），KD 低，转化率高
- **重点覆盖缺失的高搜索量关键词**:
  - the four agreements summary（5.4K）
  - let them theory summary（3.6K）
  - the great alone summary（2.9K，KD 仅 13）
  - elon musk books（2.4K）
  - the sovereign individual（2.4K）
- **负责**: NeFi 生成 → 浣浣部署

### 9. 内容平台外链建设
- **状态**: ⏳ 待执行
- **操作**:
  - Medium 发 3-5 篇书籍摘要/阅读方法文章，自然引用 fizzread.ai
  - Substack 创建 newsletter，定期推送书籍推荐
  - Reddit r/books、r/productivity、r/selfimprovement 参与讨论
  - Quora 回答书籍推荐相关问题
- **负责**: 主人（需人工发布，避免被判垃圾）

### 10. AI 可见度建设
- **状态**: ⏳ 待执行
- **当前**: AI 可见度 0，AI 提及 0 次
- **对标**: befreed.ai AI 可见度 18，511 次提及（Reddit 112、Medium 70、YouTube 69）
- **操作**:
  - 在 Reddit/Medium/YouTube 建立内容引用基础
  - 确保网站内容对 AI 爬虫友好（结构化数据、清晰层次）
  - 创建高质量、可被 AI 引用的书籍摘要内容
- **负责**: 主人 + NeFi

### 11. 创建竞品对比页
- **状态**: ⏳ 待执行
- **操作**:
  - fizzread vs blinkist（截取竞品品牌流量）
  - fizzread vs befreed
  - fizzread vs speechify
  - fizzread vs naturalreader
- **负责**: NeFi 撰写 → 浣浣部署

## P3 — 长期（3-6 个月）

### 12. 主题权威性建设（Topic Authority）
- **状态**: ⏳ 待规划
- **问题**: 当前关键词全是作者名和书籍摘要，缺乏 "AI reading tool" 核心主题
- **操作**:
  - 创建核心页面: AI Book Summary Tool
  - 创建支撑文章集群，内链指向核心页
  - 建立 "book summary" + "AI reading" 双主题信号
- **负责**: NeFi 规划 → 浣浣执行

### 13. 高质量外链建设
- **状态**: ⏳ 待规划
- **操作**:
  - 争取科技媒体报道（TechCrunch、The Verge）
  - 教育机构合作（无障碍阅读工具推荐）
  - 客座博客投稿（AI、EdTech 领域）
  - 目标: 每月新增 10-20 个高质量引用域名
- **负责**: 主人

### 14. 多语言 SEO
- **状态**: ⏳ 待规划
- **原因**: 中文书籍摘要是蓝海，blinkist 几乎没覆盖
- **操作**:
  - 实现 hreflang 标签
  - 创建中文版书籍摘要内容
  - 差异化切入多语言市场
- **负责**: 待定

---

## 6 个月目标

| 指标 | 当前值 | 目标 |
|------|--------|------|
| Authority Score / DR | AS 2 / DR 27 | AS 15+ / DR 40+ |
| 自然搜索流量 | 1/月 | 500+/月 |
| 自然关键词数（US） | 76 | 300+ |
| 反向链接 | 82 | 200+（高质量 50+） |
| 引用域名 | 58 | 150+（AS>10 占 30%+） |
| AI 可见度 | 0 | 15+ |
| 对比类内容页面 | 77 | 150+ |
| TOP 10 关键词数 | 0 | 5+ |

---

## 数据来源
- Ahrefs 免费工具 + Semrush 镜像站（sem.seogroup.club）
- 采集时间: 2026-02-27 07:40-08:55 CST
- 完整报告: `docs/fizzread-seo-report-2026-02-27.md`
