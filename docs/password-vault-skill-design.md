# Password Vault Skill 设计文档

> 本地密码管理 Skill，支持语义搜索，安全存储

## 1. 需求背景

### 痛点
- 大量账号密码分散在 Notion 等地方
- 每次查询需要手动翻找，效率低
- 无法通过自然语言快速定位

### 目标
- 通过对话直接查询："我的 Gmail 密码是什么"
- 支持语义搜索（问"谷歌邮箱"能匹配到 Gmail）
- 本地存储，安全可控

### 使用场景
```
用户: 我的 PS5 密码是什么
助手: 
  🎮 PlayStation Network
  网站: https://playstation.com
  用户名: xxx@email.com
  密码: ********（点击复制）

用户: 公司邮箱密码
助手:
  📧 Outlook 企业邮箱
  网站: https://outlook.office.com
  用户名: xxx@company.com
  密码: ********
```

---

## 2. 核心设计

### 2.1 数据分离架构

```
┌─────────────────────────────────────────────────┐
│                  QMD 向量索引                    │
│  （只存元数据：名称、描述、标签，不含密码）        │
└─────────────────────────────────────────────────┘
                        │
                        │ 语义搜索匹配
                        ▼
                   返回条目 ID
                        │
                        ▼
┌─────────────────────────────────────────────────┐
│              加密存储 (vault.enc)                │
│    （AES-256 加密的完整数据：URL/用户名/密码）    │
└─────────────────────────────────────────────────┘
```

**为什么分离？**
- 向量库可被搜索，但不含敏感信息
- 密码加密存储，只有匹配后才解密
- 即使向量库泄露，也不会暴露密码

### 2.2 数据结构

**元数据（可搜索，存入 QMD）**
```json
{
  "id": "gmail-personal",
  "name": "Gmail 个人邮箱",
  "category": "邮箱",
  "description": "Google 邮件服务，日常通讯、注册账号用",
  "tags": ["邮件", "谷歌", "google", "email", "个人"]
}
```

**敏感数据（加密存储）**
```json
{
  "gmail-personal": {
    "url": "https://mail.google.com",
    "username": "myname@gmail.com",
    "password": "加密后的密码",
    "notes": "备用邮箱: backup@xxx.com",
    "updated_at": "2026-02-14"
  }
}
```

---

## 3. 安全方案

### 3.1 加密机制

| 组件 | 方案 |
|------|------|
| 加密算法 | AES-256-GCM |
| 主密钥存储 | macOS Keychain |
| 密钥派生 | PBKDF2 (100,000 iterations) |
| 文件权限 | chmod 600 |

### 3.2 主密钥管理

```bash
# 首次设置：用户输入主密码，存入 Keychain
security add-generic-password -a "password-vault" -s "master-key" -w "派生后的密钥"

# 使用时：从 Keychain 读取
security find-generic-password -a "password-vault" -s "master-key" -w
```

**优势**：
- 主密钥不落盘，由系统保护
- 需要 Touch ID / 系统密码才能访问
- 重启后自动锁定

### 3.3 访问控制

| 场景 | 是否允许 |
|------|----------|
| 主会话（Telegram 私聊） | ✅ 允许 |
| 群聊 | ❌ 禁止 |
| 子代理 / Spawn | ❌ 禁止 |
| 未解锁状态 | ❌ 禁止 |

### 3.4 会话安全

- 解锁后 60 分钟自动锁定
- 可手动锁定：`vault lock`
- 敏感操作需确认

---

## 4. 技术实现

### 4.1 目录结构

```
~/.openclaw/workspace/skills/password-vault/
├── SKILL.md                 # Skill 说明文档
├── scripts/
│   ├── init.js              # 初始化 vault
│   ├── import.js            # 从 CSV/JSON 导入
│   ├── search.js            # 语义搜索
│   ├── add.js               # 添加条目
│   ├── update.js            # 更新条目
│   ├── delete.js            # 删除条目
│   ├── lock.js              # 锁定
│   ├── unlock.js            # 解锁
│   └── lib/
│       ├── crypto.js        # 加解密工具
│       ├── keychain.js      # Keychain 操作
│       └── qmd.js           # QMD 索引操作
├── data/
│   ├── vault.enc            # 加密的密码数据
│   └── metadata.json        # 元数据（供 QMD 索引）
└── templates/
    └── import-template.csv  # 导入模板
```

### 4.2 核心流程

**初始化**
```
1. 用户设置主密码
2. PBKDF2 派生密钥
3. 存入 macOS Keychain
4. 创建空的 vault.enc
```

**导入数据**
```
1. 读取 CSV/JSON 文件
2. 分离元数据和敏感数据
3. 元数据 → metadata.json → QMD 索引
4. 敏感数据 → AES 加密 → vault.enc
```

**查询流程**
```
用户: "Gmail 密码"
  ↓
1. 检查是否已解锁
  ↓
2. QMD 语义搜索 metadata
  ↓
3. 返回匹配的条目 ID
  ↓
4. 从 Keychain 获取主密钥
  ↓
5. 解密 vault.enc 中对应条目
  ↓
6. 返回结果给用户
```

### 4.3 QMD 集成

```bash
# 创建专用 collection
qmd collection create password-vault

# 索引元数据
qmd embed --collection password-vault --path data/metadata.json

# 搜索
qmd search --collection password-vault "谷歌邮箱"
```

---

## 5. 使用方式

### 5.1 初始化

```
用户: 初始化密码库
助手: 请设置主密码（至少 12 位）
用户: ************
助手: ✅ 密码库已创建，主密钥已存入 Keychain
```

### 5.2 导入数据

```
用户: 导入密码，文件在 ~/passwords.csv
助手: 
  ✅ 导入完成
  - 总计: 58 条
  - 成功: 58 条
  - 已建立语义索引
```

### 5.3 查询

```
用户: 我的 Netflix 密码
助手:
  🎬 Netflix 视频会员
  网站: https://netflix.com
  用户名: xxx@gmail.com
  密码: ••••••••
  
  [复制密码] [复制用户名]
```

### 5.4 管理

```
用户: 添加新密码
用户: 更新 Netflix 密码
用户: 锁定密码库
用户: 列出所有邮箱类密码
```

---

## 6. 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| 主密码泄露 | 存 Keychain，需系统认证 |
| 向量库泄露 | 不含密码，只有元数据 |
| 内存中明文 | 用完立即清零 |
| 误发到群聊 | 检测会话类型，群聊禁用 |
| 暴力破解 | PBKDF2 高迭代次数 |

---

## 7. 后续扩展

- [ ] 支持 TOTP 两步验证码
- [ ] 密码强度检测
- [ ] 过期提醒
- [ ] 多设备同步（加密后同步）
- [ ] 浏览器插件集成

---

## 8. 使用流程（确认版）

### 8.1 存储密码

```
用户: 刚注册了 Netflix
      网址: https://netflix.com
      用户名: xxx@gmail.com
      密码: abc123
      备注: 家庭套餐，每月 15 号扣费

用户: 存下密码

助手: ✅ 已保存 Netflix 账号信息
```

**流程**：
1. 用户发送账号信息（网址、用户名、密码、备注）
2. 用户说"存下密码"
3. Skill 自动提取信息，加密存储
4. 元数据写入向量索引
5. 确认保存成功

### 8.2 查询密码

```
用户: Netflix 密码是什么

# 如果未解锁或已超时
助手: 🔍 找到 1 条匹配记录：Netflix
      请输入主密码验证

用户: ************

助手: 🔓 已解锁，60 分钟内免验证
  
  🎬 Netflix
  网址: https://netflix.com
  用户名: xxx@gmail.com
  密码: abc123
  备注: 家庭套餐，每月 15 号扣费

# 如果已解锁且未超时
用户: Gmail 密码

助手:
  📧 Gmail 个人邮箱
  网址: https://mail.google.com
  用户名: xxx@gmail.com
  密码: xyz789
```

**流程**：
1. 用户询问密码
2. Skill 语义搜索，找到匹配项
3. 检查解锁状态：
   - 未解锁/已超时 → 要求输入主密码
   - 已解锁且未超时 → 直接返回
4. 明文发送完整信息

### 8.3 流程图

```
┌─────────────────────────────────────────────────────────┐
│                      存储流程                            │
├─────────────────────────────────────────────────────────┤
│  用户发送账号信息 → "存下密码" → 加密存储 → 建立索引     │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                      查询流程                            │
├─────────────────────────────────────────────────────────┤
│  用户询问 → 语义搜索 → 要求主密码 → 验证 → 明文返回      │
└─────────────────────────────────────────────────────────┘
```

---

## 9. 待确认问题（已完成）

1. ~~**主密码策略**：是否需要定期更换？~~ → **不需要定期修改**
2. ~~**备份方案**：加密文件如何备份？~~ → **放 iCloud 自动同步**
3. ~~**导入格式**：Notion 导出格式是什么？~~ → **直接文本**
4. ~~**返回方式**：密码是明文显示还是需要点击复制？~~ → **明文显示，通过 Telegram 发送**

---

## 9. OpenClaw Skill 规范

### 9.1 SKILL.md 结构

```markdown
# Password Vault

本地密码管理，支持语义搜索，安全存储。

## 触发场景

- 用户询问密码："我的 xxx 密码是什么"
- 密码管理操作："添加密码"、"导入密码"、"锁定密码库"

## 命令

| 命令 | 说明 |
|------|------|
| vault init | 初始化密码库 |
| vault unlock | 解锁 |
| vault lock | 锁定 |
| vault search <query> | 搜索密码 |
| vault add | 添加条目 |
| vault import <file> | 导入 |
| vault list [category] | 列出条目 |

## 安全须知

- 仅限主会话使用
- 群聊/共享会话自动禁用
- 30 分钟无操作自动锁定
```

### 9.2 Skill 调用方式

**Agent 自动识别**
```
用户: "我的 Netflix 密码"
  ↓
OpenClaw 匹配 SKILL.md 描述
  ↓
读取 SKILL.md
  ↓
调用 scripts/search.js "Netflix"
  ↓
返回结果
```

**脚本调用规范**
```bash
# 所有脚本统一入口格式
node scripts/search.js --query "Netflix"
node scripts/add.js --name "Netflix" --url "..." --username "..." --password "..."
node scripts/import.js --file ~/passwords.csv
```

### 9.3 与 OpenClaw 集成点

| 集成点 | 实现方式 |
|--------|----------|
| 语义搜索 | QMD memory_search 或独立 collection |
| 会话检测 | 读取 inbound_meta.chat_type |
| 安全存储 | macOS Keychain + 加密文件 |
| 状态管理 | ~/.openclaw/workspace/skills/password-vault/data/state.json |

### 9.4 安全检查代码

```javascript
// scripts/lib/security.js
function checkAccess(context) {
  // 1. 检查会话类型
  if (context.chat_type !== 'direct') {
    throw new Error('❌ 密码库仅限私聊使用');
  }
  
  // 2. 检查是否已解锁
  const state = readState();
  if (!state.unlocked) {
    throw new Error('🔒 密码库已锁定，请先解锁');
  }
  
  // 3. 检查超时
  const elapsed = Date.now() - state.lastAccess;
  if (elapsed > 30 * 60 * 1000) {
    lockVault();
    throw new Error('⏰ 会话超时，请重新解锁');
  }
  
  return true;
}
```

### 9.5 输出格式

```javascript
// 返回给 OpenClaw 的标准格式
{
  "success": true,
  "data": {
    "name": "Netflix 视频会员",
    "url": "https://netflix.com",
    "username": "xxx@gmail.com",
    "password": "••••••••",  // 默认隐藏
    "raw_password": "actual_password"  // 供复制
  },
  "actions": [
    { "label": "复制密码", "action": "copy", "value": "password" },
    { "label": "复制用户名", "action": "copy", "value": "username" }
  ]
}
```

---

*文档版本: v1.0*
*创建日期: 2026-02-14*
