"""
CatBus Model Detector — 探测本机安装了什么模型

三层 fallback 探测策略（不碰任何配置文件，不读任何 API key）：

  Layer 1: Gateway /v1/models API
    最快最准。OpenClaw Gateway 暴露 OpenAI 兼容端点，返回当前配置的模型名。

  Layer 2: Self-identification prompt
    向 Gateway 发一条精心设计的 prompt，让模型自报家门。

  Layer 3: Response fingerprint
    发 3 条测试 prompt（代码/中文/推理），根据响应质量推断模型等级。

用法：
  from catbus.detector import detect_models
  results = await detect_models()
"""

import asyncio
import json
import logging
import re
import time
from dataclasses import dataclass, field

import aiohttp

log = logging.getLogger("catbus.detector")

DEFAULT_GATEWAY_URL = "http://localhost:18789"
DETECT_TIMEOUT = 30


@dataclass
class DetectResult:
    raw_name: str
    base_name: str
    confidence: str         # "high" / "medium" / "low"
    method: str             # "gateway_api" / "self_id" / "fingerprint"
    provider: str = ""
    cost_tier: str = ""
    strengths: list = field(default_factory=list)
    arena_elo: int = 0
    details: str = ""


# ─── Layer 1: Gateway /v1/models ──────────────────────────────

async def _probe_gateway_models(base_url: str) -> list[str]:
    """GET /v1/models → 返回模型名列表。"""
    url = f"{base_url}/v1/models"
    models = []

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                url, timeout=aiohttp.ClientTimeout(total=10),
            ) as resp:
                if resp.status != 200:
                    return []
                body = await resp.text()

                try:
                    data = json.loads(body)
                except json.JSONDecodeError:
                    for line in body.strip().splitlines():
                        line = line.strip()
                        if line and not line.startswith(("<", "{", "[")):
                            models.append(line)
                    return models

                if isinstance(data, dict) and "data" in data:
                    for item in data["data"]:
                        if isinstance(item, dict) and "id" in item:
                            models.append(item["id"])
                        elif isinstance(item, str):
                            models.append(item)
                elif isinstance(data, list):
                    for item in data:
                        if isinstance(item, str):
                            models.append(item)
                        elif isinstance(item, dict) and "id" in item:
                            models.append(item["id"])
                elif isinstance(data, dict) and "model" in data:
                    models.append(data["model"])

    except Exception as e:
        log.debug(f"Gateway /v1/models probe failed: {e}")

    return models


# ─── Layer 2: Self-identification prompt ──────────────────────

SELF_ID_PROMPT = """You are being asked to identify yourself for a system integration check.
Please respond with ONLY a JSON object (no markdown, no explanation) containing:
{
  "model_name": "your exact model name and version (e.g. claude-sonnet-4-6, gpt-5.2, deepseek-v3.2)",
  "provider": "the company that made you (e.g. Anthropic, OpenAI, Google, DeepSeek, Meta)",
  "model_family": "the model family (e.g. Claude, GPT, Gemini, DeepSeek, Llama)"
}
If you genuinely don't know any field, use "unknown". Do not guess or hallucinate."""


async def _probe_self_id(base_url: str, token: str | None = None) -> dict | None:
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    payload = {
        "messages": [{"role": "user", "content": SELF_ID_PROMPT}],
        "stream": False,
        "temperature": 0,
    }

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{base_url}/v1/chat/completions",
                headers=headers, json=payload,
                timeout=aiohttp.ClientTimeout(total=DETECT_TIMEOUT),
            ) as resp:
                if resp.status != 200:
                    return None
                data = await resp.json()

        choices = data.get("choices", [])
        if not choices:
            return None
        content = choices[0].get("message", {}).get("content", "")
        response_model = data.get("model", "")

        content = re.sub(r"^```(?:json)?\s*", "", content.strip())
        content = re.sub(r"\s*```$", "", content.strip())

        try:
            result = json.loads(content)
            if response_model and result.get("model_name", "unknown") == "unknown":
                result["model_name"] = response_model
            elif response_model:
                result["response_model"] = response_model
            return result
        except json.JSONDecodeError:
            model_match = re.search(
                r"(?:I am|I'm|model[_ ]name[\"']?\s*[:=]\s*[\"']?)([A-Za-z][\w\-.]+(?:\s[\w\-.]+)?)",
                content, re.IGNORECASE
            )
            result = {"model_name": "unknown", "provider": "unknown"}
            if model_match:
                result["model_name"] = model_match.group(1).strip()
            if response_model:
                result["response_model"] = response_model
            return result

    except Exception as e:
        log.debug(f"Self-ID probe failed: {e}")
        return None


# ─── Layer 3: Response fingerprint ────────────────────────────

FINGERPRINT_PROMPTS = {
    "code": {
        "prompt": "Write a Python function that finds the longest palindromic substring in a string. Use dynamic programming. Only output the code, no explanation.",
        "score_fn": "_score_code",
    },
    "chinese": {
        "prompt": "请用中文简要解释量子纠缠是什么，不超过100字。",
        "score_fn": "_score_chinese",
    },
    "reasoning": {
        "prompt": "A farmer has 17 sheep. All but 9 die. How many sheep are left? Think step by step, then give the final answer as a single number.",
        "score_fn": "_score_reasoning",
    },
}

TIER_THRESHOLDS = {
    "premium": 8,
    "high": 6,
    "medium": 4,
    "low": 2,
    "free": 0,
}


def _score_code(response: str) -> int:
    score = 0
    lower = response.lower()
    if "def " in response and "palindrom" in lower:
        score += 1
    if any(kw in lower for kw in ["dp[", "table[", "dp =", "for i in range", "for j in range"]):
        score += 1
    if "return" in response:
        score += 1
    return score


def _score_chinese(response: str) -> int:
    score = 0
    chinese_chars = len(re.findall(r'[\u4e00-\u9fff]', response))
    if chinese_chars > 20:
        score += 1
    if any(kw in response for kw in ["纠缠", "量子", "粒子", "关联", "状态"]):
        score += 1
    if 30 < chinese_chars < 200:
        score += 1
    return score


def _score_reasoning(response: str) -> int:
    score = 0
    if re.search(r'\b9\b', response):
        score += 2
    if len(response) > 50 and any(kw in response.lower() for kw in ["but", "left", "remain", "except", "all but"]):
        score += 1
    return score


_SCORE_FUNCTIONS = {
    "_score_code": _score_code,
    "_score_chinese": _score_chinese,
    "_score_reasoning": _score_reasoning,
}


async def _probe_fingerprint(base_url: str, token: str | None = None) -> tuple[str, int, dict]:
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    scores = {}
    total = 0

    for category, config in FINGERPRINT_PROMPTS.items():
        payload = {
            "messages": [{"role": "user", "content": config["prompt"]}],
            "stream": False,
            "max_tokens": 500,
        }
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{base_url}/v1/chat/completions",
                    headers=headers, json=payload,
                    timeout=aiohttp.ClientTimeout(total=DETECT_TIMEOUT),
                ) as resp:
                    if resp.status != 200:
                        scores[category] = 0
                        continue
                    data = await resp.json()

            choices = data.get("choices", [])
            content = choices[0].get("message", {}).get("content", "") if choices else ""
            score_fn = _SCORE_FUNCTIONS[config["score_fn"]]
            score = score_fn(content)
            scores[category] = score
            total += score
        except Exception as e:
            log.debug(f"Fingerprint {category} failed: {e}")
            scores[category] = 0

    inferred_tier = "free"
    for tier, threshold in sorted(TIER_THRESHOLDS.items(), key=lambda x: x[1], reverse=True):
        if total >= threshold:
            inferred_tier = tier
            break

    return inferred_tier, total, scores


# ─── Main Detection Logic ─────────────────────────────────────

async def detect_models(
    gateway_url: str | None = None,
    gateway_token: str | None = None,
) -> list[DetectResult]:
    """探测本机安装的模型。三层 fallback，不碰任何配置文件。"""
    from .capability_db import extract_base_model, get_model_info
    from .gateway import _load_token, _load_base_url

    base_url = gateway_url or _load_base_url()
    token = gateway_token or _load_token()
    results: list[DetectResult] = []

    # Layer 1
    log.info("🔍 Layer 1: Probing Gateway /v1/models...")
    api_models = await _probe_gateway_models(base_url)

    if api_models:
        for raw_name in api_models:
            base = extract_base_model(raw_name)
            if base:
                info = get_model_info(base)
                results.append(DetectResult(
                    raw_name=raw_name, base_name=base,
                    confidence="high", method="gateway_api",
                    provider=info.get("provider", ""),
                    cost_tier=info.get("cost_tier", "medium"),
                    strengths=info.get("strengths", ["general"]),
                    arena_elo=info.get("arena_elo", 0),
                    details=f"GET /v1/models → '{raw_name}' → '{base}'",
                ))
            else:
                results.append(DetectResult(
                    raw_name=raw_name, base_name=raw_name,
                    confidence="medium", method="gateway_api",
                    details=f"Gateway returned '{raw_name}' but not in MODEL_DB",
                ))
        if results:
            log.info(f"  ✅ Found {len(results)} model(s): {[r.base_name for r in results]}")
            return results

    log.info("  ❌ /v1/models unavailable or empty")

    # Layer 2
    log.info("🔍 Layer 2: Sending self-identification prompt...")
    self_id = await _probe_self_id(base_url, token)

    if self_id:
        candidates = [
            self_id.get("model_name", ""),
            self_id.get("response_model", ""),
            self_id.get("model_family", ""),
        ]
        for candidate in candidates:
            if not candidate or candidate.lower() in ("unknown", "n/a", ""):
                continue
            base = extract_base_model(candidate)
            if base:
                info = get_model_info(base)
                results.append(DetectResult(
                    raw_name=candidate, base_name=base,
                    confidence="medium", method="self_id",
                    provider=info.get("provider", self_id.get("provider", "")),
                    cost_tier=info.get("cost_tier", "medium"),
                    strengths=info.get("strengths", ["general"]),
                    arena_elo=info.get("arena_elo", 0),
                    details=f"Self-reported: '{candidate}' → '{base}'",
                ))
                log.info(f"  ✅ Self-ID: {base}")
                return results

        raw = self_id.get("model_name", "unknown")
        if raw.lower() != "unknown":
            results.append(DetectResult(
                raw_name=raw, base_name=raw,
                confidence="low", method="self_id",
                provider=self_id.get("provider", "unknown"),
                details=f"Model says '{raw}' but not in MODEL_DB",
            ))
            return results

    log.info("  ❌ Self-ID unavailable")

    # Layer 3
    log.info("🔍 Layer 3: Running fingerprint tests...")
    tier, total_score, scores = await _probe_fingerprint(base_url, token)

    results.append(DetectResult(
        raw_name=f"unknown-{tier}", base_name=f"unknown-{tier}",
        confidence="low", method="fingerprint",
        cost_tier=tier,
        strengths=_infer_strengths_from_scores(scores),
        details=f"code={scores.get('code',0)}/3, chinese={scores.get('chinese',0)}/3, reasoning={scores.get('reasoning',0)}/3 → {tier}",
    ))
    log.info(f"  📊 Fingerprint: {scores} → tier={tier}")
    return results


def _infer_strengths_from_scores(scores: dict) -> list[str]:
    strengths = ["general"]
    if scores.get("code", 0) >= 2:
        strengths.append("code")
    if scores.get("chinese", 0) >= 2:
        strengths.append("chinese")
    if scores.get("reasoning", 0) >= 2:
        strengths.append("reasoning")
    return strengths


# ─── Bind Prompt Generator ────────────────────────────────────

def generate_bind_prompt(token: str, detect_results: list[DetectResult] | None = None) -> str:
    if detect_results:
        models = [r.base_name for r in detect_results if r.confidence != "low"]
        models_str = ",".join(models) if models else ""
        cmd = f"catbus bind {token}"
        if models_str:
            cmd += f" --models {models_str}"
        return cmd

    return f"""I need you to help me register this machine as a CatBus Provider node.

Please execute these steps in order:

Step 1: Check if catbus is installed
```bash
catbus --version 2>/dev/null || pip install catbus
```

Step 2: Initialize (auto-detects models and skills)
```bash
catbus init
```

Step 3: Check what was detected
```bash
catbus detect --json 2>/dev/null
```

Step 4: Bind to the network
Based on the detection results, run:
```bash
catbus bind {token} --auto
```

The bind token is: {token}

Please run each step and show me the output."""


# ─── CLI Entry Point ──────────────────────────────────────────

async def run_detect(json_output: bool = False, gateway_url: str | None = None):
    results = await detect_models(gateway_url=gateway_url)

    if json_output:
        output = [{
            "raw_name": r.raw_name, "base_name": r.base_name,
            "confidence": r.confidence, "method": r.method,
            "provider": r.provider, "cost_tier": r.cost_tier,
            "strengths": r.strengths, "arena_elo": r.arena_elo,
            "details": r.details,
        } for r in results]
        print(json.dumps(output, indent=2, ensure_ascii=False))
        return

    if not results:
        print("❌ No model detected. Is OpenClaw Gateway running?")
        print(f"   Check: curl -s http://localhost:18789/v1/models")
        return

    for r in results:
        icon = {"high": "🟢", "medium": "🟡", "low": "🔴"}.get(r.confidence, "⚪")
        print(f"\n{icon} Detected model: {r.base_name}")
        print(f"   Raw name:    {r.raw_name}")
        print(f"   Method:      {r.method}")
        print(f"   Confidence:  {r.confidence}")
        if r.provider:
            print(f"   Provider:    {r.provider}")
        if r.cost_tier:
            print(f"   Cost tier:   {r.cost_tier}")
        if r.arena_elo:
            print(f"   Arena ELO:   {r.arena_elo}")
        if r.strengths:
            print(f"   Strengths:   {r.strengths}")
        print(f"   Details:     {r.details}")
