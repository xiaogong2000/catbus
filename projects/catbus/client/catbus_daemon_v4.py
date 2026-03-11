#!/usr/bin/env python3
"""CatBus Daemon v4 — MQTT ↔ OpenClaw 桥接（P0+P1 升级）"""

import hashlib
import json
import os
import re
import signal
import socketserver
import subprocess
import sys
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
LOG_DIR      = config.get("log_dir", "/var/log/catbus")
MAX_WORKERS  = config.get("max_workers", 1)
OPENCLAW_BIN = config.get("openclaw_path", "openclaw")
MACHINE_SKILLS = config.get("machine_skills", [])
STATE_FILE   = os.path.join(LOG_DIR, "state.json")
JSONL_LOG    = os.path.join(LOG_DIR, "messages.jsonl")

# MQTT 连接参数（可配置）
MQTT_CFG = config.get("mqtt", {})
KEEPALIVE       = MQTT_CFG.get("keepalive", 60)
RECONNECT_MIN   = MQTT_CFG.get("reconnect_min", 1)
RECONNECT_MAX   = MQTT_CFG.get("reconnect_max", 30)
SESSION_EXPIRY  = MQTT_CFG.get("session_expiry", 3600)

# ── 身份自检（P0：失败则拒绝启动） ──
def self_check(force=False):
    """启动时验证身份配置。失败则 exit(1)，除非 --force"""
    skill_dir = config.get("skill_dir")
    if not skill_dir:
        return  # 没配 skill 目录，跳过
    skill_md = Path(skill_dir) / "SKILL.md"
    if not skill_md.exists():
        return

    # 从 SKILL.md 提取 Bot Token（格式：`你的 Telegram Bot Token: xxx`）
    skill_text = skill_md.read_text()
    skill_token = None
    for line in skill_text.splitlines():
        if "Bot Token" in line and ":" in line:
            parts = line.split(":", 1)
            if len(parts) == 2:
                candidate = parts[1].strip().strip("`")
                if len(candidate) > 20:
                    skill_token = candidate
                    break

    if not skill_token:
        return  # SKILL.md 里没找到 token，跳过

    # 从 openclaw 配置提取 token（尝试常见路径）
    oc_config_paths = [
        Path.home() / ".openclaw" / "config.json",
        Path("/root/.openclaw/config.json"),
    ]
    run_user = config.get("run_as_user")
    if run_user:
        try:
            import pwd
            pw = pwd.getpwnam(run_user)
            oc_config_paths.insert(0, Path(pw.pw_dir) / ".openclaw" / "config.json")
        except Exception:
            pass

    for oc_path in oc_config_paths:
        if oc_path.exists():
            try:
                oc_data = json.loads(oc_path.read_text())
                # 尝试从 telegram bot token 字段提取
                tg = oc_data.get("telegram", {})
                config_token = tg.get("botToken") or tg.get("bot_token")
                if config_token and config_token != skill_token:
                    s_hash = hashlib.sha256(skill_token.encode()).hexdigest()[:8]
                    c_hash = hashlib.sha256(config_token.encode()).hexdigest()[:8]
                    print(f"[catbus] ❌ SKILL.md token (hash:{s_hash}) != config token (hash:{c_hash})")
                    if not force:
                        print("[catbus] 身份不匹配，拒绝启动。使用 --force 跳过")
                        sys.exit(1)
                    print("[catbus] ⚠️ --force 模式，跳过身份检查")
                break
            except Exception:
                continue


# ── 队列与状态 ──
intake_queue = Queue()   # MQTT 线程 → 调度线程（极速，永不阻塞）
task_queue = Queue()     # 调度线程 → AI 执行线程

# 熔断器
fail_counter = {}
circuit_open = set()
CIRCUIT_THRESHOLD = 3
CIRCUIT_RESET_SEC = 3600
circuit_open_time = {}

# ACK 追踪器（P1）
pending_acks = {}        # {task_id: {"sent_at": monotonic, "wall_ts": time, "retries": 0, "payload": msg}}
# Fan-out 汇总器
fan_out = {}             # {group_id: {"tasks":[], "results":{}, "total":N, "deadline":mono, "wall_deadline":wall}}
# 心跳追踪
last_heartbeats = {}     # {machine: monotonic_ts}
recent_ack_delays = {}   # {machine: [delay_ms, ...]}  最近 5 条

_state_dirty = False
mqtt_client_ref = None
mqtt_connected = False


# ── 状态持久化（P1） ──
def _persist_state():
    try:
        state = {
            "pending_acks": {k: {**v, "sent_at": None} for k, v in pending_acks.items()},
            "fan_out": {k: {**v, "deadline": None} for k, v in fan_out.items()},
        }
        Path(STATE_FILE).write_text(json.dumps(state, ensure_ascii=False, indent=2))
    except Exception as e:
        print(f"[catbus] persist error: {e}")


def load_state():
    """启动时恢复未完成的任务状态"""
    if not os.path.exists(STATE_FILE):
        return
    try:
        state = json.loads(Path(STATE_FILE).read_text())
    except Exception:
        return
    now_mono = time.monotonic()
    now_wall = time.time()

    for task_id, info in state.get("pending_acks", {}).items():
        wall_ts = info.get("wall_ts", 0)
        age = now_wall - wall_ts
        if age > 630:
            print(f"[catbus] state recovery: {task_id} expired ({age:.0f}s), marking fail")
        else:
            info["sent_at"] = now_mono - age
            pending_acks[task_id] = info

    for gid, group in state.get("fan_out", {}).items():
        wall_deadline = group.get("wall_deadline", 0)
        if now_wall > wall_deadline:
            missing = [t for t in group["tasks"] if t not in group["results"]]
            for t in missing:
                group["results"][t] = {"status": "timeout"}
            print(f"[catbus] state recovery: fan_out {gid} expired, force aggregate")
        else:
            remaining = wall_deadline - now_wall
            group["deadline"] = now_mono + remaining
            fan_out[gid] = group


# ── 结构化日志（P1） ──
def log_structured(direction, data, latency_ms=None):
    """写一行 JSON 到 messages.jsonl"""
    entry = {
        "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "dir": direction,
        "from": data.get("from", ""),
        "to": data.get("to", ""),
        "type": data.get("type", ""),
        "id": data.get("id", ""),
        "ref_id": data.get("payload", {}).get("ref_id", ""),
    }
    if latency_ms is not None:
        entry["latency_ms"] = latency_ms
    try:
        with open(JSONL_LOG, "a") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    except Exception:
        pass


def gen_id(suffix=""):
    ts = int(time.time() * 1000)
    rand = os.urandom(2).hex()
    return f"{MACHINE_NAME}-{ts}-{suffix}-{rand}" if suffix else f"{MACHINE_NAME}-{ts}-{rand}"


def make_ack(task_data):
    """生成 System ACK 消息"""
    return {
        "v": 2, "id": gen_id("ack"),
        "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "from": MACHINE_NAME, "to": task_data.get("from", ""),
        "type": "ack",
        "payload": {
            "ref_id": task_data.get("id", ""),
            "status": "queued",
            "queue_depth": task_queue.qsize()
        }
    }


# ── MQTT 回调 ──
def on_connect(client, userdata, flags, rc, properties=None):
    global mqtt_connected
    if rc == 0:
        mqtt_connected = True
        print(f"[catbus] Connected as {MACHINE_NAME}")
        client.subscribe(f"catbus/task/{MACHINE_NAME}", qos=1)
        client.subscribe(f"catbus/result/{MACHINE_NAME}/#", qos=1)
        client.subscribe(f"catbus/ack/{MACHINE_NAME}", qos=1)
        client.subscribe("catbus/status/#", qos=0)
        client.subscribe("catbus/alert/#", qos=1)
        client.subscribe("catbus/broadcast/tasks", qos=1)
        publish_status(client)
    else:
        print(f"[catbus] Connect failed: rc={rc}")


def on_disconnect(client, userdata, rc, properties=None):
    global mqtt_connected
    mqtt_connected = False
    print(f"[catbus] Disconnected rc={rc}, will reconnect")


def on_message(client, userdata, msg):
    """极速：只做 JSON 解析 + 推入 intake_queue"""
    try:
        data = json.loads(msg.payload.decode())
    except json.JSONDecodeError:
        return
    if data.get("from") == MACHINE_NAME:
        return
    intake_queue.put((msg.topic, data))


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


# ── 调度线程（intake → hydration → ACK → task_queue） ──
def scheduler():
    global _state_dirty
    while True:
        topic, data = intake_queue.get()
        msg_type = data.get("type", "")
        log_structured("recv", data)

        # 更新心跳
        source = data.get("from", "")
        if source:
            last_heartbeats[source] = time.monotonic()

        if msg_type == "task":
            data = hydrate_context(data)
            # System ACK（Daemon 级，零 token）
            ack = make_ack(data)
            try:
                mqtt_client_ref.publish(
                    f"catbus/ack/{data['from']}", json.dumps(ack), qos=1)
                log_structured("send", ack)
            except Exception as e:
                print(f"[catbus] ACK send error: {e}")
            # 推入 AI 执行队列
            payload_str = json.dumps(data, ensure_ascii=False)
            cmd = [OPENCLAW_BIN, "agent", "--session-id", "catbus",
                   "--message", f"[CATBUS_TASK] {payload_str}"]
            task_queue.put((data, cmd))
            print(f"[catbus] Task {data['id']} from {source} → queued (depth: {task_queue.qsize()})")

        elif msg_type == "ack":
            ref_id = data.get("payload", {}).get("ref_id", "")
            if ref_id in pending_acks:
                sent_at = pending_acks[ref_id]["sent_at"]
                latency = int((time.monotonic() - sent_at) * 1000)
                pending_acks.pop(ref_id)
                _state_dirty = True
                # 追踪 ACK 延迟
                delays = recent_ack_delays.setdefault(source, [])
                delays.append(latency)
                if len(delays) > 5:
                    delays.pop(0)
                log_structured("recv", data, latency_ms=latency)
                print(f"[catbus] ACK for {ref_id} from {source} ({latency}ms)")

        elif msg_type == "result":
            handle_result(data)

        elif msg_type == "alert":
            handle_alert(data)

        elif msg_type == "broadcast":
            handle_broadcast(data)

        intake_queue.task_done()


# ── 消息处理 ──
def handle_result(data):
    global _state_dirty
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
            print(f"[catbus] ⚠️ Circuit OPEN for {source}")

    # 收到 result 也清除 pending_acks（兼容 v3 不发 ack）
    if ref_id and ref_id in pending_acks:
        pending_acks.pop(ref_id)
        _state_dirty = True

    # 存储结果
    result_dir = Path(LOG_DIR) / "results"
    result_dir.mkdir(parents=True, exist_ok=True)
    (result_dir / f"{ref_id}.json").write_text(
        json.dumps(data, ensure_ascii=False, indent=2))

    # Fan-out 汇总检查
    for gid, group in list(fan_out.items()):
        if ref_id in group["tasks"]:
            group["results"][ref_id] = data.get("payload", {})
            if len(group["results"]) == group["total"]:
                aggregate_and_notify(gid)
            _state_dirty = True
            break

    # 唤醒 AI 审查
    cmd = [OPENCLAW_BIN, "agent", "--session-id", "catbus",
           "--message", f"[CATBUS_RESULT] {json.dumps(data, ensure_ascii=False)}"]
    task_queue.put((data, cmd))
    print(f"[catbus] Result {ref_id} from {source} (status={status})")


def handle_alert(data):
    # 不处理自己发的 alert（防循环）
    if data.get("from") == MACHINE_NAME:
        return
    if MACHINE_NAME in ("gouzi", "nefi"):
        cmd = [OPENCLAW_BIN, "agent", "--session-id", "catbus",
               "--message", f"[CATBUS_ALERT] {json.dumps(data, ensure_ascii=False)}"]
        task_queue.put((data, cmd))


def handle_broadcast(data):
    """Daemon 级 Tag 过滤 + 自动 claim"""
    required = data.get("payload", {}).get("required_skills", [])
    if required:
        overlap = set(required) & set(MACHINE_SKILLS)
        if not overlap:
            return  # 技能不匹配，丢弃
        confidence = round(len(overlap) / len(required), 2)
    else:
        confidence = 0.5

    claim = {
        "v": 2, "id": gen_id("claim"),
        "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "from": MACHINE_NAME, "to": data.get("from", ""),
        "type": "claim",
        "payload": {
            "ref_id": data.get("id", ""),
            "confidence": confidence,
            "reason": f"skills match: {list(set(required) & set(MACHINE_SKILLS))}"
        }
    }
    try:
        mqtt_client_ref.publish(
            "catbus/broadcast/claims", json.dumps(claim), qos=1)
        log_structured("send", claim)
    except Exception as e:
        print(f"[catbus] claim send error: {e}")


def aggregate_and_notify(gid):
    group = fan_out.pop(gid, None)
    if not group:
        return
    print(f"[catbus] Fan-out {gid} complete: {len(group['results'])}/{group['total']}")


def send_fail_result(data, error_msg):
    sender = data.get("from", "")
    if not sender or sender == MACHINE_NAME:
        return
    fail_payload = {
        "v": 2, "id": gen_id("fail"),
        "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "from": MACHINE_NAME, "to": sender, "type": "result",
        "payload": {
            "ref_id": data.get("id", ""), "status": "fail",
            "summary": error_msg, "error": error_msg
        }
    }
    topic = f"catbus/result/{sender}/{MACHINE_NAME}"
    try:
        mqtt_client_ref.publish(topic, json.dumps(fail_payload), qos=1)
        log_structured("send", fail_payload)
    except Exception:
        pass


# ── Worker 线程 ──
def task_worker():
    while True:
        data, cmd = task_queue.get()
        try:
            run_env = os.environ.copy()
            run_user = config.get("run_as_user")
            if run_user:
                import pwd
                pw = pwd.getpwnam(run_user)
                run_env["HOME"] = pw.pw_dir
                run_env["USER"] = run_user
            proc = subprocess.Popen(
                cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                preexec_fn=os.setsid, env=run_env)
            try:
                proc.wait(timeout=600)
                rc = proc.returncode
                if rc != 0:
                    err = proc.stderr.read().decode()[:200] if proc.stderr else ""
                    print(f"[catbus] Worker exit={rc} err={err}")
                else:
                    print(f"[catbus] Worker exit=0")
            except subprocess.TimeoutExpired:
                os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
                send_fail_result(data, "Task timeout after 600s")
        except Exception as e:
            print(f"[catbus] Worker error: {e}")
            send_fail_result(data, str(e))
        finally:
            task_queue.task_done()


# ── 维护线程（合并所有周期性检查） ──
def maintenance_loop():
    global _state_dirty
    while True:
        time.sleep(10)
        try:
            _retry_check()
            _deadline_check()
            _health_check()
            if _state_dirty:
                _persist_state()
                _state_dirty = False
        except Exception as e:
            print(f"[catbus] maintenance error: {e}")


def _retry_check():
    """ACK 重试（60/150/330/630s，仅在 MQTT 连接健康时）"""
    global _state_dirty
    now = time.monotonic()
    for task_id, info in list(pending_acks.items()):
        elapsed = now - info["sent_at"]
        retries = info["retries"]
        if elapsed > 60 and retries == 0 and mqtt_connected:
            _resend(task_id, "")
            info["retries"] = 1
            _state_dirty = True
        elif elapsed > 150 and retries == 1 and mqtt_connected:
            _resend(task_id, "[RETRY] ")
            info["retries"] = 2
            _state_dirty = True
        elif elapsed > 330 and retries == 2 and mqtt_connected:
            _resend(task_id, "[URGENT] ")
            info["retries"] = 3
            _state_dirty = True
            _send_alert(f"🟡 Task {task_id} 第3次重试仍无 ACK")
        elif elapsed > 630 and retries >= 3:
            pending_acks.pop(task_id)
            _state_dirty = True
            _send_alert(f"🔴 Task {task_id} 超时 630s，标记失败")


def _resend(task_id, prefix):
    info = pending_acks.get(task_id)
    if not info:
        return
    payload = info["payload"]
    if prefix:
        p = payload.get("payload", {})
        desc = p.get("description", "")
        p["description"] = prefix + desc
    target = payload.get("to", "")
    try:
        mqtt_client_ref.publish(
            f"catbus/task/{target}", json.dumps(payload), qos=1)
        log_structured("send", payload)
        print(f"[catbus] Resend {task_id} to {target} ({prefix or 'first'})")
    except Exception as e:
        print(f"[catbus] Resend error: {e}")


def _deadline_check():
    """Fan-out 超时强制汇总"""
    global _state_dirty
    now = time.monotonic()
    for gid, group in list(fan_out.items()):
        if now > group.get("deadline", float("inf")) and len(group["results"]) < group["total"]:
            missing = [t for t in group["tasks"] if t not in group["results"]]
            for t in missing:
                group["results"][t] = {"status": "timeout"}
            aggregate_and_notify(gid)
            _state_dirty = True
            _send_alert(f"🟡 Fan-out {gid} 超时，{len(missing)} 个 Worker 未回")


def _health_check():
    """心跳超时 + ACK 延迟告警（启动 360s 内不检查心跳，兼容 v3 的 300s 间隔）"""
    now = time.monotonic()
    if now - _startup_time < 360:
        return  # 宽限期（v3 heartbeat 300s + 余量）
    for machine, last_ts in list(last_heartbeats.items()):
        if now - last_ts > 360:  # v3 heartbeat 300s + 60s 余量
            _send_alert(f"🔴 {machine} 心跳超时 {int(now - last_ts)}s")
    for machine, delays in recent_ack_delays.items():
        if len(delays) >= 3 and all(d > 10000 for d in delays[-3:]):
            _send_alert(f"🟡 {machine} ACK 延迟连续异常: {delays[-3:]}ms")


_last_alerts = {}  # 去重：同一告警 5 分钟内不重复发
_startup_time = time.monotonic()  # 启动宽限期：60s 内不发心跳告警

def _send_alert(msg):
    now = time.monotonic()
    # 去重 key 用 emoji+机器名（不含变化的秒数/ms）
    key = re.sub(r'\d+', '#', msg[:40])
    if key in _last_alerts and now - _last_alerts[key] < 300:
        return
    _last_alerts[key] = now
    alert = {
        "v": 2, "id": gen_id("alert"),
        "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "from": MACHINE_NAME, "to": "nefi", "type": "alert",
        "priority": 0, "payload": {"message": msg}
    }
    try:
        # 告警发给 Manager，但不能发给自己（防自发自收循环）
        if MACHINE_NAME == "nefi":
            pass  # Manager 自己的告警只打日志，不走 MQTT
        else:
            mqtt_client_ref.publish("catbus/alert/nefi", json.dumps(alert), qos=1)
        log_structured("send", alert)
    except Exception:
        pass
    print(f"[catbus] ALERT: {msg}")


# ── 状态发布 ──
def publish_status(client):
    import shutil
    status = {
        "v": 2, "id": f"status-{MACHINE_NAME}",
        "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "from": MACHINE_NAME, "to": "*", "type": "status",
        "payload": {
            "online": True, "protocol_version": 2,
            "machine_skills": MACHINE_SKILLS,
            "disk_pct": round(shutil.disk_usage("/").used / shutil.disk_usage("/").total * 100),
            "queue_depth": task_queue.qsize(),
            "circuit_open": list(circuit_open),
        }
    }
    client.publish(f"catbus/status/{MACHINE_NAME}", json.dumps(status), qos=0, retain=True)


def make_will():
    return json.dumps({
        "v": 2, "id": f"will-{MACHINE_NAME}",
        "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "from": MACHINE_NAME, "to": "*", "type": "status",
        "payload": {"online": False, "protocol_version": 2}
    })


def heartbeat_loop(client):
    while True:
        time.sleep(300)
        publish_status(client)


# ── Unix Socket 服务 ──
class CatBusHandler(socketserver.StreamRequestHandler):
    def handle(self):
        try:
            raw = self.request.recv(65536).decode()
            request = json.loads(raw)
            action = request.get("action")

            if action == "send":
                self._handle_send(request)
            elif action == "read":
                self._handle_read(request)
            elif action == "status":
                self._handle_status(request)
            elif action == "diag":
                self._handle_diag(request)
            else:
                self.request.sendall(b'{"ok":false,"error":"unknown action"}')
        except Exception as e:
            self.request.sendall(json.dumps({"ok": False, "error": str(e)}).encode())

    def _handle_send(self, request):
        global _state_dirty
        topic = request["topic"]
        payload = request["payload"]
        qos = request.get("qos", 1)
        msg_type = payload.get("type", "")
        target = payload.get("to", "")

        # 熔断器拦截
        if msg_type == "task" and target in circuit_open:
            if time.time() - circuit_open_time.get(target, 0) > CIRCUIT_RESET_SEC:
                circuit_open.discard(target)
                fail_counter[target] = 0
            else:
                self.request.sendall(json.dumps({
                    "ok": False, "error": f"Circuit open: {target}"
                }).encode())
                return

        self.server.mqtt_client.publish(topic, json.dumps(payload), qos=qos)
        log_structured("send", payload)

        # 如果是 task，加入 ACK 追踪
        if msg_type == "task":
            task_id = payload.get("id", "")
            if task_id:
                pending_acks[task_id] = {
                    "sent_at": time.monotonic(),
                    "wall_ts": time.time(),
                    "retries": 0,
                    "payload": payload
                }
                _state_dirty = True

        self.request.sendall(b'{"ok":true}')

    def _handle_read(self, request):
        ref_id = request.get("ref_id")
        result_file = Path(LOG_DIR) / "results" / f"{ref_id}.json"
        if result_file.exists():
            self.request.sendall(result_file.read_bytes())
        else:
            self.request.sendall(b'{"ok":false,"error":"not found"}')

    def _handle_status(self, request):
        status_dir = Path(LOG_DIR) / "status"
        statuses = {}
        if status_dir.exists():
            for f in status_dir.glob("*.json"):
                statuses[f.stem] = json.loads(f.read_text())
        self.request.sendall(json.dumps(statuses).encode())

    def _handle_diag(self, request):
        cmd = request.get("cmd", "")
        if cmd == "pending":
            result = {}
            now = time.monotonic()
            for tid, info in pending_acks.items():
                result[tid] = {
                    "to": info["payload"].get("to", ""),
                    "retries": info["retries"],
                    "waiting_sec": round(now - info["sent_at"])
                }
            self.request.sendall(json.dumps(result).encode())

        elif cmd == "health":
            now = time.monotonic()
            result = {}
            for m, ts in last_heartbeats.items():
                result[m] = {
                    "last_seen_sec_ago": round(now - ts),
                    "circuit_open": m in circuit_open,
                    "recent_ack_ms": recent_ack_delays.get(m, [])
                }
            self.request.sendall(json.dumps(result).encode())

        elif cmd == "last":
            n = request.get("n", 20)
            lines = []
            try:
                with open(JSONL_LOG) as f:
                    for line in f:
                        lines.append(line.strip())
                lines = lines[-n:]
            except FileNotFoundError:
                pass
            self.request.sendall(json.dumps(lines).encode())

        else:
            self.request.sendall(b'{"ok":false,"error":"unknown diag cmd"}')


def start_socket_server(mqtt_client):
    if os.path.exists(SOCKET_PATH):
        os.remove(SOCKET_PATH)
    server = socketserver.ThreadingUnixStreamServer(SOCKET_PATH, CatBusHandler)
    server.mqtt_client = mqtt_client
    os.chmod(SOCKET_PATH, 0o666)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    print(f"[catbus] Socket listening on {SOCKET_PATH}")


# ── 状态缓存 ──
def cache_status(client, userdata, msg):
    try:
        data = json.loads(msg.payload.decode())
        source = data.get("from", "unknown")
        if source != MACHINE_NAME:
            last_heartbeats[source] = time.monotonic()
        status_dir = Path(LOG_DIR) / "status"
        status_dir.mkdir(parents=True, exist_ok=True)
        (status_dir / f"{source}.json").write_text(
            json.dumps(data, ensure_ascii=False, indent=2))
    except Exception:
        pass


# ── 主入口 ──
def main():
    global mqtt_client_ref
    force = "--force" in sys.argv
    Path(LOG_DIR).mkdir(parents=True, exist_ok=True)

    # P0: 身份自检
    self_check(force=force)

    # P1: 恢复状态
    load_state()

    # MQTT 客户端
    try:
        from paho.mqtt.enums import CallbackAPIVersion
        client = mqtt.Client(
            client_id=f"catbus-{MACHINE_NAME}", protocol=mqtt.MQTTv5,
            callback_api_version=CallbackAPIVersion.VERSION1)
    except ImportError:
        client = mqtt.Client(
            client_id=f"catbus-{MACHINE_NAME}", protocol=mqtt.MQTTv5)

    client.username_pw_set(BROKER_USER, BROKER_PASS)
    client.tls_set(ca_certs=CA_CERT)
    client.reconnect_delay_set(RECONNECT_MIN, RECONNECT_MAX)

    from paho.mqtt.properties import Properties
    from paho.mqtt.packettypes import PacketTypes
    connect_props = Properties(PacketTypes.CONNECT)
    connect_props.SessionExpiryInterval = SESSION_EXPIRY

    client.will_set(f"catbus/status/{MACHINE_NAME}", make_will(), qos=1, retain=True)
    client.on_connect = on_connect
    client.on_disconnect = on_disconnect
    client.on_message = on_message
    client.message_callback_add("catbus/status/#", cache_status)

    client.connect(BROKER_HOST, BROKER_PORT, keepalive=KEEPALIVE,
                   properties=connect_props)
    mqtt_client_ref = client

    # 启动线程
    threading.Thread(target=scheduler, daemon=True, name="scheduler").start()
    for i in range(MAX_WORKERS):
        threading.Thread(target=task_worker, daemon=True, name=f"worker-{i}").start()
    threading.Thread(target=maintenance_loop, daemon=True, name="maintenance").start()
    threading.Thread(target=heartbeat_loop, args=(client,), daemon=True, name="heartbeat").start()
    start_socket_server(client)

    print(f"[catbus] Daemon v4 started: {MACHINE_NAME} ({MAX_WORKERS} workers)")

    def handle_signal(sig, frame):
        print("[catbus] Shutting down...")
        publish_status(client)  # 最后一次状态
        if _state_dirty:
            _persist_state()
        client.disconnect()

    signal.signal(signal.SIGTERM, handle_signal)
    signal.signal(signal.SIGINT, handle_signal)
    client.loop_forever()


if __name__ == "__main__":
    main()
