# QMD 分布式记忆搜索架构方案

**版本**: v1.0  
**日期**: 2026-03-08  
**状态**: 待审阅

---

## 1. 背景与目标

### 现状
- 5台机器人（Nefi/狗子/浣浣/小黑/咪咪）各自维护独立的 OpenClaw workspace
- 每台机器有自己的 MEMORY.md、daily notes、sessions 等本地知识
- 还有共享知识（OpenClaw 文档、通用知识库）每台都需要但重复存储
- 只有 Nefi (Mac M2 Max) 有 GPU，其他均为 CPU-only 服务器

### 目标
1. 每台机器人能**快速搜索自己的本地知识**（workspace/memory/sessions）
2. 每台机器人能**搜索全网共享知识**（openclaw-docs/通用知识库）
3. **GPU 算力集中在 Mac**，避免各机器重复 CPU embed 消耗
4. 架构简单，依赖少，故障隔离

---

## 2. 核心概念

### QMD Index 分层

QMD 通过 `--index <name>` 支持多个并存的 SQLite 索引文件：

```
~/.cache/qmd/
  index.sqlite      ← 本机私有索引（workspace/memory/sessions）
  shared.sqlite     ← 全网共享索引（由 Mac 构建后推送）
  [可扩展更多层]
```

两个索引完全独立，可单独搜索，也可通过 wrapper 聚合。

---

## 3. 架构设计

### 3.1 整体拓扑

```
┌─────────────────────────────────────────────────────────┐
│                    Nefi (Mac M2 Max)                    │
│                                                         │
│  本机私有索引 (index.sqlite)                             │
│  ┌─────────────────────────────────────┐                │
│  │ workspace (414 files)               │                │
│  │ memory-dir (26 files)               │  GPU embed     │
│  │ sessions-main (154 files)           │  ←───────      │
│  │ password-vault (305 files)          │                │
│  └─────────────────────────────────────┘                │
│                                                         │
│  全网共享索引 (shared.sqlite)                            │
│  ┌─────────────────────────────────────┐                │
│  │ openclaw-docs (640 files)           │  GPU embed     │
│  │ knowledge-base (通用知识库)          │  ←───────      │
│  └─────────────────────────────────────┘                │
│                      │                                  │
│                 catbus push                             │
└──────────────────────┼──────────────────────────────────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
    ┌──────────┐  ┌──────────┐  ┌──────────┐
    │  狗子    │  │  浣浣    │  │  小黑    │  (咪咪 同理)
    │ homelab  │  │ ge.ovh   │  │ fr.ovh   │
    │          │  │          │  │          │
    │ index.sqlite (本机私有)  │  │          │
    │ ┌──────┐ │  │ ┌──────┐ │  │ ┌──────┐ │
    │ │ws/   │ │  │ │ws/   │ │  │ │ws/   │ │
    │ │mem/  │ │  │ │mem/  │ │  │ │mem/  │ │
    │ │sess/ │ │  │ │sess/ │ │  │ │sess/ │ │
    │ └──────┘ │  │ └──────┘ │  │ └──────┘ │
    │ CPU embed│  │ CPU embed│  │ CPU embed│
    │          │  │          │  │          │
    │shared.sqlite (来自 Mac) │  │          │
    │ ┌──────┐ │  │ ┌──────┐ │  │ ┌──────┐ │
    │ │oc-   │ │  │ │oc-   │ │  │ │oc-   │ │
    │ │docs/ │ │  │ │docs/ │ │  │ │docs/ │ │
    │ └──────┘ │  │ └──────┘ │  │ └──────┘ │
    │ 只读，不  │  │ 只读，不  │  │ 只读，不  │
    │ 本地embed │  │ 本地embed │  │ 本地embed │
    └──────────┘  └──────────┘  └──────────┘
```

### 3.2 索引分层说明

| 层次 | Index 文件 | 内容 | 负责 embed | 更新频率 |
|------|-----------|------|-----------|---------|
| **L1 私有层** | `index.sqlite` | 本机 workspace / memory / sessions | 本机 CPU | 每天 |
| **L2 共享层** | `shared.sqlite` | openclaw-docs / 通用知识库 | Mac GPU | 每周 |
| **L3 扩展层** _(可选)_ | `project.sqlite` | 特定项目知识（如 FizzRead SEO 文档） | Mac GPU | 按需 |

---

## 4. 各机器职责

### 4.1 Nefi (Mac) — 主节点 + GPU 算力中心

```
职责：
  1. 构建并维护 shared.sqlite（GPU embed，640+ 文件）
  2. 构建并维护自己的 index.sqlite（GPU embed，私有）
  3. 定期推送 shared.sqlite 到全网（catbus push）
  4. 可选：作为 QMD MCP Server 提供远程查询服务

Cron/Heartbeat 任务：
  - 每天 03:00：qmd update && qmd embed（私有索引）
  - 每周一 04:00：qmd --index shared update && qmd --index shared embed
  - 每周一 04:30：catbus push shared.sqlite → 全网
```

### 4.2 狗子/浣浣/小黑/咪咪 — 工作节点

```
职责：
  1. 维护自己的 index.sqlite（CPU embed，自己的 workspace/memory）
  2. 接收并使用 Mac 推送的 shared.sqlite（只读）

Heartbeat 任务：
  - 每天：NODE_LLAMA_CPP_GPU=false qmd update && qmd embed
    （增量更新，通常只有几个新文件，几十秒内完成）
```

---

## 5. 搜索使用方式

### 5.1 基础用法

```bash
# 搜本机私有知识
qmd search "provider fallback"
qmd query "记忆脱水流程"          # 语义搜索（需 embed）

# 搜共享文档
qmd --index shared search "heartbeat 配置"
qmd --index shared query "gateway 启动失败"

# 指定 collection 精确搜索
qmd search "GSC 提交" -c memory-dir
qmd --index shared search "node 配置" -c openclaw-docs
```

### 5.2 聚合搜索（wrapper 脚本）

在各机器安装 `~/.local/bin/qsearch`：

```bash
#!/bin/bash
# 聚合搜索：本机 + 共享
QUERY="$*"
echo "━━━ 本机知识库 ━━━"
qmd search "$QUERY" -n 3
echo ""
echo "━━━ 共享文档库 ━━━"
qmd --index shared search "$QUERY" -n 3
```

### 5.3 OpenClaw Agent 集成

在 OpenClaw 配置中，memory_search 可以对接 QMD：

```json
// 当前（builtin + Azure OpenAI）
{
  "memorySearch": {
    "backend": "builtin",
    "provider": "openai"
  }
}

// 目标（QMD 本地，仅 Nefi 可用）
{
  "memorySearch": {
    "backend": "qmd",
    "searchMode": "query"
  }
}

// 其他机器（builtin + BM25 only，不调 API）
{
  "memorySearch": {
    "backend": "builtin",
    "provider": "none",      // 禁用向量，只用 BM25
    "query": {
      "hybrid": { "enabled": false }
    }
  }
}
```

---

## 6. 数据流

### 6.1 正常流（每天）

```
各机器 workspace 文件变化
    ↓
heartbeat 触发 qmd update（BM25 索引，秒级）
    ↓
每天凌晨 CPU embed 增量更新
（通常只有 5-20 个新文件，1-2 分钟完成）
    ↓
搜索可用
```

### 6.2 共享索引更新流（每周）

```
Mac heartbeat 触发
    ↓
qmd --index shared update（openclaw-docs 有更新时）
    ↓
qmd --index shared embed（GPU，几分钟）
    ↓
catbus push → 全网 5 台（filetx，shared.sqlite 约 50-100MB）
    ↓
各机器收到新 shared.sqlite，立即可用（无需重新 embed）
```

---

## 7. 故障隔离

| 故障场景 | 影响范围 | 降级行为 |
|---------|---------|---------|
| Mac 宕机/离线 | shared.sqlite 停止更新 | 各机器使用上一次推送的版本，继续正常工作 |
| catbus push 失败 | 某台机器 shared 版本滞后 | 只影响 openclaw-docs 搜索，私有搜索不受影响 |
| 某机器 CPU embed 失败 | 该机器向量搜索无法用新内容 | 自动降级到 BM25，结果质量略降但不中断 |
| shared.sqlite 损坏 | 该机器 shared 搜索报错 | 删除文件，等下次推送重建；私有不受影响 |

---

## 8. 存储与性能估算

### 存储
| 文件 | 大小估算 | 说明 |
|------|---------|------|
| `index.sqlite`（各机器私有） | 5-20 MB | 几十个文件，几百个 chunk |
| `shared.sqlite` | 50-150 MB | 640+ 文件，8000+ chunk |
| embedding 模型（embeddinggemma） | 328 MB | 首次下载，之后缓存 |
| reranker 模型 | ~100 MB | 仅 query 模式需要 |

### 性能（CPU 模式）
| 操作 | 耗时估算 | 条件 |
|------|---------|------|
| BM25 update（增量） | < 5s | 几个新文件 |
| CPU embed（增量，10 个文件） | 30-60s | 4核 CPU |
| CPU embed（全量，50 个文件） | 3-5 min | 4核 CPU（已验证：狗子 47文件=3m38s）|
| GPU embed（全量，640 个文件）| < 2 min | Mac M2 Max |
| BM25 search | < 100ms | - |
| query（含 expand+rerank，CPU）| 30-60s | 取决于结果数量 |
| query（含 expand+rerank，GPU）| 2-5s | Mac M2 Max |

---

## 9. 实施路线图

### Phase 1：基础私有索引（已完成验证）
- [x] 各机器安装 qmd
- [x] 各机器建立本地 workspace/memory collection
- [x] CPU embed 可行性验证（狗子，3m38s for 216 chunks）

### Phase 2：Mac 构建共享索引
- [ ] Mac 建立 `--index shared` 索引（openclaw-docs）
- [ ] 测试 shared index 大小和构建时间
- [ ] 验证 catbus push 传输 sqlite 文件

### Phase 3：全网部署
- [ ] 各机器接收 shared.sqlite
- [ ] 部署 qsearch wrapper 脚本
- [ ] 配置各机器 heartbeat 自动 embed

### Phase 4：OpenClaw 集成（可选）
- [ ] Nefi：切换 memory_search backend 到 qmd
- [ ] 其他机器：评估是否集成或保持独立

---

## 10. 待讨论问题

1. **shared index 推送频率**：每周一次够用，还是需要更频繁？
2. **shared index 内容边界**：只放 openclaw-docs？还是包含通用技术文档？
3. **nn（公司 MacBook）**：macOS 有 Apple Silicon，是否单独处理，GPU embed 自己跑？
4. **catbus push 的 10MB 限制**：shared.sqlite 可能 50-150MB，需要确认 filetx 上限或改用 rsync/中转站
5. **sessions 索引策略**：session 文件量大且增长快，是否要限制索引时间窗口（如只索引最近 30 天）？

---

## 11. 依赖

- QMD `github:tobi/qmd#96634da`（已验证版本）
- bun 1.3.x
- CatBus v5 filetx（文件传输，需确认大文件支持）
- Mac M2 Max 正常在线（共享索引构建依赖）

---

*文档路径：`plans/qmd-distributed-architecture.md`*
