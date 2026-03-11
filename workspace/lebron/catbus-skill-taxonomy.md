# CatBus Skill 分类体系

> 数据来源：ClawHub（13,000+ skills）、awesome-openclaw-skills（1,715 筛选后）、MCP 生态、LangChain Tools
> 原则：按用户使用场景分类，不按技术实现分类

---

## 总览

```
CatBus Skill Store
│
├── 📄 文档处理         Document Processing
├── 🔍 搜索与研究       Search & Research
├── 💻 开发工具         Developer Tools
├── 🛠️  开发流程         Development Workflow
├── 🌐 浏览器与爬虫     Browser & Scraping
├── 🤖 AI 模型与推理    AI Models & Inference
├── 🎨 图片与设计       Image & Design
├── 🎬 音视频处理       Audio & Video
├── ✍️  内容创作         Content Creation
├── 💬 通讯与社交       Communication & Social
├── 📊 数据与分析       Data & Analytics
├── 🏢 办公与协作       Productivity & Workspace
├── 📅 日历与日程       Calendar & Scheduling
├── 💰 金融与商业       Finance & Business
├── 🛒 电商与营销       E-commerce & Marketing
├── 🏠 智能家居与 IoT   Smart Home & IoT
├── ☁️  DevOps 与云     DevOps & Cloud
├── 🔒 安全与隐私       Security & Privacy
├── 🗺️  地图与位置      Location & Maps
├── 🏥 健康与生活       Health & Lifestyle
├── 🎮 游戏与娱乐       Gaming & Entertainment
├── 📐 科学与教育       Science & Education
├── 🧪 测试与质量       Testing & QA
├── 🎭 生成艺术         Generative Art
└── 🧩 系统工具         System Utilities
```

**25 个一级分类。** 下面逐一展开。

---

## 1. 📄 文档处理 Document Processing

> 日常使用频率最高的类别之一。大量 Skill 可以纯本地运行。

| Skill | 类型 | 说明 |
|-------|------|------|
| pdf-to-markdown | Install | PDF → Markdown（pandoc） |
| pdf-merge | Install | 合并多个 PDF |
| pdf-split | Install | 拆分 PDF 页面 |
| pdf-extract-table | Install | PDF 表格提取 |
| pdf-ocr | Install/Call | OCR 识别（本地 Tesseract 或远程商业引擎） |
| pdf-fill-form | Install | 填充 PDF 表单字段 |
| docx-to-markdown | Install | Word → Markdown |
| docx-to-pdf | Install | Word → PDF（LibreOffice） |
| markdown-to-docx | Install | Markdown → Word |
| markdown-to-pdf | Install | Markdown → PDF |
| html-to-markdown | Install | 网页 → Markdown |
| html-to-pdf | Install | 网页 → PDF |
| csv-to-excel | Install | CSV → Excel |
| excel-reader | Install | 读取 Excel 内容 |
| epub-reader | Install | 读取 EPUB 电子书 |
| pptx-builder | Install | 从 Markdown 生成 PPT |
| resume-builder | Install | 生成专业简历 |
| diff-documents | Install | 对比两个文档差异 |
| text-to-handwriting | Call | 文字转手写体图片 |
| document-translate | Call | 文档整篇翻译（保留格式） |

---

## 2. 🔍 搜索与研究 Search & Research

> ClawHub 上最大的类别（148 skills）。大部分需要 API Key，适合 Call 模式。

| Skill | 类型 | 说明 |
|-------|------|------|
| web-search | Call | 通用网页搜索（Tavily/Serper/SearXNG） |
| google-search | Call | Google 搜索 API |
| bing-search | Call | Bing 搜索 API |
| academic-search | Call | 学术论文搜索（arXiv/Semantic Scholar） |
| arxiv-search | Install | arXiv 论文检索与摘要 |
| wikipedia-search | Install | 维基百科查询 |
| news-search | Call | 实时新闻搜索 |
| hacker-news | Install | Hacker News 热帖获取 |
| reddit-search | Call | Reddit 搜索与内容获取 |
| youtube-search | Call | YouTube 视频搜索 |
| patent-search | Call | 专利检索 |
| domain-whois | Install | 域名 WHOIS 查询 |
| dns-lookup | Install | DNS 记录查询 |
| ip-geolocation | Call | IP 地理位置查询 |
| deep-research | Call | 多步深度研究（自动搜索+整合） |
| fact-check | Call | 事实核查 |
| company-lookup | Call | 公司信息查询（Crunchbase 等） |
| product-hunt | Call | Product Hunt 热门项目 |
| tech-news-digest | Call | 科技新闻聚合摘要 |
| rss-reader | Install | RSS/Atom 订阅读取 |

---

## 3. 💻 开发工具 Developer Tools

> 开发者最高频使用。ClawHub 上 Coding Agents（55）+ Git/GitHub（34）合计近 90 个。

| Skill | 类型 | 说明 |
|-------|------|------|
| code-formatter | Install | 代码格式化（多语言：Python/JS/Go/Rust） |
| code-linter | Install | 代码静态检查 |
| code-reviewer | Call | AI 代码审查 |
| code-explainer | Call | AI 代码解释 |
| regex-tester | Install | 正则表达式测试 |
| json-formatter | Install | JSON 美化/压缩/校验 |
| yaml-validator | Install | YAML 校验 |
| xml-to-json | Install | XML → JSON 互转 |
| base64-codec | Install | Base64 编解码 |
| hash-generator | Install | 文件/文本 Hash（MD5/SHA256） |
| jwt-decoder | Install | JWT Token 解析 |
| uuid-generator | Install | UUID 生成 |
| cron-parser | Install | Cron 表达式解释 |
| sql-formatter | Install | SQL 格式化 |
| api-tester | Install | HTTP API 测试（类 Postman） |
| mock-data-gen | Install | 生成测试假数据 |
| openapi-parser | Install | 解析 OpenAPI/Swagger 文档 |
| git-log-analyzer | Install | Git 提交历史分析 |
| dependency-checker | Install | 检查过时依赖 |
| changelog-generator | Install | 从 Git 提交生成 Changelog |
| docker-compose-helper | Install | Docker Compose 生成与校验 |
| env-manager | Install | .env 文件管理 |
| port-scanner | Install | 端口扫描 |
| npm-search | Call | npm 包搜索与信息查询 |
| pypi-search | Call | PyPI 包搜索 |
| github-ops | Call | GitHub 操作（创建 Issue/PR/搜索） |
| gitlab-ops | Call | GitLab 操作 |

---

## 4. 🛠️ 开发流程 Development Workflow

> 从"写代码的工具"到"怎么写好代码的流程"。覆盖规划、开发、审查、发布全链路。

| Skill | 类型 | 说明 |
|-------|------|------|
| tdd-workflow | Install | 测试驱动开发流程（先写测试再写实现） |
| code-review-flow | Call | 结构化代码审查流程（PR 审查+反馈循环） |
| pr-review-toolkit | Call | PR 综合审查（类型设计/静默失败/注释质量多维度） |
| architecture-planner | Call | 软件架构规划与设计指导 |
| implementation-planner | Call | 多步骤实现计划生成与执行 |
| subagent-dispatcher | Call | 多 Agent 并行开发调度 |
| prompt-engineer | Install | LLM Prompt 编写与优化 |
| mcp-builder | Install | MCP Server 开发指南（FastMCP/TS SDK） |
| skill-creator | Install | Skill 开发模板与规范 |
| git-worktree-manager | Install | Git Worktree 隔离开发管理 |
| debug-workflow | Install | 系统化调试流程（根因分析+假设验证） |
| release-workflow | Install | 分支完成→合并/PR/清理发布流程 |

---

## 5. 🌐 浏览器与爬虫 Browser & Scraping

> ClawHub 上 69 个。核心是网页数据获取和浏览器自动化。

| Skill | 类型 | 说明 |
|-------|------|------|
| web-scraper | Call | 通用网页内容抓取 |
| url-to-markdown | Install | 网页 → 干净的 Markdown |
| url-to-screenshot | Call | 网页截图（需要浏览器） |
| web-reader | Call | 获取网页正文（去广告/导航） |
| link-extractor | Install | 提取页面所有链接 |
| meta-extractor | Install | 提取网页 meta 信息（标题/描述/OG） |
| sitemap-parser | Install | 解析网站 sitemap.xml |
| firecrawl-scraper | Call | Firecrawl 深度爬取 |
| browser-automation | Call | 浏览器自动化（Playwright/Puppeteer） |
| form-filler | Call | 自动填写网页表单 |
| captcha-solver | Call | 验证码识别（2Captcha 等） |
| cookie-manager | Install | 浏览器 Cookie 管理 |
| http-client | Install | HTTP 请求发送（curl 封装） |
| rss-to-json | Install | RSS 源解析为 JSON |

---

## 6. 🤖 AI 模型与推理 AI Models & Inference

> ClawHub 上 159 个（最大子类别之一）。大部分需要 API Key 或 GPU。

| Skill | 类型 | 说明 |
|-------|------|------|
| text-summarize | Install/Call | 文本摘要（本地小模型/远程大模型） |
| text-translate | Install/Call | 文本翻译 |
| text-classify | Install/Call | 文本分类 |
| sentiment-analysis | Install | 情感分析 |
| ner-extract | Install | 命名实体识别 |
| text-embed | Install/Call | 文本向量化（embedding） |
| text-rewrite | Call | 文本改写/润色 |
| grammar-check | Install/Call | 语法检查 |
| chat-llm | Call | 通用 LLM 对话（Claude/GPT/Llama） |
| code-generate | Call | AI 代码生成 |
| image-describe | Call | 图片描述（vision） |
| image-generate | Call | 图片生成（SD/FLUX/DALL-E） |
| image-edit | Call | AI 图片编辑（inpainting/outpainting） |
| image-upscale | Call | 图片超分辨率放大 |
| image-remove-bg | Call | 去除图片背景 |
| speech-to-text | Call | 语音转文字（Whisper） |
| text-to-speech | Call | 文字转语音 |
| video-generate | Call | 视频生成（Veo/Runway） |
| rag-query | Call | RAG 检索增强问答 |
| agent-orchestrate | Call | 多 Agent 协调编排 |
| embedding-search | Call | 向量语义搜索 |
| fine-tune-helper | Call | 模型微调辅助 |
| prompt-optimize | Install | Prompt 优化建议 |
| ollama-inference | Call | Ollama 本地模型推理 |

---

## 7. 🎨 图片与设计 Image & Design

> ClawHub 上 41 个。本地工具 + 远程 AI 生成混合。

| Skill | 类型 | 说明 |
|-------|------|------|
| image-compress | Install | 图片压缩 |
| image-resize | Install | 图片缩放/裁剪 |
| image-convert | Install | 图片格式转换（PNG/JPG/WebP/SVG） |
| image-to-base64 | Install | 图片 → Base64 |
| image-metadata | Install | 读取 EXIF/IPTC 元数据 |
| image-watermark | Install | 添加水印 |
| image-collage | Install | 拼接多图 |
| svg-optimizer | Install | SVG 文件优化 |
| favicon-generator | Install | 生成 favicon 全尺寸套装 |
| qrcode-generator | Install | 二维码生成 |
| barcode-generator | Install | 条形码生成 |
| color-palette | Install | 从图片提取配色方案 |
| icon-search | Call | 图标搜索（Iconify/Flaticon） |
| stock-photo-search | Call | 免费图库搜索（Unsplash/Pexels） |
| figma-export | Call | 导出 Figma 设计稿 |
| screenshot-beautify | Install | 截图美化（加边框/阴影/背景） |
| mermaid-renderer | Install | Mermaid 图表渲染为图片 |
| chart-generator | Install | 从数据生成图表图片 |
| 3d-model-viewer | Call | 3D 模型（STL）渲染预览 |
| coloring-page | Install | 照片转涂色页 |

---

## 8. 🎬 音视频处理 Audio & Video

> ClawHub 有 42（Media）+ 44（Speech），合计近 90 个。

| Skill | 类型 | 说明 |
|-------|------|------|
| video-compress | Install | 视频压缩（ffmpeg） |
| video-convert | Install | 视频格式转换 |
| video-trim | Install | 视频裁剪 |
| video-to-gif | Install | 视频 → GIF |
| video-extract-audio | Install | 从视频提取音频 |
| video-extract-frames | Install | 从视频提取帧 |
| video-add-subtitles | Install | 给视频添加字幕 |
| video-thumbnail | Install | 生成视频缩略图 |
| audio-convert | Install | 音频格式转换 |
| audio-trim | Install | 音频裁剪 |
| audio-merge | Install | 合并多段音频 |
| audio-normalize | Install | 音频音量标准化 |
| youtube-transcript | Call | 获取 YouTube 视频字幕/文稿 |
| youtube-download-info | Call | 获取 YouTube 视频信息 |
| podcast-transcribe | Call | 播客转文字 |
| tts-generate | Call | 高质量语音合成 |
| stt-transcribe | Call | 语音转文字（Whisper） |
| voice-clone | Call | 声音克隆 |
| music-generate | Call | AI 音乐生成 |
| audio-separate | Call | 音源分离（人声/伴奏） |
| video-generate-ai | Call | AI 视频生成 |
| screen-recorder | Install | 屏幕录制 |
| live-caption | Call | 实时字幕生成 |

---

## 9. ✍️ 内容创作 Content Creation

> 跨文档+设计的创作流程类 Skill。不是简单的格式转换，而是"从零创作内容"。

| Skill | 类型 | 说明 |
|-------|------|------|
| doc-coauthoring | Call | 协同文档写作流程（上下文传递+迭代润色+读者验证） |
| internal-comms | Install | 内部沟通写作（周报/状态更新/事故报告/FAQ 等模板） |
| frontend-design | Call | 前端界面设计与代码生成（高质量 UI，非模板套用） |
| web-artifacts-builder | Call | 多组件 Web 构件（React+Tailwind+shadcn/ui） |
| landing-page-creator | Call | 落地页/营销页快速生成 |
| email-template-designer | Install | 邮件模板设计与生成 |
| blog-post-writer | Call | 博客文章撰写（SEO 友好+结构化） |
| social-media-content | Call | 社交媒体内容生成（多平台适配） |
| brand-guidelines | Install | 品牌设计规范应用（色彩/字体/风格统一） |
| theme-factory | Install | 样式主题工厂（10+ 预设主题，可应用于任何制品） |
| copywriting | Call | 文案撰写（广告语/产品描述/标语） |
| technical-writing | Call | 技术文档撰写（API 文档/用户手册） |

---

## 10. 💬 通讯与社交 Communication & Social

> ClawHub 58 个。大部分需要账号和 Token。

| Skill | 类型 | 说明 |
|-------|------|------|
| email-send | Call | 发送邮件（SMTP/Gmail/Outlook） |
| email-read | Call | 读取邮件 |
| email-template | Install | 邮件模板生成 |
| slack-send | Call | 发送 Slack 消息 |
| slack-read | Call | 读取 Slack 频道 |
| discord-send | Call | 发送 Discord 消息 |
| telegram-send | Call | 发送 Telegram 消息 |
| telegram-bot | Call | Telegram Bot 操作 |
| whatsapp-send | Call | 发送 WhatsApp 消息 |
| wechat-ops | Call | 微信操作 |
| twitter-post | Call | 发推文/搜索 |
| twitter-read | Call | 读取 Twitter 内容 |
| linkedin-post | Call | 发 LinkedIn 动态 |
| linkedin-search | Call | LinkedIn 搜索 |
| threads-post | Call | 发 Threads 帖子 |
| reddit-post | Call | 发 Reddit 帖子 |
| xiaohongshu-post | Call | 小红书发帖 |
| sms-send | Call | 发送短信（Twilio） |
| push-notification | Call | 推送通知 |
| rss-publish | Install | 生成 RSS feed |

---

## 11. 📊 数据与分析 Data & Analytics

| Skill | 类型 | 说明 |
|-------|------|------|
| csv-analyzer | Install | CSV 统计分析 |
| csv-cleaner | Install | CSV 数据清洗 |
| csv-merge | Install | 合并多个 CSV |
| json-query | Install | JSON 数据查询（jq 封装） |
| sqlite-query | Install | SQLite 数据库查询 |
| postgres-query | Call | PostgreSQL 查询 |
| mysql-query | Call | MySQL 查询 |
| mongodb-query | Call | MongoDB 查询 |
| data-visualize | Install | 数据可视化（图表生成） |
| data-profiling | Install | 数据质量分析 |
| pivot-table | Install | 数据透视表 |
| statistics-calc | Install | 统计计算（均值/中位数/方差/回归） |
| web-analytics | Call | 网站分析（Google Analytics 等） |
| log-analyzer | Install | 日志文件分析 |
| etl-pipeline | Install | 简单 ETL 数据管道 |

---

## 12. 🏢 办公与协作 Productivity & Workspace

> ClawHub 93 个。主要是 SaaS 工具集成。

| Skill | 类型 | 说明 |
|-------|------|------|
| google-docs | Call | Google Docs 操作 |
| google-sheets | Call | Google Sheets 操作 |
| google-drive | Call | Google Drive 文件管理 |
| google-slides | Call | Google Slides 操作 |
| notion-ops | Call | Notion 页面/数据库操作 |
| airtable-ops | Call | Airtable 操作 |
| confluence-ops | Call | Confluence 知识库操作 |
| jira-ops | Call | Jira 任务管理 |
| linear-ops | Call | Linear 项目管理 |
| trello-ops | Call | Trello 看板操作 |
| asana-ops | Call | Asana 任务操作 |
| todoist-ops | Call | Todoist 待办事项 |
| obsidian-ops | Install | Obsidian 笔记操作 |
| apple-notes | Install | Apple Notes 操作 |
| apple-reminders | Install | Apple Reminders 操作 |
| bookmark-manager | Install | 书签管理 |
| clipboard-manager | Install | 剪贴板历史管理 |
| file-organizer | Install | 文件自动整理分类 |
| meeting-notes | Call | 会议纪要生成 |
| daily-report | Install | 每日工作报告生成 |

---

## 13. 📅 日历与日程 Calendar & Scheduling

> ClawHub 28 个。

| Skill | 类型 | 说明 |
|-------|------|------|
| google-calendar | Call | Google 日历操作 |
| apple-calendar | Install | Apple 日历操作 |
| outlook-calendar | Call | Outlook 日历操作 |
| scheduling-assistant | Call | 自动安排会议时间 |
| timezone-converter | Install | 时区转换 |
| pomodoro-timer | Install | 番茄钟定时 |
| habit-tracker | Install | 习惯追踪 |
| deadline-reminder | Install | 截止日期提醒 |

---

## 14. 💰 金融与商业 Finance & Business

> ClawHub 22 个。大部分需要付费数据源。

| Skill | 类型 | 说明 |
|-------|------|------|
| stock-price | Call | 实时股价查询 |
| stock-chart | Call | 股票 K 线图 |
| stock-analysis | Call | 股票技术分析 |
| crypto-price | Call | 加密货币价格 |
| exchange-rate | Call | 汇率查询 |
| sec-filings | Call | SEC 财报查询 |
| company-financials | Call | 公司财务数据 |
| invoice-generator | Install | 发票/报价单生成 |
| expense-tracker | Install | 费用记录 |
| tax-calculator | Install | 税务计算 |
| financial-report | Call | 财务报告生成 |
| market-news | Call | 市场新闻聚合 |

---

## 15. 🛒 电商与营销 E-commerce & Marketing

> ClawHub：Shopping（33）+ Marketing（94）= 127 个。

| Skill | 类型 | 说明 |
|-------|------|------|
| seo-analyzer | Call | SEO 分析 |
| keyword-research | Call | 关键词研究 |
| social-media-scheduler | Call | 社交媒体定时发布 |
| ad-copy-generator | Call | 广告文案生成 |
| email-campaign | Call | 邮件营销 |
| landing-page-builder | Call | 落地页生成 |
| product-description | Call | 商品描述生成 |
| price-tracker | Call | 商品价格追踪 |
| review-analyzer | Call | 用户评价分析 |
| competitor-monitor | Call | 竞品监控 |
| lead-generator | Call | 潜在客户获取 |
| crm-integration | Call | CRM 系统集成（HubSpot/Salesforce） |
| newsletter-builder | Call | 新闻简报生成 |
| affiliate-link | Call | 联盟链接管理 |
| shopify-ops | Call | Shopify 店铺操作 |

---

## 16. 🏠 智能家居与 IoT Smart Home & IoT

> ClawHub 50 个。

| Skill | 类型 | 说明 |
|-------|------|------|
| home-assistant | Call | Home Assistant 控制 |
| apple-homekit | Install | HomeKit 设备控制 |
| philips-hue | Call | Hue 灯光控制 |
| smart-plug | Call | 智能插座控制 |
| thermostat | Call | 温控器控制 |
| security-camera | Call | 安防摄像头 |
| robot-vacuum | Call | 扫地机器人控制 |
| energy-monitor | Call | 能耗监控 |
| 3d-printer | Call | 3D 打印机控制 |
| weather-station | Call | 气象站数据 |
| tailscale-network | Call | Tailscale 内网管理 |
| raspberry-pi | Call | 树莓派控制 |

---

## 17. ☁️ DevOps 与云 DevOps & Cloud

> ClawHub 最大类（144 个）。

| Skill | 类型 | 说明 |
|-------|------|------|
| aws-cli | Call | AWS 资源管理 |
| gcloud-cli | Call | Google Cloud 管理 |
| azure-cli | Call | Azure 管理 |
| docker-manage | Install | Docker 容器管理 |
| kubernetes-manage | Call | Kubernetes 集群管理 |
| terraform-helper | Install | Terraform IaC 辅助 |
| ansible-run | Call | Ansible 自动化 |
| nginx-config | Install | Nginx 配置生成 |
| ssl-cert-check | Install | SSL 证书检查 |
| cloudflare-ops | Call | Cloudflare 管理 |
| vercel-deploy | Call | Vercel 部署 |
| fly-deploy | Call | Fly.io 部署 |
| github-actions | Call | GitHub Actions 管理 |
| ci-cd-helper | Install | CI/CD 流程辅助 |
| server-monitor | Call | 服务器监控 |
| log-tail | Install | 日志实时查看 |
| uptime-monitor | Call | 网站可用性监控 |
| dns-manager | Call | DNS 记录管理 |
| backup-manager | Install | 备份管理 |
| proxmox-manage | Call | Proxmox 虚拟化管理 |

---

## 18. 🔒 安全与隐私 Security & Privacy

> ClawHub 21 个。

| Skill | 类型 | 说明 |
|-------|------|------|
| password-generator | Install | 强密码生成 |
| password-strength | Install | 密码强度检查 |
| hash-checker | Install | 文件完整性校验 |
| vulnerability-scan | Call | 安全漏洞扫描 |
| ssl-analyzer | Install | SSL/TLS 配置分析 |
| email-header-analyzer | Install | 邮件头分析（钓鱼检测） |
| privacy-policy-checker | Call | 隐私政策分析 |
| data-anonymizer | Install | 数据脱敏 |
| encryption-tool | Install | 文件加密/解密 |
| audit-log | Install | 审计日志管理 |
| security-headers | Install | HTTP 安全头检查 |

---

## 19. 🗺️ 地图与位置 Location & Maps

> ClawHub 56 个（Transportation 类）。

| Skill | 类型 | 说明 |
|-------|------|------|
| geocode | Call | 地址 → 经纬度 |
| reverse-geocode | Call | 经纬度 → 地址 |
| distance-calc | Install | 两点距离计算 |
| route-planner | Call | 路线规划 |
| weather-current | Call | 当前天气查询 |
| weather-forecast | Call | 天气预报 |
| timezone-by-location | Install | 根据位置查时区 |
| flight-tracker | Call | 航班追踪 |
| public-transit | Call | 公共交通查询 |
| earthquake-monitor | Call | 地震监测 |
| air-quality | Call | 空气质量查询 |
| sunrise-sunset | Install | 日出日落时间计算 |

---

## 20. 🏥 健康与生活 Health & Lifestyle

> ClawHub 35 个。

| Skill | 类型 | 说明 |
|-------|------|------|
| calorie-lookup | Install | 食物热量查询 |
| nutrition-calc | Install | 营养成分计算 |
| bmi-calculator | Install | BMI 计算 |
| unit-converter | Install | 单位换算（万能） |
| recipe-search | Call | 食谱搜索 |
| medication-reminder | Install | 服药提醒 |
| exercise-planner | Call | 运动计划生成 |
| sleep-tracker | Install | 睡眠追踪 |
| water-reminder | Install | 喝水提醒 |
| first-aid-guide | Install | 急救指南查询 |

---

## 21. 🎮 游戏与娱乐 Gaming & Entertainment

> ClawHub 7 个（最小类），但实际需求不少。

| Skill | 类型 | 说明 |
|-------|------|------|
| trivia-quiz | Install | 知识问答 |
| random-picker | Install | 随机选择器（抽签/掷骰子） |
| joke-generator | Install | 笑话生成 |
| movie-search | Call | 电影信息搜索（TMDB） |
| book-search | Call | 图书搜索（Google Books/OpenLibrary） |
| game-deal-finder | Call | 游戏折扣查询 |
| steam-stats | Call | Steam 游戏统计 |
| spotify-control | Call | Spotify 播放控制 |
| apple-music | Call | Apple Music 控制 |
| podcast-search | Call | 播客搜索 |

---

## 22. 📐 科学与教育 Science & Education

| Skill | 类型 | 说明 |
|-------|------|------|
| math-solver | Install | 数学计算（符号计算/微积分） |
| unit-converter-sci | Install | 科学单位换算 |
| periodic-table | Install | 化学元素周期表查询 |
| latex-renderer | Install | LaTeX 公式渲染为图片 |
| flashcard-maker | Install | 学习卡片生成 |
| language-dictionary | Call | 多语言词典查询 |
| thesaurus | Install | 同义词/反义词查询 |
| citation-formatter | Install | 参考文献格式化（APA/MLA/Chicago） |
| mind-map-generator | Install | 思维导图生成 |
| quiz-generator | Call | 从文本生成测验题 |
| arxiv-daily | Call | arXiv 每日论文推荐 |
| wolfram-query | Call | Wolfram Alpha 查询 |

---

## 23. 🧪 测试与质量 Testing & QA

> 覆盖从单元测试到端到端验证的质量保障全流程。

| Skill | 类型 | 说明 |
|-------|------|------|
| webapp-tester | Call | Web 应用端到端测试（Playwright 驱动） |
| api-test-runner | Install | API 自动化测试（请求→断言→报告） |
| unit-test-gen | Call | AI 自动生成单元测试 |
| coverage-reporter | Install | 代码覆盖率分析与报告 |
| load-tester | Install | 性能/压力测试（k6/wrk 封装） |
| accessibility-checker | Call | 网页无障碍检查（WCAG 标准） |
| visual-regression | Call | 视觉回归测试（截图对比） |
| mock-server | Install | 快速搭建 Mock API 服务 |
| contract-tester | Install | API 契约测试（Pact 封装） |
| test-data-factory | Install | 测试数据工厂（真实感假数据生成） |

---

## 24. 🎭 生成艺术 Generative Art

> 代码驱动的创意表达。算法艺术、动态图形、交互式可视化。

| Skill | 类型 | 说明 |
|-------|------|------|
| algorithmic-art | Install | p5.js 算法艺术生成（流场/粒子/分形） |
| generative-pattern | Install | 几何图案生成（瓷砖/万花筒/对称） |
| animated-gif-maker | Install | 动画 GIF 创作（Slack/社交媒体适配） |
| svg-art-generator | Install | SVG 矢量艺术生成 |
| ascii-art | Install | ASCII 字符画生成 |
| shader-playground | Install | GLSL Shader 编写与预览 |
| data-art | Install | 数据可视化艺术（信息即美学） |
| creative-coding | Install | Creative Coding 框架（Processing/openFrameworks） |
| pixel-art-maker | Install | 像素风格画制作 |
| coloring-book | Install | 线稿涂色页生成 |

---

## 25. 🧩 系统工具 System Utilities

> ClawHub CLI 类 88 个。多数可以 Install。

| Skill | 类型 | 说明 |
|-------|------|------|
| file-search | Install | 本地文件搜索 |
| file-rename-batch | Install | 批量重命名 |
| file-deduplicate | Install | 查找重复文件 |
| file-compress | Install | 文件压缩（zip/tar/gz） |
| file-decompress | Install | 文件解压 |
| disk-usage | Install | 磁盘空间分析 |
| system-info | Install | 系统信息获取 |
| process-monitor | Install | 进程监控 |
| network-speed | Install | 网速测试 |
| clipboard-to-file | Install | 剪贴板保存为文件 |
| text-diff | Install | 文本对比 |
| find-replace | Install | 文件内容批量查找替换 |
| cron-scheduler | Install | Cron 定时任务管理 |
| ssh-key-manager | Install | SSH 密钥管理 |
| dotfiles-sync | Install | 配置文件同步 |
| trash-cleaner | Install | 临时文件清理 |
| battery-status | Install | 电池状态查询 |
| screen-brightness | Install | 屏幕亮度调节 |
| caffeine | Install | 防止息屏 |
| calculator | Install | 计算器 |

---

## 统计

| 分类 | Install 为主 | Call 为主 | 混合 | 总数 |
|------|:-----------:|:--------:|:----:|:----:|
| 📄 文档处理 | 16 | 2 | 2 | 20 |
| 🔍 搜索与研究 | 4 | 14 | 2 | 20 |
| 💻 开发工具 | 21 | 6 | 0 | 27 |
| 🛠️ 开发流程 | 4 | 6 | 2 | 12 |
| 🌐 浏览器与爬虫 | 5 | 9 | 0 | 14 |
| 🤖 AI 模型与推理 | 3 | 17 | 4 | 24 |
| 🎨 图片与设计 | 15 | 4 | 1 | 20 |
| 🎬 音视频处理 | 12 | 11 | 0 | 23 |
| ✍️ 内容创作 | 3 | 7 | 2 | 12 |
| 💬 通讯与社交 | 2 | 17 | 1 | 20 |
| 📊 数据与分析 | 10 | 4 | 1 | 15 |
| 🏢 办公与协作 | 6 | 13 | 1 | 20 |
| 📅 日历与日程 | 4 | 4 | 0 | 8 |
| 💰 金融与商业 | 2 | 10 | 0 | 12 |
| 🛒 电商与营销 | 0 | 15 | 0 | 15 |
| 🏠 智能家居 | 0 | 12 | 0 | 12 |
| ☁️ DevOps 与云 | 5 | 14 | 1 | 20 |
| 🔒 安全与隐私 | 9 | 2 | 0 | 11 |
| 🗺️ 地图与位置 | 3 | 9 | 0 | 12 |
| 🏥 健康与生活 | 7 | 3 | 0 | 10 |
| 🎮 游戏与娱乐 | 2 | 8 | 0 | 10 |
| 📐 科学与教育 | 6 | 4 | 2 | 12 |
| 🧪 测试与质量 | 5 | 4 | 1 | 10 |
| 🎭 生成艺术 | 10 | 0 | 0 | 10 |
| 🧩 系统工具 | 20 | 0 | 0 | 20 |
| **合计** | **174** | **199** | **16** | **389** |

---

## Phase 1 优先级

Day 1 上线的 Skill Store 应该有 **30-50 个高频 Install Skill**，覆盖最常用的类别：

### 首批上架（优先级 P0，30 个）

```
📄 文档：pdf-to-markdown, pdf-merge, docx-to-markdown, markdown-to-pdf, html-to-markdown
💻 开发：code-formatter, json-formatter, yaml-validator, regex-tester, base64-codec,
         uuid-generator, hash-generator, jwt-decoder, api-tester
🛠️ 流程：tdd-workflow, debug-workflow, prompt-engineer, mcp-builder
🎨 图片：image-compress, image-resize, image-convert, qrcode-generator, screenshot-beautify
🎬 音视频：video-compress, video-convert, video-trim, video-to-gif, audio-convert
📊 数据：csv-analyzer, csv-cleaner, sqlite-query
🧪 测试：mock-server, test-data-factory, coverage-reporter
🎭 艺术：algorithmic-art, ascii-art, animated-gif-maker
🧩 系统：file-search, file-compress, text-diff, calculator, unit-converter
```

这 **38 个** Skill 全部可以本地执行、零 API 依赖、即装即用。
用户装完 CatBus 的第一印象就是：**"我的 Agent 突然会做好多事了。"**
