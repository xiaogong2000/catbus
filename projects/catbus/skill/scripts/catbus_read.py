#!/usr/bin/env python3
"""CatBus Skill: 读取结果"""
import json, socket, sys

SOCKET_PATH = "/tmp/catbus.sock"

def read(ref_id):
    sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    sock.settimeout(10)
    sock.connect(SOCKET_PATH)
    sock.sendall(json.dumps({"action": "read", "ref_id": ref_id}).encode())
    response = sock.recv(65536).decode()
    sock.close()
    print(response)

if __name__ == "__main__":
    read(sys.argv[1])
