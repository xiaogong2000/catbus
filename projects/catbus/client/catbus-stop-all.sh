#!/usr/bin/env bash
# catbus-stop-all.sh — 一键停止所有 CatBus Daemon（紧急用）
# 用法: catbus-stop-all.sh [--start] 恢复所有服务
set -uo pipefail

ACTION="${1:-stop}"

# 机器列表：名字 SSH命令 停止命令 启动命令
declare -a MACHINES=(
  "nefi|local|launchctl unload $HOME/Library/LaunchAgents/com.catbus.daemon.plist 2>/dev/null; pkill -f catbus_daemon || true; rm -f /tmp/catbus.sock|rm -f /tmp/catbus.sock; launchctl unload $HOME/Library/LaunchAgents/com.catbus.daemon.plist 2>/dev/null; launchctl load $HOME/Library/LaunchAgents/com.catbus.daemon.plist"
  "gouzi|sshpass -p rocs1234 ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 pt@192.168.3.240|sudo systemctl stop catbus|sudo systemctl start catbus"
  "huanhuan|ssh -i ~/.ssh/dev_ovh_rsa.pem -o ConnectTimeout=5 debian@51.75.146.33|sudo systemctl stop catbus|sudo systemctl start catbus"
  "mimi|sshpass -p 3kjFWFQNALPEd3SVypG2 ssh -o StrictHostKeyChecking=no -o PubkeyAuthentication=no -o ConnectTimeout=5 root@23.94.9.58|systemctl stop catbus|systemctl start catbus"
  "xiaohei|ssh -i ~/.ssh/dev_ovh_rsa.pem -o ConnectTimeout=5 debian@147.135.15.43|sudo systemctl stop catbus|sudo systemctl start catbus"
)

if [ "$ACTION" = "--start" ] || [ "$ACTION" = "start" ]; then
  echo "🚀 启动所有 CatBus Daemon..."
  CMD_IDX=3
else
  echo "🛑 停止所有 CatBus Daemon..."
  CMD_IDX=2
fi

for entry in "${MACHINES[@]}"; do
  IFS='|' read -r name ssh_cmd stop_cmd start_cmd <<< "$entry"
  if [ "$CMD_IDX" = "2" ]; then cmd="$stop_cmd"; else cmd="$start_cmd"; fi

  echo -n "  $name... "
  if [ "$ssh_cmd" = "local" ]; then
    eval "$cmd" >/dev/null 2>&1
    echo "✅"
  else
    eval "$ssh_cmd '$cmd'" >/dev/null 2>&1 && echo "✅" || echo "⚠️ (连接失败或已停止)"
  fi
done

echo ""
if [ "$CMD_IDX" = "2" ]; then
  echo "全部已停止。恢复: $0 --start"
else
  echo "全部已启动。"
fi
