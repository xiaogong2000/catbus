# CatBus 代码快照 — 2026-03-14

本目录是 2026-03-13 ~ 03-14 开发期间所有修改文件的快照。

## 目录结构

```
client/          — catbus pip 客户端（v0.3.1）
  capability_db.py   ★ 新增 — MODEL_DB / SKILL_DB / extract_base_model()
  cli.py             ★ 修改 — bind 命令、--version、catbus detect
  config.py          ★ 修改 — CapabilityConfig 数据结构
  daemon.py          ★ 修改 — capabilities 注册 + 5分钟轻探测
  detector.py        ★ 新增 — 三层模型探测引擎
  executor.py        ★ 修改 — capability type/name 查找
  scanner.py         ★ 修改 — 返回 CapabilityConfig

server/          — Relay Server（v2.0.0）
  server.py          ★ 修改 — Capability 数据模型 + 模糊匹配 + /api/capabilities

web/             — catbus-web 前端修改文件
  src/app/api/v2/network/skills/route.ts    ★ 新增 — GET /api/v2/network/skills
  src/app/api/v2/dashboard/unbind/route.ts  ★ 新增 — POST /api/v2/dashboard/unbind
  src/lib/api.ts                             ★ 修改 — getSkills 调新接口
  src/lib/db.ts                              ★ 修改 — removeUserAgentByNodeId
  src/components/network/floating-stats.tsx  ★ 修改 — 用 total_capabilities

install.sh       — catbus.xyz 核心安装脚本（v0.3.0+）
```

## 主要变更

### Capability 体系（v0.3.0）
- 统一 `type/name` 格式：`model/claude-sonnet-4`、`skill/tavily`
- relay 支持 capabilities 注册 + 模糊匹配（model/best、model/cheapest）
- 新增 `/api/capabilities` REST 端点

### 模型自动探测（v0.3.1）
- `catbus init` 自动探测本机模型并写入 config.yaml
- daemon 启动时探测，每 5 分钟轻探测（零 token）
- `catbus detect` 手动触发

### install.sh
- 从 GitHub 安装（非 PyPI）
- 支持 `--bindcode` / `--relay` / `--uninstall` / `--env`
- `--uninstall` 先调 `/api/v2/dashboard/unbind` 解绑账户

## Bug 修复
- #7 --uninstall 用 pkill 代替不存在的 catbus serve --stop
- #8 --uninstall 卸载前调 unbind API 解绑账户
- #9 catbus --version 不支持
- #10 版本号不一致（pyproject.toml vs __init__.py）
- #11 cli.py import CapabilityConfig 但 GitHub config.py 是旧版
- #12 capabilities + skills 双字段导致重复注册
- #13 test relay 未重启导致 capabilities 不可路由
