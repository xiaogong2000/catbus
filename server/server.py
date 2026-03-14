#!/usr/bin/env python3
"""
CatBus Server — WebSocket 撮合中心 + HTTP API

全内存，不持久化。职责：
1. 接受节点连接 + 注册（支持 capabilities 和 skills 两种格式）
2. 维护在线节点及其 Capability 清单
3. REQUEST 进来 → 匹配 Provider → 转发 TASK → 回传 RESULT
4. HTTP API on 127.0.0.1:8766

Capability 体系：type/name 格式
  model/claude-sonnet-4, skill/tavily, compute/gpu-4090 ...
"""

import asyncio
import json
import logging
import time
import uuid
from collections import deque
from dataclasses import dataclass, field

import websockets
from websockets.server import WebSocketServerProtocol
from aiohttp import web
from aiohttp.web_middlewares import middleware

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("catbus.server")

VERSION = "2.0.0"

# ─── Cost Tier Constants ──────────────────────────────────────

COST_TIER_ORDER_ASC = {"free": 0, "low": 1, "medium": 2, "high": 3, "premium": 4}
COST_TIER_ORDER_DESC = {"premium": 0, "high": 1, "medium": 2, "low": 3, "free": 4}

# ─── Global Stats ─────────────────────────────────────────────

SERVER_START_TIME: float = time.time()

call_stats: dict = {
    "total": 0,
    "today": 0,
    "today_date": time.strftime("%Y-%m-%d"),
    "total_latency_ms": 0.0,
}

skill_call_stats: dict[str, dict] = {}  # capability_name -> {total, total_latency_ms}


def reset_daily_stats() -> None:
    today = time.strftime("%Y-%m-%d")
    if call_stats["today_date"] != today:
        call_stats["today"] = 0
        call_stats["today_date"] = today


def record_call(duration_ms: float) -> None:
    reset_daily_stats()
    call_stats["total"] += 1
    call_stats["today"] += 1
    call_stats["total_latency_ms"] += duration_ms


def record_skill_call(skill_name: str, duration_ms: float) -> None:
    if skill_name not in skill_call_stats:
        skill_call_stats[skill_name] = {"total": 0, "total_latency_ms": 0.0}
    skill_call_stats[skill_name]["total"] += 1
    skill_call_stats[skill_name]["total_latency_ms"] += duration_ms


def record_node_call(caller_id: str, provider_id: str, skill_name: str,
                     status: str, duration_ms: float, request_id: str) -> None:
    import datetime
    ts = datetime.datetime.utcnow().isoformat() + "Z"

    outbound_rec = {
        "id": f"call-{request_id}",
        "timestamp": ts,
        "direction": "outbound",
        "skill": skill_name,
        "remote_node": provider_id,
        "latency_ms": round(duration_ms),
        "status": status,
        "relay": "relay.catbus.xyz",
    }
    inbound_rec = {
        "id": f"call-{request_id}-in",
        "timestamp": ts,
        "direction": "inbound",
        "skill": skill_name,
        "remote_node": caller_id,
        "latency_ms": round(duration_ms),
        "status": status,
        "relay": "relay.catbus.xyz",
    }

    for node_id, rec in [(caller_id, outbound_rec), (provider_id, inbound_rec)]:
        if node_id not in node_call_history:
            node_call_history[node_id] = deque(maxlen=MAX_CALL_HISTORY)
        node_call_history[node_id].appendleft(rec)


# ─── Data Models ───────────────────────────────────────────────

@dataclass
class Capability:
    """统一的能力描述。"""
    type: str           # "model" / "skill" / "compute" / ...
    name: str           # "model/claude-sonnet-4" / "skill/tavily"
    meta: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {"type": self.type, "name": self.name, "meta": self.meta}


@dataclass
class Skill:
    """向后兼容：老格式 skill。"""
    name: str
    description: str = ""
    input_schema: dict = field(default_factory=dict)


@dataclass
class Node:
    node_id: str
    name: str
    ws: WebSocketServerProtocol
    capabilities: list[Capability] = field(default_factory=list)
    skills: list[Skill] = field(default_factory=list)  # 向后兼容
    connected_at: float = field(default_factory=time.time)
    last_heartbeat: float = field(default_factory=time.time)
    connected_from: str = ""
    limits: dict = field(default_factory=dict)


@dataclass
class PendingRequest:
    request_id: str
    caller_id: str
    capability: str   # 请求的 capability name
    input: dict
    created_at: float = field(default_factory=time.time)
    timeout_seconds: int = 30


# ─── Server State ──────────────────────────────────────────────

nodes: dict[str, Node] = {}
pending_requests: dict[str, PendingRequest] = {}
request_futures: dict[str, asyncio.Future] = {}
_request_start_times: dict[str, tuple[float, str]] = {}

node_call_history: dict[str, deque] = {}
MAX_CALL_HISTORY = 500


# ─── Helpers ───────────────────────────────────────────────────

async def send_json(ws: WebSocketServerProtocol, msg: dict):
    try:
        await ws.send(json.dumps(msg))
    except websockets.exceptions.ConnectionClosed:
        pass


def normalize_registration(data: dict) -> tuple[list[Capability], list[Skill]]:
    """
    将注册数据标准化为 capabilities + skills。
    支持：
      1. 新格式：data.capabilities 列表
      2. 老格式：data.skills 列表 → 自动转换为 capabilities
      3. 混合格式：两个都有
    """
    capabilities = []
    skills = []

    # 解析 capabilities（新格式）
    for cap_data in data.get("capabilities", []):
        capabilities.append(Capability(
            type=cap_data.get("type", "skill"),
            name=cap_data.get("name", ""),
            meta=cap_data.get("meta", {}),
        ))

    # 解析 skills（老格式 → 向后兼容）
    for s_data in data.get("skills", []):
        if isinstance(s_data, str):
            skill_name = s_data
            skills.append(Skill(name=skill_name))
            # 如果 capabilities 中没有对应条目，自动创建
            full_name = f"skill/{skill_name}"
            if not any(c.name == full_name for c in capabilities):
                capabilities.append(Capability(
                    type="skill",
                    name=full_name,
                    meta={},
                ))
        elif isinstance(s_data, dict):
            skill_name = s_data.get("name", "")
            skills.append(Skill(
                name=skill_name,
                description=s_data.get("description", ""),
                input_schema=s_data.get("input_schema", {}),
            ))
            full_name = f"skill/{skill_name}"
            if not any(c.name == full_name for c in capabilities):
                capabilities.append(Capability(
                    type="skill",
                    name=full_name,
                    meta={"description": s_data.get("description", "")},
                ))

    return capabilities, skills


VIRTUAL_SELECTORS = {"best", "cheapest", "code", "vision", "math", "reasoning", "fast", "chinese", "long"}
COST_TIER_ORDER = {"free": 0, "low": 1, "medium": 2, "high": 3, "premium": 4}

def find_providers(skill_name: str, exclude_node: str = "") -> list:
    """Find online nodes that provide a given skill.

    Supports virtual selectors: model/best, model/cheapest, model/code, etc.
    When skill_name is "model/<selector>", route by capability meta (arena_elo).
    """
    selector = None
    if skill_name.startswith("model/"):
        selector = skill_name.split("/", 1)[1]
        if selector not in VIRTUAL_SELECTORS:
            selector = None

    if selector is None:
        # Normal routing: exact match on capability name
        providers = []
        for node in nodes.values():
            if node.node_id == exclude_node:
                continue
            for cap in node.capabilities:
                if cap.name == skill_name:
                    providers.append((node, cap))
                    break
            # legacy skill fallback
            for s in node.skills:
                if s.name == skill_name and not any(c.name == skill_name for c in node.capabilities):
                    providers.append((node, s))
                    break
        return providers

    # Virtual selector routing — scan all "model/*" capabilities across nodes
    candidates = []
    for node in nodes.values():
        if node.node_id == exclude_node:
            continue
        for cap in node.capabilities:
            if not cap.name.startswith("model/"):
                continue
            meta = cap.meta or {}
            elo = meta.get("arena_elo", 0)
            strengths = meta.get("strengths", [])
            cost_tier = meta.get("cost_tier", "medium")
            if selector == "best":
                candidates.append((node, cap, elo))
            elif selector == "cheapest":
                candidates.append((node, cap, COST_TIER_ORDER.get(cost_tier, 2)))
            elif selector == "fast":
                if "fast" in strengths:
                    candidates.append((node, cap, elo))
            elif selector == "long":
                if "long-context" in strengths:
                    candidates.append((node, cap, elo))
            else:
                if selector in strengths:
                    candidates.append((node, cap, elo))

    if not candidates:
        return []

    if selector == "cheapest":
        best_score = min(c[2] for c in candidates)
    else:
        best_score = max(c[2] for c in candidates)

    best = [(c[0], c[1]) for c in candidates if c[2] == best_score]
    return [random.choice(best)]

def get_network_skills() -> list[dict]:
    """Aggregate all skills across all online nodes (backward compat)."""
    skill_map: dict[str, dict] = {}
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


def get_network_capabilities() -> list[dict]:
    """Aggregate all capabilities across all online nodes."""
    cap_map: dict[str, dict] = {}
    for node in nodes.values():
        for cap in node.capabilities:
            if cap.name not in cap_map:
                cap_map[cap.name] = {
                    "name": cap.name,
                    "type": cap.type,
                    "providers": 0,
                    "meta": cap.meta,
                }
            cap_map[cap.name]["providers"] += 1
    return list(cap_map.values())


def _node_to_dict(node: Node) -> dict:
    return {
        "node_id": node.node_id,
        "name": node.name,
        "status": "online",
        "capabilities": [c.to_dict() for c in node.capabilities],
        "skills": [s.name for s in node.skills],  # 向后兼容
        "connected_at": node.connected_at,
        "last_heartbeat": node.last_heartbeat,
        "connected_from": node.connected_from,
    }


def _paginate(items: list, page: int, limit: int) -> dict:
    total = len(items)
    start = (page - 1) * limit
    end = start + limit
    return {"data": items[start:end], "total": total, "page": page, "limit": limit}


def _json_response(data, status: int = 200) -> web.Response:
    return web.Response(
        text=json.dumps(data),
        status=status,
        content_type="application/json",
    )


def _error_response(code: int, message: str) -> web.Response:
    return _json_response({"error": {"code": code, "message": message}}, status=code)


# ─── CORS Middleware ───────────────────────────────────────────

ALLOWED_ORIGINS = {
    "https://catbus.ai",
    "https://catbus.xyz",
    "http://localhost:3000",
}


@middleware
async def cors_middleware(request: web.Request, handler):
    origin = request.headers.get("Origin", "")
    is_allowed = origin in ALLOWED_ORIGINS

    if request.method == "OPTIONS":
        headers = {
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Max-Age": "86400",
        }
        if is_allowed:
            headers["Access-Control-Allow-Origin"] = origin
        return web.Response(status=204, headers=headers)

    response = await handler(request)
    if is_allowed:
        response.headers["Access-Control-Allow-Origin"] = origin
    return response


# ─── HTTP API Handlers ────────────────────────────────────────

async def api_health(request: web.Request) -> web.Response:
    return _json_response({
        "ok": True,
        "version": VERSION,
        "uptime_seconds": round(time.time() - SERVER_START_TIME, 2),
    })


async def api_stats(request: web.Request) -> web.Response:
    reset_daily_stats()
    total_calls = call_stats["total"]
    avg_latency = (
        round(call_stats["total_latency_ms"] / total_calls, 2)
        if total_calls > 0 else 0.0
    )
    all_caps = get_network_capabilities()
    all_skills = get_network_skills()
    models = [c for c in all_caps if c["type"] == "model"]
    skills_caps = [c for c in all_caps if c["type"] == "skill"]

    return _json_response({
        "online_nodes": len(nodes),
        "total_capabilities": len(all_caps),
        "total_models": len(models),
        "total_skills": max(len(all_skills), len(skills_caps)),
        "calls_today": call_stats["today"],
        "calls_total": total_calls,
        "avg_latency_ms": avg_latency,
        "uptime_seconds": round(time.time() - SERVER_START_TIME, 2),
    })


async def api_nodes(request: web.Request) -> web.Response:
    try:
        page = max(1, int(request.rel_url.query.get("page", 1)))
        limit = min(100, max(1, int(request.rel_url.query.get("limit", 20))))
    except (ValueError, TypeError):
        return _error_response(400, "Invalid page or limit parameter")

    node_list = [_node_to_dict(n) for n in nodes.values()]
    return _json_response(_paginate(node_list, page, limit))


async def api_node_detail(request: web.Request) -> web.Response:
    node_id = request.match_info["node_id"]
    node = nodes.get(node_id)
    if not node:
        return _error_response(404, f"Node '{node_id}' not found")
    return _json_response(_node_to_dict(node))


# ─── Capabilities API (NEW) ──────────────────────────────────

async def api_capabilities(request: web.Request) -> web.Response:
    """GET /api/capabilities — 全网能力汇总。"""
    try:
        page = max(1, int(request.rel_url.query.get("page", 1)))
        limit = min(100, max(1, int(request.rel_url.query.get("limit", 20))))
    except (ValueError, TypeError):
        return _error_response(400, "Invalid page or limit parameter")

    cap_type = request.rel_url.query.get("type", "")
    caps = get_network_capabilities()

    if cap_type:
        caps = [c for c in caps if c["type"] == cap_type]

    summary = {}
    for c in get_network_capabilities():
        t = c["type"]
        summary[t] = summary.get(t, 0) + 1

    result = _paginate(caps, page, limit)
    result["summary"] = {
        "total_capabilities": len(get_network_capabilities()),
        **summary,
    }
    return _json_response(result)


async def api_capabilities_by_type(request: web.Request) -> web.Response:
    """GET /api/capabilities/{type} — 按类型查询能力。"""
    cap_type = request.match_info["type"]

    try:
        page = max(1, int(request.rel_url.query.get("page", 1)))
        limit = min(100, max(1, int(request.rel_url.query.get("limit", 20))))
    except (ValueError, TypeError):
        return _error_response(400, "Invalid page or limit parameter")

    caps = [c for c in get_network_capabilities() if c["type"] == cap_type]
    return _json_response(_paginate(caps, page, limit))


async def api_capability_detail(request: web.Request) -> web.Response:
    """GET /api/capabilities/{type}/{name} — 单个能力详情。"""
    cap_type = request.match_info["type"]
    cap_name = request.match_info["name"]
    full_name = f"{cap_type}/{cap_name}"

    providers_list = []
    meta = {}
    for node in nodes.values():
        for cap in node.capabilities:
            if cap.name == full_name:
                if not meta:
                    meta = cap.meta
                providers_list.append({
                    "node_id": node.node_id,
                    "name": node.name,
                    "status": "online",
                    "cost_tier": cap.meta.get("cost_tier", ""),
                })

    if not providers_list:
        return _error_response(404, f"Capability '{full_name}' not found")

    result = {
        "name": full_name,
        "type": cap_type,
        "providers": providers_list,
        "meta": meta,
    }

    # Attach call stats
    if full_name in skill_call_stats:
        sc = skill_call_stats[full_name]
        result["calls_total"] = sc["total"]
        result["avg_latency_ms"] = (
            round(sc["total_latency_ms"] / sc["total"], 2) if sc["total"] > 0 else 0.0
        )
    else:
        result["calls_total"] = 0
        result["avg_latency_ms"] = 0.0

    return _json_response(result)


# ─── Skills API (backward compat) ────────────────────────────

async def api_skills(request: web.Request) -> web.Response:
    try:
        page = max(1, int(request.rel_url.query.get("page", 1)))
        limit = min(100, max(1, int(request.rel_url.query.get("limit", 20))))
    except (ValueError, TypeError):
        return _error_response(400, "Invalid page or limit parameter")

    skill_list = get_network_skills()
    return _json_response(_paginate(skill_list, page, limit))


async def api_skill_detail(request: web.Request) -> web.Response:
    skill_name = request.match_info["name"]
    skill_map: dict[str, dict] = {}

    for node in nodes.values():
        for s in node.skills:
            if s.name == skill_name:
                if skill_name not in skill_map:
                    skill_map[skill_name] = {
                        "name": s.name,
                        "description": s.description,
                        "input_schema": s.input_schema,
                        "providers": [],
                    }
                skill_map[skill_name]["providers"].append({
                    "node_id": node.node_id,
                    "name": node.name,
                })

    if skill_name not in skill_map:
        return _error_response(404, f"Skill '{skill_name}' not found")

    result = skill_map[skill_name]
    if skill_name in skill_call_stats:
        sc = skill_call_stats[skill_name]
        result["calls_total"] = sc["total"]
        result["avg_latency_ms"] = (
            round(sc["total_latency_ms"] / sc["total"], 2) if sc["total"] > 0 else 0.0
        )
    else:
        result["calls_total"] = 0
        result["avg_latency_ms"] = 0.0

    return _json_response(result)


# ─── Node Call History API ────────────────────────────────────

async def api_node_calls(request: web.Request) -> web.Response:
    node_id = request.match_info["node_id"]
    history = node_call_history.get(node_id)
    if history is None:
        return _json_response(_paginate([], 1, 20))

    records = list(history)
    direction = request.rel_url.query.get("direction", "")
    status_filter = request.rel_url.query.get("status", "")
    skill_filter = request.rel_url.query.get("skill", "")
    if direction:
        records = [r for r in records if r["direction"] == direction]
    if status_filter:
        records = [r for r in records if r["status"] == status_filter]
    if skill_filter:
        records = [r for r in records if r["skill"] == skill_filter]

    try:
        page = max(1, int(request.rel_url.query.get("page", 1)))
        limit = min(100, max(1, int(request.rel_url.query.get("limit", 20))))
    except (ValueError, TypeError):
        return _error_response(400, "Invalid page or limit parameter")

    return _json_response(_paginate(records, page, limit))


async def api_node_calls_summary(request: web.Request) -> web.Response:
    node_id = request.match_info["node_id"]
    history = node_call_history.get(node_id)
    if not history:
        return _json_response({
            "total_handled": 0, "total_made": 0,
            "success_rate": 0.0, "avg_latency": 0.0,
        })

    records = list(history)
    handled = [r for r in records if r["direction"] == "inbound"]
    made = [r for r in records if r["direction"] == "outbound"]
    all_success = [r for r in records if r["status"] == "success"]
    total = len(records)
    avg_latency = (
        sum(r["latency_ms"] for r in records) / total if total > 0 else 0.0
    )
    return _json_response({
        "total_handled": len(handled),
        "total_made": len(made),
        "success_rate": round(len(all_success) / total * 100, 2) if total > 0 else 0.0,
        "avg_latency": round(avg_latency, 2),
    })


async def api_node_stats_daily(request: web.Request) -> web.Response:
    import datetime
    node_id = request.match_info["node_id"]
    try:
        days = min(30, max(1, int(request.rel_url.query.get("days", 7))))
    except (ValueError, TypeError):
        return _error_response(400, "Invalid days parameter")

    history = node_call_history.get(node_id)
    records = list(history) if history else []

    today = datetime.date.today()
    buckets = {}
    for i in range(days):
        d = (today - datetime.timedelta(days=days - 1 - i)).isoformat()
        buckets[d] = {"date": d, "inbound": 0, "outbound": 0}

    for r in records:
        day = r["timestamp"][:10]
        if day in buckets:
            buckets[day][r["direction"]] += 1

    return _json_response(list(buckets.values()))


async def handle_404(request: web.Request) -> web.Response:
    return _error_response(404, f"Not found: {request.path}")


# ─── Message Handlers ──────────────────────────────────────────

async def handle_register(ws: WebSocketServerProtocol, node_id: str, data: dict, client_ip: str = ""):
    """Node comes online and registers its capabilities."""
    capabilities, skills = normalize_registration(data)

    if not client_ip:
        remote = ws.remote_address
        client_ip = remote[0] if remote else ""
        if client_ip.startswith("::ffff:"):
            client_ip = client_ip[7:]

    node = Node(
        node_id=node_id,
        name=data.get("name", node_id[:8]),
        ws=ws,
        capabilities=capabilities,
        skills=skills,
        connected_from=client_ip,
        limits=data.get("limits", {}),
    )
    nodes[node_id] = node

    cap_names = [c.name for c in capabilities]
    log.info(f"✅ Node registered: {node.name} ({node_id[:8]}...) — capabilities: {cap_names}")

    await send_json(ws, {
        "type": "register_ack",
        "data": {
            "node_id": node_id,
            "online_nodes": len(nodes),
            "available_skills": len(get_network_skills()),
            "available_capabilities": len(get_network_capabilities()),
        },
    })


async def handle_heartbeat(ws: WebSocketServerProtocol, node_id: str):
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
    """Caller wants to invoke a remote capability."""
    request_id = data.get("request_id", str(uuid.uuid4())[:12])
    # 新格式用 capability，老格式用 skill
    capability_name = data.get("capability", "") or data.get("skill", "")
    skill_input = data.get("input", {})
    timeout = data.get("timeout_seconds", 30)

    log.info(f"📨 Request {request_id}: {node_id[:8]} wants '{capability_name}'")

    # Find providers (with fuzzy matching)
    candidates = find_providers(capability_name, exclude_node=node_id)
    if not candidates:
        log.warning(f"❌ No provider for '{capability_name}'")
        await send_json(ws, {
            "type": "error",
            "data": {
                "request_id": request_id,
                "code": "no_provider",
                "message": f"No online node provides '{capability_name}'",
            },
        })
        return

    # Pick one (random for now; Phase 2 will use first-bid-wins)
    import random
    provider_node, matched_cap = random.choice(candidates)
    log.info(f"🔀 Routing {request_id} → {provider_node.name} ({provider_node.node_id[:8]}...) "
             f"[matched: {matched_cap.name}]")

    pending = PendingRequest(
        request_id=request_id,
        caller_id=node_id,
        capability=capability_name,
        input=skill_input,
        timeout_seconds=timeout,
    )
    pending_requests[request_id] = pending

    _request_start_times[request_id] = (time.time(), capability_name)

    loop = asyncio.get_event_loop()
    future = loop.create_future()
    request_futures[request_id] = future

    # Forward task to provider — 发送 matched capability name（而非原始请求名）
    await send_json(provider_node.ws, {
        "type": "task",
        "data": {
            "request_id": request_id,
            "caller_id": node_id,
            "capability": matched_cap.name,   # 新格式
            "skill": matched_cap.name.split("/", 1)[-1] if "/" in matched_cap.name else matched_cap.name,  # 向后兼容
            "input": skill_input,
        },
    })

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
        if request_id in _request_start_times:
            start_time, cap_name = _request_start_times[request_id]
            dur = (time.time() - start_time) * 1000.0
            record_node_call(node_id, provider_node.node_id, cap_name, "timeout", dur, request_id)
    finally:
        pending_requests.pop(request_id, None)
        request_futures.pop(request_id, None)
        _request_start_times.pop(request_id, None)


async def handle_result(ws: WebSocketServerProtocol, node_id: str, data: dict):
    request_id = data.get("request_id", "")
    log.info(f"✅ Result for {request_id} from {node_id[:8]}")

    if request_id in _request_start_times:
        start_time, capability_name = _request_start_times[request_id]
        duration_ms = (time.time() - start_time) * 1000.0
        record_call(duration_ms)
        record_skill_call(capability_name, duration_ms)
        pending = pending_requests.get(request_id)
        if pending:
            record_node_call(
                caller_id=pending.caller_id,
                provider_id=node_id,
                skill_name=capability_name,
                status="success",
                duration_ms=duration_ms,
                request_id=request_id,
            )

    future = request_futures.get(request_id)
    if future and not future.done():
        future.set_result({
            "type": "result",
            "data": data,
        })


async def handle_query_skills(ws: WebSocketServerProtocol, node_id: str):
    await send_json(ws, {
        "type": "skills_list",
        "data": {
            "skills": get_network_skills(),
            "capabilities": [c for c in get_network_capabilities()],
        },
    })


# ─── Connection Handler ───────────────────────────────────────

async def handle_connection(ws: WebSocketServerProtocol):
    node_id = None
    _real_ip: str = getattr(ws, "_real_client_ip", "")
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
                await handle_register(ws, node_id, data, _real_ip)
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
        if node_id and node_id in nodes:
            name = nodes[node_id].name
            del nodes[node_id]
            log.info(f"👋 Node disconnected: {name} ({node_id[:8]}...)")


# ─── Heartbeat Reaper ─────────────────────────────────────────

async def reap_stale_nodes(interval: int = 30, timeout: int = 90):
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


# ─── HTTP Server ──────────────────────────────────────────────

async def start_http_server(host: str = "127.0.0.1", port: int = 8766):
    app = web.Application(middlewares=[cors_middleware])

    app.router.add_get("/api/health", api_health)
    app.router.add_get("/api/stats", api_stats)
    app.router.add_get("/api/nodes", api_nodes)
    app.router.add_get("/api/nodes/{node_id}", api_node_detail)
    app.router.add_get("/api/nodes/{node_id}/calls", api_node_calls)
    app.router.add_get("/api/nodes/{node_id}/calls/summary", api_node_calls_summary)
    app.router.add_get("/api/nodes/{node_id}/stats/daily", api_node_stats_daily)
    # Capabilities API (NEW)
    app.router.add_get("/api/capabilities", api_capabilities)
    app.router.add_get("/api/capabilities/{type}", api_capabilities_by_type)
    app.router.add_get("/api/capabilities/{type}/{name}", api_capability_detail)
    # Skills API (backward compat)
    app.router.add_get("/api/skills", api_skills)
    app.router.add_get("/api/skills/{name}", api_skill_detail)
    app.router.add_route("*", "/{path_info:.*}", handle_404)

    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, host, port)
    await site.start()
    log.info(f"🌐 HTTP API listening on http://{host}:{port}")
    return runner


# ─── Main ─────────────────────────────────────────────────────

async def process_request(connection, request):
    headers = request.headers
    real_ip = (
        headers.get("X-Real-IP")
        or headers.get("x-real-ip")
        or headers.get("X-Forwarded-For", "").split(",")[0].strip()
        or headers.get("x-forwarded-for", "").split(",")[0].strip()
    )
    if not real_ip:
        remote = connection.remote_address
        real_ip = remote[0] if remote else ""
        if real_ip.startswith("::ffff:"):
            real_ip = real_ip[7:]
    connection._real_client_ip = real_ip
    return None


async def main(host: str = "0.0.0.0", port: int = 8765,
               http_host: str = "127.0.0.1", http_port: int = 8766):
    log.info(f"🚌 CatBus Server v{VERSION} starting on ws://{host}:{port}")

    asyncio.create_task(reap_stale_nodes())

    http_runner = await start_http_server(http_host, http_port)

    async with websockets.serve(handle_connection, host, port, process_request=process_request):
        log.info("🟢 Ready. Waiting for nodes...")
        try:
            await asyncio.Future()
        finally:
            await http_runner.cleanup()


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="CatBus Server")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--http-host", default="127.0.0.1")
    parser.add_argument("--http-port", type=int, default=8766)
    args = parser.parse_args()

    asyncio.run(main(args.host, args.port, args.http_host, args.http_port))
