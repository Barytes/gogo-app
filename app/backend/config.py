from __future__ import annotations

import os
import shutil
from pathlib import Path

from dotenv import load_dotenv


APP_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_KNOWLEDGE_BASE_DIR = APP_ROOT.parent / "knowledge-base"

load_dotenv(APP_ROOT / ".env")


def get_knowledge_base_dir() -> Path:
    raw_path = os.getenv("KNOWLEDGE_BASE_DIR")
    base_dir = Path(raw_path).expanduser() if raw_path else DEFAULT_KNOWLEDGE_BASE_DIR
    return base_dir.resolve()


def get_pi_node_command() -> str:
    return os.getenv("PI_NODE_COMMAND", "node").strip() or "node"


def get_pi_timeout_seconds() -> int:
    raw_value = os.getenv("PI_TIMEOUT_SECONDS", "180").strip()
    try:
        return max(10, int(raw_value))
    except ValueError:
        return 180


def get_pi_thinking_level() -> str:
    allowed = {"off", "minimal", "low", "medium", "high", "xhigh"}
    value = os.getenv("PI_THINKING_LEVEL", "medium").strip().lower()
    if value in allowed:
        return value
    return "medium"


def get_pi_workdir() -> Path:
    raw_path = os.getenv("PI_WORKDIR")
    if raw_path:
        return Path(raw_path).expanduser().resolve()
    return get_knowledge_base_dir()


def get_pi_node_command_path() -> str | None:
    configured = shutil.which(get_pi_node_command())
    if configured:
        return configured
    return shutil.which("node")


def get_pi_sdk_bridge_path() -> Path:
    return APP_ROOT / "app" / "backend" / "pi_sdk_bridge.mjs"


def get_session_event_store_dir() -> Path:
    raw_path = os.getenv("SESSION_EVENT_STORE_DIR")
    if raw_path:
        return Path(raw_path).expanduser().resolve()
    return (APP_ROOT.parent / ".gogo-sessions").resolve()
