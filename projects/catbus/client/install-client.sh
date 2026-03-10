#!/usr/bin/env bash
set -euo pipefail

# CatBus 客户端安装脚本
# 用法: bash install-client.sh --name X --host X --port X --user X --pass X --ca X

CATBUS_DIR="/opt/catbus"
CONFIG_DIR="/etc/catbus"
LOG_DIR="/var/log/catbus"

# 解析参数
while [[ $# -gt 0 ]]; do
    case $1 in
        --name) NAME="$2"; shift 2;;
        --host) HOST="$2"; shift 2;;
        --port) PORT="$2"; shift 2;;
        --user) USER="$2"; shift 2;;
        --pass) PASS="$2"; shift 2;;
        --ca)   CA_B64="$2"; shift 2;;
        *) echo "未知参数: $1"; exit 1;;
    esac
done

for var in NAME HOST PORT USER PASS CA_B64; do
    [ -z "${!var:-}" ] && echo "❌ 缺少参数 --${var,,}" && exit 1
done

echo "🚌 CatBus 客户端安装中... (${NAME})"

# 安装 Python 依赖
pip3 install paho-mqtt >/dev/null 2>&1 || pip install paho-mqtt >/dev/null 2>&1

# 创建目录
mkdir -p "$CATBUS_DIR" "$CONFIG_DIR" "$LOG_DIR"

# 写入 CA 证书
echo "$CA_B64" | base64 -d > "$CONFIG_DIR/ca.crt" 2>/dev/null || \
echo "$CA_B64" | base64 -D > "$CONFIG_DIR/ca.crt"

# 生成配置
cat > "$CONFIG_DIR/config.json" <<EOF
{
  "machine_name": "$NAME",
  "broker_host": "$HOST",
  "broker_port": $PORT,
  "broker_user": "$USER",
  "broker_pass": "$PASS",
  "ca_cert": "$CONFIG_DIR/ca.crt",
  "socket_path": "/tmp/catbus.sock",
  "deliver_telegram": true,
  "log_dir": "$LOG_DIR",
  "max_workers": 1
}
EOF

# 下载 daemon
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$SCRIPT_DIR/catbus_daemon.py" ]; then
    cp "$SCRIPT_DIR/catbus_daemon.py" "$CATBUS_DIR/"
else
    echo "⚠️  请手动复制 catbus_daemon.py 到 $CATBUS_DIR/"
fi

# 检测 OS 并安装服务
OS="$(uname -s)"

install_systemd() {
    cat > /etc/systemd/system/catbus.service <<SVCEOF
[Unit]
Description=CatBus MQTT Daemon
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
ExecStart=/usr/bin/python3 $CATBUS_DIR/catbus_daemon.py
Restart=always
RestartSec=5
Environment=CATBUS_CONFIG=$CONFIG_DIR/config.json
Environment="PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/root/.local/bin"

[Install]
WantedBy=multi-user.target
SVCEOF
    systemctl daemon-reload
    systemctl enable catbus
    systemctl start catbus
}

install_launchd() {
    PLIST="$HOME/Library/LaunchAgents/com.catbus.daemon.plist"
    mkdir -p "$(dirname "$PLIST")"
    cat > "$PLIST" <<PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.catbus.daemon</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/python3</string>
        <string>$CATBUS_DIR/catbus_daemon.py</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
        <key>CATBUS_CONFIG</key>
        <string>$CONFIG_DIR/config.json</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$LOG_DIR/daemon.log</string>
    <key>StandardErrorPath</key>
    <string>$LOG_DIR/daemon.log</string>
</dict>
</plist>
PLISTEOF
    launchctl load "$PLIST"
}

if [ "$OS" = "Darwin" ]; then
    install_launchd
else
    install_systemd
fi

echo ""
echo "🚌 CatBus 客户端安装完成！"
echo "  机器名: $NAME"
echo "  Broker: $HOST:$PORT"
