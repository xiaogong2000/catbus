"""
CatBus Capability Database

MODEL_DB — 已知模型列表，用于模糊匹配和自动补全 meta 信息。
SKILL_DB — 已知 Skill 列表，用于分类和判断是否可共享。
extract_base_model() — 将复杂模型名字符串解析为标准名称。

例：
  "amazon-bedrock/global.anthropic.claude-sonnet-4-6" → "claude-sonnet-4"
  "openrouter/deepseek/deepseek-chat-v3" → "deepseek-v3"
"""

import re

# ─── Cost Tier Constants ──────────────────────────────────────

COST_TIER_ORDER_ASC = {"free": 0, "low": 1, "medium": 2, "high": 3, "premium": 4}
COST_TIER_ORDER_DESC = {"premium": 0, "high": 1, "medium": 2, "low": 3, "free": 4}

# ─── MODEL_DB ─────────────────────────────────────────────────
# key = 标准名称（用于 type/name 注册）
# patterns = 用于模糊匹配的关键词列表

MODEL_DB: dict[str, dict] = {
    "claude-opus-4": {
        "provider": "anthropic",
        "context_window": 200000,
        "strengths": ["code", "analysis", "writing", "reasoning", "general"],
        "cost_tier": "premium",
        "patterns": ["claude-opus-4", "claude.opus", "opus-4"],
    },
    "claude-sonnet-4": {
        "provider": "anthropic",
        "context_window": 200000,
        "strengths": ["code", "analysis", "writing", "general"],
        "cost_tier": "medium",
        "patterns": ["claude-sonnet-4", "claude.sonnet-4", "sonnet-4"],
    },
    "claude-sonnet-4-5": {
        "provider": "anthropic",
        "context_window": 200000,
        "strengths": ["code", "analysis", "writing", "general"],
        "cost_tier": "medium",
        "patterns": ["claude-sonnet-4-5", "claude-4-5-sonnet", "sonnet-4-5"],
    },
    "claude-haiku-3-5": {
        "provider": "anthropic",
        "context_window": 200000,
        "strengths": ["fast", "general"],
        "cost_tier": "low",
        "patterns": ["claude-haiku", "claude.haiku", "haiku-3"],
    },
    "gpt-4.1": {
        "provider": "openai",
        "context_window": 1000000,
        "strengths": ["code", "general", "long-context"],
        "cost_tier": "medium",
        "patterns": ["gpt-4.1"],
    },
    "gpt-4o": {
        "provider": "openai",
        "context_window": 128000,
        "strengths": ["vision", "code", "general"],
        "cost_tier": "medium",
        "patterns": ["gpt-4o"],
    },
    "gpt-4.1-mini": {
        "provider": "openai",
        "context_window": 128000,
        "strengths": ["fast", "general"],
        "cost_tier": "low",
        "patterns": ["gpt-4.1-mini", "gpt4.1-mini"],
    },
    "gpt-5.4": {
        "provider": "openai",
        "context_window": 128000,
        "strengths": ["general"],
        "cost_tier": "medium",
        "patterns": ["gpt-5.4", "gpt5.4"],
    },
    "deepseek-v3": {
        "provider": "deepseek",
        "context_window": 64000,
        "strengths": ["code", "chinese", "general"],
        "cost_tier": "low",
        "patterns": ["deepseek-v3", "deepseek-chat-v3", "deepseek-chat"],
    },
    "deepseek-r1": {
        "provider": "deepseek",
        "context_window": 64000,
        "strengths": ["reasoning", "math"],
        "cost_tier": "low",
        "patterns": ["deepseek-r1", "deepseek-reasoner"],
    },
    "llama-3.3-70b": {
        "provider": "meta",
        "context_window": 128000,
        "strengths": ["general"],
        "cost_tier": "free",
        "patterns": ["llama-3.3-70b", "llama-3.3", "llama3.3"],
    },
    "llama-3.1-8b": {
        "provider": "meta",
        "context_window": 128000,
        "strengths": ["fast", "general"],
        "cost_tier": "free",
        "patterns": ["llama-3.1-8b", "llama-3.1", "llama3.1-8b"],
    },
    "gemini-2.5-pro": {
        "provider": "google",
        "context_window": 1000000,
        "strengths": ["long-context", "general"],
        "cost_tier": "medium",
        "patterns": ["gemini-2.5-pro", "gemini-pro-2.5"],
    },
    "gemini-2.5-flash": {
        "provider": "google",
        "context_window": 1000000,
        "strengths": ["fast", "long-context", "general"],
        "cost_tier": "low",
        "patterns": ["gemini-2.5-flash", "gemini-flash"],
    },
    "qwen-2.5": {
        "provider": "alibaba",
        "context_window": 32000,
        "strengths": ["chinese", "general"],
        "cost_tier": "low",
        "patterns": ["qwen-2.5", "qwen2.5", "qwen-72b", "qwen-plus"],
    },
}


def extract_base_model(raw_name: str) -> str:
    """
    将复杂模型名字符串解析为标准 MODEL_DB key。

    支持的输入格式：
      "claude-sonnet-4"
      "anthropic.claude-sonnet-4-6"
      "amazon-bedrock/global.anthropic.claude-sonnet-4-6"
      "openrouter/deepseek/deepseek-chat-v3"
      "aws opus"  (OpenClaw 别名)

    返回标准名称，如 "claude-sonnet-4"。未匹配返回空字符串。
    """
    if not raw_name:
        return ""

    # 统一处理：小写，去掉首尾空格
    name = raw_name.strip().lower()

    # 1. 去掉常见 provider 前缀路径
    #    "amazon-bedrock/global.anthropic.claude-sonnet-4-6" → "claude-sonnet-4-6"
    #    "openrouter/deepseek/deepseek-chat-v3" → "deepseek-chat-v3"
    # 取最后一个路径段，再取最后一个点号段（如果包含已知 provider 前缀）
    if "/" in name:
        name = name.rsplit("/", 1)[-1]
    if "." in name:
        # 先检查当前字符串是否已能直接 pattern 匹配（如 gpt-5.4、gpt-4.1-mini 含点版本号）
        # 只有匹配不上时才做点号分割（处理 anthropic.claude-sonnet-4-6 这类前缀）
        _direct_match = any(
            pattern in name
            for _, info in MODEL_DB.items()
            for pattern in info.get("patterns", [])
        )
        if not _direct_match:
            parts = name.split(".")
            name = parts[-1]

    # 2. 精确匹配
    if name in MODEL_DB:
        return name

    # 3. Pattern 匹配
    for base_name, info in MODEL_DB.items():
        for pattern in info.get("patterns", []):
            if pattern in name:
                return base_name

    # 4. 特殊别名处理（OpenClaw 风格）
    alias_map = {
        "opus": "claude-opus-4",
        "sonnet": "claude-sonnet-4",
        "haiku": "claude-haiku-3-5",
        "gpt4o": "gpt-4o",
        "deepseek": "deepseek-v3",
        "llama": "llama-3.3-70b",
        "gemini": "gemini-2.5-pro",
        "qwen": "qwen-2.5",
    }
    # "aws opus" → "opus"
    words = name.replace("-", " ").split()
    for word in reversed(words):
        if word in alias_map:
            return alias_map[word]

    return ""


def get_model_info(base_name: str) -> dict:
    """获取模型 meta 信息，不含 patterns 字段。"""
    info = MODEL_DB.get(base_name, {})
    return {k: v for k, v in info.items() if k != "patterns"}


# ─── SKILL_DB ─────────────────────────────────────────────────
# 可共享的 110 个 Call 类 Skill
# key = skill 名称
# shareable = True 表示可通过 CatBus 共享

SKILL_DB: dict[str, dict] = {
    # ── search（~20）──
    "tavily": {"category": "search", "cost_tier": "low", "shareable": True},
    "tavily-web-search": {"category": "search", "cost_tier": "low", "shareable": True},
    "google-search": {"category": "search", "cost_tier": "low", "shareable": True},
    "brave-search": {"category": "search", "cost_tier": "low", "shareable": True},
    "bing-search": {"category": "search", "cost_tier": "low", "shareable": True},
    "duckduckgo-search": {"category": "search", "cost_tier": "free", "shareable": True},
    "news-search": {"category": "search", "cost_tier": "low", "shareable": True},
    "academic-search": {"category": "search", "cost_tier": "low", "shareable": True},
    "arxiv-search": {"category": "search", "cost_tier": "free", "shareable": True},
    "wikipedia": {"category": "search", "cost_tier": "free", "shareable": True},
    "wolfram-alpha": {"category": "search", "cost_tier": "medium", "shareable": True},
    # ── query（~40）──
    "weather": {"category": "query", "cost_tier": "free", "shareable": True},
    "openweathermap": {"category": "query", "cost_tier": "free", "shareable": True},
    "stock-price": {"category": "query", "cost_tier": "free", "shareable": True},
    "exchange-rate": {"category": "query", "cost_tier": "free", "shareable": True},
    "crypto-price": {"category": "query", "cost_tier": "free", "shareable": True},
    "coingecko": {"category": "query", "cost_tier": "free", "shareable": True},
    "flight-tracker": {"category": "query", "cost_tier": "low", "shareable": True},
    "imdb": {"category": "query", "cost_tier": "free", "shareable": True},
    "sec-filings": {"category": "query", "cost_tier": "free", "shareable": True},
    "stock-analysis": {"category": "finance", "cost_tier": "low", "shareable": True},
    # ── ai-generate（~35）──
    "image-gen": {"category": "ai-generate", "cost_tier": "high", "shareable": True},
    "dall-e": {"category": "ai-generate", "cost_tier": "high", "shareable": True},
    "stable-diffusion": {"category": "ai-generate", "cost_tier": "medium", "shareable": True},
    "midjourney": {"category": "ai-generate", "cost_tier": "premium", "shareable": True},
    "tts-generate": {"category": "ai-generate", "cost_tier": "medium", "shareable": True},
    "elevenlabs": {"category": "ai-generate", "cost_tier": "high", "shareable": True},
    "music-generate": {"category": "ai-generate", "cost_tier": "high", "shareable": True},
    "voice-clone": {"category": "ai-audio", "cost_tier": "high", "shareable": True},
    "whisper-api": {"category": "ai-audio", "cost_tier": "medium", "shareable": True},
    "audio-separate": {"category": "ai-audio", "cost_tier": "medium", "shareable": True},
    "coding-agent": {"category": "ai-code", "cost_tier": "medium", "shareable": True},
    "code-reviewer": {"category": "ai-code", "cost_tier": "medium", "shareable": True},
    "text-rewrite": {"category": "ai-text", "cost_tier": "low", "shareable": True},
    "text-summarize": {"category": "ai-text", "cost_tier": "low", "shareable": True},
    "document-translate": {"category": "ai-text", "cost_tier": "medium", "shareable": True},
    # ── scraping（~15）──
    "web-scraper": {"category": "scraping", "cost_tier": "low", "shareable": True},
    "firecrawl": {"category": "scraping", "cost_tier": "medium", "shareable": True},
    "url-to-screenshot": {"category": "scraping", "cost_tier": "low", "shareable": True},
    "youtube-subtitles": {"category": "scraping", "cost_tier": "free", "shareable": True},
    "pdf-extract": {"category": "scraping", "cost_tier": "low", "shareable": True},
    # ── marketing / finance ──
    "seo-analyzer": {"category": "marketing", "cost_tier": "medium", "shareable": True},
    "keyword-research": {"category": "marketing", "cost_tier": "medium", "shareable": True},
    "ad-copy-generator": {"category": "marketing", "cost_tier": "medium", "shareable": True},
    # ── utility ──
    "translate": {"category": "utility", "cost_tier": "free", "shareable": True},
    "json-format": {"category": "utility", "cost_tier": "free", "shareable": True},
    "text-stats": {"category": "utility", "cost_tier": "free", "shareable": True},
    "echo": {"category": "utility", "cost_tier": "free", "shareable": True},
}

# 不可共享的运维 / 授权类 Skill（扫描时自动过滤）
_UNSHAREABLE_PATTERNS = {
    "check-quotas", "deploy-bot", "github", "git-commit", "git-push",
    "send-email", "send-tweet", "slack-post", "discord-post",
    "file-manager", "system-monitor", "cron-manager", "ssh-connect",
    "docker-manage", "k8s-manage", "aws-cli", "gcloud-cli",
    "catbus",  # 避免递归
}


def is_skill_shareable(skill_name: str) -> bool:
    """判断 Skill 是否适合通过 CatBus 共享。"""
    if skill_name in _UNSHAREABLE_PATTERNS:
        return False
    info = SKILL_DB.get(skill_name)
    if info is not None:
        return info.get("shareable", True)
    # 未知 Skill 默认可共享（保守起见由用户确认）
    return True


def get_skill_info(skill_name: str) -> dict:
    """获取 Skill meta 信息。"""
    return SKILL_DB.get(skill_name, {
        "category": "utility",
        "cost_tier": "free",
        "shareable": True,
    })
