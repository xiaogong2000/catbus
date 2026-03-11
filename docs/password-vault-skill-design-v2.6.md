# Password Vault Skill 设计文档 v2.6

> 基于 OpenClaw 原生能力的本地密码管理 Skill

## 1. 版本变更

### v2.5 → v2.6 变化

| 项目 | v2.5 方案 | v2.6 方案 |
|------|-----------|-----------|
| 命令脚本命名 | scripts/backup.js | scripts/sync.js（避免与 lib 冲突） |
| 孤儿清理 | 无保护 | 空目录保护 + 50% 阈值确认 |
| 导出文件名 | 日期 | 日期 + 时分 |
| update 流程 | 未描述 | 完整交互流程 |

---

## 2. 目录结构

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
│   ├── export.js             # 明文导出
│   ├── sync.js               # 手动全量同步（改名避免冲突）
│   ├── restore.js            # 灾难恢复
│   └── lib/
│       ├── crypto.js
│       ├── keychain.js
│       ├── naming.js
│       ├── backup.js         # 备份工具库
│       ├── permissions.js
│       └── frontmatter.js
├── data/
│   ├── entries/
│   ├── secrets/
│   ├── state.json
│   └── backup-status.json
└── templates/
    └── entry.md
```

---

## 3. 全量同步机制

### 3.1 fullSync 实现（含保护机制）

```javascript
// lib/backup.js
async function fullSync(options = {}) {
  const state = await readState();
  if (!state.config.backupPath) {
    return { success: false, error: 'no backup path' };
  }
  
  try {
    await fs.access(state.config.backupPath, fs.constants.W_OK);
  } catch {
    return { success: false, error: 'backup path unavailable' };
  }
  
  const dirs = [
    { src: 'data/entries', dest: 'entries' },
    { src: 'data/secrets', dest: 'secrets' }
  ];
  
  let synced = 0;
  let cleaned = 0;
  
  for (const { src, dest } of dirs) {
    const destDir = path.join(state.config.backupPath, dest);
    await fs.mkdir(destDir, { recursive: true });
    
    const localFiles = await fs.readdir(src).catch(() => []);
    const remoteFiles = await fs.readdir(destDir).catch(() => []);
    
    // 同步本地 → 备份
    for (const file of localFiles) {
      await fs.copyFile(
        path.join(src, file),
        path.join(destDir, file)
      );
      synced++;
    }
    
    // 孤儿清理保护
    const toDelete = remoteFiles.filter(f => !localFiles.includes(f));
    
    // 保护 1: 本地为空但备份有数据，跳过清理
    if (localFiles.length === 0 && remoteFiles.length > 0) {
      console.warn('⚠️ 本地数据为空但备份有数据，跳过孤儿清理');
      continue;
    }
    
    // 保护 2: 删除比例超过 50%，要求确认
    if (toDelete.length > remoteFiles.length * 0.5 && 
        toDelete.length > 3 &&
        !options.confirmCleanup) {
      return {
        type: 'confirm_cleanup',
        message: `将删除备份中 ${toDelete.length}/${remoteFiles.length} 个文件，是否确认？`,
        toDelete
      };
    }
    
    // 执行清理
    for (const file of toDelete) {
      await fs.unlink(path.join(destDir, file));
      cleaned++;
    }
  }
  
  // 同步 vault-meta
  await syncMeta();
  
  // 更新备份状态
  await writeBackupStatus({
    lastSync: Date.now(),
    lastError: null
  });
  
  return { success: true, synced, cleaned };
}
```

### 3.2 unlock 触发定期同步

```javascript
// lib/crypto.js unlock() 末尾
async function unlock(inputPassword) {
  // ... 验证和存储 sessionKey ...
  
  state.unlockedAt = Date.now();
  await writeState(state);
  
  // 检查是否需要全量同步（超过 24 小时）
  const backupStatus = await readBackupStatus();
  const oneDayMs = 24 * 60 * 60 * 1000;
  
  if (!backupStatus.lastSync || 
      Date.now() - backupStatus.lastSync > oneDayMs) {
    fullSync({ confirmCleanup: true }).catch(err => {
      console.warn('⚠️ 定期备份失败:', err.message);
    });
  }
  
  return derivedKey;
}
```

### 3.3 手动备份命令

```
用户: 备份密码库

助手: 🔄 开始全量同步...

✅ 备份完成
- 同步文件: 24 个
- 清理孤儿: 2 个
- 备份目录: /Volumes/NAS/backups/password-vault
```

**大量删除时的确认流程：**

```
用户: 备份密码库

助手: ⚠️ 检测到将删除备份中 8/12 个文件
这可能是因为本地删除了大量记录。

确认继续？回复 Y 确认，N 取消

用户: Y

助手: ✅ 备份完成
- 同步文件: 4 个
- 清理孤儿: 8 个
```

---

## 4. 明文导出功能

### 4.1 export.js 实现

```javascript
// export.js
async function exportAll(outputPath = null) {
  const key = await getSessionKey();
  const entries = await listEntries();
  const grouped = groupBy(entries, 'category');
  
  // 默认文件名：日期 + 时分
  if (!outputPath) {
    const now = new Date();
    const timestamp = now.toISOString()
      .replace(/[-:]/g, '')
      .slice(0, 13); // 20260214T1530
    outputPath = path.join(
      os.homedir(),
      'Desktop',
      `vault-export-${timestamp}.md`
    );
  }
  
  const icons = {
    '邮箱': '📧',
    '视频': '🎬',
    '支付': '💳',
    '社交': '💬',
    '游戏': '🎮',
    '工具': '🔧',
    '购物': '🛒',
    '金融': '🏦',
    '未分类': '📁'
  };
  
  let md = `# Password Vault Export\n\n`;
  md += `> 导出时间: ${new Date().toISOString()}\n`;
  md += `> 条目数量: ${entries.length}\n\n`;
  md += `---\n\n`;
  
  for (const [category, items] of Object.entries(grouped)) {
    const icon = icons[category] || '📁';
    md += `## ${icon} ${category}\n\n`;
    
    for (const item of items) {
      const secret = await decrypt(`data/secrets/${item.id}.enc`);
      md += `### ${item.name}\n\n`;
      md += `- **网址**: ${secret.url || 'N/A'}\n`;
      md += `- **用户名**: ${secret.username}\n`;
      md += `- **密码**: \`${secret.password}\`\n`;
      if (secret.notes) {
        md += `- **备注**: ${secret.notes}\n`;
      }
      md += `- **更新时间**: ${secret.updated_at}\n\n`;
    }
    
    md += `---\n\n`;
  }
  
  await fs.writeFile(outputPath, md, 'utf8');
  await fs.chmod(outputPath, 0o600);
  
  return { count: entries.length, path: outputPath };
}
```

### 4.2 导出交互流程

```
用户: 导出所有密码

助手: ⚠️ 将以明文导出所有密码到 Markdown 文件

默认路径: ~/Desktop/vault-export-20260214T1530.md

请输入主密码确认（即使已解锁也需验证）

用户: ************

助手: ✅ 已导出 12 条记录
文件: ~/Desktop/vault-export-20260214T1530.md

⚠️ 安全警告：
- 此文件包含所有明文密码
- 使用后请立即安全删除
- 切勿上传云端或发送给他人
```

---

## 5. 更新密码流程

### 5.1 update.js 实现

```javascript
// update.js
async function update(id, updates) {
  const key = await getSessionKey();
  
  // 读取现有数据
  const mdPath = `data/entries/${id}.md`;
  const encPath = `data/secrets/${id}.enc`;
  
  const metadata = await readFrontmatter(mdPath);
  const secret = await decrypt(encPath);
  
  // 合并更新
  const newSecret = {
    ...secret,
    ...updates,
    updated_at: new Date().toISOString().slice(0, 10)
  };
  
  // 如果更新了 name，同时更新元数据
  if (updates.name && updates.name !== metadata.name) {
    metadata.name = updates.name;
    metadata.updated = newSecret.updated_at;
    await writeFrontmatter(mdPath, metadata);
  }
  
  // 写入加密数据
  await encrypt(encPath, newSecret);
  
  // 异步备份
  syncToBackup(mdPath, 'entry').catch(() => {});
  syncToBackup(encPath, 'secret').catch(() => {});
  
  return {
    id,
    name: metadata.name,
    updated: Object.keys(updates)
  };
}
```

### 5.2 更新交互流程

```
用户: 更新 Netflix 密码

助手: 🔍 找到：Netflix 家庭账号

当前信息：
- 网址: https://netflix.com
- 用户名: family@gmail.com
- 密码: ******（已隐藏）

请发送要更新的内容（只需发送要改的字段）：

用户: 密码: newpass456

助手: ✅ 已更新「Netflix 家庭账号」
- 密码: 已更新
- 其他字段: 未变
```

**更新多个字段：**

```
用户: 更新 Netflix

助手: 🔍 找到：Netflix 家庭账号
...

用户: 用户名: newemail@gmail.com
密码: newpass789
备注: 改成年付了

助手: ✅ 已更新「Netflix 家庭账号」
- 用户名: 已更新
- 密码: 已更新
- 备注: 已更新
```

---

## 6. 恢复流程

### 6.1 冲突检测 + 备份路径分离

```javascript
// restore.js
async function restore(backupPath, masterPassword, options = {}) {
  // 1. 检测本地已有数据
  const existingEntries = await fs.readdir('data/entries').catch(() => []);
  
  if (existingEntries.length > 0 && !options.confirmOverwrite) {
    return {
      type: 'confirm_overwrite',
      message: `本地已有 ${existingEntries.length} 条记录，恢复将覆盖。是否继续？`,
      existingCount: existingEntries.length
    };
  }
  
  // 2. 读取 vault-meta.json
  const metaPath = path.join(backupPath, 'vault-meta.json');
  const meta = JSON.parse(await fs.readFile(metaPath, 'utf8'));
  
  // 3. 验证主密码
  const derivedKey = crypto.pbkdf2Sync(
    masterPassword,
    Buffer.from(meta.salt, 'base64'),
    100000,
    32,
    'sha256'
  );
  
  // 4. 尝试解密验证
  const secretsDir = path.join(backupPath, 'secrets');
  const testFile = (await fs.readdir(secretsDir))[0];
  if (testFile) {
    try {
      await decryptWithKey(path.join(secretsDir, testFile), derivedKey);
    } catch {
      throw new Error('Invalid master password');
    }
  }
  
  // 5. 存入 Keychain
  await keychain.setPassword(
    'password-vault', 'master-key',
    derivedKey.toString('base64')
  );
  
  // 6. 创建本地目录
  await fs.mkdir('data/entries', { recursive: true });
  await fs.mkdir('data/secrets', { recursive: true });
  
  // 7. 复制文件
  const entriesDir = path.join(backupPath, 'entries');
  let count = 0;
  
  for (const file of await fs.readdir(entriesDir)) {
    await fs.copyFile(
      path.join(entriesDir, file),
      path.join('data/entries', file)
    );
    count++;
  }
  
  for (const file of await fs.readdir(secretsDir)) {
    await fs.copyFile(
      path.join(secretsDir, file),
      path.join('data/secrets', file)
    );
  }
  
  // 8. 写入 state.json（backupPath 为空，稍后设置）
  await writeState({
    initialized: true,
    salt: meta.salt,
    created: meta.created,
    unlockedAt: null,
    config: { backupPath: null, autoDeleteDelay: 30 }
  });
  
  // 9. 设置权限
  await setPermissions();
  
  return { type: 'success', count, needBackupPath: true };
}
```

### 6.2 恢复交互流程

```
用户: 恢复密码库

助手: 🔄 开始恢复

1️⃣ 请输入备份目录路径

用户: /Volumes/USB/vault-backup

助手: ✅ 找到备份
- vault-meta.json ✓
- 12 个条目
- 12 个加密文件

2️⃣ 请输入主密码验证

用户: ************

助手: ✅ 密码库已恢复（12 条记录）

3️⃣ 请设置日常备份路径
（可与恢复源不同，回复 N 跳过）

用户: /Volumes/NAS/backups/password-vault

助手: ✅ 备份路径已设置
- 日常备份: /Volumes/NAS/backups/password-vault
- 首次全量同步已完成
```

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
| 更新 xxx | 更新指定条目的字段 |
| 列出所有密码 | 显示全部条目 |
| 列出 xxx 类密码 | 按分类过滤 |
| 删除 xxx | 删除条目 |
| 锁定密码库 | 手动锁定 |
| 导入密码 | 批量导入 |
| 导出所有密码 | 明文导出到 Markdown 文件 |
| 备份密码库 | 手动全量同步到备份目录 |
| 恢复密码库 | 从备份恢复 |

## 安全机制

- AES-256-GCM 加密
- Keychain 只存派生 key，不存主密码原文
- 60 分钟无操作自动锁定
- 仅限私聊使用，群聊自动禁用
- 密码消息 30 秒后自动删除
- 定期全量同步（解锁时检查，超过 24h 自动执行）
- 孤儿清理保护（空目录跳过，大量删除需确认）
- 备份含 vault-meta.json（salt），支持灾难恢复

## 平台要求

- macOS（依赖 /usr/bin/security CLI）
- 不支持 Linux/Windows

## 已知限制

- lock() 后内存中的 key 在 GC 前仍存在
- NAS 离线时备份静默失败
- 导出文件为明文，使用后需手动删除
```

---

## 8. 备份策略总结

| 触发方式 | 时机 | 范围 | 保护机制 |
|----------|------|------|----------|
| 事件驱动 | add/update/delete 后 | 单文件 | 无 |
| 定期同步 | unlock 时超过 24h | 全量 | 自动确认清理 |
| 手动同步 | 用户命令 | 全量 | 空目录保护 + 50% 阈值 |

---

## 9. 已确认需求

| 项目 | 决定 |
|------|------|
| 主密码策略 | 不需要定期修改 |
| 主密码存储 | 只存派生 key，不存原文 |
| 备份方案 | 事件驱动 + 定期全量 + 手动 |
| 导入格式 | 直接文本（从 Notion 复制） |
| 导出格式 | Markdown 明文（~/Desktop，含时分） |
| 返回方式 | 明文发送，30 秒后删除 |
| 解锁有效期 | 60 分钟 |
| 平台支持 | 仅 macOS |

---

*文档版本: v2.6*
*更新日期: 2026-02-14*
