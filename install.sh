#!/bin/bash
# CatBus OpenClaw Skill Installer
# Usage: curl -fsSL https://raw.githubusercontent.com/xiaogong2000/catbus/main/install.sh | bash

set -e

REPO="https://raw.githubusercontent.com/xiaogong2000/catbus/main"
SKILL_DIR="${OPENCLAW_WORKSPACE:-$HOME/.openclaw/workspace}/skills/catbus"

echo ""
echo "🚌 CatBus Installer"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── Step 1: Install OpenClaw Skill ──────────────────────────────
echo "📦 Step 1/3 — Installing OpenClaw skill..."

mkdir -p "$SKILL_DIR"
curl -fsSL "$REPO/skill/SKILL.md" -o "$SKILL_DIR/SKILL.md"
echo "   ✓ Skill installed → $SKILL_DIR/SKILL.md"

# ── Step 2: Install pip package ─────────────────────────────────
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

if [ ! -f "$HOME/.catbus/config.yaml" ]; then
  mkdir -p "$HOME/.catbus"
  cat > "$HOME/.catbus/config.yaml" << 'YAML'
# CatBus configuration
# Relay server — use the public relay or self-host: https://github.com/xiaogong2000/catbus-server
server_url: wss://relay.catbus.ai
port: 9800
node_name: ""        # leave empty to auto-generate
YAML
  echo "   ✓ Config created → ~/.catbus/config.yaml"
else
  echo "   ✓ Config already exists → ~/.catbus/config.yaml"
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
echo "  Relay: wss://relay.catbus.ai"
echo "  Docs:  https://github.com/xiaogong2000/catbus"
echo ""
