# Password Vault Skill 设计文档 v2.1

> 基于 OpenClaw 原生能力的本地密码管理 Skill

## 1. 版本变更

### v2 → v2.1 变化

| 项目 | v2 方案 | v2.1 方案 |
|------|---------|-----------|
| 密码存储 | 单文件 vault.enc | 拆分 secrets/*.enc |
| 搜索结果 | 直接使用 | 防御性解析 frontmatter |
| 明文残留 | 未处理 | 发送后删除 + 提醒 |
| 导入失败 | 未处理 | 事务回滚 |
| 多条匹配 | 未处理 | 交互选择 |
| 文件命名 | slug.md | slug-hash4.md |
| 平台限制 | 未声明 | os: darwin |

---

## 2. 数据结构

### 2.1 目录布局

```
~/.openclaw/workspace/skills/password-vault/
├── SKILL.md
├── scripts/
│   ├── init.js
│   ├── add.js
│   ├── search.js
│   ├── get.js
│   ├── update.js
│   ├── delete.js
│   ├── lock.js
│   ├── unlock.js
│   ├── import.js
│   └── lib/
│       ├── crypto.js
│       ├── keychain.js
│       ├── naming.js        # 文件命名
│       └── frontmatter.js   # 解析 frontmatter
├── data/
│   ├── entries/             # 元数据（QMD 索引）
│   │   ├── gmail-personal-a3f2.md
│   │   ├── netflix-home-b7c1.md
│   │   └── netflix-personal-d4e8.md
│   ├── secrets/             # 加密数据（单条目）
│   │   ├── gmail-personal-a3f2.enc
│   │   ├── netflix-home-b7c1.enc
│   │   └── netflix-personal-d4e8.enc
│   └── state.json
└── templates/
    └── entry.md
```

### 2.2 文件命名规则

```javascript
// lib/naming.js
function generateFilename(name) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30);
  
  const hash = crypto
    .createHash('md5')
    .update(name + Date.now())
    .digest('hex')
    .slice(0, 4);
  
  return `${slug}-${hash}`;
}

// 示例
// "Netflix" → "netflix-b7c1"
// "Netflix 家庭账号" → "netflix-家庭账号-d4e8"
// "Gmail 个人邮箱" → "gmail-个人邮箱-a3f2"
```

### 2.3 元数据文件格式

```markdown
---
id: netflix-home-b7c1
name: Netflix 家庭账号
category: 视频
created: 2026-02-14
updated: 2026-02-14
---

# Netflix 家庭账号

Netflix 流媒体服务，家庭套餐。

## 标签
- 视频
- 流媒体
- netflix
- 家庭
- 共享账号

## 用途
家庭共享的 Netflix 账号，每月 15 号扣费。
```

### 2.4 加密文件格式（单条目）

每个 `.enc` 文件独立加密：

```javascript
// secrets/netflix-home-b7c1.enc 内容结构
{
  "iv": "base64...",           // 初始化向量
  "salt": "base64...",         // 盐值
  "data": "base64...",         // AES-256-GCM 加密后的数据
  "tag": "base64..."           // 认证标签
}

// 解密后的明文
{
  "url": "https://netflix.com",
  "username": "xxx@gmail.com",
  "password": "abc123",
  "notes": "家庭套餐，每月 15 号扣费",
  "updated_at": "2026-02-14"
}
```

---

## 3. 搜索与匹配

### 3.1 memory_search 返回值处理

```javascript
// lib/frontmatter.js
function extractId(searchResult) {
  // memory_search 返回格式：
  // { path: "...", snippet: "...", score: 0.85 }
  
  // 方案 1: 从路径提取
  const match = searchResult.path.match(/entries\/(.+)\.md$/);
  if (match) return match[1];
  
  // 方案 2: 从 snippet 解析 frontmatter
  const fmMatch = searchResult.snippet.match(/^---\n[\s\S]*?id:\s*(.+?)\n/m);
  if (fmMatch) return fmMatch[1].trim();
  
  // 方案 3: 读取完整文件解析
  // 作为 fallback
  return null;
}
```

### 3.2 多条匹配交互

```
用户: 邮箱密码

助手: 🔍 找到 3 个匹配：

  1️⃣ Gmail 个人邮箱
  2️⃣ Gmail 工作邮箱  
  3️⃣ Outlook

请回复数字选择，或输入更具体的关键词。

用户: 1

助手: 
  📧 Gmail 个人邮箱
  网址: https://mail.google.com
  用户名: xxx@gmail.com
  密码: xyz789
```

**实现逻辑：**

```javascript
// search.js
async function search(query) {
  const results = await memorySearch(query);
  const entries = results
    .filter(r => r.path.includes('password-vault/data/entries'))
    .map(r => ({
      id: extractId(r),
      name: extractName(r),
      score: r.score
    }))
    .filter(e => e.id && e.score > 0.5);
  
  if (entries.length === 0) {
    return { type: 'not_found' };
  }
  
  if (entries.length === 1) {
    return { type: 'single', entry: entries[0] };
  }
  
  // 多条匹配，返回候选列表
  return { 
    type: 'multiple', 
    entries: entries.slice(0, 5)  // 最多显示 5 条
  };
}
```

---

## 4. 安全增强

### 4.1 明文消息处理

**问题**：Telegram 聊天记录会保留明文密码

**方案**：

```javascript
// get.js
async function getPassword(id) {
  // ... 解密获取密码 ...
  
  // 发送密码
  const msg = await sendMessage(passwordText);
  
  // 30 秒后自动删除
  setTimeout(async () => {
    await deleteMessage(msg.messageId);
  }, 30000);
  
  // 提醒用户
  return `⚠️ 此消息将在 30 秒后自动删除。
建议开启 Telegram 聊天自动删除功能。`;
}
```

**首次使用提醒**：

```
助手: 🔐 密码已发送

⚠️ 安全提示：
- 此消息将在 30 秒后自动删除
- 建议开启 Telegram「自动删除消息」功能
- 设置路径：聊天设置 → 自动删除消息 → 1 天
```

### 4.2 单文件加密优势

| 场景 | v2 (vault.enc) | v2.1 (secrets/*.enc) |
|------|----------------|----------------------|
| 读取单条 | 解密整个文件 | 只解密一个文件 |
| 写入单条 | 读-改-写整个文件 | 只写一个文件 |
| 并发写入 | 可能丢数据 | 原子操作，安全 |
| 文件损坏 | 全部丢失 | 只影响单条 |
| 备份恢复 | 全量恢复 | 可单条恢复 |

---

## 5. 导入功能

### 5.1 原子性保证

```javascript
// import.js
async function importBatch(entries) {
  const created = [];
  const failed = [];
  
  for (const entry of entries) {
    let mdPath = null;
    let encPath = null;
    
    try {
      // 1. 生成文件名
      const filename = generateFilename(entry.name);
      
      // 2. 写入元数据
      mdPath = `data/entries/${filename}.md`;
      await writeFile(mdPath, generateMarkdown(entry));
      
      // 3. 写入加密数据
      encPath = `data/secrets/${filename}.enc`;
      await writeFile(encPath, encrypt(entry.secret));
      
      created.push({ filename, name: entry.name });
    } catch (err) {
      // 回滚：删除已创建的文件
      if (mdPath && await exists(mdPath)) await unlink(mdPath);
      if (encPath && await exists(encPath)) await unlink(encPath);
      
      failed.push({ name: entry.name, error: err.message });
    }
  }
  
  return { created, failed };
}
```

### 5.2 导入格式

支持直接文本（从 Notion 复制）：

```
用户: 导入密码

Netflix
网址: https://netflix.com
用户名: xxx@gmail.com
密码: abc123
备注: 家庭套餐

---

Spotify
网址: https://spotify.com
用户名: yyy@gmail.com
密码: def456

助手: 📥 导入完成
  ✅ Netflix
  ✅ Spotify
  共导入 2 条记录
```

---

## 6. SKILL.md

```markdown
---
name: password-vault
description: 本地密码管理，支持语义搜索，安全存储
metadata: {"openclaw":{"os":["darwin"],"requires":{"bins":["security"]}}}
---

# Password Vault

本地密码管理 Skill，仅支持 macOS（依赖 Keychain）。

## 触发场景

- 密码查询："我的 xxx 密码是什么"
- 密码存储："存下密码"、"添加密码"
- 密码管理："锁定密码库"、"导入密码"

## 安全机制

- AES-256-GCM 加密
- 主密钥存储在 macOS Keychain
- 60 分钟无操作自动锁定
- 仅限私聊使用，群聊自动禁用
- 密码消息 30 秒后自动删除

## 平台要求

- macOS（依赖 /usr/bin/security CLI）
- 不支持 Linux/Windows
```

---

## 7. 完整流程示例

### 7.1 存储密码

```
用户: 刚注册了 Netflix 家庭账号
      网址: https://netflix.com
      用户名: family@gmail.com
      密码: abc123
      备注: 和爸妈共享

用户: 存下密码

助手: ✅ 已保存「Netflix 家庭账号」
      文件: netflix-家庭账号-b7c1
```

**内部操作：**
1. 解析消息，提取字段
2. 生成文件名 `netflix-家庭账号-b7c1`
3. 创建 `entries/netflix-家庭账号-b7c1.md`
4. 加密并创建 `secrets/netflix-家庭账号-b7c1.enc`
5. QMD 自动索引新 .md 文件

### 7.2 查询密码（多条匹配）

```
用户: Netflix 密码

助手: 🔍 找到 2 个匹配：

  1️⃣ Netflix 家庭账号
  2️⃣ Netflix 个人账号

请回复数字选择。

用户: 1

助手: 请输入主密码验证

用户: ************

助手: 🔓 已解锁

  🎬 Netflix 家庭账号
  网址: https://netflix.com
  用户名: family@gmail.com
  密码: abc123
  备注: 和爸妈共享

  ⚠️ 此消息将在 30 秒后自动删除
```

### 7.3 删除密码

```
用户: 删除 Netflix 个人账号

助手: ⚠️ 确认删除「Netflix 个人账号」？
      回复 Y 确认

用户: Y

助手: ✅ 已删除
      - entries/netflix-个人账号-d4e8.md
      - secrets/netflix-个人账号-d4e8.enc
```

---

## 8. 配置项

```json
{
  "passwordVault": {
    "unlockTimeout": 3600,        // 解锁有效期（秒）
    "autoDeleteDelay": 30,        // 消息自动删除延迟（秒）
    "maxSearchResults": 5,        // 最多显示匹配数
    "minSearchScore": 0.5,        // 最低匹配分数
    "backupPath": "~/Library/Mobile Documents/com~apple~CloudDocs/Backups/password-vault"
  }
}
```

---

## 9. 已确认需求

| 项目 | 决定 |
|------|------|
| 主密码策略 | 不需要定期修改 |
| 备份方案 | 加密文件放 iCloud 自动同步 |
| 导入格式 | 直接文本（从 Notion 复制） |
| 返回方式 | 明文发送，30 秒后删除 |
| 解锁有效期 | 60 分钟 |
| 平台支持 | 仅 macOS |

---

*文档版本: v2.1*
*更新日期: 2026-02-14*
