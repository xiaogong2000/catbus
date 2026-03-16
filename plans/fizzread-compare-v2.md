# FizzRead Compare V2 升级方案

## 目标
1. 新增 50 组高质量书籍对比
2. 用 AI 生成深度对比内容（替代模板拼接）
3. 升级前端展示，增加内容模块

## 一、新增 50 组配对策略

### 选对原则
- 同分类热门书对比（读者最常纠结的选择）
- 跨分类经典碰撞（有话题性）
- 避免与现有 47 组重复
- 优先选有 Google 搜索需求的配对（"X vs Y book"）

### 50 组配对清单

#### Psychology & Neuroscience (8组)
1. thinking-fast-and-slow vs predictably-irrational
2. the-power-of-habit vs nudge
3. quiet vs susan-cain (→ quiet vs introvert-advantage 如果有)
4. flow vs deep-work (跨分类)
5. thinking-fast-and-slow vs blink
6. the-body-keeps-the-score vs the-gift-of-therapy
7. mindset vs peak
8. influence vs pre-suasion

#### Business & Entrepreneurship (8组)
9. good-to-great vs built-to-last
10. the-lean-startup vs the-hard-thing-about-hard-things
11. rework vs it-doesnt-have-to-be-crazy-at-work
12. shoe-dog vs the-everything-store
13. zero-to-one vs blue-ocean-strategy
14. the-innovators-dilemma vs crossing-the-chasm
15. principles vs measure-what-matters
16. from-good-to-great vs the-five-dysfunctions-of-a-team

#### Finance & Economics (6组)
17. rich-dad-poor-dad vs the-millionaire-next-door
18. the-intelligent-investor vs a-random-walk-down-wall-street
19. thinking-fast-and-slow vs freakonomics
20. the-psychology-of-money vs rich-dad-poor-dad
21. sapiens vs guns-germs-and-steel
22. capital-in-the-twenty-first-century vs freakonomics

#### Leadership & Management (6组)
23. the-7-habits-of-highly-effective-people vs how-to-win-friends-and-influence-people
24. leaders-eat-last vs the-five-dysfunctions-of-a-team
25. radical-candor vs crucial-conversations
26. the-art-of-war vs the-prince
27. good-to-great vs the-toyota-way
28. drive vs multipliers

#### Self-Help & Personal Growth (6组)
29. the-subtle-art-of-not-giving-a-fck vs everything-is-fcked
30. the-power-of-now vs a-new-earth
31. the-alchemist vs siddhartha
32. ikigai vs the-book-of-joy
33. the-four-agreements vs the-untethered-soul
34. cant-hurt-me vs living-with-a-seal

#### Classics & Philosophy (6组)
35. meditations vs letters-from-a-stoic
36. 1984 vs brave-new-world
37. the-republic vs nicomachean-ethics
38. crime-and-punishment vs the-brothers-karamazov
39. to-kill-a-mockingbird vs the-great-gatsby
40. the-art-of-war vs the-book-of-five-rings

#### Science & Technology (5组)
41. sapiens vs homo-deus
42. a-brief-history-of-time vs the-elegant-universe
43. the-gene vs the-immortal-life-of-henrietta-lacks
44. ai-superpowers vs life-3-0
45. the-selfish-gene vs the-blind-watchmaker

#### Health & Wellness (5组)
46. why-we-sleep vs the-circadian-code
47. atomic-habits vs the-compound-effect
48. the-body-keeps-the-score vs complex-ptsd
49. how-not-to-die vs the-china-study
50. breath vs the-oxygen-advantage

## 二、AI 生成脚本 generate-comparisons-v2.js

### 核心改动
- 调用 OpenAI API（gpt-4.1）生成内容，替代模板拼接
- 每组对比生成 2000-3000 词深度内容
- 新增字段：key_differences, reading_order, reader_profiles

### 数据库新增字段
```sql
ALTER TABLE comparisons ADD COLUMN key_differences TEXT;
ALTER TABLE comparisons ADD COLUMN reading_order TEXT;
ALTER TABLE comparisons ADD COLUMN reader_profiles TEXT;
```

### AI Prompt 模板
对每组对比，发送两本书的摘要内容给 AI，要求生成：

1. **comparison_data** (JSON array): 8-10 个对比维度，每个含 aspect/book1/book2/winner(optional)
2. **deep_analysis** (string): 800-1000 词深度分析，包含具体例子和论点对比
3. **faq_data** (JSON array): 5-7 个 FAQ，问题含长尾关键词
4. **verdict** (string): 200-300 词总结判断
5. **key_differences** (JSON array): 5-8 条核心差异，每条含 title + description
6. **reading_order** (string): 先读哪本的建议和理由
7. **reader_profiles** (JSON array): 3 种读者画像，每种含 profile + recommended_book + reason

### 执行流程
1. 先验证 50 组配对的 slug 在数据库中都存在
2. 不存在的跳过并记录
3. 每组调一次 AI API，解析返回的 JSON
4. 写入数据库
5. 支持 --dry-run 预览、--limit N 限制数量

## 三、前端升级 compare/[slug]/page.tsx

### 新增展示模块
1. **Key Differences** — 核心差异点列表，带图标
2. **Reading Order Guide** — 先读哪本的建议
3. **Who Should Read Which** — 3 种读者画像卡片
4. **对比表格升级** — 8-10 行，可选 winner 高亮

### 页面结构（从上到下）
1. Hero: 两本书封面 + 标题
2. Quick Verdict: 一句话结论
3. Comparison Table: 多维度对比（升级版）
4. Key Differences: 核心差异点
5. Deep Analysis: 深度分析（长文）
6. Who Should Read Which: 读者画像
7. Reading Order: 阅读顺序建议
8. FAQ: 5-7 个问题（Schema.org FAQPage）
9. Related Comparisons: 相关对比
10. CTA: 下载 FizzRead App

## 四、执行计划

1. 浣浣在 ge.ovh 开发 generate-comparisons-v2.js
2. 先跑 1 组测试，确认 AI 输出质量
3. 批量生成 50 组新对比
4. 回填升级现有 47 组（用 --upgrade 模式）
5. 升级前端 page.tsx
6. 部署到 fr.ovh 生产环境
