# Password Vault Skill 设计文档 v3.0

> 基于 OpenClaw + qmd 向量搜索的本地密码管理 Skill

## 1. 版本变更

### v2.6 → v3.0 变化

| 项目 | v2.6 方案 | v3.0 方案 |
|------|-----------|-----------|
| 搜索方式 | 关键词匹配 | qmd 向量语义搜索 + 关键词 fallback |
| 索引存储 | 无 | qmd collection `password-vault` |
| 向量模型 | 无 | embeddinggemma（本地） |
| 密码存储 | AES-256-GCM 加密 | 不变，密码不进向量库 |

---

## 2. 架构概览

```
┌─────────────────────────────────────────────────────────┐
│                      用户查询                            │
│                  "查下我的视频网站"                       │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│                   search.js                              │
│  1. 调用 qmd query 语义搜索                              │
│  2. 解析返回的 entry IDs                                 │
│  3. 如果无结果，fallback 到关键词搜索                    │
└─────────────────────┬───────────────────────────────────┘
                      │
          ┌───────────┴───────────┐
          ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│   qmd 向量库     │     │  entries/*.md   │
│  (元数据索引)    │     │  (明文元数据)    │
│  - 名称          │     │  - id           │
│  - 分类          │     │  - name         │
│  - 标签          │     │  - category     │
│  - 描述          │     │  - tags         │
│  ❌ 不含密码     │     │  ❌ 不含密码     │
└─────────────────┘     └─────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│                    get.js                                │
│  根据 entry ID 解密 secrets/{id}.enc 获取密码            │
└─────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│                 secrets/*.enc                            │
│              AES-256-GCM 加密存储                        │
│  - url                                                   │
│  - username                                              │
│  - password  ✅ 密码只在这里                             │
│  - notes                                                 │
└─────────────────────────────────────────────────────────┘
```

---

## 3. 目录结构

```
~/.openclaw/workspace/skills/password-vault/
├── SKILL.md                    # Skill 描述
├── scripts/
│   ├── init.js                 # 初始化密码库
│   ├── add.js                  # 添加条目
│   ├── search.js               # 搜索（qmd + fallback）
│   ├── get.js                  # 获取密码（解密）
│   ├── update.js               # 更新条目
│   ├── delete.js               # 删除条目
│   ├── list.js                 # 列出所有
│   ├── lock.js                 # 锁定
│   ├── unlock.js               # 解锁
│   ├── import.js               # 批量导入
│   ├── export.js               # 明文导出
│   ├── sync.js                 # 同步到备份
│   ├── restore.js              # 灾难恢复
│   ├── reindex.js              # 重建 qmd 索引（新增）
│   └── lib/
│       ├── crypto.js           # 加密解密
│       ├── keychain.js         # macOS Keychain
│       ├── naming.js           # 文件命名
│       ├── backup.js           # 备份工具
│       ├── permissions.js      # 权限检查
│       ├── frontmatter.js      # YAML 解析
│       └── qmd.js              # qmd 集成（新增）
├── data/
│   ├── entries/                # 元数据文件（明文）
│   ├── secrets/                # 加密密码文件
│   ├── state.json              # 状态
│   └── vault-meta.json         # 元信息
└── templates/
    └── entry.md
```

---

## 4. 安全架构

### 4.1 数据分离原则

| 存储位置 | 内容 | 加密 | 进向量库 |
|----------|------|------|----------|
| `entries/*.md` | 名称、分类、标签 | ❌ 明文 | ✅ 是 |
| `secrets/*.enc` | URL、用户名、密码、备注 | ✅ AES-256-GCM | ❌ 否 |
| qmd 向量库 | entries 的向量嵌入 | ❌ 明文 | - |
| macOS Keychain | 派生密钥、会话密钥 | ✅ 系统加密 | ❌ 否 |

### 4.2 密码永不进入向量库

```javascript
// entries/xxx.md 示例（会被 qmd 索引）
---
id: netflix-80ae8f8a
name: Netflix 奈飞
category: 视频
tags: [streaming, 奈飞小铺]
created_at: 2026-02-14
---

// secrets/netflix-80ae8f8a.enc（加密，不会被索引）
{
  "url": "https://netflix.com",
  "username": "xxx@xxx.com",
  "password": "xxxxxx",        // 只在这里
  "notes": "用头像2\n奈飞小铺车票"
}
```

### 4.3 加密方案

- **算法**：AES-256-GCM
- **密钥派生**：PBKDF2（100,000 次迭代）
- **主密码**：用户输入，不存储
- **派生密钥**：存 macOS Keychain
- **会话密钥**：解锁后存 Keychain，60 分钟过期

---

## 5. qmd 向量搜索集成

### 5.1 Collection 配置

```bash
# 创建 collection（只索引 entries，不含 secrets）
qmd collection add ~/.openclaw/workspace/skills/password-vault/data/entries \
  --name password-vault \
  --mask "**/*.md"

# 生成向量嵌入
qmd embed
```

### 5.2 搜索流程

```javascript
// lib/qmd.js
const { execSync } = require('child_process');

async function semanticSearch(query, limit = 10) {
  try {
    const result = execSync(
      `qmd query "${query}" --collection password-vault --limit ${limit} --json`,
      { encoding: 'utf8', timeout: 30000 }
    );
    
    const matches = JSON.parse(result);
    return matches.map(m => ({
      id: extractIdFromPath(m.path),
      name: m.title,
      score: m.score
    }));
  } catch (err) {
    // qmd 失败时 fallback 到关键词搜索
    return null;
  }
}
```

### 5.3 search.js 改进

```javascript
// search.js - 语义搜索 + 关键词 fallback
async function search(query) {
  // 1. 尝试 qmd 语义搜索
  const semanticResults = await qmd.semanticSearch(query);
  
  if (semanticResults && semanticResults.length > 0) {
    return {
      type: semanticResults.length === 1 ? 'single' : 'multiple',
      entries: semanticResults,
      method: 'semantic'
    };
  }
  
  // 2. Fallback 到关键词搜索
  const keywordResults = await keywordSearch(query);
  return {
    type: keywordResults.length === 1 ? 'single' : 'multiple',
    entries: keywordResults,
    method: 'keyword'
  };
}
```

### 5.4 索引更新时机

| 操作 | 触发索引更新 |
|------|-------------|
| add.js | ✅ 自动 `qmd update` |
| update.js | ✅ 自动 `qmd update` |
| delete.js | ✅ 自动 `qmd update` |
| import.js | ✅ 批量后 `qmd update && qmd embed` |
| reindex.js | ✅ 手动全量重建 |

---

## 6. 备份与恢复

### 6.1 备份内容

```
/Volumes/Backup/OpenClaw/password-vault/
├── entries/          # 元数据文件
├── secrets/          # 加密密码文件
└── vault-meta.json   # salt 等元信息

/Volumes/Backup/OpenClaw/password-vault-skill/
├── SKILL.md
├── scripts/
├── templates/
└── README.md         # 使用说明
```

### 6.2 恢复步骤

```bash
# 1. 复制 Skill
cp -r /Volumes/Backup/OpenClaw/password-vault-skill \
  ~/.openclaw/workspace/skills/password-vault

# 2. 复制数据
cp -r /Volumes/Backup/OpenClaw/password-vault/entries \
  ~/.openclaw/workspace/skills/password-vault/data/
cp -r /Volumes/Backup/OpenClaw/password-vault/secrets \
  ~/.openclaw/workspace/skills/password-vault/data/
cp /Volumes/Backup/OpenClaw/password-vault/vault-meta.json \
  ~/.openclaw/workspace/skills/password-vault/data/

# 3. 重建 qmd 索引
qmd collection add ~/.openclaw/workspace/skills/password-vault/data/entries \
  --name password-vault --mask "**/*.md"
qmd embed

# 4. 解锁使用
cd ~/.openclaw/workspace/skills/password-vault
node scripts/unlock.js "主密码"
```

---

## 7. 使用方式

### 7.1 通过 NeFi 对话（推荐）

```
用户: 查下我的视频网站
NeFi: 🔍 找到 13 个视频相关账号：
      1. Netflix 奈飞
      2. EMBY 云海影视
      ...
      要查哪个的密码？

用户: 1
NeFi: 🎬 Netflix 奈飞
      网址: netflix.com
      用户名: xxx@xxx.com
      密码: xxxxxx
      备注: 用头像2，奈飞小铺车票
      
      ⚠️ 请手动删除此消息
```

### 7.2 命令行

```bash
cd ~/.openclaw/workspace/skills/password-vault

# 解锁
node scripts/unlock.js "主密码"

# 语义搜索
qmd query "视频网站" --collection password-vault

# 关键词搜索
node scripts/search.js "netflix"

# 获取密码
node scripts/get.js "netflix-80ae8f8a"

# 添加
echo '{"name":"xxx","category":"xxx","username":"xxx","password":"xxx"}' | node scripts/add.js

# 同步备份
node scripts/sync.js --confirm

# 重建索引
node scripts/reindex.js
```

---

## 8. 配置参数

```javascript
// data/state.json
{
  "initialized": true,
  "config": {
    "backupPath": "/Volumes/Backup/OpenClaw/password-vault",
    "autoLockMinutes": 60,
    "qmdCollection": "password-vault"
  },
  "unlockedAt": 1707912345678
}
```

---

## 9. SKILL.md

```yaml
name: password-vault
description: 本地密码管理，支持 qmd 向量语义搜索，AES-256-GCM 加密存储
triggers:
  - 查密码
  - 存密码
  - 密码库
  - password
commands:
  - unlock: 解锁密码库
  - lock: 锁定密码库
  - search: 搜索密码
  - get: 获取密码
  - add: 添加密码
  - list: 列出所有
  - sync: 同步备份
  - reindex: 重建索引
```

---

## 10. 统计

- **版本**：v3.0
- **创建日期**：2026-02-14
- **总记录**：302 条
- **向量块**：356 chunks
- **向量模型**：embeddinggemma（本地）
- **加密算法**：AES-256-GCM
- **备份路径**：`/Volumes/Backup/OpenClaw/password-vault`
```
