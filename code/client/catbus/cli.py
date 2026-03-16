"""
CatBus CLI

Commands:
  catbus init              — 初始化 ~/.catbus/（生成 node_id + 默认配置）
  catbus serve             — 启动 daemon（前台）
  catbus serve --daemon    — 安装并启动系统服务（后台）
  catbus status            — 查看 daemon 状态
  catbus call <skill> ...  — 通过 HTTP API 调用远程 skill
"""

import argparse
import asyncio
import json
import sys
import urllib.request
import urllib.error

from .config import (
    Config, CATBUS_HOME, load_config, load_node_id,
    generate_node_id, save_node_id, save_default_config,
)


def cmd_init(args):
    """Initialize ~/.catbus/."""
    # Generate node_id if not exists
    existing = load_node_id()
    if existing:
        print(f"🔑 Node ID already exists: {existing}")
    else:
        node_id = generate_node_id()
        save_node_id(node_id)
        print(f"🔑 Node ID generated: {node_id}")

    # Write default config if not exists
    config_file = CATBUS_HOME / "config.yaml"
    if config_file.exists():
        print(f"📁 Config already exists: {config_file}")
    else:
        config = load_config()
        if not config.node_id:
            config.node_id = load_node_id()
        path = save_default_config(config)
        print(f"📁 Config created: {path}")

    print(f"\n✅ CatBus initialized at {CATBUS_HOME}")
    print(f"   Edit config: {CATBUS_HOME / 'config.yaml'}")
    print(f"   Start daemon: catbus serve")


def cmd_serve(args):
    """Start the CatBus daemon."""
    import logging
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )

    # Check init
    node_id = load_node_id()
    if not node_id:
        print("❌ Not initialized. Run 'catbus init' first.")
        sys.exit(1)

    # Install as daemon service?
    if args.daemon:
        from .service import install_daemon
        install_daemon()
        return

    # Run in foreground
    config = load_config()
    if not config.node_id:
        config.node_id = node_id

    from .daemon import CatBusDaemon
    daemon = CatBusDaemon(config)

    try:
        asyncio.run(daemon.run())
    except KeyboardInterrupt:
        print("\n👋 CatBus stopped.")


def cmd_status(args):
    """Query daemon status via HTTP."""
    port = args.port or 9800
    url = f"http://localhost:{port}/status"
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=3) as resp:
            data = json.loads(resp.read())
        print(f"🟢 CatBus Daemon is running")
        print(f"   Node ID:    {data.get('node_id', '?')}")
        print(f"   Name:       {data.get('node_name', '?')}")
        print(f"   Server:     {data.get('server', '?')}")
        print(f"   Status:     {data.get('status', '?')}")
        print(f"   Network:    {data.get('online_nodes', 0)} nodes, {data.get('available_skills', 0)} skills")
        print(f"   My skills:  {data.get('my_skills', [])}")
        print(f"   Uptime:     {data.get('uptime_seconds', 0)}s")
    except (urllib.error.URLError, ConnectionRefusedError):
        print("🔴 CatBus Daemon is not running")
        print(f"   Start with: catbus serve")
        sys.exit(1)


def cmd_call(args):
    """Call a remote skill via the daemon HTTP API."""
    port = args.port or 9800
    url = f"http://localhost:{port}/request"

    # Build input from remaining args
    input_data = {}
    if args.input:
        try:
            input_data = json.loads(args.input)
        except json.JSONDecodeError:
            print(f"❌ Invalid JSON input: {args.input}")
            sys.exit(1)

    payload = json.dumps({
        "skill": args.skill,
        "input": input_data,
        "timeout": args.timeout,
    }).encode()

    try:
        req = urllib.request.Request(
            url,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=args.timeout + 5) as resp:
            data = json.loads(resp.read())

        if data.get("status") == "ok":
            output = data.get("output", {})
            print(json.dumps(output, indent=2, ensure_ascii=False))
        else:
            error = data.get("error", "Unknown error")
            print(f"❌ {error}")
            sys.exit(1)

    except (urllib.error.URLError, ConnectionRefusedError):
        print("❌ CatBus Daemon is not running. Start with: catbus serve")
        sys.exit(1)


def cmd_skills(args):
    """List available skills on the network."""
    port = args.port or 9800
    url = f"http://localhost:{port}/network/skills"
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read())
        skills = data.get("skills", [])
        if not skills:
            print("No skills available on the network.")
            return
        print(f"📡 Network Skills ({len(skills)} available):\n")
        for s in skills:
            providers = s.get("providers", 0)
            print(f"  {s['name']:30s} ({providers} provider{'s' if providers != 1 else ''})")
            if s.get("description"):
                print(f"    {s['description']}")
    except (urllib.error.URLError, ConnectionRefusedError):
        print("❌ CatBus Daemon is not running. Start with: catbus serve")
        sys.exit(1)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="catbus",
        description="🚌 CatBus — The Uber for AI Agents",
    )
    sub = parser.add_subparsers(dest="command")

    # init
    sub.add_parser("init", help="Initialize ~/.catbus/")

    # serve
    p_serve = sub.add_parser("serve", help="Start the CatBus daemon")
    p_serve.add_argument("--daemon", action="store_true", help="Install and run as background service")

    # status
    p_status = sub.add_parser("status", help="Check daemon status")
    p_status.add_argument("--port", type=int, default=None)

    # call
    p_call = sub.add_parser("call", help="Call a remote skill")
    p_call.add_argument("skill", help="Skill name")
    p_call.add_argument("--input", "-i", default="{}", help='JSON input (e.g. \'{"text":"hello"}\')')
    p_call.add_argument("--timeout", "-t", type=int, default=30)
    p_call.add_argument("--port", type=int, default=None)

    # skills
    p_skills = sub.add_parser("skills", help="List network skills")
    p_skills.add_argument("--port", type=int, default=None)

    return parser


def run():
    parser = build_parser()
    args = parser.parse_args()

    if args.command == "init":
        cmd_init(args)
    elif args.command == "serve":
        cmd_serve(args)
    elif args.command == "status":
        cmd_status(args)
    elif args.command == "call":
        cmd_call(args)
    elif args.command == "skills":
        cmd_skills(args)
    else:
        parser.print_help()
