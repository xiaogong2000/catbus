#!/usr/bin/env python3
"""CatBus v5 CLI."""
import sys, json, os

# Add script directory to path so 'src' package works
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def main():
    args = sys.argv[1:]
    if not args:
        print("Usage: catbus <command> [args]")
        print("Commands: start, stop, status, cards, submit, tasks, result, async-status, state, drift, set, watch")
        return

    cmd = args[0]
    if cmd == "start":
        from src import daemon
        daemon.run()
    elif cmd == "status":
        _status()
    elif cmd == "cards":
        _cards(args[1:])
    elif cmd == "submit":
        _submit(args[1:])
    elif cmd == "tasks":
        _tasks(args[1:])
    elif cmd == "result":
        _result(args[1:])
    elif cmd == "state":
        _state(args[1:])
    elif cmd == "drift":
        _drift()
    elif cmd == "set":
        _set(args[1:])
    elif cmd == "watch":
        _watch(args[1:])
    elif cmd == "async-status":
        _async_status(args[1:])
    elif cmd == "providers":
        _providers()
    elif cmd == "probe":
        _probe_cmd()
    elif cmd == "push":
        _push(args[1:])
    elif cmd == "health":
        _health(args[1:])
    elif cmd == "stop":
        _stop()
    else:
        print(f"Unknown command: {cmd}")

def _status():
    from src import config, node
    cfg = config.load()
    s = node.get_session()
    card = None
    for r in s.get(f"catbus/cards/{cfg['name']}", timeout=3.0):
        try: card = json.loads(r.ok.payload.to_string())
        except: pass
    if card:
        print(f"Name:    {card['name']}")
        print(f"Type:    {card['node_type']}")
        print(f"Status:  {card['status']}")
        print(f"Load:    {card['load']:.1%}")
        print(f"Tasks:   {card['current_tasks']}/{card['max_concurrent']}")
        print(f"Queues:  {', '.join(card['queues'])}")
        print(f"Skills:  {', '.join(card['skills']) or '(none)'}")
    else:
        print(f"Node {cfg['name']} not found (daemon not running?)")
    node.close_session()

def _cards(args):
    import time
    from src import node
    s = node.get_session()
    time.sleep(2)
    cards = []
    for r in s.get("catbus/cards/*", timeout=3.0):
        try: cards.append(json.loads(r.ok.payload.to_string()))
        except: pass
    # Filters
    skill_filter = _flag(args, "--skill")
    queue_filter = _flag(args, "--queue")
    idle_only = "--idle" in args
    for c in cards:
        if skill_filter and skill_filter not in c.get("skills", []): continue
        if queue_filter and queue_filter not in c.get("queues", []): continue
        if idle_only and c.get("status") != "idle": continue
        st = "🟢" if c["status"] == "idle" else "🟡" if c["status"] == "busy" else "🔴"
        print(f"{st} {c['name']:20s} {c['node_type']:6s} load={c['load']:.0%} skills={','.join(c.get('skills',[]))}")
    if not cards:
        print("No agents online")
    node.close_session()

def _submit(args):
    if not args:
        print("Usage: catbus submit 'instruction' [--queue Q] [--priority N] [--fan-out N]")
        return
    from src import node, tasks
    queue = _flag(args, "--queue") or "general"
    priority = int(_flag(args, "--priority") or "5")
    fan_out = int(_flag(args, "--fan-out") or "1")
    target = _flag(args, "--target")
    broadcast = "--broadcast" in args
    shell_mode = "--shell" in args
    async_mode = "--async" in args
    # Instruction = first positional arg (not a flag or flag value)
    skip = set()
    for i, a in enumerate(args):
        if a.startswith("--"):
            skip.add(i)
            if a not in ("--broadcast", "--shell", "--async") and i + 1 < len(args):
                skip.add(i + 1)
    instruction = next((args[i] for i in range(len(args)) if i not in skip), None)
    if not instruction:
        print("Error: no instruction provided")
        return
    import time
    node.get_session()  # Force session creation
    time.sleep(1)  # Minimal wait for Zenoh peer discovery
    ctx = {"mode": "shell" if shell_mode else "async" if async_mode else "auto"}
    gid, tids = tasks.submit(queue, instruction, context=ctx, priority=priority, fan_out=fan_out, target=target, broadcast=broadcast)
    for tid in tids:
        suffix = " [async/长任务]" if async_mode else ""
        print(f"✅ Submitted {tid} → queue/{queue}{suffix}")
    node.close_session()

def _tasks(args):
    from src import node, tasks
    state = _flag(args, "--state")
    queue = _flag(args, "--queue") or "*"
    all_t = tasks.get_tasks(queue, state=state)
    for t in all_t:
        st = {"submitted":"⏳","claimed":"🔒","working":"⚙️","completed":"✅","failed":"❌","canceled":"🚫"}.get(t["state"],"?")
        print(f"{st} {t['id']} [{t['queue']}] p={t['priority']} {t['state']:10s} {t['instruction'][:60]}")
    if not all_t:
        print("No tasks")
    node.close_session()

def _result(args):
    if not args:
        print("Usage: catbus result <task_id> [json_result]")
        return
    import time
    from src import node, tasks
    tid = args[0]
    node.get_session()
    time.sleep(3)
    if len(args) > 1:
        data = json.loads(args[1])
        task = {"id": tid, "queue": "general"}
        tasks.write_result(task, data.get("summary",""), data.get("output",""))
        print(f"✅ Result written for {tid}")
    else:
        r = tasks.get_result(tid)
        if r:
            print(json.dumps(r, indent=2, ensure_ascii=False))
        else:
            print(f"No result for {tid}")
    node.close_session()

def _state(args):
    from src import node
    prefix = "catbus/state/"
    if args and args[0] in ("desired", "actual", "drift"):
        prefix += args[0] + "/"
    s = node.get_session()
    for r in s.get(f"{prefix}**", timeout=3.0):
        try:
            k = str(r.ok.key_expr).replace("catbus/state/", "")
            v = r.ok.payload.to_string()
            print(f"  {k} = {v}")
        except: pass
    node.close_session()

def _drift():
    from src import node
    s = node.get_session()
    found = False
    for r in s.get("catbus/state/drift/**", timeout=3.0):
        try:
            k = str(r.ok.key_expr).replace("catbus/state/drift/", "")
            d = json.loads(r.ok.payload.to_string())
            print(f"  🔀 {k}: desired={d['desired']} actual={d['actual']}")
            found = True
        except: pass
    if not found:
        print("No drift detected ✅")
    node.close_session()

def _set(args):
    if len(args) < 2:
        print("Usage: catbus set desired/<node>/<key> <value>")
        return
    from src import node
    path, value = args[0], args[1]
    node.get_session().put(f"catbus/state/{path}", value)
    print(f"✅ Set {path} = {value}")
    node.close_session()

def _watch(args):
    import time
    from src import node
    s = node.get_session()
    filt = _flag(args, "--filter") or "*"
    def on_event(sample):
        try:
            e = json.loads(sample.payload.to_string())
            print(f"[{e.get('ts','')}] {e.get('type','')} from={e.get('source','')} {json.dumps({k:v for k,v in e.items() if k not in ('type','source','ts')}, ensure_ascii=False)}")
        except:
            print(f">> {sample.key_expr}: {sample.payload.to_string()}")
    s.declare_subscriber(f"catbus/events/{filt}", on_event)
    print(f"Watching catbus/events/{filt} ... (Ctrl+C to quit)")
    try:
        while True: time.sleep(1)
    except KeyboardInterrupt:
        pass
    node.close_session()

def _async_status(args):
    """查询长任务（tmux/nohup）的执行状态。"""
    if not args:
        print("Usage: catbusin async-status <task_id>")
        return
    import subprocess
    task_id = args[0]
    status_file = f"/tmp/catbusin/{task_id}.status"
    log_file = f"/tmp/catbusin/{task_id}.log"
    tmux_session = f"catbus-{task_id}"

    if not __import__("os").path.exists(f"/tmp/catbusin"):
        print(f"No async tasks found (directory /tmp/catbusin missing)")
        return

    status = None
    if __import__("os").path.exists(status_file):
        status = open(status_file).read().strip()

    # 检查 tmux session 是否还在
    tmux_alive = subprocess.run(
        ["tmux", "has-session", "-t", tmux_session],
        capture_output=True
    ).returncode == 0

    if status == "done":
        print(f"✅ {task_id}: 完成")
    elif status == "failed":
        print(f"❌ {task_id}: 失败")
    elif tmux_alive:
        print(f"⏳ {task_id}: 运行中 (tmux: {tmux_session})")
        print(f"   实时查看: tmux attach -t {tmux_session}")
    else:
        print(f"❓ {task_id}: 状态未知（tmux session 不存在，也没有完成标记）")

    if __import__("os").path.exists(log_file):
        print(f"   日志: tail -f {log_file}")
        # 显示最后10行日志
        try:
            lines = open(log_file).readlines()
            if lines:
                print("   --- 最新输出 ---")
                for l in lines[-10:]:
                    print(f"   {l.rstrip()}")
        except:
            pass


def _providers():
    """Show all nodes' provider health status."""
    import time as _t
    from src import node
    node.get_session(); _t.sleep(5)
    s = node.get_session()
    for n in ['nefi', 'gouzi', 'huanhuan', 'xiaohei', 'mimi']:
        for r in s.get(f"catbus/providers/{n}", timeout=5.0):
            try:
                d = json.loads(r.ok.payload.to_string())
                provs = d.get("providers", {})
                status = " ".join(f"{'✅' if v['healthy'] else '❌'}{k}({v['latency_ms']}ms)" for k, v in provs.items())
                pri = d.get("primary", "?")[:35]
                print(f"{n}: primary={pri} | {status}")
            except: pass
    node.close_session()

def _probe_cmd():
    """Run one-shot probe on local providers, print results."""
    from src import watchdog, config
    cfg = config.load()
    oc = watchdog._load_openclaw(cfg)
    if not oc:
        print("Cannot load openclaw.json"); return
    for pname, pcfg in oc.get("models", {}).get("providers", {}).items():
        ok, ms, err = watchdog._probe(pname, pcfg)
        print(f"{'✅' if ok else '❌'} {pname}: {ms}ms {err or ''}")



def _push(args):
    """Push a file to target node via Zenoh."""
    if len(args) < 3 or "--target" not in args:
        print("Usage: catbus push <file> --target <name> [--dest <path>]")
        return
    filepath = args[0]
    target = _flag(args, "--target")
    dest = _flag(args, "--dest")
    if not target:
        print("Missing --target"); return
    from src import config, filetx, node
    import time as _t
    cfg = config.load()
    node.get_session(); _t.sleep(3)
    filetx.push_file(cfg, filepath, target, dest)
    node.close_session()

def _health(args):
    """Show all nodes gateway health status."""
    import time as _t
    from src import node
    node.get_session(); _t.sleep(5)
    s = node.get_session()
    robots = ["gouzi", "nefi", "huanhuan", "xiaohei", "mimi", "nn"]
    for n in robots:
        for r in s.get(f"catbus/health/{n}/gateway", timeout=5.0):
            try:
                d = json.loads(r.ok.payload.to_string())
                gw = "✅" if d.get("process") == "ok" else "❌"
                http = "✅" if d.get("http") == "ok" else "❌"
                ts = d.get("ts", "?")
                print(f"{n}: GW={gw} HTTP={http} ({ts})")
            except: pass
    node.close_session()

def _stop():
    import subprocess
    subprocess.run(["systemctl", "--user", "stop", "catbus"], check=False)
    subprocess.run(["sudo", "systemctl", "stop", "catbus"], check=False)
    print("Stop signal sent")

def _flag(args, name):
    for i, a in enumerate(args):
        if a == name and i + 1 < len(args):
            return args[i + 1]
    return None

if __name__ == "__main__":
    main()
