#!/usr/bin/env python3
"""CatBus Skill: 查看在线状态 + 诊断命令"""
import json, socket, sys

SOCKET_PATH = "/tmp/catbus.sock"

def _send(request):
    sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    sock.settimeout(10)
    sock.connect(SOCKET_PATH)
    sock.sendall(json.dumps(request).encode())
    response = sock.recv(65536).decode()
    sock.close()
    return json.loads(response)

def cmd_status():
    statuses = _send({"action": "status"})
    for name, info in statuses.items():
        p = info.get("payload", {})
        online = p.get("online", False)
        q = p.get("queue_depth", 0)
        cb = p.get("circuit_open", [])
        pv = p.get("protocol_version", "?")
        icon = "🟢" if online else "🔴"
        extra = f" v{pv}"
        if q: extra += f" queue={q}"
        if cb: extra += f" ⚠️circuit={cb}"
        print(f"{icon} {name}: {'online' if online else 'offline'}{extra}")

def cmd_pending():
    result = _send({"action": "diag", "cmd": "pending"})
    if not result:
        print("No pending tasks")
        return
    for tid, info in result.items():
        print(f"⏳ {tid} → {info['to']} (retries={info['retries']}, waiting={info['waiting_sec']}s)")

def cmd_health():
    result = _send({"action": "diag", "cmd": "health"})
    if not result:
        print("No heartbeat data")
        return
    for m, info in result.items():
        icon = "🔴" if info.get("circuit_open") else "🟢"
        ack = info.get("recent_ack_ms", [])
        ack_str = f" ack_ms={ack}" if ack else ""
        print(f"{icon} {m}: last_seen={info['last_seen_sec_ago']}s ago{ack_str}")

def cmd_last(n=20):
    lines = _send({"action": "diag", "cmd": "last", "n": n})
    for line in lines:
        if isinstance(line, str):
            try:
                entry = json.loads(line)
                d = "→" if entry.get("dir") == "send" else "←"
                lat = f" ({entry['latency_ms']}ms)" if entry.get("latency_ms") else ""
                print(f"{entry.get('ts','')} {d} {entry.get('from','')}→{entry.get('to','')} [{entry.get('type','')}]{lat}")
            except Exception:
                print(line)

if __name__ == "__main__":
    args = sys.argv[1:]
    if not args:
        cmd_status()
    elif args[0] == "--pending":
        cmd_pending()
    elif args[0] == "--health":
        cmd_health()
    elif args[0] == "--last":
        n = int(args[1]) if len(args) > 1 else 20
        cmd_last(n)
    else:
        print(f"Usage: {sys.argv[0]} [--pending|--health|--last N]")
