from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import time
from pathlib import Path
from typing import Any

from dotenv import load_dotenv


_APP_ROOT_ENV = os.getenv("GOGO_APP_ROOT")
APP_ROOT = (
    Path(_APP_ROOT_ENV).expanduser().resolve()
    if _APP_ROOT_ENV
    else Path(__file__).resolve().parents[2]
)
_DEFAULT_KNOWLEDGE_BASE_DIR_ENV = os.getenv("GOGO_DEFAULT_KNOWLEDGE_BASE_DIR")
DEFAULT_KNOWLEDGE_BASE_DIR = (
    Path(_DEFAULT_KNOWLEDGE_BASE_DIR_ENV).expanduser().resolve()
    if _DEFAULT_KNOWLEDGE_BASE_DIR_ENV
    else (APP_ROOT.parent / "knowledge-base").resolve()
)
_COMPANION_KNOWLEDGE_BASE_TEMPLATE_DIR_ENV = os.getenv("GOGO_COMPANION_KNOWLEDGE_BASE_TEMPLATE_DIR")
COMPANION_KNOWLEDGE_BASE_TEMPLATE_DIR = (
    Path(_COMPANION_KNOWLEDGE_BASE_TEMPLATE_DIR_ENV).expanduser().resolve()
    if _COMPANION_KNOWLEDGE_BASE_TEMPLATE_DIR_ENV
    else DEFAULT_KNOWLEDGE_BASE_DIR
)
_APP_STATE_DIR_ENV = os.getenv("GOGO_APP_STATE_DIR")
APP_STATE_DIR = (
    Path(_APP_STATE_DIR_ENV).expanduser().resolve()
    if _APP_STATE_DIR_ENV
    else (APP_ROOT.parent / ".gogo").resolve()
)
APP_SETTINGS_FILE = APP_STATE_DIR / "app-settings.json"
PI_AGENT_DIR = Path.home() / ".pi" / "agent"
PI_AUTH_FILE = PI_AGENT_DIR / "auth.json"
PI_SETTINGS_FILE = PI_AGENT_DIR / "settings.json"
PI_EXTENSION_DIR = APP_STATE_DIR / "pi-extensions"
PI_MANAGED_PROVIDER_EXTENSION = PI_EXTENSION_DIR / "managed-providers.ts"
BUNDLED_PI_DIR = APP_ROOT / "pi-runtime"
PI_RUNTIME_DIR = APP_STATE_DIR / "pi-runtime"
MODEL_PROVIDER_PROFILES_KEY = "model_provider_profiles"
STARTUP_ONBOARDING_PENDING_KEY = "startup_onboarding_pending"
GOGO_RUNTIME = str(os.getenv("GOGO_RUNTIME") or "web").strip().lower() or "web"
PROVIDER_AUTH_MODE_DESKTOP = "desktop-pi-login"
PROVIDER_AUTH_MODE_MANUAL = "manual-tokens"
SUPPORTED_MODEL_APIS = [
    "openai-completions",
    "openai-responses",
    "anthropic-messages",
    "google-generative-ai",
]
OAUTH_PROVIDER_PRESETS = [
    {"id": "openai-codex", "label": "ChatGPT Plus/Pro (Codex)"},
    {"id": "google-antigravity", "label": "Google Antigravity"},
    {"id": "google-gemini-cli", "label": "Google Gemini CLI"},
    {"id": "github-copilot", "label": "GitHub Copilot"},
]
OAUTH_AUTH_MODES = [
    {"id": PROVIDER_AUTH_MODE_DESKTOP, "label": "桌面版 Pi 登录"},
    {"id": PROVIDER_AUTH_MODE_MANUAL, "label": "手动导入 token"},
]

load_dotenv(APP_ROOT / ".env")


def _load_json_file(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def _save_json_file(path: Path, data: Any, *, private: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    if private:
        try:
            path.chmod(0o600)
        except Exception:
            pass


def _load_app_settings() -> dict:
    loaded = _load_json_file(APP_SETTINGS_FILE, {})
    return loaded if isinstance(loaded, dict) else {}


def _save_app_settings(data: dict) -> None:
    _save_json_file(APP_SETTINGS_FILE, data)


def _load_pi_auth() -> dict[str, Any]:
    loaded = _load_json_file(PI_AUTH_FILE, {})
    return loaded if isinstance(loaded, dict) else {}


def _save_pi_auth(data: dict[str, Any]) -> None:
    _save_json_file(PI_AUTH_FILE, data, private=True)


def _load_pi_settings_json() -> dict[str, Any]:
    loaded = _load_json_file(PI_SETTINGS_FILE, {})
    return loaded if isinstance(loaded, dict) else {}


def _save_pi_settings_json(data: dict[str, Any]) -> None:
    _save_json_file(PI_SETTINGS_FILE, data)


def _trimmed(value: Any) -> str:
    return str(value or "").strip()


def _is_valid_knowledge_base_dir(path: Path) -> bool:
    return (
        path.exists()
        and path.is_dir()
        and (path / "wiki").is_dir()
        and (path / "raw").is_dir()
    )


def _ensure_default_knowledge_base_dir() -> Path:
    candidate = DEFAULT_KNOWLEDGE_BASE_DIR
    return _ensure_companion_knowledge_base_dir(candidate)


def _ensure_companion_knowledge_base_dir(candidate: Path) -> Path:
    candidate = candidate.resolve()
    if _is_valid_knowledge_base_dir(candidate):
        return candidate

    template_dir = COMPANION_KNOWLEDGE_BASE_TEMPLATE_DIR
    if not is_desktop_runtime() or not _is_valid_knowledge_base_dir(template_dir):
        return candidate

    candidate.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(
        template_dir,
        candidate,
        dirs_exist_ok=True,
        ignore=shutil.ignore_patterns(".git", ".obsidian", ".claude", "__pycache__", ".DS_Store"),
    )
    return candidate


def get_gogo_runtime() -> str:
    return "desktop" if GOGO_RUNTIME == "desktop" else "web"


def is_desktop_runtime() -> bool:
    return get_gogo_runtime() == "desktop"


def _resolve_knowledge_base_dir(raw_path: str | None) -> Path:
    if raw_path:
        base_dir = Path(raw_path).expanduser().resolve()
        return _ensure_companion_knowledge_base_dir(base_dir)
    return _ensure_default_knowledge_base_dir()


def get_knowledge_base_dir() -> Path:
    settings = _load_app_settings()
    raw_path = _trimmed(settings.get("knowledge_base_dir"))
    if raw_path:
        return _resolve_knowledge_base_dir(raw_path)
    env_path = os.getenv("KNOWLEDGE_BASE_DIR")
    return _resolve_knowledge_base_dir(env_path)


def _knowledge_base_display_name(path: Path) -> str:
    name = path.name.strip()
    return name or str(path)


def _knowledge_base_session_namespace(path: Path) -> str:
    slug_source = _knowledge_base_display_name(path).lower()
    slug = re.sub(r"[^a-z0-9\u4e00-\u9fff]+", "-", slug_source, flags=re.IGNORECASE).strip("-")
    slug = slug[:32] or "knowledge-base"
    digest = hashlib.sha1(str(path).encode("utf-8")).hexdigest()[:8]
    return f"{slug}-{digest}"


def get_knowledge_base_settings() -> dict[str, object]:
    path = get_knowledge_base_dir()
    settings = _load_app_settings()
    recent_items = settings.get("recent_knowledge_bases")
    recent_paths: list[dict[str, str]] = []
    if isinstance(recent_items, list):
        for item in recent_items:
            raw = _trimmed(item)
            if not raw:
                continue
            resolved = _resolve_knowledge_base_dir(raw)
            recent_paths.append(
                {
                    "path": str(resolved),
                    "name": _knowledge_base_display_name(resolved),
                }
            )
    deduped: list[dict[str, str]] = []
    seen: set[str] = set()
    current_path = str(path)
    for item in [{"path": current_path, "name": _knowledge_base_display_name(path)}, *recent_paths]:
        key = item["path"]
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)
    return {
        "path": current_path,
        "name": _knowledge_base_display_name(path),
        "session_namespace": _knowledge_base_session_namespace(path),
        "recent": deduped[:8],
    }


def get_startup_settings() -> dict[str, object]:
    settings = _load_app_settings()
    pending_raw = settings.get(STARTUP_ONBOARDING_PENDING_KEY)
    pending = bool(pending_raw) if isinstance(pending_raw, bool) else False
    knowledge_base_dir = get_knowledge_base_dir()
    return {
        "onboarding_pending": pending,
        "default_knowledge_base_dir": str(DEFAULT_KNOWLEDGE_BASE_DIR),
        "knowledge_base_dir": str(knowledge_base_dir),
        "using_default_knowledge_base_dir": knowledge_base_dir == DEFAULT_KNOWLEDGE_BASE_DIR,
    }


def complete_startup_onboarding() -> dict[str, object]:
    settings = _load_app_settings()
    settings[STARTUP_ONBOARDING_PENDING_KEY] = False
    _save_app_settings(settings)
    return get_startup_settings()


def set_knowledge_base_dir(raw_path: str) -> dict[str, object]:
    candidate = _resolve_knowledge_base_dir(raw_path.strip())
    if not candidate.exists() or not candidate.is_dir():
        raise ValueError("知识库路径不存在，或不是目录。")
    if not (candidate / "wiki").is_dir():
        raise ValueError("知识库目录下缺少 `wiki/` 子目录。")
    if not (candidate / "raw").is_dir():
        raise ValueError("知识库目录下缺少 `raw/` 子目录。")

    settings = _load_app_settings()
    settings["knowledge_base_dir"] = str(candidate)
    recent_items = settings.get("recent_knowledge_bases")
    recent_paths = [_trimmed(item) for item in recent_items] if isinstance(recent_items, list) else []
    recent_paths = [path for path in recent_paths if path and _resolve_knowledge_base_dir(path) != candidate]
    settings["recent_knowledge_bases"] = [str(candidate), *recent_paths][:8]
    _save_app_settings(settings)
    return get_knowledge_base_settings()


def get_pi_command() -> str:
    return os.getenv("PI_COMMAND", "pi").strip() or "pi"


def get_managed_pi_command_path() -> str | None:
    candidates = [
        PI_RUNTIME_DIR / "node_modules" / ".bin" / "pi",
        PI_RUNTIME_DIR / "node_modules" / ".bin" / "pi.cmd",
        PI_RUNTIME_DIR / "node_modules" / ".bin" / "pi.exe",
    ]
    for candidate in candidates:
        if candidate.exists():
            return str(candidate.resolve())
    return None


def get_bundled_pi_command_path() -> str | None:
    candidates = [
        BUNDLED_PI_DIR / "pi",
        BUNDLED_PI_DIR / "pi.exe",
        BUNDLED_PI_DIR / "pi.cmd",
    ]
    for candidate in candidates:
        if candidate.exists():
            return str(candidate.resolve())
    return None


def get_pi_command_path() -> str | None:
    bundled = get_bundled_pi_command_path()
    if bundled:
        return bundled
    managed = get_managed_pi_command_path()
    if managed:
        return managed
    configured = shutil.which(get_pi_command())
    if configured:
        return configured
    return shutil.which("pi")


def get_pi_timeout_seconds() -> int | None:
    raw_value = os.getenv("PI_TIMEOUT_SECONDS", "").strip().lower()
    if raw_value in {"", "0", "off", "none", "false", "no"}:
        return None
    try:
        parsed = int(raw_value)
    except ValueError:
        return None
    if parsed <= 0:
        return None
    return max(10, parsed)


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


def get_pi_rpc_session_dir() -> Path:
    raw_path = os.getenv("PI_RPC_SESSION_DIR")
    if raw_path:
        base_dir = Path(raw_path).expanduser().resolve()
    else:
        base_dir = (APP_STATE_DIR / "pi-rpc-sessions").resolve()
    return (base_dir / _knowledge_base_session_namespace(get_knowledge_base_dir())).resolve()


def _normalize_provider_key(raw_value: Any) -> str:
    normalized = _trimmed(raw_value).lower()
    normalized = re.sub(r"[^a-z0-9._-]+", "-", normalized).strip("-")
    return normalized


def _provider_display_name(provider_key: str, display_name: str = "") -> str:
    explicit = _trimmed(display_name)
    if explicit:
        return explicit
    for preset in OAUTH_PROVIDER_PRESETS:
        if preset["id"] == provider_key:
            return preset["label"]
    return provider_key or "未命名 Provider"


def _normalize_oauth_auth_mode(raw_value: Any, *, default: str = PROVIDER_AUTH_MODE_DESKTOP) -> str:
    normalized = _trimmed(raw_value).lower()
    if normalized == PROVIDER_AUTH_MODE_MANUAL:
        return PROVIDER_AUTH_MODE_MANUAL
    if normalized == PROVIDER_AUTH_MODE_DESKTOP:
        return PROVIDER_AUTH_MODE_DESKTOP
    return default


def _oauth_auth_mode_label(mode: str) -> str:
    normalized = _normalize_oauth_auth_mode(mode)
    for item in OAUTH_AUTH_MODES:
        if item["id"] == normalized:
            return item["label"]
    return normalized


def _is_known_oauth_preset(provider_key: str) -> bool:
    return any(item["id"] == provider_key for item in OAUTH_PROVIDER_PRESETS)


def _default_api_key_reference(provider_key: str) -> str:
    slug = re.sub(r"[^A-Z0-9]+", "_", provider_key.upper()).strip("_")
    slug = slug or "CUSTOM_PROVIDER"
    return f"GOGO_{slug}_API_KEY"


def _parse_model_flag(value: str, *, truthy: str, falsy: str) -> bool | None:
    normalized = _trimmed(value).lower()
    if not normalized:
        return None
    if normalized in {"1", "true", "yes", "y", truthy, "on"}:
        return True
    if normalized in {"0", "false", "no", "n", falsy, "off"}:
        return False
    return None


def _normalize_model_config_item(raw_item: Any) -> dict[str, Any] | None:
    if not isinstance(raw_item, dict):
        return None

    model_id = _trimmed(raw_item.get("id"))
    if not model_id:
        return None

    item: dict[str, Any] = {"id": model_id}

    name = _trimmed(raw_item.get("name"))
    if name:
        item["name"] = name

    if "reasoning" in raw_item:
        item["reasoning"] = bool(raw_item.get("reasoning"))

    raw_input = raw_item.get("input")
    if isinstance(raw_input, list):
        normalized_inputs = [
            _trimmed(value).lower()
            for value in raw_input
            if _trimmed(value).lower() in {"text", "image", "audio", "file"}
        ]
        if normalized_inputs:
            item["input"] = normalized_inputs

    for key in ("cost", "compat"):
        value = raw_item.get(key)
        if isinstance(value, dict) and value:
            item[key] = value

    for key in ("contextWindow", "maxTokens"):
        value = raw_item.get(key)
        if isinstance(value, int) and value > 0:
            item[key] = value

    for key, value in raw_item.items():
        if key in item or key in {"id", "name", "reasoning", "input", "cost", "compat", "contextWindow", "maxTokens"}:
            continue
        if isinstance(value, (str, bool, int, float)):
            item[key] = value
        elif isinstance(value, dict) and value:
            item[key] = value
        elif isinstance(value, list) and value:
            item[key] = value

    return item


def _extract_models_array_from_json(parsed: Any) -> list[Any] | None:
    if isinstance(parsed, list):
        return parsed

    if not isinstance(parsed, dict):
        return None

    raw_models = parsed.get("models")
    if isinstance(raw_models, list):
        return raw_models

    if isinstance(raw_models, dict):
        nested_models = raw_models.get("models")
        if isinstance(nested_models, list):
            return nested_models

        providers = raw_models.get("providers")
        if isinstance(providers, dict):
            for provider_config in providers.values():
                if not isinstance(provider_config, dict):
                    continue
                provider_models = provider_config.get("models")
                if isinstance(provider_models, list):
                    return provider_models

    providers = parsed.get("providers")
    if isinstance(providers, dict):
        for provider_config in providers.values():
            if not isinstance(provider_config, dict):
                continue
            provider_models = provider_config.get("models")
            if isinstance(provider_models, list):
                return provider_models

    return None


def _normalize_models_json_text(raw_value: Any) -> str:
    text = str(raw_value or "").strip()
    if not text:
        return ""
    if text.startswith("{") or text.startswith("["):
        return text
    if re.match(r'^"(?:[^"\\]|\\.)+"\s*:', text):
        return "{" + text + "}"
    return text


def _parse_models_json(raw_value: Any) -> list[dict[str, Any]] | None:
    text = _normalize_models_json_text(raw_value)
    if not text:
        return []
    if not text.startswith("{") and not text.startswith("["):
        return None

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError as exc:
        raise ValueError(f"模型 JSON 解析失败：{exc.msg}") from exc

    raw_models = _extract_models_array_from_json(parsed)
    if raw_models is None:
        raise ValueError(
            "模型配置必须是 JSON 对象，且包含 `models` 数组；也支持包含 `models.providers.<provider>.models` 的完整厂商配置。"
        )

    if not isinstance(raw_models, list):
        raise ValueError("模型配置中的 `models` 必须是数组。")

    models: list[dict[str, Any]] = []
    seen: set[str] = set()
    for raw_item in raw_models:
        item = _normalize_model_config_item(raw_item)
        if not item:
            continue
        model_id = item["id"]
        if model_id in seen:
            continue
        seen.add(model_id)
        models.append(item)
    return models


def _parse_models_text(raw_value: Any) -> list[dict[str, Any]]:
    parsed_json_models = _parse_models_json(raw_value)
    if parsed_json_models is not None:
        return parsed_json_models

    models: list[dict[str, Any]] = []
    seen: set[str] = set()
    for raw_line in str(raw_value or "").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        parts = [part.strip() for part in line.split("|")]
        model_id = parts[0]
        if not model_id or model_id in seen:
            continue
        seen.add(model_id)
        item: dict[str, Any] = {"id": model_id}
        if len(parts) > 1 and parts[1]:
            item["name"] = parts[1]
        reasoning = _parse_model_flag(parts[2] if len(parts) > 2 else "", truthy="reasoning", falsy="plain")
        if reasoning is not None:
            item["reasoning"] = reasoning
        image = _parse_model_flag(parts[3] if len(parts) > 3 else "", truthy="image", falsy="text")
        if image is True:
            item["input"] = ["text", "image"]
        elif image is False:
            item["input"] = ["text"]
        models.append(item)
    return models


def _serialize_models_text(models: Any) -> str:
    if not isinstance(models, list):
        return ""
    normalized = []
    for item in models:
        parsed = _normalize_model_config_item(item)
        if parsed:
            normalized.append(parsed)
    if not normalized:
        return ""
    return json.dumps({"models": normalized}, ensure_ascii=False, indent=2)


def _timestamp_ms() -> int:
    return int(time.time() * 1000)


def _coerce_ms(raw_value: Any) -> int | None:
    if raw_value in {None, ""}:
        return None
    try:
        parsed = int(raw_value)
    except (TypeError, ValueError):
        return None
    return parsed if parsed > 0 else None


def _escape_ts_string(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def _render_ts_value(value: Any, *, indent: int = 0) -> str:
    pad = " " * indent
    nested = " " * (indent + 2)
    if isinstance(value, str):
        return _escape_ts_string(value)
    if isinstance(value, bool):
        return "true" if value else "false"
    if value is None:
        return "undefined"
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, list):
        if not value:
            return "[]"
        items = ",\n".join(f"{nested}{_render_ts_value(item, indent=indent + 2)}" for item in value)
        return f"[\n{items}\n{pad}]"
    if isinstance(value, dict):
        if not value:
            return "{}"
        items = []
        for key, item in value.items():
            items.append(f"{nested}{key}: {_render_ts_value(item, indent=indent + 2)}")
        return "{\n" + ",\n".join(items) + f"\n{pad}" + "}"
    return _escape_ts_string(str(value))


def _managed_provider_profiles(settings: dict[str, Any]) -> list[dict[str, Any]]:
    raw_profiles = settings.get(MODEL_PROVIDER_PROFILES_KEY)
    if not isinstance(raw_profiles, list):
        return []
    profiles: list[dict[str, Any]] = []
    for item in raw_profiles:
        if not isinstance(item, dict):
            continue
        provider_key = _normalize_provider_key(item.get("provider_key"))
        if not provider_key:
            continue
        profile = dict(item)
        profile["provider_key"] = provider_key
        profiles.append(profile)
    return profiles


def _default_oauth_auth_mode(profile: dict[str, Any], auth_entry: dict[str, Any] | None = None) -> str:
    explicit = _trimmed(profile.get("auth_mode")).lower()
    if explicit in {PROVIDER_AUTH_MODE_DESKTOP, PROVIDER_AUTH_MODE_MANUAL}:
        return explicit
    if _trimmed(profile.get("base_url")):
        return PROVIDER_AUTH_MODE_MANUAL
    if auth_entry and _trimmed(auth_entry.get("type")).lower() == "oauth":
        return PROVIDER_AUTH_MODE_DESKTOP
    return PROVIDER_AUTH_MODE_DESKTOP


def _requires_extension(profile: dict[str, Any]) -> bool:
    config_kind = _trimmed(profile.get("config_kind")).lower()
    if config_kind == "api":
        return True
    return bool(_trimmed(profile.get("base_url")) and _trimmed(profile.get("api_type")))


def _build_provider_extension_config(profile: dict[str, Any]) -> dict[str, Any]:
    provider_key = _normalize_provider_key(profile.get("provider_key"))
    config_kind = _trimmed(profile.get("config_kind")).lower()
    models = _parse_models_text(profile.get("models_text"))
    config: dict[str, Any] = {
        "baseUrl": _trimmed(profile.get("base_url")),
        "api": _trimmed(profile.get("api_type")),
    }
    if config_kind == "api":
        config["apiKey"] = _default_api_key_reference(provider_key)
        if bool(profile.get("auth_header")):
            config["authHeader"] = True
    else:
        config["oauth"] = {
            "name": _provider_display_name(provider_key, _trimmed(profile.get("display_name"))),
            "__gogo_manual_token_bridge__": True,
        }
    if models:
        config["models"] = models
    return config


def _write_managed_provider_extension(settings: dict[str, Any]) -> None:
    profiles = [profile for profile in _managed_provider_profiles(settings) if _requires_extension(profile)]
    if not profiles:
        PI_MANAGED_PROVIDER_EXTENSION.unlink(missing_ok=True)
        return

    lines = [
        'import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";',
        "",
        "export default function (pi: ExtensionAPI) {",
    ]
    for profile in profiles:
        provider_key = _normalize_provider_key(profile.get("provider_key"))
        config = _build_provider_extension_config(profile)
        if config.get("oauth"):
            oauth_name = _provider_display_name(provider_key, _trimmed(profile.get("display_name")))
            oauth_block = [
                f"  pi.registerProvider({_escape_ts_string(provider_key)}, {{",
                f"    baseUrl: {_escape_ts_string(config['baseUrl'])},",
                f"    api: {_escape_ts_string(config['api'])},",
            ]
            if config.get("models"):
                oauth_block.append(f"    models: {_render_ts_value(config['models'], indent=4)},")
            oauth_block.extend(
                [
                    "    oauth: {",
                    f"      name: {_escape_ts_string(oauth_name)},",
                    "      async login(callbacks) {",
                    f"        const access = await callbacks.onPrompt({{ message: {_escape_ts_string(f'Paste access token for {oauth_name}:')} }});",
                    f"        const refresh = await callbacks.onPrompt({{ message: {_escape_ts_string(f'Optional refresh token for {oauth_name} (press Enter to skip):')} }});",
                    "        return {",
                    "          access,",
                    "          refresh: refresh || access,",
                    "          expires: Date.now() + 3600 * 1000,",
                    "        };",
                    "      },",
                    "      async refreshToken(credentials) {",
                    "        return credentials;",
                    "      },",
                    "      getApiKey(credentials) {",
                    "        return credentials.access;",
                    "      },",
                    "    },",
                    "  });",
                ]
            )
            lines.extend(oauth_block)
            continue

        rendered = _render_ts_value(config, indent=4)
        lines.append(f"  pi.registerProvider({_escape_ts_string(provider_key)}, {rendered});")

    lines.append("}")
    PI_EXTENSION_DIR.mkdir(parents=True, exist_ok=True)
    PI_MANAGED_PROVIDER_EXTENSION.write_text("\n".join(lines) + "\n", encoding="utf-8")


def get_pi_extension_paths() -> list[Path]:
    if PI_MANAGED_PROVIDER_EXTENSION.exists():
        return [PI_MANAGED_PROVIDER_EXTENSION]
    return []


def get_pi_extension_args() -> list[str]:
    args: list[str] = []
    for path in get_pi_extension_paths():
        args.extend(["--extension", str(path)])
    return args


def _profile_payload_from_profile(profile: dict[str, Any], auth_entry: dict[str, Any] | None) -> dict[str, Any]:
    provider_key = _normalize_provider_key(profile.get("provider_key"))
    config_kind = _trimmed(profile.get("config_kind")).lower() or "api"
    if config_kind == "oauth":
        auth_entry = auth_entry if isinstance(auth_entry, dict) else {}
        auth_mode = _default_oauth_auth_mode(profile, auth_entry)
        return {
            "provider_key": provider_key,
            "display_name": _provider_display_name(provider_key, _trimmed(profile.get("display_name"))),
            "config_kind": "oauth",
            "auth_mode": auth_mode,
            "auth_mode_label": _oauth_auth_mode_label(auth_mode),
            "managed": True,
            "detected": bool(auth_entry),
            "base_url": _trimmed(profile.get("base_url")),
            "api_type": _trimmed(profile.get("api_type")),
            "models_text": str(profile.get("models_text") or "").strip(),
            "model_count": len(_parse_models_text(profile.get("models_text"))),
            "oauth_connected": bool(_trimmed(auth_entry.get("access"))),
            "oauth_expires_at": _coerce_ms(auth_entry.get("expires")) or _coerce_ms(profile.get("oauth_expires_at")),
            "oauth_account_id": _trimmed(auth_entry.get("accountId")) or _trimmed(profile.get("oauth_account_id")),
            "oauth_email": _trimmed(auth_entry.get("email")) or _trimmed(profile.get("oauth_email")),
            "oauth_project_id": _trimmed(auth_entry.get("projectId")) or _trimmed(profile.get("oauth_project_id")),
            "updated_at": _coerce_ms(profile.get("updated_at")),
            "uses_extension": _requires_extension(profile),
        }
    auth_entry = auth_entry if isinstance(auth_entry, dict) else {}
    return {
        "provider_key": provider_key,
        "display_name": _provider_display_name(provider_key, _trimmed(profile.get("display_name"))),
        "config_kind": "api",
        "managed": True,
        "detected": True,
        "base_url": _trimmed(profile.get("base_url")),
        "api_type": _trimmed(profile.get("api_type")),
        "auth_header": bool(profile.get("auth_header")),
        "models_text": str(profile.get("models_text") or "").strip(),
        "model_count": len(_parse_models_text(profile.get("models_text"))),
        "credentials_configured": bool(_trimmed(auth_entry.get("key"))),
        "credential_type": _trimmed(auth_entry.get("type")),
        "updated_at": _coerce_ms(profile.get("updated_at")),
        "uses_extension": True,
    }


def get_model_provider_settings() -> dict[str, Any]:
    settings = _load_app_settings()
    auth_data = _load_pi_auth()
    pi_settings = _load_pi_settings_json()

    payloads: list[dict[str, Any]] = []
    seen: set[str] = set()
    for profile in _managed_provider_profiles(settings):
        provider_key = _normalize_provider_key(profile.get("provider_key"))
        if not provider_key or provider_key in seen:
            continue
        auth_entry = auth_data.get(provider_key) if isinstance(auth_data.get(provider_key), dict) else None
        payloads.append(_profile_payload_from_profile(profile, auth_entry))
        seen.add(provider_key)

    for provider_key, auth_entry in auth_data.items():
        if provider_key in seen or not isinstance(auth_entry, dict):
            continue
        if _trimmed(auth_entry.get("type")) != "oauth":
            continue
        payloads.append(
            {
                "provider_key": provider_key,
                "display_name": _provider_display_name(provider_key),
                "config_kind": "oauth",
                "auth_mode": PROVIDER_AUTH_MODE_DESKTOP,
                "auth_mode_label": _oauth_auth_mode_label(PROVIDER_AUTH_MODE_DESKTOP),
                "managed": False,
                "detected": True,
                "base_url": "",
                "api_type": "",
                "models_text": "",
                "model_count": 0,
                "oauth_connected": bool(_trimmed(auth_entry.get("access"))),
                "oauth_expires_at": _coerce_ms(auth_entry.get("expires")),
                "oauth_account_id": _trimmed(auth_entry.get("accountId")),
                "oauth_email": _trimmed(auth_entry.get("email")),
                "oauth_project_id": _trimmed(auth_entry.get("projectId")),
                "updated_at": None,
                "uses_extension": False,
            }
        )

    payloads.sort(key=lambda item: (not bool(item.get("managed")), str(item.get("display_name") or item.get("provider_key")).lower()))
    return {
        "profiles": payloads,
        "oauth_presets": OAUTH_PROVIDER_PRESETS,
        "oauth_auth_modes": OAUTH_AUTH_MODES,
        "api_types": SUPPORTED_MODEL_APIS,
        "capabilities": {
            "runtime": get_gogo_runtime(),
            "desktop_cli_login": is_desktop_runtime(),
            "manual_oauth_token_import": True,
        },
        "defaults": {
            "provider": _trimmed(pi_settings.get("defaultProvider")),
            "model": _trimmed(pi_settings.get("defaultModel")),
            "thinking_level": _trimmed(pi_settings.get("defaultThinkingLevel")),
        },
        "files": {
            "agent_dir": str(PI_AGENT_DIR),
            "auth_file": str(PI_AUTH_FILE),
            "settings_file": str(PI_SETTINGS_FILE),
            "managed_extension": str(PI_MANAGED_PROVIDER_EXTENSION),
        },
    }


def upsert_model_provider_profile(payload: dict[str, Any]) -> dict[str, Any]:
    config_kind = _trimmed(payload.get("config_kind")).lower()
    if config_kind not in {"api", "oauth"}:
        raise ValueError("config_kind 只能是 `api` 或 `oauth`。")

    provider_key = _normalize_provider_key(payload.get("provider_key"))
    if not provider_key:
        raise ValueError("provider_key 不能为空。")

    display_name = _provider_display_name(provider_key, _trimmed(payload.get("display_name")))
    settings = _load_app_settings()
    auth_data = _load_pi_auth()
    profiles = _managed_provider_profiles(settings)

    record: dict[str, Any] = {
        "provider_key": provider_key,
        "display_name": display_name,
        "config_kind": config_kind,
        "updated_at": _timestamp_ms(),
        "base_url": _trimmed(payload.get("base_url")),
        "api_type": _trimmed(payload.get("api_type")),
        "models_text": str(payload.get("models_text") or "").strip(),
    }

    if config_kind == "api":
        if record["api_type"] not in SUPPORTED_MODEL_APIS:
            raise ValueError("api_type 不受支持。")
        if not record["base_url"]:
            raise ValueError("API Provider 需要填写 base_url。")
        if not _parse_models_text(record["models_text"]):
            raise ValueError("API Provider 至少需要在模型配置 JSON 中提供一个模型。")
        record["auth_header"] = bool(payload.get("auth_header"))
        api_key = _trimmed(payload.get("api_key"))
        clear_secret = bool(payload.get("clear_secret"))
        if api_key:
            auth_data[provider_key] = {"type": "api_key", "key": api_key}
        elif clear_secret:
            auth_data.pop(provider_key, None)
    else:
        auth_mode = _normalize_oauth_auth_mode(payload.get("auth_mode"), default=PROVIDER_AUTH_MODE_DESKTOP)
        record["auth_mode"] = auth_mode
        existing_auth_entry = auth_data.get(provider_key) if isinstance(auth_data.get(provider_key), dict) else {}
        access_token = _trimmed(payload.get("access_token"))
        refresh_token = _trimmed(payload.get("refresh_token"))
        expires_at = _coerce_ms(payload.get("expires_at"))
        account_id = _trimmed(payload.get("account_id"))
        email = _trimmed(payload.get("email"))
        project_id = _trimmed(payload.get("project_id"))
        if auth_mode == PROVIDER_AUTH_MODE_DESKTOP:
            if record["base_url"]:
                raise ValueError("`桌面版 Pi 登录` 当前主要面向 Pi 已内置的 OAuth provider；自定义 OAuth provider 目前请改用“手动导入 token”。")
            if not _is_known_oauth_preset(provider_key) and _trimmed(existing_auth_entry.get("type")).lower() != "oauth":
                raise ValueError("当前 `桌面版 Pi 登录` 仅适用于 Pi 已内置或已存在的 OAuth provider。请先选择一个内置预设，或改用“手动导入 token”。")
        elif access_token or refresh_token or expires_at or account_id or email or project_id:
            next_auth: dict[str, Any] = {
                "type": "oauth",
                "access": access_token,
            }
            if refresh_token:
                next_auth["refresh"] = refresh_token
            if expires_at is not None:
                next_auth["expires"] = expires_at
            if account_id:
                next_auth["accountId"] = account_id
            if email:
                next_auth["email"] = email
            if project_id:
                next_auth["projectId"] = project_id
            auth_data[provider_key] = next_auth
        elif provider_key not in auth_data and not record["base_url"]:
            raise ValueError("OAuth Provider 至少需要提供 access token，或补充 extension 所需的 provider 配置。")
        record.update(
            {
                "oauth_expires_at": expires_at,
                "oauth_account_id": account_id,
                "oauth_email": email,
                "oauth_project_id": project_id,
            }
        )
        if record["base_url"] and record["api_type"] not in SUPPORTED_MODEL_APIS:
            raise ValueError("如果要为 OAuth Provider 生成 extension，api_type 必须受支持。")

    next_profiles: list[dict[str, Any]] = []
    replaced = False
    for item in profiles:
        if _normalize_provider_key(item.get("provider_key")) == provider_key:
            next_profiles.append(record)
            replaced = True
        else:
            next_profiles.append(item)
    if not replaced:
        next_profiles.append(record)
    settings[MODEL_PROVIDER_PROFILES_KEY] = next_profiles

    _save_app_settings(settings)
    _save_pi_auth(auth_data)
    _write_managed_provider_extension(settings)
    return get_model_provider_settings()


def delete_model_provider_profile(provider_key: str) -> dict[str, Any]:
    normalized_key = _normalize_provider_key(provider_key)
    if not normalized_key:
        raise ValueError("provider_key 不能为空。")

    settings = _load_app_settings()
    profiles = _managed_provider_profiles(settings)
    settings[MODEL_PROVIDER_PROFILES_KEY] = [
        item for item in profiles if _normalize_provider_key(item.get("provider_key")) != normalized_key
    ]
    _save_app_settings(settings)

    auth_data = _load_pi_auth()
    if normalized_key in auth_data:
        auth_data.pop(normalized_key, None)
        _save_pi_auth(auth_data)

    pi_settings = _load_pi_settings_json()
    if _trimmed(pi_settings.get("defaultProvider")) == normalized_key:
        pi_settings.pop("defaultProvider", None)
        pi_settings.pop("defaultModel", None)
        _save_pi_settings_json(pi_settings)

    _write_managed_provider_extension(settings)
    return get_model_provider_settings()
