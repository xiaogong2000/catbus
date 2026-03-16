"""
CatBus Skill 执行器

支持两种 handler：
  python:module.func   — 动态 import 并调用 Python 函数
  shell:command        — subprocess 执行 shell 命令
"""

import asyncio
import importlib
import json
import logging
import subprocess
import time
from dataclasses import dataclass

from .config import SkillConfig

log = logging.getLogger("catbus.executor")


@dataclass
class ExecutionResult:
    status: str            # "ok" or "error"
    output: dict           # result data
    duration_ms: int = 0   # execution time
    error: str = ""


class Executor:
    """Execute skill handlers based on config."""

    def __init__(self, skills: list[SkillConfig]):
        self.skills: dict[str, SkillConfig] = {s.name: s for s in skills}

    def has_skill(self, name: str) -> bool:
        return name in self.skills

    async def execute(self, skill_name: str, input_data: dict) -> ExecutionResult:
        """Execute a skill and return the result."""
        if skill_name not in self.skills:
            return ExecutionResult(
                status="error",
                output={},
                error=f"Unknown skill: {skill_name}",
            )

        skill = self.skills[skill_name]
        handler = skill.handler
        start = time.time()

        try:
            if handler.startswith("python:"):
                result = await self._run_python(handler[7:], input_data)
            elif handler.startswith("shell:"):
                result = await self._run_shell(handler[6:], input_data)
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
            log.error(f"Skill '{skill_name}' failed: {e}")
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
