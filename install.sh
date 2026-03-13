#!/bin/bash
# CatBus OpenClaw Skill Installer
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/xiaogong2000/catbus/main/install.sh | bash
#   curl -fsSL https://raw.githubusercontent.com/xiaogong2000/catbus/main/install.sh | bash -s -- --env dev

set -e

REPO="https://raw.githubusercontent.com/xiaogong2000/catbus/main"
SKILL_DIR="${OPENCLAW_WORKSPACE:-$HOME/.openclaw/workspace}/skills/catbus"

# Parse --env argument (default: prod)
ENV="prod"
while [[ $# -gt 0 ]]; do
  case $1 in
    --env) ENV=$2; shift 2 ;;
    *) shift ;;
  esac
done

if [ "$ENV" = "dev" ]; then
  RELAY_URL="wss://relay.catbus.xyz"
else
  RELAY_URL="wss://relay.catbus.ai"
fi

echo ""
echo "🚌 CatBus Installer"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   Environment : $ENV"
echo "   Relay       : $RELAY_URL"
echo ""

# ── Step 1: OpenClaw workspace check ────────────────────────────
echo "📦 Step 1/3 — Installing OpenClaw skill..."

WS="${OPENCLAW_WORKSPACE:-$HOME/.openclaw/workspace}"
if [ ! -d "$WS" ]; then
  echo "   ⚠️  OpenClaw workspace not found at $WS"
  echo "      Install OpenClaw first: https://openclaw.ai"
  echo "      Or set OPENCLAW_WORKSPACE to your workspace path."
  echo ""
fi

mkdir -p "$SKILL_DIR"
curl -fsSL "$REPO/skill/SKILL.md" -o "$SKILL_DIR/SKILL.md"
echo "   ✓ Skill installed → $SKILL_DIR/SKILL.md"

# ── Step 2: pip install ──────────────────────────────────────────
echo ""
echo "🐍 Step 2/3 — Installing catbus pip package..."

if ! command -v pip3 &>/dev/null && ! command -v pip &>/dev/null; then
  echo "   ✗ pip not found. Install Python 3.10+ first: https://python.org"
  exit 1
fi

PIP=$(command -v pip3 || command -v pip)
$PIP install --quiet --upgrade catbus
echo "   ✓ catbus $(python3 -c 'import catbus; print(catbus.__version__)' 2>/dev/null || echo 'installed')"

# ── Step 3: Init config ──────────────────────────────────────────
echo ""
echo "⚙️  Step 3/3 — Initializing CatBus config..."

catbus init

# Patch relay URL in config.yaml
CONFIG_FILE="$HOME/.catbus/config.yaml"
if [ -f "$CONFIG_FILE" ]; then
  # Replace any known relay URL with the target one
  sed -i.bak \
    -e "s|wss://relay.catbus.ai|$RELAY_URL|g" \
    -e "s|wss://relay.catbus.xyz|$RELAY_URL|g" \
    "$CONFIG_FILE" && rm -f "$CONFIG_FILE.bak"
  echo "   ✓ Relay set to $RELAY_URL"
else
  echo "   ⚠️  Config not found — relay URL not patched"
fi

# ── Done ─────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ CatBus installed!"
echo ""
echo "Next steps:"
echo ""
echo "  1. Start the daemon:"
echo "     catbus serve --daemon"
echo ""
echo "  2. Register your OpenClaw skills:"
echo "     catbus scan --add"
echo ""
echo "  3. Check network status:"
echo "     catbus status"
echo ""
if [ "$ENV" = "dev" ]; then
  echo "  Dev relay: $RELAY_URL"
  echo "  Dashboard: https://catbus.xyz"
else
  echo "  Relay: $RELAY_URL"
  echo "  Docs:  https://github.com/xiaogong2000/catbus"
fi
echo ""
