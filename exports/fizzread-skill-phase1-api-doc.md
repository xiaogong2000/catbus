# FizzRead OpenClaw Skill — 第一期功能 & API 文档

> 供 Skill 开发者参考。Base URL、API Key 联系 FizzRead 团队获取。

---

## 一、第一期功能范围

### 功能列表

| # | 功能 | 触发方式 | 说明 |
|---|------|---------|------|
| 1 | **每日一书** | 每天定时自动推送 | 核心功能，用户装上就能用 |
| 2 | **书籍搜索** | 用户主动搜索 | 输入关键词返回书单 |
| 3 | **书籍摘要** | 用户指定书名 | 返回简介 + 1分钟音频 |
| 4 | **分类推荐** | 用户指定主题 | 按分类推荐热门书 |

暂不在第一期：深度问答、书单对比、用户偏好设置。

---

### 用户体验设计原则

1. **内容直接发到对话框**，不跳网页
2. **不用 AI 生成内容**，直接发数据库现有文字
3. **每次推送必带 App 下载引流**
4. **多语言**：检测用户语言，中文用户自动翻译 `about` 字段；音频保持英文原版
5. **音频**：发 1 分钟预览 MP3，引导去 App 听完整版

---

### 功能 1：每日一书（Daily Pick）

**触发**：每天定时（用户可设置，默认 08:00）

**推送内容**：
```
📖 今日好书 · {日期}

{书名} · {作者}

{about 内容，100字以内，中文用户自动翻译}

🎧 [1分钟音频文件]

─────────────────
完整 10 分钟音频版，下载 FizzRead App 免费收听 👇
{download_url}
```

---

### 功能 2：书籍搜索

**触发**：用户输入关键词（书名 / 作者 / 主题）

**返回**：最多 5 本书的列表（书名 + 作者 + 一句话简介），用户选择后可进入书摘

---

### 功能 3：书籍摘要

**触发**：用户指定书名后确认

**推送内容**：
```
📖 {书名}
作者：{作者}

{about，100字以内，中文用户翻译}

🎧 [1分钟音频文件]

─────────────────
完整版 → FizzRead App
{download_url}
```

---

### 功能 4：分类推荐

**触发**：用户输入分类（如"心理学"、"productivity"）

**返回**：3-5 本该分类热门书的列表，每本含书名 + 作者 + 一句话简介

---

## 二、API 文档

### Base URL
```
https://api.fizzread.ai/v1
```

### 鉴权

所有接口需要 Bearer Token：
```
Authorization: Bearer <YOUR_API_KEY>
```

无效 Key 返回 `401 Unauthorized`。

---

### 接口列表

---

#### GET /daily

获取每日精选书籍。同一天多次调用返回同一本书。

**请求**
```
GET /daily
Authorization: Bearer <key>
```

**响应**
```json
{
  "slug": "thinking-fast-and-slow",
  "title": "Thinking, Fast and Slow",
  "author": "Daniel Kahneman",
  "about": "Human thinking operates through two systems: the fast, intuitive System 1 and the slow, rational System 2. Most poor decisions stem from over-relying on System 1.",
  "cover_url": "https://nccgpub.blob.core.windows.net/cover/xxx_600.webp",
  "audio_url": "https://nccgpub.blob.core.windows.net/media/xxx.mp3",
  "audio_duration": 60,
  "app_url": "https://www.fizzread.ai/moment/thinking-fast-and-slow",
  "download_url": "https://apps.apple.com/us/app/fizzread/id6755955369"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `slug` | string | 书籍唯一标识 |
| `title` | string | 书名（英文原版）|
| `author` | string | 作者 |
| `about` | string | 书籍简介（英文，Skill 负责按需翻译）|
| `cover_url` | string | 封面图 URL（600px）|
| `audio_url` | string | 1分钟预览音频 MP3 URL |
| `audio_duration` | int | 音频时长（秒），固定约 60 |
| `app_url` | string | SEO 站书籍详情页 |
| `download_url` | string | App Store 下载链接（带 UTM）|

---

#### GET /search

搜索书籍。

**请求**
```
GET /search?q={关键词}&limit={数量}&audio_only={true/false}
Authorization: Bearer <key>
```

**参数**

| 参数 | 类型 | 必填 | 默认 | 说明 |
|------|------|------|------|------|
| `q` | string | ✅ | — | 搜索词（书名/作者/主题）|
| `limit` | int | ❌ | 5 | 返回数量，最大 10 |
| `audio_only` | bool | ❌ | false | 只返回有音频的书 |

**响应**
```json
{
  "results": [
    {
      "slug": "atomic-habits",
      "title": "Atomic Habits",
      "author": "James Clear",
      "about": "Small changes compound into remarkable results...",
      "cover_url": "https://nccgpub.blob.core.windows.net/cover/xxx_600.webp",
      "has_audio": true,
      "audio_duration": 60,
      "download_url": "https://apps.apple.com/us/app/fizzread/id6755955369"
    }
  ],
  "total": 3
}
```

---

#### GET /book/:slug

获取单本书籍完整信息。

**请求**
```
GET /book/atomic-habits
Authorization: Bearer <key>
```

**响应**
```json
{
  "slug": "atomic-habits",
  "title": "Atomic Habits",
  "author": "James Clear",
  "about": "Small changes compound into remarkable results. James Clear presents a practical framework for building good habits based on psychology and neuroscience.",
  "cover_url": "https://nccgpub.blob.core.windows.net/cover/xxx_600.webp",
  "audio_url": "https://nccgpub.blob.core.windows.net/media/xxx.mp3",
  "audio_duration": 60,
  "app_url": "https://www.fizzread.ai/moment/atomic-habits",
  "download_url": "https://apps.apple.com/us/app/fizzread/id6755955369"
}
```

> `audio_url` 为 null 时表示该书暂无音频。

---

#### GET /recommend

按分类获取推荐书籍。

**请求**
```
GET /recommend?category={分类}&limit={数量}&audio_only={true/false}
Authorization: Bearer <key>
```

**参数**

| 参数 | 类型 | 必填 | 默认 | 说明 |
|------|------|------|------|------|
| `category` | string | ❌ | — | 分类名称，留空返回综合热门 |
| `limit` | int | ❌ | 5 | 返回数量，最大 10 |
| `audio_only` | bool | ❌ | false | 只返回有音频的书 |

**响应**：同 `/search`

---

#### GET /categories

获取所有可用分类及书籍数量。

**请求**
```
GET /categories
Authorization: Bearer <key>
```

**响应**
```json
{
  "categories": [
    { "name": "Self-Help", "count": 423, "has_audio_count": 380 },
    { "name": "Psychology", "count": 312, "has_audio_count": 290 },
    { "name": "Business", "count": 287, "has_audio_count": 260 },
    { "name": "Productivity", "count": 198, "has_audio_count": 180 }
  ]
}
```

---

### 错误响应

```json
{
  "error": "Book not found",
  "code": 404
}
```

| HTTP 状态码 | 含义 |
|------------|------|
| 200 | 成功 |
| 400 | 参数错误 |
| 401 | Key 无效或缺失 |
| 404 | 书籍不存在 |
| 429 | 超出频率限制（100次/分钟）|
| 500 | 服务端错误 |

---

## 三、SKILL.md 开发要点

```yaml
---
name: fizzread
description: Daily book summaries and 1-minute audio previews from FizzRead. 
             Recommends books, sends audio, and guides users to FizzRead App.
emoji: 📚
metadata:
  openclaw:
    requires:
      env: [FIZZREAD_API_KEY]
      bins: [curl]
---
```

**多语言处理**：
- 检测用户对话语言
- 中文用户：翻译 `about` 字段后发送（Skill 内用 LLM 翻译，无需调外部翻译 API）
- 英文用户：直接发原文
- 音频始终为英文版，文案注明"英文音频"

**音频发送**：
- 用平台的文件/音频消息接口发送 `audio_url` 的 MP3
- Telegram：`sendAudio` 或 `sendVoice`
- WhatsApp：发音频附件
- Discord：上传文件

---

## 四、数据说明

- **书籍总量**：8,296 本
- **有音频书籍**：待迁移后确认实际数量
- **音频时长**：约 60 秒（1分钟预览版）
- **内容语言**：全英文
- **音频格式**：MP3，192kbps，约 1.37MB/本
- **封面图**：WebP 格式，600px 宽

---

*FizzRead Team · api.fizzread.ai · 第一期 v1.0*
