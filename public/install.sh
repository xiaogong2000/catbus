#!/bin/bash
# 🚌 CatBus 节点绑定脚本
# curl -fsSL https://catbus.xyz/install.sh | bash -s -- --bindcode <code>
set -uo pipefail

# ---- 颜色 ----
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

info()  { echo -e "${CYAN}ℹ${NC} $*"; }
ok()    { echo -e "${GREEN}✅${NC} $*"; }
warn()  { echo -e "${YELLOW}⚠️${NC} $*"; }
fail()  { echo -e "${RED}❌${NC} $*"; exit 1; }

# ---- 参数解析 ----
BIND_CODE=""
for arg in "$@"; do
  case "$arg" in
    --bindcode=*) BIND_CODE="${arg#*=}" ;;
    --bindcode)   BIND_CODE="${2:-}"; shift 2>/dev/null || true ;;
  esac
  shift 2>/dev/null || true
done

[ -z "$BIND_CODE" ] && fail "缺少绑定码，用法：bash -s -- --bindcode <code>"

echo -e "\n${BOLD}🚌 CatBus 节点绑定${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ---- 检测 CatBus 是否已安装 ----
OS=$(uname -s)
if [ "$OS" = "Darwin" ]; then
  CATBUS_PY="$HOME/catbus/catbus.py"
  CONFIG_DIR="$HOME/catbus/etc"
else
  CATBUS_PY="/opt/catbus/catbus.py"
  CONFIG_DIR="/etc/catbus"
fi

if [ ! -f "$CATBUS_PY" ]; then
  fail "未找到 CatBus，请先安装：curl -fsSL https://dog.xiai.xyz/install.sh | bash"
fi

info "CatBus 已安装：$CATBUS_PY"

# ---- 获取 node_id（等待最多 15 秒） ----
info "等待节点上线，获取 node_id..."
node_id=""
retry=0
while [ $retry -lt 15 ]; do
  node_id=$(python3 "$CATBUS_PY" status 2>/dev/null \
    | grep -oE '"node_id"[[:space:]]*:[[:space:]]*"[^"]+"' \
    | grep -oE '"[^"]+"$' \
    | tr -d '"' || true)
  [ -n "$node_id" ] && break
  sleep 1; retry=$((retry+1))
done

[ -z "$node_id" ] && fail "无法获取 node_id，请确认 CatBus daemon 正在运行"

info "Node ID: $node_id"
info "正在向 catbus.xyz 发送绑定请求..."

# ---- 调用 bind/claim API ----
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
  echo ""
  echo "  前往 catbus.xyz/dashboard 查看你的节点"
else
  err_msg=$(echo "$resp_body" | python3 -c \
    "import sys,json; d=json.load(sys.stdin); print(d.get('message','未知错误'))" 2>/dev/null \
    || echo "HTTP $http_code")
  fail "绑定失败：$err_msg"
fi
