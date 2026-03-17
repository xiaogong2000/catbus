# CLAUDE.md - CatBus Client (生产部署副本)

> 任何 Claude Code 实例启动时必读此文件。这是项目的 Single Source of Truth。

---

## 项目概述

这是 CatBus Client 的**生产部署副本**（位于 `/root/projects/catbus-client/`），用于本机运行 catbus.py daemon 服务。开发主仓库在 `/home/debian/catbus-client/`。

CatBus 是 "The Uber for AI Agents" — 一个分布式网络系统，让不同机器上的 AI Agent 能够互相发现、互相调用能力。

- **代码位置**: `/root/projects/catbus-client/`
- **开发仓库**: `/home/debian/catbus-client/`
- **版本**: 0.3.0
- **Python**: >=3.10

## 目录结构

```
/root/projects/catbus-client/
├── catbus/                    # Python 包
│   ├── __init__.py            # 版本
│   ├── __main__.py            # CLI 入口
│   ├── cli.py                 # 命令行接口
│   ├── config.py              # 配置 (~/.catbus/config.yaml)
│   ├── daemon.py              # WebSocket Daemon (端口 9800)
│   ├── executor.py            # 能力执行引擎
│   ├── detector.py            # 4 层模型检测
│   ├── gateway.py             # OpenClaw Gateway 桥接
│   ├── scanner.py             # Skill 扫描
│   ├── capability_db.py       # 模型数据库
│   ├── builtin_skills.py      # 内置 Skill
│   ├── arena_sync.py          # Arena.ai 同步
│   └── service.py             # systemd/launchd 安装器
├── catbus.py                  # 独立 CLI 入口 (catbusin 集成用)
├── server/                    # Relay Server 引用代码
├── web/                       # Web UI 引用代码
├── skill/                     # Skill 规范
├── install.sh                 # 一键安装脚本
├── pyproject.toml             # 包配置
├── README.md                  # 英文文档
├── README.zh-CN.md            # 中文文档
└── ONBOARDING.md              # 工程师入职指南
```

## 关键说明

**此副本 vs 开发仓库:**
- `/root/projects/catbus-client/` — 生产副本, root 权限, 运行 daemon
- `/home/debian/catbus-client/` — 开发仓库, debian 用户, 包含更多文档/workspace

**与 catbusin 的关系:**
- 本项目 (v0.3): WebSocket 版, 连接 relay.catbus.xyz
- catbusin (v5): Zenoh P2P 版, 已替代本项目作为主力 daemon
- 本项目的 `catbus.py` 仍被 catbusin 部分功能引用

## CLI 命令

```bash
catbus init          # 初始化配置
catbus serve         # 启动 WebSocket Daemon
catbus status        # 查看状态
catbus call <cap>    # 调用远程能力
catbus bind <token>  # 绑定 catbus.xyz
catbus scan          # 扫描本地 Skill
```

## 配置 (~/.catbus/config.yaml)

```yaml
server: wss://relay.catbus.ai
port: 9800
name: agent-name
node_id: 12字符ID
capabilities:
  - type: model
    name: model/claude-opus-4-6
    handler: gateway:default
```

## 开发

```bash
# 修改代码请在开发仓库操作
cd /home/debian/catbus-client
# 完整文档见开发仓库的 CLAUDE.md
```

## 当前状态

- 版本: 0.3.0
- 角色: 生产部署副本
- 主力 daemon 已迁移至 catbusin (v5 Zenoh 版)
- 部分功能仍被 catbusin 引用

## 已完成的里程碑

- [x] WebSocket Daemon + CLI
- [x] 统一 Capability 模型
- [x] 4 层模型检测
- [x] OpenClaw Gateway 集成
- [x] Skill 扫描与注册
- [x] 一键安装脚本

## Git 仓库

- **仓库**: https://github.com/xiaogong2000/catbus (私有)
- **分支**: main
- **远程**: origin
- **注意**: 这是生产副本，日常开发请在 /home/debian/catbus-client/ 操作

每次修改完成后，提交并推送到 GitHub：
```bash
cd /root/projects/catbus-client
sudo git add -A
sudo git commit -m "简洁描述本次改动"
sudo git push origin main
```

## 指令

每次完成一个开发任务后：
1. 更新本文件的"当前状态"和"已完成的里程碑"部分
2. 提交所有改动并推送到 GitHub
