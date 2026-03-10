# Password Vault Skill 设计文档 v2

> 基于 OpenClaw 原生能力的本地密码管理 Skill

## 1. 设计变更

### v1 → v2 主要变化

| 项目 | v1 方案 | v2 方案 |
|------|---------|---------|
| 向量搜索 | 独立 QMD collection | 复用 OpenClaw memory_search |
| 元数据存储 | 单独 JSON 文件 | Markdown 文件（自动被索引） |
| 索引维护 | 手动脚本 | OpenClaw 自动处理 |
| 复杂度 | 高（需要管理索引） | 低（利用现有基础设施） |

---

## 2. 核心架构

### 2.1 数据分离

```
┌─────────────────────────────────────────────────┐
│           ~/.openclaw/workspace/skills/         │
│              password-vault/data/               │
├─────────────────────────────────────────────────┤
│  entries/                                       │
│  ├── gmail-personal.md    ← 元数据（可搜索）     │
│  ├── netflix.md                                 │
│  ├── ps5.md                                     │
│  └── ...                                        │
│                                                 │
│  vault.enc                ← 加密的敏感数据       │
│  state.json               ← 解锁状态            │
└─────────────────────────────────────────────────┘
```

### 2.2 元数据文件格式（Markdown）

每个账号一个 `.md` 文件，OpenClaw 的 QMD 会自动索引：

```markdown
---
id: gmail-personal
name: Gmail 个人邮箱
category: 邮箱
---

# Gmail 个人邮箱

Google 邮件服务，日常通讯、注册账号用。

## 标签
- 邮件
- 谷歌
- google
- email
- 个人
- 主力邮箱

## 用途
日常收发邮件，各种网站注册的主邮箱。
```

### 2.3 加密数据格式（vault.enc）

```json
{
  "gmail-personal": {
    "url": "https://mail.google.com",
    "username": "myname@gmail.com",
    "password": "AES加密后的密码",
    "notes": "备用邮箱: backup@xxx.com",
    "updated_at": "2026-02-14"
  }
}
```

---

## 3. 查询流程

```
用户: "Gmail 密码是什么"
        ↓
1. OpenClaw 识别密码查询意图
        ↓
2. 调用 memory_search 搜索 entries/*.md
        ↓
3. 匹配到 gmail-personal.md，提取 id
        ↓
4. 检查解锁状态（state.json）
   - 未解锁/超时 → 要求输入主密码
   - 已解锁 → 继续
        ↓
5. 从 Keychain 获取主密钥
        ↓
6. 解密 vault.enc 中对应条目
        ↓
7. 明文返回给用户
```

---

## 4. 安全方案

### 4.1 加密机制

| 组件 | 方案 |
|------|------|
| 加密算法 | AES-256-GCM |
| 主密钥存储 | macOS Keychain |
| 密钥派生 | PBKDF2 (100,000 iterations) |
| 文件权限 | chmod 600 |

### 4.2 访问控制

| 场景 | 是否允许 |
|------|----------|
| 主会话（Telegram 私聊） | ✅ 允许 |
| 群聊 | ❌ 禁止 |
| 子代理 / Spawn | ❌ 禁止 |

### 4.3 会话管理

- 解锁后 **60 分钟**内免验证
- 可手动锁定
- 状态存储在 `state.json`

---

## 5. 目录结构

```
~/.openclaw/workspace/skills/password-vault/
├── SKILL.md                 # Skill 说明
├── scripts/
│   ├── init.js              # 初始化
│   ├── add.js               # 添加条目
│   ├── search.js            # 搜索（配合 memory_search）
│   ├── get.js               # 获取密码
│   ├── update.js            # 更新
│   ├── delete.js            # 删除
│   ├── lock.js              # 锁定
│   ├── unlock.js            # 解锁
│   ├── import.js            # 批量导入
│   └── lib/
│       ├── crypto.js        # 加解密
│       └── keychain.js      # Keychain 操作
├── data/
│   ├── entries/             # 元数据 markdown（被 QMD 索引）
│   │   ├── gmail-personal.md
│   │   └── ...
│   ├── vault.enc            # 加密的密码数据
│   └── state.json           # 解锁状态
└── templates/
    └── entry.md             # 条目模板
```

---

## 6. SKILL.md 内容

```markdown
---
name: password-vault
description: 本地密码管理，支持语义搜索，安全存储
metadata: {"openclaw":{"requires":{"bins":["security"]}}}
---

# Password Vault

本地密码管理 Skill，支持语义搜索。

## 触发场景

- 用户询问密码："我的 xxx 密码是什么"
- 密码管理："存下密码"、"添加密码"、"锁定密码库"

## 使用方式

### 存储密码
用户发送账号信息后说"存下密码"，自动提取并加密存储。

### 查询密码
直接问"xxx 密码"，语义搜索匹配后返回。

### 安全须知
- 仅限主会话（私聊）使用
- 群聊自动禁用
- 60 分钟无操作自动锁定
```

---

## 7. QMD 集成

### 7.1 自动索引

OpenClaw 的 QMD 后端会自动索引 `data/entries/*.md`，无需手动维护。

配置方式（如需单独 collection）：

```json
{
  "memory": {
    "qmd": {
      "paths": [
        {
          "name": "password-vault",
          "path": "~/.openclaw/workspace/skills/password-vault/data/entries",
          "pattern": "**/*.md"
        }
      ]
    }
  }
}
```

### 7.2 搜索调用

```javascript
// 使用 OpenClaw 的 memory_search
const results = await memorySearch("谷歌邮箱");
// 返回匹配的 entries/*.md 文件
```

---

## 8. 使用流程

### 8.1 初始化

```
用户: 初始化密码库
助手: 请设置主密码（至少 12 位）
用户: ************
助手: ✅ 密码库已创建，主密钥已存入 Keychain
```

### 8.2 存储密码

```
用户: 刚注册了 Netflix
      网址: https://netflix.com
      用户名: xxx@gmail.com
      密码: abc123
      备注: 家庭套餐，每月 15 号扣费

用户: 存下密码

助手: ✅ 已保存 Netflix 账号信息
```

**内部流程：**
1. 解析用户消息，提取账号信息
2. 生成 `data/entries/netflix.md`（元数据）
3. 加密密码，写入 `vault.enc`
4. QMD 自动索引新文件

### 8.3 查询密码

```
用户: Netflix 密码是什么

# 未解锁时
助手: 🔍 找到匹配：Netflix
      请输入主密码验证

用户: ************

助手: 🔓 已解锁，60 分钟内免验证

  🎬 Netflix
  网址: https://netflix.com
  用户名: xxx@gmail.com
  密码: abc123
  备注: 家庭套餐，每月 15 号扣费

# 已解锁时
用户: Gmail 密码

助手:
  📧 Gmail 个人邮箱
  网址: https://mail.google.com
  用户名: xxx@gmail.com
  密码: xyz789
```

---

## 9. 已确认需求

| 项目 | 决定 |
|------|------|
| 主密码策略 | 不需要定期修改 |
| 备份方案 | 加密文件放 iCloud 自动同步 |
| 导入格式 | 直接文本（从 Notion 复制） |
| 返回方式 | 明文通过 Telegram 发送 |
| 解锁有效期 | 60 分钟 |

---

## 10. 实现优势

### 相比 v1 的改进

1. **零索引维护** — QMD 自动处理
2. **原生集成** — 复用 OpenClaw memory_search
3. **更简单** — 减少 50% 代码量
4. **更可靠** — 依赖成熟的 OpenClaw 基础设施

### 安全性不变

- AES-256-GCM 加密
- macOS Keychain 存储主密钥
- 会话超时自动锁定
- 群聊禁用

---

*文档版本: v2.0*
*创建日期: 2026-02-14*
