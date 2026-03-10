# Password Vault Skill 设计文档 v2.2

> 基于 OpenClaw 原生能力的本地密码管理 Skill

## 1. 版本变更

### v2.1 → v2.2 变化

| 项目 | v2.1 方案 | v2.2 方案 |
|------|-----------|-----------|
| 消息删除 | setTimeout（脚本退出后失效） | OpenClaw agent 层调度 |
| 文件命名 | 含中文 slug | 纯 ASCII（中文转 hash） |
| 密钥派生 | 每条记录独立 salt | 统一 salt，解锁时缓存 key |
| list 命令 | 无 | 新增 list.js |
| backupPath | 硬编码 iCloud | 可选，init 时确认 |
| minSearchScore | 固定 0.5 | 可配置，默认待实测调整 |

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
│   ├── list.js              # 新增
│   ├── lock.js
│   ├── unlock.js
│   ├── import.js
│   └── lib/
│       ├── crypto.js
│       ├── keychain.js
│       ├── naming.js
│       └── frontmatter.js
├── data/
│   ├── entries/             # 元数据（QMD 索引）
│   │   ├── netflix-a3f2b7c1.md
│   │   └── gmail-d4e89f12.md
│   ├── secrets/             # 加密数据（单条目）
│   │   ├── netflix-a3f2b7c1.enc
│   │   └── gmail-d4e89f12.enc
│   └── state.json           # 解锁状态 + 缓存 key
└── templates/
    └── entry.md
```

### 2.2 文件命名规则（纯 ASCII）

```javascript
// lib/naming.js
function generateFilename(name) {
  // 提取英文/数字部分作为可读前缀
  const asciiPart = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 20) || 'entry';
  
  // 用完整名称生成 hash，保证唯一性
  const hash = crypto
    .createHash('md5')
    .update(name + Date.now() + Math.random())
    .digest('hex')
    .slice(0, 8);
  
  return `${asciiPart}-${hash}`;
}

// 示例
// "Netflix" → "netflix-a3f2b7c1"
// "Netflix 家庭账号" → "netflix-d4e89f12"
// "Gmail 个人邮箱" → "gmail-7b3c8a91"
// "微信支付" → "entry-f2a1c3d4"
```

### 2.3 元数据文件格式

```markdown
---
id: netflix-a3f2b7c1
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

### 2.4 state.json 结构

```json
{
  "initialized": true,
  "salt": "base64...",
  "unlockedAt": 1707897600,
  "sessionKey": "base64...",
  "config": {
    "backupPath": "~/Library/Mobile Documents/com~apple~CloudDocs/Backups/password-vault",
    "autoDeleteDelay": 30
  }
}
```

**字段说明：**
- `salt`: 统一盐值，init 时生成
- `sessionKey`: 解锁时派生的 AES key（base64），锁定时清空
- `unlockedAt`: 解锁时间戳，用于计算超时

---

## 3. 密钥管理优化

### 3.1 统一 salt + 缓存 key

**问题**：v2.1 每个 .enc 文件独立 salt，每次解密都要跑 PBKDF2（~100-200ms）

**方案**：

```javascript
// lib/crypto.js

// 解锁时：派生 key 并缓存
async function unlock(masterPassword) {
  const state = await readState();
  
  // PBKDF2 派生（只执行一次）
  const key = crypto.pbkdf2Sync(
    masterPassword,
    Buffer.from(state.salt, 'base64'),
    100000,
    32,
    'sha256'
  );
  
  // 缓存到 state.json
  state.sessionKey = key.toString('base64');
  state.unlockedAt = Date.now();
  await writeState(state);
  
  return key;
}

// 解密时：直接用缓存的 key
async function decrypt(encPath) {
  const state = await readState();
  
  if (!state.sessionKey) {
    throw new Error('Vault is locked');
  }
  
  // 检查超时
  if (Date.now() - state.unlockedAt > 3600000) {
    await lock();
    throw new Error('Session expired');
  }
  
  const key = Buffer.from(state.sessionKey, 'base64');
  const encData = JSON.parse(await readFile(encPath));
  
  // AES-256-GCM 解密（无需 PBKDF2）
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(encData.iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(encData.tag, 'base64'));
  
  return JSON.parse(
    decipher.update(encData.data, 'base64', 'utf8') +
    decipher.final('utf8')
  );
}

// 锁定时：清除缓存
async function lock() {
  const state = await readState();
  state.sessionKey = null;
  state.unlockedAt = null;
  await writeState(state);
}
```

### 3.2 加密文件格式（简化）

```json
{
  "iv": "base64...",
  "data": "base64...",
  "tag": "base64..."
}
```

**注意**：salt 已移到 state.json，.enc 文件不再包含 salt。

---

## 4. 消息自动删除

### 4.1 问题分析

v2.1 用 `setTimeout` 在脚本里删除消息，但脚本执行完就退出，定时器不会触发。

### 4.2 方案：Agent 层调度

Skill 脚本返回结构化指令，由 OpenClaw agent 处理：

```javascript
// get.js 返回格式
{
  "type": "password_result",
  "message": "🎬 Netflix 家庭账号\n网址: ...\n密码: abc123",
  "actions": [
    {
      "type": "auto_delete",
      "delay": 30
    }
  ]
}
```

**SKILL.md 指令说明：**

```markdown
## 返回格式

get.js 返回 JSON，包含 `actions` 数组：

- `auto_delete`: 发送后自动删除
  - `delay`: 延迟秒数（默认 30）

Agent 收到后：
1. 发送 message 内容
2. 等待 delay 秒
3. 调用 message tool 删除该消息
```

### 4.3 Agent 处理逻辑

```
# SKILL.md 中的指令

收到 get.js 返回后：
1. 发送密码消息
2. 记录 messageId
3. 等待 {delay} 秒（可用 cron 或内部计时）
4. 调用 message(action=delete, messageId=xxx)
```

---

## 5. list.js 命令

### 5.1 功能

列出所有条目或按分类过滤，只返回元数据，不触碰 secrets。

### 5.2 实现

```javascript
// list.js
async function list(category = null) {
  const entriesDir = path.join(__dirname, '../data/entries');
  const files = await fs.readdir(entriesDir);
  
  const entries = [];
  for (const file of files) {
    if (!file.endsWith('.md')) continue;
    
    const content = await fs.readFile(path.join(entriesDir, file), 'utf8');
    const fm = parseFrontmatter(content);
    
    if (category && fm.category !== category) continue;
    
    entries.push({
      id: fm.id,
      name: fm.name,
      category: fm.category,
      updated: fm.updated
    });
  }
  
  return entries.sort((a, b) => a.name.localeCompare(b.name));
}
```

### 5.3 使用示例

```
用户: 列出所有密码

助手: 📋 密码库（共 12 条）

  📧 邮箱 (3)
  - Gmail 个人邮箱
  - Gmail 工作邮箱
  - Outlook

  🎬 视频 (2)
  - Netflix 家庭账号
  - Netflix 个人账号

  💳 支付 (2)
  - 支付宝
  - 微信支付
  
  ...

用户: 列出邮箱类密码

助手: 📧 邮箱类密码（共 3 条）
  - Gmail 个人邮箱
  - Gmail 工作邮箱
  - Outlook
```

---

## 6. 初始化流程

### 6.1 确认备份路径

```
用户: 初始化密码库

助手: 🔐 开始初始化

1️⃣ 请设置主密码（至少 12 位）

用户: ************

助手: 2️⃣ 是否启用 iCloud 备份？
      路径: ~/Library/Mobile Documents/com~apple~CloudDocs/Backups/password-vault
      
      回复 Y 启用，N 跳过

用户: Y

助手: ✅ 密码库已创建
      - 主密钥已存入 Keychain
      - iCloud 备份已启用
```

### 6.2 init.js 实现

```javascript
// init.js
async function init(masterPassword, enableBackup = true) {
  // 1. 生成 salt
  const salt = crypto.randomBytes(32);
  
  // 2. 存储主密钥到 Keychain
  await keychain.setPassword('password-vault', 'master', masterPassword);
  
  // 3. 创建目录
  await fs.mkdir('data/entries', { recursive: true });
  await fs.mkdir('data/secrets', { recursive: true });
  
  // 4. 检查 iCloud 路径
  let backupPath = null;
  if (enableBackup) {
    const icloudBase = path.join(
      os.homedir(),
      'Library/Mobile Documents/com~apple~CloudDocs'
    );
    if (await exists(icloudBase)) {
      backupPath = path.join(icloudBase, 'Backups/password-vault');
      await fs.mkdir(backupPath, { recursive: true });
    } else {
      console.warn('iCloud Drive not available, backup disabled');
    }
  }
  
  // 5. 写入 state.json
  await writeState({
    initialized: true,
    salt: salt.toString('base64'),
    unlockedAt: null,
    sessionKey: null,
    config: {
      backupPath,
      autoDeleteDelay: 30
    }
  });
}
```

---

## 7. 配置项

```json
{
  "passwordVault": {
    "unlockTimeout": 3600,
    "autoDeleteDelay": 30,
    "maxSearchResults": 5,
    "minSearchScore": 0.3,
    "backupPath": null
  }
}
```

**说明：**
- `minSearchScore`: 默认 0.3，需实测 QMD 返回的 score 分布后调整
- `backupPath`: null 表示禁用，init 时根据用户选择设置

---

## 8. SKILL.md

```markdown
---
name: password-vault
description: 本地密码管理，支持语义搜索，安全存储
metadata: {"openclaw":{"os":["darwin"],"requires":{"bins":["security"]}}}
---

# Password Vault

本地密码管理 Skill，仅支持 macOS（依赖 Keychain）。

## 命令

| 命令 | 说明 |
|------|------|
| 初始化密码库 | 创建 vault，设置主密码 |
| 存下密码 | 保存账号信息 |
| xxx 密码 | 查询密码 |
| 列出所有密码 | 显示全部条目 |
| 列出 xxx 类密码 | 按分类过滤 |
| 删除 xxx | 删除条目 |
| 锁定密码库 | 手动锁定 |
| 导入密码 | 批量导入 |

## 安全机制

- AES-256-GCM 加密
- 主密钥存储在 macOS Keychain
- 60 分钟无操作自动锁定
- 仅限私聊使用，群聊自动禁用
- 密码消息 30 秒后自动删除

## 返回格式

get.js 返回 JSON，包含 `actions` 数组：

```json
{
  "type": "password_result",
  "message": "...",
  "actions": [{ "type": "auto_delete", "delay": 30 }]
}
```

Agent 处理：发送消息 → 等待 delay 秒 → 删除消息

## 平台要求

- macOS（依赖 /usr/bin/security CLI）
- 不支持 Linux/Windows
```

---

## 9. 完整流程示例

### 9.1 查询密码（含自动删除）

```
用户: Netflix 密码

助手: 请输入主密码验证

用户: ************

助手: 🔓 已解锁

  🎬 Netflix 家庭账号
  网址: https://netflix.com
  用户名: family@gmail.com
  密码: abc123
  备注: 和爸妈共享

  ⏱️ 此消息将在 30 秒后自动删除

[30 秒后消息被删除]
```

### 9.2 列出密码

```
用户: 列出所有密码

助手: 📋 密码库（共 5 条）

  📧 邮箱
  - Gmail 个人邮箱
  - Outlook

  🎬 视频
  - Netflix 家庭账号
  - YouTube Premium

  💳 支付
  - PayPal
```

---

## 10. 已确认需求

| 项目 | 决定 |
|------|------|
| 主密码策略 | 不需要定期修改 |
| 备份方案 | iCloud（可选，init 时确认） |
| 导入格式 | 直接文本（从 Notion 复制） |
| 返回方式 | 明文发送，30 秒后删除 |
| 解锁有效期 | 60 分钟 |
| 平台支持 | 仅 macOS |
| 文件命名 | 纯 ASCII + hash |

---

## 11. 性能对比

| 操作 | v2.1 | v2.2 |
|------|------|------|
| 单条解密 | ~150ms (PBKDF2) | ~1ms (缓存 key) |
| 批量解密 10 条 | ~1.5s | ~10ms |
| list 全部 | N/A | ~5ms（不解密） |

---

*文档版本: v2.2*
*更新日期: 2026-02-14*
