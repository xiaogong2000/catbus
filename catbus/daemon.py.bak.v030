"""
CatBus Daemon — 本地常驻进程

一头连 CatBus Server（WebSocket），一头对本地暴露 HTTP API（给 Skill 调）。
同时作为 Caller（发任务）和 Provider（接任务）。

Capability 体系：REGISTER 消息携带 capabilities 列表（type/name 格式），
同时保留 skills 字段兼容老版 relay。
"""

import asyncio
import json
import logging
import os
import time
import uuid

import websockets
from aiohttp import web

from .config import Config
from .executor import Executor

log = logging.getLogger("catbus.daemon")


class CatBusDaemon:
    def __init__(self, config: Config):
        self.config = config
        self.node_id = config.node_id
        # 新版 Executor：优先使用 capabilities，fallback 到 skills
        self.executor = Executor(
            capabilities=config.capabilities,
            skills=config.skills,
        )

        # WebSocket state
        self.ws = None
        self.connected = False
        self.online_nodes = 0
        self.available_skills = 0
        self.start_time = time.time()

        # Pending outbound requests (waiting for result from network)
        self._pending: dict[str, asyncio.Future] = {}

    # ─── WebSocket Client ──────────────────────────────────────

    async def ws_connect(self):
        """Connect to CatBus Server with auto-reconnect."""
        retry_delay = 5
        while True:
            try:
                log.info(f"🔌 Connecting to {self.config.server}...")
                async with websockets.connect(
                    self.config.server,
                    ping_interval=30,
                    ping_timeout=10,
                ) as ws:
                    self.ws = ws
                    self.connected = True
                    retry_delay = 5
                    log.info("🟢 Connected to CatBus Server")

                    await self._send_register()

                    heartbeat_task = asyncio.create_task(self._heartbeat_loop())

                    try:
                        await self._ws_listen()
                    finally:
                        heartbeat_task.cancel()
                        try:
                            await heartbeat_task
                        except asyncio.CancelledError:
                            pass

            except (websockets.exceptions.ConnectionClosed,
                    websockets.exceptions.WebSocketException,
                    ConnectionRefusedError, OSError) as e:
                self.connected = False
                self.ws = None
                log.warning(f"⚠️  Connection lost: {e}. Retrying in {retry_delay}s...")
                await asyncio.sleep(retry_delay)
                retry_delay = min(retry_delay * 2, 60)
            except Exception as e:
                self.connected = False
                self.ws = None
                log.warning(f"⚠️  Unexpected error in ws_connect: {e}. Retrying in {retry_delay}s...")
                await asyncio.sleep(retry_delay)
                retry_delay = min(retry_delay * 2, 60)

    async def _send_register(self):
        """Send REGISTER message to server with capabilities + skills (backward compat)."""
        # 新格式：capabilities 列表
        caps_data = [cap.to_register_dict() for cap in self.config.capabilities]

        # 向后兼容：也发 skills 列表（老版 relay 只认 skills）
        skills_data = []
        for cap in self.config.capabilities:
            if cap.type == "skill":
                skills_data.append({
                    "name": cap.short_name,
                    "description": cap.meta.get("description", ""),
                    "input_schema": cap.meta.get("input_schema", {}),
                })
        # 老格式 skills 也加入
        for s in self.config.skills:
            # 避免重复
            if not any(d["name"] == s.name for d in skills_data):
                skills_data.append({
                    "name": s.name,
                    "description": s.description,
                    "input_schema": s.input_schema,
                })

        await self._ws_send({
            "type": "register",
            "node_id": self.node_id,
            "data": {
                "name": self.config.node_name or f"node-{self.node_id[:6]}",
                "capabilities": caps_data,
                "skills": skills_data,   # 向后兼容
                "limits": self.config.limits,
            },
        })

        cap_names = [c.name for c in self.config.capabilities]
        log.info(f"📋 Registered capabilities: {cap_names}")

    def _get_current_capabilities(self):
        """Return a sorted tuple of installed skill names."""
        skills_dir = os.path.expanduser('~/.openclaw/workspace/skills')
        try:
            names = [
                d for d in os.listdir(skills_dir)
                if os.path.isdir(os.path.join(skills_dir, d))
            ]
        except FileNotFoundError:
            names = []
        return tuple(sorted(names))

    async def _heartbeat_loop(self):
        """Send heartbeat every 30 seconds; re-register on skill change every 5 minutes."""
        scan_interval = 300
        last_scan = time.time()
        last_capabilities = self._get_current_capabilities()

        while True:
            await asyncio.sleep(30)

            ok = await self._ws_send({'type': 'heartbeat', 'node_id': self.node_id})
            if not ok:
                log.warning("💔 Heartbeat send failed — closing stale connection to trigger reconnect")
                if self.ws:
                    try:
                        await self.ws.close()
                    except Exception:
                        pass
                return

            if time.time() - last_scan > scan_interval:
                last_scan = time.time()
                current = self._get_current_capabilities()
                if current != last_capabilities:
                    log.info('Skill change detected, re-registering...')
                    last_capabilities = current
                    await self._send_register()

    async def _ws_listen(self):
        """Listen for incoming WebSocket messages."""
        async for raw in self.ws:
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue

            msg_type = msg.get("type", "")
            data = msg.get("data", {})

            if msg_type == "register_ack":
                self.online_nodes = data.get("online_nodes", 0)
                self.available_skills = data.get("available_skills", 0)
                log.info(f"📡 Network: {self.online_nodes} nodes, {self.available_skills} skills")

            elif msg_type == "heartbeat_ack":
                self.online_nodes = data.get("online_nodes", 0)
                self.available_skills = data.get("available_skills", 0)

            elif msg_type == "task":
                asyncio.create_task(self._handle_task(data))

            elif msg_type == "result":
                self._handle_result(data)

            elif msg_type == "error":
                self._handle_error(data)

            elif msg_type == "skills_list":
                self._handle_skills_list(data)

    async def _handle_task(self, data: dict):
        """Execute a task received from the network."""
        request_id = data.get("request_id", "")
        # 新格式用 capability，老格式用 skill
        capability_name = data.get("capability", "") or data.get("skill", "")
        input_data = data.get("input", {})

        log.info(f"📥 Task received: {capability_name} (req: {request_id})")

        result = await self.executor.execute(capability_name, input_data)

        log.info(f"📤 Task done: {capability_name} — {result.status} ({result.duration_ms}ms)")

        await self._ws_send({
            "type": "result",
            "node_id": self.node_id,
            "data": {
                "request_id": request_id,
                "status": result.status,
                "output": result.output,
                "duration_ms": result.duration_ms,
                "error": result.error,
            },
        })

    def _handle_result(self, data: dict):
        request_id = data.get("request_id", "")
        future = self._pending.get(request_id)
        if future and not future.done():
            future.set_result(data)

    def _handle_error(self, data: dict):
        request_id = data.get("request_id", "")
        future = self._pending.get(request_id)
        if future and not future.done():
            future.set_result(data)

    def _handle_skills_list(self, data: dict):
        request_id = "_query_skills"
        future = self._pending.get(request_id)
        if future and not future.done():
            future.set_result(data)

    async def _ws_send(self, msg: dict) -> bool:
        if self.ws:
            try:
                await asyncio.wait_for(self.ws.send(json.dumps(msg)), timeout=10)
                return True
            except asyncio.TimeoutError:
                log.warning("⚠️  ws_send timed out (stale connection?)")
                self.connected = False
                return False
            except websockets.exceptions.ConnectionClosed as e:
                log.warning(f"⚠️  ws_send failed (connection closed): {e}")
                self.connected = False
                return False
            except Exception as e:
                log.warning(f"⚠️  ws_send unexpected error: {e}")
                self.connected = False
                return False
        return False

    # ─── Outbound Requests (Caller role) ───────────────────────

    async def call_remote(self, capability: str, input_data: dict, timeout: int = 30) -> dict:
        """
        Send a REQUEST to the network and wait for RESULT.

        capability 支持：
          - "model/claude-sonnet-4"（新格式）
          - "skill/tavily"（新格式）
          - "echo"（老格式 bare name，relay 会尝试兼容）
        """
        if not self.connected:
            return {"status": "error", "error": "Not connected to CatBus Server"}

        request_id = f"req_{uuid.uuid4().hex[:8]}"

        loop = asyncio.get_event_loop()
        future = loop.create_future()
        self._pending[request_id] = future

        await self._ws_send({
            "type": "request",
            "node_id": self.node_id,
            "data": {
                "request_id": request_id,
                "capability": capability,
                "skill": capability,   # 向后兼容老版 relay
                "input": input_data,
                "timeout_seconds": timeout,
            },
        })

        try:
            result = await asyncio.wait_for(future, timeout=timeout)
            return result
        except asyncio.TimeoutError:
            return {"status": "error", "error": f"Timeout after {timeout}s"}
        finally:
            self._pending.pop(request_id, None)

    async def query_network_skills(self, timeout: int = 5) -> list[dict]:
        if not self.connected:
            return []

        future = asyncio.get_event_loop().create_future()
        self._pending["_query_skills"] = future

        await self._ws_send({
            "type": "query_skills",
            "node_id": self.node_id,
        })

        try:
            result = await asyncio.wait_for(future, timeout=timeout)
            return result.get("skills", [])
        except asyncio.TimeoutError:
            return []
        finally:
            self._pending.pop("_query_skills", None)

    # ─── HTTP API (for OpenClaw Skill to call) ─────────────────

    def create_http_app(self) -> web.Application:
        app = web.Application()
        app.router.add_get("/health", self._http_health)
        app.router.add_get("/status", self._http_status)
        app.router.add_get("/network/skills", self._http_network_skills)
        app.router.add_post("/request", self._http_request)
        return app

    async def _http_health(self, request: web.Request) -> web.Response:
        return web.json_response({"ok": True})

    async def _http_status(self, request: web.Request) -> web.Response:
        return web.json_response({
            "status": "connected" if self.connected else "disconnected",
            "node_id": self.node_id,
            "node_name": self.config.node_name,
            "server": self.config.server,
            "online_nodes": self.online_nodes,
            "available_skills": self.available_skills,
            # 新格式
            "my_capabilities": [c.name for c in self.config.capabilities],
            # 向后兼容
            "my_skills": [s.name for s in self.config.skills]
                         + [c.short_name for c in self.config.capabilities if c.type == "skill"],
            "uptime_seconds": int(time.time() - self.start_time),
        })

    async def _http_network_skills(self, request: web.Request) -> web.Response:
        skills = await self.query_network_skills()
        return web.json_response({"skills": skills})

    async def _http_request(self, request: web.Request) -> web.Response:
        try:
            body = await request.json()
        except json.JSONDecodeError:
            return web.json_response(
                {"status": "error", "error": "Invalid JSON"},
                status=400,
            )

        # 新格式用 capability，老格式用 skill/task
        capability = body.get("capability", "") or body.get("skill", "")
        input_data = body.get("input", {})
        timeout = body.get("timeout", 30)

        # 兼容 SKILL.md 的极简 {"task": "xxx"} 格式
        if not capability and "task" in body:
            capability = "agent"
            input_data = {"task": body["task"]}

        if not capability:
            return web.json_response(
                {"status": "error", "error": "Missing 'capability' or 'skill' field"},
                status=400,
            )

        result = await self.call_remote(capability, input_data, timeout)
        return web.json_response(result)

    # ─── Run ───────────────────────────────────────────────────

    async def run(self):
        log.info(f"🚌 CatBus Daemon starting...")
        log.info(f"   Node ID: {self.node_id}")
        log.info(f"   Server:  {self.config.server}")
        log.info(f"   HTTP:    http://localhost:{self.config.port}")
        cap_names = [c.name for c in self.config.capabilities]
        log.info(f"   Capabilities: {cap_names}")

        app = self.create_http_app()
        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, "127.0.0.1", self.config.port)
        await site.start()
        log.info(f"🌐 HTTP API listening on http://localhost:{self.config.port}")

        await self.ws_connect()
