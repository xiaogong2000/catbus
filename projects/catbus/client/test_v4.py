#!/usr/bin/env python3
"""CatBus Daemon v4 — 本地单元测试（不连 MQTT）"""

import json
import os
import sys
import time
import threading

# 用临时配置，避免读 /etc/catbus/config.json
os.environ["CATBUS_CONFIG"] = "/tmp/catbus_test_config.json"
test_config = {
    "machine_name": "nefi",
    "broker_host": "127.0.0.1",
    "broker_port": 8883,
    "broker_user": "test",
    "broker_pass": "test",
    "ca_cert": "/dev/null",
    "socket_path": "/tmp/catbus_test.sock",
    "log_dir": "/tmp/catbus_test_logs",
    "max_workers": 1,
    "openclaw_path": "echo",  # mock: 用 echo 代替 openclaw
    "machine_skills": ["management", "orchestration", "review", "seo"]
}
os.makedirs("/tmp/catbus_test_logs", exist_ok=True)
with open("/tmp/catbus_test_config.json", "w") as f:
    json.dump(test_config, f)

# 现在 import daemon（会读配置）
import catbus_daemon_v4 as d

passed = 0
failed = 0

def test(name, condition, detail=""):
    global passed, failed
    if condition:
        print(f"  ✅ {name}")
        passed += 1
    else:
        print(f"  ❌ {name} — {detail}")
        failed += 1


# ═══════════════════════════════════════
print("\n🧪 Test 1: gen_id")
id1 = d.gen_id("test")
id2 = d.gen_id("test")
test("ID 格式正确", id1.startswith("nefi-") and "-test-" in id1)
test("ID 唯一", id1 != id2)

# ═══════════════════════════════════════
print("\n🧪 Test 2: make_ack")
task = {"id": "task-123", "from": "gouzi", "type": "task", "payload": {}}
ack = d.make_ack(task)
test("ACK type", ack["type"] == "ack")
test("ACK ref_id", ack["payload"]["ref_id"] == "task-123")
test("ACK from", ack["from"] == "nefi")
test("ACK to", ack["to"] == "gouzi")
test("ACK v2", ack["v"] == 2)
test("ACK has queue_depth", "queue_depth" in ack["payload"])

# ═══════════════════════════════════════
print("\n🧪 Test 3: ACK 追踪器")
d.pending_acks.clear()
d._state_dirty = False

# 模拟发送 task
d.pending_acks["task-001"] = {
    "sent_at": time.monotonic(),
    "wall_ts": time.time(),
    "retries": 0,
    "payload": {"id": "task-001", "to": "gouzi", "type": "task", "payload": {"description": "test"}}
}
test("pending 注册", "task-001" in d.pending_acks)

# 模拟收到 result → 清除 pending
d.handle_result({
    "from": "gouzi", "to": "nefi", "type": "result",
    "id": "gouzi-001", "payload": {"ref_id": "task-001", "status": "done", "summary": "ok"}
})
test("收到 result 后 pending 被清除", "task-001" not in d.pending_acks)
test("state_dirty 被标记", d._state_dirty == True)

# ═══════════════════════════════════════
print("\n🧪 Test 4: ACK 追踪器 — 收到 ack 清除")
d.pending_acks.clear()
d.pending_acks["task-002"] = {
    "sent_at": time.monotonic(),
    "wall_ts": time.time(),
    "retries": 0,
    "payload": {"id": "task-002", "to": "huanhuan", "type": "task", "payload": {}}
}
# 模拟 scheduler 收到 ack
d._state_dirty = False
ref_id = "task-002"
source = "huanhuan"
if ref_id in d.pending_acks:
    d.pending_acks.pop(ref_id)
    d._state_dirty = True
test("收到 ack 后 pending 被清除", "task-002" not in d.pending_acks)

# ═══════════════════════════════════════
print("\n🧪 Test 5: 重试逻辑 — 超时判断")
d.pending_acks.clear()
d.mqtt_connected = True

# 模拟一个 65 秒前发的 task
d.pending_acks["task-old"] = {
    "sent_at": time.monotonic() - 65,
    "wall_ts": time.time() - 65,
    "retries": 0,
    "payload": {"id": "task-old", "to": "gouzi", "type": "task", "payload": {"description": "old"}}
}

# mock _resend 和 _send_alert
resend_calls = []
alert_calls = []
orig_resend = d._resend
orig_alert = d._send_alert
d._resend = lambda tid, prefix: resend_calls.append((tid, prefix))
d._send_alert = lambda msg: alert_calls.append(msg)

d._retry_check()
test("60s 超时触发第 1 次重试", len(resend_calls) == 1 and resend_calls[0] == ("task-old", ""))
test("retries 更新为 1", d.pending_acks["task-old"]["retries"] == 1)

# 模拟 155 秒前发的
d.pending_acks["task-old"]["sent_at"] = time.monotonic() - 155
resend_calls.clear()
d._retry_check()
test("150s 超时触发第 2 次重试", len(resend_calls) == 1 and resend_calls[0] == ("task-old", "[RETRY] "))
test("retries 更新为 2", d.pending_acks["task-old"]["retries"] == 2)

# 模拟 335 秒前发的
d.pending_acks["task-old"]["sent_at"] = time.monotonic() - 335
resend_calls.clear()
alert_calls.clear()
d._retry_check()
test("330s 超时触发第 3 次重试", len(resend_calls) == 1 and resend_calls[0] == ("task-old", "[URGENT] "))
test("330s 触发告警", len(alert_calls) == 1)

# 模拟 635 秒前发的
d.pending_acks["task-old"]["sent_at"] = time.monotonic() - 635
d._retry_check()
test("630s 超时标记失败并移除", "task-old" not in d.pending_acks)

# 恢复 mock
d._resend = orig_resend
d._send_alert = orig_alert

# ═══════════════════════════════════════
print("\n🧪 Test 6: 重试不在 MQTT 断连时执行")
d.pending_acks.clear()
d.mqtt_connected = False
d.pending_acks["task-disc"] = {
    "sent_at": time.monotonic() - 65,
    "wall_ts": time.time() - 65,
    "retries": 0,
    "payload": {"id": "task-disc", "to": "gouzi", "type": "task", "payload": {}}
}
resend_calls = []
d._resend = lambda tid, prefix: resend_calls.append((tid, prefix))
d._retry_check()
test("MQTT 断连时不重试", len(resend_calls) == 0)
test("retries 仍为 0", d.pending_acks["task-disc"]["retries"] == 0)
d._resend = orig_resend
d.mqtt_connected = True

# ═══════════════════════════════════════
print("\n🧪 Test 7: 熔断器")
d.fail_counter.clear()
d.circuit_open.clear()
for i in range(3):
    d.handle_result({
        "from": "badbot", "to": "nefi", "type": "result",
        "id": f"r-{i}", "payload": {"ref_id": f"t-{i}", "status": "fail", "summary": "err"}
    })
test("3 次失败触发熔断", "badbot" in d.circuit_open)

d.handle_result({
    "from": "badbot", "to": "nefi", "type": "result",
    "id": "r-ok", "payload": {"ref_id": "t-ok", "status": "done", "summary": "ok"}
})
test("成功后熔断解除", "badbot" not in d.circuit_open)

# ═══════════════════════════════════════
print("\n🧪 Test 8: 告警防循环")
d._last_alerts.clear()
alert_calls = []
orig_publish = None

# 模拟 mqtt_client_ref
class MockMQTT:
    def publish(self, topic, payload, qos=1):
        alert_calls.append(topic)
d.mqtt_client_ref = MockMQTT()

d.MACHINE_NAME  # should be "nefi"
d._send_alert("🔴 test 心跳超时 60s")
test("NeFi(Manager) 告警不发 MQTT", len(alert_calls) == 0, f"got {alert_calls}")

# 模拟非 Manager 机器
orig_name = d.MACHINE_NAME
d.MACHINE_NAME = "gouzi"
d._last_alerts.clear()
alert_calls.clear()
d._send_alert("🔴 test 心跳超时 60s")
test("非 Manager 告警发 MQTT", len(alert_calls) == 1)
d.MACHINE_NAME = orig_name

# ═══════════════════════════════════════
print("\n🧪 Test 9: 告警去重")
d.MACHINE_NAME = "gouzi"
d._last_alerts.clear()
alert_calls.clear()
d._send_alert("🔴 mimi 心跳超时 60s")
d._send_alert("🔴 mimi 心跳超时 75s")
d._send_alert("🔴 mimi 心跳超时 90s")
test("相似告警被去重（数字不同）", len(alert_calls) == 1, f"got {len(alert_calls)}")

alert_calls.clear()
d._send_alert("🔴 xiaohei 心跳超时 60s")
test("不同机器的告警不被去重", len(alert_calls) == 1)
d.MACHINE_NAME = orig_name

# ═══════════════════════════════════════
print("\n🧪 Test 10: handle_alert 防循环")
d.MACHINE_NAME = "nefi"
queue_before = d.task_queue.qsize()
d.handle_alert({"from": "nefi", "to": "nefi", "type": "alert", "id": "a1", "payload": {"message": "self"}})
test("自己发的 alert 被忽略", d.task_queue.qsize() == queue_before)

d.handle_alert({"from": "gouzi", "to": "nefi", "type": "alert", "id": "a2", "payload": {"message": "real"}})
test("别人的 alert 正常处理", d.task_queue.qsize() == queue_before + 1)

# ═══════════════════════════════════════
print("\n🧪 Test 11: 状态持久化 + 恢复")
d.pending_acks.clear()
d.fan_out.clear()
d.STATE_FILE = "/tmp/catbus_test_logs/state_test.json"

d.pending_acks["task-persist"] = {
    "sent_at": time.monotonic() - 30,
    "wall_ts": time.time() - 30,
    "retries": 1,
    "payload": {"id": "task-persist", "to": "gouzi", "type": "task", "payload": {}}
}
d._persist_state()
test("state.json 写入成功", os.path.exists(d.STATE_FILE))

# 清空后恢复
d.pending_acks.clear()
d.load_state()
test("state.json 恢复成功", "task-persist" in d.pending_acks)
test("恢复的 retries 正确", d.pending_acks["task-persist"]["retries"] == 1)

# 测试过期任务恢复
d.pending_acks.clear()
d.pending_acks["task-expired"] = {
    "sent_at": None,
    "wall_ts": time.time() - 700,  # 超过 630s
    "retries": 0,
    "payload": {"id": "task-expired", "to": "gouzi", "type": "task", "payload": {}}
}
d._persist_state()
d.pending_acks.clear()
d.load_state()
test("过期任务不恢复", "task-expired" not in d.pending_acks)

# ═══════════════════════════════════════
print("\n🧪 Test 12: 结构化日志")
d.JSONL_LOG = "/tmp/catbus_test_logs/test_messages.jsonl"
if os.path.exists(d.JSONL_LOG):
    os.remove(d.JSONL_LOG)

d.log_structured("send", {"from": "nefi", "to": "gouzi", "type": "task", "id": "t1", "payload": {}})
d.log_structured("recv", {"from": "gouzi", "to": "nefi", "type": "ack", "id": "a1", "payload": {"ref_id": "t1"}}, latency_ms=47)

with open(d.JSONL_LOG) as f:
    lines = f.readlines()
test("日志写入 2 行", len(lines) == 2)
entry = json.loads(lines[1])
test("日志包含 latency_ms", entry.get("latency_ms") == 47)
test("日志包含 ref_id", entry.get("ref_id") == "t1")

# ═══════════════════════════════════════
print("\n🧪 Test 13: broadcast Tag 过滤")
d.MACHINE_SKILLS = ["nextjs", "python"]
# 匹配的 broadcast
d.mqtt_client_ref = MockMQTT()
alert_calls.clear()
d.handle_broadcast({
    "from": "nefi", "to": "*", "type": "broadcast", "id": "bc1",
    "payload": {"required_skills": ["nextjs", "seo"], "task": "test"}
})
# claim 应该被发出（nextjs 匹配）
test("技能匹配时发 claim", len(alert_calls) == 1, f"got {len(alert_calls)}")

# 不匹配的 broadcast
alert_calls.clear()
d.handle_broadcast({
    "from": "nefi", "to": "*", "type": "broadcast", "id": "bc2",
    "payload": {"required_skills": ["ml", "gpu"], "task": "train"}
})
test("技能不匹配时丢弃", len(alert_calls) == 0)

d.MACHINE_SKILLS = test_config["machine_skills"]  # 恢复

# ═══════════════════════════════════════
print("\n🧪 Test 14: Fan-out deadline")
d.fan_out.clear()
d._state_dirty = False
d._send_alert = lambda msg: None  # suppress

d.fan_out["group-1"] = {
    "tasks": ["t1", "t2", "t3"],
    "results": {"t1": {"status": "done"}},
    "total": 3,
    "deadline": time.monotonic() - 10,  # 已过期
    "wall_deadline": time.time() - 10
}
d._deadline_check()
test("过期 fan_out 被强制汇总", "group-1" not in d.fan_out)

d._send_alert = orig_alert

# ═══════════════════════════════════════
print(f"\n{'='*50}")
print(f"📊 结果: {passed} passed, {failed} failed")
if failed:
    sys.exit(1)

# 清理
import shutil
shutil.rmtree("/tmp/catbus_test_logs", ignore_errors=True)
os.remove("/tmp/catbus_test_config.json")
if os.path.exists("/tmp/catbus_test.sock"):
    os.remove("/tmp/catbus_test.sock")
