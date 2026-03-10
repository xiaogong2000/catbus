"""
CatBus 配置加载

读取 ~/.catbus/config.yaml 和 ~/.catbus/node_id
"""

import os
import uuid
from dataclasses import dataclass, field
from pathlib import Path

import yaml

CATBUS_HOME = Path(os.environ.get("CATBUS_HOME", Path.home() / ".catbus"))
DEFAULT_SERVER = os.environ.get("CATBUS_SERVER", "wss://relay.catbus.ai")
DEFAULT_PORT = int(os.environ.get("CATBUS_PORT", "9800"))


@dataclass
class SkillConfig:
    name: str
    description: str = ""
    handler: str = ""          # "python:module.func" or "shell:command"
    input_schema: dict = field(default_factory=dict)
    source: str = ""           # "openclaw" = auto-generated; "" = manual


@dataclass
class Config:
    node_id: str = ""
    node_name: str = ""
    server: str = DEFAULT_SERVER
    port: int = DEFAULT_PORT
    skills: list[SkillConfig] = field(default_factory=list)


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
    """Load config from ~/.catbus/config.yaml + node_id."""
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

        for s in raw.get("skills", []):
            config.skills.append(SkillConfig(
                name=s.get("name", ""),
                description=s.get("description", ""),
                handler=s.get("handler", ""),
                input_schema=s.get("input_schema", {}),
                source=s.get("source", ""),
            ))

    return config


def save_default_config(config: Config):
    """Write a default config.yaml."""
    ensure_home()
    data = {
        "server": config.server,
        "port": config.port,
        "name": config.node_name or f"node-{config.node_id[:6]}",
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
