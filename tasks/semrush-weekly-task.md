# FizzRead SEMrush 每周完整分析任务（8 阶段 SOP）

> 每周五 05:00 自动执行，结果发送至 Telegram
> 参考模板：exports/fizzread-seo-strategy-report-2026-03-07.md（首次完整版）

使用 browser 工具（profile="openclaw"）通过 moptools 代理访问 SEMrush。每页等 2-3 秒后 evaluate(document.body.innerText)。

核心域名：fizzread.ai
竞品：befreed.ai / blinkist.com / shortform.com / makeheadway.com

---

## 阶段一：竞品基准对比（Domain Overview）

依次访问，提取 Authority Score、自然流量、关键词数、反链数：
- https://semrushbusiness.moptools.com/analytics/overview/?q=fizzread.ai&searchType=domain
- https://semrushbusiness.moptools.com/analytics/overview/?q=blinkist.com&searchType=domain
- https://semrushbusiness.moptools.com/analytics/overview/?q=shortform.com&searchType=domain
- https://semrushbusiness.moptools.com/analytics/overview/?q=makeheadway.com&searchType=domain
- https://semrushbusiness.moptools.com/analytics/overview/?q=befreed.ai&searchType=domain

与上周数据对比（读取 exports/ 目录下最近一份 semrush-weekly-*.md）。

---

## 阶段二：关键词差距截流（Keyword Gap）

访问 https://semrushbusiness.moptools.com/gap/
输入 fizzread.ai vs blinkist.com vs shortform.com vs makeheadway.com vs befreed.ai

抓取：
- **Missing 标签**：竞品有排名、fizzread 完全没有 → 筛选量>1K、KD<40
- **Weak 标签**：双方都有但 fizzread 弱 → 记录可优化词

---

## 阶段三：Quick Wins（Positions 2-30）

访问 https://semrushbusiness.moptools.com/analytics/organic/positions/?q=fizzread.ai&searchType=domain
按排名排序，提取全部关键词（词 + 排名 + Vol + KD + 与上周变化）。

动态筛选本周 TOP 5 机会词（三类标准）：

**A. 临界词（pos 11-30，量>500，KD<50）**
→ 距离首页最近，优化收益最大

**B. 内容空白词（竞品≥2家有，fizzread 没有，量>1K，KD<40）**
→ 写一篇直接抢流量

**C. KD 窗口词（对比上周 KD 下降>5）**
→ 竞争减弱，冲排名最佳时机

---

## 阶段四：关键词魔法工具（低难度 C/T 意图词）

依次访问，抓 innerText：
1. https://semrushbusiness.moptools.com/analytics/keywordmagic/?q=book+summary+app&db=us
2. https://semrushbusiness.moptools.com/analytics/keywordmagic/?q=book+summary&db=us
3. https://semrushbusiness.moptools.com/analytics/keywordmagic/?q=blinkist+alternative&db=us

从每个页面筛选：意图为 C 或 T + KD < 30 的词，提取 Top 10。

---

## 阶段五：竞品 Top 关键词对比（含 KD）

依次抓各竞品本周 Top 15 关键词：
- https://semrushbusiness.moptools.com/analytics/organic/positions/?q=blinkist.com&searchType=domain
- https://semrushbusiness.moptools.com/analytics/organic/positions/?q=shortform.com&searchType=domain
- https://semrushbusiness.moptools.com/analytics/organic/positions/?q=makeheadway.com&searchType=domain
- https://semrushbusiness.moptools.com/analytics/organic/positions/?q=befreed.ai&searchType=domain

每家提取：关键词 + 排名 + Vol + KD + 类型（书摘/作者/App词/名人词）。

---

## 阶段六：技术体检（Site Audit）

访问 https://semrushbusiness.moptools.com/siteaudit/
查看 fizzread.ai 的健康分数 + 错误列表（重复 Meta/Title、死链、4xx）。
如无项目或需要创建，在报告中注明。

---

## 阶段七：反向链接分析

### 7A：Backlink Gap（外链挖角）
访问 https://semrushbusiness.moptools.com/analytics/backlinks/gap/
输入 fizzread.ai vs blinkist.com vs shortform.com
找高 AS（>40）且链接了竞品但没链接 fizzread 的域名。

### 7B：Backlink Audit（毒性外链）
访问 https://semrushbusiness.moptools.com/seo/backlink-audit/
查看 fizzread.ai 整体毒性评分 + 高毒性域名列表。
如无项目，注明需要创建。

---

## 阶段八：AI 可见度（AEO）

访问 https://semrushbusiness.moptools.com/ai-visibility/
查看 fizzread.ai 在 ChatGPT / Google AI Overviews 的提及份额。
记录竞品被 AI 提及的话题，找出 fizzread 缺失的内容主题。
如需更高套餐，注明。

---

## 专项追踪（每周更新）

### books like X 系列（各抓 Vol + KD）
- https://semrushbusiness.moptools.com/analytics/overview/?q=books+like+verity&searchType=phrase
- https://semrushbusiness.moptools.com/analytics/overview/?q=books+like+the+alchemist&searchType=phrase
- https://semrushbusiness.moptools.com/analytics/overview/?q=books+like+1984&searchType=phrase
- https://semrushbusiness.moptools.com/analytics/overview/?q=books+like+atomic+habits&searchType=phrase
- https://semrushbusiness.moptools.com/analytics/overview/?q=books+like+colleen+hoover&searchType=phrase

### 名人书单词
- https://semrushbusiness.moptools.com/analytics/overview/?q=elon+musk+book+recommendations&searchType=phrase
- https://semrushbusiness.moptools.com/analytics/overview/?q=bill+gates+book+recommendations&searchType=phrase
- https://semrushbusiness.moptools.com/analytics/overview/?q=obama+book+list&searchType=phrase
- https://semrushbusiness.moptools.com/analytics/overview/?q=oprah+book+list&searchType=phrase

### App 品类词
- https://semrushbusiness.moptools.com/analytics/overview/?q=book+summary+app&searchType=phrase
- https://semrushbusiness.moptools.com/analytics/overview/?q=best+book+summary+app&searchType=phrase
- https://semrushbusiness.moptools.com/analytics/overview/?q=blinkist+alternative&searchType=phrase
- https://semrushbusiness.moptools.com/analytics/overview/?q=apps+like+blinkist&searchType=phrase
- https://semrushbusiness.moptools.com/analytics/overview/?q=free+book+summaries&searchType=phrase

---

## 报告生成

路径：`/Users/tangpeng/.openclaw/workspace/exports/semrush-weekly-YYYY-MM-DD.md`（实际日期）

参考首次完整版 `fizzread-seo-strategy-report-2026-03-07.md` 的结构：

```
# FizzRead SEMrush 周报 YYYY-MM-DD

## 执行摘要（5 条核心结论）

## 第一部分：现状诊断与技术修复清单
### 1.1 竞品流量变化（环比上周）
### 1.2 技术问题清单（Site Audit）
### 1.3 毒性外链预警

## 第二部分：竞品流量盲区截击
### 2.1 本周 Missing 词 Top 10（含 KD）
### 2.2 Weak 词（fizzread 排名弱于竞品）
### 2.3 Quick Wins：低KD C/T 意图词 Top 10

## 第三部分：fizzread.ai 关键词动态 + 机会矩阵
### 3.1 本周排名变化（新增↑ 上升↑ 下降↓）
### 3.2 本周 TOP 5 机会词（动态筛选）

## 第四部分：内容集群与外链机会
### 4.1 本周新发现的 books like X 词
### 4.2 名人书单词数据更新
### 4.3 外链挖角新目标（Backlink Gap）
### 4.4 AEO：AI 平台话题缺口更新

## 第五部分：页面模板优化建议
（结构性改进，改一次全站受益，3 条）

## 第六部分：本周 3 个具体行动
（优先级排序，每条含操作步骤 + 预期效果）
```

---

## 发送

1. 复制报告到 `~/.openclaw/media/`
2. message 工具发 Telegram（channel: telegram, target: 1149648904）：
   - 第一条：文字摘要（执行摘要 + TOP 5 机会词 + 本周 3 个行动）
   - 第二条：完整报告文件

## 注意事项
- 每页等 2-3 秒后再抓 innerText
- moptools 登录失效时摘要中注明
- 数字精确，不编造
- 与上周对比读取 exports/ 目录最近一份 semrush-weekly-*.md
- Site Audit / Backlink Audit / AI 可见度如需创建项目或升级套餐，如实注明，不跳过章节
