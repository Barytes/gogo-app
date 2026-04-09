from __future__ import annotations

import os
import shutil
import shlex
from pathlib import Path

from dotenv import load_dotenv


APP_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_KNOWLEDGE_BASE_DIR = APP_ROOT.parent / "knowledge-base"
DEFAULT_MY_AGENT_LOOP_DIR = APP_ROOT.parent / "my-agent-loop"

load_dotenv(APP_ROOT / ".env")


def get_knowledge_base_dir() -> Path:
    raw_path = os.getenv("KNOWLEDGE_BASE_DIR")
    base_dir = Path(raw_path).expanduser() if raw_path else DEFAULT_KNOWLEDGE_BASE_DIR
    return base_dir.resolve()


def get_agent_mode() -> str:
    return os.getenv("AGENT_MODE", "mock").strip().lower()


def get_pi_command() -> str:
    return os.getenv("PI_COMMAND", "pi").strip() or "pi"


def get_pi_timeout_seconds() -> int:
    raw_value = os.getenv("PI_TIMEOUT_SECONDS", "180").strip()
    try:
        return max(10, int(raw_value))
    except ValueError:
        return 180


def get_pi_workdir() -> Path:
    raw_path = os.getenv("PI_WORKDIR")
    if raw_path:
        return Path(raw_path).expanduser().resolve()
    return get_knowledge_base_dir()


def get_pi_extra_args() -> list[str]:
    raw_value = os.getenv("PI_EXTRA_ARGS", "").strip()
    if not raw_value:
        return []
    return shlex.split(raw_value)


def get_pi_command_path() -> str | None:
    configured = shutil.which(get_pi_command())
    if configured:
        return configured
    for candidate in ("pi-agent", "pi"):
        discovered = shutil.which(candidate)
        if discovered:
            return discovered
    return None


def get_my_agent_loop_dir() -> Path:
    raw_path = os.getenv("MY_AGENT_LOOP_DIR")
    base_dir = Path(raw_path).expanduser() if raw_path else DEFAULT_MY_AGENT_LOOP_DIR
    return base_dir.resolve()


def get_my_agent_loop_model() -> str | None:
    value = os.getenv("MY_AGENT_LOOP_MODEL", "").strip()
    return value or None
