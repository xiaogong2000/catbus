# CatBus Capability 体系部署说明

> 版本：v0.3.0（Capability Release）
> 日期：2026-03-13
> 给 openclaw 的部署文档

---

## 一、变更概述

本次更新将 CatBus 从纯 Skill 注册模型升级为统一的 **Capability 体系**（`type/name` 格式）。

### 核心变化

| 模块 | 变化 |
|------|------|
| **config.py** | 新增 `CapabilityConfig` 数据结构，`Config.capabilities` 字段，老格式 `skills` 自动迁移 |
| **capability_db.py** | **新文件** — MODEL_DB / SKILL_DB / `extract_base_model()` 模型名模糊匹配 |
| **executor.py** | 支持 `type/name` 格式查找，兼容老格式 bare name |
| **daemon.py** | REGISTER 消息携带 `capabilities` + `skills`（双发），HTTP API 返回 capabilities |
| **scanner.py** | 返回 `CapabilityConfig` 对象，用 SKILL_DB 自动分类 |
| **cli.py** | 新增 `catbus bind` 命令，`catbus call` 支持 `type/name` 格式 |
| **server.py** | 新增 `Capability` 数据结构、模糊匹配（model/best、model/cheapest）、`/api/capabilities` 端点 |

### 向后兼容性

**100% 向后兼容。** 所有改动都是加法：

- 老格式 `config.yaml`（只有 `skills:`）继续正常工作
- 老版 client 连新版 relay → relay 自动把 `skills` 转为 `capabilities`
- 新版 client 连老版 relay → client 同时发 `capabilities` 和 `skills`，老 relay 忽略 `capabilities` 只读 `skills`
- `catbus call echo` 继续工作（自动映射为 `skill/echo`）

---

## 二、文件清单

### Client（catbus-client）

```
catbus/
├── __init__.py          # 版本号 0.3.0
├── __main__.py          # 未改
├── builtin_skills.py    # 未改
├── capability_db.py     # ★ 新文件
├── cli.py               # ★ 修改（+bind 命令）
├── config.py            # ★ 修改（+CapabilityConfig）
├── daemon.py            # ★ 修改（capabilities 注册）
├── executor.py          # ★ 修改（capability 查找）
├── gateway.py           # 未改
├── scanner.py           # ★ 修改（返回 CapabilityConfig）
└── service.py           # 未改
```

### Server（catbus-server）

```
server.py                # ★ 修改（Capability 数据模型 + 模糊匹配 + 新 API）
```

---

## 三、部署步骤

### Step 1：先部署 Relay Server（mimi, 23.94.9.58）

relay 必须先升级，否则新 client 的 capabilities 字段会被忽略。

```bash
# SSH 到 mimi
ssh mimi

# 备份
cp /path/to/catbus-server/server.py /path/to/catbus-server/server.py.bak

# 替换 server.py
cp server.py /path/to/catbus-server/server.py

# 重启（Docker 方式）
docker restart catbus-server

# 或者 PM2 方式
pm2 restart catbus-server

# 或者直接重启进程
# kill $(pgrep -f "catbus.*server"); python3 server.py &
```

**验证 relay：**

```bash
# 检查版本号应该是 2.0.0
curl -s http://127.0.0.1:8766/api/health | python3 -m json.tool
# 期望：{"ok": true, "version": "2.0.0", ...}

# 检查新 API 端点
curl -s http://127.0.0.1:8766/api/capabilities | python3 -m json.tool
# 期望：{"data": [...], "summary": {"total_capabilities": 0, ...}}

curl -s http://127.0.0.1:8766/api/stats | python3 -m json.tool
# 期望：多了 total_models 和 total_capabilities 字段
```

### Step 2：部署 Client（浣浣 ge.ovh + 小黑 fr.ovh）

```bash
# SSH 到节点

# 备份
cp -r ~/.local/lib/python3.*/site-packages/catbus ~/.local/lib/python3.*/site-packages/catbus.bak

# 方案 A：直接替换文件（测试用）
cp catbus/*.py ~/.local/lib/python3.*/site-packages/catbus/

# 方案 B：pip install（正式发布后）
pip install catbus==0.3.0 --upgrade
```

### Step 3：配置浣浣的 config.yaml

浣浣（ge-ovh-test）需要手动加上 model capability：

```bash
cat > ~/.catbus/config.yaml << 'EOF'
server: wss://relay.catbus.xyz
name: ge-ovh-test
port: 9800

capabilities:
  # 模型
  - type: model
    name: model/claude-sonnet-4
    handler: "gateway:default"
    meta:
      provider: anthropic
      context_window: 200000
      strengths: [code, analysis, writing, general]
      cost_tier: medium

  # 工具
  - type: skill
    name: skill/tavily
    handler: "gateway:default"
    meta:
      category: search
      cost_tier: low

  - type: skill
    name: skill/echo
    handler: "python:catbus.builtin_skills.echo"
    meta:
      category: utility
      cost_tier: free

# 向后兼容
skills:
  - name: tavily
    handler: "gateway:default"
    description: "Web search via Tavily"
  - name: echo
    handler: "python:catbus.builtin_skills.echo"
    description: "Echo back input"
EOF
```

### Step 4：重启 Daemon

```bash
# 两台机器都要重启
catbus serve --daemon

# 或者前台调试
catbus serve
```

### Step 5：验证

```bash
# 在浣浣上检查状态
catbus status

# 期望输出包含：
#   Models:        ['model/claude-sonnet-4']
#   Skills:        ['skill/tavily', 'skill/echo']

# 在小黑上调用浣浣的 Claude
catbus call model/claude-sonnet-4 -i '{"prompt": "写一个 Python hello world"}'

# 调用最便宜的模型
catbus call model/cheapest -i '{"prompt": "hello"}'

# 调用搜索类 skill（不指定具体哪个）
catbus call skill/search -i '{"query": "latest AI news"}'

# 老格式继续工作
catbus call echo -i '{"text": "test"}'

# Relay API 验证
curl -s http://127.0.0.1:8766/api/capabilities | python3 -m json.tool
curl -s http://127.0.0.1:8766/api/capabilities/model | python3 -m json.tool
curl -s http://127.0.0.1:8766/api/capabilities/model/claude-sonnet-4 | python3 -m json.tool
```

---

## 四、新增 CLI 命令

### catbus bind

用于 Provider 绑定到 catbus.xyz 并上报 capabilities：

```bash
catbus bind <token> --models "claude-sonnet-4,deepseek-v3" --skills "tavily,image-gen"
```

内部会调用 `extract_base_model()` 做模糊匹配：

```
"amazon-bedrock/global.anthropic.claude-sonnet-4-6" → model/claude-sonnet-4
"openrouter/deepseek/deepseek-chat-v3" → model/deepseek-v3
"aws opus" → model/claude-opus-4
```

### catbus call（升级）

现在支持 `type/name` 格式：

```bash
catbus call model/claude-sonnet-4 -i '{"prompt": "..."}'
catbus call model/best -i '{"prompt": "..."}'
catbus call model/cheapest -i '{"prompt": "..."}'
catbus call skill/tavily -i '{"query": "..."}'
catbus call skill/search -i '{"query": "..."}'
catbus call echo -i '{"text": "hello"}'     # 老格式继续工作
```

---

## 五、新增 Relay API 端点

| 端点 | 说明 |
|------|------|
| `GET /api/capabilities` | 全网能力汇总（支持 `?type=model` 过滤） |
| `GET /api/capabilities/{type}` | 按类型查询（`/api/capabilities/model`） |
| `GET /api/capabilities/{type}/{name}` | 单个能力详情（`/api/capabilities/model/claude-sonnet-4`） |

原有 `/api/skills`、`/api/nodes` 等端点继续工作，`/api/nodes` 响应多了 `capabilities` 字段。

---

## 六、回滚方案

如果出问题，可以秒回滚：

```bash
# Relay
cp /path/to/catbus-server/server.py.bak /path/to/catbus-server/server.py
pm2 restart catbus-server  # 或 docker restart

# Client
cp -r ~/.local/lib/python3.*/site-packages/catbus.bak/* ~/.local/lib/python3.*/site-packages/catbus/
catbus serve --daemon
```

新版 config.yaml 里即使有 `capabilities:` 字段，老版代码也只是忽略它（yaml 加载不报错），所以 config 不需要回滚。

---

## 七、后续计划

这次部署完成后，Phase 1 的核心链路就通了：

```
小黑 → catbus call model/claude-sonnet-4 → relay 匹配 → 浣浣的 Claude 执行 → 结果返回
```

接下来：
- 前端工程师对接 `/api/capabilities` 端点，在 Dashboard 展示 Provider 的模型和 Skill
- `catbus bind` 对接 catbus.xyz 的 bind API
- 计费：model/ 按 token，skill/ 按次
