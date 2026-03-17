"""
CatBus 配置加载

读取 ~/.catbus/config.yaml 和 ~/.catbus/node_id

支持两种格式：
  - 新格式：capabilities 列表（type/name）
  - 老格式：skills 列表（自动转换为 capabilities）
"""

import os
import uuid
from dataclasses import dataclass, field
from pathlib import Path

import yaml

CATBUS_HOME = Path(os.environ.get("CATBUS_HOME", Path.home() / ".catbus"))
DEFAULT_SERVER = os.environ.get("CATBUS_SERVER", "wss://relay.catbus.ai")
# Default daemon port: 9800 (aligned with catbus-client.service)
DEFAULT_PORT = int(os.environ.get("CATBUS_PORT", "9800"))


# ─── Legacy SkillConfig（保留用于向后兼容 scanner 等场景）──────

@dataclass
class SkillConfig:
    name: str
    description: str = ""
    handler: str = ""          # "python:module.func" or "shell:command"
    input_schema: dict = field(default_factory=dict)
    source: str = ""           # "openclaw" = auto-generated; "" = manual


# ─── Capability 数据结构 ──────────────────────────────────────

@dataclass
class CapabilityConfig:
    """统一的能力描述：model/ skill/ compute/ storage/ agent/"""
    type: str           # "model" / "skill" / "compute" / ...
    name: str           # "model/claude-sonnet-4" / "skill/tavily"
    handler: str = ""   # "gateway:default" / "python:xxx" / "shell:xxx"
    meta: dict = field(default_factory=dict)

    @property
    def short_name(self) -> str:
        """'model/claude-sonnet-4' → 'claude-sonnet-4'"""
        return self.name.split("/", 1)[1] if "/" in self.name else self.name

    def to_register_dict(self) -> dict:
        """转为 REGISTER 消息中的 capability dict。"""
        return {
            "type": self.type,
            "name": self.name,
            "meta": self.meta,
        }


@dataclass
class Config:
    node_id: str = ""
    node_name: str = ""
    server: str = DEFAULT_SERVER
    port: int = DEFAULT_PORT
    capabilities: list[CapabilityConfig] = field(default_factory=list)
    # 向后兼容：老配置文件中的 skills 列表
    skills: list[SkillConfig] = field(default_factory=list)
    # limits（可选）
    limits: dict = field(default_factory=dict)
    # Per-skill timeout overrides (skill_name -> seconds)
    timeouts: dict = field(default_factory=dict)
    # Default timeout for all skills (seconds)
    default_timeout: int = 180

    def get_timeout(self, skill_name: str) -> int:
        """Get timeout for a skill: per-skill override > default_timeout > 180."""
        # Try exact match first, then bare name
        if skill_name in self.timeouts:
            return self.timeouts[skill_name]
        bare = skill_name.split("/", 1)[1] if "/" in skill_name else skill_name
        if bare in self.timeouts:
            return self.timeouts[bare]
        return self.default_timeout

    def get_capabilities_by_type(self, cap_type: str) -> list[CapabilityConfig]:
        """按类型筛选能力。"""
        return [c for c in self.capabilities if c.type == cap_type]

    def get_models(self) -> list[CapabilityConfig]:
        return self.get_capabilities_by_type("model")

    def get_skills(self) -> list[CapabilityConfig]:
        return self.get_capabilities_by_type("skill")


# ─── Config Migration ─────────────────────────────────────────

def _migrate_skills_to_capabilities(raw: dict) -> list[dict]:
    """
    将老格式 skills 列表转为 capabilities 列表。

    老格式：
      skills:
        - name: echo
          handler: "python:catbus.builtin_skills.echo"
          description: "Echo back input"

    新格式：
      capabilities:
        - type: skill
          name: skill/echo
          handler: "python:catbus.builtin_skills.echo"
          meta:
            category: utility
            cost_tier: free
    """
    from .capability_db import get_skill_info

    capabilities = []
    for skill in raw.get("skills", []):
        if isinstance(skill, str):
            # 极简格式："echo"
            skill_name = skill
            info = get_skill_info(skill_name)
            capabilities.append({
                "type": "skill",
                "name": f"skill/{skill_name}",
                "handler": "",
                "meta": {
                    "category": info.get("category", "utility"),
                    "cost_tier": info.get("cost_tier", "free"),
                },
            })
        elif isinstance(skill, dict):
            skill_name = skill.get("name", "")
            info = get_skill_info(skill_name)
            capabilities.append({
                "type": "skill",
                "name": f"skill/{skill_name}",
                "handler": skill.get("handler", ""),
                "meta": {
                    "category": info.get("category", "utility"),
                    "description": skill.get("description", ""),
                    "cost_tier": info.get("cost_tier", "free"),
                },
            })
    return capabilities


# ─── Core Functions ───────────────────────────────────────────

def ensure_home():
    """Create ~/.catbus/ if it doesn't exist."""
    CATBUS_HOME.mkdir(parents=True, exist_ok=True)


def load_node_id() -> str:
    """Load or generate node_id."""
    id_file = CATBUS_HOME / "node_id"
    if id_file.exists():
        return id_file.read_text().strip()
    return ""


def save_node_id(node_id: str):
    """Persist node_id to disk."""
    ensure_home()
    (CATBUS_HOME / "node_id").write_text(node_id)


def generate_node_id() -> str:
    """Generate a new node_id (12-char hex)."""
    return uuid.uuid4().hex[:12]


def load_config() -> Config:
    """
    Load config from ~/.catbus/config.yaml + node_id.

    支持新旧两种格式：
      - 有 capabilities: → 直接加载
      - 只有 skills: → 自动迁移为 capabilities + 保留 skills 兼容
    """
    ensure_home()
    config = Config()

    # Load node_id
    config.node_id = load_node_id()

    # Load config.yaml
    config_file = CATBUS_HOME / "config.yaml"
    if config_file.exists():
        with open(config_file) as f:
            raw = yaml.safe_load(f) or {}

        config.server = raw.get("server", config.server)
        config.port = raw.get("port", config.port)
        config.node_name = raw.get("name", "")
        config.limits = raw.get("limits", {})
        config.default_timeout = raw.get("default_timeout", 180)
        config.timeouts = raw.get("timeouts", {})

        # 新格式：capabilities
        if "capabilities" in raw:
            for cap in raw["capabilities"]:
                config.capabilities.append(CapabilityConfig(
                    type=cap.get("type", "skill"),
                    name=cap.get("name", ""),
                    handler=cap.get("handler", ""),
                    meta=cap.get("meta", {}),
                ))

        # 老格式：skills → 转换 + 保留
        if "skills" in raw:
            for s in raw["skills"]:
                if isinstance(s, dict):
                    config.skills.append(SkillConfig(
                        name=s.get("name", ""),
                        description=s.get("description", ""),
                        handler=s.get("handler", ""),
                        input_schema=s.get("input_schema", {}),
                        source=s.get("source", ""),
                    ))

            # 如果没有 capabilities 字段，从 skills 迁移
            if "capabilities" not in raw:
                migrated = _migrate_skills_to_capabilities(raw)
                for cap in migrated:
                    config.capabilities.append(CapabilityConfig(
                        type=cap["type"],
                        name=cap["name"],
                        handler=cap.get("handler", ""),
                        meta=cap.get("meta", {}),
                    ))

    return config


def save_default_config(config: Config):
    """Write a default config.yaml (new format with capabilities)."""
    ensure_home()
    data = {
        "server": config.server,
        "port": config.port,
        "name": config.node_name or f"node-{config.node_id[:6]}",
        "capabilities": [
            {
                "type": "skill",
                "name": "skill/echo",
                "handler": "python:catbus.builtin_skills.echo",
                "meta": {
                    "category": "utility",
                    "cost_tier": "free",
                },
            }
        ],
        # 向后兼容：同时写一份 skills
        "skills": [
            {
                "name": "echo",
                "description": "Echo back the input (demo skill)",
                "handler": "python:catbus.builtin_skills.echo",
                "input_schema": {"text": "string"},
            }
        ],
    }
    config_file = CATBUS_HOME / "config.yaml"
    with open(config_file, "w") as f:
        yaml.dump(data, f, default_flow_style=False, allow_unicode=True)
    return config_file
