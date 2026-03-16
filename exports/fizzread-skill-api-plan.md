# FizzRead Skill API 设计方案

> 在 SQLite 迁移完成后，对外提供一套轻量 REST API，供 OpenClaw Skill 开发者调用。
> 托管在现有 Next.js SEO 站点（Next.js Route Handlers），无需新建服务。

---

## 一、Skill 使用场景分析

用户在 OpenClaw 中可能发出的指令，决定了 API 需要哪些端点：

| 用户说 | Skill 需要做 | 需要的 API |
|--------|------------|-----------|
| "帮我找一本关于习惯的书" | 搜索书籍 | `search` |
| "给我总结《原子习惯》" | 获取书籍摘要 | `book detail` |
| "我想听《原子习惯》的音频" | 获取音频 URL | `book detail`（含 audio_url）|
| "推荐几本心理学的书" | 按分类推荐 | `recommend` |
| "今天有什么好书推荐" | 每日精选 | `daily` |
| "这本书讲了什么，第三章是什么" | 获取章节内容 | `book detail`（含 chapters）|

---

## 二、API 设计

### Base URL
```
https://www.fizzread.ai/api/skill/v1
```

### 鉴权
所有接口需要 Bearer Token：
```
Authorization: Bearer <SKILL_API_KEY>
```
- Key 从环境变量 `SKILL_API_KEY` 读取
- 无效 key 返回 `401`
- 频率限制：100 次/分钟（按 Key 计）

---

### 端点列表

#### 1. 搜索书籍
```
GET /api/skill/v1/search
```

参数：
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `q` | string | ✅ | 搜索关键词（书名/作者/主题）|
| `limit` | int | ❌ | 返回数量，默认 5，最大 20 |
| `audio_only` | bool | ❌ | 只返回有音频的书，默认 false |

响应：
```json
{
  "results": [
    {
      "slug": "atomic-habits",
      "title": "Atomic Habits",
      "author": "James Clear",
      "about": "一句话简介...",
      "cover_url": "https://nccgpub.blob.core.windows.net/cover/...",
      "has_audio": true,
      "audio_duration": 589,
      "genres": ["Self-Help", "Productivity"]
    }
  ],
  "total": 3
}
```

---

#### 2. 书籍详情
```
GET /api/skill/v1/book/:slug
```

参数：
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `slug` | string（path）| ✅ | 书籍 slug |
| `fields` | string | ❌ | 按需返回字段，逗号分隔，默认全量 |

响应：
```json
{
  "slug": "atomic-habits",
  "title": "Atomic Habits",
  "author": "James Clear",
  "about": "书籍简介...",
  "about_author": "作者简介...",
  "introduction": {
    "title": "Introduction",
    "content": "..."
  },
  "chapters": [
    {
      "title": "The Surprising Power of Atomic Habits",
      "content": "章节内容..."
    }
  ],
  "cover_url": "https://...",
  "has_audio": true,
  "audio_url": "https://nccgpub.blob.core.windows.net/media/xxx.mp3",
  "audio_duration": 589,
  "app_url": "https://www.fizzread.ai/moment/atomic-habits",
  "download_url": "https://apps.apple.com/us/app/fizzread/id6755955369"
}
```

`fields` 示例：`?fields=title,author,audio_url,chapters` → 只返回指定字段（节省 token）

---

#### 3. 分类推荐
```
GET /api/skill/v1/recommend
```

参数：
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `category` | string | ❌ | 分类，如 habits/productivity/psychology |
| `limit` | int | ❌ | 默认 5，最大 10 |
| `audio_only` | bool | ❌ | 只返回有音频的书 |
| `exclude` | string | ❌ | 排除的 slug，逗号分隔（避免重复推荐）|

响应同 `search`，按 `search_volume` 降序排列。

---

#### 4. 每日精选
```
GET /api/skill/v1/daily
```

无参数。按日期种子随机选一本热门书（有音频优先），同一天返回同一本。

响应：同书籍详情，精简版（无 chapters）。

---

#### 5. 分类列表（辅助）
```
GET /api/skill/v1/categories
```

返回所有可用分类及对应书籍数量：
```json
{
  "categories": [
    { "name": "Self-Help", "count": 423, "has_audio_count": 380 },
    { "name": "Psychology", "count": 312, "has_audio_count": 290 }
  ]
}
```

---

## 三、响应通用规范

### 统一格式
```json
{
  "data": { ... },      // 成功时的数据
  "error": "message",  // 失败时的错误信息
  "meta": {
    "took_ms": 12       // 查询耗时（可选，调试用）
  }
}
```

### 错误码
| HTTP | 含义 |
|------|------|
| 200 | 成功 |
| 400 | 参数错误 |
| 401 | 未授权（key 无效或缺失）|
| 404 | 书籍不存在 |
| 429 | 超出频率限制 |
| 500 | 服务端错误 |

---

## 四、实现方案

### 技术选型

直接在现有 Next.js 应用里加 Route Handlers，**不新建服务**：

```
app/
└── api/
    └── skill/
        └── v1/
            ├── search/route.ts
            ├── book/[slug]/route.ts
            ├── recommend/route.ts
            ├── daily/route.ts
            └── categories/route.ts
```

共用 `lib/skill-api.ts`：
- 鉴权中间件（Bearer token 校验）
- 频率限制（基于 IP + Key，用内存 Map 实现，简单够用）
- SQLite 查询封装

### 性能考虑
- SQLite 单文件，读性能足够（并发读无锁竞争）
- `getBookBySlug` 走主键索引，< 1ms
- `search` 走 FTS5 索引，8296 条数据 < 5ms
- Next.js Standalone 模式下 Route Handler 是 Node.js 原生处理

---

## 五、SKILL.md 调用示例

```markdown
## 当用户请求书籍摘要时：

1. 调用搜索 API：
   curl -H "Authorization: Bearer $FIZZREAD_API_KEY" \
        "https://www.fizzread.ai/api/skill/v1/search?q={书名}&limit=3"

2. 让用户确认书籍，然后获取详情：
   curl -H "Authorization: Bearer $FIZZREAD_API_KEY" \
        "https://www.fizzread.ai/api/skill/v1/book/{slug}?fields=title,author,about,chapters"

3. 如果用户要听音频：
   返回 audio_url，用平台的音频消息发送功能播放
   如果平台不支持直接播放，引导下载 FizzRead App
```

---

## 六、完整执行步骤（更新版）

| 步骤 | 执行人 | 说明 |
|------|--------|------|
| 1. 写迁移脚本 | 浣浣（Claude Code）| RSC → SQLite |
| 2. 重构 lib/api.ts | 浣浣（Claude Code）| SQLite 优先读取 |
| 3. 实现 5 个 API 路由 | 浣浣（Claude Code）| skill v1 端点 |
| 4. 写 SKILL.md 框架 | 朋友 + 浣浣 | OpenClaw Skill 文件 |
| 5. dev 环境测试 | 浣浣 | book.xiai.xyz 验证 |
| 6. 生产机器跑迁移 | 浣浣 → us.ovh | 8296 条入库 |
| 7. 生产部署 | 浣浣 | build + pm2 restart |
| 8. 给朋友 API Key | 主人 | 从环境变量配置 |
| 9. Skill 开发测试 | 朋友 | 接 API 开发 Skill |
| 10. ClawHub 上架 | 朋友 | Fork → PR |

---

## 七、API Key 管理

- **环境变量**：`SKILL_API_KEY=xxx` 写入 us.ovh `.env`
- **格式建议**：`fizz_sk_xxxxxxxxxxxxxxxx`（前缀标识来源）
- 暂时一个 Key 给朋友用，后续如需多 Key 可扩展到 DB 管理

---

*版本：v1.1 | 更新：加入完整 API 设计*
