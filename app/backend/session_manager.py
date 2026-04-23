"""
Session 管理器（RPC-only）

主链路：
- Pi RPC 会话管理（new/switch/get_state/get_messages）
- 会话元数据持久化（registry JSON）
- 历史恢复优先：RPC 在线 -> 原生 session JSONL 离线
"""

from __future__ import annotations

import asyncio
import json
import logging
import threading
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, AsyncIterator

from .config import (
    get_pi_command_path,
    get_pi_extension_args,
    get_pi_rpc_session_dir,
    get_pi_thinking_level,
    get_pi_timeout_seconds,
    get_pi_workdir,
)
from .pi_rpc_client import PiRpcClient, PiRpcError
from .security_service import get_pi_security_extension_args


logger = logging.getLogger(__name__)

PI_TIMEOUT_USER_MESSAGE = "Pi 回复超时，本次请求已自动停止。你可以重试，或切换会话继续提问。"
PI_INTERRUPTED_USER_MESSAGE = "Pi 回复异常中断，本次请求已自动停止。你可以重试，或切换会话继续提问。"

REGISTRY_FILENAME = "gogo-session-registry.json"
APP_TURNS_DIRNAME = "gogo-session-turns"
APP_TURNS_TAIL_READ_CHUNK_SIZE = 64 * 1024
EXTENSION_UI_DEFAULT_TIMEOUT_SECONDS = 300


def _pi_rpc_extra_args(*args: str) -> list[str]:
    return [*args, *get_pi_extension_args(), *get_pi_security_extension_args()]


def _run_coro_sync(coro):
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(coro)

    result: dict[str, Any] = {"value": None, "error": None}

    def worker() -> None:
        try:
            result["value"] = asyncio.run(coro)
        except Exception as exc:
            result["error"] = exc

    thread = threading.Thread(target=worker, daemon=True)
    thread.start()
    thread.join()

    if result["error"] is not None:
        raise result["error"]
    return result["value"]


@dataclass
class SessionInfo:
    session_id: str
    created_at: float = field(default_factory=time.time)
    last_used_at: float = field(default_factory=time.time)
    message_count: int = 0
    title: str = ""
    pending_request_id: str | None = None
    model_provider: str = ""
    model_id: str = ""
    model_label: str = ""
    thinking_level: str = "medium"

    def to_dict(self) -> dict[str, Any]:
        return {
            "session_id": self.session_id,
            "created_at": self.created_at,
            "last_used_at": self.last_used_at,
            "message_count": self.message_count,
            "title": self.title or f"会话 {self.session_id[:8]}",
            "is_pending": bool(self.pending_request_id),
            "model_provider": self.model_provider,
            "model_id": self.model_id,
            "model_label": self.model_label,
            "thinking_level": self.thinking_level,
        }


@dataclass
class SessionProcess:
    session_id: str
    session_file: str = ""
    workdir: str = ""
    thinking_level: str = "medium"
    info: SessionInfo = field(default_factory=lambda: SessionInfo(session_id=""))
    lock: threading.Lock = field(default_factory=threading.Lock)
    abort_requested: bool = False
    active_rpc_client: PiRpcClient | None = None
    active_loop: asyncio.AbstractEventLoop | None = None
    active_extension_ui_request: dict[str, Any] | None = None
    active_extension_ui_waiter: asyncio.Future[bool] | None = None

    def __post_init__(self) -> None:
        self.info.session_id = self.session_id
        self.info.thinking_level = self.thinking_level


class SessionPool:
    def __init__(self, max_sessions: int | None = None, idle_timeout: int | None = None):
        # Desktop sessions are part of the product surface, not just an in-memory cache.
        # Do not evict or garbage-collect them by default, otherwise users reopen the app
        # and find their previous sessions gone.
        self.max_sessions = max_sessions if isinstance(max_sessions, int) and max_sessions > 0 else None
        self.idle_timeout = idle_timeout if isinstance(idle_timeout, int) and idle_timeout > 0 else None
        self._registry_touch_save_interval = 5.0
        self._registry_last_saved_at = 0.0
        self._sessions: dict[str, SessionProcess] = {}
        self._lock = threading.RLock()
        self._cleanup_task: asyncio.Task | None = None

        self._session_dir = get_pi_rpc_session_dir()
        self._session_dir.mkdir(parents=True, exist_ok=True)
        self._turns_dir = self._session_dir / APP_TURNS_DIRNAME
        self._turns_dir.mkdir(parents=True, exist_ok=True)
        self._registry_file = self._session_dir / REGISTRY_FILENAME
        self._registry: dict[str, dict[str, Any]] = self._load_registry()
        self._restore_sessions_from_registry()

    def _load_registry(self) -> dict[str, dict[str, Any]]:
        if not self._registry_file.exists():
            return {}
        try:
            raw = self._registry_file.read_text(encoding="utf-8")
            if not raw.strip():
                logger.info("Session registry is empty, treating it as a fresh registry: %s", self._registry_file)
                return {}
            data = json.loads(raw)
        except Exception:
            logger.warning("Failed to load session registry: %s", self._registry_file, exc_info=True)
            return {}

        items = data.get("sessions") if isinstance(data, dict) else None
        if not isinstance(items, list):
            return {}

        out: dict[str, dict[str, Any]] = {}
        for item in items:
            if not isinstance(item, dict):
                continue
            sid = str(item.get("session_id") or "").strip()
            if not sid:
                continue
            out[sid] = item
        return out

    def _save_registry(self) -> None:
        payload = {
            "version": 1,
            "updated_at": time.time(),
            "sessions": sorted(
                self._registry.values(),
                key=lambda it: float(it.get("last_used_at") or 0.0),
                reverse=True,
            ),
        }
        self._registry_file.parent.mkdir(parents=True, exist_ok=True)
        temp_file = self._registry_file.with_name(f"{self._registry_file.name}.tmp")
        temp_file.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        temp_file.replace(self._registry_file)
        self._registry_last_saved_at = time.time()

    def _sync_registry_from_session(
        self,
        session: SessionProcess,
        *,
        force_save: bool = True,
    ) -> None:
        self._registry[session.session_id] = {
            "session_id": session.session_id,
            "session_file": session.session_file,
            "workdir": session.workdir,
            "thinking_level": session.thinking_level,
            "model_provider": session.info.model_provider,
            "model_id": session.info.model_id,
            "model_label": session.info.model_label,
            "title": session.info.title,
            "created_at": session.info.created_at,
            "last_used_at": session.info.last_used_at,
            "message_count": session.info.message_count,
        }
        if force_save:
            self._save_registry()
            return
        if time.time() - self._registry_last_saved_at >= self._registry_touch_save_interval:
            self._save_registry()

    def _remove_registry_session(self, session_id: str) -> None:
        if session_id in self._registry:
            self._registry.pop(session_id, None)
            self._save_registry()

    def _turns_file(self, session_id: str) -> Path:
        safe_session_id = session_id.replace("/", "_").replace("\\", "_")
        return self._turns_dir / f"{safe_session_id}.jsonl"

    def _file_mtime(self, path: Path | str | None) -> float | None:
        if not path:
            return None
        try:
            candidate = Path(path).expanduser()
            if candidate.exists():
                return candidate.stat().st_mtime
        except Exception:
            logger.warning("Failed to inspect file timestamp: %s", path, exc_info=True)
        return None

    def _normalize_history_turn(self, turn: Any) -> dict[str, Any] | None:
        if not isinstance(turn, dict):
            return None
        role = str(turn.get("role") or "").strip()
        if role not in {"user", "assistant"}:
            return None
        content = str(turn.get("content") or "")
        normalized: dict[str, Any] = {
            "role": role,
            "content": content,
        }

        consulted_pages = turn.get("consulted_pages")
        if isinstance(consulted_pages, list):
            pages: list[dict[str, str]] = []
            for item in consulted_pages:
                if not isinstance(item, dict):
                    continue
                path = str(item.get("path") or "").strip()
                if not path:
                    continue
                pages.append(
                    {
                        "title": str(item.get("title") or path).strip() or path,
                        "path": path,
                        "source": str(item.get("source") or "wiki").strip() or "wiki",
                    }
                )
            if pages:
                normalized["consulted_pages"] = pages

        trace = turn.get("trace")
        if isinstance(trace, list):
            trace_items = [item for item in trace if isinstance(item, dict)]
            if trace_items:
                normalized["trace"] = trace_items

        warnings = turn.get("warnings")
        if isinstance(warnings, list):
            warning_items = [str(item) for item in warnings if str(item or "").strip()]
            if warning_items:
                normalized["warnings"] = warning_items

        if bool(turn.get("stopped")):
            normalized["stopped"] = True
        return normalized

    def _append_app_turns(self, session_id: str, turns: list[dict[str, Any]]) -> None:
        if not turns:
            return
        path = self._turns_file(session_id)
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("a", encoding="utf-8") as handle:
            for turn in turns:
                normalized = self._normalize_history_turn(turn)
                if not normalized:
                    continue
                handle.write(json.dumps(normalized, ensure_ascii=False))
                handle.write("\n")

    def _slice_history_window(
        self,
        history: list[dict[str, Any]],
        *,
        max_turns: int,
        offset_turns: int = 0,
    ) -> list[dict[str, Any]]:
        if not history:
            return []
        if offset_turns > 0:
            if offset_turns >= len(history):
                return []
            history = history[:-offset_turns]
        if max_turns > 0 and len(history) > max_turns:
            history = history[-max_turns:]
        return history

    def _read_app_turn_tail_lines(
        self,
        *,
        path: Path,
        max_lines: int,
    ) -> list[str]:
        if max_lines <= 0:
            return []
        with path.open("rb") as handle:
            handle.seek(0, 2)
            position = handle.tell()
            buffer = b""
            lines: list[bytes] = []

            while position > 0 and len(lines) < max_lines:
                read_size = min(APP_TURNS_TAIL_READ_CHUNK_SIZE, position)
                position -= read_size
                handle.seek(position)
                chunk = handle.read(read_size)
                if not chunk:
                    break
                buffer = chunk + buffer
                parts = buffer.splitlines()
                if position > 0:
                    buffer = parts[0] if parts else buffer
                    lines = parts[1:]
                else:
                    buffer = b""
                    lines = parts

            tail_lines = lines[-max_lines:]
            return [
                line.decode("utf-8", errors="ignore").strip()
                for line in tail_lines
                if line.strip()
            ]

    def _load_history_from_app_turns(
        self,
        *,
        session_id: str,
        max_turns: int,
        offset_turns: int = 0,
    ) -> list[dict[str, Any]] | None:
        path = self._turns_file(session_id)
        if not path.exists():
            return None
        turns: list[dict[str, Any]] = []
        try:
            if max_turns > 0:
                requested_window = max_turns + max(offset_turns, 0)
                raw_lines = self._read_app_turn_tail_lines(path=path, max_lines=requested_window)
            else:
                with path.open("r", encoding="utf-8") as handle:
                    raw_lines = [raw_line.strip() for raw_line in handle if raw_line.strip()]
            for line in raw_lines:
                try:
                    item = json.loads(line)
                except json.JSONDecodeError:
                    continue
                normalized = self._normalize_history_turn(item)
                if normalized:
                    turns.append(normalized)
        except Exception:
            logger.warning("Failed to load app turn history: %s", path, exc_info=True)
            return None

        return self._slice_history_window(turns, max_turns=max_turns, offset_turns=offset_turns)

    def _app_turns_fast_path_is_safe(
        self,
        *,
        session: SessionProcess,
        app_turns: list[dict[str, Any]] | None,
        max_turns: int,
        offset_turns: int = 0,
    ) -> bool:
        if not app_turns or session.info.pending_request_id:
            return False

        # For the default "latest page" restore path, if the turn log has fewer entries than
        # the recent window we expect from message_count, it is likely lagging behind the native
        # Pi session file. In that case we should fall back to native history and merge.
        if offset_turns <= 0 and max_turns > 0:
            expected_recent_turns = min(max_turns, max(int(session.info.message_count or 0), 0) * 2)
            if expected_recent_turns > 0 and len(app_turns) < expected_recent_turns:
                return False

        turns_mtime = self._file_mtime(self._turns_file(session.session_id))
        native_mtime = self._file_mtime(session.session_file)
        if turns_mtime is not None and native_mtime is not None and turns_mtime + 0.001 < native_mtime:
            return False

        return True

    def _persist_exchange_turns(
        self,
        *,
        session: SessionProcess,
        user_message: str,
        assistant_event: dict[str, Any],
    ) -> None:
        assistant_turn = {
            "role": "assistant",
            "content": str(assistant_event.get("message") or ""),
            "consulted_pages": assistant_event.get("consulted_pages", []),
            "trace": assistant_event.get("trace", []),
            "warnings": assistant_event.get("warnings", []),
            "stopped": bool(assistant_event.get("stopped")),
        }
        try:
            self._append_app_turns(
                session.session_id,
                [
                    {
                        "role": "user",
                        "content": user_message,
                    },
                    assistant_turn,
                ],
            )
        except Exception:
            logger.warning("Failed to persist app turn history for session %s", session.session_id, exc_info=True)

    def _merge_rich_history_tail(
        self,
        base_history: list[dict[str, Any]],
        app_turns: list[dict[str, Any]],
    ) -> list[dict[str, Any]] | None:
        if not app_turns:
            return None
        if not base_history:
            return app_turns
        if len(app_turns) >= len(base_history):
            return app_turns

        offset = len(base_history) - len(app_turns)
        matched_user_turn = False
        for index, app_turn in enumerate(app_turns):
            base_turn = base_history[offset + index]
            app_role = str(app_turn.get("role") or "")
            base_role = str(base_turn.get("role") or "")
            if app_role != base_role:
                return None
            if app_role == "user":
                matched_user_turn = True
                if str(app_turn.get("content") or "") != str(base_turn.get("content") or ""):
                    return None

        if not matched_user_turn:
            return None

        return [*base_history[:offset], *app_turns]

    def _user_turns_with_indices(
        self,
        turns: list[dict[str, Any]],
    ) -> list[tuple[int, str]]:
        user_turns: list[tuple[int, str]] = []
        for index, turn in enumerate(turns):
            if str(turn.get("role") or "") != "user":
                continue
            user_turns.append((index, str(turn.get("content") or "")))
        return user_turns

    def _merge_rich_history_by_user_turns(
        self,
        base_history: list[dict[str, Any]],
        app_turns: list[dict[str, Any]],
    ) -> list[dict[str, Any]] | None:
        if not app_turns:
            return None
        if not base_history:
            return app_turns

        app_users = self._user_turns_with_indices(app_turns)
        base_users = self._user_turns_with_indices(base_history)
        if not app_users or len(app_users) > len(base_users):
            return None

        user_offset = len(base_users) - len(app_users)
        for index, (_, app_content) in enumerate(app_users):
            _, base_content = base_users[user_offset + index]
            if app_content != base_content:
                return None

        first_base_user_index = base_users[user_offset][0]
        first_app_user_index = app_users[0][0]
        if first_app_user_index >= len(app_turns):
            return None

        return [*base_history[:first_base_user_index], *app_turns[first_app_user_index:]]

    def _restore_sessions_from_registry(self) -> None:
        for sid, record in self._registry.items():
            session_file = str(record.get("session_file") or "").strip()
            if not session_file:
                continue
            session = SessionProcess(
                session_id=sid,
                session_file=session_file,
                workdir=str(record.get("workdir") or str(get_pi_workdir())),
                thinking_level=str(record.get("thinking_level") or get_pi_thinking_level()),
            )
            session.info.created_at = float(record.get("created_at") or time.time())
            session.info.last_used_at = float(record.get("last_used_at") or session.info.created_at)
            session.info.message_count = int(record.get("message_count") or 0)
            session.info.title = str(record.get("title") or "").strip()
            session.info.model_provider = str(record.get("model_provider") or "").strip()
            session.info.model_id = str(record.get("model_id") or "").strip()
            session.info.model_label = str(record.get("model_label") or "").strip()
            session.info.thinking_level = session.thinking_level
            self._sessions[sid] = session

    def _evict_oldest(self) -> None:
        if self.max_sessions is None:
            return
        oldest_id = None
        oldest_ts = float("inf")
        for sid, session in self._sessions.items():
            if session.info.pending_request_id:
                continue
            if session.info.last_used_at < oldest_ts:
                oldest_ts = session.info.last_used_at
                oldest_id = sid
        if oldest_id:
            self.destroy_session(oldest_id)

    def create_session(
        self,
        cwd: str | None = None,
        thinking_level: str | None = None,
        model_provider: str | None = None,
        model_id: str | None = None,
        system_prompt: str | None = None,
        title: str | None = None,
    ) -> str:
        del system_prompt  # RPC 链路暂不支持 per-session system prompt
        with self._lock:
            if self.max_sessions is not None and len(self._sessions) >= self.max_sessions:
                self._evict_oldest()

            sid = str(uuid.uuid4())
            session = SessionProcess(
                session_id=sid,
                workdir=str(cwd) if cwd else str(get_pi_workdir()),
                thinking_level=thinking_level or get_pi_thinking_level(),
            )
            session.info.model_provider = (model_provider or "").strip()
            session.info.model_id = (model_id or "").strip()
            if title:
                session.info.title = title
            self._bootstrap_rpc_session(session)
            self._sessions[sid] = session
            self._sync_registry_from_session(session)
            return sid

    def _model_label_from_parts(self, *, provider: str, model_id: str, name: str = "") -> str:
        provider = provider.strip()
        model_id = model_id.strip()
        name = name.strip()
        if provider and name:
            return f"{provider}/{name}"
        if provider and model_id:
            return f"{provider}/{model_id}"
        return name or model_id

    def _sync_session_from_state(self, session: SessionProcess, state: dict[str, Any]) -> None:
        session_name = str(state.get("sessionName") or "").strip()
        if session_name:
            session.info.title = session_name

        thinking_level = str(state.get("thinkingLevel") or "").strip().lower()
        if thinking_level:
            session.thinking_level = thinking_level
            session.info.thinking_level = thinking_level

        model = state.get("model")
        if isinstance(model, dict):
            provider = str(model.get("provider") or "").strip()
            model_id = str(model.get("id") or model.get("modelId") or "").strip()
            name = str(model.get("name") or "").strip()
            session.info.model_provider = provider
            session.info.model_id = model_id
            session.info.model_label = self._model_label_from_parts(
                provider=provider,
                model_id=model_id,
                name=name,
            )

    def _bootstrap_rpc_session(self, session: SessionProcess) -> None:
        command_path = get_pi_command_path()
        if not command_path:
            raise RuntimeError("RPC mode requires `pi` command on PATH.")

        session_dir = get_pi_rpc_session_dir()
        session_dir.mkdir(parents=True, exist_ok=True)

        async def bootstrap() -> dict[str, Any]:
            async with PiRpcClient(
                command_path=command_path,
                cwd=session.workdir,
                timeout_seconds=get_pi_timeout_seconds(),
                extra_args=_pi_rpc_extra_args("--session-dir", str(session_dir)),
            ) as client:
                await client.get_state(request_id=f"{session.session_id}:bootstrap:state")
                await client.new_session(request_id=f"{session.session_id}:bootstrap:new")
                if session.info.model_provider and session.info.model_id:
                    await client.set_model(
                        provider=session.info.model_provider,
                        model_id=session.info.model_id,
                        request_id=f"{session.session_id}:bootstrap:model",
                    )
                await client.set_thinking_level(
                    level=session.thinking_level,
                    request_id=f"{session.session_id}:bootstrap:thinking",
                )
                if session.info.title:
                    await client.set_session_name(
                        name=session.info.title,
                        request_id=f"{session.session_id}:bootstrap:name",
                    )
                return await client.get_state(
                    request_id=f"{session.session_id}:bootstrap:state2"
                )

        state = _run_coro_sync(bootstrap())
        session_file = str(state.get("sessionFile") or "").strip()
        if not session_file:
            raise RuntimeError("RPC session bootstrap failed: missing sessionFile")
        session.session_file = session_file
        self._sync_session_from_state(session, state)

    def get_session(self, session_id: str) -> SessionProcess | None:
        with self._lock:
            session = self._sessions.get(session_id)
            if session:
                session.info.last_used_at = time.time()
                self._sync_registry_from_session(session, force_save=False)
            return session

    def list_sessions(self) -> list[dict[str, Any]]:
        with self._lock:
            items = sorted(
                self._sessions.values(),
                key=lambda s: s.info.last_used_at,
                reverse=True,
            )
            return [item.info.to_dict() for item in items]

    def get_runtime_options(self) -> dict[str, Any]:
        command_path = get_pi_command_path()
        if not command_path:
            raise RuntimeError("RPC mode requires `pi` command on PATH.")

        async def load_options() -> dict[str, Any]:
            async with PiRpcClient(
                command_path=command_path,
                cwd=str(get_pi_workdir()),
                timeout_seconds=get_pi_timeout_seconds(),
                extra_args=_pi_rpc_extra_args("--session-dir", str(get_pi_rpc_session_dir())),
            ) as client:
                state = await client.get_state(request_id="models:state")
                models = await client.get_available_models(request_id="models:list")
                return {
                    "state": state,
                    "models": models,
                }

        return _run_coro_sync(load_options())

    def update_session_settings(
        self,
        session_id: str,
        *,
        thinking_level: str | None = None,
        model_provider: str | None = None,
        model_id: str | None = None,
    ) -> dict[str, Any]:
        with self._lock:
            session = self._sessions.get(session_id)
            if not session:
                raise KeyError(session_id)
            if session.info.pending_request_id:
                raise RuntimeError("该会话仍在回复中，暂时无法切换模型或思考水平。")

        command_path = get_pi_command_path()
        if not command_path:
            raise RuntimeError("RPC mode requires `pi` command on PATH.")

        requested_provider = (model_provider or "").strip()
        requested_model_id = (model_id or "").strip()
        requested_thinking = (thinking_level or "").strip().lower()

        async def update_settings() -> dict[str, Any]:
            async with PiRpcClient(
                command_path=command_path,
                cwd=session.workdir,
                timeout_seconds=get_pi_timeout_seconds(),
                extra_args=_pi_rpc_extra_args("--session-dir", str(get_pi_rpc_session_dir())),
            ) as client:
                await client.switch_session(
                    session_path=session.session_file,
                    request_id=f"{session_id}:settings:switch",
                )
                if requested_provider and requested_model_id:
                    await client.set_model(
                        provider=requested_provider,
                        model_id=requested_model_id,
                        request_id=f"{session_id}:settings:model",
                    )
                if requested_thinking:
                    await client.set_thinking_level(
                        level=requested_thinking,
                        request_id=f"{session_id}:settings:thinking",
                    )
                return await client.get_state(
                    request_id=f"{session_id}:settings:state",
                )

        state = _run_coro_sync(update_settings())
        with self._lock:
            latest = self._sessions.get(session_id)
            if latest is None:
                raise KeyError(session_id)
            self._sync_session_from_state(latest, state)
            latest.info.last_used_at = time.time()
            self._sync_registry_from_session(latest)
            return latest.info.to_dict()

    def get_session_stats(self, session_id: str) -> dict[str, Any]:
        with self._lock:
            session = self._sessions.get(session_id)
            if not session:
                raise KeyError(session_id)

        command_path = get_pi_command_path()
        if not command_path:
            raise RuntimeError("RPC mode requires `pi` command on PATH.")

        async def load_stats() -> dict[str, Any]:
            async with PiRpcClient(
                command_path=command_path,
                cwd=session.workdir,
                timeout_seconds=get_pi_timeout_seconds(),
                extra_args=_pi_rpc_extra_args("--session-dir", str(get_pi_rpc_session_dir())),
            ) as client:
                await client.switch_session(
                    session_path=session.session_file,
                    request_id=f"{session_id}:stats:switch",
                )
                return await client.get_session_stats(
                    request_id=f"{session_id}:stats:get",
                )

        return _run_coro_sync(load_stats())

    def compact_session(
        self,
        session_id: str,
        *,
        custom_instructions: str | None = None,
    ) -> dict[str, Any]:
        with self._lock:
            session = self._sessions.get(session_id)
            if not session:
                raise KeyError(session_id)
            if session.info.pending_request_id:
                raise RuntimeError("该会话仍在回复中，暂时无法 compact。")

        command_path = get_pi_command_path()
        if not command_path:
            raise RuntimeError("RPC mode requires `pi` command on PATH.")

        async def compact() -> dict[str, Any]:
            async with PiRpcClient(
                command_path=command_path,
                cwd=session.workdir,
                timeout_seconds=get_pi_timeout_seconds(),
                extra_args=_pi_rpc_extra_args("--session-dir", str(get_pi_rpc_session_dir())),
            ) as client:
                await client.switch_session(
                    session_path=session.session_file,
                    request_id=f"{session_id}:compact:switch",
                )
                result = await client.compact(
                    custom_instructions=custom_instructions,
                    request_id=f"{session_id}:compact:run",
                )
                stats = await client.get_session_stats(
                    request_id=f"{session_id}:compact:stats",
                )
                state = await client.get_state(
                    request_id=f"{session_id}:compact:state",
                )
                return {
                    "result": result,
                    "stats": stats,
                    "state": state,
                }

        payload = _run_coro_sync(compact())
        with self._lock:
            latest = self._sessions.get(session_id)
            if latest is None:
                raise KeyError(session_id)
            state = payload.get("state")
            if isinstance(state, dict):
                self._sync_session_from_state(latest, state)
            latest.info.last_used_at = time.time()
            self._sync_registry_from_session(latest)
        return payload

    def get_session_count(self) -> int:
        with self._lock:
            return len(self._sessions)

    def _delete_native_session_file(self, session: SessionProcess) -> None:
        if not session.session_file:
            return
        try:
            path = Path(session.session_file).expanduser()
            if path.exists():
                path.unlink()
        except Exception:
            logger.warning("Failed to delete native session file: %s", session.session_file, exc_info=True)

    def destroy_session(self, session_id: str) -> bool:
        with self._lock:
            session = self._sessions.pop(session_id, None)
            if not session:
                return False
            self._delete_native_session_file(session)
            try:
                self._turns_file(session_id).unlink(missing_ok=True)
            except Exception:
                logger.warning("Failed to delete app turn history for session %s", session_id, exc_info=True)
            self._remove_registry_session(session_id)
            return True

    def cleanup_idle(self) -> list[str]:
        if self.idle_timeout is None:
            return []
        now = time.time()
        cleaned: list[str] = []
        with self._lock:
            to_remove: list[str] = []
            for sid, session in self._sessions.items():
                if session.info.pending_request_id:
                    continue
                if now - session.info.last_used_at > self.idle_timeout:
                    to_remove.append(sid)
            for sid in to_remove:
                if self.destroy_session(sid):
                    cleaned.append(sid)
        return cleaned

    async def start_cleanup_loop(self, interval: int = 300) -> None:
        if self.idle_timeout is None:
            return
        if self._cleanup_task and not self._cleanup_task.done():
            return

        async def cleanup_loop():
            while True:
                await asyncio.sleep(interval)
                self.cleanup_idle()

        self._cleanup_task = asyncio.create_task(cleanup_loop())

    def stop_cleanup_loop(self) -> None:
        if self._cleanup_task:
            self._cleanup_task.cancel()
            self._cleanup_task = None

    def _extract_text_from_content(self, content: Any) -> str:
        if isinstance(content, str):
            return content.strip()
        if isinstance(content, list):
            parts: list[str] = []
            for item in content:
                if not isinstance(item, dict):
                    continue
                if str(item.get("type") or "") != "text":
                    continue
                text = item.get("text")
                if isinstance(text, str) and text:
                    parts.append(text)
            return "".join(parts).strip()
        return ""

    def _extract_assistant_text_from_messages(self, messages: Any) -> str:
        if not isinstance(messages, list):
            return ""
        latest_text = ""
        for item in messages:
            if not isinstance(item, dict):
                continue
            if str(item.get("role") or "") != "assistant":
                continue
            text = self._extract_text_from_content(item.get("content"))
            if text:
                latest_text = text
        return latest_text

    def _extract_assistant_text_from_message(self, message: Any) -> str:
        if not isinstance(message, dict):
            return ""
        if str(message.get("role") or "") != "assistant":
            return ""
        return self._extract_text_from_content(message.get("content"))

    def _normalize_tool_action(self, tool_name: str) -> str:
        normalized = tool_name.strip().lower()
        aliases = {
            "grep": "search",
            "glob": "search",
            "rg": "search",
            "ls": "explore",
            "list": "explore",
        }
        return aliases.get(normalized, normalized or "tool")

    def _short_trace_text(self, value: Any, max_length: int = 180) -> str:
        normalized = " ".join(str(value or "").split())
        if len(normalized) <= max_length:
            return normalized
        return f"{normalized[: max_length - 1].rstrip()}…"

    def _trace_path_from_args(self, args: dict[str, Any]) -> str:
        for key in ("path", "filePath", "cwd", "dir", "directory"):
            value = args.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        return ""

    def _trace_search_query_from_args(self, args: dict[str, Any]) -> str:
        for key in ("pattern", "query", "search", "text", "needle"):
            value = args.get(key)
            if isinstance(value, str) and value.strip():
                return self._short_trace_text(value.strip(), max_length=120)
        return ""

    def _describe_tool_trace(
        self,
        tool_name: str,
        args: dict[str, Any],
    ) -> tuple[str, str, str]:
        action = self._normalize_tool_action(tool_name)
        path = self._trace_path_from_args(args)
        query = self._trace_search_query_from_args(args)
        command = self._short_trace_text(args.get("command") or args.get("cmd"), max_length=140)

        if action == "read":
            return action, "读取文件", f"读取 {path}" if path else "读取文件"
        if action == "search":
            if path and query:
                return action, "搜索内容", f"在 {path} 中搜索“{query}”"
            if query:
                return action, "搜索内容", f"搜索“{query}”"
            return action, "搜索内容", f"搜索 {path}" if path else "搜索内容"
        if action == "bash":
            if command:
                return action, "执行命令", f"执行命令：{command}"
            return action, "执行命令", f"在 {path} 中执行命令" if path else "执行命令"
        if action == "explore":
            return action, "查看目录", f"查看 {path}" if path else "查看仓库内容"
        if action in {"write", "edit"}:
            return action, "修改文件", f"修改 {path}" if path else "修改文件"

        detail = self._short_trace_text(json.dumps(args, ensure_ascii=False), max_length=180) if args else tool_name
        return action, f"调用工具：{tool_name}", detail

    def _rpc_trace_item_from_event(self, event: dict[str, Any]) -> dict[str, Any] | None:
        event_type = str(event.get("type") or "")
        if event_type == "tool_execution_start":
            tool_name = str(event.get("toolName") or "unknown")
            args = event.get("args") if isinstance(event.get("args"), dict) else {}
            action, title, detail = self._describe_tool_trace(tool_name, args)
            trace_item = {
                "kind": "tool",
                "title": title,
                "detail": detail,
                "action": action,
                "tool_name": tool_name,
                "event_type": event_type,
            }
            if args:
                trace_item["args"] = args
            path = self._trace_path_from_args(args)
            if path:
                trace_item["path"] = path
            return trace_item
        if event_type == "tool_execution_end" and bool(event.get("isError")):
            tool_name = str(event.get("toolName") or "unknown")
            raw_detail = self._stringify_rpc_error_detail(
                event.get("error")
                or event.get("errorMessage")
                or event.get("result")
                or "Pi RPC reported a tool execution error.",
                max_length=4000,
            )
            is_security_block, clean_detail, security_payload = self._parse_security_reason(raw_detail)
            trace_item = {
                "kind": "status",
                "title": f"{'安全限制已阻止' if is_security_block else '工具出错'}：{tool_name}",
                "detail": self._short_trace_text(clean_detail or raw_detail, max_length=220),
                "action": "status",
                "event_type": event_type,
            }
            if is_security_block and security_payload:
                trace_item["security"] = security_payload
            return trace_item
        if event_type == "extension_error":
            return {
                "kind": "status",
                "title": "扩展错误",
                "detail": str(event.get("error") or "Unknown extension error."),
                "action": "status",
                "event_type": event_type,
            }
        return None

    def _stringify_rpc_error_detail(self, value: Any, *, max_length: int = 220) -> str:
        if isinstance(value, str):
            return self._short_trace_text(value, max_length=max_length)
        if isinstance(value, (int, float, bool)):
            return str(value)
        if isinstance(value, dict):
            for key in ("message", "errorMessage", "finalError", "reason", "text", "value"):
                nested = self._stringify_rpc_error_detail(value.get(key), max_length=max_length)
                if nested:
                    return nested
            content = value.get("content")
            nested_content = self._stringify_rpc_error_detail(content, max_length=max_length)
            if nested_content:
                return nested_content
            return self._short_trace_text(json.dumps(value, ensure_ascii=False), max_length=max_length)
        if isinstance(value, list) and value:
            for item in reversed(value):
                nested = self._stringify_rpc_error_detail(item, max_length=max_length)
                if nested:
                    return nested
            return self._short_trace_text(json.dumps(value, ensure_ascii=False), max_length=max_length)
        return ""

    def _parse_security_reason(self, detail: str) -> tuple[bool, str, dict[str, Any] | None]:
        normalized = str(detail or "").strip()
        prefix = "[gogo-security]"
        if not normalized.startswith(prefix):
            return False, normalized, None

        payload_text = normalized[len(prefix) :].strip()
        if not payload_text:
            return True, "", None
        try:
            payload = json.loads(payload_text)
        except json.JSONDecodeError:
            return True, payload_text, None

        if not isinstance(payload, dict):
            return True, str(payload), None

        message = str(payload.get("message") or payload.get("reason") or "").strip()
        if not message:
            message = payload_text
        return True, message, payload

    def _extract_rpc_error_detail_from_message(self, message: Any) -> str:
        if not isinstance(message, dict):
            return ""
        for key in ("errorMessage", "finalError", "error", "reason"):
            detail = self._stringify_rpc_error_detail(message.get(key))
            if detail:
                return detail
        content = message.get("content")
        if isinstance(content, list):
            for item in reversed(content):
                if not isinstance(item, dict):
                    continue
                for key in ("errorMessage", "error", "message", "reason"):
                    detail = self._stringify_rpc_error_detail(item.get(key))
                    if detail:
                        return detail
        return ""

    def _extract_rpc_error_detail_from_event(self, event: dict[str, Any]) -> str:
        if not isinstance(event, dict):
            return ""

        event_type = str(event.get("type") or "")
        if event_type == "message_update":
            assistant_event = event.get("assistantMessageEvent")
            if isinstance(assistant_event, dict):
                for key in ("error", "errorMessage", "reason"):
                    detail = self._stringify_rpc_error_detail(assistant_event.get(key))
                    if detail:
                        return detail
                partial = assistant_event.get("partial")
                if isinstance(partial, dict):
                    detail = self._extract_rpc_error_detail_from_message(partial)
                    if detail:
                        return detail

        for key in ("finalError", "errorMessage", "error"):
            detail = self._stringify_rpc_error_detail(event.get(key))
            if detail:
                return detail

        if event_type == "agent_end":
            messages = event.get("messages")
            if isinstance(messages, list):
                for message in reversed(messages):
                    detail = self._extract_rpc_error_detail_from_message(message)
                    if detail:
                        return detail

        if event_type in {"message_end", "turn_end"}:
            detail = self._extract_rpc_error_detail_from_message(event.get("message"))
            if detail:
                return detail

        return ""

    def _no_visible_text_message(self, raw_error_detail: str) -> str:
        base = "Pi RPC 未返回可见文本。"
        detail = self._short_trace_text(raw_error_detail, max_length=220).strip()
        if not detail:
            return base
        return f"{base} Pi 原始报错：{detail}"

    def _user_aborted_terminal_event(
        self,
        *,
        session: SessionProcess,
        trace: list[dict[str, Any]],
        streamed_text_chunks: list[str],
    ) -> dict[str, Any]:
        partial_text = "".join(streamed_text_chunks).strip()
        return {
            "type": "final",
            "message": partial_text or "已停止回复。",
            "warnings": [],
            "trace": trace,
            "history_length": session.info.message_count + 1,
            "stopped": True,
        }

    def _extension_ui_timeout_seconds(self, request: dict[str, Any]) -> float:
        raw_timeout = request.get("timeout") if isinstance(request, dict) else None
        try:
            timeout_ms = int(raw_timeout)
        except (TypeError, ValueError):
            timeout_ms = 0
        if timeout_ms > 0:
            return max(1.0, timeout_ms / 1000)
        return float(EXTENSION_UI_DEFAULT_TIMEOUT_SECONDS)

    def _begin_extension_ui_wait(
        self,
        session: SessionProcess,
        request: dict[str, Any],
    ) -> asyncio.Future[bool]:
        loop = asyncio.get_running_loop()
        waiter: asyncio.Future[bool] = loop.create_future()
        stale_waiter: asyncio.Future[bool] | None = None
        with self._lock:
            stale_waiter = session.active_extension_ui_waiter
            session.active_extension_ui_request = dict(request)
            session.active_extension_ui_waiter = waiter
        if stale_waiter is not None and not stale_waiter.done():
            stale_waiter.set_result(False)
        return waiter

    def _clear_extension_ui_wait(
        self,
        session: SessionProcess,
        *,
        request_id: str | None = None,
    ) -> tuple[dict[str, Any] | None, asyncio.Future[bool] | None]:
        with self._lock:
            active_request = session.active_extension_ui_request
            if request_id:
                active_id = str(active_request.get("id") or "").strip() if isinstance(active_request, dict) else ""
                if active_id != str(request_id).strip():
                    return None, None
            waiter = session.active_extension_ui_waiter
            session.active_extension_ui_request = None
            session.active_extension_ui_waiter = None
        return active_request, waiter

    def abort_pending_request(self, session_id: str) -> dict[str, Any]:
        with self._lock:
            session = self._sessions.get(session_id)
            if not session:
                return {
                    "success": False,
                    "session_id": session_id,
                    "detail": f"Session not found: {session_id}",
                }
            if not session.info.pending_request_id:
                return {
                    "success": False,
                    "session_id": session_id,
                    "detail": "当前会话没有进行中的回复。",
                }

            session.abort_requested = True
            request_id = session.info.pending_request_id
            rpc_client = session.active_rpc_client
            active_loop = session.active_loop
            pending_ui_request = dict(session.active_extension_ui_request or {})
            pending_ui_waiter = session.active_extension_ui_waiter
            if pending_ui_request:
                session.active_extension_ui_request = None
                session.active_extension_ui_waiter = None

        if rpc_client is not None and active_loop is not None and active_loop.is_running():
            def schedule_abort() -> None:
                async def run_abort() -> None:
                    try:
                        ui_request_id = str(pending_ui_request.get("id") or "").strip()
                        if ui_request_id:
                            await rpc_client.send_extension_ui_response(
                                ui_request_id=ui_request_id,
                                cancelled=True,
                            )
                            if pending_ui_waiter is not None and not pending_ui_waiter.done():
                                pending_ui_waiter.set_result(False)
                        await rpc_client.abort(
                            request_id=f"{request_id}:user_abort" if request_id else None
                        )
                    except Exception:
                        logger.warning("Failed to send user abort to Pi RPC", exc_info=True)

                asyncio.create_task(run_abort())

            active_loop.call_soon_threadsafe(schedule_abort)

        return {
            "success": True,
            "session_id": session_id,
            "detail": "已请求终止当前回复。",
        }

    def respond_extension_ui_request(self, session_id: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
        payload = payload if isinstance(payload, dict) else {}
        with self._lock:
            session = self._sessions.get(session_id)
            if not session:
                return {
                    "success": False,
                    "session_id": session_id,
                    "detail": f"Session not found: {session_id}",
                }
            active_request = dict(session.active_extension_ui_request or {})
            waiter = session.active_extension_ui_waiter
            rpc_client = session.active_rpc_client
            active_loop = session.active_loop

        request_id = str(payload.get("id") or "").strip()
        active_request_id = str(active_request.get("id") or "").strip()
        if not active_request_id:
            return {
                "success": False,
                "session_id": session_id,
                "detail": "当前会话没有等待中的 Pi 交互请求。",
            }
        if request_id != active_request_id:
            return {
                "success": False,
                "session_id": session_id,
                "detail": f"当前等待中的 Pi 交互请求是 {active_request_id}，不是 {request_id or '(empty)'}。",
            }
        if rpc_client is None or active_loop is None or not active_loop.is_running():
            return {
                "success": False,
                "session_id": session_id,
                "detail": "当前会话的 Pi RPC 连接已失效，无法继续交互。",
            }

        response_kwargs: dict[str, Any] = {
            "ui_request_id": request_id,
            "cancelled": bool(payload.get("cancelled")),
        }
        if not response_kwargs["cancelled"]:
            if payload.get("value") is not None:
                response_kwargs["value"] = str(payload.get("value") or "")
            elif payload.get("confirmed") is not None:
                response_kwargs["confirmed"] = bool(payload.get("confirmed"))
            else:
                return {
                    "success": False,
                    "session_id": session_id,
                    "detail": "Pi 交互响应缺少 value / confirmed / cancelled。",
                }

        async def run_response() -> None:
            await rpc_client.send_extension_ui_response(**response_kwargs)

        try:
            future = asyncio.run_coroutine_threadsafe(run_response(), active_loop)
            future.result(timeout=10)
        except Exception as exc:
            logger.warning("Failed to send extension UI response", exc_info=True)
            return {
                "success": False,
                "session_id": session_id,
                "detail": f"发送 Pi 交互响应失败：{exc}",
            }

        cleared_request, _ = self._clear_extension_ui_wait(session, request_id=request_id)
        if waiter is not None:
            active_loop.call_soon_threadsafe(
                lambda: None if waiter.done() else waiter.set_result(True)
            )
        return {
            "success": True,
            "session_id": session_id,
            "detail": "已把交互结果发回给当前 Pi 请求。",
            "request": cleared_request or active_request,
        }

    async def _stream_rpc_request(
        self,
        *,
        session: SessionProcess,
        message: str,
        request_id: str | None,
    ) -> AsyncIterator[dict[str, Any]]:
        if not session.lock.acquire(blocking=False):
            yield {
                "type": "error",
                "message": "该会话已有进行中的请求，请等待当前回复结束后再发送。",
                "warnings": ["Session is busy with another request."],
            }
            return

        session.abort_requested = False
        session.active_rpc_client = None
        session.active_loop = asyncio.get_running_loop()
        session.active_extension_ui_request = None
        session.active_extension_ui_waiter = None
        session.info.pending_request_id = request_id or f"pending-{uuid.uuid4()}"
        session.info.last_used_at = time.time()
        self._sync_registry_from_session(session)

        trace: list[dict[str, Any]] = []
        streamed_text_chunks: list[str] = []
        latest_assistant_text = ""
        latest_error_detail = ""
        client: PiRpcClient | None = None
        pending_thinking_chunks: list[str] = []

        def flush_pending_thinking() -> None:
            if not pending_thinking_chunks:
                return
            thinking_text = "".join(pending_thinking_chunks).strip()
            pending_thinking_chunks.clear()
            if not thinking_text:
                return
            trace.append(
                {
                    "kind": "thinking",
                    "title": "思考记录",
                    "detail": thinking_text,
                    "action": "thinking",
                    "event_type": "thinking_delta",
                }
            )

        try:
            command_path = get_pi_command_path()
            if not command_path:
                yield {
                    "type": "error",
                    "message": "RPC 模式下未找到 `pi` 命令，请检查环境配置。",
                    "warnings": ["Pi command not found on PATH."],
                }
                return

            async with PiRpcClient(
                command_path=command_path,
                cwd=session.workdir,
                timeout_seconds=get_pi_timeout_seconds(),
                extra_args=_pi_rpc_extra_args("--session-dir", str(get_pi_rpc_session_dir())),
            ) as rpc_client:
                client = rpc_client
                session.active_rpc_client = rpc_client
                switch_result = await rpc_client.switch_session(
                    session_path=session.session_file,
                    request_id=f"{request_id}:switch" if request_id else None,
                )
                if bool(switch_result.get("cancelled")):
                    yield {
                        "type": "error",
                        "message": "Pi 拒绝切换会话，本次请求已取消。",
                        "warnings": ["Pi RPC switch_session cancelled."],
                    }
                    return

                if session.info.title:
                    try:
                        await rpc_client.set_session_name(
                            name=session.info.title,
                            request_id=f"{request_id}:name" if request_id else None,
                        )
                    except PiRpcError:
                        logger.warning("Failed to sync session name", exc_info=True)

                async for rpc_event in rpc_client.prompt_events(
                    message=message,
                    request_id=request_id,
                ):
                    event_type = str(rpc_event.get("type") or "")
                    event_error_detail = self._extract_rpc_error_detail_from_event(rpc_event)
                    if event_error_detail:
                        latest_error_detail = event_error_detail
                    if event_type == "message_update":
                        assistant_event = rpc_event.get("assistantMessageEvent")
                        snapshot_text = self._extract_assistant_text_from_message(
                            rpc_event.get("message")
                        )
                        if snapshot_text:
                            latest_assistant_text = snapshot_text
                        if not isinstance(assistant_event, dict):
                            continue
                        assistant_event_type = str(assistant_event.get("type") or "")
                        if assistant_event_type == "text_delta":
                            delta = assistant_event.get("delta")
                            if isinstance(delta, str) and delta:
                                streamed_text_chunks.append(delta)
                                yield {"type": "text_delta", "delta": delta}
                            continue
                        if assistant_event_type == "text_end":
                            content = assistant_event.get("content")
                            if isinstance(content, str) and content.strip():
                                latest_assistant_text = content.strip()
                            continue
                        if assistant_event_type == "thinking_delta":
                            delta = assistant_event.get("delta")
                            if isinstance(delta, str) and delta:
                                pending_thinking_chunks.append(delta)
                                yield {"type": "thinking_delta", "delta": delta}
                            continue
                        if assistant_event_type == "error":
                            flush_pending_thinking()
                            if session.abort_requested:
                                terminal_event = self._user_aborted_terminal_event(
                                    session=session,
                                    trace=trace,
                                    streamed_text_chunks=streamed_text_chunks,
                                )
                                self._persist_exchange_turns(
                                    session=session,
                                    user_message=message,
                                    assistant_event=terminal_event,
                                )
                                yield terminal_event
                                return
                            reason = str(assistant_event.get("reason") or "error")
                            terminal_event = {
                                "type": "error",
                                "message": PI_INTERRUPTED_USER_MESSAGE,
                                "warnings": [f"Pi assistant stream error: {reason}"],
                                "trace": trace,
                            }
                            self._persist_exchange_turns(
                                session=session,
                                user_message=message,
                                assistant_event=terminal_event,
                            )
                            yield terminal_event
                            return
                        continue

                    if event_type == "extension_ui_request":
                        flush_pending_thinking()
                        ui_request = rpc_event if isinstance(rpc_event, dict) else {}
                        ui_waiter = self._begin_extension_ui_wait(session, ui_request)
                        yield {
                            "type": "extension_ui_request",
                            "session_id": session.session_id,
                            "request": ui_request,
                        }
                        timeout_seconds = self._extension_ui_timeout_seconds(ui_request)
                        try:
                            await asyncio.wait_for(asyncio.shield(ui_waiter), timeout=timeout_seconds)
                        except asyncio.TimeoutError:
                            ui_request_id = str(ui_request.get("id") or "").strip()
                            if ui_request_id:
                                logger.info(
                                    "Extension UI request timed out; auto-cancelling pending dialog: session=%s request=%s",
                                    session.session_id,
                                    ui_request_id,
                                )
                                try:
                                    await rpc_client.send_extension_ui_response(
                                        ui_request_id=ui_request_id,
                                        cancelled=True,
                                    )
                                except Exception:
                                    logger.warning("Failed to auto-cancel extension UI request", exc_info=True)
                            _, pending_waiter = self._clear_extension_ui_wait(
                                session,
                                request_id=ui_request_id,
                            )
                            if pending_waiter is not None and not pending_waiter.done():
                                pending_waiter.set_result(False)
                        continue

                    if event_type in {"message_end", "turn_end"}:
                        snapshot_text = self._extract_assistant_text_from_message(
                            rpc_event.get("message")
                        )
                        if snapshot_text:
                            latest_assistant_text = snapshot_text

                    trace_item = self._rpc_trace_item_from_event(rpc_event)
                    if trace_item:
                        flush_pending_thinking()
                        trace.append(trace_item)
                        yield {"type": "trace", "item": trace_item}

                    if event_type == "agent_end":
                        flush_pending_thinking()
                        final_text = self._extract_assistant_text_from_messages(
                            rpc_event.get("messages")
                        )
                        if not final_text:
                            final_text = latest_assistant_text
                        if not final_text:
                            final_text = "".join(streamed_text_chunks).strip()
                        terminal_event = {
                            "type": "final",
                            "message": final_text or self._no_visible_text_message(latest_error_detail),
                            "warnings": [],
                            "trace": trace,
                            "history_length": session.info.message_count + 1,
                        }
                        self._persist_exchange_turns(
                            session=session,
                            user_message=message,
                            assistant_event=terminal_event,
                        )
                        yield terminal_event
                        return

        except asyncio.TimeoutError:
            flush_pending_thinking()
            if client is not None:
                try:
                    await client.abort(request_id=f"{request_id}:abort" if request_id else None)
                except Exception:
                    logger.warning("Failed to abort RPC request after timeout", exc_info=True)
            terminal_event = {
                "type": "error",
                "message": PI_TIMEOUT_USER_MESSAGE,
                "warnings": ["Pi RPC 流式读取超时。"],
                "trace": trace,
            }
            self._persist_exchange_turns(
                session=session,
                user_message=message,
                assistant_event=terminal_event,
            )
            yield terminal_event
        except PiRpcError as exc:
            flush_pending_thinking()
            if session.abort_requested:
                terminal_event = self._user_aborted_terminal_event(
                    session=session,
                    trace=trace,
                    streamed_text_chunks=streamed_text_chunks,
                )
                self._persist_exchange_turns(
                    session=session,
                    user_message=message,
                    assistant_event=terminal_event,
                )
                yield terminal_event
                return
            terminal_event = {
                "type": "error",
                "message": f"Pi RPC 调用失败：{exc}",
                "warnings": [str(exc)],
                "trace": trace,
            }
            self._persist_exchange_turns(
                session=session,
                user_message=message,
                assistant_event=terminal_event,
            )
            yield terminal_event
        except Exception as exc:
            flush_pending_thinking()
            if session.abort_requested:
                terminal_event = self._user_aborted_terminal_event(
                    session=session,
                    trace=trace,
                    streamed_text_chunks=streamed_text_chunks,
                )
                self._persist_exchange_turns(
                    session=session,
                    user_message=message,
                    assistant_event=terminal_event,
                )
                yield terminal_event
                return
            terminal_event = {
                "type": "error",
                "message": f"Pi RPC 未能完成请求：{exc}",
                "warnings": [str(exc)],
                "trace": trace,
            }
            self._persist_exchange_turns(
                session=session,
                user_message=message,
                assistant_event=terminal_event,
            )
            yield terminal_event
        finally:
            session.abort_requested = False
            session.active_rpc_client = None
            session.active_loop = None
            session.active_extension_ui_request = None
            waiter = session.active_extension_ui_waiter
            session.active_extension_ui_waiter = None
            if waiter is not None and not waiter.done():
                waiter.set_result(False)
            session.info.pending_request_id = None
            session.info.last_used_at = time.time()
            session.info.message_count += 1
            self._sync_registry_from_session(session)
            session.lock.release()

    def send_message(
        self,
        session_id: str,
        message: str,
        stream: bool = True,
        request_id: str | None = None,
    ) -> dict[str, Any] | None:
        session = self.get_session(session_id)
        if not session:
            return None

        if stream:
            return {"ok": True}

        async def gather_final() -> dict[str, Any]:
            async for event in self._stream_rpc_request(
                session=session,
                message=message,
                request_id=request_id,
            ):
                event_type = str(event.get("type") or "")
                if event_type == "final":
                    return {
                        "ok": True,
                        "message": str(event.get("message") or "").strip(),
                        "warnings": event.get("warnings", []),
                        "trace": event.get("trace", []),
                    }
                if event_type == "error":
                    return {
                        "ok": False,
                        "error": str(event.get("message") or "Pi RPC 调用失败"),
                        "warnings": event.get("warnings", []),
                        "trace": event.get("trace", []),
                    }
            return {"ok": False, "error": "No terminal event returned."}

        return _run_coro_sync(gather_final())

    async def send_message_async(
        self,
        session_id: str,
        message: str,
        request_id: str | None = None,
    ):
        session = self.get_session(session_id)
        if not session:
            yield {"type": "error", "message": "Session 不存在或已失效"}
            return

        async for event in self._stream_rpc_request(
            session=session,
            message=message,
            request_id=request_id,
        ):
            yield event

    def _history_from_agent_messages(
        self,
        *,
        messages: list[dict[str, Any]],
        max_turns: int,
    ) -> list[dict[str, str]]:
        history: list[dict[str, str]] = []
        for message in messages:
            role = str(message.get("role") or "")
            if role not in {"user", "assistant"}:
                continue
            content_text = self._extract_text_from_content(message.get("content"))
            if not content_text:
                continue
            history.append({"role": role, "content": content_text})
        if max_turns > 0 and len(history) > max_turns:
            return history[-max_turns:]
        return history

    def _load_history_via_rpc(
        self,
        *,
        session: SessionProcess,
        max_turns: int,
        offset_turns: int = 0,
    ) -> list[dict[str, str]] | None:
        if not session.session_file:
            return None
        if not session.lock.acquire(blocking=False):
            return None

        try:
            command_path = get_pi_command_path()
            if not command_path:
                return None

            async def fetch_messages() -> list[dict[str, Any]]:
                async with PiRpcClient(
                    command_path=command_path,
                    cwd=session.workdir,
                    timeout_seconds=get_pi_timeout_seconds(),
                    extra_args=_pi_rpc_extra_args("--session-dir", str(get_pi_rpc_session_dir())),
                ) as client:
                    await client.switch_session(
                        session_path=session.session_file,
                        request_id=f"{session.session_id}:history:switch",
                    )
                    return await client.get_messages(
                        request_id=f"{session.session_id}:history:get_messages",
                    )

            messages = _run_coro_sync(fetch_messages())
            if not isinstance(messages, list):
                return []
            requested_window = max_turns + max(offset_turns, 0)
            history = self._history_from_agent_messages(messages=messages, max_turns=requested_window)
            return self._slice_history_window(history, max_turns=max_turns, offset_turns=offset_turns)
        except Exception:
            logger.warning(
                "Failed to load history via RPC for session %s",
                session.session_id,
                exc_info=True,
            )
            return None
        finally:
            session.lock.release()

    def _load_history_from_native_jsonl(
        self,
        *,
        session_file: str,
        max_turns: int,
        offset_turns: int = 0,
    ) -> list[dict[str, str]] | None:
        path = Path(session_file).expanduser()
        if not path.exists():
            return None

        entries_by_id: dict[str, dict[str, Any]] = {}
        order: list[str] = []
        try:
            with path.open("r", encoding="utf-8") as handle:
                for raw_line in handle:
                    line = raw_line.strip()
                    if not line:
                        continue
                    try:
                        entry = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    if not isinstance(entry, dict):
                        continue
                    entry_id = str(entry.get("id") or "").strip()
                    if not entry_id:
                        continue
                    entries_by_id[entry_id] = entry
                    order.append(entry_id)
        except Exception:
            logger.warning("Failed to parse native session file: %s", session_file, exc_info=True)
            return None

        if not order:
            return []

        leaf_id = order[-1]
        path_ids: list[str] = []
        guard = 0
        while leaf_id and guard < 100000:
            guard += 1
            entry = entries_by_id.get(leaf_id)
            if not entry:
                break
            path_ids.append(leaf_id)
            parent_id = entry.get("parentId")
            if not isinstance(parent_id, str) or not parent_id.strip():
                break
            leaf_id = parent_id
        path_ids.reverse()

        messages: list[dict[str, Any]] = []
        for entry_id in path_ids:
            entry = entries_by_id.get(entry_id)
            if not isinstance(entry, dict):
                continue
            if str(entry.get("type") or "") != "message":
                continue
            message = entry.get("message")
            if isinstance(message, dict):
                messages.append(message)

        requested_window = max_turns + max(offset_turns, 0)
        history = self._history_from_agent_messages(messages=messages, max_turns=requested_window)
        return self._slice_history_window(history, max_turns=max_turns, offset_turns=offset_turns)

    def replay_history(
        self,
        session_id: str,
        max_turns: int = 200,
        offset_turns: int = 0,
    ) -> list[dict[str, Any]]:
        app_turns = self._load_history_from_app_turns(
            session_id=session_id,
            max_turns=max_turns,
            offset_turns=offset_turns,
        )

        with self._lock:
            session = self._sessions.get(session_id)
            if session is None:
                record = self._registry.get(session_id)
                if record:
                    session = SessionProcess(
                        session_id=session_id,
                        session_file=str(record.get("session_file") or ""),
                        workdir=str(record.get("workdir") or str(get_pi_workdir())),
                        thinking_level=str(record.get("thinking_level") or get_pi_thinking_level()),
                    )
                    session.info.title = str(record.get("title") or "").strip()
                    session.info.created_at = float(record.get("created_at") or time.time())
                    session.info.last_used_at = float(record.get("last_used_at") or session.info.created_at)
                    session.info.message_count = int(record.get("message_count") or 0)
                    self._sessions[session_id] = session

        # Fast path: for normal gogo-app-created sessions, app turn history already
        # contains the exact user/assistant turns plus richer UI metadata
        # (trace/consulted pages/warnings). Replaying it directly avoids spawning a
        # fresh Pi RPC client and calling get_messages() every time the user opens a
        # session, which was a visible source of startup/switch latency.
        if session and self._app_turns_fast_path_is_safe(
            session=session,
            app_turns=app_turns,
            max_turns=max_turns,
            offset_turns=offset_turns,
        ):
            return app_turns

        if session:
            if session.session_file:
                offline = self._load_history_from_native_jsonl(
                    session_file=session.session_file,
                    max_turns=max_turns,
                    offset_turns=offset_turns,
                )
                if offline is not None:
                    merged_offline = self._merge_rich_history_tail(offline, app_turns or [])
                    if merged_offline is not None:
                        return merged_offline
                    merged_offline = self._merge_rich_history_by_user_turns(offline, app_turns or [])
                    if merged_offline is not None:
                        return merged_offline
                    if app_turns and len(app_turns) >= len(offline):
                        return app_turns
                    return offline
            online = self._load_history_via_rpc(
                session=session,
                max_turns=max_turns,
                offset_turns=offset_turns,
            )
            if online is not None:
                merged_online = self._merge_rich_history_tail(online, app_turns or [])
                if merged_online is not None:
                    return merged_online
                merged_online = self._merge_rich_history_by_user_turns(online, app_turns or [])
                if merged_online is not None:
                    return merged_online
                if app_turns and len(app_turns) >= len(online):
                    return app_turns
                return online
        if app_turns is not None:
            return app_turns
        return []


_global_pool: SessionPool | None = None


def get_session_pool() -> SessionPool:
    global _global_pool
    if _global_pool is None:
        _global_pool = SessionPool()
    return _global_pool


def reset_session_pool() -> None:
    global _global_pool
    if _global_pool:
        _global_pool.stop_cleanup_loop()
        for session in _global_pool._sessions.values():
            session.info.pending_request_id = None
            _global_pool._sync_registry_from_session(session)
    _global_pool = None
