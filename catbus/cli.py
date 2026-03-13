"""
CatBus CLI

Commands:
  catbus init              — 初始化 ~/.catbus/（生成 node_id + 默认配置）
  catbus serve             — 启动 daemon（前台）
  catbus serve --daemon    — 安装并启动系统服务（后台）
  catbus status            — 查看 daemon 状态
  catbus call <capability> — 通过 HTTP API 调用远程能力（如 model/claude-sonnet-4, skill/tavily）
  catbus bind <token>      — 绑定到 catbus.xyz 并上报 capabilities
  catbus scan              — 扫描本地 OpenClaw skills
  catbus skills            — 列出网络上可用的 skills
"""

import argparse
import asyncio
import json
import sys
import urllib.request
import urllib.error

from .config import (
    Config, CapabilityConfig, CATBUS_HOME, load_config, load_node_id,
    generate_node_id, save_node_id, save_default_config,
)


def cmd_init(args):
    """Initialize ~/.catbus/."""
    existing = load_node_id()
    if existing:
        print(f"🔑 Node ID already exists: {existing}")
    else:
        node_id = generate_node_id()
        save_node_id(node_id)
        print(f"🔑 Node ID generated: {node_id}")

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

    node_id = load_node_id()
    if not node_id:
        print("❌ Not initialized. Run 'catbus init' first.")
        sys.exit(1)

    if args.daemon:
        from .service import install_daemon
        install_daemon()
        return

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
        print(f"   Node ID:       {data.get('node_id', '?')}")
        print(f"   Name:          {data.get('node_name', '?')}")
        print(f"   Server:        {data.get('server', '?')}")
        print(f"   Status:        {data.get('status', '?')}")
        print(f"   Network:       {data.get('online_nodes', 0)} nodes, {data.get('available_skills', 0)} skills")

        # 显示 capabilities（新格式）
        caps = data.get("my_capabilities", [])
        if caps:
            models = [c for c in caps if c.startswith("model/")]
            skills = [c for c in caps if c.startswith("skill/")]
            if models:
                print(f"   Models:        {models}")
            if skills:
                print(f"   Skills:        {skills}")
        else:
            # Fallback 到老格式
            print(f"   My skills:     {data.get('my_skills', [])}")

        print(f"   Uptime:        {data.get('uptime_seconds', 0)}s")
    except (urllib.error.URLError, ConnectionRefusedError):
        print("🔴 CatBus Daemon is not running")
        print(f"   Start with: catbus serve")
        sys.exit(1)


def cmd_call(args):
    """
    Call a remote capability via the daemon HTTP API.

    支持：
      catbus call model/claude-sonnet-4 -i '{"prompt": "..."}'
      catbus call skill/tavily -i '{"query": "..."}'
      catbus call echo -i '{"text": "hello"}'           # 老格式兼容
    """
    port = args.port or 9800
    url = f"http://localhost:{port}/request"

    input_data = {}
    if args.input:
        try:
            input_data = json.loads(args.input)
        except json.JSONDecodeError:
            print(f"❌ Invalid JSON input: {args.input}")
            sys.exit(1)

    payload = json.dumps({
        "capability": args.capability,
        "skill": args.capability,   # 向后兼容
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


def cmd_bind(args):
    """
    Bind this node to catbus.xyz and report capabilities.

    用法：
      catbus bind <token> --models "claude-sonnet-4,deepseek-v3" --skills "tavily,image-gen"
    """
    from .capability_db import extract_base_model, get_model_info, get_skill_info

    node_id = load_node_id()
    if not node_id:
        print("❌ Not initialized. Run 'catbus init' first.")
        sys.exit(1)

    config = load_config()
    capabilities = []

    # 解析 --models
    if args.models:
        for raw_model in args.models.split(","):
            raw_model = raw_model.strip()
            if not raw_model:
                continue
            base = extract_base_model(raw_model)
            if base:
                info = get_model_info(base)
                capabilities.append({
                    "type": "model",
                    "name": f"model/{base}",
                    "meta": {
                        "raw_name": raw_model,
                        "provider": info.get("provider", "unknown"),
                        "context_window": info.get("context_window", 0),
                        "strengths": info.get("strengths", []),
                        "cost_tier": info.get("cost_tier", "medium"),
                    },
                })
                print(f"  ✅ model/{base} (from '{raw_model}')")
            else:
                # 未识别的模型，原样注册
                capabilities.append({
                    "type": "model",
                    "name": f"model/{raw_model}",
                    "meta": {
                        "raw_name": raw_model,
                        "provider": "unknown",
                        "cost_tier": "medium",
                    },
                })
                print(f"  ⚠️  model/{raw_model} (unrecognized, registered as-is)")

    # 解析 --skills
    if args.skills:
        for skill_name in args.skills.split(","):
            skill_name = skill_name.strip()
            if not skill_name:
                continue
            info = get_skill_info(skill_name)
            capabilities.append({
                "type": "skill",
                "name": f"skill/{skill_name}",
                "meta": {
                    "category": info.get("category", "utility"),
                    "cost_tier": info.get("cost_tier", "free"),
                    "shareable": info.get("shareable", True),
                },
            })
            print(f"  ✅ skill/{skill_name}")

    if not capabilities:
        print("⚠️  No models or skills specified. Use --models and/or --skills.")
        print("  Example: catbus bind <token> --models claude-sonnet-4 --skills tavily,image-gen")
        return

    # 发送到 catbus.xyz
    payload = json.dumps({
        "token": args.token,
        "node_id": node_id,
        "name": config.node_name or f"node-{node_id[:6]}",
        "capabilities": capabilities,
    }).encode()

    bind_url = "https://catbus.xyz/api/dashboard/agents/bind"
    print(f"\n📡 Binding to {bind_url}...")

    try:
        req = urllib.request.Request(
            bind_url,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())

        if data.get("ok") or data.get("success"):
            print(f"✅ Bound successfully! {len(capabilities)} capabilities registered.")
        else:
            error = data.get("error", data.get("message", "Unknown error"))
            print(f"❌ Bind failed: {error}")
            sys.exit(1)

    except urllib.error.HTTPError as e:
        body = e.read().decode()[:200]
        print(f"❌ HTTP {e.code}: {body}")
        sys.exit(1)
    except (urllib.error.URLError, ConnectionRefusedError) as e:
        print(f"❌ Cannot reach {bind_url}: {e}")
        sys.exit(1)


def cmd_scan(args):
    """Scan local OpenClaw skills and optionally add them to config.yaml."""
    from .scanner import scan_to_capabilities

    entries = scan_to_capabilities()

    # 按类型分组显示
    models = [e for e in entries if e.type == "model"]
    skills = [e for e in entries if e.type == "skill"]

    if models:
        print(f"\n🧠 Models ({len(models)}):")
        for e in models:
            tier = e.meta.get("cost_tier", "?")
            print(f"  {e.name:35s} [{tier}]")

    print(f"\n🔧 Skills ({len(skills)}):")
    for e in skills:
        shareable = e.meta.get("shareable", True)
        category = e.meta.get("category", "?")
        marker = "✅" if shareable else "🔒"
        desc = e.meta.get("description", "")[:50]
        print(f"  {marker} {e.name:35s} [{category}] {desc}")

    if args.add:
        _add_capabilities_to_config(entries)


def _add_capabilities_to_config(new_entries: list[CapabilityConfig]):
    """
    将扫描到的 capabilities 写入 config.yaml。
    - 保留 source != 'openclaw' 的 manual 条目
    - 用新扫描结果替换所有 source == 'openclaw' 条目
    """
    import yaml

    config_file = CATBUS_HOME / "config.yaml"
    if not config_file.exists():
        print("❌ config.yaml not found. Run 'catbus init' first.")
        return

    with open(config_file) as f:
        raw = yaml.safe_load(f) or {}

    existing_caps = raw.get("capabilities", [])

    # 分离 manual 和 openclaw
    manual = [c for c in existing_caps if c.get("meta", {}).get("source", "") != "openclaw"]
    old_names = {c["name"] for c in existing_caps if c.get("meta", {}).get("source", "") == "openclaw"}

    # 新扫描结果
    new_caps = []
    for e in new_entries:
        new_caps.append({
            "type": e.type,
            "name": e.name,
            "handler": e.handler,
            "meta": e.meta,
        })

    new_names = {c["name"] for c in new_caps}

    # 去掉与新 openclaw 同名的 manual
    manual = [c for c in manual if c["name"] not in new_names]

    added = new_names - old_names
    removed = old_names - new_names

    raw["capabilities"] = manual + new_caps

    # 同时更新老格式 skills（向后兼容）
    raw["skills"] = []
    for e in new_entries:
        if e.type == "skill":
            raw["skills"].append({
                "name": e.short_name,
                "description": e.meta.get("description", ""),
                "handler": e.handler,
                "input_schema": {"task": "string"},
                "source": e.meta.get("source", "openclaw"),
            })

    with open(config_file, "w") as f:
        yaml.dump(raw, f, default_flow_style=False, allow_unicode=True)

    if added:
        print(f"  ✅ Added:     {sorted(added)}")
    if removed:
        print(f"  🗑️  Removed:   {sorted(removed)}")
    print(f"📝 config.yaml updated ({len(manual)} manual + {len(new_caps)} scanned capabilities)")


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
    from . import __version__
    parser = argparse.ArgumentParser(
        prog="catbus",
        description="🚌 CatBus — The Uber for AI Agents",
    )
    parser.add_argument("--version", "-V", action="version", version=f"catbus {__version__}")
    sub = parser.add_subparsers(dest="command")

    # version (subcommand alias)
    sub.add_parser("version", help="Show version")

    # init
    sub.add_parser("init", help="Initialize ~/.catbus/")

    # serve
    p_serve = sub.add_parser("serve", help="Start the CatBus daemon")
    p_serve.add_argument("--daemon", action="store_true", help="Install and run as background service")

    # status
    p_status = sub.add_parser("status", help="Check daemon status")
    p_status.add_argument("--port", type=int, default=None)

    # call (renamed arg from 'skill' to 'capability')
    p_call = sub.add_parser("call", help="Call a remote capability (e.g. model/claude-sonnet-4, skill/tavily)")
    p_call.add_argument("capability", help="Capability name (type/name format)")
    p_call.add_argument("--input", "-i", default="{}", help='JSON input (e.g. \'{"prompt":"hello"}\')')
    p_call.add_argument("--timeout", "-t", type=int, default=30)
    p_call.add_argument("--port", type=int, default=None)

    # bind (NEW)
    p_bind = sub.add_parser("bind", help="Bind to catbus.xyz and report capabilities")
    p_bind.add_argument("token", help="Bind token from catbus.xyz Dashboard")
    p_bind.add_argument("--models", "-m", default="", help="Comma-separated model names")
    p_bind.add_argument("--skills", "-s", default="", help="Comma-separated skill names")

    # skills
    p_skills = sub.add_parser("skills", help="List network skills")
    p_skills.add_argument("--port", type=int, default=None)

    # scan
    p_scan = sub.add_parser("scan", help="Scan local OpenClaw skills")
    p_scan.add_argument("--add", action="store_true", help="Write results to config.yaml")

    return parser


def run():
    parser = build_parser()
    args = parser.parse_args()

    if args.command == "init":
        cmd_init(args)
    elif args.command == "serve":
        cmd_serve(args)
    elif args.command == "version":
        from . import __version__
        print(f"catbus {__version__}")
    elif args.command == "status":
        cmd_status(args)
    elif args.command == "call":
        cmd_call(args)
    elif args.command == "bind":
        cmd_bind(args)
    elif args.command == "skills":
        cmd_skills(args)
    elif args.command == "scan":
        cmd_scan(args)
    else:
        parser.print_help()
