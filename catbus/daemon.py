"""
CatBus Daemon — 本地常驻进程

模型探测时机：
  1. Daemon 启动时 — 完整三层探测，结果写入 REGISTER
  2. 每 5 分钟 — 轻探测 GET /v1/models（与 skill 扫描同频）
  3. model/ 任务失败时 — 轻探测确认模型是否还在
  4. POST /detect — Dashboard 手动触发完整探测
"""

import asyncio
import json
import logging
import os
import time
import uuid

import websockets
from aiohttp import web

from .config import Config, CapabilityConfig
from .executor import Executor

log = logging.getLogger("catbus.daemon")

# 轻探测和 skill 扫描统一间隔：5 分钟
SCAN_INTERVAL = 300


class CatBusDaemon:
    def __init__(self, config: Config):
        self.config = config
        self.node_id = config.node_id
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

        # Pending outbound requests
        self._pending: dict[str, asyncio.Future] = {}

        # Async task store (provider-side: tasks we're executing)
        self._async_tasks: dict[str, dict] = {}
        # Received async results (caller-side: results from relay)
        self._received_task_results: dict[str, dict] = {}

        # 探测到的模型（动态更新）
        self._detected_models: list[CapabilityConfig] = []
        self._last_model_detect: float = 0

    # ─── Model Detection ───────────────────────────────────────

    async def _detect_models_full(self):
        """
        完整三层探测（启动时调用）。
        结果合并到 config.capabilities 并更新 executor。
        """
        try:
            from .detector import detect_models
            results = await detect_models()
        except Exception as e:
            log.warning(f"⚠️  Model detection failed: {e}")
            return

        new_caps = []
        for r in results:
            if r.base_name.startswith("unknown-"):
                log.info(f"  📊 Fingerprint only: tier={r.cost_tier}")
                continue

            cap = CapabilityConfig(
                type="model",
                name=f"model/{r.base_name}",
                handler="gateway:default",
                meta={
                    "provider": r.provider,
                    "cost_tier": r.cost_tier,
                    "strengths": r.strengths,
                    "arena_elo": r.arena_elo,
                    "detected": True,
                    "detection_method": r.method,
                    "detection_confidence": r.confidence,
                },
            )
            new_caps.append(cap)
            log.info(f"  🧠 Detected: {cap.name} ({r.method}, {r.confidence})")

        self._detected_models = new_caps
        self._last_model_detect = time.time()
        self._merge_detected_models()

    async def _detect_models_light(self) -> bool:
        """
        轻探测：只跑 Layer 1 (GET /v1/models)，零 token 消耗。
        返回 True 如果模型列表有变化。
        """
        try:
            from .detector import _probe_gateway_models
            from .gateway import _load_base_url
            from .capability_db import extract_base_model, get_model_info

            base_url = _load_base_url()
            api_models = await _probe_gateway_models(base_url)
        except Exception as e:
            log.debug(f"Light detect failed: {e}")
            return False

        if not api_models:
            return False

        new_names = set()
        new_caps = []
        for raw_name in api_models:
            base = extract_base_model(raw_name)
            if base:
                full_name = f"model/{base}"
                new_names.add(full_name)
                info = get_model_info(base)
                new_caps.append(CapabilityConfig(
                    type="model",
                    name=full_name,
                    handler="gateway:default",
                    meta={
                        "provider": info.get("provider", ""),
                        "cost_tier": info.get("cost_tier", "medium"),
                        "strengths": info.get("strengths", ["general"]),
                        "arena_elo": info.get("arena_elo", 0),
                        "detected": True,
                        "detection_method": "gateway_api",
                    },
                ))

        old_names = {c.name for c in self._detected_models}
        changed = new_names != old_names

        if changed:
            added = new_names - old_names
            removed = old_names - new_names
            if added:
                log.info(f"  🆕 Models added: {added}")
            if removed:
                log.info(f"  🗑️  Models removed: {removed}")
            self._detected_models = new_caps
            self._merge_detected_models()

        self._last_model_detect = time.time()
        return changed

    def _merge_detected_models(self):
        """
        将探测到的模型合并到 config.capabilities 和 executor。
        手动配置的 model/ 优先，探测结果只追加不覆盖。
        """
        manual_models = {
            c.name for c in self.config.capabilities
            if c.type == "model" and not c.meta.get("detected")
        }

        kept = [
            c for c in self.config.capabilities
            if c.type != "model" or c.name in manual_models
        ]
        for cap in self._detected_models:
            if cap.name not in manual_models:
                kept.append(cap)

        self.config.capabilities = kept
        self.executor = Executor(
            capabilities=self.config.capabilities,
            skills=self.config.skills,
        )

    # ─── WebSocket Client ──────────────────────────────────────

    async def ws_connect(self):
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
                log.warning(f"⚠️  Unexpected error: {e}. Retrying in {retry_delay}s...")
                await asyncio.sleep(retry_delay)
                retry_delay = min(retry_delay * 2, 60)

    async def _send_register(self):
        caps_data = [cap.to_register_dict() for cap in self.config.capabilities]

        skills_data = []
        for cap in self.config.capabilities:
            if cap.type == "skill":
                skills_data.append({
                    "name": cap.short_name,
                    "description": cap.meta.get("description", ""),
                    "input_schema": cap.meta.get("input_schema", {}),
                })
        for s in self.config.skills:
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
                "skills": skills_data,
                "limits": self.config.limits,
            },
        })

        cap_names = [c.name for c in self.config.capabilities]
        log.info(f"📋 Registered: {cap_names}")

    def _get_current_skill_dirs(self):
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
        """
        每 30s 心跳。
        每 5 分钟同时扫描 skill 目录变更 + 模型轻探测。
        """
        last_scan = time.time()
        last_skill_dirs = self._get_current_skill_dirs()

        while True:
            await asyncio.sleep(30)

            ok = await self._ws_send({'type': 'heartbeat', 'node_id': self.node_id})
            if not ok:
                log.warning("💔 Heartbeat send failed — closing for reconnect")
                if self.ws:
                    try:
                        await self.ws.close()
                    except Exception:
                        pass
                return

            now = time.time()
            if now - last_scan < SCAN_INTERVAL:
                continue

            # ── 每 5 分钟：skill + model 同步扫描 ──
            last_scan = now
            need_reregister = False

            # Skill 目录变更
            current_dirs = self._get_current_skill_dirs()
            if current_dirs != last_skill_dirs:
                log.info('🔄 Skill change detected')
                last_skill_dirs = current_dirs
                need_reregister = True

            # 模型轻探测
            model_changed = await self._detect_models_light()
            if model_changed:
                need_reregister = True

            if need_reregister:
                log.info('📡 Re-registering with relay...')
                await self._send_register()

    async def _ws_listen(self):
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
            elif msg_type == "task_status_result":
                task_id = data.get("task_id", "")
                query_key = f"_task_status_{task_id}"
                future = self._pending.get(query_key)
                if future and not future.done():
                    future.set_result(data)
            elif msg_type == "task_status_query":
                # Relay asking us (as provider) for task status
                task_id = data.get("task_id", "")
                task_info = self._async_tasks.get(task_id, {"status": "not_found", "task_id": task_id})
                await self._ws_send({
                    "type": "task_status_result",
                    "node_id": self.node_id,
                    "data": task_info,
                })

    async def _handle_task(self, data: dict):
        request_id = data.get("request_id", "")
        capability_name = data.get("capability", "") or data.get("skill", "")
        input_data = data.get("input", {})

        log.info(f"📥 Task received: {capability_name} (req: {request_id})")

        task_id = request_id
        self._async_tasks[task_id] = {
            "status": "running",
            "task_id": task_id,
            "capability": capability_name,
            "created_at": time.time(),
        }

        # Immediately acknowledge
        await self._ws_send({
            "type": "result",
            "node_id": self.node_id,
            "data": {
                "request_id": request_id,
                "status": "accepted",
                "task_id": task_id,
            },
        })
        log.info(f"📤 Task accepted: {capability_name} (task: {task_id})")

        # Execute in background
        asyncio.create_task(self._execute_task_bg(task_id, request_id, capability_name, input_data))

    async def _execute_task_bg(self, task_id: str, request_id: str,
                                capability_name: str, input_data: dict):
        created_at = self._async_tasks.get(task_id, {}).get("created_at", time.time())
        try:
            result = await self.executor.execute(capability_name, input_data)
            log.info(f"📤 Task done: {capability_name} — {result.status} ({result.duration_ms}ms)")

            self._async_tasks[task_id] = {
                "status": result.status,
                "task_id": task_id,
                "output": result.output,
                "error": result.error,
                "duration_ms": result.duration_ms,
                "created_at": created_at,
                "completed_at": time.time(),
            }

            # Send final result via WS
            await self._ws_send({
                "type": "result",
                "node_id": self.node_id,
                "data": {
                    "request_id": request_id,
                    "task_id": task_id,
                    "status": result.status,
                    "output": result.output,
                    "duration_ms": result.duration_ms,
                    "error": result.error,
                },
            })

            # model/ 任务 Gateway 报错 → 轻探测确认模型是否还在
            if result.status == "error" and capability_name.startswith("model/"):
                error_msg = result.error.lower()
                if any(kw in error_msg for kw in ["gateway", "502", "503", "timeout", "connection"]):
                    log.warning(f"⚠️  Model task failed, triggering re-detect...")
                    changed = await self._detect_models_light()
                    if changed:
                        await self._send_register()

        except Exception as e:
            log.error(f"❌ Task execution failed: {e}")
            self._async_tasks[task_id] = {
                "status": "failed",
                "task_id": task_id,
                "error": str(e),
                "created_at": created_at,
                "completed_at": time.time(),
            }
            await self._ws_send({
                "type": "result",
                "node_id": self.node_id,
                "data": {
                    "request_id": request_id,
                    "task_id": task_id,
                    "status": "failed",
                    "error": str(e),
                },
            })

    def _handle_result(self, data: dict):
        request_id = data.get("request_id", "")
        task_id = data.get("task_id", "")
        future = self._pending.get(request_id)
        if future and not future.done():
            future.set_result(data)
        elif task_id and data.get("status") not in ("accepted",):
            # Final async result — cache for CLI polling
            self._received_task_results[task_id] = data

    def _handle_error(self, data: dict):
        request_id = data.get("request_id", "")
        future = self._pending.get(request_id)
        if future and not future.done():
            future.set_result(data)

    def _handle_skills_list(self, data: dict):
        future = self._pending.get("_query_skills")
        if future and not future.done():
            future.set_result(data)

    async def _ws_send(self, msg: dict) -> bool:
        if self.ws:
            try:
                await asyncio.wait_for(self.ws.send(json.dumps(msg)), timeout=10)
                return True
            except asyncio.TimeoutError:
                self.connected = False
                return False
            except websockets.exceptions.ConnectionClosed:
                self.connected = False
                return False
            except Exception:
                self.connected = False
                return False
        return False

    # ─── Outbound Requests ─────────────────────────────────────

    async def call_remote(self, capability: str, input_data: dict, timeout: int = 30) -> dict:
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
                "skill": capability,
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
        await self._ws_send({"type": "query_skills", "node_id": self.node_id})
        try:
            result = await asyncio.wait_for(future, timeout=timeout)
            return result.get("skills", [])
        except asyncio.TimeoutError:
            return []
        finally:
            self._pending.pop("_query_skills", None)

    # ─── Async Task Helpers ───────────────────────────────────

    async def query_task_status(self, task_id: str, timeout: int = 10) -> dict:
        """Query task status: check local caches first, then ask relay via WS."""
        if task_id in self._received_task_results:
            return self._received_task_results[task_id]
        if task_id in self._async_tasks:
            return self._async_tasks[task_id]

        if not self.connected:
            return {"status": "unknown", "task_id": task_id, "error": "Not connected"}

        query_key = f"_task_status_{task_id}"
        loop = asyncio.get_event_loop()
        future = loop.create_future()
        self._pending[query_key] = future

        await self._ws_send({
            "type": "task_status_query",
            "node_id": self.node_id,
            "data": {"task_id": task_id},
        })

        try:
            result = await asyncio.wait_for(future, timeout=timeout)
            return result
        except asyncio.TimeoutError:
            return {"status": "unknown", "task_id": task_id, "error": "Timeout querying relay"}
        finally:
            self._pending.pop(query_key, None)

    async def _cleanup_async_tasks(self):
        """Every 10 minutes, remove tasks completed over 1 hour ago."""
        while True:
            await asyncio.sleep(600)
            now = time.time()
            expired = [tid for tid, t in self._async_tasks.items()
                       if t.get("completed_at") and now - t["completed_at"] > 3600]
            for tid in expired:
                del self._async_tasks[tid]
            expired_recv = [tid for tid, t in self._received_task_results.items()
                           if t.get("completed_at") and now - t.get("completed_at", now) > 3600]
            for tid in expired_recv:
                del self._received_task_results[tid]
            if expired or expired_recv:
                log.info(f"🧹 Cleaned {len(expired)} provider tasks, {len(expired_recv)} received results")

    # ─── HTTP API ──────────────────────────────────────────────

    def create_http_app(self) -> web.Application:
        app = web.Application()
        app.router.add_get("/health", self._http_health)
        app.router.add_get("/status", self._http_status)
        app.router.add_get("/network/skills", self._http_network_skills)
        app.router.add_post("/request", self._http_request)
        app.router.add_post("/task/status", self._http_task_status)
        app.router.add_post("/detect", self._http_detect)
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
            "my_capabilities": [c.name for c in self.config.capabilities],
            "my_skills": [s.name for s in self.config.skills]
                         + [c.short_name for c in self.config.capabilities if c.type == "skill"],
            "detected_models": [c.name for c in self._detected_models],
            "last_model_detect": self._last_model_detect,
            "uptime_seconds": int(time.time() - self.start_time),
        })

    async def _http_network_skills(self, request: web.Request) -> web.Response:
        skills = await self.query_network_skills()
        return web.json_response({"skills": skills})

    async def _http_request(self, request: web.Request) -> web.Response:
        try:
            body = await request.json()
        except json.JSONDecodeError:
            return web.json_response({"status": "error", "error": "Invalid JSON"}, status=400)

        capability = body.get("capability", "") or body.get("skill", "")
        input_data = body.get("input", {})
        timeout = body.get("timeout", 30)

        if not capability and "task" in body:
            capability = "agent"
            input_data = {"task": body["task"]}
        if not capability:
            return web.json_response(
                {"status": "error", "error": "Missing 'capability' or 'skill' field"}, status=400)

        result = await self.call_remote(capability, input_data, timeout)
        return web.json_response(result)

    async def _http_task_status(self, request: web.Request) -> web.Response:
        """POST /task/status — query async task status."""
        try:
            body = await request.json()
        except json.JSONDecodeError:
            return web.json_response({"status": "error", "error": "Invalid JSON"}, status=400)

        task_id = body.get("task_id", "")
        if not task_id:
            return web.json_response({"status": "error", "error": "Missing task_id"}, status=400)

        result = await self.query_task_status(task_id)
        return web.json_response(result)

    async def _http_detect(self, request: web.Request) -> web.Response:
        """POST /detect — 手动触发完整探测。"""
        log.info("🔍 Manual detect triggered via HTTP")
        await self._detect_models_full()
        await self._send_register()
        return web.json_response({
            "ok": True,
            "detected": [
                {"name": c.name, "method": c.meta.get("detection_method", "")}
                for c in self._detected_models
            ],
        })

    # ─── Run ───────────────────────────────────────────────────

    async def run(self):
        log.info(f"🚌 CatBus Daemon starting...")
        log.info(f"   Node ID: {self.node_id}")
        log.info(f"   Server:  {self.config.server}")
        log.info(f"   HTTP:    http://localhost:{self.config.port}")

        # 启动时完整探测
        log.info("🔍 Startup model detection...")
        await self._detect_models_full()

        cap_names = [c.name for c in self.config.capabilities]
        log.info(f"   Capabilities: {cap_names}")

        app = self.create_http_app()
        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, "127.0.0.1", self.config.port)
        await site.start()
        log.info(f"🌐 HTTP API listening on http://localhost:{self.config.port}")

        # Start async task cleanup loop
        asyncio.create_task(self._cleanup_async_tasks())

        await self.ws_connect()
