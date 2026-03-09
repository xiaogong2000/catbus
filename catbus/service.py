"""
CatBus 服务安装器

自动安装 systemd (Linux) 或 launchd (macOS) 服务。
"""

import os
import platform
import shutil
import subprocess
import sys
from pathlib import Path

from .config import CATBUS_HOME


def get_catbus_bin() -> str:
    """Find the catbus executable path."""
    which = shutil.which("catbus")
    if which:
        return which
    # Fallback: python -m catbus
    return f"{sys.executable} -m catbus"


def install_systemd():
    """Install systemd user service (Linux)."""
    service_dir = Path.home() / ".config" / "systemd" / "user"
    service_dir.mkdir(parents=True, exist_ok=True)
    service_file = service_dir / "catbus.service"

    catbus_bin = get_catbus_bin()
    server = os.environ.get("CATBUS_SERVER", "ws://localhost:8765")

    content = f"""\
[Unit]
Description=CatBus Daemon
After=network.target

[Service]
Type=simple
ExecStart={catbus_bin} serve
Restart=always
RestartSec=5
Environment=CATBUS_HOME={CATBUS_HOME}

[Install]
WantedBy=default.target
"""
    service_file.write_text(content)

    # Enable and start
    subprocess.run(["systemctl", "--user", "daemon-reload"], check=True)
    subprocess.run(["systemctl", "--user", "enable", "--now", "catbus"], check=True)

    # Enable linger so service survives logout
    user = os.environ.get("USER", "")
    if user:
        subprocess.run(["loginctl", "enable-linger", user], check=False)

    print(f"✅ systemd service installed: {service_file}")
    print("   View logs: journalctl --user -u catbus -f")


def install_launchd():
    """Install launchd agent (macOS)."""
    agents_dir = Path.home() / "Library" / "LaunchAgents"
    agents_dir.mkdir(parents=True, exist_ok=True)
    plist_file = agents_dir / "network.catbus.daemon.plist"

    catbus_bin = get_catbus_bin()
    parts = catbus_bin.split()

    # Build ProgramArguments
    if len(parts) == 1:
        prog_args = f"""    <array>
        <string>{parts[0]}</string>
        <string>serve</string>
    </array>"""
    else:
        # python -m catbus serve
        prog_args = f"""    <array>
        <string>{parts[0]}</string>
        <string>{parts[1]}</string>
        <string>{parts[2]}</string>
        <string>serve</string>
    </array>"""

    content = f"""\
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>network.catbus.daemon</string>
    <key>ProgramArguments</key>
{prog_args}
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>{CATBUS_HOME}/catbus.log</string>
    <key>StandardErrorPath</key>
    <string>{CATBUS_HOME}/catbus.err</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>CATBUS_HOME</key>
        <string>{CATBUS_HOME}</string>
    </dict>
</dict>
</plist>
"""
    plist_file.write_text(content)

    # Load the service
    subprocess.run(["launchctl", "unload", str(plist_file)], check=False, capture_output=True)
    subprocess.run(["launchctl", "load", str(plist_file)], check=True)

    print(f"✅ launchd agent installed: {plist_file}")
    print(f"   View logs: tail -f {CATBUS_HOME}/catbus.log")


def install_daemon():
    """Detect platform and install appropriate service."""
    system = platform.system()
    if system == "Linux":
        install_systemd()
    elif system == "Darwin":
        install_launchd()
    else:
        print(f"⚠️  Unsupported platform: {system}")
        print("   Run manually: catbus serve")


def uninstall_daemon():
    """Remove the installed service."""
    system = platform.system()
    if system == "Linux":
        subprocess.run(["systemctl", "--user", "stop", "catbus"], check=False)
        subprocess.run(["systemctl", "--user", "disable", "catbus"], check=False)
        service_file = Path.home() / ".config" / "systemd" / "user" / "catbus.service"
        if service_file.exists():
            service_file.unlink()
        subprocess.run(["systemctl", "--user", "daemon-reload"], check=False)
        print("✅ systemd service removed")
    elif system == "Darwin":
        plist_file = Path.home() / "Library" / "LaunchAgents" / "network.catbus.daemon.plist"
        subprocess.run(["launchctl", "unload", str(plist_file)], check=False, capture_output=True)
        if plist_file.exists():
            plist_file.unlink()
        print("✅ launchd agent removed")
