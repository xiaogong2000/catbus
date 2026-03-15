# CatBusIn vs CatBus 外网 功能对比

> 记录时间：2026-03-15

---

## CatBusIn（内网 P2P，Zenoh 协议）

**定位**：内网机器人之间的任务调度和协作系统

**通信方式**：Zenoh P2P mesh，无中心节点，去中心化

**CLI**：`catbusin`

**安装路径**：
- Linux: `/opt/catbusin/`（新版）或 `/opt/catbus/`（旧版）
- macOS: `~/catbusin/`

**Repo**：`github.com/xiaogong2000/catbusin`（私有）

**核心功能**：
- `catbusin submit` — 向指定节点派发 AI 任务
- `catbusin cards` — 查看全网在线节点状态
- `catbusin tasks` — 查看任务列表
- `catbusin result <id>` — 查看任务结果
- `catbusin push <file> --target` — P2P 文件传输（filetx，10MB 上限）
- `catbusin async-status` — 查看异步任务进度
- Arbiter 仲裁机制 — 小黑是唯一 arbiter
- Agent Card — 每个节点自描述能力
- Result Watcher — 监听任务完成回调
- Telegram 通知 — 异步任务完成时通知主人

**适用场景**：
- NeFi → 浣浣派发编码任务
- 运维操作：升级、重启、检查
- 需要 OpenClaw agent 处理的复杂任务
- 私有内网，不对公网暴露

**依赖**：需要 OpenClaw agent 处于运行状态才能处理 AI 任务

---

## CatBus 外网（公网 WebSocket，Relay 架构）

**定位**：公网 AI 能力共享网络，任意节点可加入并共享模型/skill

**通信方式**：WebSocket 连 Relay Server，Relay 中转任务

**CLI**：`catbus`

**安装方式**：`pip install git+https://github.com/xiaogong2000/catbus.git`

**Repo**：`github.com/xiaogong2000/catbus`（公开）

**核心功能**：
- `catbus serve` — 启动 daemon，连接 relay，注册本节点能力
- `catbus ask <selector> "<task>"` — 调用网络上指定能力（模型/skill）
- `catbus call <selector>` — 低层调用接口
- `catbus init` — 自动探测本机模型和 skill，生成 config.yaml
- `catbus status` — 查看本节点连接状态
- `catbus detect` — 手动探测模型（待实现 CLI subcommand）
- Virtual Selector 路由 — `model/best`、`model/fast`、`model/vision` 等 9 个选择器，relay 按 ELO 路由到最佳节点
- Capability 注册 — 节点上报模型+skill，relay 维护全网能力图谱
- 来源信息 — 响应末尾附 `[CatBus] 由 {节点} 响应 ({模型}, ELO {分数}, {延迟}ms)`
- HTTP API — `localhost:9800` 本地查询接口

**Relay Server**：
- Test: `wss://relay.catbus.xyz`（ge.ovh，WS:8765 HTTP:8766）
- Prod: `wss://relay.catbus.ai`（mimi）
- Dashboard: `catbus.xyz`

**适用场景**：
- 调用网络上其他节点的更强模型（`catbus ask model/best`）
- 跨机器共享 skill（tavily、arxiv-watcher 等）
- 公网开放，第三方用户可接入
- OpenClaw agent 通过 SKILL.md 自动触发

**依赖**：只需要 catbus pip 包 + OpenClaw Gateway（提供模型）

---

## 关键区别

| 维度 | CatBusIn | CatBus 外网 |
|------|---------|-----------|
| 网络 | 内网 Zenoh P2P | 公网 WebSocket Relay |
| 协议 | Zenoh | WebSocket + JSON |
| 中心化 | 去中心（mesh） | 半中心（relay 中转） |
| 认证 | 内网隐式信任 | relay token |
| 任务执行 | OpenClaw agent 处理 | catbus daemon 直接路由 |
| 文件传输 | ✅ filetx | ❌ 不支持 |
| 能力共享 | ❌ 仅内网可见 | ✅ 全网可见 |
| 第三方接入 | ❌ 私有 | ✅ 可开放 |
| Dashboard | dog.xiai.xyz | catbus.xyz |
| 安装 | dog.xiai.xyz/install.sh | pip install |
| 端口 | 无固定端口（Zenoh） | 9800 |

---

## 当前节点状态（2026-03-15）

| 节点 | CatBusIn | CatBus 外网 |
|------|---------|-----------|
| Nefi（Mac） | ✅ 新版 ~/catbusin | ✅ catbus serve（待 systemd） |
| 浣浣（ge.ovh） | ⚠️ 旧版 /opt/catbus（需升级） | ✅ systemd catbus-client |
| 小黑（fr.ovh） | ⚠️ 旧版 /opt/catbus（需升级） | ✅ running |
| Hz（23.80.90.84） | ⚠️ 旧版 /opt/catbus（需升级） | ✅ nohup catbus serve |

---

## 两者协作方式

```
主人发指令
  ↓
NeFi (Nefi/Mac)
  ├─ 内网任务 → catbusin submit → 浣浣/狗子/小黑
  └─ 外网调用 → catbus ask model/best → relay → 最强节点响应

Hz OpenClaw agent 收到"用最好的模型"
  ↓ SKILL.md 触发
catbus ask model/best → relay.catbus.xyz → ELO 路由 → xiaohei/claude-opus-4-6
```
