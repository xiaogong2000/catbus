"""
CatBus Capability Database

MODEL_DB — 已知模型列表，用于模糊匹配和自动补全 meta 信息。
SKILL_DB — 已知 Skill 列表，用于分类和判断是否可共享。
extract_base_model() — 将复杂模型名字符串解析为标准名称。

标准名称对齐 arena.ai leaderboard（2026-03）。
精确匹配优先：opus-4-6 > opus-4-5 > opus-4，避免子串误匹配。
"""

# ─── Cost Tier Constants ──────────────────────────────────────

COST_TIER_ORDER_ASC = {"free": 0, "low": 1, "medium": 2, "high": 3, "premium": 4}
COST_TIER_ORDER_DESC = {"premium": 0, "high": 1, "medium": 2, "low": 3, "free": 4}

# ELO → cost_tier 映射（arena.ai 标准）
def _elo_to_tier(elo: int) -> str:
    if elo >= 1480: return "premium"
    if elo >= 1350: return "high"
    if elo >= 1250: return "medium"
    if elo >= 1100: return "low"
    return "free"


# ─── MODEL_DB ─────────────────────────────────────────────────
# key = 标准名称（arena.ai 风格，用于 type/name 注册）
# patterns = 用于模糊匹配的关键词列表（精确 > 宽泛，顺序重要）

MODEL_DB: dict[str, dict] = {

    # ── Anthropic ──────────────────────────────────────────────
    "claude-opus-4-6": {
        "provider": "anthropic", "context_window": 200000, "arena_elo": 1550,
        "strengths": ["code", "analysis", "writing", "reasoning", "general"],
        "cost_tier": "premium",
        "patterns": ["claude-opus-4-6", "opus-4-6", "claude.opus.4.6"],
    },
    "claude-opus-4-5": {
        "provider": "anthropic", "context_window": 200000, "arena_elo": 1510,
        "strengths": ["code", "analysis", "writing", "reasoning", "general"],
        "cost_tier": "premium",
        "patterns": ["claude-opus-4-5", "opus-4-5", "claude.opus.4.5"],
    },
    "claude-opus-4-1": {
        "provider": "anthropic", "context_window": 200000, "arena_elo": 1490,
        "strengths": ["code", "analysis", "writing", "reasoning"],
        "cost_tier": "premium",
        "patterns": ["claude-opus-4-1", "opus-4-1"],
    },
    "claude-opus-4": {
        "provider": "anthropic", "context_window": 200000, "arena_elo": 1480,
        "strengths": ["code", "analysis", "writing", "reasoning", "general"],
        "cost_tier": "premium",
        "patterns": ["claude-opus-4", "claude.opus", "opus-4"],
    },
    "claude-sonnet-4-6": {
        "provider": "anthropic", "context_window": 200000, "arena_elo": 1524,
        "strengths": ["code", "analysis", "writing", "general"],
        "cost_tier": "high",
        "patterns": ["claude-sonnet-4-6", "sonnet-4-6", "claude.sonnet.4.6"],
    },
    "claude-sonnet-4-5": {
        "provider": "anthropic", "context_window": 200000, "arena_elo": 1480,
        "strengths": ["code", "analysis", "writing", "general"],
        "cost_tier": "high",
        "patterns": ["claude-sonnet-4-5", "claude-4-5-sonnet", "sonnet-4-5"],
    },
    "claude-sonnet-4": {
        "provider": "anthropic", "context_window": 200000, "arena_elo": 1450,
        "strengths": ["code", "analysis", "writing", "general"],
        "cost_tier": "medium",
        "patterns": ["claude-sonnet-4", "claude.sonnet-4", "sonnet-4"],
    },
    "claude-3.7-sonnet": {
        "provider": "anthropic", "context_window": 200000, "arena_elo": 1420,
        "strengths": ["code", "analysis", "reasoning"],
        "cost_tier": "medium",
        "patterns": ["claude-3-7-sonnet", "claude-3.7-sonnet", "claude.3.7.sonnet"],
    },
    "claude-3.5-sonnet": {
        "provider": "anthropic", "context_window": 200000, "arena_elo": 1380,
        "strengths": ["code", "analysis", "writing"],
        "cost_tier": "medium",
        "patterns": ["claude-3-5-sonnet", "claude-3.5-sonnet", "claude.3.5.sonnet"],
    },
    "claude-haiku-4-5": {
        "provider": "anthropic", "context_window": 200000, "arena_elo": 1200,
        "strengths": ["fast", "general"],
        "cost_tier": "low",
        "patterns": ["claude-haiku-4-5", "haiku-4-5"],
    },
    "claude-haiku-3-5": {
        "provider": "anthropic", "context_window": 200000, "arena_elo": 1150,
        "strengths": ["fast", "general"],
        "cost_tier": "low",
        "patterns": ["claude-haiku-3-5", "claude-haiku", "claude.haiku", "haiku-3"],
    },

    # ── OpenAI ─────────────────────────────────────────────────
    "gpt-5.4": {
        "provider": "openai", "context_window": 128000, "arena_elo": 1530,
        "strengths": ["general", "reasoning"],
        "cost_tier": "premium",
        "patterns": ["gpt-5.4", "gpt5.4"],
    },
    "gpt-5.2": {
        "provider": "openai", "context_window": 128000, "arena_elo": 1510,
        "strengths": ["general", "reasoning"],
        "cost_tier": "premium",
        "patterns": ["gpt-5.2", "gpt5.2"],
    },
    "gpt-5.1": {
        "provider": "openai", "context_window": 128000, "arena_elo": 1490,
        "strengths": ["general", "reasoning"],
        "cost_tier": "premium",
        "patterns": ["gpt-5.1", "gpt5.1"],
    },
    "gpt-5": {
        "provider": "openai", "context_window": 128000, "arena_elo": 1470,
        "strengths": ["general", "reasoning"],
        "cost_tier": "premium",
        "patterns": ["gpt-5"],
    },
    "o4-mini": {
        "provider": "openai", "context_window": 128000, "arena_elo": 1460,
        "strengths": ["reasoning", "math", "code"],
        "cost_tier": "high",
        "patterns": ["o4-mini", "o4mini"],
    },
    "o3": {
        "provider": "openai", "context_window": 200000, "arena_elo": 1500,
        "strengths": ["reasoning", "math", "code"],
        "cost_tier": "premium",
        "patterns": ["o3"],
    },
    "gpt-4.1": {
        "provider": "openai", "context_window": 1000000, "arena_elo": 1440,
        "strengths": ["code", "general", "long-context"],
        "cost_tier": "medium",
        "patterns": ["gpt-4.1"],
    },
    "gpt-4o": {
        "provider": "openai", "context_window": 128000, "arena_elo": 1380,
        "strengths": ["vision", "code", "general"],
        "cost_tier": "medium",
        "patterns": ["gpt-4o"],
    },
    "gpt-5-mini": {
        "provider": "openai", "context_window": 128000, "arena_elo": 1300,
        "strengths": ["fast", "general"],
        "cost_tier": "low",
        "patterns": ["gpt-5-mini", "gpt5-mini"],
    },
    "gpt-5-nano": {
        "provider": "openai", "context_window": 128000, "arena_elo": 1200,
        "strengths": ["fast", "general"],
        "cost_tier": "low",
        "patterns": ["gpt-5-nano", "gpt5-nano"],
    },
    "gpt-4.1-mini": {
        "provider": "openai", "context_window": 128000, "arena_elo": 1250,
        "strengths": ["fast", "general"],
        "cost_tier": "low",
        "patterns": ["gpt-4.1-mini", "gpt4.1-mini"],
    },
    "gpt-4.1-nano": {
        "provider": "openai", "context_window": 128000, "arena_elo": 1150,
        "strengths": ["fast", "general"],
        "cost_tier": "free",
        "patterns": ["gpt-4.1-nano", "gpt4.1-nano"],
    },
    "gpt-4o-mini": {
        "provider": "openai", "context_window": 128000, "arena_elo": 1200,
        "strengths": ["fast", "general"],
        "cost_tier": "low",
        "patterns": ["gpt-4o-mini", "gpt4o-mini"],
    },

    # ── Google ─────────────────────────────────────────────────
    "gemini-3.1-pro": {
        "provider": "google", "context_window": 1000000, "arena_elo": 1540,
        "strengths": ["long-context", "vision", "reasoning", "general"],
        "cost_tier": "premium",
        "patterns": ["gemini-3.1-pro", "gemini-3-1-pro"],
    },
    "gemini-3-pro": {
        "provider": "google", "context_window": 1000000, "arena_elo": 1520,
        "strengths": ["long-context", "vision", "general"],
        "cost_tier": "high",
        "patterns": ["gemini-3-pro", "gemini-3pro"],
    },
    "gemini-2.5-pro": {
        "provider": "google", "context_window": 1000000, "arena_elo": 1450,
        "strengths": ["long-context", "general"],
        "cost_tier": "medium",
        "patterns": ["gemini-2.5-pro", "gemini-pro-2.5"],
    },
    "gemini-3-flash": {
        "provider": "google", "context_window": 1000000, "arena_elo": 1350,
        "strengths": ["fast", "long-context", "general"],
        "cost_tier": "low",
        "patterns": ["gemini-3-flash", "gemini-3flash"],
    },
    "gemini-2.5-flash": {
        "provider": "google", "context_window": 1000000, "arena_elo": 1300,
        "strengths": ["fast", "long-context", "general"],
        "cost_tier": "low",
        "patterns": ["gemini-2.5-flash", "gemini-flash-2.5"],
    },
    "gemini-2.5-flash-lite": {
        "provider": "google", "context_window": 1000000, "arena_elo": 1200,
        "strengths": ["fast", "general"],
        "cost_tier": "free",
        "patterns": ["gemini-2.5-flash-lite", "gemini-flash-lite"],
    },

    # ── xAI ────────────────────────────────────────────────────
    "grok-4.20": {
        "provider": "xai", "context_window": 131072, "arena_elo": 1560,
        "strengths": ["reasoning", "math", "code", "general"],
        "cost_tier": "premium",
        "patterns": ["grok-4.20", "grok4.20"],
    },
    "grok-4.1": {
        "provider": "xai", "context_window": 131072, "arena_elo": 1530,
        "strengths": ["reasoning", "math", "general"],
        "cost_tier": "premium",
        "patterns": ["grok-4.1", "grok4.1"],
    },
    "grok-4": {
        "provider": "xai", "context_window": 131072, "arena_elo": 1510,
        "strengths": ["reasoning", "math", "general"],
        "cost_tier": "high",
        "patterns": ["grok-4"],
    },
    "grok-3": {
        "provider": "xai", "context_window": 131072, "arena_elo": 1440,
        "strengths": ["general", "reasoning"],
        "cost_tier": "medium",
        "patterns": ["grok-3"],
    },

    # ── DeepSeek ───────────────────────────────────────────────
    "deepseek-v3.2": {
        "provider": "deepseek", "context_window": 64000, "arena_elo": 1430,
        "strengths": ["code", "chinese", "general"],
        "cost_tier": "low",
        "patterns": ["deepseek-v3.2", "deepseek-v3-2"],
    },
    "deepseek-v3.1": {
        "provider": "deepseek", "context_window": 64000, "arena_elo": 1400,
        "strengths": ["code", "chinese", "general"],
        "cost_tier": "low",
        "patterns": ["deepseek-v3.1", "deepseek-v3-1"],
    },
    "deepseek-v3": {
        "provider": "deepseek", "context_window": 64000, "arena_elo": 1370,
        "strengths": ["code", "chinese", "general"],
        "cost_tier": "low",
        "patterns": ["deepseek-v3", "deepseek-chat-v3", "deepseek-chat"],
    },
    "deepseek-r1": {
        "provider": "deepseek", "context_window": 64000, "arena_elo": 1450,
        "strengths": ["reasoning", "math", "code"],
        "cost_tier": "low",
        "patterns": ["deepseek-r1", "deepseek-reasoner"],
    },

    # ── Meta ───────────────────────────────────────────────────
    "llama-4-maverick": {
        "provider": "meta", "context_window": 128000, "arena_elo": 1420,
        "strengths": ["general", "vision"],
        "cost_tier": "free",
        "patterns": ["llama-4-maverick", "llama4-maverick"],
    },
    "llama-4-scout": {
        "provider": "meta", "context_window": 128000, "arena_elo": 1350,
        "strengths": ["fast", "general"],
        "cost_tier": "free",
        "patterns": ["llama-4-scout", "llama4-scout"],
    },
    "llama-3.3-70b": {
        "provider": "meta", "context_window": 128000, "arena_elo": 1280,
        "strengths": ["general"],
        "cost_tier": "free",
        "patterns": ["llama-3.3-70b", "llama-3.3", "llama3.3"],
    },
    "llama-3.1-70b": {
        "provider": "meta", "context_window": 128000, "arena_elo": 1220,
        "strengths": ["general"],
        "cost_tier": "free",
        "patterns": ["llama-3.1-70b", "llama3.1-70b"],
    },
    "llama-3.1-8b": {
        "provider": "meta", "context_window": 128000, "arena_elo": 1100,
        "strengths": ["fast", "general"],
        "cost_tier": "free",
        "patterns": ["llama-3.1-8b", "llama-3.1", "llama3.1-8b"],
    },

    # ── Alibaba ────────────────────────────────────────────────
    "qwen3.5-397b": {
        "provider": "alibaba", "context_window": 32000, "arena_elo": 1490,
        "strengths": ["chinese", "reasoning", "general"],
        "cost_tier": "high",
        "patterns": ["qwen3.5-397b", "qwen-3.5-397b"],
    },
    "qwen3-235b": {
        "provider": "alibaba", "context_window": 32000, "arena_elo": 1460,
        "strengths": ["chinese", "reasoning", "general"],
        "cost_tier": "high",
        "patterns": ["qwen3-235b", "qwen-3-235b"],
    },
    "qwen3-max": {
        "provider": "alibaba", "context_window": 32000, "arena_elo": 1440,
        "strengths": ["chinese", "general"],
        "cost_tier": "medium",
        "patterns": ["qwen3-max", "qwen-3-max"],
    },
    "qwen3-32b": {
        "provider": "alibaba", "context_window": 32000, "arena_elo": 1360,
        "strengths": ["chinese", "general"],
        "cost_tier": "low",
        "patterns": ["qwen3-32b", "qwen-3-32b"],
    },
    "qwen2.5-72b": {
        "provider": "alibaba", "context_window": 32000, "arena_elo": 1320,
        "strengths": ["chinese", "general"],
        "cost_tier": "low",
        "patterns": ["qwen2.5-72b", "qwen-2.5-72b", "qwen2.5"],
    },
    "qwen2.5-7b": {
        "provider": "alibaba", "context_window": 32000, "arena_elo": 1150,
        "strengths": ["chinese", "fast"],
        "cost_tier": "free",
        "patterns": ["qwen2.5-7b", "qwen-2.5-7b"],
    },

    # ── Mistral ────────────────────────────────────────────────
    "mistral-large-3": {
        "provider": "mistral", "context_window": 128000, "arena_elo": 1380,
        "strengths": ["code", "general", "multilingual"],
        "cost_tier": "medium",
        "patterns": ["mistral-large-3", "mistral-large"],
    },
    "mistral-medium": {
        "provider": "mistral", "context_window": 128000, "arena_elo": 1280,
        "strengths": ["general", "multilingual"],
        "cost_tier": "low",
        "patterns": ["mistral-medium"],
    },

    # ── Microsoft ──────────────────────────────────────────────
    "phi-4": {
        "provider": "microsoft", "context_window": 16000, "arena_elo": 1250,
        "strengths": ["fast", "reasoning", "general"],
        "cost_tier": "free",
        "patterns": ["phi-4"],
    },

    # ── Baidu ──────────────────────────────────────────────────
    "ernie-5.0": {
        "provider": "baidu", "context_window": 128000, "arena_elo": 1350,
        "strengths": ["chinese", "general"],
        "cost_tier": "medium",
        "patterns": ["ernie-5.0", "ernie-5", "ernie5"],
    },

    # ── Zhipu ──────────────────────────────────────────────────
    "glm-5": {
        "provider": "zhipu", "context_window": 128000, "arena_elo": 1380,
        "strengths": ["chinese", "general"],
        "cost_tier": "medium",
        "patterns": ["glm-5"],
    },
    "glm-4.7": {
        "provider": "zhipu", "context_window": 128000, "arena_elo": 1320,
        "strengths": ["chinese", "general"],
        "cost_tier": "low",
        "patterns": ["glm-4.7", "glm4.7"],
    },

    # ── Moonshot ───────────────────────────────────────────────
    "kimi-k2.5": {
        "provider": "moonshot", "context_window": 200000, "arena_elo": 1400,
        "strengths": ["chinese", "long-context", "general"],
        "cost_tier": "medium",
        "patterns": ["kimi-k2.5", "kimi-k2", "kimi"],
    },
}

# ─── VIRTUAL_SELECTORS ────────────────────────────────────────
# 虚拟选择器：按能力/场景路由到最优模型

VIRTUAL_SELECTORS: dict[str, str] = {
    "best":       "claude-opus-4-6",    # 综合最强
    "cheapest":   "llama-3.1-8b",       # 最便宜
    "code":       "claude-opus-4-6",    # 编程最强
    "vision":     "gemini-3.1-pro",     # 视觉最强
    "math":       "o3",                 # 数学最强
    "reasoning":  "grok-4.20",          # 推理最强
    "fast":       "gemini-3-flash",     # 速度最快
    "chinese":    "qwen3.5-397b",       # 中文最强
    "long":       "gemini-3.1-pro",     # 超长上下文
}


def extract_base_model(raw_name: str) -> str:
    """将复杂模型名字符串解析为标准 MODEL_DB key。精确匹配优先。"""
    if not raw_name:
        return ""

    name = raw_name.strip().lower()

    # 1. 去掉 provider 路径前缀
    if "/" in name:
        name = name.rsplit("/", 1)[-1]

    # 2. 处理点号前缀（anthropic.claude-xxx）
    if "." in name:
        _direct_match = any(
            pattern in name
            for _, info in MODEL_DB.items()
            for pattern in info.get("patterns", [])
        )
        if not _direct_match:
            name = name.split(".")[-1]

    # 3. 精确匹配
    if name in MODEL_DB:
        return name

    # 4. Pattern 匹配（DB 顺序即优先级，精确条目在前）
    for base_name, info in MODEL_DB.items():
        for pattern in info.get("patterns", []):
            if pattern in name:
                return base_name

    # 5. 别名（OpenClaw 风格）
    alias_map = {
        "opus":      "claude-opus-4-6",
        "sonnet":    "claude-sonnet-4-6",
        "haiku":     "claude-haiku-3-5",
        "gpt4o":     "gpt-4o",
        "deepseek":  "deepseek-v3",
        "llama":     "llama-3.3-70b",
        "gemini":    "gemini-2.5-pro",
        "qwen":      "qwen2.5-72b",
        "grok":      "grok-4",
        "mistral":   "mistral-large-3",
    }
    words = name.replace("-", " ").split()
    for word in reversed(words):
        if word in alias_map:
            return alias_map[word]

    return ""


def get_model_info(base_name: str) -> dict:
    """获取模型 meta 信息，不含 patterns 字段。"""
    info = MODEL_DB.get(base_name, {})
    return {k: v for k, v in info.items() if k != "patterns"}


def resolve_virtual_selector(name: str) -> str:
    """将虚拟选择器解析为实际模型名（如 model/best → claude-opus-4-6）。"""
    return VIRTUAL_SELECTORS.get(name, name)


# ─── SKILL_DB ─────────────────────────────────────────────────

SKILL_DB: dict[str, dict] = {
    "tavily":           {"category": "search",      "cost_tier": "low",    "shareable": True},
    "google-search":    {"category": "search",      "cost_tier": "low",    "shareable": True},
    "brave-search":     {"category": "search",      "cost_tier": "low",    "shareable": True},
    "arxiv-search":     {"category": "search",      "cost_tier": "free",   "shareable": True},
    "wikipedia":        {"category": "search",      "cost_tier": "free",   "shareable": True},
    "wolfram-alpha":    {"category": "search",      "cost_tier": "medium", "shareable": True},
    "weather":          {"category": "query",       "cost_tier": "free",   "shareable": True},
    "stock-price":      {"category": "query",       "cost_tier": "free",   "shareable": True},
    "crypto-price":     {"category": "query",       "cost_tier": "free",   "shareable": True},
    "image-gen":        {"category": "ai-generate", "cost_tier": "high",   "shareable": True},
    "dall-e":           {"category": "ai-generate", "cost_tier": "high",   "shareable": True},
    "stable-diffusion": {"category": "ai-generate", "cost_tier": "medium", "shareable": True},
    "tts-generate":     {"category": "ai-generate", "cost_tier": "medium", "shareable": True},
    "elevenlabs":       {"category": "ai-audio",    "cost_tier": "high",   "shareable": True},
    "whisper-api":      {"category": "ai-audio",    "cost_tier": "medium", "shareable": True},
    "coding-agent":     {"category": "ai-code",     "cost_tier": "medium", "shareable": True},
    "text-summarize":   {"category": "ai-text",     "cost_tier": "low",    "shareable": True},
    "web-scraper":      {"category": "scraping",    "cost_tier": "low",    "shareable": True},
    "firecrawl":        {"category": "scraping",    "cost_tier": "medium", "shareable": True},
    "pdf-extract":      {"category": "scraping",    "cost_tier": "low",    "shareable": True},
    "translate":        {"category": "utility",     "cost_tier": "free",   "shareable": True},
    "json-format":      {"category": "utility",     "cost_tier": "free",   "shareable": True},
    "text-stats":       {"category": "utility",     "cost_tier": "free",   "shareable": True},
    "echo":             {"category": "utility",     "cost_tier": "free",   "shareable": True},
    "agent":            {"category": "ai-agent",    "cost_tier": "medium", "shareable": True},
}

_UNSHAREABLE_PATTERNS = {
    "check-quotas", "deploy-bot", "github", "git-commit", "git-push",
    "send-email", "send-tweet", "slack-post", "discord-post",
    "file-manager", "system-monitor", "cron-manager", "ssh-connect",
    "docker-manage", "k8s-manage", "aws-cli", "gcloud-cli", "catbus",
}


def is_skill_shareable(skill_name: str) -> bool:
    if skill_name in _UNSHAREABLE_PATTERNS:
        return False
    return SKILL_DB.get(skill_name, {}).get("shareable", True)


def get_skill_info(skill_name: str) -> dict:
    return SKILL_DB.get(skill_name, {"category": "utility", "cost_tier": "free", "shareable": True})
