from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import datetime
import logging
import mimetypes
import os
from pathlib import Path
import json
import platform
import shlex
import shutil
import subprocess
from urllib import error as urllib_error
from urllib import request as urllib_request
from urllib.parse import quote, unquote
import uuid

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .agent_service import get_agent_backend_status, run_agent_chat, stream_agent_chat, run_session_chat, stream_session_chat
from .config import (
    BUNDLED_PI_DIR,
    PI_RUNTIME_DIR,
    get_bundled_pi_command_path,
    delete_model_provider_profile,
    get_gogo_runtime,
    get_knowledge_base_dir,
    get_knowledge_base_settings,
    get_managed_pi_command_path,
    get_pi_command,
    get_model_provider_settings,
    get_pi_command_path,
    get_pi_extension_paths,
    get_pi_rpc_session_dir,
    get_pi_timeout_seconds,
    get_startup_settings,
    is_desktop_runtime,
    complete_startup_onboarding,
    set_knowledge_base_dir,
    upsert_model_provider_profile,
)
from .raw_service import (
    create_raw_file,
    delete_raw_file,
    get_raw_file,
    get_raw_file_path,
    list_raw_files,
    save_raw_file,
    search_raw_files,
)
from .security_service import create_pi_security_approval, get_pi_security_settings, update_pi_security_settings
from .skill_service import create_capability_file, delete_capability_file, get_capability_file, list_capability_entries, list_slash_commands, save_capability_file
from .wiki_service import create_page, delete_page, get_page, get_tree, list_pages, save_page, search_pages
from .session_manager import (
    get_session_pool,
    reset_session_pool,
)


_APP_ROOT_ENV = os.getenv("GOGO_APP_ROOT")
ROOT_DIR = (
    Path(_APP_ROOT_ENV).expanduser().resolve()
    if _APP_ROOT_ENV
    else Path(__file__).resolve().parents[2]
)
FRONTEND_DIR = ROOT_DIR / "app" / "frontend"
logger = logging.getLogger(__name__)
NO_SESSION_DEPRECATION_MESSAGE = (
    "No-session chat mode is deprecated; create a session first and call the session chat flow."
)
NO_SESSION_DEPRECATION_HEADERS = {
    "Deprecation": "true",
    "Warning": f'299 gogo-app "{NO_SESSION_DEPRECATION_MESSAGE}"',
}
UPLOAD_MAX_BYTES = 50 * 1024 * 1024
ALLOWED_UPLOAD_EXTENSIONS = {
    ".pdf",
    ".md",
    ".txt",
    ".doc",
    ".docx",
    ".ppt",
    ".pptx",
    ".xls",
    ".xlsx",
    ".csv",
    ".tsv",
    ".json",
    ".yaml",
    ".yml",
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
}
INBOX_TEXT_EXTENSIONS = {
    ".md",
    ".txt",
    ".json",
    ".yaml",
    ".yml",
    ".csv",
    ".tsv",
}
MARKDOWN_BROWSER_SOURCES = {"wiki", "raw", "inbox"}


def _safe_path_payload(path: Path) -> dict[str, object]:
    return {
        "path": str(path),
        "exists": path.exists(),
        "is_dir": path.is_dir(),
    }


def _desktop_bridge_url() -> str:
    return str(os.getenv("GOGO_DESKTOP_BRIDGE_URL") or "").strip()


def _post_to_desktop_bridge(path: str, payload: dict[str, object]) -> dict[str, object]:
    base_url = _desktop_bridge_url()
    if not base_url:
        raise RuntimeError("桌面桥地址缺失，无法调用 Tauri 登录桥。")
    url = f"{base_url.rstrip('/')}/{path.lstrip('/')}"
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = urllib_request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib_request.urlopen(request, timeout=10) as response:
            raw = response.read().decode("utf-8")
    except urllib_error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        try:
            parsed = json.loads(detail) if detail else {}
        except json.JSONDecodeError:
            parsed = {}
        clean_detail = parsed.get("detail") if isinstance(parsed, dict) else ""
        raise RuntimeError(str(clean_detail or detail or f"桌面桥返回 HTTP {exc.code}")) from exc
    except urllib_error.URLError as exc:
        raise RuntimeError(f"无法连接桌面桥：{exc.reason}") from exc

    if not raw.strip():
        return {}
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise RuntimeError("桌面桥返回了无法解析的响应。") from exc
    return data if isinstance(data, dict) else {}


def _shell_quote(value: str) -> str:
    return shlex.quote(str(value or ""))


def _build_direct_pi_shell_command() -> str:
    pi_parts = [_shell_quote(get_pi_command_path() or get_pi_command())]
    for path in get_pi_extension_paths():
        pi_parts.append("--extension")
        pi_parts.append(_shell_quote(str(path)))
    return " ; ".join(
        [
            f"cd {_shell_quote(str(ROOT_DIR))}",
            " ".join(pi_parts),
            "printf '\\nPi 已启动。若未自动触发登录，请输入设置面板提示中的 /login 命令。\\n'",
            "exec $SHELL -l",
        ]
    )


def _normalize_windows_shell_value(value: str) -> str:
    raw = str(value or "")
    if raw.startswith("\\\\?\\UNC\\"):
        return "\\\\" + raw[len("\\\\?\\UNC\\") :]
    if raw.startswith("\\\\?\\"):
        return raw[len("\\\\?\\") :]
    return raw


def _windows_cmd_quote(value: str) -> str:
    escaped = _normalize_windows_shell_value(value).replace('"', '""')
    return f'"{escaped}"'


def _is_windows_batch_script(value: str) -> bool:
    return Path(value).suffix.lower() in {".cmd", ".bat"}


def _build_direct_pi_cmd_command() -> str:
    pi_program = _normalize_windows_shell_value(get_pi_command_path() or get_pi_command())
    pi_parts = [
        f"call {_windows_cmd_quote(pi_program)}"
        if _is_windows_batch_script(pi_program)
        else _windows_cmd_quote(pi_program)
    ]
    for path in get_pi_extension_paths():
        pi_parts.append("--extension")
        pi_parts.append(_windows_cmd_quote(str(path)))

    return " && ".join(
        [
            f"cd /d {_windows_cmd_quote(str(ROOT_DIR))}",
            "echo.",
            "echo Pi 已启动。若未自动触发登录，请输入 /login 命令。",
            " ".join(pi_parts),
        ]
    )


def _windows_powershell_quote(value: str) -> str:
    escaped = _normalize_windows_shell_value(value).replace("'", "''")
    return f"'{escaped}'"


def _build_direct_pi_powershell_command() -> str:
    pi_program = _normalize_windows_shell_value(get_pi_command_path() or get_pi_command())
    pi_parts = ["&", _windows_powershell_quote(pi_program)]
    for path in get_pi_extension_paths():
        pi_parts.append("--extension")
        pi_parts.append(_windows_powershell_quote(str(path)))

    return "; ".join(
        [
            f"Set-Location -LiteralPath {_windows_powershell_quote(str(ROOT_DIR))}",
            "Write-Host ''",
            "Write-Host 'Pi started. If the login menu is not visible, type /login and press Enter.'",
            " ".join(pi_parts),
        ]
    )


def _run_windows_login_shell_keep_open(shell_command: str, cmd_fallback: str) -> None:
    creationflags = getattr(subprocess, "CREATE_NEW_CONSOLE", 0)
    powershell = shutil.which("powershell.exe") or shutil.which("powershell")
    if powershell:
        subprocess.Popen(
            [
                powershell,
                "-NoExit",
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-Command",
                shell_command,
            ],
            cwd=_normalize_windows_shell_value(str(ROOT_DIR)),
            creationflags=creationflags,
        )
        return

    subprocess.Popen(
        f"cmd.exe /K {cmd_fallback}",
        cwd=_normalize_windows_shell_value(str(ROOT_DIR)),
        creationflags=creationflags,
    )


def _run_osascript_lines(lines: list[str]) -> None:
    command = ["osascript"]
    for line in lines:
        command.extend(["-e", line])
    completed = subprocess.run(command, capture_output=True, text=True, check=False)
    if completed.returncode == 0:
        return
    detail = (completed.stderr or completed.stdout or "").strip()
    raise RuntimeError(detail or "调用 osascript 失败。")


def _applescript_escape(value: str) -> str:
    return str(value or "").replace("\\", "\\\\").replace('"', '\\"')


def _start_desktop_pi_login_direct() -> dict[str, object]:
    system = platform.system().lower()
    if system == "windows":
        shell_command = _build_direct_pi_powershell_command()
        _run_windows_login_shell_keep_open(shell_command, _build_direct_pi_cmd_command())
    elif system == "darwin":
        shell_command = _build_direct_pi_shell_command()
        _run_osascript_lines(
            [
                'tell application "Terminal" to activate',
                f'tell application "Terminal" to do script "{_applescript_escape(shell_command)}"',
            ]
        )
    else:
        raise RuntimeError("当前开发态兜底登录只实现了 macOS / Windows 终端拉起流程。")

    detail = "已打开 Pi 终端。请在终端里手动输入 `/login`，完成登录后 gogo-app 会自动刷新 Provider 状态。"

    return {
        "success": True,
        "detail": detail,
        "command_hint": "/login",
    }


def _local_pi_install_status() -> dict[str, object]:
    command = get_pi_command()
    command_path = get_pi_command_path()
    bundled_command_path = get_bundled_pi_command_path()
    managed_command_path = get_managed_pi_command_path()
    install_log_path = str(PI_RUNTIME_DIR / "install.log")
    command_source = ""
    if bundled_command_path and command_path == bundled_command_path:
        command_source = "bundled"
    elif managed_command_path and command_path == managed_command_path:
        command_source = "managed"
    elif command_path:
        command_source = "path"

    detail = "已检测到可用的 `pi` 命令。"
    if not command_path:
        detail = "当前未检测到可用的 `pi` 命令；桌面版会优先尝试使用随包分发的 binary，缺失时再通过本地 npm 安装到 gogo-app 的托管目录。"

    return {
        "platform": platform.system().lower(),
        "command": command,
        "command_path": command_path,
        "bundled_command_path": bundled_command_path,
        "managed_command_path": managed_command_path,
        "command_source": command_source,
        "bundled_runtime_dir": str(BUNDLED_PI_DIR),
        "runtime_dir": str(PI_RUNTIME_DIR),
        "install_log_path": install_log_path,
        "npm_command_path": None,
        "installed": bool(command_path),
        "install_supported": False,
        "install_in_progress": False,
        "detail": detail,
    }


def _get_pi_install_status() -> dict[str, object]:
    if not (is_desktop_runtime() and _desktop_bridge_url()):
        return _local_pi_install_status()

    try:
        payload = _post_to_desktop_bridge("/pi-status", {})
    except RuntimeError as exc:
        fallback = _local_pi_install_status()
        fallback["detail"] = str(exc) or str(fallback.get("detail") or "")
        return fallback

    if not isinstance(payload, dict):
        return _local_pi_install_status()
    return payload


def _build_settings_diagnostics() -> dict[str, object]:
    pool = get_session_pool()
    kb_dir = get_knowledge_base_dir()
    kb_settings = get_knowledge_base_settings()
    agent_status = get_agent_backend_status()
    provider_settings = get_model_provider_settings()
    security_settings = get_pi_security_settings()
    pi_install = _get_pi_install_status()
    session_dir = get_pi_rpc_session_dir()
    extension_paths = [str(path) for path in get_pi_extension_paths()]

    runtime_state: dict[str, object] = {}
    runtime_models: list[dict[str, object]] = []
    runtime_error = ""
    try:
        runtime = pool.get_runtime_options()
        raw_state = runtime.get("state")
        raw_models = runtime.get("models")
        runtime_state = raw_state if isinstance(raw_state, dict) else {}
        runtime_models = raw_models if isinstance(raw_models, list) else []
    except Exception as exc:
        runtime_error = str(exc)

    current_model = runtime_state.get("model") if isinstance(runtime_state.get("model"), dict) else {}
    model_provider_count = len(
        {
            str(item.get("provider") or "").strip()
            for item in runtime_models
            if isinstance(item, dict) and str(item.get("provider") or "").strip()
        }
    )
    provider_profiles = provider_settings.get("profiles")
    provider_profiles = provider_profiles if isinstance(provider_profiles, list) else []

    return {
        "generated_at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "health": {
            "status": "ok",
            "runtime": get_gogo_runtime(),
            "desktop_runtime": is_desktop_runtime(),
            "agent_mode": agent_status.get("mode"),
            "pi_backend_mode": agent_status.get("pi_backend_mode"),
            "pi_rpc_available": bool(agent_status.get("pi_rpc_available")),
            "pi_installed": bool(pi_install.get("installed")),
            "runtime_options_ok": not runtime_error,
        },
        "knowledge_base": {
            "name": kb_settings.get("name"),
            "path": kb_settings.get("path"),
            "session_namespace": kb_settings.get("session_namespace"),
            "wiki_dir": _safe_path_payload(kb_dir / "wiki"),
            "raw_dir": _safe_path_payload(kb_dir / "raw"),
            "inbox_dir": _safe_path_payload(kb_dir / "inbox"),
        },
        "sessions": {
            "pool_count": pool.get_session_count(),
            "session_dir": _safe_path_payload(session_dir),
        },
        "providers": {
            "profile_count": len(provider_profiles),
            "managed_count": sum(1 for item in provider_profiles if bool(item.get("managed"))),
            "oauth_connected_count": sum(1 for item in provider_profiles if bool(item.get("oauth_connected"))),
            "defaults": provider_settings.get("defaults") or {},
            "extension_paths": extension_paths,
        },
        "security": security_settings,
        "pi_runtime": {
            "command": agent_status.get("pi_command"),
            "command_path": agent_status.get("pi_command_path"),
            "timeout_seconds": get_pi_timeout_seconds(),
            "workdir": agent_status.get("pi_workdir"),
            "default_thinking_level": agent_status.get("pi_thinking_level"),
            "current_provider": str(current_model.get("provider") or "").strip() or str(runtime_state.get("provider") or "").strip(),
            "current_model_id": str(current_model.get("id") or current_model.get("modelId") or runtime_state.get("modelId") or "").strip(),
            "current_model_name": str(current_model.get("name") or "").strip(),
            "current_thinking_level": str(runtime_state.get("thinkingLevel") or "").strip(),
            "available_model_count": len(runtime_models),
            "available_provider_count": model_provider_count,
            "runtime_error": runtime_error,
        },
        "pi_install": pi_install,
    }


class NoCacheStaticFiles(StaticFiles):
    def file_response(self, *args, **kwargs):
        response = super().file_response(*args, **kwargs)
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        return response


class ChatTurn(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    session_id: str = Field(..., min_length=1, description="Session ID（必填，用于多轮对话）")
    request_id: str | None = Field(default=None, description="请求 ID（可选）")


class SessionChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    request_id: str | None = Field(default=None, description="请求 ID（可选）")


class LegacyChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    history: list[ChatTurn] = Field(default_factory=list)
    request_id: str | None = Field(default=None, description="请求 ID（可选）")


class CreateSessionRequest(BaseModel):
    title: str = Field(default="", description="会话标题")
    system_prompt: str = Field(default="", description="系统提示词")
    thinking_level: str = Field(default="", description="初始思考水平")
    model_provider: str = Field(default="", description="初始模型 provider")
    model_id: str = Field(default="", description="初始模型 ID")


class UpdateSessionRequest(BaseModel):
    title: str = Field(..., description="会话标题")


class UpdateSessionSettingsRequest(BaseModel):
    thinking_level: str | None = Field(default=None, description="思考水平")
    model_provider: str | None = Field(default=None, description="模型 provider")
    model_id: str | None = Field(default=None, description="模型 ID")


class CompactSessionRequest(BaseModel):
    custom_instructions: str = Field(default="", description="可选：compact 时附带的额外说明")


class UpdateKnowledgeBaseRequest(BaseModel):
    path: str = Field(..., min_length=1, description="本地知识库路径")


class UpdatePiSecurityRequest(BaseModel):
    mode: str = Field(..., description="安全模式：readonly / workspace-write / full-access")


class CreatePiSecurityApprovalRequest(BaseModel):
    tool_name: str = Field(..., description="工具名称：bash / write / edit")
    command: str = Field(default="", description="需要单次放行的 bash 命令")
    path: str = Field(default="", description="需要单次放行的原始路径")
    resolved_path: str = Field(default="", description="前端已解析出的绝对路径")


class ExtensionUiResponseRequest(BaseModel):
    id: str = Field(..., min_length=1, description="Pi extension_ui_request 的 id")
    value: str | None = Field(default=None, description="select / input / editor 的返回值")
    confirmed: bool | None = Field(default=None, description="confirm 的布尔结果")
    cancelled: bool = Field(default=False, description="是否取消当前交互")


class UpsertModelProviderRequest(BaseModel):
    config_kind: str = Field(..., description="Provider 配置类型：api 或 oauth")
    auth_mode: str = Field(default="", description="OAuth 认证方式：desktop-pi-login 或 manual-tokens")
    provider_key: str = Field(..., min_length=1, description="Provider 标识")
    display_name: str = Field(default="", description="展示名称")
    base_url: str = Field(default="", description="Provider 基础 URL")
    api_type: str = Field(default="", description="Provider API 类型")
    models_text: str = Field(default="", description="模型配置 JSON 文本")
    auth_header: bool = Field(default=False, description="是否自动附加 Bearer Authorization")
    api_key: str = Field(default="", description="API key")
    clear_secret: bool = Field(default=False, description="是否清除已保存的 API key")
    access_token: str = Field(default="", description="OAuth access token")
    refresh_token: str = Field(default="", description="OAuth refresh token")
    expires_at: int | None = Field(default=None, description="OAuth 过期时间（毫秒时间戳）")
    account_id: str = Field(default="", description="OAuth accountId（可选）")
    email: str = Field(default="", description="OAuth email（可选）")
    project_id: str = Field(default="", description="OAuth projectId（可选）")


class CapabilityFileUpdateRequest(BaseModel):
    path: str = Field(..., min_length=1, description="skills/ 或 schemas/ 下的相对路径")
    content: str = Field(default="", description="新的文件内容")


class CreateCapabilityFileRequest(BaseModel):
    source: str = Field(..., min_length=1, description="skill 或 schema")
    name: str = Field(..., min_length=1, description="显示名称")
    description: str = Field(default="", description="可选描述")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    pool = get_session_pool()
    await pool.start_cleanup_loop()
    logger.info("Session cleanup loop started")
    try:
        yield
    finally:
        reset_session_pool()
        logger.info("Session pool reset and cleanup loop stopped")


app = FastAPI(
    title="Research Knowledge Base MVP",
    description="FastAPI backend for a lightweight chat and wiki browser MVP.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/assets", NoCacheStaticFiles(directory=FRONTEND_DIR / "assets"), name="assets")


def _dump_turn(turn: ChatTurn) -> dict[str, str]:
    if hasattr(turn, "model_dump"):
        return turn.model_dump()
    return turn.dict()


def _resolve_request_id(raw_request_id: str | None) -> str:
    if raw_request_id and raw_request_id.strip():
        return raw_request_id.strip()
    return str(uuid.uuid4())


def _normalize_context_usage(raw_usage: object) -> dict[str, object] | None:
    if not isinstance(raw_usage, dict):
        return None

    tokens = raw_usage.get("tokens")
    context_window = raw_usage.get("contextWindow")
    percent = raw_usage.get("percent")

    normalized: dict[str, object] = {}
    if isinstance(tokens, (int, float)):
        normalized["tokens"] = max(0, int(tokens))
    elif tokens is None:
        normalized["tokens"] = None

    if isinstance(context_window, (int, float)):
        normalized["contextWindow"] = max(0, int(context_window))

    if isinstance(percent, (int, float)):
        normalized["percent"] = max(0.0, min(100.0, float(percent)))
    elif (
        isinstance(normalized.get("tokens"), int)
        and isinstance(normalized.get("contextWindow"), int)
        and int(normalized["contextWindow"]) > 0
    ):
        normalized["percent"] = min(
            100.0,
            max(0.0, (int(normalized["tokens"]) / int(normalized["contextWindow"])) * 100.0),
        )
    else:
        normalized["percent"] = None

    return normalized or None


def _session_payload_with_runtime(session_id: str, *, pool=None) -> dict[str, object]:
    active_pool = pool or get_session_pool()
    session = active_pool.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session not found: {session_id}")

    payload = session.info.to_dict()

    try:
        stats = active_pool.get_session_stats(session_id)
    except Exception:
        logger.warning("Failed to load session stats for %s", session_id, exc_info=True)
        stats = {}

    payload["context_usage"] = _normalize_context_usage(stats.get("contextUsage"))
    tokens = stats.get("tokens")
    payload["token_usage"] = tokens if isinstance(tokens, dict) else None
    return payload


def _frontend_file_response(path: Path) -> FileResponse:
    return FileResponse(
        path,
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )


def _safe_inbox_filename(raw_name: str) -> str:
    filename = Path(str(raw_name or "").strip()).name
    if not filename or filename in {".", ".."}:
        raise HTTPException(status_code=400, detail="上传文件缺少有效文件名。")
    suffix = Path(filename).suffix.lower()
    if suffix not in ALLOWED_UPLOAD_EXTENSIONS:
        allowed = ", ".join(sorted(ALLOWED_UPLOAD_EXTENSIONS))
        raise HTTPException(
            status_code=400,
            detail=f"暂不支持该文件类型。支持的扩展名：{allowed}",
        )
    return filename


def _allocate_inbox_path(inbox_dir: Path, filename: str) -> Path:
    candidate = inbox_dir / filename
    if not candidate.exists():
        return candidate
    stem = Path(filename).stem
    suffix = Path(filename).suffix
    for index in range(1, 1000):
        next_candidate = inbox_dir / f"{stem}-{index}{suffix}"
        if not next_candidate.exists():
            return next_candidate
    raise HTTPException(status_code=500, detail="无法为上传文件分配唯一文件名。")


def _build_ingest_prompt(inbox_relative_path: str, knowledge_base_name: str) -> str:
    return f"请ingest一下inbox的内容。"


def _inbox_type_info(path: Path) -> tuple[str, str]:
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        return "paper_candidate", "PDF / 论文或资料"
    if suffix in {".md", ".txt"}:
        return "notes", "Markdown / 文本"
    if suffix in {".doc", ".docx"}:
        return "document", "文档"
    if suffix in {".ppt", ".pptx"}:
        return "slides", "Slides"
    if suffix in {".xls", ".xlsx", ".csv", ".tsv"}:
        return "table", "表格 / 数据"
    if suffix in {".json", ".yaml", ".yml"}:
        return "structured", "结构化文件"
    if suffix in {".png", ".jpg", ".jpeg", ".webp"}:
        return "image", "图片"
    return "unknown", "待分类"


def _should_show_inbox_file(path: Path, *, inbox_dir: Path) -> bool:
    name = path.name.strip()
    if not name:
        return False
    if name.startswith("."):
        return False
    relative = path.relative_to(inbox_dir)
    if len(relative.parts) == 1 and name.lower() == "readme.md":
        return False
    return True


def _inbox_item_payload(path: Path, *, inbox_dir: Path, knowledge_base_name: str) -> dict[str, object]:
    stat = path.stat()
    relative = f"inbox/{path.relative_to(inbox_dir).as_posix()}"
    kind, type_label = _inbox_type_info(path)
    rel_parent = path.parent.relative_to(inbox_dir).as_posix()
    content_type = _guess_inbox_content_type(path)
    is_text = _is_inbox_textual(path)
    return {
        "source": "inbox",
        "name": path.name,
        "title": path.name,
        "path": relative,
        "summary": _inbox_summary(path),
        "category": "inbox",
        "section": rel_parent if rel_parent not in {"", "."} else "root",
        "kind": kind,
        "type_label": type_label,
        "extension": path.suffix.lower(),
        "content_type": content_type,
        "is_text": is_text,
        "render_mode": _inbox_render_mode(path, content_type),
        "download_url": f"/inbox/file?path={quote(relative, safe='/')}",
        "preview_url": (
            f"/inbox/file?path={quote(relative, safe='/')}"
            if content_type == "application/pdf" or content_type.startswith("image/")
            else None
        ),
        "size": stat.st_size,
        "size_bytes": stat.st_size,
        "modified_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
        "status": "pending",
        "status_label": "待 ingest",
        "ingest_prompt": _build_ingest_prompt(
            inbox_relative_path=relative,
            knowledge_base_name=knowledge_base_name,
        ),
    }


def _resolve_inbox_path(raw_path: str, *, inbox_dir: Path) -> Path:
    candidate = str(raw_path or "").strip()
    if not candidate:
        raise HTTPException(status_code=400, detail="缺少待删除的 inbox 文件路径。")

    if candidate.startswith("inbox/"):
        candidate = candidate[len("inbox/") :]

    resolved = (inbox_dir / Path(candidate)).resolve()
    inbox_root = inbox_dir.resolve()
    try:
        resolved.relative_to(inbox_root)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="非法的 inbox 文件路径。") from exc

    if not resolved.exists() or not resolved.is_file():
        raise HTTPException(status_code=404, detail="指定的 inbox 文件不存在。")

    return resolved


def _resolve_inbox_target_path(raw_path: str, *, inbox_dir: Path) -> Path:
    candidate = str(raw_path or "").strip()
    if not candidate:
        raise HTTPException(status_code=400, detail="缺少 Markdown 文件路径。")

    if candidate.startswith("inbox/"):
        candidate = candidate[len("inbox/") :]

    resolved = (inbox_dir / Path(candidate)).resolve()
    inbox_root = inbox_dir.resolve()
    try:
        resolved.relative_to(inbox_root)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="非法的 inbox 文件路径。") from exc

    if resolved.suffix.lower() != ".md":
        raise HTTPException(status_code=400, detail="Inbox 里目前只支持创建和保存 .md 文件。")

    return resolved


def _write_text_file(path: Path, content: str) -> None:
    normalized_content = str(content).replace("\r\n", "\n")
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = path.with_name(f".{path.name}.tmp")
    temp_path.write_text(normalized_content, encoding="utf-8")
    temp_path.replace(path)


def _guess_inbox_content_type(path: Path) -> str:
    guessed, _ = mimetypes.guess_type(path.name)
    return guessed or "application/octet-stream"


def _is_inbox_textual(path: Path) -> bool:
    return path.suffix.lower() in INBOX_TEXT_EXTENSIONS


def _read_inbox_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


def _summary_from_text(text: str) -> str:
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith(("#", "-", "*", ">", "`")):
            continue
        return stripped[:180]
    return "No summary available yet."


def _inbox_summary(path: Path) -> str:
    if _is_inbox_textual(path):
        return _summary_from_text(_read_inbox_text(path))

    content_type = _guess_inbox_content_type(path)
    if content_type == "application/pdf":
        return "PDF material in inbox."
    if content_type.startswith("image/"):
        return "Image file in inbox."
    return f"{content_type} file in inbox."


def _inbox_render_mode(path: Path, content_type: str) -> str:
    if path.suffix.lower() == ".md":
        return "markdown"
    if _is_inbox_textual(path):
        return "text"
    if content_type == "application/pdf":
        return "pdf"
    if content_type.startswith("image/"):
        return "image"
    return "binary"


def _knowledge_base_name_for_inbox(kb_dir: Path) -> str:
    kb_settings = get_knowledge_base_settings()
    return str(kb_settings.get("name") or Path(kb_dir).name)


def _list_inbox_browser_items(*, include_content: bool = False) -> list[dict[str, object]]:
    kb_dir = get_knowledge_base_dir()
    inbox_dir = kb_dir / "inbox"
    inbox_dir.mkdir(parents=True, exist_ok=True)
    knowledge_base_name = _knowledge_base_name_for_inbox(kb_dir)

    items: list[dict[str, object]] = []
    for path in sorted(
        [
            item
            for item in inbox_dir.rglob("*")
            if item.is_file() and _should_show_inbox_file(item, inbox_dir=inbox_dir)
        ],
        key=lambda item: item.stat().st_mtime,
        reverse=True,
    ):
        payload = _inbox_item_payload(
            path,
            inbox_dir=inbox_dir,
            knowledge_base_name=knowledge_base_name,
        )
        if include_content and payload.get("is_text"):
            payload["content"] = _read_inbox_text(path)
        items.append(payload)
    return items


def _get_inbox_browser_item(raw_path: str, *, include_content: bool = True) -> dict[str, object]:
    kb_dir = get_knowledge_base_dir()
    inbox_dir = kb_dir / "inbox"
    inbox_dir.mkdir(parents=True, exist_ok=True)
    knowledge_base_name = _knowledge_base_name_for_inbox(kb_dir)
    path = _resolve_inbox_path(raw_path, inbox_dir=inbox_dir)
    payload = _inbox_item_payload(
        path,
        inbox_dir=inbox_dir,
        knowledge_base_name=knowledge_base_name,
    )
    if include_content and payload.get("is_text"):
        payload["content"] = _read_inbox_text(path)
    return payload


def _search_inbox_browser_items(query: str, *, limit: int = 20) -> list[dict[str, object]]:
    normalized_query = str(query or "").strip().lower()
    if not normalized_query:
        return _list_inbox_browser_items()[:limit]

    matches: list[dict[str, object]] = []
    for item in _list_inbox_browser_items(include_content=True):
        haystacks = [
            str(item.get("title") or "").lower(),
            str(item.get("path") or "").lower(),
            str(item.get("summary") or "").lower(),
            str(item.get("type_label") or "").lower(),
            str(item.get("kind") or "").lower(),
            str(item.get("content") or "").lower(),
        ]
        if any(normalized_query in haystack for haystack in haystacks if haystack):
            item_copy = dict(item)
            item_copy.pop("content", None)
            matches.append(item_copy)
        if len(matches) >= limit:
            break
    return matches


def _normalize_markdown_browser_source(source: str) -> str:
    normalized = str(source or "").strip().lower()
    if normalized not in MARKDOWN_BROWSER_SOURCES:
        raise HTTPException(status_code=400, detail="Markdown 只支持保存到 wiki、raw 或 inbox。")
    return normalized


def _create_inbox_markdown_file(relative_path: str, content: str = "") -> dict[str, object]:
    kb_dir = get_knowledge_base_dir()
    inbox_dir = kb_dir / "inbox"
    inbox_dir.mkdir(parents=True, exist_ok=True)
    target_path = _resolve_inbox_target_path(relative_path, inbox_dir=inbox_dir)
    if target_path.exists():
        raise FileExistsError(relative_path)
    _write_text_file(target_path, content)
    return _get_inbox_browser_item(f"inbox/{target_path.relative_to(inbox_dir).as_posix()}", include_content=True)


def _save_inbox_markdown_file(relative_path: str, content: str) -> dict[str, object]:
    kb_dir = get_knowledge_base_dir()
    inbox_dir = kb_dir / "inbox"
    inbox_dir.mkdir(parents=True, exist_ok=True)
    target_path = _resolve_inbox_target_path(relative_path, inbox_dir=inbox_dir)
    if not target_path.exists() or not target_path.is_file():
        raise FileNotFoundError(relative_path)
    _write_text_file(target_path, content)
    return _get_inbox_browser_item(f"inbox/{target_path.relative_to(inbox_dir).as_posix()}", include_content=True)


def _delete_inbox_markdown_file(relative_path: str) -> dict[str, object]:
    kb_dir = get_knowledge_base_dir()
    inbox_dir = kb_dir / "inbox"
    inbox_dir.mkdir(parents=True, exist_ok=True)
    target_path = _resolve_inbox_target_path(relative_path, inbox_dir=inbox_dir)
    if not target_path.exists() or not target_path.is_file():
        raise FileNotFoundError(relative_path)

    record = _get_inbox_browser_item(f"inbox/{target_path.relative_to(inbox_dir).as_posix()}", include_content=False)
    target_path.unlink()

    for parent in target_path.parents:
        if parent == inbox_dir:
            break
        try:
            parent.rmdir()
        except OSError:
            break

    return record


def _create_markdown_browser_file(source: str, relative_path: str, content: str = "") -> dict[str, object]:
    normalized_source = _normalize_markdown_browser_source(source)
    if normalized_source == "wiki":
        return create_page(relative_path, content)
    if normalized_source == "raw":
        return create_raw_file(relative_path, content)
    return _create_inbox_markdown_file(relative_path, content)


def _save_markdown_browser_file(source: str, relative_path: str, content: str) -> dict[str, object]:
    normalized_source = _normalize_markdown_browser_source(source)
    if normalized_source == "wiki":
        return save_page(relative_path, content)
    if normalized_source == "raw":
        return save_raw_file(relative_path, content)
    return _save_inbox_markdown_file(relative_path, content)


def _delete_markdown_browser_file(source: str, relative_path: str) -> dict[str, object]:
    normalized_source = _normalize_markdown_browser_source(source)
    if normalized_source == "wiki":
        return delete_page(relative_path)
    if normalized_source == "raw":
        return delete_raw_file(relative_path)
    return _delete_inbox_markdown_file(relative_path)


@app.get("/", include_in_schema=False)
def landing_page() -> FileResponse:
    return _frontend_file_response(FRONTEND_DIR / "index.html")


@app.get("/chat", include_in_schema=False)
def chat_page() -> FileResponse:
    return _frontend_file_response(FRONTEND_DIR / "index.html")


@app.get("/wiki", include_in_schema=False)
def wiki_page_shell() -> FileResponse:
    return _frontend_file_response(FRONTEND_DIR / "index.html")


@app.get("/api/health")
def healthcheck() -> dict[str, object]:
    agent_status = get_agent_backend_status()
    kb_settings = get_knowledge_base_settings()
    return {
        "status": "ok",
        "knowledge_base_dir": str(get_knowledge_base_dir()),
        "knowledge_base_name": kb_settings["name"],
        "knowledge_base_session_namespace": kb_settings["session_namespace"],
        "agent_mode": agent_status["mode"],
        "agent_status": agent_status,
    }


@app.get("/api/settings")
def get_app_settings() -> dict[str, object]:
    return {
        "knowledge_base": get_knowledge_base_settings(),
        "model_providers": get_model_provider_settings(),
        "pi_install": _get_pi_install_status(),
        "startup": get_startup_settings(),
    }


@app.get("/api/settings/diagnostics")
def get_settings_diagnostics() -> dict[str, object]:
    return _build_settings_diagnostics()


@app.patch("/api/settings/security")
def update_settings_security(request: UpdatePiSecurityRequest) -> dict[str, object]:
    try:
        security = update_pi_security_settings(request.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    reset_session_pool()
    return {
        "success": True,
        "security": security,
        "detail": "Pi 安全模式已更新；后续会话请求会按新规则重新启动。",
    }


@app.post("/api/settings/security/approval")
def create_settings_security_approval(request: CreatePiSecurityApprovalRequest) -> dict[str, object]:
    try:
        approval = create_pi_security_approval(request.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return {
        "success": True,
        "approval": approval,
        "detail": "已创建单次安全放行；Pi 下次命中同一操作时会自动消费。",
    }


@app.patch("/api/settings/knowledge-base")
def update_knowledge_base(request: UpdateKnowledgeBaseRequest) -> dict[str, object]:
    reset_session_pool()
    try:
        settings = set_knowledge_base_dir(request.path)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        "success": True,
        "knowledge_base": settings,
        "startup": get_startup_settings(),
        "detail": "知识库已切换，会话目录已按知识库隔离。",
    }


@app.post("/api/settings/startup/complete")
def finish_startup_onboarding() -> dict[str, object]:
    return {
        "success": True,
        "startup": complete_startup_onboarding(),
        "detail": "首次启动引导已完成。",
    }


@app.post("/api/settings/model-providers")
def save_model_provider(request: UpsertModelProviderRequest) -> dict[str, object]:
    try:
        settings = upsert_model_provider_profile(request.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return {
        "success": True,
        "model_providers": settings,
        "detail": "Provider 配置已保存，后续新建的 Pi RPC 进程会自动加载对应 extension。",
    }


@app.delete("/api/settings/model-providers/{provider_key}")
def remove_model_provider(provider_key: str) -> dict[str, object]:
    try:
        settings = delete_model_provider_profile(provider_key)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return {
        "success": True,
        "provider_key": provider_key,
        "model_providers": settings,
        "detail": "Provider 配置已删除。",
    }


@app.post("/api/settings/pi-login")
def start_pi_login() -> dict[str, object]:
    if not is_desktop_runtime():
        raise HTTPException(
            status_code=501,
            detail="当前仍是 Web 版 gogo-app，暂时不能直接拉起 Pi CLI 登录。桌面版会通过这个接口打开本地 `pi`，并触发原生 `/login` 流程。",
        )
    if not get_pi_command_path():
        pi_install = _get_pi_install_status()
        raise HTTPException(
            status_code=500,
            detail=str(
                pi_install.get("detail")
                or "当前机器上没有可用的 `pi` 命令，无法拉起桌面版 Pi 登录。"
            ),
        )

    try:
        if _desktop_bridge_url():
            bridge_result = _post_to_desktop_bridge("/desktop-login", {})
        else:
            bridge_result = _start_desktop_pi_login_direct()
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return {
        "success": bool(bridge_result.get("success", True)),
        "detail": str(
            bridge_result.get("detail")
            or "已打开桌面版 Pi 登录流程。"
        ),
        "command_hint": str(bridge_result.get("command_hint") or "/login"),
        "model_providers": get_model_provider_settings(),
    }


@app.post("/api/settings/pi-install")
def install_pi() -> dict[str, object]:
    if not is_desktop_runtime():
        raise HTTPException(
            status_code=501,
            detail="当前仍是 Web 版 gogo-app，暂时不能直接在应用内安装 Pi。",
        )
    if not _desktop_bridge_url():
        raise HTTPException(
            status_code=500,
            detail="桌面桥地址缺失，无法触发 Pi 安装流程。",
        )

    try:
        bridge_result = _post_to_desktop_bridge("/pi-install", {})
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return {
        "success": bool(bridge_result.get("success", True)),
        "detail": str(bridge_result.get("detail") or "Pi 安装流程已启动。"),
        "pi_install": _get_pi_install_status(),
    }


@app.get("/api/chat/suggestions")
def chat_suggestions() -> dict[str, list[str]]:
    return {
        "items": [
            "这个方向有哪些值得做的 gap？",
            "帮我总结 knowledge-base/wiki 的结构。",
            "如果我要接入真实 agent，后端应该怎么替换？",
        ]
    }


@app.post("/api/knowledge-base/inbox/upload")
async def upload_inbox_file(request: Request) -> dict[str, object]:
    kb_dir = get_knowledge_base_dir()
    if not kb_dir.exists() or not kb_dir.is_dir():
        raise HTTPException(status_code=400, detail="当前知识库目录不存在，无法上传文件。")

    inbox_dir = kb_dir / "inbox"
    inbox_dir.mkdir(parents=True, exist_ok=True)
    encoded_filename = request.headers.get("x-gogo-filename", "")
    filename = _safe_inbox_filename(unquote(encoded_filename))
    target_path = _allocate_inbox_path(inbox_dir, filename)

    total_bytes = 0
    try:
        with target_path.open("wb") as handle:
            async for chunk in request.stream():
                if not chunk:
                    continue
                total_bytes += len(chunk)
                if total_bytes > UPLOAD_MAX_BYTES:
                    raise HTTPException(
                        status_code=400,
                        detail=f"上传文件过大，当前限制为 {UPLOAD_MAX_BYTES // (1024 * 1024)}MB。",
                    )
                handle.write(chunk)
    except HTTPException:
        if target_path.exists():
            target_path.unlink()
        raise
    except Exception as exc:
        if target_path.exists():
            target_path.unlink()
        raise HTTPException(status_code=500, detail=f"上传文件失败：{exc}") from exc

    if total_bytes <= 0:
        if target_path.exists():
            target_path.unlink()
        raise HTTPException(status_code=400, detail="上传文件为空，无法 ingest。")

    kb_settings = get_knowledge_base_settings()
    inbox_relative_path = f"inbox/{target_path.name}"
    return {
        "success": True,
        "knowledge_base": kb_settings,
        "file": _inbox_item_payload(
            target_path,
            inbox_dir=inbox_dir,
            knowledge_base_name=str(kb_settings.get("name") or Path(kb_dir).name),
        ),
        "limits": {
            "max_bytes": UPLOAD_MAX_BYTES,
            "allowed_extensions": sorted(ALLOWED_UPLOAD_EXTENSIONS),
        },
        "ingest_prompt": _build_ingest_prompt(
            inbox_relative_path=inbox_relative_path,
            knowledge_base_name=str(kb_settings.get("name") or Path(kb_dir).name),
        ),
        "detail": f"文件已上传到 `{inbox_relative_path}`，可以把生成的 ingest 提示词发给 Pi。",
    }


@app.get("/api/knowledge-base/inbox/files")
def inbox_files() -> dict[str, object]:
    kb_settings = get_knowledge_base_settings()
    items = _list_inbox_browser_items()

    return {
        "knowledge_base": kb_settings,
        "items": items,
        "count": len(items),
    }


@app.get("/api/inbox/files")
def inbox_browser_files() -> dict[str, object]:
    items = _list_inbox_browser_items()
    return {"items": items, "count": len(items)}


@app.get("/api/inbox/file")
def inbox_browser_file(path: str = Query(..., description="Relative file path inside inbox/")) -> dict[str, object]:
    try:
        return _get_inbox_browser_item(path, include_content=True)
    except HTTPException:
        raise


@app.get("/api/inbox/search")
def inbox_browser_search(
    q: str = Query("", description="Search query"),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, object]:
    items = _search_inbox_browser_items(q, limit=limit)
    return {"items": items, "count": len(items), "query": q}


@app.delete("/api/knowledge-base/inbox/files")
def delete_inbox_file(path: str = Query(..., min_length=1, description="Inbox 相对路径")) -> dict[str, object]:
    kb_dir = get_knowledge_base_dir()
    inbox_dir = kb_dir / "inbox"
    inbox_dir.mkdir(parents=True, exist_ok=True)

    target_path = _resolve_inbox_path(path, inbox_dir=inbox_dir)
    relative_path = f"inbox/{target_path.relative_to(inbox_dir).as_posix()}"
    target_path.unlink()

    for parent in target_path.parents:
        if parent == inbox_dir:
            break
        try:
            parent.rmdir()
        except OSError:
            break

    return {
        "success": True,
        "deleted_path": relative_path,
        "detail": f"已从 inbox 删除 `{relative_path}`。",
    }


@app.get("/api/pi/options")
def pi_options() -> dict[str, object]:
    pool = get_session_pool()
    runtime = pool.get_runtime_options()
    return {
        "models": runtime.get("models") or [],
        "state": runtime.get("state") or {},
        "thinking_levels": ["off", "minimal", "low", "medium", "high", "xhigh"],
    }


@app.post("/api/chat")
def chat(request: ChatRequest) -> dict[str, object]:
    request_id = _resolve_request_id(request.request_id)
    result = run_session_chat(
        session_id=request.session_id,
        message=request.message,
        request_id=request_id,
    )
    result["request_id"] = request_id
    return result


@app.post("/api/chat/stream")
async def chat_stream(request: ChatRequest) -> StreamingResponse:
    request_id = _resolve_request_id(request.request_id)

    async def session_event_stream():
        async for event in stream_session_chat(
            session_id=request.session_id,
            message=request.message,
            request_id=request_id,
        ):
            event.setdefault("request_id", request_id)
            yield f"{json.dumps(event, ensure_ascii=False)}\n"
    return StreamingResponse(session_event_stream(), media_type="application/x-ndjson")


@app.post("/api/legacy/chat", deprecated=True)
def legacy_chat(request: LegacyChatRequest) -> JSONResponse:
    request_id = _resolve_request_id(request.request_id)
    result = run_agent_chat(
        message=request.message,
        history=[_dump_turn(turn) for turn in request.history],
        request_id=request_id,
    )
    result["request_id"] = request_id
    return JSONResponse(result, headers=NO_SESSION_DEPRECATION_HEADERS)


@app.post("/api/legacy/chat/stream", deprecated=True)
async def legacy_chat_stream(request: LegacyChatRequest) -> StreamingResponse:
    request_id = _resolve_request_id(request.request_id)
    history = [_dump_turn(turn) for turn in request.history]

    async def event_stream():
        async for event in stream_agent_chat(
            message=request.message,
            history=history,
            request_id=request_id,
        ):
            event.setdefault("request_id", request_id)
            yield f"{json.dumps(event, ensure_ascii=False)}\n"

    return StreamingResponse(
        event_stream(),
        media_type="application/x-ndjson",
        headers=NO_SESSION_DEPRECATION_HEADERS,
    )


@app.get("/api/wiki/pages")
def wiki_pages() -> dict[str, object]:
    pages = list_pages()
    return {"items": pages, "count": len(pages)}


@app.get("/api/wiki/tree")
def wiki_tree() -> dict[str, object]:
    return get_tree()


@app.get("/api/wiki/page")
def wiki_page(path: str = Query(..., description="Relative markdown path inside wiki/")) -> dict[str, object]:
    try:
        return get_page(path)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=f"Wiki page not found: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/wiki/search")
def wiki_search(
    q: str = Query("", description="Search query"),
    limit: int = Query(12, ge=1, le=50),
) -> dict[str, object]:
    items = search_pages(q, limit=limit)
    return {"items": items, "count": len(items), "query": q}


class WikiPageUpdateRequest(BaseModel):
    content: str = Field(..., description="Updated markdown content")


class WikiPageCreateRequest(BaseModel):
    path: str = Field(..., min_length=1, description="Relative markdown path inside wiki/")
    content: str = Field("", description="Initial markdown content")


@app.post("/api/wiki/page")
def create_wiki_page(payload: WikiPageCreateRequest) -> dict[str, object]:
    try:
        return create_page(payload.path, payload.content)
    except FileExistsError as exc:
        raise HTTPException(status_code=409, detail=f"Wiki page already exists: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


class MarkdownBrowserFileCreateRequest(BaseModel):
    source: str = Field(..., min_length=1, description="wiki | raw | inbox")
    path: str = Field(..., min_length=1, description="Relative markdown path inside selected source root")
    content: str = Field("", description="Initial markdown content")


class MarkdownBrowserFileUpdateRequest(BaseModel):
    source: str = Field(..., min_length=1, description="wiki | raw | inbox")
    path: str = Field(..., min_length=1, description="Relative markdown path inside selected source root")
    content: str = Field(..., description="Updated markdown content")


@app.post("/api/markdown-file")
def create_markdown_browser_file(payload: MarkdownBrowserFileCreateRequest) -> dict[str, object]:
    try:
        return _create_markdown_browser_file(payload.source, payload.path, payload.content)
    except FileExistsError as exc:
        raise HTTPException(status_code=409, detail=f"Markdown file already exists: {exc}") from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=f"Markdown file not found: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.patch("/api/markdown-file")
def update_markdown_browser_file(payload: MarkdownBrowserFileUpdateRequest) -> dict[str, object]:
    try:
        return _save_markdown_browser_file(payload.source, payload.path, payload.content)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=f"Markdown file not found: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.delete("/api/markdown-file")
def delete_markdown_browser_file(
    source: str = Query(..., min_length=1, description="wiki | raw | inbox"),
    path: str = Query(..., min_length=1, description="Relative markdown path inside selected source root"),
) -> dict[str, object]:
    try:
        record = _delete_markdown_browser_file(source, path)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=f"Markdown file not found: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        "success": True,
        "detail": f"已删除 {source} 里的 Markdown：{path}",
        "file": record,
    }


@app.patch("/api/wiki/page")
def update_wiki_page(
    payload: WikiPageUpdateRequest,
    path: str = Query(..., description="Relative markdown path inside wiki/"),
) -> dict[str, object]:
    try:
        return save_page(path, payload.content)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=f"Wiki page not found: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/raw/files")
def raw_files() -> dict[str, object]:
    items = list_raw_files()
    return {"items": items, "count": len(items)}


@app.get("/api/knowledge-base/skills")
def knowledge_base_skills() -> dict[str, object]:
    items = list_slash_commands()
    return {"items": items, "count": len(items)}


@app.get("/api/knowledge-base/slash-commands")
def knowledge_base_slash_commands() -> dict[str, object]:
    items = list_slash_commands()
    return {"items": items, "count": len(items)}


@app.get("/api/knowledge-base/capabilities")
def knowledge_base_capabilities() -> dict[str, object]:
    items = list_capability_entries()
    return {"items": items, "count": len(items)}


@app.get("/api/knowledge-base/capability-file")
def knowledge_base_capability_file(path: str = Query(..., description="Relative file path inside skills/ or schemas/")) -> dict[str, object]:
    try:
        return get_capability_file(path)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=f"Capability file not found: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.patch("/api/knowledge-base/capability-file")
def update_knowledge_base_capability_file(payload: CapabilityFileUpdateRequest) -> dict[str, object]:
    try:
        result = save_capability_file(payload.path, payload.content)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=f"Capability file not found: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        "success": True,
        "detail": "能力定义已保存。",
        **result,
    }


@app.post("/api/knowledge-base/capability-file")
def create_knowledge_base_capability_file(payload: CreateCapabilityFileRequest) -> dict[str, object]:
    try:
        result = create_capability_file(payload.source, payload.name, payload.description)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        "success": True,
        "detail": "能力定义已创建。",
        **result,
    }


@app.delete("/api/knowledge-base/capability-file")
def delete_knowledge_base_capability_file(path: str = Query(..., description="Relative file path inside skills/ or schemas/")) -> dict[str, object]:
    try:
        result = delete_capability_file(path)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=f"Capability file not found: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        "success": True,
        "detail": "能力定义已删除。",
        **result,
    }


@app.get("/api/raw/file")
def raw_file(path: str = Query(..., description="Relative file path inside raw/")) -> dict[str, object]:
    try:
        return get_raw_file(path)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=f"Raw file not found: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/raw/search")
def raw_search(
    q: str = Query("", description="Search query"),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, object]:
    items = search_raw_files(q, limit=limit)
    return {"items": items, "count": len(items), "query": q}


@app.get("/raw/file", include_in_schema=False)
def raw_file_download(path: str = Query(..., description="Relative file path inside raw/")) -> FileResponse:
    try:
        file_path = get_raw_file_path(path)
        return FileResponse(file_path, media_type="application/pdf" if file_path.suffix.lower() == ".pdf" else None)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=f"Raw file not found: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/inbox/file", include_in_schema=False)
def inbox_file_download(path: str = Query(..., description="Relative file path inside inbox/")) -> FileResponse:
    kb_dir = get_knowledge_base_dir()
    inbox_dir = kb_dir / "inbox"
    inbox_dir.mkdir(parents=True, exist_ok=True)
    file_path = _resolve_inbox_path(path, inbox_dir=inbox_dir)
    media_type = "application/pdf" if file_path.suffix.lower() == ".pdf" else None
    return FileResponse(file_path, media_type=media_type)


# ===========================
# Session 管理 API
# ===========================

@app.get("/api/sessions")
def list_sessions() -> dict[str, object]:
    """获取所有活跃会话列表"""
    pool = get_session_pool()
    sessions = pool.list_sessions()
    return {"sessions": sessions, "count": len(sessions)}


@app.post("/api/sessions")
def create_session(request: CreateSessionRequest) -> dict[str, object]:
    """创建新会话"""
    pool = get_session_pool()
    session_id = pool.create_session(
        system_prompt=request.system_prompt or None,
        title=request.title or None,
        thinking_level=request.thinking_level or None,
        model_provider=request.model_provider or None,
        model_id=request.model_id or None,
    )
    session = pool.get_session(session_id)
    if not session:
        raise HTTPException(status_code=500, detail="Session created but not found in pool")
    return {"session_id": session_id, "session": _session_payload_with_runtime(session_id, pool=pool)}


@app.delete("/api/sessions/{session_id}")
def destroy_session(session_id: str) -> dict[str, object]:
    """销毁指定会话"""
    pool = get_session_pool()
    success = pool.destroy_session(session_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Session not found: {session_id}")
    return {"success": True, "session_id": session_id}


@app.patch("/api/sessions/{session_id}")
def rename_session(session_id: str, request: UpdateSessionRequest) -> dict[str, object]:
    """重命名指定会话"""
    new_title = request.title.strip()
    if not new_title:
        raise HTTPException(status_code=400, detail="Session title cannot be empty")

    pool = get_session_pool()
    session = pool.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session not found: {session_id}")

    session.info.title = new_title
    # 复用 get_session 的持久化逻辑，将最新 title 同步到 registry。
    pool.get_session(session_id)
    return {"success": True, "session_id": session_id, "session": session.info.to_dict()}


@app.patch("/api/sessions/{session_id}/settings")
def update_session_settings(session_id: str, request: UpdateSessionSettingsRequest) -> dict[str, object]:
    if request.model_provider is not None and not (request.model_provider or "").strip():
        raise HTTPException(status_code=400, detail="model_provider cannot be empty when provided")
    if request.model_id is not None and not (request.model_id or "").strip():
        raise HTTPException(status_code=400, detail="model_id cannot be empty when provided")
    if (request.model_provider is None) != (request.model_id is None):
        raise HTTPException(status_code=400, detail="model_provider and model_id must be provided together")
    if request.thinking_level is None and request.model_provider is None:
        raise HTTPException(status_code=400, detail="No session setting changes were provided")

    pool = get_session_pool()
    try:
        session = pool.update_session_settings(
            session_id,
            thinking_level=request.thinking_level,
            model_provider=request.model_provider,
            model_id=request.model_id,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"Session not found: {session_id}") from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return {
        "success": True,
        "session_id": session_id,
        "session": _session_payload_with_runtime(session_id, pool=pool),
    }


@app.get("/api/sessions/{session_id}")
def get_session(session_id: str) -> dict[str, object]:
    """获取会话详情"""
    pool = get_session_pool()
    return {"session": _session_payload_with_runtime(session_id, pool=pool)}


@app.get("/api/sessions/{session_id}/stats")
def get_session_stats(session_id: str) -> dict[str, object]:
    pool = get_session_pool()
    session = pool.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session not found: {session_id}")

    try:
        stats = pool.get_session_stats(session_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"Session not found: {session_id}") from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return {
        "session_id": session_id,
        "context_usage": _normalize_context_usage(stats.get("contextUsage")),
        "token_usage": stats.get("tokens") if isinstance(stats.get("tokens"), dict) else None,
    }


@app.post("/api/sessions/{session_id}/compact")
def compact_session(session_id: str, request: CompactSessionRequest) -> dict[str, object]:
    pool = get_session_pool()
    try:
        payload = pool.compact_session(
            session_id,
            custom_instructions=request.custom_instructions,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"Session not found: {session_id}") from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    stats = payload.get("stats") if isinstance(payload, dict) else {}
    result = payload.get("result") if isinstance(payload, dict) else {}
    return {
        "success": True,
        "session_id": session_id,
        "result": result if isinstance(result, dict) else {},
        "context_usage": _normalize_context_usage(stats.get("contextUsage") if isinstance(stats, dict) else None),
        "token_usage": stats.get("tokens") if isinstance(stats, dict) and isinstance(stats.get("tokens"), dict) else None,
    }


@app.get("/api/sessions/{session_id}/history")
def get_session_history(
    session_id: str,
    limit: int = Query(200, ge=1, le=1000, description="最大返回 turn 数（user+assistant）"),
    offset: int = Query(0, ge=0, le=100000, description="从最新消息开始向前跳过的 turn 数"),
) -> dict[str, object]:
    """回放会话历史（优先 RPC get_messages，离线兜底原生 session JSONL）。"""
    if "/" in session_id or "\\" in session_id or ".." in session_id:
        raise HTTPException(status_code=400, detail="Invalid session_id format")
    pool = get_session_pool()
    requested_history = pool.replay_history(
        session_id=session_id,
        max_turns=limit + 1,
        offset_turns=offset,
    )
    has_more = len(requested_history) > limit
    history = requested_history[1:] if has_more else requested_history
    return {
        "session_id": session_id,
        "history": history,
        "count": len(history),
        "limit": limit,
        "offset": offset,
        "has_more": has_more,
    }


@app.post("/api/sessions/{session_id}/abort")
def abort_session_response(session_id: str) -> dict[str, object]:
    """终止指定会话当前进行中的回复"""
    pool = get_session_pool()
    result = pool.abort_pending_request(session_id)
    if not result.get("success"):
        detail = str(result.get("detail") or "Abort failed.")
        if detail.startswith("Session not found:"):
            raise HTTPException(status_code=404, detail=detail)
        raise HTTPException(status_code=409, detail=detail)
    return result


@app.post("/api/sessions/{session_id}/extension-ui-response")
def respond_session_extension_ui(session_id: str, request: ExtensionUiResponseRequest) -> dict[str, object]:
    """把前端的 extension UI 结果回写给当前 Pi RPC 请求"""
    pool = get_session_pool()
    result = pool.respond_extension_ui_request(session_id, request.model_dump())
    if not result.get("success"):
        detail = str(result.get("detail") or "Extension UI response failed.")
        if detail.startswith("Session not found:"):
            raise HTTPException(status_code=404, detail=detail)
        raise HTTPException(status_code=409, detail=detail)
    return result


@app.post("/api/sessions/{session_id}/chat/stream")
async def session_chat_stream(session_id: str, request: SessionChatRequest) -> StreamingResponse:
    """会话流式聊天"""
    pool = get_session_pool()
    session = pool.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session not found: {session_id}")

    request_id = _resolve_request_id(request.request_id)

    async def event_stream():
        async for event in pool.send_message_async(
            session_id=session_id,
            message=request.message,
            request_id=request_id,
        ):
            event.setdefault("request_id", request_id)
            yield f"{json.dumps(event, ensure_ascii=False)}\n"

    return StreamingResponse(event_stream(), media_type="application/x-ndjson")
