# DECISIONS.md - 架构决策记录

> 重要的技术决策记录在这里，避免重复讨论。

---

### D1: 路由用 /moment/* 而非 /books/*
- 日期: 2026-02-10
- 原因: Fizz Moment 定位为更广泛的内容频道，不限于书籍
- 影响: 所有 SEO 页面在 /moment/ 下

### D2: CTA 统一指向 App Store
- 日期: 2026-02-10
- 原因: 简化转化路径，所有设备统一引导下载
- App Store ID: 6755955369

### D3: SQLite 替代 JSON 文件
- 日期: 2026-02-11
- 原因: 查询性能 O(logN)、事务安全、状态管理
- 路径: /data/fizzread-seo.db

### D4: n8n 工作流用 SSH 执行 sqlite3 命令
- 日期: 2026-02-11
- 原因: n8n 没有原生 SQLite 节点，SSH 执行最简单
- 用户: debian (sudo 免密 root)

### D5: search + preview 两步 API 调用
- 日期: 2026-02-11
- 原因: search 匹配书籍获取 UUID，preview 获取章节内容
- search 参数: query= (非 q=), mode=simple

### D6: www.fizzread.ai 是生产域名
- 日期: 2026-02-10
- 原因: book.xiai.xyz 仅用于开发测试
- Cloudflare Workers 反向代理 /moment/* → localhost:3001

### D7: Phase 1 只跑通工作流 1
- 日期: 2026-02-11
- 原因: 先验证书籍内容生成全链路，工作流 2/3 暂不开发
- 影响: 作者页、名人书单推迟到 Phase 2

### D8: 数据层只改 lib/api.ts + lib/types.ts + 新增 lib/db.ts
- 日期: 2026-02-11
- 原因: 现有 UI 组件已验证可用，只需切换数据源
- 影响: 最小改动量，降低风险
