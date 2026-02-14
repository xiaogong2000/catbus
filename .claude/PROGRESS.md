# PROGRESS.md - 开发进度日志

> 每次开发完成后追加记录。格式: [日期] [环境] 做了什么

---

## 2026-02-08
- [OpenClaw] 创建 Next.js 项目基础框架
- [FR.OVH] 搭建组件: Header, Footer, BookCard, SmartCTA 等
- [FR.OVH] 配置 Caddy 反向代理 + pm2

## 2026-02-10
- [OpenClaw] SEO 审计 www.fizzread.ai → 90/100
- [OpenClaw] 创建 3 个 n8n 工作流 (JSON 版)

## 2026-02-11
- [OpenClaw] 安装 sqlite3，初始化数据库，导入 94 本书种子
- [OpenClaw] 升级 3 个 n8n 工作流为 SQLite 版
- [OpenClaw] 更新 search API: q= → query=, 加 headers
- [OpenClaw] 修复提取书籍ID节点: data → data.data
- [OpenClaw] 创建 .claude/ 协作文件结构

## 2026-02-11 (续)
- [OpenClaw] 更新 .claude/ 协作文件，聚焦 Phase 1
- [OpenClaw] 工作流 1 改动: 批量 10→20, 加 Google Indexing API, Slack→Telegram
- [OpenClaw] 明确: 只改数据层(api.ts/types.ts/db.ts)，UI 组件不动
- [FR.OVH] 安装 better-sqlite3 + @types/better-sqlite3
- [FR.OVH] 创建 lib/db.ts - SQLite 连接模块（单例 + readonly）
- [FR.OVH] 改造 lib/types.ts - 新增 GeneratedBookRow, BookContent, dbRowToBook()
- [FR.OVH] 改造 lib/api.ts - SQLite 优先，fallback 到 JSON
- [FR.OVH] 构建验证通过，服务重启正常
- [FR.OVH] P1 验证: 手动插入测试数据到 SQLite，页面渲染成功
- [FR.OVH] 确认: SQLite 优先读取 → 无数据时 fallback 到 JSON
- [FR.OVH] 将 JSON 11 本书导入 SQLite generated_books 表
- [FR.OVH] 手动添加 Surrounded by Idiots (搜索量 27,100) 到 SQLite
- [FR.OVH] 首页改造: 添加分页功能 (每页 25 本, 5x5 布局)
- [FR.OVH] 更新 TASK.md: 添加 OpenClaw n8n 配置说明
- [FR.OVH] 发现: Search API 需要 JWT Token, Preview API 不需要认证

## 2026-02-11 22:00-23:12
- [OpenClaw] 工作流 1 去掉 Claude 节点，改为直接从 Preview API 组装内容
- [OpenClaw] Search API Token 硬编码到 headers，去掉 credential 依赖
- [OpenClaw] Preview API 去掉认证（不需要 Bearer Token）
- [OpenClaw] 移除 Ping Google Sitemap（已废弃 404）
- [OpenClaw] 修复 pm2 路径: /root/.npm/_npx/.../pm2/bin/pm2
- [OpenClaw] 修复 surrounded-by-idiots 封面图 URL
- [OpenClaw] 端到端测试通过 ✅ 页面正常渲染

## 2026-02-11 23:30
- [FR.OVH] 修复首页 BookCard 高度不一致问题
  - BookCard 添加 h-full + flex flex-col 布局
  - 标题添加 min-h-[2.5rem] 保证最小高度
  - 底部时间信息添加 mt-auto 自动对齐底部
  - Link 组件添加 h-full 传递高度

## 2026-02-12 00:00
- [FR.OVH] 修复 /moment/lists/best-productivity-books 显示所有书籍的问题
  - 原因: 构建缓存，重新 build 后恢复正常
- [FR.OVH] 新建 /moment/lists 书单索引页面
  - 展示所有书单主题（目前2个）
  - 每行一个书单卡片：5本书封面预览 + 标题描述
  - hover 效果：封面上浮、标题变色
- [FR.OVH] Header 导航 Top Lists 链接改为 /moment/lists
- [FR.OVH] 创建 scripts/insert-book.js 脚本
  - 使用 better-sqlite3 参数化查询（避免 SQL 注入）
  - 支持插入新书 / 更新已有书
  - 测试通过：插入、更新、错误处理
- [FR.OVH] 排查 n8n 工作流循环 BUG
  - 确认 insert-book.js 脚本正常（/tmp/book-data.json 存在）
  - 发现根因: SSH 节点 UPDATE 后无输出，下游 $json 为空
  - 提供修复方案给 OpenClaw
- [FR.OVH] 创建 scripts/process-books.js 替代 n8n 循环
  - Search API → Preview API → 组装 content → 插入 DB → 更新状态
  - 修复 key_ideas content 格式问题（对象→字符串）
  - Token 硬编码（有效期 2027）
  - 测试通过: 5 本书成功处理并构建上线
  - 当前状态: completed=5, pending=89
- [FR.OVH] 创建 scripts/submit-gsc.js GSC 提交脚本
  - 使用 google-auth-library 认证
  - Key 路径: config/gsc-service-account.json
  - 测试通过: 4 个 URL 成功提交到 Google Indexing API
