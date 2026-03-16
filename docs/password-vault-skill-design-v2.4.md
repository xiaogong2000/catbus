# Password Vault Skill 设计文档 v2.4

> 基于 OpenClaw 原生能力的本地密码管理 Skill

## 1. 版本变更

### v2.3 → v2.4 变化

| 项目 | v2.3 方案 | v2.4 方案 |
|------|-----------|-----------|
| salt 备份 | 不备份 | 单独备份 vault-meta.json |
| 主密码存储 | Keychain 存明文 | Keychain 存派生 key |
| 备份状态 | 写入 state.json | 独立 backup-status.json |
| .gitignore | 只排除 secrets/ | 同时排除 entries/ |

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
│   ├── restore.js            # 新增：灾难恢复
│   └── lib/
│       ├── crypto.js
│       ├── keychain.js
│       ├── naming.js
│       ├── backup.js
│       └── frontmatter.js
├── data/
│   ├── entries/
│   ├── secrets/
│   ├── state.json
│   └── backup-status.json    # 独立备份状态
└── templates/
    └── entry.md
```

### 2.2 state.json（精简版）

```json
{
  "initialized": true,
  "salt": "base64...",
  "created": "2026-02-14T10:00:00Z",
  "unlockedAt": 1707897600,
  "config": {
    "backupPath": "/Volumes/NAS/backups/password-vault",
    "autoDeleteDelay": 30
  }
}
```

### 2.3 backup-status.json（独立）

```json
{
  "lastSync": 1707897600,
  "lastError": null
}
```

### 2.4 备份目录结构

```
/Volumes/NAS/backups/password-vault/
├── vault-meta.json           # salt + created（可恢复）
├── entries/
│   ├── netflix-a3f2b7c1.md
│   └── gmail-d4e89f12.md
└── secrets/
    ├── netflix-a3f2b7c1.enc
    └── gmail-d4e89f12.enc
```

### 2.5 vault-meta.json

```json
{
  "salt": "base64...",
  "created": "2026-02-14T10:00:00Z"
}
```

**说明**：salt 本身不是秘密，知道 salt 还需要主密码才能派生 key，安全界普遍认为可以公开存储。

---

## 3. Keychain 设计（不存主密码）

### 3.1 存储内容

| Service | Account | 内容 |
|---------|---------|------|
| password-vault | master-key | PBKDF2 派生的 key |
| password-vault-session | key | 解锁后的 session key |

**注意**：不再存储主密码原文，只存派生后的 key。

### 3.2 初始化流程

```javascript
// init.js
async function init(masterPassword, backupPath = null) {
  // 1. 生成 salt
  const salt = crypto.randomBytes(32);
  const created = new Date().toISOString();
  
  // 2. 派生 master key（不存主密码原文）
  const masterKey = crypto.pbkdf2Sync(
    masterPassword,
    salt,
    100000,
    32,
    'sha256'
  );
  
  // 3. 存入 Keychain（存派生 key，不存密码）
  await keychain.setPassword(
    'password-vault', 'master-key',
    masterKey.toString('base64')
  );
  
  // 4. 创建目录
  await fs.mkdir('data/entries', { recursive: true });
  await fs.mkdir('data/secrets', { recursive: true });
  
  // 5. 验证备份路径
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
  
  // 6. 写入 state.json
  await writeState({
    initialized: true,
    salt: salt.toString('base64'),
    created,
    unlockedAt: null,
    config: { backupPath, autoDeleteDelay: 30 }
  });
  
  // 7. 初始化备份状态
  await writeBackupStatus({ lastSync: null, lastError: null });
  
  // 8. 同步 vault-meta 到备份
  await syncMeta();
  
  // 9. 设置文件权限
  await setPermissions();
}
```

### 3.3 解锁流程

```javascript
// lib/crypto.js
async function unlock(inputPassword) {
  const state = await readState();
  
  // 1. 用输入密码派生 key
  const derivedKey = crypto.pbkdf2Sync(
    inputPassword,
    Buffer.from(state.salt, 'base64'),
    100000,
    32,
    'sha256'
  );
  
  // 2. 对比 Keychain 中存储的 master key
  const storedKey = await keychain.getPassword(
    'password-vault', 'master-key'
  );
  
  if (derivedKey.toString('base64') !== storedKey) {
    throw new Error('Invalid master password');
  }
  
  // 3. 验证通过，derivedKey 就是 sessionKey
  await keychain.setPassword(
    'password-vault-session', 'key',
    derivedKey.toString('base64')
  );
  
  // 4. 更新解锁时间
  state.unlockedAt = Date.now();
  await writeState(state);
  
  return derivedKey;
}
```

### 3.4 安全优势

| 方案 | Keychain 泄露后果 |
|------|-------------------|
| v2.3（存主密码） | 攻击者直接获得主密码 |
| v2.4（存派生 key） | 攻击者只能解密当前 vault，无法获得主密码本身 |

---

## 4. 备份系统

### 4.1 vault-meta 同步

```javascript
// lib/backup.js
async function syncMeta() {
  const state = await readState();
  if (!state.config.backupPath) return;
  
  const meta = {
    salt: state.salt,
    created: state.created
  };
  
  const dest = path.join(state.config.backupPath, 'vault-meta.json');
  
  try {
    await fs.writeFile(dest, JSON.stringify(meta, null, 2));
  } catch (err) {
    console.warn('⚠️ vault-meta 备份失败:', err.message);
  }
}
```

### 4.2 备份状态独立存储

```javascript
// lib/backup.js
async function syncToBackup(filePath, type = 'entry') {
  const state = await readState();
  if (!state.config.backupPath) return;
  
  const subDir = type === 'entry' ? 'entries' : 'secrets';
  const destDir = path.join(state.config.backupPath, subDir);
  const destPath = path.join(destDir, path.basename(filePath));
  
  try {
    await fs.mkdir(destDir, { recursive: true });
    await fs.access(state.config.backupPath, fs.constants.W_OK);
    await fs.copyFile(filePath, destPath);
    
    // 写入独立的备份状态文件（避免并发冲突）
    await writeBackupStatus({
      lastSync: Date.now(),
      lastError: null
    });
  } catch (err) {
    await writeBackupStatus({
      lastSync: null,
      lastError: {
        time: Date.now(),
        path: filePath,
        error: err.message
      }
    });
    console.warn('⚠️ 备份失败:', err.message);
  }
}

async function writeBackupStatus(status) {
  const statusPath = path.join(__dirname, '../data/backup-status.json');
  await fs.writeFile(statusPath, JSON.stringify(status, null, 2));
}
```

### 4.3 备份范围

| 文件 | 是否备份 | 原因 |
|------|----------|------|
| vault-meta.json | ✅ | 含 salt，恢复必需 |
| entries/*.md | ✅ | 元数据 |
| secrets/*.enc | ✅ | 加密数据 |
| state.json | ❌ | 含 config，本地专用 |
| backup-status.json | ❌ | 本地状态 |

---

## 5. 灾难恢复

### 5.1 恢复流程

```
用户: 恢复密码库

助手: 🔄 开始恢复

1️⃣ 请输入备份目录路径

用户: /Volumes/NAS/backups/password-vault

助手: ✅ 找到备份
      - vault-meta.json
      - 12 个条目
      - 12 个加密文件

2️⃣ 请输入主密码验证

用户: ************

助手: ✅ 密码库已恢复
      - 12 条记录已导入
      - 主密钥已重建
```

### 5.2 restore.js 实现

```javascript
// restore.js
async function restore(backupPath, masterPassword) {
  // 1. 读取 vault-meta.json
  const metaPath = path.join(backupPath, 'vault-meta.json');
  const meta = JSON.parse(await fs.readFile(metaPath, 'utf8'));
  
  // 2. 用主密码 + salt 派生 key
  const derivedKey = crypto.pbkdf2Sync(
    masterPassword,
    Buffer.from(meta.salt, 'base64'),
    100000,
    32,
    'sha256'
  );
  
  // 3. 尝试解密一个 .enc 文件验证密码正确
  const secretsDir = path.join(backupPath, 'secrets');
  const testFile = (await fs.readdir(secretsDir))[0];
  if (testFile) {
    try {
      await decryptWithKey(
        path.join(secretsDir, testFile),
        derivedKey
      );
    } catch {
      throw new Error('Invalid master password');
    }
  }
  
  // 4. 存入 Keychain
  await keychain.setPassword(
    'password-vault', 'master-key',
    derivedKey.toString('base64')
  );
  
  // 5. 创建本地目录
  await fs.mkdir('data/entries', { recursive: true });
  await fs.mkdir('data/secrets', { recursive: true });
  
  // 6. 复制文件
  const entriesDir = path.join(backupPath, 'entries');
  for (const file of await fs.readdir(entriesDir)) {
    await fs.copyFile(
      path.join(entriesDir, file),
      path.join('data/entries', file)
    );
  }
  for (const file of await fs.readdir(secretsDir)) {
    await fs.copyFile(
      path.join(secretsDir, file),
      path.join('data/secrets', file)
    );
  }
  
  // 7. 写入 state.json
  await writeState({
    initialized: true,
    salt: meta.salt,
    created: meta.created,
    unlockedAt: null,
    config: { backupPath, autoDeleteDelay: 30 }
  });
  
  // 8. 设置权限
  await setPermissions();
  
  return {
    entries: (await fs.readdir('data/entries')).length
  };
}
```

---

## 6. 文件权限与 .gitignore

### 6.1 权限设置

```javascript
// lib/permissions.js
async function setPermissions() {
  await fs.chmod('data', 0o700);
  await fs.chmod('data/state.json', 0o600);
  await fs.chmod('data/entries', 0o700);
  await fs.chmod('data/secrets', 0o700);
  
  for (const file of await fs.readdir('data/secrets')) {
    await fs.chmod(`data/secrets/${file}`, 0o600);
  }
}
```

### 6.2 .gitignore

```
# password-vault
data/state.json
data/backup-status.json
data/entries/
data/secrets/
```

**说明**：entries/ 虽不含密码，但名称、分类、用途描述也是隐私信息。

---

## 7. SKILL.md

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
| 恢复密码库 | 从备份恢复 |

## 安全机制

- AES-256-GCM 加密
- Keychain 只存派生 key，不存主密码原文
- 60 分钟无操作自动锁定
- 仅限私聊使用，群聊自动禁用
- 密码消息 30 秒后自动删除
- 备份含 vault-meta.json（salt），支持灾难恢复

## 平台要求

- macOS（依赖 /usr/bin/security CLI）
- 不支持 Linux/Windows

## 已知限制

- lock() 后内存中的 key 在 GC 前仍存在
- NAS 离线时备份静默失败
```

---

## 8. 已确认需求

| 项目 | 决定 |
|------|------|
| 主密码策略 | 不需要定期修改 |
| 主密码存储 | 只存派生 key，不存原文 |
| 备份方案 | 通用路径 + vault-meta.json |
| 导入格式 | 直接文本（从 Notion 复制） |
| 返回方式 | 明文发送，30 秒后删除 |
| 解锁有效期 | 60 分钟 |
| 平台支持 | 仅 macOS |

---

*文档版本: v2.4*
*更新日期: 2026-02-14*
