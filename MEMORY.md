# MEMORY.md — 长期记忆

> 这是 NeFi 的长期记忆。从 daily notes 提炼，过时则删除。

---

## 关于主人

### Key Context
- 称呼：主人
- 时区：Asia/Shanghai (GMT+8)
- 联系方式：Telegram (@rocstp, id:1149648904)

### Preferences Learned
- 沟通风格：简洁直接
- 每句话末尾带 🐱
- 不要啰嗦重复
- 喜欢高效执行，不喜欢反复确认

### Important Dates
- （待补充）

---

## 系统配置

- 主模型：azure-claude/claude-opus-4-5
- Fallbacks（按优先级）：
  1. newcli/claude-opus-4-6
  2. openai/gpt-5-mini
  3. newcli-aws/claude-opus-4-5
  4. newcli-codex/gpt-5.2
  5. newcli-gemini/gemini-2.5-pro
- Tavily API 已配置
- Provider 健康检查：每 30 分钟自动检测，故障自动切换并通知

---

## 已安装 Skills

- tavily-search（网页搜索）
- find-skills（技能搜索）
- proactive-agent（主动代理）
- provider-failover（Provider 健康检查 + 自动切换 + 通知）

---

## 开发流程

- ge.ovh 上的 Claude Code (`/home/debian/.local/bin/claude`) 负责写代码、测试
- NeFi 负责下发任务（通过 TASK.md）、审核结果、协调部署到生产 fr.ovh
- 开发在 ge.ovh，生产在 fr.ovh，严格隔离
- Claude Code 启动方式：`ssh ge.ovh "claude ..."` (debian 用户，不需要 sudo)

---

## FizzRead SEO 项目状态

- 388 本书、348 个作者、22 个书单（20 名人 + 2 主题）
- sitemap 803 个 URL
- GSC 已提交 186 个 URL，剩余 617 个
- n8n Workflow 1（书籍生成）：OpenClaw cron 02:00 UTC+8 触发
- n8n Workflow 2（GSC 提交）：每天 30 个，inactive 待激活
- 数据库新增 `gsc_submissions` 表追踪提交状态
- Google Indexing API 每日配额约 190 个

---

## 重要事件

### 2026-02-13
- 新增 10 个名人书单：Reese Witherspoon, Emma Watson, LeBron James, Richard Branson, Ryan Holiday, James Clear, Brené Brown, Malcolm Gladwell, Sam Altman, Sheryl Sandberg
- 书籍从 353→388 本，书单从 12→22 个
- 分页改造（省略号样式）、书单标题多样化
- Header "Try FizzRead Free" 改跳 App Store（带 UTM）
- zero-to-one 中文数据修复（FizzRead API 返回中文）
- GSC 批量提交方案重设计：新建 `submit-gsc-batch.js` + `gsc_submissions` 表
- n8n Workflow 1 删除 03:00 定时器，保留 OpenClaw cron 02:00 触发
- n8n Workflow 2 更新为新脚本，limit 改为 30/天

### 2026-02-12
- 书单扩充至 306 本（竞品关键词提取 128 本新书）
- 新增分类页 /moment/category/[slug]（4列×5行，带分页）
- 面包屑升级为 4 级：Home > Moment > Category > Book
- 修复 generated_books category 字段不统一问题
- 确立开发分工：ge.ovh Claude Code 写代码，NeFi 审核+部署

### 2026-02-14
- Provider Failover Skill 完成：健康检查 + 自动切换 + Telegram 通知
- 三条独立线路：azure / newcli / openai
- 每 30 分钟 cron job 自动检查
- proactive-agent 最佳实践整合到 AGENTS.md / SOUL.md / HEARTBEAT.md

### 2026-02-08
- 完成 OpenClaw 初始化
- 配置 Telegram 机器人
- 安装三套 API 模型
- 启用 proactive-agent

---

## Lessons Learned

### 2026-02-14 - Provider 灾备
- OpenClaw 原生 fallback 只处理 401/429/timeout/billing 错误
- 500/"暂不支持" 等错误不会自动触发 fallback
- 解决方案：provider-failover skill 补充监控和自动切换
- newcli 系列（newcli/newcli-aws/newcli-codex/newcli-gemini）是同一条线路

### 2026-02-13 - Claude Code 超时
- 600s 超时对大任务不够
- 下次考虑 900s+
- Claude Code 权限确认：需要 Down + Enter 选 "Yes, I accept"

---

## Relationships & People

### Claude Code (ge.ovh)
- 角色：开发环境的编码代理
- 路径：`/home/debian/.local/bin/claude`
- 版本：v2.1.41
- 用户：debian
- 任务交接：通过 TASK.md

---

*定期回顾更新。Daily notes 是原始记录；这里是提炼的精华。*
