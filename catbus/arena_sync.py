"""
catbus.arena_sync — 每日抓取 LM Arena 排行榜数据

数据源: https://lmarena.ai/leaderboard
输出: ~/.catbus/arena_models.json

表格结构（实测 2026-03）:
  Table 0: Text ELO (主排行，Rank/Model/Score/Votes)
  Table 2: Vision ELO
  Table 3: Code ELO
  Table 9: 全量分类排名 (Overall/Expert/Hard Prompts/Coding/Math/Creative Writing/Instruction Following)

防御设计：解析失败不覆盖旧文件，capability_db 继续用 hardcoded fallback。
"""

import json
import logging
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

try:
    import requests
    from bs4 import BeautifulSoup
    HAS_DEPS = True
except ImportError:
    HAS_DEPS = False

log = logging.getLogger("catbus.arena_sync")

ARENA_URL = "https://lmarena.ai/leaderboard"
OUTPUT_PATH = Path.home() / ".catbus" / "arena_models.json"
REQUEST_TIMEOUT = 30
USER_AGENT = "Mozilla/5.0 (compatible; CatBus-ArenaSync/1.0)"

# ─── Arena 名称 → MODEL_DB key 映射 ──────────────────────────

ARENA_NAME_MAP: dict[str, str] = {
    # Anthropic
    "claude-opus-4-6-thinking":           "claude-opus-4-6",
    "claude-opus-4-6-20261101":           "claude-opus-4-6",
    "claude-opus-4-6":                    "claude-opus-4-6",
    "claude-opus-4-5-thinking":           "claude-opus-4-5",
    "claude-opus-4-5":                    "claude-opus-4-5",
    "claude-sonnet-4-6-thinking":         "claude-sonnet-4-6",
    "claude-sonnet-4-6-20260901":         "claude-sonnet-4-6",
    "claude-sonnet-4-6":                  "claude-sonnet-4-6",
    "claude-sonnet-4-5-20250514":         "claude-sonnet-4-5",
    "claude-sonnet-4-5":                  "claude-sonnet-4-5",
    "claude-sonnet-4-20250514":           "claude-sonnet-4",
    "claude-sonnet-4":                    "claude-sonnet-4",
    "claude-opus-4-1":                    "claude-opus-4-1",
    "claude-3-7-sonnet-20250219":         "claude-3.7-sonnet",
    "claude-3-7-sonnet-thinking":         "claude-3.7-sonnet",
    "claude-3.7-sonnet":                  "claude-3.7-sonnet",
    "claude-3-5-sonnet-20241022":         "claude-3.5-sonnet",
    "claude-3.5-sonnet":                  "claude-3.5-sonnet",
    "claude-haiku-4-5":                   "claude-haiku-4-5",
    "claude-haiku-3-5-20241022":          "claude-haiku-3-5",
    "claude-haiku-3.5":                   "claude-haiku-3-5",
    # OpenAI
    "o3":                                 "o3",
    "o3-2025-04-16":                      "o3",
    "o4-mini":                            "o4-mini",
    "o3-mini":                            "o4-mini",
    "gpt-5.4-high":                       "gpt-5.4",
    "gpt-5.4":                            "gpt-5.4",
    "gpt-5.2-chat-latest":                "gpt-5.2",
    "gpt-5.2":                            "gpt-5.2",
    "gpt-5.1":                            "gpt-5.1",
    "gpt-5":                              "gpt-5",
    "gpt-4o-2024-11-20":                  "gpt-4o",
    "gpt-4o":                             "gpt-4o",
    "gpt-4.1-2025-04-14":                 "gpt-4.1",
    "gpt-4.1":                            "gpt-4.1",
    "gpt-4o-mini-2024-07-18":             "gpt-4o-mini",
    "gpt-4o-mini":                        "gpt-4o-mini",
    "gpt-5-mini":                         "gpt-5-mini",
    "gpt-4.1-mini":                       "gpt-4.1-mini",
    "gpt-4.1-nano":                       "gpt-4.1-nano",
    "gpt-5-nano":                         "gpt-5-nano",
    # Google
    "gemini-3-1-pro":                     "gemini-3.1-pro",
    "gemini-3.1-pro-exp":                 "gemini-3.1-pro",
    "gemini-3.1-pro-preview":             "gemini-3.1-pro",
    "gemini-3-pro":                       "gemini-3-pro",
    "gemini-3-flash":                     "gemini-3-flash",
    "gemini-2.5-pro-preview-05-06":       "gemini-2.5-pro",
    "gemini-2.5-pro-exp-03-25":           "gemini-2.5-pro",
    "gemini-2.5-pro":                     "gemini-2.5-pro",
    "gemini-2.5-flash-preview-04-17":     "gemini-2.5-flash",
    "gemini-2.5-flash":                   "gemini-2.5-flash",
    "gemini-2.5-flash-lite":              "gemini-2.5-flash-lite",
    # xAI
    "grok-4.20":                          "grok-4.20",
    "grok-4.20-beta1":                    "grok-4.20",
    "grok-4.1":                           "grok-4.1",
    "grok-4":                             "grok-4",
    "grok-3-beta":                        "grok-3",
    "grok-3":                             "grok-3",
    # DeepSeek
    "deepseek-r1-0528":                   "deepseek-r1",
    "deepseek-r1":                        "deepseek-r1",
    "deepseek-v3.2-exp-thinking":         "deepseek-v3.2",
    "deepseek-v3.2":                      "deepseek-v3.2",
    "deepseek-v3.1":                      "deepseek-v3.1",
    "deepseek-v3-0324":                   "deepseek-v3",
    "deepseek-chat":                      "deepseek-v3",
    # Alibaba
    "qwen3.5-397b-a47b":                  "qwen3.5-397b",
    "qwen3.5-397b":                       "qwen3.5-397b",
    "qwen3-235b-a22b":                    "qwen3-235b",
    "qwen3-235b":                         "qwen3-235b",
    "qwen3-max":                          "qwen3-max",
    "qwen3-32b":                          "qwen3-32b",
    "qwen2.5-72b-instruct":               "qwen2.5-72b",
    "qwen2.5-72b":                        "qwen2.5-72b",
    "qwen2.5-7b-instruct":                "qwen2.5-7b",
    # Meta
    "llama-4-maverick-03-26":             "llama-4-maverick",
    "meta-llama-4-maverick":              "llama-4-maverick",
    "llama-4-maverick":                   "llama-4-maverick",
    "llama-4-scout-17b-16e":              "llama-4-scout",
    "llama-4-scout":                      "llama-4-scout",
    "llama-3.3-70b-instruct":             "llama-3.3-70b",
    "llama-3.3-70b":                      "llama-3.3-70b",
    "meta-llama-3.1-70b-instruct":        "llama-3.1-70b",
    "meta-llama-3.1-8b-instruct":         "llama-3.1-8b",
    # Others
    "glm-5":                              "glm-5",
    "glm-4.7":                            "glm-4.7",
    "glm-4-9b":                           "glm-4.7",
    "ernie-5.0":                          "ernie-5.0",
    "ernie-4.5-300b-a47b":                "ernie-5.0",
    "moonshot-v1-128k":                   "kimi-k2.5",
    "kimi-k2.5":                          "kimi-k2.5",
    "mistral-large-2411":                 "mistral-large-3",
    "mistral-large-3":                    "mistral-large-3",
    "mistral-medium-3":                   "mistral-medium",
    "mistral-medium":                     "mistral-medium",
    "phi-4":                              "phi-4",
    "phi-4-14b":                          "phi-4",
}

# Arena 分类列名 → JSON rank key 映射
CATEGORY_COL_MAP = {
    "coding":                 "code_rank",
    "code":                   "code_rank",
    "math":                   "math_rank",
    "vision":                 "vision_rank",
    "creative writing":       "creative_writing_rank",
    "creative_writing":       "creative_writing_rank",
    "instruction following":  "instruction_following_rank",
    "instruction_following":  "instruction_following_rank",
    "hard prompts":           "hard_prompts_rank",
    "hard_prompts":           "hard_prompts_rank",
    "longer query":           "longer_query_rank",
    "long query":             "longer_query_rank",
}

# 已知的 provider 前缀（Arena 页面模型名会带这些）
PROVIDER_PREFIXES = [
    "anthropic", "openai", "google", "meta", "xai",
    "deepseek", "alibaba", "mistral", "zhipu", "baidu",
]


def _strip_provider_prefix(name: str) -> str:
    """去掉 Arena 模型名里的 provider 前缀，如 'Anthropicclaude-opus-4-6' → 'claude-opus-4-6'"""
    low = name.lower()
    for prefix in PROVIDER_PREFIXES:
        if low.startswith(prefix):
            stripped = name[len(prefix):]
            # 有时用空格或大写连接
            return stripped.lstrip(" -").lower()
    return low


def _strip_search_suffix(name: str) -> str:
    """去掉 Arena -search, [web-search] 等后缀"""
    name = re.sub(r"\s*\[.*?\]\s*$", "", name)
    name = re.sub(r"-(search|grounded)$", "", name)
    return name


def _normalize(raw: str) -> str:
    """完整标准化 Arena 模型名。"""
    name = raw.strip()
    name = _strip_provider_prefix(name)
    name = _strip_search_suffix(name)
    # 去括号
    name = re.sub(r"\s*\(.*?\)\s*$", "", name)
    # 去常见后缀
    for sfx in ["-thinking", "-exp", "-preview", "-latest", "-beta"]:
        if name.endswith(sfx):
            name = name[:-len(sfx)]
    return name.strip()


def _lookup(raw: str) -> str | None:
    """把 Arena 模型名映射到 MODEL_DB key。"""
    # 直接匹配（小写）
    low = raw.strip().lower()
    if low in ARENA_NAME_MAP:
        return ARENA_NAME_MAP[low]
    # 规范化后匹配
    norm = _normalize(raw)
    if norm in ARENA_NAME_MAP:
        return ARENA_NAME_MAP[norm]
    # 前缀匹配（处理日期后缀）
    for arena_key, model_key in ARENA_NAME_MAP.items():
        if norm.startswith(arena_key + "-") or norm == arena_key:
            return model_key
    return None


# ─── Parser ───────────────────────────────────────────────────

def _parse_table_elo(table, results: dict) -> int:
    """解析 ELO 排行表（Rank/Model/Score/Votes 结构）。"""
    rows = table.find_all("tr")
    if not rows:
        return 0

    headers = [th.get_text(strip=True).lower() for th in rows[0].find_all(["th", "td"])]
    try:
        name_col = next(i for i, h in enumerate(headers) if "model" in h or "name" in h)
        score_col = next(i for i, h in enumerate(headers) if "score" in h or "elo" in h)
    except StopIteration:
        return 0

    count = 0
    for row in rows[1:]:
        cells = row.find_all(["td", "th"])
        if len(cells) <= max(name_col, score_col):
            continue
        raw_name = cells[name_col].get_text(strip=True)
        raw_score = cells[score_col].get_text(strip=True).replace(",", "")
        score_match = re.search(r"\d{3,4}", raw_score)
        if not score_match:
            continue
        key = _lookup(raw_name)
        if not key:
            continue
        elo = int(score_match.group())
        if key not in results:
            results[key] = {}
        if elo > results[key].get("elo_score", 0):
            results[key]["elo_score"] = elo
        count += 1
    return count


def _parse_table_category_ranks(table, results: dict) -> int:
    """解析全量分类排名表（最后一个大表）。"""
    rows = table.find_all("tr")
    if not rows:
        return 0

    # 提取列头（可能跨多行）
    raw_headers = []
    for cell in rows[0].find_all(["th", "td"]):
        raw_headers.append(cell.get_text(strip=True).lower())

    # 找 model 列和分类列
    name_col = None
    for i, h in enumerate(raw_headers):
        if "model" in h:
            name_col = i
            break
    if name_col is None:
        name_col = 0

    col_map: dict[str, int] = {}  # rank_key → col_index
    for i, h in enumerate(raw_headers):
        for kw, rank_key in CATEGORY_COL_MAP.items():
            if kw in h and rank_key not in col_map:
                col_map[rank_key] = i

    if not col_map:
        return 0

    log.info(f"Category table: name_col={name_col}, cols={col_map}")

    count = 0
    for rank, row in enumerate(rows[1:], start=1):
        cells = row.find_all(["td", "th"])
        if not cells:
            continue
        raw_name = cells[name_col].get_text(strip=True) if len(cells) > name_col else ""
        if not raw_name:
            continue
        key = _lookup(raw_name)
        if not key:
            continue
        if key not in results:
            results[key] = {}
        # 解析各分类排名
        for rank_key, col_idx in col_map.items():
            if col_idx < len(cells):
                raw = cells[col_idx].get_text(strip=True)
                m = re.search(r"\d+", raw)
                if m:
                    results[key][rank_key] = int(m.group())
        count += 1
    return count


def _parse_leaderboard_html(html: str) -> dict[str, dict]:
    soup = BeautifulSoup(html, "html.parser")
    results: dict[str, dict] = {}
    tables = soup.find_all("table")
    log.info(f"Found {len(tables)} table(s)")

    for i, table in enumerate(tables):
        rows = table.find_all("tr")
        if not rows:
            continue
        n_rows = len(rows)
        n_cols = len(rows[0].find_all(["th", "td"])) if rows else 0
        headers = [c.get_text(strip=True).lower() for c in rows[0].find_all(["th", "td"])]
        log.info(f"  Table {i}: {n_rows} rows x {n_cols} cols | headers: {headers[:5]}")

        # 大表（>100行）= 全量分类排名
        if n_rows > 100:
            n = _parse_table_category_ranks(table, results)
            log.info(f"    → Category ranks: {n} models")
        # 有 score/elo 列的小表 = ELO 排行
        elif any("score" in h or "elo" in h for h in headers):
            # 跳过图片/视频类表（无 model 列）
            if not any("model" in h or "name" in h for h in headers):
                continue
            n = _parse_table_elo(table, results)
            log.info(f"    → ELO table: {n} models")

    return results


# ─── Fetch & Sync ─────────────────────────────────────────────

def sync(dry_run: bool = False) -> dict:
    if not HAS_DEPS:
        raise ImportError("arena_sync requires: pip install requests beautifulsoup4")

    log.info(f"Fetching: {ARENA_URL}")
    t0 = time.time()
    resp = requests.get(ARENA_URL, headers={"User-Agent": USER_AGENT}, timeout=REQUEST_TIMEOUT)
    resp.raise_for_status()
    log.info(f"Fetched {len(resp.text):,} bytes in {time.time()-t0:.1f}s")

    models = _parse_leaderboard_html(resp.text)
    log.info(f"Total: {len(models)} models parsed")

    if not models:
        log.warning("No models parsed — page structure may have changed. Not overwriting.")
        return {}

    output = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "source": ARENA_URL,
        "model_count": len(models),
        "models": models,
    }

    if dry_run:
        print(json.dumps(output, indent=2, ensure_ascii=False))
        return models

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(output, indent=2, ensure_ascii=False))
    log.info(f"Written: {OUTPUT_PATH}")
    return models


def main():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )
    dry = "--dry-run" in sys.argv or "-n" in sys.argv
    try:
        result = sync(dry_run=dry)
        print(f"\n✅ Arena sync: {len(result)} models")
        if not dry:
            print(f"   Written: {OUTPUT_PATH}")
    except Exception as e:
        print(f"❌ Failed: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
