#!/bin/bash
# CatBus Installer / Upgrader
# Usage:
#   curl -fsSL https://catbus.xyz/install.sh | bash                    # 安装 / 升级
#   curl -fsSL https://catbus.xyz/install.sh | bash -s -- --upgrade    # 仅升级
#   curl -fsSL https://catbus.xyz/install.sh | bash -s -- --bindcode <code>
#   curl -fsSL https://catbus.xyz/install.sh | bash -s -- --bindcode <code> --relay wss://relay.catbus.xyz
#   curl -fsSL https://catbus.xyz/install.sh | bash -s -- --env dev    # 使用测试环境 relay
#   curl -fsSL https://catbus.xyz/install.sh | bash -s -- --uninstall

set -eo pipefail

REPO="https://raw.githubusercontent.com/xiaogong2000/CatBusPub/main"
PKG_URL="https://catbus.xyz/releases/catbus-latest.tar.gz"

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
UPGRADE_ONLY=false
while [ $# -gt 0 ]; do
  case "$1" in
    --bindcode=*) BIND_CODE="${1#*=}"; shift ;;
    --bindcode)   BIND_CODE="${2:-}"; shift 2 ;;
    --relay=*)    RELAY_URL="${1#*=}"; shift ;;
    --relay)      RELAY_URL="${2:-}"; shift 2 ;;
    --env)        [ "${2:-}" = "dev" ] && RELAY_URL="wss://relay.catbus.xyz" || RELAY_URL="wss://relay.catbus.ai"; shift 2 ;;
    --uninstall)  UNINSTALL=true; shift ;;
    --upgrade)    UPGRADE_ONLY=true; shift ;;
    *) shift ;;
  esac
done

# ---- 卸载模式 ----
if [ "$UNINSTALL" = true ]; then
  echo -e "\n${BOLD}🗑️  CatBus 卸载${NC}"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  info "停止 CatBus daemon..."
  # 先解绑 catbus.xyz 账户（避免僵尸节点）
  NODE_ID=$(python3 -c "import yaml,os; cfg=yaml.safe_load(open(os.path.expanduser('~/.catbus/config.yaml'))); print(cfg.get('node_id',''))" 2>/dev/null || true)
  if [ -n "$NODE_ID" ]; then
    info "解绑 catbus.xyz 账户中..."
    curl -s -X POST "https://catbus.xyz/api/v2/dashboard/unbind" \
      -H "Content-Type: application/json" \
      -d "{\"node_id\":\"$NODE_ID\"}" 2>/dev/null | python3 -c \
      "import sys,json; d=json.load(sys.stdin); print('✅ 解绑成功' if d.get('success') else '⚠️  ' + d.get('message',''))" \
      2>/dev/null || true
  fi
  pkill -f "catbus serve" 2>/dev/null || true
  sleep 1

  if [ "$(uname)" = "Darwin" ]; then
    PLIST="$HOME/Library/LaunchAgents/com.catbus.network.plist"
    if [ -f "$PLIST" ]; then
      launchctl unload "$PLIST" 2>/dev/null || true
      rm -f "$PLIST"
      info "已移除 launchd 服务"
    fi
  elif [ "$(id -u)" = "0" ]; then
    if systemctl is-enabled catbus-network &>/dev/null; then
      systemctl stop catbus-network 2>/dev/null || true
      systemctl disable catbus-network 2>/dev/null || true
      rm -f /etc/systemd/system/catbus-network.service
      systemctl daemon-reload
      info "已移除 systemd system 服务"
    fi
  else
    if systemctl --user is-enabled catbus-network &>/dev/null; then
      systemctl --user stop catbus-network 2>/dev/null || true
      systemctl --user disable catbus-network 2>/dev/null || true
      rm -f "$HOME/.config/systemd/user/catbus-network.service"
      systemctl --user daemon-reload 2>/dev/null || true
      info "已移除 systemd user 服务"
    fi
  fi

  if command -v catbus &>/dev/null; then
    info "卸载 catbus pip 包..."
    PIP=$(command -v pip3 || command -v pip)
    $PIP uninstall -y catbus 2>/dev/null || \
      $PIP uninstall -y --break-system-packages catbus 2>/dev/null || true
    ok "catbus 包已卸载"
  fi

  # 移除 OpenClaw skill
  SKILL_DIR="${OPENCLAW_WORKSPACE:-$HOME/.openclaw/workspace}/skills/catbus"
  if [ -d "$SKILL_DIR" ]; then
    rm -rf "$SKILL_DIR"
    info "已移除 OpenClaw skill"
  fi

  if [ -d "$HOME/.catbus" ]; then
    rm -rf "$HOME/.catbus"
    ok "配置目录已清理"
  fi

  echo -e "\n${GREEN}✅ CatBus 已完全卸载${NC}"
  exit 0
fi

echo ""
echo -e "${BOLD}🚌 CatBus Installer${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
[ "$UPGRADE_ONLY" = true ] && echo -e "   Mode  : upgrade only"
[ -n "$RELAY_URL" ] && echo -e "   Relay : $RELAY_URL" || echo -e "   Relay : wss://relay.catbus.ai (default)"
[ -n "$BIND_CODE" ] && echo -e "   Bind  : $BIND_CODE"
echo ""

# ── Step 1: OpenClaw skill ───────────────────────────────────────
WS="${OPENCLAW_WORKSPACE:-$HOME/.openclaw/workspace}"
SKILL_DIR="$WS/skills/catbus"
if [ "$UPGRADE_ONLY" = false ]; then
  echo -e "${BOLD}📦 Step 1/5 — Installing OpenClaw skill...${NC}"
  if [ ! -d "$WS" ]; then
    warn "OpenClaw workspace not found at $WS (install OpenClaw first to use skill features)"
  fi
  mkdir -p "$SKILL_DIR"
  curl -fsSL "$REPO/skill/SKILL.md" -o "$SKILL_DIR/SKILL.md"
  ok "Skill installed → $SKILL_DIR/SKILL.md"
else
  info "Skipping step 1 (upgrade mode)"
fi

# ── Step 2: pip install / upgrade from catbus.xyz ─────────────────
echo ""
echo -e "${BOLD}🐍 Step 2/5 — Installing catbus...${NC}"
if ! command -v pip3 &>/dev/null && ! command -v pip &>/dev/null; then
  fail "pip not found. Install Python 3.10+ first: https://python.org"
fi
PIP=$(command -v pip3 || command -v pip)

_pip_install() {
  # Try 3 methods: --break-system-packages first (modern Debian/Ubuntu) → normal → --user
  $PIP install --break-system-packages "$@" 2>&1 && return 0
  $PIP install "$@" 2>&1 && return 0
  $PIP install --user "$@" 2>&1 && return 0
  return 1
}

if command -v catbus &>/dev/null; then
  CURRENT_VER=$(catbus --version 2>/dev/null || echo 'unknown')
  info "CatBus current version: $CURRENT_VER — upgrading..."
  _pip_install --force-reinstall --no-deps "$PKG_URL" && ok "catbus upgraded: $(catbus --version 2>/dev/null || echo 'latest')" \
    || warn "Upgrade failed, keeping current version"
else
  info "Installing catbus from $PKG_URL ..."
  _pip_install "$PKG_URL" || fail "Installation failed. Try manually: pip install $PKG_URL"
  command -v catbus &>/dev/null || export PATH="$HOME/.local/bin:$PATH"
  command -v catbus &>/dev/null || fail "catbus command not found after install. Check PATH."
  ok "catbus $(catbus --version 2>/dev/null || echo 'installed')"
fi

# ── Step 3: Init + relay config ─────────────────────────────────
if [ "$UPGRADE_ONLY" = false ]; then
  echo ""
  echo -e "${BOLD}⚙️  Step 3/5 — Initializing CatBus...${NC}"
  if [ ! -f "$HOME/.catbus/config.yaml" ]; then
    catbus init
    ok "Initialized, node_id generated"
  else
    info "Already initialized, skipping"
  fi

  # 设置 relay（用 Python 写，同时兼容两个字段名）
  EFFECTIVE_RELAY="${RELAY_URL:-wss://relay.catbus.ai}"
  python3 - <<PYEOF
import yaml, os
cfg_path = os.path.expanduser('~/.catbus/config.yaml')
with open(cfg_path) as f:
    cfg = yaml.safe_load(f) or {}
cfg['server'] = '$EFFECTIVE_RELAY'
cfg['server_url'] = '$EFFECTIVE_RELAY'
with open(cfg_path, 'w') as f:
    yaml.dump(cfg, f)
PYEOF
  ok "Relay set to $EFFECTIVE_RELAY"
fi

# ── Step 3.5: Ensure timeout config exists ─────────────────────
echo ""
info "Checking timeout config..."
python3 - <<'PYEOF'
import yaml, os
cfg_path = os.path.expanduser('~/.catbus/config.yaml')
if not os.path.exists(cfg_path):
    exit(0)
with open(cfg_path) as f:
    cfg = yaml.safe_load(f) or {}
changed = False
if 'default_timeout' not in cfg:
    cfg['default_timeout'] = 180
    changed = True
if 'timeouts' not in cfg:
    cfg['timeouts'] = {
        'arxiv-watcher': 300,
        'tavily': 120,
        'agent': 240,
        'daily-briefing': 240,
        'seo-competitor-analysis': 300,
    }
    changed = True
if changed:
    with open(cfg_path, 'w') as f:
        yaml.dump(cfg, f, default_flow_style=False, allow_unicode=True)
    print('UPDATED')
else:
    print('OK')
PYEOF
TIMEOUT_RESULT=$?
if [ $TIMEOUT_RESULT -eq 0 ]; then
  ok "Timeout config ready (default: 180s)"
fi

# ── Step 4: Register OpenClaw skills ────────────────────────────
if [ "$UPGRADE_ONLY" = false ]; then
  echo ""
  echo -e "${BOLD}🔍 Step 4/5 — Registering OpenClaw skills...${NC}"
  if [ -d "$WS" ]; then
    catbus scan --add 2>/dev/null && ok "Skills registered" || warn "skill scan skipped (OpenClaw not found)"
  else
    warn "Skipping skill scan (no OpenClaw workspace)"
  fi
else
  info "Skipping step 4 (upgrade mode)"
fi

# ── Step 5: Start / restart daemon + autostart ───────────────────
echo ""
echo -e "${BOLD}🚀 Step 5/5 — Starting daemon...${NC}"
if [ "$UPGRADE_ONLY" = true ] && curl -s --max-time 2 http://localhost:9800/health &>/dev/null; then
  info "Restarting daemon to apply upgrade..."
  pkill -f "catbus serve" 2>/dev/null || true
  sleep 2
fi
if curl -s --max-time 2 http://localhost:9800/health &>/dev/null; then
  ok "Daemon already running"
else
  catbus serve --daemon 2>/dev/null || true
  sleep 3
  curl -s --max-time 3 http://localhost:9800/health &>/dev/null && ok "Daemon started" || fail "Daemon failed to start. Try: catbus serve --daemon"
fi

# 开机自启
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
    launchctl load "$PLIST" 2>/dev/null && ok "Autostart configured (launchd)" || warn "Autostart setup failed"
  fi
elif [ "$(id -u)" = "0" ]; then
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
    systemctl daemon-reload && systemctl enable catbus-network && ok "Autostart configured (systemd system)"
  fi
else
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
      ok "Autostart configured (systemd user)" || \
      warn "Autostart setup failed, run manually: systemctl --user enable catbus-network"
  fi
fi

# ── Bind to catbus.xyz ──────────────────────────────────────────
if [ -n "$BIND_CODE" ]; then
  echo ""
  echo -e "${BOLD}🔗 Binding to catbus.xyz...${NC}"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  info "Waiting for relay connection..."
  node_id=""
  STATUS=""
  retry=0
  while [ $retry -lt 15 ]; do
    STATUS_JSON=$(curl -s http://localhost:9800/status 2>/dev/null)
    STATUS=$(echo "$STATUS_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null || true)
    node_id=$(echo "$STATUS_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('node_id',''))" 2>/dev/null || true)
    [ "$STATUS" = "connected" ] && [ -n "$node_id" ] && break
    sleep 1; retry=$((retry+1))
  done

  [ -z "$node_id" ] && fail "Could not get node_id. Run: catbus serve --daemon"
  [ "$STATUS" != "connected" ] && fail "Relay not connected (status: $STATUS). Check network."

  info "Node ID: $node_id"

  resp=$(curl -s -w "\n%{http_code}" -X POST "https://catbus.xyz/api/v2/dashboard/bind/claim" \
    -H "Content-Type: application/json" \
    -d "{\"token\":\"$BIND_CODE\",\"node_id\":\"$node_id\"}" 2>/dev/null)
  http_code=$(echo "$resp" | tail -1)
  resp_body=$(echo "$resp" | head -n -1)

  if [ "$http_code" = "200" ]; then
    ok "Bound successfully! Node linked to your catbus.xyz account 🎉"
    agent_name=$(echo "$resp_body" | python3 -c \
      "import sys,json; d=json.load(sys.stdin); print(d.get('agent',{}).get('name',''))" 2>/dev/null || true)
    [ -n "$agent_name" ] && info "Agent name: $agent_name"
  else
    err_msg=$(echo "$resp_body" | python3 -c \
      "import sys,json; d=json.load(sys.stdin); print(d.get('message','unknown error'))" 2>/dev/null \
      || echo "HTTP $http_code")
    fail "Bind failed: $err_msg"
  fi
fi

# ── Done ────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ CatBus installed and running!${NC}"
echo ""
echo "  Check status : catbus status"
echo "  List skills  : catbus skills"
[ -z "$BIND_CODE" ] && echo "  Bind node    : https://catbus.xyz/dashboard/agents"
echo ""
