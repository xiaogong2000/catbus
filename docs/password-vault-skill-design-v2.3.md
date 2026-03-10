# Password Vault Skill 设计文档 v2.3

> 基于 OpenClaw 原生能力的本地密码管理 Skill

## 1. 版本变更

### v2.2 → v2.3 变化

| 项目 | v2.2 方案 | v2.3 方案 |
|------|-----------|-----------|
| 备份路径 | 硬编码 iCloud | 通用路径输入 |
| sessionKey 存储 | state.json 明文 | Keychain |
| 备份范围 | 未明确 | 只同步 entries/ + secrets/ |
| 纯中文命名 | entry-hash | pinyin fallback |
| 内存清零 | 未处理 | 标注已知限制 |

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
│   ├── list.js
│   ├── lock.js
│   ├── unlock.js
│   ├── import.js
│   └── lib/
│       ├── crypto.js
│       ├── keychain.js
│       ├── naming.js
│       ├── backup.js         # 备份模块
│       └── frontmatter.js
├── data/
│   ├── entries/
│   ├── secrets/
│   └── state.json            # 不含敏感数据
└── templates/
    └── entry.md
```

### 2.2 state.json 结构（安全版）

```json
{
  "initialized": true,
  "salt": "base64...",
  "unlockedAt": 1707897600,
  "lastBackupError": null,
  "config": {
    "backupPath": "/Volumes/NAS/backups/password-vault",
    "autoDeleteDelay": 30
  }
}
```

**注意**：`sessionKey` 已移至 Keychain，不再写入文件。

### 2.3 Keychain 条目

| Service | Account | 内容 |
|---------|---------|------|
| password-vault | master | 主密码 |
| password-vault-session | key | 解锁后的 AES key |

---

## 3. 文件命名（pinyin fallback）

```javascript
// lib/naming.js
const pinyin = require('tiny-pinyin');

function generateFilename(name) {
  // 1. 提取 ASCII 部分
  let asciiPart = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 20);
  
  // 2. 如果没有 ASCII，用 pinyin
  if (!asciiPart) {
    asciiPart = pinyin.convertToPinyin(name, '', true)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 20) || 'entry';
  }
  
  // 3. 加 hash 保证唯一
  const hash = crypto
    .createHash('md5')
    .update(name + Date.now() + Math.random())
    .digest('hex')
    .slice(0, 8);
  
  return `${asciiPart}-${hash}`;
}

// 示例
// "Netflix" → "netflix-a3f2b7c1"
// "Gmail 个人邮箱" → "gmail-d4e89f12"
// "微信支付" → "weixinzhifu-7b3c8a91"
// "支付宝" → "zhifubao-f2a1c3d4"
```

---

## 4. 密钥管理（Keychain 版）

### 4.1 解锁流程

```javascript
// lib/crypto.js
const keychain = require('./keychain');

async function unlock(masterPassword) {
  const state = await readState();
  
  // 1. 验证主密码
  const storedPassword = await keychain.getPassword(
    'password-vault', 'master'
  );
  if (masterPassword !== storedPassword) {
    throw new Error('Invalid master password');
  }
  
  // 2. PBKDF2 派生 key
  const key = crypto.pbkdf2Sync(
    masterPassword,
    Buffer.from(state.salt, 'base64'),
    100000,
    32,
    'sha256'
  );
  
  // 3. 存入 Keychain（不写文件）
  await keychain.setPassword(
    'password-vault-session', 'key',
    key.toString('base64')
  );
  
  // 4. 更新解锁时间
  state.unlockedAt = Date.now();
  await writeState(state);
  
  return key;
}

async function getSessionKey() {
  const state = await readState();
  
  // 检查超时
  if (!state.unlockedAt || Date.now() - state.unlockedAt > 3600000) {
    await lock();
    throw new Error('Session expired');
  }
  
  // 从 Keychain 获取
  const keyBase64 = await keychain.getPassword(
    'password-vault-session', 'key'
  );
  if (!keyBase64) {
    throw new Error('Vault is locked');
  }
  
  return Buffer.from(keyBase64, 'base64');
}

async function lock() {
  // 1. 删除 Keychain 中的 session key
  await keychain.deletePassword('password-vault-session', 'key');
  
  // 2. 清除解锁时间
  const state = await readState();
  state.unlockedAt = null;
  await writeState(state);
}
```

### 4.2 已知限制

> **内存清零**：`lock()` 删除 Keychain 条目后，Node.js 进程内存中的 key Buffer 在 GC 前仍然存在。对于短生命周期的 Skill 脚本影响不大。如果后续改为长驻进程，需要用 `Buffer.fill(0)` 手动清零。

---

## 5. 备份系统

### 5.1 初始化流程

```
用户: 初始化密码库

助手: 🔐 开始初始化

1️⃣ 请设置主密码（至少 12 位）

用户: ************

助手: 2️⃣ 是否启用自动备份？
      请输入备份目录路径，或回复 N 跳过
      
      示例：
      - /Volumes/NAS/backups/password-vault
      - ~/Dropbox/Backups/vault

用户: /Volumes/NAS/backups/password-vault

助手: ✅ 密码库已创建
      - 主密钥已存入 Keychain
      - 备份目录: /Volumes/NAS/backups/password-vault
```

### 5.2 init.js 实现

```javascript
// init.js
async function init(masterPassword, backupPath = null) {
  // 1. 生成 salt
  const salt = crypto.randomBytes(32);
  
  // 2. 存储主密钥到 Keychain
  await keychain.setPassword('password-vault', 'master', masterPassword);
  
  // 3. 创建目录
  await fs.mkdir('data/entries', { recursive: true });
  await fs.mkdir('data/secrets', { recursive: true });
  
  // 4. 验证备份路径
  if (backupPath) {
    try {
      await fs.access(backupPath, fs.constants.W_OK);
    } catch {
      try {
        await fs.mkdir(backupPath, { recursive: true });
      } catch (err) {
        console.warn('⚠️ 备份路径不可用:', err.message);
        backupPath = null;
      }
    }
  }
  
  // 5. 写入 state.json
  await writeState({
    initialized: true,
    salt: salt.toString('base64'),
    unlockedAt: null,
    lastBackupError: null,
    config: {
      backupPath,
      autoDeleteDelay: 30
    }
  });
}
```

### 5.3 备份模块（容错）

```javascript
// lib/backup.js
const fs = require('fs/promises');
const path = require('path');

async function syncToBackup(filePath, type = 'entry') {
  const state = await readState();
  if (!state.config.backupPath) return;
  
  const subDir = type === 'entry' ? 'entries' : 'secrets';
  const destDir = path.join(state.config.backupPath, subDir);
  const destPath = path.join(destDir, path.basename(filePath));
  
  try {
    // 确保目标目录存在
    await fs.mkdir(destDir, { recursive: true });
    
    // 检查备份路径可写
    await fs.access(state.config.backupPath, fs.constants.W_OK);
    
    // 复制文件
    await fs.copyFile(filePath, destPath);
    
    // 清除错误记录
    if (state.lastBackupError) {
      state.lastBackupError = null;
      await writeState(state);
    }
  } catch (err) {
    // 静默失败，记录 warning
    state.lastBackupError = {
      time: Date.now(),
      path: filePath,
      error: err.message
    };
    await writeState(state);
    console.warn('⚠️ 备份失败（NAS 可能离线）:', err.message);
  }
}

async function deleteFromBackup(filename, type = 'entry') {
  const state = await readState();
  if (!state.config.backupPath) return;
  
  const subDir = type === 'entry' ? 'entries' : 'secrets';
  const destPath = path.join(state.config.backupPath, subDir, filename);
  
  try {
    await fs.unlink(destPath);
  } catch {
    // 静默失败
  }
}

module.exports = { syncToBackup, deleteFromBackup };
```

### 5.4 备份调用点

```javascript
// add.js
async function add(entry) {
  const filename = generateFilename(entry.name);
  
  // 写入本地
  const mdPath = `data/entries/${filename}.md`;
  const encPath = `data/secrets/${filename}.enc`;
  await writeFile(mdPath, generateMarkdown(entry));
  await writeFile(encPath, encrypt(entry.secret));
  
  // 异步备份（不阻塞）
  syncToBackup(mdPath, 'entry').catch(() => {});
  syncToBackup(encPath, 'secret').catch(() => {});
  
  return { filename, name: entry.name };
}

// delete.js
async function remove(id) {
  const mdPath = `data/entries/${id}.md`;
  const encPath = `data/secrets/${id}.enc`;
  
  // 删除本地
  await fs.unlink(mdPath);
  await fs.unlink(encPath);
  
  // 异步删除备份
  deleteFromBackup(`${id}.md`, 'entry').catch(() => {});
  deleteFromBackup(`${id}.enc`, 'secret').catch(() => {});
}
```

### 5.5 备份范围

| 文件 | 是否备份 | 原因 |
|------|----------|------|
| entries/*.md | ✅ | 元数据，可恢复 |
| secrets/*.enc | ✅ | 加密数据，需要备份 |
| state.json | ❌ | 含 salt，泄露降低安全性 |
| Keychain | ❌ | 系统管理，不可导出 |

---

## 6. 导入功能

### 6.1 变量作用域（修正版）

```javascript
// import.js
async function importBatch(entries) {
  const created = [];
  const failed = [];
  
  for (const entry of entries) {
    // 声明在 try 外面，用 let
    let mdPath = null;
    let encPath = null;
    
    try {
      const filename = generateFilename(entry.name);
      
      mdPath = `data/entries/${filename}.md`;
      await writeFile(mdPath, generateMarkdown(entry));
      
      encPath = `data/secrets/${filename}.enc`;
      await writeFile(encPath, encrypt(entry.secret));
      
      // 异步备份
      syncToBackup(mdPath, 'entry').catch(() => {});
      syncToBackup(encPath, 'secret').catch(() => {});
      
      created.push({ filename, name: entry.name });
    } catch (err) {
      // 回滚
      if (mdPath) {
        try { await fs.unlink(mdPath); } catch {}
      }
      if (encPath) {
        try { await fs.unlink(encPath); } catch {}
      }
      
      failed.push({ name: entry.name, error: err.message });
    }
  }
  
  return { created, failed };
}
```

---

## 7. 安全总结

### 7.1 敏感数据位置

| 数据 | 存储位置 | 保护方式 |
|------|----------|----------|
| 主密码 | Keychain | 系统级加密 |
| sessionKey | Keychain | 系统级加密 |
| salt | state.json | chmod 600 |
| 加密密码 | secrets/*.enc | AES-256-GCM |

### 7.2 文件权限

```bash
# init.js 中设置
chmod 700 data/
chmod 600 data/state.json
chmod 700 data/entries/
chmod 700 data/secrets/
chmod 600 data/secrets/*.enc
```

### 7.3 .gitignore

```
# password-vault
data/state.json
data/secrets/
```

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
| 初始化密码库 | 创建 vault，设置主密码和备份路径 |
| 存下密码 | 保存账号信息 |
| xxx 密码 | 查询密码 |
| 列出所有密码 | 显示全部条目 |
| 列出 xxx 类密码 | 按分类过滤 |
| 删除 xxx | 删除条目 |
| 锁定密码库 | 手动锁定 |
| 导入密码 | 批量导入 |

## 安全机制

- AES-256-GCM 加密
- 主密钥 + sessionKey 存储在 macOS Keychain
- 60 分钟无操作自动锁定
- 仅限私聊使用，群聊自动禁用
- 密码消息 30 秒后自动删除
- 备份只同步 entries/ 和 secrets/，不含 state.json

## 返回格式

get.js 返回 JSON：

```json
{
  "type": "password_result",
  "message": "...",
  "actions": [{ "type": "auto_delete", "delay": 30 }]
}
```

## 平台要求

- macOS（依赖 /usr/bin/security CLI）
- 不支持 Linux/Windows

## 已知限制

- lock() 后内存中的 key 在 GC 前仍存在（短生命周期脚本影响不大）
- NAS 离线时备份静默失败，不影响正常使用
```

---

## 9. 配置项

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

---

## 10. 已确认需求

| 项目 | 决定 |
|------|------|
| 主密码策略 | 不需要定期修改 |
| 备份方案 | 通用路径（NAS/Dropbox/iCloud） |
| 导入格式 | 直接文本（从 Notion 复制） |
| 返回方式 | 明文发送，30 秒后删除 |
| 解锁有效期 | 60 分钟 |
| 平台支持 | 仅 macOS |
| sessionKey | 存 Keychain，不写文件 |

---

*文档版本: v2.3*
*更新日期: 2026-02-14*
