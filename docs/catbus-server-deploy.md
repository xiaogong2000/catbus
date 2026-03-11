# CatBus Server 部署文档

> 目标：在 VPS 上部署 CatBus Server，让节点可以通过 WebSocket 连接

---

## 一、服务器要求

- Ubuntu 22.04+ / Debian 12+（其他 Linux 发行版类似）
- Python 3.10+
- 最低配置：1 vCPU / 512MB RAM（Demo 阶段绰绰有余）
- 开放端口：8765（WebSocket）

---

## 二、快速部署（5 分钟）

### 2.1 SSH 登录服务器

```bash
ssh root@YOUR_SERVER_IP
```

### 2.2 安装依赖

```bash
# 更新系统
apt update && apt upgrade -y

# 安装 Python
apt install -y python3 python3-pip python3-venv git

# 确认版本
python3 --version  # 需要 3.10+
```

### 2.3 创建用户（不要用 root 跑服务）

```bash
useradd -m -s /bin/bash catbus
su - catbus
```

### 2.4 部署代码

```bash
# 方式 A：从 Git 拉取（推荐）
git clone https://github.com/catbus-network/catbus.git
cd catbus

# 方式 B：直接上传 server.py
mkdir -p ~/catbus/server
cd ~/catbus/server
# 然后用 scp 把 server.py 传上来
```

### 2.5 安装 Python 依赖

```bash
cd ~/catbus
python3 -m venv venv
source venv/bin/activate
pip install websockets
```

### 2.6 测试运行

```bash
cd ~/catbus/server
../venv/bin/python server.py --host 0.0.0.0 --port 8765
```

看到以下输出说明成功：

```
12:00:00 [INFO] 🚌 CatBus Server starting on ws://0.0.0.0:8765
12:00:00 [INFO] 🟢 Ready. Waiting for nodes...
```

`Ctrl+C` 停止，接下来配置为系统服务。

---

## 三、配置 systemd 服务

### 3.1 创建 service 文件

```bash
# 切回 root
exit

cat > /etc/systemd/system/catbus-server.service << 'EOF'
[Unit]
Description=CatBus Server - AI Agent Network Relay
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=catbus
Group=catbus
WorkingDirectory=/home/catbus/catbus/server
ExecStart=/home/catbus/catbus/venv/bin/python server.py --host 0.0.0.0 --port 8765
Restart=always
RestartSec=5

# 安全加固
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=/home/catbus/catbus
PrivateTmp=yes

# 日志
StandardOutput=journal
StandardError=journal
SyslogIdentifier=catbus-server

[Install]
WantedBy=multi-user.target
EOF
```

### 3.2 启动服务

```bash
systemctl daemon-reload
systemctl enable catbus-server    # 开机自启
systemctl start catbus-server     # 立即启动
```

### 3.3 验证

```bash
# 查看状态
systemctl status catbus-server

# 查看日志
journalctl -u catbus-server -f

# 测试 WebSocket 连接（需要 wscat，可选）
apt install -y nodejs npm
npm install -g wscat
wscat -c ws://localhost:8765
```

在 wscat 里输入以下 JSON 测试注册：

```json
{"type":"register","node_id":"test123","data":{"name":"test","skills":[{"name":"echo","description":"test"}]}}
```

看到 `register_ack` 响应说明一切正常。

---

## 四、防火墙配置

### 4.1 UFW（Ubuntu 默认）

```bash
ufw allow 22/tcp       # SSH
ufw allow 8765/tcp     # CatBus WebSocket
ufw enable
ufw status
```

### 4.2 如果用云服务商安全组

在云服务商控制台（AWS / GCP / 阿里云 / Vultr / Hetzner 等）：

- 添加入站规则：TCP 端口 8765，来源 0.0.0.0/0

---

## 五、域名配置（可选但推荐）

### 5.1 DNS 解析

在域名服务商添加 A 记录：

```
relay.catbus.ai  →  YOUR_SERVER_IP
```

### 5.2 Nginx 反向代理 + SSL（推荐）

这样客户端可以用 `wss://` 加密连接。

```bash
# 安装 Nginx + Certbot
apt install -y nginx certbot python3-certbot-nginx
```

创建 Nginx 配置：

```bash
cat > /etc/nginx/sites-available/catbus << 'EOF'
server {
    listen 80;
    server_name relay.catbus.ai;

    location / {
        proxy_pass http://127.0.0.1:8765;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
EOF

ln -s /etc/nginx/sites-available/catbus /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

申请 SSL 证书：

```bash
certbot --nginx -d relay.catbus.ai
```

完成后客户端连接地址变为：`wss://relay.catbus.ai`

---

## 六、运维命令速查

```bash
# 启动 / 停止 / 重启
systemctl start catbus-server
systemctl stop catbus-server
systemctl restart catbus-server

# 查看状态
systemctl status catbus-server

# 实时日志
journalctl -u catbus-server -f

# 最近 100 行日志
journalctl -u catbus-server -n 100

# 今天的日志
journalctl -u catbus-server --since today

# 查看连接数（有多少节点连着）
ss -tn | grep 8765 | wc -l

# 查看内存占用
ps aux | grep server.py
```

---

## 七、客户端连接测试

服务器部署完成后，在本地机器测试：

```bash
# 方式 1：用 wscat
wscat -c ws://YOUR_SERVER_IP:8765

# 方式 2：用 Python 快速测试
python3 -c "
import asyncio, websockets, json

async def test():
    uri = 'ws://YOUR_SERVER_IP:8765'
    async with websockets.connect(uri) as ws:
        # 注册
        await ws.send(json.dumps({
            'type': 'register',
            'node_id': 'test-node-001',
            'data': {
                'name': 'test-node',
                'skills': [{'name': 'echo', 'description': 'Echo test'}]
            }
        }))
        resp = await ws.recv()
        print('Response:', resp)

asyncio.run(test())
"
```

如果配置了域名 + SSL：

```bash
# 把 ws://YOUR_SERVER_IP:8765 换成
wss://relay.catbus.ai
```

---

## 八、配置客户端指向你的服务器

服务器跑起来后，客户端的 `~/.catbus/config.yaml` 里改 server 地址：

```yaml
# 无域名（直接 IP）
server: ws://YOUR_SERVER_IP:8765

# 有域名 + SSL
server: wss://relay.catbus.ai
```

或者通过环境变量：

```bash
export CATBUS_SERVER=ws://YOUR_SERVER_IP:8765
catbus serve
```

---

## 九、常见问题

### 连不上？

```bash
# 1. 确认服务在跑
systemctl status catbus-server

# 2. 确认端口在监听
ss -tlnp | grep 8765

# 3. 确认防火墙开了
ufw status

# 4. 从服务器本地测试
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  http://localhost:8765/
```

### 内存占用高？

不应该。Demo 阶段全内存字典，100 个节点也就几 MB。如果异常：

```bash
systemctl restart catbus-server
```

### 想看更详细的日志？

编辑 server.py 第一行的 `logging.basicConfig`，把 `level=logging.INFO` 改成 `level=logging.DEBUG`，然后重启。

---

## 十、部署检查清单

```
□ Python 3.10+ 已安装
□ catbus 用户已创建
□ server.py 已上传
□ websockets 已安装（pip install websockets）
□ systemd service 已配置并启动
□ 防火墙端口 8765 已开放
□ 从本地能 WebSocket 连上
□ （可选）域名 DNS 已配置
□ （可选）Nginx + SSL 已配置
```

全部打勾后，服务器就绪。回到本地跑 `catbus serve` 开始测试。
