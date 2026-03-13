"""
CatBus Capability 执行器

支持三种 handler：
  python:module.func   — 动态 import 并调用 Python 函数
  shell:command        — subprocess 执行 shell 命令
  gateway:model_name   — 通过 OpenClaw Gateway 执行 AI 任务

支持两种查找方式：
  1. capability name: "model/claude-sonnet-4", "skill/tavily"
  2. 兼容老格式 skill name: "echo", "tavily"
"""

import asyncio
import importlib
import json
import logging
import time
from dataclasses import dataclass

from .config import CapabilityConfig, SkillConfig
from .gateway import GatewayClient

log = logging.getLogger("catbus.executor")


@dataclass
class ExecutionResult:
    status: str            # "ok" or "error"
    output: dict           # result data
    duration_ms: int = 0   # execution time
    error: str = ""


class Executor:
    """Execute capability handlers based on config."""

    def __init__(self, capabilities: list[CapabilityConfig] = None,
                 skills: list[SkillConfig] = None):
        """
        接受 capabilities（新格式）或 skills（老格式）。
        内部统一使用 capabilities dict，key 为 full name (如 "skill/echo")。
        同时保留 bare name 映射（如 "echo" → "skill/echo"）供向后兼容。
        """
        self._caps: dict[str, CapabilityConfig] = {}
        self._bare_name_map: dict[str, str] = {}  # bare_name → full_name

        # 加载 capabilities（新格式）
        if capabilities:
            for cap in capabilities:
                self._caps[cap.name] = cap
                # "skill/echo" → "echo" 映射
                if "/" in cap.name:
                    bare = cap.name.split("/", 1)[1]
                    self._bare_name_map[bare] = cap.name

        # 加载 skills（老格式，向后兼容）
        if skills:
            for s in skills:
                full_name = f"skill/{s.name}" if "/" not in s.name else s.name
                if full_name not in self._caps:
                    self._caps[full_name] = CapabilityConfig(
                        type="skill",
                        name=full_name,
                        handler=s.handler,
                        meta={"description": s.description},
                    )
                    self._bare_name_map[s.name] = full_name

    def has_capability(self, name: str) -> bool:
        """检查是否拥有某个能力（支持 full name 或 bare name）。"""
        return name in self._caps or name in self._bare_name_map

    # 保留旧接口
    has_skill = has_capability

    def _resolve_name(self, name: str) -> str | None:
        """将输入名称解析为 full capability name。"""
        if name in self._caps:
            return name
        if name in self._bare_name_map:
            return self._bare_name_map[name]
        return None

    async def execute(self, capability_name: str, input_data: dict) -> ExecutionResult:
        """
        Execute a capability and return the result.

        capability_name 支持：
          - "model/claude-sonnet-4"（新格式）
          - "skill/tavily"（新格式）
          - "echo"（老格式 bare name，向后兼容）
        """
        full_name = self._resolve_name(capability_name)
        if not full_name:
            return ExecutionResult(
                status="error",
                output={},
                error=f"Unknown capability: {capability_name}",
            )

        cap = self._caps[full_name]
        handler = cap.handler
        start = time.time()

        # 如果没有 handler，model/ 类型默认走 gateway:default
        if not handler:
            if cap.type == "model":
                handler = "gateway:default"
            elif cap.type == "skill":
                handler = "gateway:default"

        try:
            if handler.startswith("python:"):
                result = await self._run_python(handler[7:], input_data)
            elif handler.startswith("shell:"):
                result = await self._run_shell(handler[6:], input_data)
            elif handler.startswith("gateway:"):
                # 传递 skill routing 信息
                skill_hint = cap.short_name if cap.type == "skill" else "agent"
                result = await self._run_gateway(
                    handler[8:], input_data, skill_name=skill_hint
                )
            else:
                return ExecutionResult(
                    status="error",
                    output={},
                    error=f"Unknown handler type: {handler}",
                )

            duration_ms = int((time.time() - start) * 1000)
            return ExecutionResult(
                status="ok",
                output=result,
                duration_ms=duration_ms,
            )

        except Exception as e:
            duration_ms = int((time.time() - start) * 1000)
            log.error(f"Capability '{full_name}' failed: {e}")
            return ExecutionResult(
                status="error",
                output={},
                duration_ms=duration_ms,
                error=str(e),
            )

    async def _run_python(self, handler_path: str, input_data: dict) -> dict:
        """
        Run a Python handler.
        handler_path = "module.path.func_name"
        """
        parts = handler_path.rsplit(".", 1)
        if len(parts) != 2:
            raise ValueError(f"Invalid python handler: {handler_path} (expected module.func)")

        module_path, func_name = parts
        log.info(f"  Importing {module_path}.{func_name}")

        module = importlib.import_module(module_path)
        func = getattr(module, func_name)

        # Support both sync and async handlers
        if asyncio.iscoroutinefunction(func):
            result = await func(**input_data)
        else:
            # Run sync function in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(None, lambda: func(**input_data))

        # Normalize result to dict
        if isinstance(result, dict):
            return result
        elif isinstance(result, str):
            return {"result": result}
        else:
            return {"result": str(result)}

    async def _run_shell(self, command: str, input_data: dict) -> dict:
        """
        Run a shell command.
        Input is passed as JSON via stdin.
        """
        log.info(f"  Running shell: {command}")

        input_json = json.dumps(input_data)

        proc = await asyncio.create_subprocess_shell(
            command,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate(input=input_json.encode())

        if proc.returncode != 0:
            raise RuntimeError(
                f"Shell command failed (exit {proc.returncode}): {stderr.decode().strip()}"
            )

        output = stdout.decode().strip()

        # Try to parse as JSON
        try:
            return json.loads(output)
        except json.JSONDecodeError:
            return {"result": output}

    async def _run_gateway(self, model: str, input_data: dict, skill_name: str = "agent") -> dict:
        """
        通过 OpenClaw Gateway 执行 AI 任务。

        handler 格式：
          gateway:           — 使用默认模型
          gateway:fox        — 使用 fox 别名
          gateway:aws opus   — 使用 aws opus 别名

        skill_name != 'agent' 时，自动在 prompt 前加引导语，
        让 Gateway 优先调用对应 skill。

        input_data 中的字段会被拼接成自然语言任务描述：
          - 优先使用 task / prompt / message / text / content 字段
          - 其余字段以 key: value 形式追加
        """
        model = model.strip() or "default"
        log.info(f"  Running gateway handler, model={model}")

        # 把 input_data 转成自然语言描述
        primary_keys = ("task", "prompt", "message", "text", "content")
        task_parts = []
        extra_parts = []

        for key in primary_keys:
            if key in input_data:
                task_parts.append(str(input_data[key]))

        for key, val in input_data.items():
            if key not in primary_keys:
                extra_parts.append(f"{key}: {val}")

        if extra_parts:
            task_parts.append("\n".join(extra_parts))

        task_text = "\n".join(task_parts) if task_parts else json.dumps(input_data, ensure_ascii=False)

        # skill routing: 非 agent 时在 prompt 前注入引导语
        if skill_name and skill_name != "agent":
            task_text = (
                f"Use the {skill_name} skill to complete this task. "
                f"Only use {skill_name}, do not use other skills. "
                f"Task: {task_text}"
            )

        client = GatewayClient()
        result = await client.execute(task=task_text, model=model)

        if not result.get("ok"):
            raise RuntimeError(f"Gateway execution failed: {result.get('summary', 'unknown error')}")

        return result
