#!/usr/bin/env bash
set -euo pipefail

# CatBus Broker 安装脚本
# 在 Broker 机器上执行：bash install-broker.sh

CATBUS_DIR="/opt/catbus"
MQTT_DIR="$CATBUS_DIR/mosquitto"
CERT_DIR="$MQTT_DIR/certs"
CONFIG_DIR="$MQTT_DIR/config"
DATA_DIR="$MQTT_DIR/data"
LOG_DIR="$MQTT_DIR/log"

echo "🚌 CatBus Broker 安装中..."

# 检查 Docker
if ! command -v docker &>/dev/null; then
    echo "📦 安装 Docker..."
    curl -fsSL https://get.docker.com | sh
fi

# 创建目录
mkdir -p "$CERT_DIR" "$CONFIG_DIR" "$DATA_DIR" "$LOG_DIR" "$CATBUS_DIR/registry"

# 生成 TLS 自签证书
if [ ! -f "$CERT_DIR/ca.crt" ]; then
    echo "🔐 生成 TLS 证书..."
    openssl req -new -x509 -days 3650 -extensions v3_ca \
        -keyout "$CERT_DIR/ca.key" -out "$CERT_DIR/ca.crt" \
        -subj "/CN=CatBus CA" -nodes 2>/dev/null

    openssl req -new -nodes \
        -keyout "$CERT_DIR/server.key" -out "$CERT_DIR/server.csr" \
        -subj "/CN=catbus-broker" 2>/dev/null

    # 获取公网 IP 用于 SAN
    PUBLIC_IP=$(curl -s ifconfig.me || echo "127.0.0.1")

    cat > "$CERT_DIR/san.cnf" <<EOF
[v3_req]
subjectAltName = IP:${PUBLIC_IP}, IP:127.0.0.1, DNS:localhost
EOF

    openssl x509 -req -in "$CERT_DIR/server.csr" \
        -CA "$CERT_DIR/ca.crt" -CAkey "$CERT_DIR/ca.key" -CAcreateserial \
        -out "$CERT_DIR/server.crt" -days 3650 \
        -extensions v3_req -extfile "$CERT_DIR/san.cnf" 2>/dev/null

    rm -f "$CERT_DIR/server.csr" "$CERT_DIR/san.cnf" "$CERT_DIR/ca.srl"
fi

# Mosquitto 配置
cat > "$CONFIG_DIR/mosquitto.conf" <<'EOF'
listener 8883
certfile /mosquitto/certs/server.crt
keyfile /mosquitto/certs/server.key
cafile /mosquitto/certs/ca.crt

allow_anonymous false
password_file /mosquitto/config/passwd

persistence true
persistence_location /mosquitto/data/

log_dest file /mosquitto/log/mosquitto.log
log_type all
EOF

# 初始化空密码文件
touch "$CONFIG_DIR/passwd"

# 启动 Mosquitto 容器
docker rm -f catbus-broker 2>/dev/null || true
docker run -d \
    --name catbus-broker \
    --restart always \
    -p 8883:8883 \
    -v "$CONFIG_DIR:/mosquitto/config" \
    -v "$DATA_DIR:/mosquitto/data" \
    -v "$LOG_DIR:/mosquitto/log" \
    -v "$CERT_DIR:/mosquitto/certs" \
    eclipse-mosquitto:2

# 安装管理命令
for cmd in catbus-add catbus-list catbus-remove; do
    cp "$CATBUS_DIR/broker/$cmd" "/usr/local/bin/$cmd" 2>/dev/null || true
done

PUBLIC_IP=$(curl -s ifconfig.me || echo "未知")

echo ""
echo "🚌 CatBus Broker 安装完成！"
echo ""
echo "  Broker 地址: ${PUBLIC_IP}:8883"
echo "  管理命令:"
echo "    catbus-add <机器名>     添加机器人，生成安装命令"
echo "    catbus-list             列出已注册机器人"
echo "    catbus-remove <机器名>  移除机器人"
