"""
CatBus CLI

Commands:
  catbus init              — 初始化 + 自动探测模型 + 扫描 skills → 写入 config.yaml
  catbus serve             — 启动 daemon
  catbus status            — 查看 daemon 状态
  catbus detect            — 手动探测本机模型
  catbus call <capability> — 调用远程能力
  catbus ask <selector> <task> — 用自然语言调用能力
  catbus bind <token>      — 绑定到 catbus.xyz
  catbus bind-prompt       — 生成 Agent 绑定 prompt
  catbus scan              — 扫描本地 skills
  catbus skills            — 列出网络 skills
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


# ─── init ─────────────────────────────────────────────────────

def cmd_init(args):
    """Initialize ~/.catbus/ → detect models → scan skills → write config.yaml."""
    import yaml

    # 1. Generate node_id
    existing = load_node_id()
    if existing:
        print("" + "\n" + f"🔑 Node ID already exists: {existing}")
        node_id = existing
    else:
        node_id = generate_node_id()
        save_node_id(node_id)
        print("" + "\n" + f"🔑 Node ID generated: {node_id}")

    config_file = CATBUS_HOME / "config.yaml"

    if config_file.exists():
        print("" + "\n" + f"📁 Config already exists: {config_file}")
    else:
        config = load_config()
        if not config.node_id:
            config.node_id = node_id
        save_default_config(config)
        print("" + "\n" + f"📁 Config created: {config_file}")

    # 2. 探测模型
    print("" + "\n" + f"\n🔍 Detecting installed models...")
    detected_caps = []

    try:
        from .detector import detect_models
        results = asyncio.run(detect_models())

        for r in results:
            if r.base_name.startswith("unknown-"):
                print("" + "\n" + f"  📊 Could not identify specific model (tier: {r.cost_tier})")
                continue

            icon = {"high": "🟢", "medium": "🟡", "low": "🔴"}.get(r.confidence, "⚪")
            print("" + "\n" + f"  {icon} model/{r.base_name} ({r.method}, {r.confidence})")
            detected_caps.append({
                "type": "model",
                "name": f"model/{r.base_name}",
                "handler": "gateway:default",
                "meta": {
                    "provider": r.provider,
                    "cost_tier": r.cost_tier,
                    "strengths": r.strengths,
                    "arena_elo": r.arena_elo,
                    "detected": True,
                    "detection_method": r.method,
                },
            })

        if not detected_caps:
            print("  ⚠️  No models detected (is OpenClaw Gateway running?)")
            print("     You can add models later: catbus detect")

    except Exception as e:
        print("" + "\n" + f"  ⚠️  Detection failed: {e}")
        print("     You can add models later: catbus detect")

    # 3. 扫描 skills
    print("" + "\n" + f"\n🔍 Scanning OpenClaw skills...")
    scanned_caps = []

    try:
        from .scanner import scan_to_capabilities
        skill_caps = scan_to_capabilities()

        for cap in skill_caps:
            scanned_caps.append({
                "type": cap.type,
                "name": cap.name,
                "handler": cap.handler,
                "meta": cap.meta,
            })
            shareable = cap.meta.get("shareable", True)
            marker = "✅" if shareable else "🔒"
            print("" + "\n" + f"  {marker} {cap.name}")

        if not skill_caps:
            print("  ➖ No OpenClaw skills found")

    except Exception as e:
        print("" + "\n" + f"  ⚠️  Scan failed: {e}")

    # 4. 写入 config.yaml
    if detected_caps or scanned_caps:
        with open(config_file) as f:
            raw = yaml.safe_load(f) or {}

        # 保留手动配置的 capabilities（非 detected）
        existing_caps = raw.get("capabilities", [])
        manual = [c for c in existing_caps if not c.get("meta", {}).get("detected")]

        # 合并：手动 + 探测模型 + 扫描 skills，去重
        all_caps = manual + detected_caps + scanned_caps
        seen = set()
        deduped = []
        for c in all_caps:
            if c["name"] not in seen:
                seen.add(c["name"])
                deduped.append(c)

        raw["capabilities"] = deduped

        # 同时写 skills（向后兼容）
        raw["skills"] = []
        for c in deduped:
            if c["type"] == "skill":
                short = c["name"].split("/", 1)[-1] if "/" in c["name"] else c["name"]
                raw["skills"].append({
                    "name": short,
                    "description": c.get("meta", {}).get("description", ""),
                    "handler": c.get("handler", "gateway:default"),
                    "input_schema": {"task": "string"},
                    "source": c.get("meta", {}).get("source", ""),
                })

        with open(config_file, "w") as f:
            yaml.dump(raw, f, default_flow_style=False, allow_unicode=True)

        model_count = len([c for c in deduped if c["type"] == "model"])
        skill_count = len([c for c in deduped if c["type"] == "skill"])
        print("" + "\n" + f"\n📝 Config updated: {model_count} model(s) + {skill_count} skill(s)")

    # 5. Done
    print("" + "\n" + f"\n✅ CatBus initialized at {CATBUS_HOME}")
    print("" + "\n" + f"   Edit config: {config_file}")
    print("" + "\n" + f"   Start daemon: catbus serve")

    # Auto-install daemon service
    import platform as _platform
    if _platform.system() in ("Linux", "Darwin"):
        print("\n⚙️  Setting up daemon service...")
        try:
            from .service import install_daemon, cleanup_old_daemon
            cleanup_old_daemon()
            install_daemon()
        except Exception as _e:
            print(f"⚠️  Daemon setup skipped: {_e}")
            print("   Start manually: catbus serve")


# ─── serve ────────────────────────────────────────────────────

def cmd_serve(args):
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
        from .service import start_daemon
        start_daemon()
        return

    if getattr(args, 'stop', False):
        from .service import stop_daemon
        stop_daemon()
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


# ─── status ───────────────────────────────────────────────────

def cmd_status(args):
    port = args.port or 9800
    url = f"http://localhost:{port}/status"
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=3) as resp:
            data = json.loads(resp.read())
        print("" + "\n" + f"🟢 CatBus Daemon is running")
        print("" + "\n" + f"   Node ID:       {data.get('node_id', '?')}")
        print("" + "\n" + f"   Name:          {data.get('node_name', '?')}")
        print("" + "\n" + f"   Server:        {data.get('server', '?')}")
        print("" + "\n" + f"   Status:        {data.get('status', '?')}")
        print("" + "\n" + f"   Network:       {data.get('online_nodes', 0)} nodes, {data.get('available_skills', 0)} skills")

        caps = data.get("my_capabilities", [])
        if caps:
            models = [c for c in caps if c.startswith("model/")]
            skills = [c for c in caps if c.startswith("skill/")]
            if models:
                print("" + "\n" + f"   Models:        {models}")
            if skills:
                print("" + "\n" + f"   Skills:        {skills}")
        else:
            print("" + "\n" + f"   My skills:     {data.get('my_skills', [])}")

        detected = data.get("detected_models", [])
        if detected:
            print("" + "\n" + f"   Detected:      {detected}")

        print("" + "\n" + f"   Uptime:        {data.get('uptime_seconds', 0)}s")
    except (urllib.error.URLError, ConnectionRefusedError):
        print("🔴 CatBus Daemon is not running")
        print("" + "\n" + f"   Start with: catbus serve")
        sys.exit(1)


# ─── detect ───────────────────────────────────────────────────

def cmd_detect(args):
    import logging
    if not args.quiet:
        logging.basicConfig(
            level=logging.INFO,
            format="%(asctime)s [%(levelname)s] %(message)s",
            datefmt="%H:%M:%S",
        )

    from .detector import run_detect
    asyncio.run(run_detect(
        json_output=args.json,
        gateway_url=args.gateway,
    ))


# ─── call ─────────────────────────────────────────────────────

def cmd_call(args):
    port = args.port or 9800
    url = f"http://localhost:{port}/request"

    input_data = {}
    if args.input:
        try:
            input_data = json.loads(args.input)
        except json.JSONDecodeError:
            print("" + "\n" + f"❌ Invalid JSON input: {args.input}")
            sys.exit(1)

    payload = json.dumps({
        "capability": args.capability,
        "skill": args.capability,
        "input": input_data,
        "timeout": args.timeout,
    }).encode()

    try:
        req = urllib.request.Request(
            url, data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=args.timeout + 5) as resp:
            data = json.loads(resp.read())

        if data.get("status") == "ok":
            print(json.dumps(data.get("output", {}), indent=2, ensure_ascii=False))
        else:
            print("" + "\n" + f"❌ {data.get('error', 'Unknown error')}")
            sys.exit(1)

    except (urllib.error.URLError, ConnectionRefusedError):
        print("❌ CatBus Daemon is not running. Start with: catbus serve")
        sys.exit(1)


# ─── ask ──────────────────────────────────────────────────────

def cmd_ask(args):
    """Call a capability using natural language task description."""
    from .config import DEFAULT_PORT
    port = args.port or DEFAULT_PORT
    url = f"http://localhost:{port}/request"
    task = " ".join(args.task) if args.task else ""
    payload = json.dumps({
        "capability": args.selector,
        "skill": args.selector,
        "input": {"task": task, "prompt": task},
        "timeout": args.timeout,
    }).encode()
    try:
        req = urllib.request.Request(
            url, data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=args.timeout + 5) as resp:
            data = json.loads(resp.read())
    except (urllib.error.URLError, ConnectionRefusedError):
        print("[CatBus Error] daemon not running. Run: catbus serve --daemon", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"[CatBus Error] {data.get('error') or data.get('message') or str(data)}", file=sys.stderr)
        sys.exit(1)
    if data.get("status") == "ok":
        output = data.get("output", {})

        if isinstance(output, dict):
            result = output.get("summary") or output.get("output") or output.get("text") or str(output)
        else:
            result = str(output)
        print(result)

        # Display provider source info on stdout (after result), unless --quiet
        if not args.quiet:
            meta = (output if isinstance(output, dict) else {}).get("_catbus_meta") or data.get("_catbus_meta")
            if meta:
                node = meta.get("provider_node") or "unknown"
                model = meta.get("model_used") or "unknown"
                elo = meta.get("arena_elo") or "?"
                latency = meta.get("latency_ms") or "?"
                print(f"\n[CatBus] 由 {node} 响应 ({model}, ELO {elo}, {latency}ms)")
    else:
        print(f"[CatBus Error] {data.get('error') or data.get('message') or str(data)}", file=sys.stderr)
        sys.exit(1)


# ─── bind ─────────────────────────────────────────────────────

def cmd_bind(args):
    from .capability_db import extract_base_model, get_model_info, get_skill_info

    node_id = load_node_id()
    if not node_id:
        print("❌ Not initialized. Run 'catbus init' first.")
        sys.exit(1)

    config = load_config()
    capabilities = []

    # Auto-detect models
    if args.auto:
        print("🔍 Auto-detecting models...")
        from .detector import detect_models
        results = asyncio.run(detect_models())

        for r in results:
            if r.base_name.startswith("unknown-"):
                print("" + "\n" + f"  ⚠️  Could not identify model (tier: {r.cost_tier})")
                continue
            capabilities.append({
                "type": "model",
                "name": f"model/{r.base_name}",
                "meta": {
                    "raw_name": r.raw_name,
                    "provider": r.provider,
                    "cost_tier": r.cost_tier,
                    "strengths": r.strengths,
                    "arena_elo": r.arena_elo,
                    "detection_method": r.method,
                    "detection_confidence": r.confidence,
                },
            })
            icon = {"high": "🟢", "medium": "🟡", "low": "🔴"}.get(r.confidence, "⚪")
            print("" + "\n" + f"  {icon} model/{r.base_name} ({r.method}, {r.confidence})")

    # Manual --models
    if args.models:
        for raw_model in args.models.split(","):
            raw_model = raw_model.strip()
            if not raw_model:
                continue
            base = extract_base_model(raw_model)
            if base:
                if any(c["name"] == f"model/{base}" for c in capabilities):
                    continue
                info = get_model_info(base)
                capabilities.append({
                    "type": "model",
                    "name": f"model/{base}",
                    "meta": {
                        "raw_name": raw_model,
                        "provider": info.get("provider", "unknown"),
                        "cost_tier": info.get("cost_tier", "medium"),
                        "strengths": info.get("strengths", ["general"]),
                        "arena_elo": info.get("arena_elo", 0),
                    },
                })
                print("" + "\n" + f"  ✅ model/{base}")
            else:
                capabilities.append({
                    "type": "model",
                    "name": f"model/{raw_model}",
                    "meta": {"raw_name": raw_model, "provider": "unknown", "cost_tier": "medium"},
                })
                print("" + "\n" + f"  ⚠️  model/{raw_model} (unrecognized)")

    # Auto-scan skills
    if args.auto:
        print("\n🔍 Scanning OpenClaw skills...")
        from .scanner import scan_to_capabilities
        skill_caps = scan_to_capabilities()
        count = 0
        for cap in skill_caps:
            if cap.meta.get("shareable", True) and cap.name != "skill/agent":
                capabilities.append({"type": "skill", "name": cap.name, "meta": cap.meta})
                count += 1
        print("" + "\n" + f"  ✅ Found {count} shareable skill(s)")

    # Manual --skills
    if args.skills:
        for skill_name in args.skills.split(","):
            skill_name = skill_name.strip()
            if not skill_name:
                continue
            full_name = f"skill/{skill_name}"
            if any(c["name"] == full_name for c in capabilities):
                continue
            info = get_skill_info(skill_name)
            capabilities.append({
                "type": "skill",
                "name": full_name,
                "meta": {"category": info.get("category", "utility"), "cost_tier": info.get("cost_tier", "free")},
            })
            print("" + "\n" + f"  ✅ skill/{skill_name}")

    models = [c for c in capabilities if c["type"] == "model"]
    skills = [c for c in capabilities if c["type"] == "skill"]
    print("" + "\n" + f"\n📋 Total: {len(models)} model(s) + {len(skills)} skill(s)")

    if not capabilities:
        print("⚠️  Nothing to bind. Use --auto or --models/--skills.")
        return

    payload = json.dumps({
        "token": args.token,
        "node_id": node_id,
        "name": config.node_name or f"node-{node_id[:6]}",
        "capabilities": capabilities,
    }).encode()

    bind_url = "https://catbus.xyz/api/dashboard/agents/bind"
    print("" + "\n" + f"\n📡 Binding to {bind_url}...")

    try:
        req = urllib.request.Request(
            bind_url, data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
        if data.get("ok") or data.get("success"):
            print("" + "\n" + f"✅ Bound! {len(capabilities)} capabilities registered.")
        else:
            print("" + "\n" + f"❌ Bind failed: {data.get('error', 'Unknown')}")
            sys.exit(1)
    except urllib.error.HTTPError as e:
        print("" + "\n" + f"❌ HTTP {e.code}: {e.read().decode()[:200]}")
        sys.exit(1)
    except (urllib.error.URLError, ConnectionRefusedError) as e:
        print("" + "\n" + f"❌ Cannot reach {bind_url}: {e}")
        sys.exit(1)


# ─── bind-prompt ──────────────────────────────────────────────

def cmd_bind_prompt(args):
    from .detector import generate_bind_prompt
    print(generate_bind_prompt(args.token))


# ─── scan ─────────────────────────────────────────────────────

def cmd_scan(args):
    from .scanner import scan_to_capabilities
    entries = scan_to_capabilities()

    print("" + "\n" + f"\n🔧 Skills ({len(entries)}):")
    for e in entries:
        shareable = e.meta.get("shareable", True)
        marker = "✅" if shareable else "🔒"
        category = e.meta.get("category", "?")
        desc = e.meta.get("description", "")[:50]
        print("" + "\n" + f"  {marker} {e.name:35s} [{category}] {desc}")

    if args.add:
        _add_capabilities_to_config(entries)


def _add_capabilities_to_config(new_entries):
    import yaml
    config_file = CATBUS_HOME / "config.yaml"
    if not config_file.exists():
        print("❌ config.yaml not found. Run 'catbus init' first.")
        return

    with open(config_file) as f:
        raw = yaml.safe_load(f) or {}

    existing_caps = raw.get("capabilities", [])
    manual = [c for c in existing_caps if c.get("meta", {}).get("source", "") != "openclaw"]
    old_names = {c["name"] for c in existing_caps if c.get("meta", {}).get("source", "") == "openclaw"}

    new_caps = [{"type": e.type, "name": e.name, "handler": e.handler, "meta": e.meta} for e in new_entries]
    new_names = {c["name"] for c in new_caps}
    manual = [c for c in manual if c["name"] not in new_names]

    added = new_names - old_names
    removed = old_names - new_names

    raw["capabilities"] = manual + new_caps
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
        print("" + "\n" + f"  ✅ Added: {sorted(added)}")
    if removed:
        print("" + "\n" + f"  🗑️  Removed: {sorted(removed)}")
    print("" + "\n" + f"📝 config.yaml updated ({len(manual)} manual + {len(new_caps)} scanned)")


# ─── skills ───────────────────────────────────────────────────

def cmd_skills(args):
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
        print("" + "\n" + f"📡 Network Skills ({len(skills)} available):\n")
        for s in skills:
            providers = s.get("providers", 0)
            print("" + "\n" + f"  {s['name']:30s} ({providers} provider{'s' if providers != 1 else ''})")
            if s.get("description"):
                print("" + "\n" + f"    {s['description']}")
    except (urllib.error.URLError, ConnectionRefusedError):
        print("❌ CatBus Daemon is not running. Start with: catbus serve")
        sys.exit(1)


# ─── Parser ───────────────────────────────────────────────────

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="catbus",
        description="🚌 CatBus — The Uber for AI Agents",
    )
    sub = parser.add_subparsers(dest="command")

    sub.add_parser("init", help="Initialize + auto-detect models + scan skills")

    p_serve = sub.add_parser("serve", help="Start the CatBus daemon")
    p_serve.add_argument("--daemon", action="store_true")
    p_serve.add_argument("--stop", action="store_true", help="Stop the running daemon")

    p_status = sub.add_parser("status", help="Check daemon status")
    p_status.add_argument("--port", type=int, default=None)

    p_detect = sub.add_parser("detect", help="Detect locally installed models")
    p_detect.add_argument("--json", "-j", action="store_true")
    p_detect.add_argument("--gateway", "-g", default=None)
    p_detect.add_argument("--quiet", "-q", action="store_true")

    p_call = sub.add_parser("call", help="Call a remote capability")
    p_call.add_argument("capability")
    p_call.add_argument("--input", "-i", default="{}")
    p_call.add_argument("--timeout", "-t", type=int, default=30)
    p_call.add_argument("--port", type=int, default=None)

    p_ask = sub.add_parser("ask", help="Call a capability with natural language")
    p_ask.add_argument("selector", help="Virtual selector (e.g. model/best)")
    p_ask.add_argument("task", nargs="*", help="Task description")
    p_ask.add_argument("--timeout", "-t", type=int, default=120)
    p_ask.add_argument("--port", type=int, default=None)
    p_ask.add_argument("--quiet", "-q", action="store_true", help="Suppress source info on stderr")

    p_bind = sub.add_parser("bind", help="Bind to catbus.xyz")
    p_bind.add_argument("token")
    p_bind.add_argument("--auto", "-a", action="store_true")
    p_bind.add_argument("--models", "-m", default="")
    p_bind.add_argument("--skills", "-s", default="")

    p_bp = sub.add_parser("bind-prompt", help="Generate bind prompt for Agent")
    p_bp.add_argument("token")

    p_skills = sub.add_parser("skills", help="List network skills")
    p_skills.add_argument("--port", type=int, default=None)

    p_scan = sub.add_parser("scan", help="Scan local OpenClaw skills")
    p_scan.add_argument("--add", action="store_true")

    return parser


def run():
    parser = build_parser()
    args = parser.parse_args()

    commands = {
        "init": cmd_init,
        "serve": cmd_serve,
        "status": cmd_status,
        "detect": cmd_detect,
        "call": cmd_call,
        "ask": cmd_ask,
        "bind": cmd_bind,
        "bind-prompt": cmd_bind_prompt,
        "skills": cmd_skills,
        "scan": cmd_scan,
    }

    handler = commands.get(args.command)
    if handler:
        handler(args)
    else:
        parser.print_help()
