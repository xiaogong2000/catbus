#!/usr/bin/env python3
"""CatBus Skill: 发送消息"""
import json, os, socket, sys, time

SOCKET_PATH = "/tmp/catbus.sock"

def send(target, msg_type, payload, machine_name=None):
    if machine_name is None:
        config_path = os.environ.get("CATBUS_CONFIG", "/etc/catbus/config.json")
        with open(config_path) as f:
            machine_name = json.load(f)["machine_name"]

    msg_id = f"{machine_name}-{int(time.time()*1000)}-{os.urandom(2).hex()}"
    envelope = {
        "v": 2, "id": msg_id,
        "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "from": machine_name, "to": target, "type": msg_type,
        "payload": payload
    }

    if msg_type == "task":
        topic = f"catbus/task/{target}"
    elif msg_type == "result":
        topic = f"catbus/result/{target}/{machine_name}"
    elif msg_type == "alert":
        topic = f"catbus/alert/{machine_name}"
    else:
        topic = "catbus/broadcast"

    sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    sock.settimeout(10)
    sock.connect(SOCKET_PATH)
    sock.sendall(json.dumps({"action": "send", "topic": topic, "payload": envelope}).encode())
    response = json.loads(sock.recv(4096).decode())
    sock.close()

    print(json.dumps({"ok": response.get("ok", False), "msg_id": msg_id,
                       "error": response.get("error")}))
    return msg_id

if __name__ == "__main__":
    send(sys.argv[1], sys.argv[2], json.loads(sys.argv[3]))
