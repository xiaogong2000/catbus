# catbus init 自动生成 systemd service

## 背景

Hz 节点因为 catbus daemon 用 nohup 裸跑，进程挂了没有自动重启，导致节点掉线、网络 skill 丢失。所有节点都应该用 systemd 托管，并且在安装时自动完成，不需要用户手动写 service 文件。

---

## 任务 1：`catbus init` 自动生成并启用 systemd service

**文件：** CLI 中 `init` 命令所在模块

在 `catbus init` 现有逻辑（生成 config.yaml）之后，新增 systemd 设置：

```python
import shutil
import subprocess
import os
from pathlib import Path

def setup_systemd():
    """生成 systemd service 文件并启用"""

    # 找到 catbus 可执行文件路径
    catbus_bin = shutil.which("catbus")
    if not catbus_bin:
        print("⚠️  catbus 命令未找到，跳过 systemd 配置")
        return False

    user_home = str(Path.home())

    service_content = f"""[Unit]
Description=CatBus Daemon
After=network-online.target
Wants=network-online.target

[Service]
ExecStart={catbus_bin} serve
Restart=always
RestartSec=10
Environment=HOME={user_home}
WorkingDirectory={user_home}

[Install]
WantedBy=multi-user.target
"""

    # 检查是否有 root 权限（systemd 需要）
    if os.getuid() != 0:
        print("⚠️  需要 root 权限安装 systemd service")
        print("    请手动执行: sudo catbus init --systemd")
        return False

    # 写 service 文件
    service_path = Path("/etc/systemd/system/catbus.service")
    service_path.write_text(service_content)

    # 启用并启动
    subprocess.run(["systemctl", "daemon-reload"], check=True)
    subprocess.run(["systemctl", "enable", "catbus"], check=True)
    subprocess.run(["systemctl", "start", "catbus"], check=True)

    print("✅ CatBus daemon 已启动并设为开机自启")
    print("   查看状态: systemctl status catbus")
    print("   查看日志: journalctl -u catbus -f")
    return True
```

### 集成到 init 命令

```python
@cli.command()
def init():
    # ... 现有逻辑：生成 config.yaml, node_id 等 ...

    # 新增：设置 systemd
    if is_linux():
        setup_systemd()
    elif is_macos():
        setup_launchd()  # macOS 用 launchd，见任务 2
    else:
        print("ℹ️  请手动启动 daemon: catbus serve --daemon")
```

---

## 任务 2：macOS 支持 launchd

macOS 没有 systemd，用 launchd 替代：

```python
def setup_launchd():
    """生成 launchd plist 并加载"""

    catbus_bin = shutil.which("catbus")
    if not catbus_bin:
        print("⚠️  catbus 命令未找到，跳过 launchd 配置")
        return False

    plist_content = f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>ai.catbus.daemon</string>
    <key>ProgramArguments</key>
    <array>
        <string>{catbus_bin}</string>
        <string>serve</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>{Path.home()}/.catbus/catbus.log</string>
    <key>StandardErrorPath</key>
    <string>{Path.home()}/.catbus/catbus.err</string>
</dict>
</plist>
"""

    plist_path = Path.home() / "Library/LaunchAgents/ai.catbus.daemon.plist"
    plist_path.parent.mkdir(parents=True, exist_ok=True)
    plist_path.write_text(plist_content)

    subprocess.run(["launchctl", "load", str(plist_path)], check=True)

    print("✅ CatBus daemon 已启动并设为登录自启")
    print("   查看状态: launchctl list | grep catbus")
    print("   查看日志: tail -f ~/.catbus/catbus.log")
    return True
```

---

## 任务 3：`catbus serve --daemon` 改用 systemd/launchd

当前 `--daemon` 用 nohup 后台跑。改为调用系统服务管理器：

```python
@cli.command()
@click.option("--daemon", is_flag=True)
def serve(daemon):
    if daemon:
        if is_linux():
            subprocess.run(["systemctl", "start", "catbus"])
            print("✅ CatBus daemon 已启动 (systemd)")
            print("   查看状态: systemctl status catbus")
        elif is_macos():
            plist = Path.home() / "Library/LaunchAgents/ai.catbus.daemon.plist"
            subprocess.run(["launchctl", "load", str(plist)])
            print("✅ CatBus daemon 已启动 (launchd)")
        else:
            # fallback: 保留 nohup 方式
            start_nohup()
        return

    # 无 --daemon 参数：前台运行（调试用），保持现有逻辑不变
    start_foreground()
```

同理 `catbus serve --stop`：

```python
if is_linux():
    subprocess.run(["systemctl", "stop", "catbus"])
elif is_macos():
    subprocess.run(["launchctl", "unload", str(plist)])
```

---

## 任务 4：处理已有 nohup 进程的迁移

对于已经在跑 nohup 的节点，`catbus init` 检测到旧进程时自动清理：

```python
def cleanup_old_daemon():
    """杀掉旧的 nohup catbus 进程"""
    result = subprocess.run(
        ["pgrep", "-f", "catbus serve"],
        capture_output=True, text=True
    )
    if result.stdout.strip():
        pids = result.stdout.strip().split("\n")
        for pid in pids:
            subprocess.run(["kill", pid])
        print(f"ℹ️  已停止 {len(pids)} 个旧的 catbus 进程")
        import time
        time.sleep(2)  # 等端口释放
```

在 `setup_systemd()` 和 `setup_launchd()` 开头调用。

---

## 任务 5：验证

### Linux 节点（浣浣、小黑、Hz）

```bash
# 重新 init（会生成 systemd service 并启动）
sudo catbus init

# 确认 systemd 托管
systemctl status catbus
# 期望：active (running)

# 模拟崩溃
sudo kill $(pgrep -f "catbus serve")
sleep 15
systemctl status catbus
# 期望：自动重启，active (running)

# 确认开机自启
systemctl is-enabled catbus
# 期望：enabled

# 确认节点在线
curl -s https://relay.catbus.xyz/network/skills | python3 -c "import sys,json; print(len(json.load(sys.stdin)))"
```

### macOS 节点（如果有）

```bash
catbus init

# 确认 launchd 托管
launchctl list | grep catbus
# 期望：有 ai.catbus.daemon 条目

# 确认日志
tail -5 ~/.catbus/catbus.log
```

### 完整安装流程测试

在一台干净机器上走完整流程：

```bash
pip install catbus
catbus init          # 期望：config + systemd/launchd + daemon 自动启动
catbus scan --add    # 注册 skill 到网络
catbus ask model/best "hello"  # 期望：拿到结果
```

---

## 不做的事

- ❌ 不做 Docker 容器化（当前用户群不需要）
- ❌ 不做 Windows 支持（OpenClaw 用户几乎没有 Windows）
- ❌ 不改 `catbus serve` 前台模式的行为（调试用，保持原样）

---

## 预估工作量

| 任务 | 工作量 |
|------|--------|
| systemd 生成 + 集成到 init | 1 小时 |
| launchd 支持 | 1 小时 |
| serve --daemon 改用系统服务 | 30 分钟 |
| 旧进程清理 | 15 分钟 |
| 三个节点验证 | 30 分钟 |

总计：半天内完成。
