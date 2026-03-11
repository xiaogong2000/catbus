# CatBus v4 运维手册 — 狗子专用

> 你是 CatBus 的 SRE，负责整个通信系统的运维和监控。
> 从现在起，所有 CatBus 运维工作由你负责。

## v3 → v4 升级要点

| 特性 | v3 | v4 |
|------|----|----|
| 协议版本 | v:1 | v:2 |
| System ACK | ❌ | ✅ Daemon 级零 token ACK |
| ACK 追踪 | ❌ | ✅ pending_acks + 4 级重试 |
| 重试机制 | ❌ | ✅ 60/150/330/630s |
| 状态持久化 | ❌ | ✅ state.json write-behind |
| 结构化日志 | ❌ | ✅ messages.jsonl |
| 诊断命令 | 基础 status | --pending/--health/--last |
| 告警防循环 | ❌ | ✅ Manager 不发 MQTT + from 过滤 |
| 身份自检 | ❌ | ✅ SKILL.md token vs config token |
| 两级队列 | ❌ | ✅ intake_queue → task_queue |
| broadcast/claim | ❌ | ✅ 技能匹配自动 claim |
| 时间基准 | time.time() | time.monotonic() |
| MQTT 重连 | 固定间隔 | 指数退避 1-30s |
| 消息 ID | 时间戳 | 时间戳+随机后缀（防碰撞）|

## 架构总览

```
Broker (浣浣 ge.ovh:8883 Mosquitto Docker)
  ├── nefi   (Mac M2, Manager, launchd)
  ├── huanhuan (ge.ovh, Worker+Broker, systemd)
  ├── gouzi  (homelab, SRE — 你, systemd)
  ├── mimi   (la.css, 存储/轻量, systemd)
  └── xiaohei (us.ovh, 重型计算, systemd)
```

## 机器清单

| 名字 | IP | 用户 | OpenClaw 路径 | machine_skills |
|------|-----|------|--------------|----------------|
| nefi | Mac 本机 | tangpeng | `~/.openclaw/` | management, orchestration, review, seo |
| huanhuan | 51.75.146.33 | root(OC)/debian(SSH) | `/root/.openclaw/` | nextjs, python, nodejs, seo, coding |
| gouzi | 192.168.3.240 | pt | `/home/pt/.openclaw/` | sre, monitoring, linux, networking |
| mimi | 23.94.9.58 | root | `/root/.openclaw/` | storage, backup, lightweight |
| xiaohei | 147.135.15.43 | root(OC)/debian(SSH) | `/root/.openclaw/` | compute, ml, heavy-task, python |

## 关键路径

| 项目 | 路径 |
|------|------|
| Daemon 代码 | `/opt/catbus/catbus_daemon.py` |
| 配置文件 | `/etc/catbus/config.json` |
| CA 证书 | `/etc/catbus/ca.crt` |
| Unix Socket | `/tmp/catbus.sock` |
| 结构化日志 | `/var/log/catbus/messages.jsonl` |
| 状态持久化 | `/var/log/catbus/state.json` |
| 状态缓存 | `/var/log/catbus/status/*.json` |
| 结果存储 | `/var/log/catbus/results/*.json` |

### Broker 端（仅浣浣）

| 项目 | 路径 |
|------|------|
| Mosquitto 容器 | `catbus-broker` |
| TLS 证书 | `/opt/catbus/mosquitto/certs/` |
| 密码文件 | `/opt/catbus/mosquitto/config/passwd` |
| 机器注册表 | `/opt/catbus/registry/*.json` |

## 配置文件格式（v4）

```json
{
  "machine_name": "gouzi",
  "broker_host": "51.75.146.33",
  "broker_port": 8883,
  "broker_user": "gouzi",
  "broker_pass": "<密码>",
  "ca_cert": "/etc/catbus/ca.crt",
  "socket_path": "/tmp/catbus.sock",
  "log_dir": "/var/log/catbus",
  "max_workers": 1,
  "openclaw_path": "/home/pt/.npm-global/bin/openclaw",
  "machine_skills": ["sre", "monitoring", "linux", "networking"],
  "mqtt": {
    "keepalive": 60,
    "reconnect_min": 1,
    "reconnect_max": 30,
    "session_expiry": 3600
  }
}
```

v4 新增字段：`machine_skills`（broadcast 技能匹配用）、`mqtt`（连接参数）

## 服务管理

### Linux (systemd) — gouzi/huanhuan/mimi/xiaohei
```bash
sudo systemctl status catbus
sudo systemctl restart catbus
sudo systemctl stop catbus
sudo journalctl -u catbus -f                    # 实时日志
sudo journalctl -u catbus --since '5 min ago'   # 最近日志
```

### macOS (launchd) — 仅 nefi
```bash
launchctl list | grep catbus
launchctl unload ~/Library/LaunchAgents/com.catbus.daemon.plist  # 停止
launchctl load ~/Library/LaunchAgents/com.catbus.daemon.plist    # 启动
tail -f /var/log/catbus/daemon.log
```

### 一键全网操控（在 NeFi Mac 上）
```bash
catbus-stop-all          # 停止全部 5 台
catbus-stop-all --start  # 启动全部 5 台
```
脚本路径：`/usr/local/bin/catbus-stop-all`

### Broker (Docker) — 仅浣浣
```bash
sudo docker ps --filter name=catbus-broker
sudo docker restart catbus-broker
sudo docker logs catbus-broker --tail 20
```

## v4 诊断命令

```bash
# 全网在线状态（显示协议版本）
python3 catbus_status.py

# 查看等待 ACK 的任务
python3 catbus_status.py --pending

# 查看各机器心跳和 ACK 延迟
python3 catbus_status.py --health

# 查看最近 N 条消息
python3 catbus_status.py --last 20
```

狗子的 catbus_status.py 路径：`/home/pt/.openclaw/workspace/skills/catbus/scripts/catbus_status.py`

## MQTT Topic 结构（v2）

| Topic | QoS | 用途 |
|-------|-----|------|
| `catbus/task/{target}` | 1 | 派发任务 |
| `catbus/result/{target}/{source}` | 1 | 回报结果 |
| `catbus/ack/{target}` | 1 | v4 System ACK |
| `catbus/status/{source}` | 0 | 心跳状态（retained） |
| `catbus/alert/{target}` | 1 | 告警 |
| `catbus/broadcast/tasks` | 1 | 广播任务（技能匹配） |
| `catbus/broadcast/claims` | 1 | 广播认领 |

## v4 任务生命周期

```
发送方                    接收方
  │ task ──────────────→ │
  │ ←──────── ack (零token) │  ← Daemon 自动回，不唤醒 AI
  │                      │  AI 执行任务...
  │ ←──────── result     │  ← AI 完成后回报
```

ACK 追踪 + 重试：
- 发送 task 后自动注册到 pending_acks
- 60s 无 ACK → 第 1 次重试
- 150s → 第 2 次重试（加 [RETRY] 前缀）
- 330s → 第 3 次重试（加 [URGENT] 前缀）+ 发告警
- 630s → 标记失败，从 pending 移除

收到 result 也会清除 pending（兼容 v3 不发 ack）。

## 故障排查

### 1. Daemon 连不上 Broker
```bash
# 检查 Broker 容器
ssh ge.ovh "sudo docker ps --filter name=catbus-broker"
# 测试 TLS 连接
openssl s_client -connect 51.75.146.33:8883 -CAfile /etc/catbus/ca.crt
# 检查认证（看 config.json 的 user/pass）
cat /etc/catbus/config.json
# 重启 Broker
ssh ge.ovh "sudo docker restart catbus-broker"
```

### 2. 熔断器触发（Circuit Open）
- 连续 3 次任务失败触发，1 小时自动恢复
- 紧急恢复：重启 daemon（清除内存计数器）
- 查看：`catbus_status.py` 输出的 circuit_open 字段

### 3. 告警风暴（血泪教训！）
**根因**：自发自收循环。NeFi 发 alert → MQTT → NeFi 自己收到 → 推给 AI → AI 触发新 alert → 无限循环

**v4 已修复**：
- Manager(nefi) 的告警只打本地日志，不发 MQTT
- handle_alert 忽略 from == 自己的消息

**万一再发生**：
```bash
# 在 NeFi Mac 上一键停止全网
catbus-stop-all
# 或者只停 NeFi
launchctl unload ~/Library/LaunchAgents/com.catbus.daemon.plist
pkill -f catbus_daemon
```

### 4. openclaw agent 报 gateway token missing
**原因**：OpenClaw 配置在 /root/，但 daemon 以其他用户运行，HOME 指向错误目录
**修复**：
- 方案 A：去掉 config.json 里的 `run_as_user`（让 daemon 以 root 跑）
- 方案 B：在 openclaw.json 的 gateway 里加 `remote.token`（值 = auth.token）

### 5. config.json 被清空
**原因**：heredoc + python3 + sudo tee 管道冲突
**正确写法**：用 echo + 单引号包裹 JSON，不要用 heredoc 里嵌套 python3
```bash
echo '{"machine_name":"gouzi",...}' | sudo tee /etc/catbus/config.json > /dev/null
```

### 6. launchd 反复崩溃后不启动（仅 NeFi）
**原因**：launchd throttle 机制
**修复**：先 unload 再 load
```bash
launchctl unload ~/Library/LaunchAgents/com.catbus.daemon.plist
rm -f /tmp/catbus.sock
launchctl load ~/Library/LaunchAgents/com.catbus.daemon.plist
```

### 7. 心跳超时误报
- v3 heartbeat 间隔 300s，v4 超时阈值 360s（300+60 余量）
- 启动后 360s 宽限期内不检查心跳
- 告警去重：同一告警 5 分钟内不重复（key 用 regex 替换数字）

## MQTT 凭据

| 机器 | 用户名 | 密码 |
|------|--------|------|
| nefi | nefi | D0kJM2iLbbdiyoFTOypy |
| gouzi | gouzi | 17E1JwKu4J4nzPRluVKZ |
| huanhuan | huanhuan | A5sIWFpKEmNODbA9jjyi |
| mimi | mimi | 4M5EmqYi4xcbL03kRMuY |
| xiaohei | xiaohei | q6AgGpvTuo2nrxwEa9gz |

重置密码（在浣浣上）：
```bash
NEW_PASS=$(openssl rand -base64 16 | tr -d '/+=' | head -c 20)
sudo docker exec catbus-broker mosquitto_passwd -b /mosquitto/config/passwd <用户名> $NEW_PASS
sudo docker exec catbus-broker kill -HUP 1
echo "新密码: $NEW_PASS"
# 然后更新对应机器的 /etc/catbus/config.json
```

## 日常巡检 Checklist

1. `catbus_status.py` — 全网在线？协议版本 v2？
2. `catbus_status.py --pending` — 有无卡住的任务？
3. `catbus_status.py --health` — 心跳正常？ACK 延迟合理？
4. Broker 容器健康：`ssh ge.ovh "sudo docker ps --filter name=catbus-broker"`
5. 磁盘空间：messages.jsonl 和 results/ 会持续增长
6. 熔断器状态：status 里有无 circuit_open

## 已知限制

- Broker 单点（浣浣 ge.ovh），浣浣挂了全网断
- v3/v4 混跑时 v3 不发 ack（v4 兼容处理，靠 result 清除 pending）
- AI 不信任 CatBus 转发的外部操作（curl 第三方 API 等），需要在 SKILL.md 里明确授权
- MQTT retained 消息可能导致 daemon 重启时收到旧 task（on_message 有 from==self 过滤）
