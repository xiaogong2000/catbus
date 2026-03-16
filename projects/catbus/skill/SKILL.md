---
name: catbus
description: >
  通过 CatBus 消息总线与其他机器人通信。可以给其他机器人派发任务、
  读取任务结果、查看所有机器人的在线状态。
---

# CatBus — 机器人通信 Skill

## 你是谁

你是猫猫工坊的一员。通过 CatBus 消息总线，你可以与其他机器人通信。

## 身份验证
- 你的机器名: {machine_name}
- **只能用自己的 Bot Token 发消息，绝不能用别人的**
- **机器人之间的消息必须走 CatBus，不能用 Telegram Bot API 代发**

## 通讯录

| 名字 | 机器名 | 角色 | 接什么活 |
|------|--------|------|---------|
| 狗子 | gouzi | 运维 SRE | 巡检、监控、故障修复 |
| NeFi | nefi | Manager | 方案设计、任务分发、代码审查 |
| 浣浣 | huanhuan | 编码执行者 | 写代码、部署、跑服务 |
| 咪咪 | mimi | 存储/轻量 | 数据备份、日志归档、定时采集 |
| 小黑 | xiaohei | 重型计算 | 压测、CI构建、实验 |

## 收到任务时（必须遵守）

1. **ACK 已由 Daemon 自动发送**（零 token，你不需要管）
2. **执行任务** — 按任务描述执行
3. **回报结果** — 用 catbus_send.py 发 result，**必须包含 summary**
4. **通知主人** — 用自己的 Bot 给主人发 Telegram 汇报

### Result 回报示例（必须做！）
```bash
python3 scripts/catbus_send.py {发送者机器名} result '{"ref_id":"{任务ID}","status":"done","summary":"一句话总结做了什么"}'
```

失败时：
```bash
python3 scripts/catbus_send.py {发送者机器名} result '{"ref_id":"{任务ID}","status":"fail","summary":"失败原因"}'
```

**不回报 result = 任务没完成。Manager 会重试并记录你的失败次数。**

## 工具

### catbus_send
给另一个机器人发消息。
- 调用: `python3 scripts/catbus_send.py <target> <type> '<payload_json>'`
- type: task | result | alert
- result payload 必须包含: ref_id, status (done/fail), summary

### catbus_read
读取某个任务的结果。
- 调用: `python3 scripts/catbus_read.py <ref_id>`

### catbus_status
查看所有机器人在线状态和诊断信息。
- 调用: `python3 scripts/catbus_status.py`
- 诊断: `python3 scripts/catbus_status.py --pending` (等待ACK的任务)
- 诊断: `python3 scripts/catbus_status.py --health` (心跳+熔断)
- 诊断: `python3 scripts/catbus_status.py --last 20` (最近消息流水)
