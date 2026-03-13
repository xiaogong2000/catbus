"""
CatBus Scanner — 扫描本地 OpenClaw skills 并生成 Capability entries

每个 skill 单独注册为一条 CapabilityConfig entry（type: skill, name: skill/xxx）。
末尾始终追加兜底 agent capability。
跳过 name == 'catbus' 的 skill（避免递归）。
不可共享的运维类 skill 标记 shareable: false。
"""

import os
import re
from pathlib import Path

from .config import CapabilityConfig, SkillConfig
from .capability_db import get_skill_info, is_skill_shareable

SKILLS_DIR = Path.home() / ".openclaw" / "workspace" / "skills"


def _parse_frontmatter(skill_md_path: Path) -> dict:
    """从 SKILL.md 解析 YAML front matter，返回 name/description。"""
    try:
        text = skill_md_path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return {}

    m = re.match(r"^---\s*\n(.*?)\n---", text, re.DOTALL)
    if not m:
        return {}

    fm = {}
    for line in m.group(1).splitlines():
        if ":" in line:
            key, _, val = line.partition(":")
            fm[key.strip()] = val.strip().strip('"').strip("'")
    return fm


def scan_to_capabilities() -> list[CapabilityConfig]:
    """
    扫描 ~/.openclaw/workspace/skills/，为每个 skill 生成一条 CapabilityConfig。
    末尾附加兜底 agent capability。
    """
    entries: list[CapabilityConfig] = []
    skill_names: list[str] = []

    if SKILLS_DIR.exists():
        for item in sorted(SKILLS_DIR.iterdir()):
            if not item.is_dir():
                continue

            skill_dir_name = item.name
            skill_md = item / "SKILL.md"
            fm = _parse_frontmatter(skill_md) if skill_md.exists() else {}

            skill_name = fm.get("name", skill_dir_name).strip()

            # 跳过 catbus 自身
            if skill_name == "catbus":
                continue

            description = fm.get("description", "").strip()
            if not description:
                description = f"OpenClaw {skill_name} skill"

            info = get_skill_info(skill_name)
            shareable = is_skill_shareable(skill_name)

            entries.append(CapabilityConfig(
                type="skill",
                name=f"skill/{skill_name}",
                handler="gateway:default",
                meta={
                    "category": info.get("category", "utility"),
                    "description": description,
                    "cost_tier": info.get("cost_tier", "free"),
                    "shareable": shareable,
                    "source": "openclaw",
                },
            ))
            skill_names.append(skill_name)

    # 兜底 agent capability
    capabilities_str = ", ".join(skill_names) if skill_names else "general AI tasks"
    entries.append(CapabilityConfig(
        type="skill",
        name="skill/agent",
        handler="gateway:default",
        meta={
            "category": "utility",
            "description": f"OpenClaw Agent — general-purpose AI agent. Available capabilities: {capabilities_str}",
            "cost_tier": "free",
            "shareable": True,
            "source": "openclaw",
        },
    ))

    return entries


def skills_to_config_entries() -> list[SkillConfig]:
    """
    向后兼容接口：返回 SkillConfig 列表。
    内部调用 scan_to_capabilities() 并转换。
    """
    caps = scan_to_capabilities()
    entries = []
    for cap in caps:
        entries.append(SkillConfig(
            name=cap.short_name,
            description=cap.meta.get("description", ""),
            handler=cap.handler,
            input_schema={"task": "string"},
            source=cap.meta.get("source", "openclaw"),
        ))
    return entries
