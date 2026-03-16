"""
CatBus ↔ OpenClaw Gateway 桥接

GatewayClient：
  - Token 三层 fallback：env OPENCLAW_GATEWAY_TOKEN → ~/.openclaw/openclaw.json → ~/.catbus/config.yaml
  - health_check()：GET / 端点
  - execute(task, model, timeout)：POST /v1/chat/completions，返回 {ok, summary, output}
"""

import json
import logging
import os
from pathlib import Path
from typing import Any

import aiohttp
import yaml

log = logging.getLogger("catbus.gateway")

_DEFAULT_BASE_URL = "http://localhost:18789"


def _load_token() -> str | None:
    """三层 fallback 读取 Gateway token。"""
    # 1. 环境变量
    token = os.environ.get("OPENCLAW_GATEWAY_TOKEN")
    if token:
        log.debug("Gateway token from env OPENCLAW_GATEWAY_TOKEN")
        return token

    # 2. ~/.openclaw/openclaw.json
    openclaw_json = Path.home() / ".openclaw" / "openclaw.json"
    if openclaw_json.exists():
        try:
            data = json.loads(openclaw_json.read_text())
            # 先尝试顶层字段（旧格式），再尝试嵌套路径 gateway.auth.token（新格式）
            token = (
                data.get("gatewayToken")
                or data.get("gateway_token")
                or data.get("token")
                or data.get("gateway", {}).get("auth", {}).get("token")
            )
            if token:
                log.debug("Gateway token from ~/.openclaw/openclaw.json")
                return token
        except Exception as e:
            log.warning(f"Failed to read openclaw.json: {e}")

    # 3. ~/.catbus/config.yaml
    catbus_yaml = Path.home() / ".catbus" / "config.yaml"
    if catbus_yaml.exists():
        try:
            raw = yaml.safe_load(catbus_yaml.read_text()) or {}
            gw = raw.get("gateway") or {}
            token = gw.get("token")
            if token:
                log.debug("Gateway token from ~/.catbus/config.yaml")
                return token
        except Exception as e:
            log.warning(f"Failed to read catbus config.yaml: {e}")

    return None


def _load_base_url() -> str:
    """从 env 或 ~/.catbus/config.yaml 读取 Gateway base URL。"""
    url = os.environ.get("OPENCLAW_GATEWAY_URL")
    if url:
        return url.rstrip("/")

    catbus_yaml = Path.home() / ".catbus" / "config.yaml"
    if catbus_yaml.exists():
        try:
            raw = yaml.safe_load(catbus_yaml.read_text()) or {}
            gw = raw.get("gateway") or {}
            url = gw.get("url")
            if url:
                return url.rstrip("/")
        except Exception:
            pass

    return _DEFAULT_BASE_URL


class GatewayClient:
    """与 OpenClaw Gateway 通信的异步客户端。"""

    def __init__(self, base_url: str | None = None, token: str | None = None):
        self.base_url = (base_url or _load_base_url()).rstrip("/")
        self.token = token or _load_token()

    def _headers(self) -> dict:
        h = {"Content-Type": "application/json"}
        if self.token:
            h["Authorization"] = f"Bearer {self.token}"
        return h

    async def health_check(self) -> bool:
        """
        GET / 健康检查。
        返回 True 表示 Gateway 在线，False 表示不可达或出错。
        注意：不用 /v1/models，那个返回 HTML。
        """
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.base_url}/",
                    headers=self._headers(),
                    timeout=aiohttp.ClientTimeout(total=10),
                ) as resp:
                    log.debug(f"Gateway health check: {resp.status}")
                    return resp.status < 500
        except Exception as e:
            log.warning(f"Gateway health check failed: {e}")
            return False

    async def execute(
        self,
        task: str,
        model: str = "default",
        timeout: int = 120,
    ) -> dict[str, Any]:
        """
        POST /v1/chat/completions 执行任务。

        返回：
          {ok: bool, summary: str, output: str}
        """
        payload: dict[str, Any] = {
            "messages": [{"role": "user", "content": task}],
            "stream": False,
        }
        if model and model != "default":
            payload["model"] = model

        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.base_url}/v1/chat/completions",
                    headers=self._headers(),
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=timeout),
                ) as resp:
                    if resp.status != 200:
                        body = await resp.text()
                        log.error(f"Gateway returned {resp.status}: {body[:200]}")
                        return {
                            "ok": False,
                            "summary": f"Gateway error {resp.status}",
                            "output": body,
                        }

                    data = await resp.json()

            # 解析 OpenAI Chat Completions 格式
            choices = data.get("choices") or []
            if choices:
                content = choices[0].get("message", {}).get("content", "")
            else:
                content = str(data)

            summary = content[:4000] if len(content) > 4000 else content
            return {"ok": True, "summary": summary, "output": content}

        except asyncio.TimeoutError:
            log.error(f"Gateway execute timed out after {timeout}s")
            return {"ok": False, "summary": "timeout", "output": ""}
        except Exception as e:
            log.error(f"Gateway execute failed: {e}")
            return {"ok": False, "summary": str(e), "output": ""}


# asyncio 在模块顶层不可用，延迟 import 避免循环
import asyncio  # noqa: E402
