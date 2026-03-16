#!/usr/bin/env python3
"""CatBus Daemon v3 — MQTT ↔ OpenClaw 桥接"""

import json
import os
import signal
import socketserver
import subprocess
import threading
import time
from pathlib import Path
from queue import Queue

import paho.mqtt.client as mqtt

# ── 配置 ──
CONFIG_PATH = os.environ.get("CATBUS_CONFIG", "/etc/catbus/config.json")

def load_config():
    with open(CONFIG_PATH) as f:
        return json.load(f)

config = load_config()
MACHINE_NAME = config["machine_name"]
BROKER_HOST  = config["broker_host"]
BROKER_PORT  = config["broker_port"]
BROKER_USER  = config["broker_user"]
BROKER_PASS  = config["broker_pass"]
CA_CERT      = config.get("ca_cert", "/etc/catbus/ca.crt")
SOCKET_PATH  = config.get("socket_path", "/tmp/catbus.sock")
DELIVER_TG   = config.get("deliver_telegram", False)
LOG_DIR      = config.get("log_dir", "/var/log/catbus")
MAX_WORKERS  = config.get("max_workers", 1)
OPENCLAW_BIN = config.get("openclaw_path", "openclaw")

# ── 任务队列 ──
task_queue = Queue()

# ── 熔断器（Daemon 层面维护） ──
fail_counter = {}
circuit_open = set()
CIRCUIT_THRESHOLD = 3
CIRCUIT_RESET_SEC = 3600
circuit_open_time = {}

# ── 全局 MQTT 客户端引用 ──
mqtt_client_ref = None


# ── MQTT 回调 ──
def on_connect(client, userdata, flags, rc, properties=None):
    if rc == 0:
        print(f"[catbus] Connected as {MACHINE_NAME}")
        client.subscribe(f"catbus/task/{MACHINE_NAME}", qos=1)
        client.subscribe(f"catbus/result/{MACHINE_NAME}/#", qos=1)
        client.subscribe("catbus/status/#", qos=0)
        client.subscribe("catbus/alert/#", qos=1)
        client.subscribe("catbus/broadcast", qos=0)
        publish_status(client)
    else:
        print(f"[catbus] Connect failed: rc={rc}")


def on_message(client, userdata, msg):
    try:
        data = json.loads(msg.payload.decode())
    except json.JSONDecodeError:
        print(f"[catbus] Bad JSON on {msg.topic}")
        return

    msg_from = data.get("from", "unknown")
    if msg_from == MACHINE_NAME:
        return

    log_message(data, direction="recv")

    msg_type = data.get("type", "")
    if msg_type == "task":
        handle_task(data)
    elif msg_type == "result":
        handle_result(data)
    elif msg_type == "alert":
        handle_alert(data)


# ── Context Hydration ──
def hydrate_context(data):
    refs = data.get("payload", {}).get("context_refs", [])
    if not refs:
        return data
    hydrated = []
    result_dir = Path(LOG_DIR) / "results"
    for ref_id in refs:
        ref_file = result_dir / f"{ref_id}.json"
        if ref_file.exists():
            try:
                ref_data = json.loads(ref_file.read_text())
                summary = json.dumps(ref_data.get("payload", {}), ensure_ascii=False)[:2048]
                hydrated.append({"ref_id": ref_id, "summary": summary})
            except Exception:
                hydrated.append({"ref_id": ref_id, "summary": "(read error)"})
        else:
            hydrated.append({"ref_id": ref_id, "summary": "(not found locally)"})
    data["payload"]["_hydrated_context"] = hydrated
    return data


def handle_task(data):
    data = hydrate_context(data)
    payload_str = json.dumps(data, ensure_ascii=False)
    cmd = [OPENCLAW_BIN, "agent", "--session-id", "catbus", "--message", f"[CATBUS_TASK] {payload_str}"]
    task_queue.put((data, cmd))
    print(f"[catbus] Task {data['id']} from {data['from']} → queued (depth: {task_queue.qsize()})")


def handle_result(data):
    ref_id = data.get("payload", {}).get("ref_id", "")
    status = data.get("payload", {}).get("status", "")
    source = data.get("from", "")

    # 熔断器计数
    if status == "done":
        fail_counter[source] = 0
        circuit_open.discard(source)
    elif status == "fail":
        fail_counter[source] = fail_counter.get(source, 0) + 1
        if fail_counter[source] >= CIRCUIT_THRESHOLD:
            circuit_open.add(source)
            circuit_open_time[source] = time.time()
            print(f"[catbus] ⚠️ Circuit OPEN for {source} (fails: {fail_counter[source]})")

    # 存储结果
    result_dir = Path(LOG_DIR) / "results"
    result_dir.mkdir(parents=True, exist_ok=True)
    (result_dir / f"{ref_id}.json").write_text(json.dumps(data, ensure_ascii=False, indent=2))

    # 唤醒 AI 审查
    cmd = [OPENCLAW_BIN, "agent", "--session-id", "catbus", "--message", f"[CATBUS_RESULT] {json.dumps(data, ensure_ascii=False)}"]
    task_queue.put((data, cmd))
    print(f"[catbus] Result {ref_id} from {source} (status={status}) → queued")


def handle_alert(data):
    if MACHINE_NAME in ("gouzi", "nefi"):
        cmd = [OPENCLAW_BIN, "agent", "--session-id", "catbus", "--message", f"[CATBUS_ALERT] {json.dumps(data, ensure_ascii=False)}"]
        task_queue.put((data, cmd))


# ── 超时失败回传 ──
def send_fail_result(data, error_msg):
    sender = data.get("from", "")
    if not sender or sender == MACHINE_NAME:
        return
    fail_payload = {
        "v": 1,
        "id": f"{MACHINE_NAME}-{int(time.time()*1000)}-fail",
        "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "from": MACHINE_NAME, "to": sender, "type": "result",
        "payload": {
            "ref_id": data.get("id", ""), "status": "fail",
            "results": [], "error": error_msg,
            "token_used": {"input": 0, "output": 0, "model": "daemon", "est_cost_usd": 0}
        }
    }
    topic = f"catbus/result/{sender}/{MACHINE_NAME}"
    try:
        mqtt_client_ref.publish(topic, json.dumps(fail_payload, ensure_ascii=False), qos=1)
        print(f"[catbus] Sent fail result to {sender}: {error_msg}")
    except Exception as e:
        print(f"[catbus] Failed to send fail result: {e}")


# ── Worker 线程 ──
def task_worker():
    while True:
        data, cmd = task_queue.get()
        try:
            print(f"[catbus] Worker executing: {cmd[3][:80]}...")
            run_env = os.environ.copy()
            run_user = config.get("run_as_user")
            if run_user:
                import pwd
                pw = pwd.getpwnam(run_user)
                run_env["HOME"] = pw.pw_dir
                run_env["USER"] = run_user
            proc = subprocess.Popen(
                cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                preexec_fn=os.setsid, env=run_env
            )
            try:
                proc.wait(timeout=600)
                if proc.returncode != 0:
                    err = proc.stderr.read().decode()[:200] if proc.stderr else ""
                    print(f"[catbus] Worker done, exit={proc.returncode} err={err}")
                else:
                    print(f"[catbus] Worker done, exit=0")
            except subprocess.TimeoutExpired:
                print(f"[catbus] Worker timeout, killing process group...")
                os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
                send_fail_result(data, "Task timeout after 600s")
        except Exception as e:
            print(f"[catbus] Worker error: {e}")
            send_fail_result(data, str(e))
        finally:
            task_queue.task_done()


# ── 状态发布 ──
def publish_status(client):
    import shutil
    status = {
        "v": 1, "id": f"status-{MACHINE_NAME}",
        "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "from": MACHINE_NAME, "to": "*", "type": "status",
        "payload": {
            "online": True,
            "disk_pct": round(shutil.disk_usage("/").used / shutil.disk_usage("/").total * 100),
            "queue_depth": task_queue.qsize(),
            "circuit_open": list(circuit_open),
        }
    }
    client.publish(f"catbus/status/{MACHINE_NAME}", json.dumps(status), qos=0, retain=True)


def publish_status_offline(client):
    offline = json.loads(make_will())
    client.publish(f"catbus/status/{MACHINE_NAME}", json.dumps(offline), qos=1, retain=True)


def make_will():
    return json.dumps({
        "v": 1, "id": f"will-{MACHINE_NAME}",
        "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "from": MACHINE_NAME, "to": "*", "type": "status",
        "payload": {"online": False}
    })


def heartbeat_loop(client):
    while True:
        time.sleep(300)
        publish_status(client)


# ── 状态缓存 ──
def cache_status(client, userdata, msg):
    try:
        data = json.loads(msg.payload.decode())
        source = data.get("from", "unknown")
        status_dir = Path(LOG_DIR) / "status"
        status_dir.mkdir(parents=True, exist_ok=True)
        (status_dir / f"{source}.json").write_text(json.dumps(data, ensure_ascii=False, indent=2))
    except Exception:
        pass


# ── 日志 ──
def log_message(data, direction="recv"):
    log_dir = Path(LOG_DIR) / "messages"
    log_dir.mkdir(parents=True, exist_ok=True)
    log_file = log_dir / f"{time.strftime('%Y%m%d')}.jsonl"
    with open(log_file, "a") as f:
        f.write(json.dumps({"direction": direction, "data": data}, ensure_ascii=False) + "\n")


# ── Unix Socket 服务 ──
class CatBusHandler(socketserver.StreamRequestHandler):
    def handle(self):
        try:
            raw = self.request.recv(65536).decode()
            request = json.loads(raw)
            action = request.get("action")

            if action == "send":
                topic = request["topic"]
                payload = request["payload"]
                qos = request.get("qos", 1)
                # 熔断器：只拦截 task
                msg_type = payload.get("type", "")
                target = payload.get("to", "")
                if msg_type == "task" and target in circuit_open:
                    if time.time() - circuit_open_time.get(target, 0) > CIRCUIT_RESET_SEC:
                        circuit_open.discard(target)
                        fail_counter[target] = 0
                    else:
                        self.request.sendall(json.dumps({
                            "ok": False,
                            "error": f"Circuit open: {target} has {fail_counter.get(target,0)} consecutive fails"
                        }).encode())
                        return
                self.server.mqtt_client.publish(topic, json.dumps(payload), qos=qos)
                self.request.sendall(b'{"ok": true}')

            elif action == "read":
                ref_id = request.get("ref_id")
                result_file = Path(LOG_DIR) / "results" / f"{ref_id}.json"
                if result_file.exists():
                    self.request.sendall(result_file.read_bytes())
                else:
                    self.request.sendall(b'{"ok": false, "error": "not found"}')

            elif action == "status":
                status_dir = Path(LOG_DIR) / "status"
                statuses = {}
                if status_dir.exists():
                    for f in status_dir.glob("*.json"):
                        statuses[f.stem] = json.loads(f.read_text())
                self.request.sendall(json.dumps(statuses).encode())

        except Exception as e:
            self.request.sendall(json.dumps({"ok": False, "error": str(e)}).encode())


def start_socket_server(mqtt_client):
    if os.path.exists(SOCKET_PATH):
        os.remove(SOCKET_PATH)
    server = socketserver.ThreadingUnixStreamServer(SOCKET_PATH, CatBusHandler)
    server.mqtt_client = mqtt_client
    os.chmod(SOCKET_PATH, 0o666)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    print(f"[catbus] Socket listening on {SOCKET_PATH}")


# ── 主入口 ──
def main():
    global mqtt_client_ref
    Path(LOG_DIR).mkdir(parents=True, exist_ok=True)

    # 兼容 paho-mqtt v1 和 v2
    try:
        from paho.mqtt.enums import CallbackAPIVersion
        client = mqtt.Client(client_id=f"catbus-{MACHINE_NAME}", protocol=mqtt.MQTTv5,
                             callback_api_version=CallbackAPIVersion.VERSION1)
    except ImportError:
        client = mqtt.Client(client_id=f"catbus-{MACHINE_NAME}", protocol=mqtt.MQTTv5)
    client.username_pw_set(BROKER_USER, BROKER_PASS)
    client.tls_set(ca_certs=CA_CERT)

    from paho.mqtt.properties import Properties
    from paho.mqtt.packettypes import PacketTypes
    connect_props = Properties(PacketTypes.CONNECT)
    connect_props.SessionExpiryInterval = 3600

    client.will_set(f"catbus/status/{MACHINE_NAME}", make_will(), qos=1, retain=True)
    client.on_connect = on_connect
    client.on_message = on_message
    client.message_callback_add("catbus/status/#", cache_status)

    client.connect(BROKER_HOST, BROKER_PORT, properties=connect_props)
    mqtt_client_ref = client

    for i in range(MAX_WORKERS):
        threading.Thread(target=task_worker, daemon=True, name=f"worker-{i}").start()
    print(f"[catbus] {MAX_WORKERS} worker(s) started")

    start_socket_server(client)
    threading.Thread(target=heartbeat_loop, args=(client,), daemon=True).start()

    def handle_signal(sig, frame):
        print("[catbus] Shutting down gracefully...")
        publish_status_offline(client)
        client.disconnect()

    signal.signal(signal.SIGTERM, handle_signal)
    signal.signal(signal.SIGINT, handle_signal)

    client.loop_forever()


if __name__ == "__main__":
    main()
