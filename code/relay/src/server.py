#!/usr/bin/env python3
"""
CatBus Server — WebSocket 撮合中心

全内存，不持久化。职责：
1. 接受节点连接 + 注册
2. 维护在线节点及其 Skill 清单
3. REQUEST 进来 → 匹配 Provider → 转发 TASK → 回传 RESULT
"""

import asyncio
import json
import logging
import time
import uuid
from dataclasses import dataclass, field

import websockets
from websockets.server import WebSocketServerProtocol

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("catbus.server")

# ─── Data Models ───────────────────────────────────────────────

@dataclass
class Skill:
    name: str
    description: str = ""
    input_schema: dict = field(default_factory=dict)


@dataclass
class Node:
    node_id: str
    name: str
    ws: WebSocketServerProtocol
    skills: list[Skill] = field(default_factory=list)
    last_heartbeat: float = field(default_factory=time.time)


@dataclass
class PendingRequest:
    request_id: str
    caller_id: str
    skill: str
    input: dict
    created_at: float = field(default_factory=time.time)
    timeout_seconds: int = 30


# ─── Server State ──────────────────────────────────────────────

nodes: dict[str, Node] = {}                    # node_id -> Node
pending_requests: dict[str, PendingRequest] = {}  # request_id -> PendingRequest
request_futures: dict[str, asyncio.Future] = {}   # request_id -> Future (waiting for result)


# ─── Helpers ───────────────────────────────────────────────────

async def send_json(ws: WebSocketServerProtocol, msg: dict):
    """Send a JSON message, swallow errors on closed connections."""
    try:
        await ws.send(json.dumps(msg))
    except websockets.exceptions.ConnectionClosed:
        pass


def find_providers(skill_name: str, exclude_node: str = "") -> list[Node]:
    """Find online nodes that provide a given skill."""
    providers = []
    for node in nodes.values():
        if node.node_id == exclude_node:
            continue
        for s in node.skills:
            if s.name == skill_name:
                providers.append(node)
                break
    return providers


def get_network_skills() -> list[dict]:
    """Aggregate all skills across all online nodes."""
    skill_map: dict[str, dict] = {}  # skill_name -> {description, providers}
    for node in nodes.values():
        for s in node.skills:
            if s.name not in skill_map:
                skill_map[s.name] = {
                    "name": s.name,
                    "description": s.description,
                    "providers": 0,
                }
            skill_map[s.name]["providers"] += 1
    return list(skill_map.values())


# ─── Message Handlers ──────────────────────────────────────────

async def handle_register(ws: WebSocketServerProtocol, node_id: str, data: dict):
    """Node comes online and registers its skills."""
    skills = [
        Skill(
            name=s["name"],
            description=s.get("description", ""),
            input_schema=s.get("input_schema", {}),
        )
        for s in data.get("skills", [])
    ]
    node = Node(
        node_id=node_id,
        name=data.get("name", node_id[:8]),
        ws=ws,
        skills=skills,
    )
    nodes[node_id] = node
    skill_names = [s.name for s in skills]
    log.info(f"✅ Node registered: {node.name} ({node_id[:8]}...) — skills: {skill_names}")

    await send_json(ws, {
        "type": "register_ack",
        "data": {
            "node_id": node_id,
            "online_nodes": len(nodes),
            "available_skills": len(get_network_skills()),
        },
    })


async def handle_heartbeat(ws: WebSocketServerProtocol, node_id: str):
    """Keep-alive ping from a node."""
    if node_id in nodes:
        nodes[node_id].last_heartbeat = time.time()

    await send_json(ws, {
        "type": "heartbeat_ack",
        "data": {
            "online_nodes": len(nodes),
            "available_skills": len(get_network_skills()),
        },
    })


async def handle_request(ws: WebSocketServerProtocol, node_id: str, data: dict):
    """Caller wants to invoke a remote skill."""
    request_id = data.get("request_id", str(uuid.uuid4())[:12])
    skill_name = data.get("skill", "")
    skill_input = data.get("input", {})
    timeout = data.get("timeout_seconds", 30)

    log.info(f"📨 Request {request_id}: {node_id[:8]} wants '{skill_name}'")

    # Find a provider
    providers = find_providers(skill_name, exclude_node=node_id)
    if not providers:
        log.warning(f"❌ No provider for '{skill_name}'")
        await send_json(ws, {
            "type": "error",
            "data": {
                "request_id": request_id,
                "code": "no_provider",
                "message": f"No online node provides '{skill_name}'",
            },
        })
        return

    # Pick one (random for now)
    import random
    provider = random.choice(providers)
    log.info(f"🔀 Routing {request_id} → {provider.name} ({provider.node_id[:8]}...)")

    # Store pending request
    pending = PendingRequest(
        request_id=request_id,
        caller_id=node_id,
        skill=skill_name,
        input=skill_input,
        timeout_seconds=timeout,
    )
    pending_requests[request_id] = pending

    # Create a future to wait for result
    loop = asyncio.get_event_loop()
    future = loop.create_future()
    request_futures[request_id] = future

    # Forward task to provider
    await send_json(provider.ws, {
        "type": "task",
        "data": {
            "request_id": request_id,
            "caller_id": node_id,
            "skill": skill_name,
            "input": skill_input,
        },
    })

    # Wait for result or timeout
    try:
        result = await asyncio.wait_for(future, timeout=timeout)
        await send_json(ws, result)
    except asyncio.TimeoutError:
        log.warning(f"⏰ Timeout on {request_id}")
        await send_json(ws, {
            "type": "error",
            "data": {
                "request_id": request_id,
                "code": "timeout",
                "message": f"Provider did not respond within {timeout}s",
            },
        })
    finally:
        pending_requests.pop(request_id, None)
        request_futures.pop(request_id, None)


async def handle_result(ws: WebSocketServerProtocol, node_id: str, data: dict):
    """Provider sends back a task result."""
    request_id = data.get("request_id", "")
    log.info(f"✅ Result for {request_id} from {node_id[:8]}")

    future = request_futures.get(request_id)
    if future and not future.done():
        future.set_result({
            "type": "result",
            "data": data,
        })


async def handle_query_skills(ws: WebSocketServerProtocol, node_id: str):
    """Node asks what skills are available on the network."""
    await send_json(ws, {
        "type": "skills_list",
        "data": {
            "skills": get_network_skills(),
        },
    })


# ─── Connection Handler ───────────────────────────────────────

async def handle_connection(ws: WebSocketServerProtocol):
    """Handle a single WebSocket connection lifecycle."""
    node_id = None
    try:
        async for raw in ws:
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                log.warning("Bad JSON received, ignoring")
                continue

            msg_type = msg.get("type", "")
            msg_node_id = msg.get("node_id", "")
            data = msg.get("data", {})

            if msg_type == "register":
                node_id = msg_node_id
                await handle_register(ws, node_id, data)

            elif msg_type == "heartbeat":
                await handle_heartbeat(ws, msg_node_id)

            elif msg_type == "request":
                await handle_request(ws, msg_node_id, data)

            elif msg_type == "result":
                await handle_result(ws, msg_node_id, data)

            elif msg_type == "query_skills":
                await handle_query_skills(ws, msg_node_id)

            else:
                log.warning(f"Unknown message type: {msg_type}")

    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        # Clean up on disconnect
        if node_id and node_id in nodes:
            name = nodes[node_id].name
            del nodes[node_id]
            log.info(f"👋 Node disconnected: {name} ({node_id[:8]}...)")


# ─── Heartbeat Reaper ─────────────────────────────────────────

async def reap_stale_nodes(interval: int = 30, timeout: int = 90):
    """Periodically remove nodes that haven't sent a heartbeat."""
    while True:
        await asyncio.sleep(interval)
        now = time.time()
        stale = [
            nid for nid, node in nodes.items()
            if now - node.last_heartbeat > timeout
        ]
        for nid in stale:
            name = nodes[nid].name
            del nodes[nid]
            log.info(f"💀 Reaped stale node: {name} ({nid[:8]}...)")


# ─── Main ─────────────────────────────────────────────────────

async def main(host: str = "0.0.0.0", port: int = 8765):
    log.info(f"🚌 CatBus Server starting on ws://{host}:{port}")

    # Start reaper
    asyncio.create_task(reap_stale_nodes())

    async with websockets.serve(handle_connection, host, port):
        log.info("🟢 Ready. Waiting for nodes...")
        await asyncio.Future()  # run forever


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="CatBus Server")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()

    asyncio.run(main(args.host, args.port))
