# CatBus Skill 触发词映射表

> 用户说了什么 → 匹配到哪个 skill name → relay 筛选有这个 skill 的节点
> 共 110 个 Call 类 Skill（查询 + 生成 + 爬虫）

---

## 一、查询类（~60 个）

### 🔍 搜索与研究

| Skill Name | 触发词（中文） | 触发词（英文） |
|-----------|---------------|---------------|
| web-search | 搜索, 搜一下, 查一下, 查查, 找一下, 上网查, 网上搜, 帮我搜 | search, look up, find, google |
| google-search | 谷歌搜索, google一下 | google search |
| bing-search | 必应搜索 | bing search |
| news-search | 新闻, 最新消息, 最近发生, 今天的新闻, 热点, 头条 | news, latest, headlines, what happened |
| academic-search | 论文, 学术, 文献, 研究, 期刊, 学术搜索 | paper, academic, research, journal, scholar |
| arxiv-search | arxiv, 预印本, 最新论文 | arxiv, preprint |
| reddit-search | reddit, 红迪 | reddit |
| youtube-search | youtube视频, 油管, 找个视频 | youtube, find video |
| patent-search | 专利, 专利搜索, 发明 | patent |
| deep-research | 深度研究, 帮我研究, 详细调研, 全面分析 | deep research, investigate, thorough analysis |
| fact-check | 事实核查, 这是真的吗, 验证一下 | fact check, verify, is it true |
| company-lookup | 公司信息, 这家公司, 企业查询 | company info, company lookup |
| product-hunt | producthunt, 新产品, 最新产品 | product hunt, new product |
| tech-news-digest | 科技新闻, 技术动态, tech新闻 | tech news, tech digest |
| hacker-news | hackernews, HN热帖 | hacker news, HN |

### 🗺️ 地图与位置

| Skill Name | 触发词（中文） | 触发词（英文） |
|-----------|---------------|---------------|
| weather-current | 天气, 今天天气, 现在天气, 多少度, 下雨吗, 气温 | weather, temperature, raining |
| weather-forecast | 天气预报, 明天天气, 这周天气, 未来几天天气 | forecast, weather tomorrow, weather this week |
| geocode | 地址转坐标, 经纬度 | geocode, coordinates |
| reverse-geocode | 坐标转地址, 这个位置在哪 | reverse geocode |
| route-planner | 路线, 怎么走, 导航, 路线规划 | route, directions, how to get to |
| flight-tracker | 航班, 飞机, 航班状态, 航班追踪 | flight, flight status, flight track |
| public-transit | 公交, 地铁, 公共交通, 怎么坐车 | bus, metro, transit, public transport |
| earthquake-monitor | 地震, 震级 | earthquake |
| air-quality | 空气质量, PM2.5, AQI, 雾霾 | air quality, PM2.5, AQI, smog |

### 💰 金融与商业

| Skill Name | 触发词（中文） | 触发词（英文） |
|-----------|---------------|---------------|
| stock-price | 股价, 股票, 多少钱一股, 涨了吗, 跌了吗 | stock price, share price, stock |
| stock-chart | K线, 股票图, 走势图 | stock chart, candlestick |
| stock-analysis | 股票分析, 技术分析 | stock analysis, technical analysis |
| crypto-price | 比特币, 以太坊, 币价, 加密货币, 虚拟货币 | bitcoin, ethereum, crypto, BTC, ETH |
| exchange-rate | 汇率, 美元兑人民币, 换算, 外汇 | exchange rate, USD to CNY, forex, currency |
| sec-filings | SEC, 财报, 10-K, 10-Q | SEC filing, annual report, 10-K |
| company-financials | 财务数据, 营收, 利润, 财务报表 | financials, revenue, earnings, income |
| market-news | 市场新闻, 财经新闻, 市场动态 | market news, financial news |

### 🛒 电商与营销

| Skill Name | 触发词（中文） | 触发词（英文） |
|-----------|---------------|---------------|
| seo-analyzer | SEO, 搜索引擎优化, 网站SEO分析 | SEO, search engine optimization |
| keyword-research | 关键词, 关键词研究, 热搜词 | keyword, keyword research |
| price-tracker | 价格追踪, 比价, 降价了吗 | price track, price compare, price drop |
| review-analyzer | 评价分析, 用户评论, 口碑 | review analysis, user reviews |
| competitor-monitor | 竞品分析, 竞争对手 | competitor analysis |
| lead-generator | 潜在客户, 获客 | lead generation |

### 💻 开发相关查询

| Skill Name | 触发词（中文） | 触发词（英文） |
|-----------|---------------|---------------|
| npm-search | npm包, node模块 | npm package, npm search |
| pypi-search | pip包, python包 | pip package, pypi search |
| domain-whois | 域名信息, whois, 域名注册 | domain whois, domain info |
| ip-geolocation | IP地址, IP位置, IP归属地 | IP location, IP geolocation |
| vulnerability-scan | 漏洞扫描, 安全检查 | vulnerability scan, security scan |

### 🎮 娱乐查询

| Skill Name | 触发词（中文） | 触发词（英文） |
|-----------|---------------|---------------|
| movie-search | 电影, 影评, 评分, 上映 | movie, film, rating, IMDB |
| book-search | 书, 图书, 书评, 推荐本书 | book, book search, reading |
| game-deal-finder | 游戏打折, 游戏优惠, 游戏特价 | game deal, game sale, game discount |
| steam-stats | steam, 游戏在线人数 | steam stats |
| podcast-search | 播客, podcast推荐 | podcast search, podcast |
| spotify-control | spotify, 播放音乐 | spotify, play music |
| apple-music | apple music | apple music |

### 📐 科学查询

| Skill Name | 触发词（中文） | 触发词（英文） |
|-----------|---------------|---------------|
| language-dictionary | 词典, 单词, 释义, 怎么翻译 | dictionary, word meaning, definition |
| wolfram-query | 计算, wolfram, 数学问题 | wolfram, compute, calculate |
| arxiv-daily | 今日论文, 每日arxiv | daily papers, arxiv daily |

---

## 二、生成类（~35 个）

### 🤖 AI 文本生成

| Skill Name | 触发词（中文） | 触发词（英文） |
|-----------|---------------|---------------|
| text-rewrite | 改写, 润色, 重写, 换个说法 | rewrite, paraphrase, rephrase |
| text-summarize | 总结, 摘要, 概括, 太长了帮我总结 | summarize, summary, TLDR |
| text-translate | 翻译成, 用xx说, 帮我翻译 | translate to, translate into |
| text-classify | 分类, 归类, 这属于什么类别 | classify, categorize |
| sentiment-analysis | 情感分析, 正面还是负面, 评论情绪 | sentiment, positive or negative |
| text-embed | 向量化, embedding | embed, embedding, vectorize |
| grammar-check | 语法检查, 有没有语法错误 | grammar check, proofread |
| rag-query | 知识库问答, 基于文档回答 | RAG, knowledge base, ask document |
| embedding-search | 语义搜索, 相似内容 | semantic search, similar content |

### 🤖 AI 代码生成

| Skill Name | 触发词（中文） | 触发词（英文） |
|-----------|---------------|---------------|
| code-generate | 帮我写代码, 生成代码, 写个脚本 | generate code, write code, code |
| code-reviewer | 代码审查, review代码, 代码有问题吗 | code review, review my code |
| code-explainer | 解释这段代码, 这代码什么意思 | explain code, what does this code do |

### 🎨 AI 图片生成

| Skill Name | 触发词（中文） | 触发词（英文） |
|-----------|---------------|---------------|
| image-generate | 生成图片, 画一张, 帮我画, 生成一张图, AI画图 | generate image, create image, draw, AI art |
| image-edit | 编辑图片, 修改图片, P图, 抠图, 换背景 | edit image, modify image, inpaint |
| image-upscale | 放大图片, 提高分辨率, 图片变清晰, 超分 | upscale, enhance resolution, super resolution |
| image-remove-bg | 去背景, 抠图, 去除背景, 透明背景 | remove background, transparent background |
| image-describe | 描述这张图, 图片里有什么, 识别图片 | describe image, what's in this image |
| icon-search | 找图标, 搜图标 | icon search, find icon |
| stock-photo-search | 找图片, 免费图片, 素材图 | stock photo, free image, Unsplash |
| figma-export | 导出figma, figma设计稿 | figma export |

### 🎬 AI 音频生成

| Skill Name | 触发词（中文） | 触发词（英文） |
|-----------|---------------|---------------|
| tts-generate | 文字转语音, 朗读, 帮我读出来, 语音合成 | text to speech, TTS, read aloud |
| speech-to-text | 语音转文字, 听写, 语音识别, 转录 | speech to text, STT, transcribe, dictation |
| voice-clone | 克隆声音, 模仿声音, 用xx的声音说 | clone voice, voice clone |
| music-generate | 生成音乐, 作曲, 写首歌, AI音乐 | generate music, compose, AI music |
| audio-separate | 分离人声, 提取伴奏, 去人声 | separate vocals, extract vocals, remove vocals |
| video-generate-ai | 生成视频, AI视频 | generate video, AI video |

### 🛒 营销文案生成

| Skill Name | 触发词（中文） | 触发词（英文） |
|-----------|---------------|---------------|
| ad-copy-generator | 广告文案, 写个广告, 推广文案 | ad copy, advertising copy |
| product-description | 商品描述, 产品介绍 | product description |
| email-campaign | 营销邮件, 推广邮件 | email campaign, marketing email |
| landing-page-builder | 落地页, 着陆页 | landing page |
| newsletter-builder | 新闻简报, newsletter | newsletter |
| social-media-scheduler | 定时发布, 社交媒体排期 | schedule post, social media schedule |

### 📄 文档生成

| Skill Name | 触发词（中文） | 触发词（英文） |
|-----------|---------------|---------------|
| document-translate | 翻译文档, 翻译整个文件, 翻译PDF | translate document, translate file |
| pdf-ocr | OCR, 识别文字, 扫描识别, 图片转文字 | OCR, recognize text, scan |
| text-to-handwriting | 手写体, 手写字 | handwriting, handwritten |
| quiz-generator | 出题, 生成试卷, 测验 | generate quiz, make test |

---

## 三、爬虫类（~15 个）

| Skill Name | 触发词（中文） | 触发词（英文） |
|-----------|---------------|---------------|
| web-scraper | 抓取网页, 爬取, 爬虫 | scrape, crawl, extract from website |
| web-reader | 读取网页, 打开这个链接, 看看这个网页 | read webpage, open URL, fetch page |
| url-to-markdown | 网页转markdown, 保存网页 | URL to markdown, save webpage |
| url-to-screenshot | 网页截图, 截个图 | screenshot URL, capture page |
| firecrawl-scraper | 深度爬取, 爬整个网站 | deep crawl, crawl site |
| browser-automation | 自动化操作, 自动点击, 自动填写 | automate browser, auto click, auto fill |
| form-filler | 填表, 自动填表 | fill form, auto fill form |
| captcha-solver | 验证码, 识别验证码 | captcha, solve captcha |
| youtube-transcript | 视频字幕, 视频文稿, youtube文字版 | video transcript, youtube transcript, subtitles |
| podcast-transcribe | 播客转文字, 播客文稿 | podcast transcript |
| rss-to-json | RSS解析, 订阅源 | RSS parse, feed |

---

## 四、汇总：高频触发词 Top 50

按用户日常使用频率排序，这些是最可能触发 CatBus 的词：

```
搜索/搜一下/查一下/找一下        → web-search
新闻/最新消息/头条               → news-search
天气/温度/下雨                   → weather-current
翻译/翻译成                      → text-translate / document-translate
股价/股票                        → stock-price
汇率/换算                        → exchange-rate
比特币/币价                      → crypto-price
生成图片/画一张/AI画图            → image-generate
去背景/抠图                      → image-remove-bg
放大图片/变清晰                   → image-upscale
语音转文字/转录                   → speech-to-text
文字转语音/朗读                   → tts-generate
总结/摘要                        → text-summarize
改写/润色                        → text-rewrite
网页截图                         → url-to-screenshot
抓取网页/爬取                    → web-scraper
读取网页/打开链接                 → web-reader
视频字幕/youtube文稿              → youtube-transcript
论文/学术搜索                    → academic-search
SEO/搜索优化                     → seo-analyzer
路线/怎么走                      → route-planner
航班/飞机                        → flight-tracker
空气质量/PM2.5                   → air-quality
电影/影评                        → movie-search
词典/释义                        → language-dictionary
代码审查/review                  → code-reviewer
广告文案                         → ad-copy-generator
OCR/识别文字                     → pdf-ocr
生成音乐                         → music-generate
克隆声音                         → voice-clone
深度研究/详细调研                 → deep-research
事实核查/验证                    → fact-check
```

---

## 五、SKILL.md 使用方式

CatBus daemon 收到 TASK_OFFER 时的匹配逻辑：

```
1. 从 task 描述中提取关键词
2. 与上表的触发词匹配
3. 匹配到 skill name
4. 检查本节点是否注册了该 skill
5. 有 → BID（我能做）
6. 没有 → 沉默
```

relay 端粗筛逻辑：

```
1. 从 task 描述中提取关键词
2. 与触发词表匹配 → 得到候选 skill name 列表
3. 查哪些在线节点注册了这些 skill
4. 只推送 TASK_OFFER 给这些节点
```
