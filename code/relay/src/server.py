#!/usr/bin/env python3
"""
CatBus Server — WebSocket 撮合中心 + HTTP API

全内存，不持久化。职责：
1. 接受节点连接 + 注册
2. 维护在线节点及其 Skill 清单
3. REQUEST 进来 → 匹配 Provider → 转发 TASK → 回传 RESULT
4. HTTP API on 127.0.0.1:8766
"""

import asyncio
import json
import logging
import time
import uuid
from dataclasses import dataclass, field

import websockets
from websockets.server import WebSocketServerProtocol

try:
    from catbus.capability_db import MODEL_DB, extract_base_model, get_model_info
    _CAPABILITY_DB_AVAILABLE = True
except ImportError:
    _CAPABILITY_DB_AVAILABLE = False
    MODEL_DB = {}
    def extract_base_model(name): return name
    def get_model_info(name): return {}
from aiohttp import web
from aiohttp.web_middlewares import middleware

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("catbus.server")

VERSION = "2.0.0"

# ─── Global Stats ─────────────────────────────────────────────

SERVER_START_TIME: float = time.time()

call_stats: dict = {
    "total": 0,
    "today": 0,
    "today_date": time.strftime("%Y-%m-%d"),
    "total_latency_ms": 0.0,
}

skill_call_stats: dict[str, dict] = {}  # skill_name -> {total, total_latency_ms}


def reset_daily_stats() -> None:
    """Reset today's call counters if the date has rolled over."""
    today = time.strftime("%Y-%m-%d")
    if call_stats["today_date"] != today:
        call_stats["today"] = 0
        call_stats["today_date"] = today


def record_call(duration_ms: float) -> None:
    """Record a completed skill call."""
    reset_daily_stats()
    call_stats["total"] += 1
    call_stats["today"] += 1
    call_stats["total_latency_ms"] += duration_ms


def record_skill_call(skill_name: str, duration_ms: float) -> None:
    """Record a completed call for a specific skill."""
    if skill_name not in skill_call_stats:
        skill_call_stats[skill_name] = {"total": 0, "total_latency_ms": 0.0}
    skill_call_stats[skill_name]["total"] += 1
    skill_call_stats[skill_name]["total_latency_ms"] += duration_ms


# ─── Data Models ───────────────────────────────────────────────

@dataclass
class Skill:
    name: str
    description: str = ""
    input_schema: dict = field(default_factory=dict)
    type: str = "skill"
    meta: dict = field(default_factory=dict)


@dataclass
class Node:
    node_id: str
    name: str
    ws: WebSocketServerProtocol
    skills: list[Skill] = field(default_factory=list)
    capabilities: list[Skill] = field(default_factory=list)
    connected_at: float = field(default_factory=time.time)
    last_heartbeat: float = field(default_factory=time.time)
    connected_from: str = ""


@dataclass
class PendingRequest:
    request_id: str
    caller_id: str
    skill: str
    input: dict
    created_at: float = field(default_factory=time.time)
    timeout_seconds: int = 180


# ─── Server State ──────────────────────────────────────────────

nodes: dict[str, Node] = {}                    # node_id -> Node
pending_requests: dict[str, PendingRequest] = {}  # request_id -> PendingRequest
request_futures: dict[str, asyncio.Future] = {}   # request_id -> Future (waiting for result)

# Track call start times for latency measurement: request_id -> (start_time, skill_name)
_request_start_times: dict[str, tuple[float, str]] = {}

# ─── Result Cache (TTL 10 min) ────────────────────────────────
RESULT_CACHE_TTL = 600  # 10 minutes
result_cache: dict[str, dict] = {}  # request_id -> {result, cached_at}

# Track caller info for async callback (late results after timeout)
_caller_map: dict[str, str] = {}  # request_id -> caller_node_id


async def _cleanup_result_cache():
    """Periodically evict expired entries from result_cache."""
    while True:
        await asyncio.sleep(60)
        now = time.time()
        expired = [rid for rid, entry in result_cache.items()
                   if now - entry["cached_at"] > RESULT_CACHE_TTL]
        for rid in expired:
            del result_cache[rid]
        if expired:
            log.info(f"🗑️  Cache cleanup: evicted {len(expired)} entries")


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


# ─── Virtual Selector Routing ─────────────────────────────────

SELECTOR_CONFIGS = {
    'model/best':    {'sort_by': 'arena_elo'},
    'model/fast':    {'sort_by': 'latency', 'min_cost_tier': 'medium'},
    'model/vision':  {'sort_by': 'arena_elo', 'required_strength': 'vision'},
    'model/chinese': {'sort_by': 'arena_elo', 'required_strength': 'chinese'},
}


def resolve_virtual_selector(capability: str, candidates: list) -> list:
    """Sort/filter model candidates by virtual selector config.

    candidates: list of (Node, meta_dict) tuples
    Returns sorted/filtered list of same type.
    """
    config = SELECTOR_CONFIGS.get(capability) or SELECTOR_CONFIGS['model/best']

    if 'required_strength' in config:
        filtered = [c for c in candidates if config['required_strength'] in c[1].get('strengths', [])]
        if filtered:
            candidates = filtered

    if 'min_cost_tier' in config:
        TIER = {'premium': 4, 'high': 3, 'medium': 2, 'low': 1, 'free': 0}
        min_v = TIER.get(config['min_cost_tier'], 0)
        filtered = [c for c in candidates if TIER.get(c[1].get('cost_tier', 'free'), 0) >= min_v]
        if filtered:
            candidates = filtered

    if config.get('sort_by') == 'arena_elo':
        candidates.sort(key=lambda x: x[1].get('arena_elo', 0), reverse=True)
    elif config.get('sort_by') == 'latency':
        candidates.sort(key=lambda x: x[1].get('avg_latency', 9999))

    log.info(f"[ROUTE] selector={capability} "
             f"candidates={[(c[0].name, c[1].get('arena_elo', '?')) for c in candidates[:3]]} "
             f"→ chosen={candidates[0][0].name if candidates else 'none'}")
    return candidates


def find_providers_with_selector(skill_name: str, exclude_node: str = "") -> list[Node]:
    """Find providers with virtual selector routing for model/ capabilities."""
    raw_providers = []

    # Skill category fuzzy match (skill/search -> category=search)
    skill_category = None
    if skill_name.startswith('skill/'):
        exact_exists = any(s.name == skill_name for n in nodes.values() for s in n.skills)
        if not exact_exists:
            skill_category = skill_name.split('/', 1)[1]
            log.info(f"[CATFUZZ] '{skill_name}' not exact, trying category='{skill_category}'")

    # Is this a virtual selector? (model/best, model/fast etc)
    is_virtual = skill_name in SELECTOR_CONFIGS

    for node in nodes.values():
        if node.node_id == exclude_node:
            continue
        matched = False
        if is_virtual:
            # Virtual selector: match any node that has at least one model/ capability
            if any(cap.name.startswith('model/') for cap in node.capabilities):
                raw_providers.append(node)
                matched = True
        else:
            for s in node.skills:
                if s.name == skill_name:
                    raw_providers.append(node)
                    matched = True
                    break
        if not matched and skill_category:
            for cap in node.capabilities:
                if cap.meta.get('category') == skill_category:
                    log.info(f"[CATMATCH] {node.name}: {cap.name} -> category '{skill_category}'")
                    raw_providers.append(node)
                    break

    if len(raw_providers) > 1:
        import random; random.shuffle(raw_providers)

    if skill_name.startswith('model/') and raw_providers:
        candidates = []
        for node in raw_providers:
            best_elo, best_meta = -1, {}
            for cap in node.capabilities:
                if not cap.name.startswith('model/'):
                    continue
                elo = cap.meta.get('arena_elo', 0)
                if elo == 0 and _CAPABILITY_DB_AVAILABLE:
                    base = extract_base_model(cap.name.replace('model/', ''))
                    db = get_model_info(base) if base else {}
                    elo = db.get('arena_elo', 0)
                    merged = {**db, **cap.meta}
                else:
                    merged = cap.meta
                if elo > best_elo:
                    best_elo, best_meta = elo, merged
            candidates.append((node, best_meta))
        candidates = resolve_virtual_selector(skill_name, candidates)
        log.info(f"[ROUTE] selector={skill_name} candidates={[(c[0].name,c[1].get('arena_elo','?'),c[1].get('cost_tier','?')) for c in candidates[:3]]} -> chosen={candidates[0][0].name if candidates else 'none'}")
        return [c[0] for c in candidates]

    return raw_providers


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


def get_network_capabilities(type_filter: str = "all") -> list[dict]:
    cap_map: dict[str, dict] = {}
    for node in nodes.values():
        for c in node.capabilities:
            if c.name not in cap_map:
                cap_map[c.name] = {"type": c.type, "name": c.name, "description": c.description, "providers": 0, "meta": c.meta}
            cap_map[c.name]["providers"] += 1
    result = list(cap_map.values())
    if type_filter != "all":
        result = [c for c in result if c["type"] == type_filter]
    return result


def _node_to_dict(node: Node) -> dict:
    """Convert a Node to a JSON-serializable dict."""
    return {
        "node_id": node.node_id,
        "name": node.name,
        "status": "online",
        "skills": [s.name for s in node.skills],
        "capabilities": [{"type": c.type, "name": c.name, "meta": c.meta} for c in node.capabilities],
        "connected_at": node.connected_at,
        "last_heartbeat": node.last_heartbeat,
        "connected_from": node.connected_from,
    }


def _paginate(items: list, page: int, limit: int) -> dict:
    """Return a paginated slice with metadata."""
    total = len(items)
    start = (page - 1) * limit
    end = start + limit
    return {
        "data": items[start:end],
        "total": total,
        "page": page,
        "limit": limit,
    }


def _json_response(data: dict, status: int = 200) -> web.Response:
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

    # Handle preflight
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
    all_skills = get_network_skills()
    total_capabilities = sum(s["providers"] for s in all_skills)

    return _json_response({
        "online_nodes": len(nodes),
        "total_skills": len(all_skills),
        "total_capabilities": total_capabilities,
        "total_models": sum(1 for s in all_skills if s["name"].startswith("model/")),
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


async def api_skills(request: web.Request) -> web.Response:
    try:
        page = max(1, int(request.rel_url.query.get("page", 1)))
        limit = min(100, max(1, int(request.rel_url.query.get("limit", 20))))
    except (ValueError, TypeError):
        return _error_response(400, "Invalid page or limit parameter")

    skill_list = get_network_skills()
    return _json_response(_paginate(skill_list, page, limit))



async def api_capabilities_handler(request: web.Request) -> web.Response:
    try:
        page = max(1, int(request.rel_url.query.get("page", 1)))
        limit = min(500, max(1, int(request.rel_url.query.get("limit", 200))))
        type_filter = request.rel_url.query.get("type", "all")
    except (ValueError, TypeError):
        return _error_response(400, "Invalid parameters")
    cap_list = get_network_capabilities(type_filter)
    paginated = _paginate(cap_list, page, limit)
    all_caps = get_network_capabilities("all")
    paginated["summary"] = {"total": len(all_caps), "models": sum(1 for c in all_caps if c["type"]=="model"), "skills": sum(1 for c in all_caps if c["type"]=="skill")}
    return _json_response(paginated)


async def api_capabilities_by_type(request: web.Request) -> web.Response:
    cap_type = request.match_info["cap_type"]
    if cap_type not in ("model", "skill", "compute", "storage"):
        return _error_response(400, f"Unknown type: {cap_type}")
    try:
        page = max(1, int(request.rel_url.query.get("page", 1)))
        limit = min(500, max(1, int(request.rel_url.query.get("limit", 200))))
    except (ValueError, TypeError):
        return _error_response(400, "Invalid parameters")
    cap_list = get_network_capabilities(cap_type)
    paginated = _paginate(cap_list, page, limit)
    paginated["summary"] = {"total": len(cap_list), cap_type: len(cap_list)}
    return _json_response(paginated)


async def api_capability_detail(request: web.Request) -> web.Response:
    cap_type = request.match_info["cap_type"]
    full_name = f"{cap_type}/{request.match_info['cap_name']}"
    providers, meta, desc = [], {}, ""
    for node in nodes.values():
        for c in node.capabilities:
            if c.name == full_name:
                providers.append({"node_id": node.node_id, "name": node.name, "status": "online"})
                if not meta:
                    meta, desc = c.meta, c.description
    if not providers:
        return _error_response(404, f"Not found: {full_name}")
    return _json_response({"type": cap_type, "name": full_name, "description": desc, "providers": providers, "meta": meta})

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
    # Attach call stats if available
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


async def api_task_status(request: web.Request) -> web.Response:
    """GET /api/task/{request_id} — check task result from cache."""
    request_id = request.match_info["request_id"]
    if request_id in result_cache:
        return _json_response(result_cache[request_id]["result"].get("data", {}))
    if request_id in pending_requests:
        return _json_response({"request_id": request_id, "status": "pending"})
    return _error_response(404, f"Task '{request_id}' not found or expired")


async def handle_404(request: web.Request) -> web.Response:
    return _error_response(404, f"Not found: {request.path}")


# ─── Message Handlers ──────────────────────────────────────────

async def handle_register(ws: WebSocketServerProtocol, node_id: str, data: dict):
    """Node comes online and registers its skills/capabilities."""
    capabilities = []
    for c in data.get("capabilities", []):
        cap_name = c.get("name", "")
        inferred_type = "model" if cap_name.startswith("model/") else "skill"
        capabilities.append(Skill(name=cap_name,
            description=c.get("meta", {}).get("description", "") or c.get("description", ""),
            input_schema=c.get("meta", {}).get("input_schema", {}),
            type=c.get("type", inferred_type), meta=c.get("meta", {})))
    legacy_names = {c.name for c in capabilities}
    skills = []
    for s in data.get("skills", []):
        s_name = s["name"] if isinstance(s, dict) else str(s)
        if s_name not in legacy_names and "skill/"+s_name not in legacy_names:
            skills.append(Skill(name=s_name,
                description=s.get("description","") if isinstance(s,dict) else "",
                input_schema=s.get("input_schema",{}) if isinstance(s,dict) else {},
                type="skill", meta={}))
    all_skills = capabilities + skills
    try:
        connected_from = ws.remote_address[0] if ws.remote_address else ""
    except Exception:
        connected_from = ""
    node = Node(node_id=node_id, name=data.get("name", node_id[:8]),
        ws=ws, skills=all_skills, capabilities=capabilities, connected_from=connected_from)
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
    skill_name = data.get("capability", "") or data.get("skill", "")
    skill_input = data.get("input", {})
    timeout = data.get("timeout_seconds", 180)

    log.info(f"📨 Request {request_id}: {node_id[:8]} wants '{skill_name}' (timeout={timeout}s)")

    # Auto-prefix bare names: "tavily" → "skill/tavily"
    if "/" not in skill_name:
        prefixed = f"skill/{skill_name}"
        log.info(f"[NORMALIZE] '{skill_name}' → '{prefixed}'")
        skill_name = prefixed

    # Server-side minimum timeout per skill — protects against old clients sending low values
    SKILL_MIN_TIMEOUTS = {
        "skill/arxiv-watcher": 300,
        "skill/seo-competitor-analysis": 300,
        "skill/agent": 240,
        "skill/daily-briefing": 240,
    }
    min_timeout = SKILL_MIN_TIMEOUTS.get(skill_name, 60)
    if timeout < min_timeout:
        log.info(f"[TIMEOUT] Raising {timeout}s → {min_timeout}s for {skill_name}")
        timeout = min_timeout

    # Find a provider (with virtual selector for model/ capabilities)
    providers = find_providers_with_selector(skill_name, exclude_node=node_id)
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

    # Shuffle providers for load balancing — we try them in order on failure
    import random
    random.shuffle(providers)

    # Store pending request
    pending = PendingRequest(
        request_id=request_id,
        caller_id=node_id,
        skill=skill_name,
        input=skill_input,
        timeout_seconds=timeout,
    )
    pending_requests[request_id] = pending
    _request_start_times[request_id] = (time.time(), skill_name)
    _caller_map[request_id] = node_id

    # Try each provider in order — fallback on gateway errors
    MAX_RETRIES = min(len(providers), 3)
    last_result = None

    for attempt, provider in enumerate(providers[:MAX_RETRIES]):
        log.info(f"🔀 Routing {request_id} → {provider.name} ({provider.node_id[:8]}...) [attempt {attempt+1}/{MAX_RETRIES}]")

        # Resolve virtual selector to actual capability name
        actual_skill = skill_name
        if skill_name in SELECTOR_CONFIGS:
            best_elo, best_cap = -1, None
            for cap in provider.capabilities:
                if cap.name.startswith('model/'):
                    elo = cap.meta.get('arena_elo', 0)
                    if elo == 0 and _CAPABILITY_DB_AVAILABLE:
                        base = extract_base_model(cap.name.replace('model/', ''))
                        db = get_model_info(base) if base else {}
                        elo = db.get('arena_elo', 0)
                    if elo > best_elo:
                        best_elo, best_cap = elo, cap.name
            if best_cap:
                actual_skill = best_cap
                log.info(f"[RESOLVE] {skill_name} → {actual_skill} (ELO {best_elo})")

        # Create a new future for this attempt
        loop = asyncio.get_event_loop()
        future = loop.create_future()
        request_futures[request_id] = future

        # Forward task to provider
        await send_json(provider.ws, {
            "type": "task",
            "data": {
                "request_id": request_id,
                "caller_id": node_id,
                "skill": actual_skill,
                "input": skill_input,
            },
        })

        # Wait for result
        try:
            result = await asyncio.wait_for(future, timeout=timeout)
            last_result = result

            # Check if it's a gateway/connection error — retry with next provider
            result_data = result.get("data", {}) if isinstance(result, dict) else {}
            error_msg = str(result_data.get("error", "")).lower()
            is_gateway_error = result_data.get("status") == "error" and any(
                kw in error_msg for kw in ["gateway", "cannot connect", "connection refused", "502", "503"]
            )

            if is_gateway_error and attempt < MAX_RETRIES - 1:
                log.warning(f"⚠️  Provider {provider.name} gateway error: {error_msg[:80]} — trying next provider")
                continue  # try next provider

            # Success or non-retryable error — send to caller
            await send_json(ws, result)
            result_cache[request_id] = {"result": result, "cached_at": time.time()}
            break

        except asyncio.TimeoutError:
            if attempt < MAX_RETRIES - 1:
                log.warning(f"⏰ Provider {provider.name} timed out — trying next provider")
                continue

            log.warning(f"⏰ Timeout on {request_id} — keeping pending for async callback")
            await send_json(ws, {
                "type": "error",
                "data": {
                    "request_id": request_id,
                    "code": "timeout",
                    "message": f"Provider did not respond within {timeout}s — result will be pushed when ready",
                },
            })
            break

    # Cleanup
    request_futures.pop(request_id, None)
    if request_id in result_cache:
        _request_start_times.pop(request_id, None)
        pending_requests.pop(request_id, None)
        _caller_map.pop(request_id, None)


async def handle_result(ws: WebSocketServerProtocol, node_id: str, data: dict):
    """Provider sends back a task result."""
    request_id = data.get("request_id", "")
    status = data.get("status", "")

    # "accepted" is an intermediate ack, not a final result — forward to caller
    # but do NOT resolve the future (we still need to wait for the real result)
    if status == "accepted":
        log.info(f"📋 Task {request_id} accepted by {node_id[:8]}")
        pending = pending_requests.get(request_id)
        if pending and pending.caller_id in nodes:
            caller_node = nodes[pending.caller_id]
            await send_json(caller_node.ws, {
                "type": "result",
                "data": data,
            })
        return

    log.info(f"✅ Result for {request_id} from {node_id[:8]}")

    # Record call stats
    if request_id in _request_start_times:
        start_time, skill_name = _request_start_times[request_id]
        duration_ms = (time.time() - start_time) * 1000.0
        record_call(duration_ms)
        record_skill_call(skill_name, duration_ms)
        _request_start_times.pop(request_id, None)

    result_msg = {"type": "result", "data": data}

    # Cache the result
    result_cache[request_id] = {"result": result_msg, "cached_at": time.time()}

    future = request_futures.get(request_id)
    if future and not future.done():
        # Normal path — caller is still waiting
        future.set_result(result_msg)
    else:
        # Late result — future already timed out, push via async callback
        caller_id = _caller_map.get(request_id)
        if caller_id and caller_id in nodes:
            caller_node = nodes[caller_id]
            log.info(f"📬 Late result for {request_id} — async callback to {caller_node.name}")
            await send_json(caller_node.ws, {
                "type": "late_result",
                "data": data,
            })
        else:
            log.info(f"📬 Late result for {request_id} — caller offline, cached only")

    # Cleanup
    pending_requests.pop(request_id, None)
    _caller_map.pop(request_id, None)


async def handle_progress(ws: WebSocketServerProtocol, node_id: str, data: dict):
    """Provider sends progress update — forward to caller."""
    request_id = data.get("request_id", "")
    pending = pending_requests.get(request_id)
    caller_id = _caller_map.get(request_id)
    if caller_id and caller_id in nodes:
        caller_node = nodes[caller_id]
        await send_json(caller_node.ws, {
            "type": "progress",
            "data": data,
        })
    elif pending and pending.caller_id in nodes:
        caller_node = nodes[pending.caller_id]
        await send_json(caller_node.ws, {
            "type": "progress",
            "data": data,
        })


async def handle_task_status(ws: WebSocketServerProtocol, node_id: str, data: dict):
    """Caller queries status of a request — check cache or pending."""
    request_id = data.get("request_id", "")

    # Check cache first
    if request_id in result_cache:
        cached = result_cache[request_id]
        await send_json(ws, cached["result"])
        return

    # Check if still pending
    if request_id in pending_requests:
        await send_json(ws, {
            "type": "task_status",
            "data": {"request_id": request_id, "status": "pending"},
        })
        return

    await send_json(ws, {
        "type": "task_status",
        "data": {"request_id": request_id, "status": "unknown"},
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

            elif msg_type == "progress":
                await handle_progress(ws, msg_node_id, data)

            elif msg_type == "task_status":
                await handle_task_status(ws, msg_node_id, data)

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


# ─── HTTP Server ──────────────────────────────────────────────

async def start_http_server(host: str = "127.0.0.1", port: int = 8766):
    """Start the aiohttp HTTP API server."""
    app = web.Application(middlewares=[cors_middleware])

    app.router.add_get("/api/health", api_health)
    app.router.add_get("/api/stats", api_stats)
    app.router.add_get("/api/nodes", api_nodes)
    app.router.add_get("/api/nodes/{node_id}", api_node_detail)
    app.router.add_get("/api/skills", api_skills)
    app.router.add_get("/api/capabilities", api_capabilities_handler)
    app.router.add_get("/api/capabilities/{cap_type}", api_capabilities_by_type)
    app.router.add_get("/api/capabilities/{cap_type}/{cap_name}", api_capability_detail)
    app.router.add_get("/api/skills/{name}", api_skill_detail)
    app.router.add_get("/api/task/{request_id}", api_task_status)
    app.router.add_route("*", "/{path_info:.*}", handle_404)

    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, host, port)
    await site.start()
    log.info(f"🌐 HTTP API listening on http://{host}:{port}")
    return runner


# ─── Main ─────────────────────────────────────────────────────

async def main(host: str = "0.0.0.0", port: int = 8765,
               http_host: str = "127.0.0.1", http_port: int = 8766):
    log.info(f"🚌 CatBus Server starting on ws://{host}:{port}")

    # Start reaper and cache cleanup
    asyncio.create_task(reap_stale_nodes())
    asyncio.create_task(_cleanup_result_cache())

    # Start HTTP API server
    http_runner = await start_http_server(http_host, http_port)

    # Start WebSocket server and run forever
    async with websockets.serve(handle_connection, host, port):
        log.info("🟢 Ready. Waiting for nodes...")
        try:
            await asyncio.Future()  # run forever
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
