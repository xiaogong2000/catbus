"""
CatBus Scanner — 扫描本地 OpenClaw skills 并生成 config entries

每个 skill 单独注册为一条 config entry（handler: gateway:default, source: openclaw）。
末尾始终追加兜底 agent skill（capabilities = 所有 skill 名列表）。
跳过 name == 'catbus' 的 skill（避免递归）。
"""

import os
import re
from pathlib import Path

from .config import SkillConfig

SKILLS_DIR = Path.home() / ".openclaw" / "workspace" / "skills"


def _parse_frontmatter(skill_md_path: Path) -> dict:
    """从 SKILL.md 解析 YAML front matter，返回 name/description。"""
    try:
        text = skill_md_path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return {}

    # 匹配 --- ... --- 包裹的 front matter
    m = re.match(r"^---\s*\n(.*?)\n---", text, re.DOTALL)
    if not m:
        return {}

    fm = {}
    for line in m.group(1).splitlines():
        if ":" in line:
            key, _, val = line.partition(":")
            fm[key.strip()] = val.strip().strip('"').strip("'")
    return fm


def skills_to_config_entries() -> list[SkillConfig]:
    """
    扫描 ~/.openclaw/workspace/skills/，为每个 skill 生成一条 SkillConfig entry。
    末尾附加兜底 agent skill。
    """
    entries: list[SkillConfig] = []
    skill_names: list[str] = []

    if not SKILLS_DIR.exists():
        pass
    else:
        for item in sorted(SKILLS_DIR.iterdir()):
            if not item.is_dir():
                continue

            skill_dir_name = item.name
            skill_md = item / "SKILL.md"
            fm = _parse_frontmatter(skill_md) if skill_md.exists() else {}

            # 优先用 front matter 的 name，fallback 用目录名
            skill_name = fm.get("name", skill_dir_name).strip()

            # 跳过 catbus 自身（避免递归）
            if skill_name == "catbus":
                continue

            description = fm.get("description", "").strip()
            if not description:
                description = f"OpenClaw {skill_name} skill"

            entries.append(SkillConfig(
                name=skill_name,
                description=description,
                handler="gateway:default",
                input_schema={"task": "string"},
                source="openclaw",
            ))
            skill_names.append(skill_name)

    # 兜底 agent skill — capabilities 列出所有 skill 名字
    capabilities_str = ", ".join(skill_names) if skill_names else "general AI tasks"
    entries.append(SkillConfig(
        name="agent",
        description=(
            f"OpenClaw Agent — general-purpose AI agent. "
            f"Available capabilities: {capabilities_str}"
        ),
        handler="gateway:default",
        input_schema={"task": "string"},
        source="openclaw",
    ))

    return entries
