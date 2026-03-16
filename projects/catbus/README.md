# 🚌 CatBus — 猫猫巴士通信系统

基于 MQTT 的 OpenClaw 机器人间通信框架。让任意机器人可以直接、高效、结构化地互相通信。

## 架构

```
你（Supervisor）
  │
  ├── 狗子（SRE，监控全系统）
  └── Nefi（Manager，唯一任务分发者）
        ├── 浣浣（编码执行 + Broker）
        ├── 咪咪（存储/轻量）
        └── 小黑（重型计算）
```

通信基于 MQTT（Mosquitto），TLS 加密，每台机器一个 Daemon 进程桥接 MQTT ↔ OpenClaw。

## 项目结构

```
catbus/
├── broker/                  # Broker 端（部署在浣浣上）
│   ├── install-broker.sh    # 一键安装 Broker
│   ├── catbus-add           # 注册机器人
│   ├── catbus-list          # 列出已注册机器人
│   └── catbus-remove        # 移除机器人
├── client/                  # 客户端（每台机器）
│   ├── install-client.sh    # 一键安装客户端
│   └── catbus_daemon.py     # Daemon 主程序
├── skill/                   # OpenClaw Skill
│   ├── SKILL.md             # Skill 定义
│   └── scripts/
│       ├── catbus_send.py   # 发送消息
│       ├── catbus_read.py   # 读取结果
│       └── catbus_status.py # 查看状态
└── catbus-design-v3.md      # 设计文档
```

## 快速部署

### 步骤 1：安装 Broker（在浣浣上）

```bash
bash broker/install-broker.sh
```

自动完成：Docker 检查 → TLS 证书生成 → Mosquitto 启动 → 管理命令安装。

### 步骤 2：注册机器人（在浣浣上）

```bash
catbus-add nefi
catbus-add gouzi
catbus-add huanhuan
catbus-add mimi
catbus-add xiaohei
```

每条命令会输出一条安装命令，复制到对应机器执行即可。

### 步骤 3：安装客户端（在每台机器上）

粘贴步骤 2 生成的命令，一条搞定：

```bash
curl -fsSL .../install-client.sh | bash -s -- \
  --name nefi --host <BROKER_IP> --port 8883 \
  --user nefi --pass <密码> --ca <CA证书base64>
```

自动完成：依赖安装 → 证书写入 → 配置生成 → Daemon 启动 → Skill 安装。

### 步骤 4：配置角色

编辑每台机器的 `skill/SKILL.md` 中"你是谁"部分，写入角色定义。

## 核心特性

| 特性 | 说明 |
|------|------|
| TLS 加密 | 8883 端口，不开放明文 |
| 熔断器 | Daemon 层面自动维护，连续 3 次 fail 拦截发送，1h 自动解除 |
| 超时保护 | 600s 超时 + 进程组 kill（`os.killpg`），自动回传 fail |
| Context Hydration | Daemon 自动拼接前置任务结果，Worker 无需手动读取 |
| 会话持久化 | MQTTv5 SessionExpiry=3600，离线 1h 内消息不丢 |
| 精准路由 | result topic 双层路由 `{target}/{source}`，无效广播为零 |
| 跨平台 | Linux systemd + macOS launchd，自动检测 |

## 消息类型

| 类型 | Topic | QoS | 用途 |
|------|-------|-----|------|
| task | `catbus/task/{target}` | 1 | 派发任务 |
| result | `catbus/result/{target}/{source}` | 1 | 回报结果 |
| status | `catbus/status/{source}` | 0 | 心跳状态（retained） |
| alert | `catbus/alert/{source}` | 1 | 告警 |
| broadcast | `catbus/broadcast` | 0 | 全局广播 |

## AI 使用方式

AI 通过 3 个 skill 脚本与 CatBus 交互：

```bash
# 查看谁在线
python3 catbus_status.py

# 给浣浣派编码任务
python3 catbus_send.py huanhuan task '{"task_type":"code","actions":[...]}'

# 读取任务结果
python3 catbus_read.py nefi-1708425000123-a3f1
```

## 管理命令

Broker 端：

| 命令 | 用途 |
|------|------|
| `catbus-add <名字>` | 注册新机器人 |
| `catbus-list` | 列出已注册机器人 |
| `catbus-remove <名字>` | 移除机器人 |

客户端：

| 命令 | 用途 |
|------|------|
| `systemctl status catbus` | 查看 Daemon 状态（Linux） |
| `launchctl list \| grep catbus` | 查看 Daemon 状态（macOS） |
| `journalctl -u catbus -f` | 查看日志（Linux） |
| `tail -f /var/log/catbus/daemon.log` | 查看日志（macOS） |

## 依赖

- Python 3.9+
- paho-mqtt（`pip install paho-mqtt`）
- Docker（仅 Broker 机器）
- OpenClaw（所有客户端机器）

## 设计文档

详见 `catbus-design-v3.md`，包含完整的角色定义、消息格式、安全设计和消息流示例。
