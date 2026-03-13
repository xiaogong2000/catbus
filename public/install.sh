#!/bin/bash
# 🚌 CatBus 安装 + 绑定脚本
# curl -fsSL https://catbus.xyz/install.sh | bash
# curl -fsSL https://catbus.xyz/install.sh | bash -s -- --bindcode <code>
# curl -fsSL https://catbus.xyz/install.sh | bash -s -- --uninstall
set -uo pipefail

# ---- 颜色 ----
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
info()  { echo -e "${CYAN}ℹ${NC} $*"; }
ok()    { echo -e "${GREEN}✅${NC} $*"; }
warn()  { echo -e "${YELLOW}⚠️${NC} $*"; }
fail()  { echo -e "${RED}❌${NC} $*"; exit 1; }

# ---- 参数解析 ----
BIND_CODE=""
RELAY_URL=""
UNINSTALL=false
while [ $# -gt 0 ]; do
  case "$1" in
    --bindcode=*) BIND_CODE="${1#*=}"; shift ;;
    --bindcode)   BIND_CODE="${2:-}"; shift 2 ;;
    --relay=*)    RELAY_URL="${1#*=}"; shift ;;
    --relay)      RELAY_URL="${2:-}"; shift 2 ;;
    --uninstall)  UNINSTALL=true; shift ;;
    *) shift ;;
  esac
done

# ---- 卸载模式 ----
if [ "$UNINSTALL" = true ]; then
  echo -e "\n${BOLD}🗑️  CatBus 卸载${NC}"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  # 停止 daemon
  info "停止 CatBus daemon..."
  if command -v catbus &>/dev/null; then
    catbus serve --stop 2>/dev/null || true
  fi
  # 清理 launchd/systemd 服务
  if [ "$(uname)" = "Darwin" ]; then
    PLIST="$HOME/Library/LaunchAgents/com.catbus.network.plist"
    if [ -f "$PLIST" ]; then
      launchctl unload "$PLIST" 2>/dev/null || true
      rm -f "$PLIST"
      info "已移除 launchd 服务"
    fi
  else
    if systemctl list-units --full -all 2>/dev/null | grep -q catbus-network; then
      systemctl --user stop catbus-network 2>/dev/null || sudo systemctl stop catbus-network 2>/dev/null || true
      systemctl --user disable catbus-network 2>/dev/null || sudo systemctl disable catbus-network 2>/dev/null || true
      info "已停止 systemd 服务"
    fi
  fi
  pkill -f "catbus serve" 2>/dev/null || true

  # 卸载 pip 包
  if command -v catbus &>/dev/null; then
    info "卸载 catbus pip 包..."
    PIP=$(command -v pip3 || command -v pip)
    $PIP uninstall -y catbus 2>/dev/null || \
      $PIP uninstall -y --break-system-packages catbus 2>/dev/null || true
    ok "catbus 包已卸载"
  else
    info "catbus 未安装，跳过"
  fi

  # 删除配置目录
  if [ -d "$HOME/.catbus" ]; then
    info "删除 ~/.catbus 配置目录..."
    rm -rf "$HOME/.catbus"
    ok "配置已清理"
  fi

  echo -e "\n${GREEN}✅ CatBus 已完全卸载${NC}"
  exit 0
fi

echo -e "\n${BOLD}🚌 CatBus 安装${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ---- 安装 CatBus ----
if command -v catbus &>/dev/null; then
  ok "CatBus 已安装：$(catbus --version 2>/dev/null || echo 'unknown')"
else
  info "安装 CatBus..."
  if ! command -v pip3 &>/dev/null && ! command -v pip &>/dev/null; then
    fail "未找到 pip，请先安装 Python 3：https://python.org"
  fi
  PIP=$(command -v pip3 || command -v pip)
  # 从 GitHub 安装官方客户端（避免 PyPI 同名第三方包冲突）
  INSTALL_OK=false
  $PIP install --quiet "git+https://github.com/xiaogong2000/catbus.git" 2>/dev/null && INSTALL_OK=true
  if [ "$INSTALL_OK" = false ]; then
    $PIP install --quiet --user "git+https://github.com/xiaogong2000/catbus.git" 2>/dev/null && INSTALL_OK=true
  fi
  if [ "$INSTALL_OK" = false ]; then
    $PIP install --quiet --break-system-packages "git+https://github.com/xiaogong2000/catbus.git" 2>/dev/null && INSTALL_OK=true
  fi
  command -v catbus &>/dev/null || export PATH="$HOME/.local/bin:$PATH"
  command -v catbus &>/dev/null || fail "CatBus 安装失败，请手动运行：pip install git+https://github.com/xiaogong2000/catbus.git"
  ok "CatBus 安装完成"
fi

# ---- 初始化（生成 node_id） ----
if [ ! -f "$HOME/.catbus/config.yaml" ]; then
  info "初始化 CatBus..."
  catbus init
  ok "初始化完成，node_id 已生成"
else
  info "CatBus 已初始化，跳过"
fi

# ---- 设置 relay（如果指定了 --relay） ----
if [ -n "$RELAY_URL" ]; then
  info "设置 relay：$RELAY_URL"
  python3 -c "
import yaml, os
cfg_path = os.path.expanduser('~/.catbus/config.yaml')
with open(cfg_path) as f:
    cfg = yaml.safe_load(f) or {}
cfg['server'] = '$RELAY_URL'       # daemon 读取的字段
cfg['server_url'] = '$RELAY_URL'   # 兼容旧字段名
with open(cfg_path, 'w') as f:
    yaml.dump(cfg, f)
" 2>/dev/null && ok "relay 已更新为 $RELAY_URL" || warn "relay 更新失败，请手动修改 ~/.catbus/config.yaml"
fi

# ---- 启动 daemon（已运行则跳过） ----
if curl -s --max-time 2 http://localhost:9800/health &>/dev/null; then
  ok "CatBus daemon 已在运行"
else
  info "启动 CatBus daemon..."
  catbus serve --daemon 2>/dev/null || true
  sleep 3
  if curl -s --max-time 3 http://localhost:9800/health &>/dev/null; then
    ok "CatBus daemon 已启动"
  else
    fail "daemon 启动失败，请手动运行：catbus serve --daemon"
  fi
fi

# ---- 设置开机自启 ----
CATBUS_BIN=$(command -v catbus 2>/dev/null || echo "$HOME/.local/bin/catbus")
if [ "$(uname)" = "Darwin" ]; then
  PLIST="$HOME/Library/LaunchAgents/com.catbus.network.plist"
  if [ ! -f "$PLIST" ]; then
    mkdir -p "$HOME/Library/LaunchAgents"
    cat > "$PLIST" << EOPLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.catbus.network</string>
  <key>ProgramArguments</key><array>
    <string>$CATBUS_BIN</string><string>serve</string>
  </array>
  <key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$HOME/.catbus/catbus.log</string>
  <key>StandardErrorPath</key><string>$HOME/.catbus/catbus-error.log</string>
</dict></plist>
EOPLIST
    launchctl load "$PLIST" 2>/dev/null && ok "已设置 macOS 开机自启" || warn "开机自启设置失败"
  fi
elif [ "$(id -u)" = "0" ]; then
  # root 用户：用 systemd system service
  if [ ! -f /etc/systemd/system/catbus-network.service ]; then
    cat > /etc/systemd/system/catbus-network.service << EOUNIT
[Unit]
Description=CatBus Network Daemon
After=network-online.target
Wants=network-online.target
[Service]
Type=simple
ExecStart=$CATBUS_BIN serve
Restart=always
RestartSec=5
[Install]
WantedBy=multi-user.target
EOUNIT
    systemctl daemon-reload
    systemctl enable catbus-network
    ok "已设置 Linux 开机自启（systemd system）"
  fi
else
  # 普通用户：用 systemd user service
  mkdir -p "$HOME/.config/systemd/user"
  if [ ! -f "$HOME/.config/systemd/user/catbus-network.service" ]; then
    cat > "$HOME/.config/systemd/user/catbus-network.service" << EOUNIT
[Unit]
Description=CatBus Network Daemon
After=network.target
[Service]
Type=simple
ExecStart=$CATBUS_BIN serve
Restart=always
RestartSec=5
[Install]
WantedBy=default.target
EOUNIT
    systemctl --user daemon-reload 2>/dev/null
    systemctl --user enable catbus-network 2>/dev/null && \
      loginctl enable-linger "$(whoami)" 2>/dev/null && \
      ok "已设置 Linux 开机自启（systemd user）" || \
      warn "开机自启设置失败，请手动运行：systemctl --user enable catbus-network"
  fi
fi

# ---- 绑定到 catbus.xyz（如果传了 --bindcode） ----
if [ -n "$BIND_CODE" ]; then
  echo -e "\n${BOLD}🔗 绑定到 catbus.xyz${NC}"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  # 等待 relay 连接建立（status == "connected"）
  info "等待节点连接到 relay..."
  node_id=""
  retry=0
  while [ $retry -lt 15 ]; do
    STATUS_JSON=$(curl -s http://localhost:9800/status 2>/dev/null)
    STATUS=$(echo "$STATUS_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null || true)
    node_id=$(echo "$STATUS_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('node_id',''))" 2>/dev/null || true)
    [ "$STATUS" = "connected" ] && [ -n "$node_id" ] && break
    sleep 1; retry=$((retry+1))
  done

  [ -z "$node_id" ] && fail "relay 连接超时，请检查 daemon：catbus serve --daemon"
  [ "$STATUS" != "connected" ] && fail "relay 未连接（状态：$STATUS），请检查网络"

  info "Node ID: $node_id，已连接 relay"
  info "正在绑定到 catbus.xyz..."

  resp=$(curl -s -w "\n%{http_code}" -X POST "https://catbus.xyz/api/v2/dashboard/bind/claim" \
    -H "Content-Type: application/json" \
    -d "{\"token\":\"$BIND_CODE\",\"node_id\":\"$node_id\"}" 2>/dev/null)
  http_code=$(echo "$resp" | tail -1)
  resp_body=$(echo "$resp" | head -n -1)

  if [ "$http_code" = "200" ]; then
    ok "绑定成功！节点已关联到你的 catbus.xyz 账户 🎉"
    agent_name=$(echo "$resp_body" | python3 -c \
      "import sys,json; d=json.load(sys.stdin); print(d.get('agent',{}).get('name',''))" 2>/dev/null || true)
    [ -n "$agent_name" ] && info "节点名称：$agent_name"
  else
    err_msg=$(echo "$resp_body" | python3 -c \
      "import sys,json; d=json.load(sys.stdin); print(d.get('message','未知错误'))" 2>/dev/null \
      || echo "HTTP $http_code")
    fail "绑定失败：$err_msg"
  fi
fi

# ---- 完成 ----
echo -e "\n${BOLD}🎉 完成！${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  查看网络状态：catbus status"
echo "  注册技能：    catbus scan --add"
[ -z "$BIND_CODE" ] && echo "  前往 catbus.xyz 绑定你的节点"
