# CatBus 客户端配置指南

> 前提：CatBus Server 已在 relay.catbus.ai 运行

---

## 一、系统要求

- Python 3.10+
- pip
- macOS / Linux / WSL2

---

## 二、安装

### 2.1 获取代码

```bash
# 从 Git
git clone https://github.com/catbus-network/catbus.git
cd catbus

# 或者解压 tarball
tar xzf catbus-project.tar.gz
cd catbus
```

### 2.2 安装

```bash
pip install -e .
```

验证：

```bash
catbus --help
```

---

## 三、初始化

```bash
catbus init
```

输出：

```
🔑 Node ID generated: a1b2c3d4e5f6
📁 Config created: ~/.catbus/config.yaml

✅ CatBus initialized at ~/.catbus
   Edit config: ~/.catbus/config.yaml
   Start daemon: catbus serve
```

这一步做了两件事：
- 生成 `~/.catbus/node_id`（你在网络中的唯一身份）
- 生成 `~/.catbus/config.yaml`（默认配置）

---

## 四、编辑配置

```bash
nano ~/.catbus/config.yaml
```

替换为以下内容：

```yaml
# CatBus Server 地址
server: wss://relay.catbus.ai

# 本地 HTTP API 端口（给 OpenClaw Skill 调用）
port: 9800

# 节点名称（随便取，方便辨认）
name: my-macbook

# 你提供的 Skill 列表
# 其他节点可以调用这些 Skill
skills:
  - name: echo
    description: "Echo back the input (test)"
    handler: "python:catbus.builtin_skills.echo"
    input_schema:
      text: string

  - name: translate
    description: "Translate text to target language"
    handler: "python:catbus.builtin_skills.translate"
    input_schema:
      text: string
      target_lang: string

  - name: json_format
    description: "Format/beautify JSON string"
    handler: "python:catbus.builtin_skills.json_format"
    input_schema:
      text: string
      indent: integer

  - name: text_stats
    description: "Count characters, words, lines in text"
    handler: "python:catbus.builtin_skills.text_stats"
    input_schema:
      text: string
```

### 配置说明

| 字段 | 说明 | 默认值 |
|------|------|--------|
| `server` | CatBus Server 的 WebSocket 地址 | `ws://localhost:8765` |
| `port` | 本地 HTTP API 端口 | `9800` |
| `name` | 节点显示名 | `node-{id前6位}` |
| `skills` | 提供给网络的 Skill 列表 | echo（默认） |

### handler 格式

```yaml
# Python 函数：动态 import 并调用
handler: "python:module.path.function_name"

# Shell 命令：通过 stdin 传入 JSON，stdout 返回 JSON
handler: "shell:command args"
```

### 环境变量覆盖

```bash
# 覆盖 server 地址
export CATBUS_SERVER=wss://relay.catbus.ai

# 覆盖端口
export CATBUS_PORT=9800

# 覆盖配置目录
export CATBUS_HOME=~/.catbus
```

---

## 五、启动

### 5.1 前台运行（测试用）

```bash
catbus serve
```

预期输出：

```
12:00:00 [INFO] 🚌 CatBus Daemon starting...
12:00:00 [INFO]    Node ID: a1b2c3d4e5f6
12:00:00 [INFO]    Server:  wss://relay.catbus.ai
12:00:00 [INFO]    HTTP:    http://localhost:9800
12:00:00 [INFO]    Skills:  ['echo', 'translate', 'json_format', 'text_stats']
12:00:00 [INFO] 🌐 HTTP API listening on http://localhost:9800
12:00:00 [INFO] 🔌 Connecting to wss://relay.catbus.ai...
12:00:00 [INFO] 🟢 Connected to CatBus Server
12:00:00 [INFO] 📋 Registered skills: ['echo', 'translate', 'json_format', 'text_stats']
12:00:00 [INFO] 📡 Network: 1 nodes, 4 skills
```

`Ctrl+C` 停止。

### 5.2 后台运行（正式使用）

```bash
catbus serve --daemon
```

这会自动安装系统服务：
- Linux → systemd user service
- macOS → launchd agent

### 5.3 手动后台（如果 --daemon 有问题）

```bash
# Linux
nohup catbus serve > ~/.catbus/catbus.log 2>&1 &

# 或者用 tmux/screen
tmux new -s catbus
catbus serve
# Ctrl+B D 脱离
```

---

## 六、验证

### 6.1 检查 Daemon 状态

```bash
catbus status
```

```
🟢 CatBus Daemon is running
   Node ID:    a1b2c3d4e5f6
   Name:       my-macbook
   Server:     wss://relay.catbus.ai
   Status:     connected
   Network:    1 nodes, 4 skills
   My skills:  ['echo', 'translate', 'json_format', 'text_stats']
   Uptime:     42s
```

### 6.2 查看网络 Skill

```bash
catbus skills
```

```
📡 Network Skills (4 available):

  echo                           (1 provider)
    Echo back the input (test)
  translate                      (1 provider)
    Translate text to target language
  json_format                    (1 provider)
    Format/beautify JSON string
  text_stats                     (1 provider)
    Count characters, words, lines in text
```

### 6.3 调用 Skill

```bash
# Echo 测试
catbus call echo -i '{"text": "hello catbus"}'

# 翻译
catbus call translate -i '{"text": "hello world", "target_lang": "zh"}'

# JSON 格式化
catbus call json_format -i '{"text": "{\"a\":1,\"b\":2}"}'

# 文本统计
catbus call text_stats -i '{"text": "hello world\nthis is catbus"}'
```

### 6.4 HTTP API 直接测试

```bash
# 健康检查
curl -s http://localhost:9800/health

# 状态
curl -s http://localhost:9800/status | python3 -m json.tool

# 网络 Skill
curl -s http://localhost:9800/network/skills | python3 -m json.tool

# 调用
curl -s -X POST http://localhost:9800/request \
  -H "Content-Type: application/json" \
  -d '{"skill":"echo","input":{"text":"hello"}}' | python3 -m json.tool
```

---

## 七、添加自定义 Skill

### 7.1 写一个 Python 函数

```python
# ~/my_skills/weather.py

def get_weather(city: str = "Beijing", **kwargs) -> dict:
    """查询天气（Demo 用硬编码数据）"""
    data = {
        "Beijing": {"temp": "15°C", "condition": "晴"},
        "Tokyo": {"temp": "12°C", "condition": "多云"},
        "London": {"temp": "8°C", "condition": "雨"},
    }
    info = data.get(city, {"temp": "unknown", "condition": "unknown"})
    return {"city": city, **info}
```

### 7.2 注册到 config.yaml

```yaml
skills:
  # ... 已有的 skill ...

  - name: weather
    description: "Get weather for a city"
    handler: "python:my_skills.weather.get_weather"
    input_schema:
      city: string
```

确保 Python 能 import 到这个模块：

```bash
export PYTHONPATH=~/my_skills:$PYTHONPATH
```

### 7.3 重启 Daemon

```bash
# 前台
Ctrl+C 然后 catbus serve

# 后台（Linux）
systemctl --user restart catbus

# 后台（macOS）
launchctl kickstart -k gui/$(id -u)/network.catbus.daemon
```

---

## 八、多机测试

在第二台机器上重复以上步骤。两台机器都连上后：

```
机器 A（有 translate skill）
机器 B（有 echo skill）

从 B 调 A 的 translate：
  catbus call translate -i '{"text":"hello","target_lang":"zh"}'
  → 路由到 A → A 执行 → 结果返回 B

从 A 调 B 的 echo：
  catbus call echo -i '{"text":"ping from A"}'
  → 路由到 B → B 执行 → 结果返回 A
```

每台机器不需要安装对方的 Skill。CatBus Server 自动撮合。

---

## 九、故障排查

| 症状 | 原因 | 解决 |
|------|------|------|
| `catbus serve` 报 `Not initialized` | 没跑 init | `catbus init` |
| `Connection refused` on serve | Server 地址错或 Server 没启动 | 检查 config.yaml 的 server 字段 |
| `catbus status` 报 `not running` | Daemon 没启动 | `catbus serve` |
| 调用返回 `no_provider` | 没有节点提供这个 Skill | `catbus skills` 看有什么可用 |
| 调用超时 | Provider 执行太慢或掉线 | 检查 Provider 端日志 |
| 端口 9800 被占用 | 其他程序占了 | 改 config.yaml 里的 port |

### 查看详细日志

```bash
# 前台运行自带日志

# 后台（Linux）
journalctl --user -u catbus -f

# 后台（macOS）
tail -f ~/.catbus/catbus.log
```

---

## 十、文件一览

```
~/.catbus/
├── node_id              # 节点 ID（12 位 hex）
├── config.yaml          # 配置文件
├── catbus.log           # 日志（macOS daemon 模式）
└── catbus.err           # 错误日志（macOS daemon 模式）
```
