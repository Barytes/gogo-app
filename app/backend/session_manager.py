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
    get_pi_rpc_session_dir,
    get_pi_thinking_level,
    get_pi_timeout_seconds,
    get_pi_workdir,
)
from .pi_rpc_client import PiRpcClient, PiRpcError


logger = logging.getLogger(__name__)

PI_TIMEOUT_USER_MESSAGE = "Pi 回复超时，本次请求已自动停止。你可以重试，或切换会话继续提问。"
PI_INTERRUPTED_USER_MESSAGE = "Pi 回复异常中断，本次请求已自动停止。你可以重试，或切换会话继续提问。"

REGISTRY_FILENAME = "gogo-session-registry.json"


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

    def to_dict(self) -> dict[str, Any]:
        return {
            "session_id": self.session_id,
            "created_at": self.created_at,
            "last_used_at": self.last_used_at,
            "message_count": self.message_count,
            "title": self.title or f"会话 {self.session_id[:8]}",
            "is_pending": bool(self.pending_request_id),
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

    def __post_init__(self) -> None:
        self.info.session_id = self.session_id


class SessionPool:
    def __init__(self, max_sessions: int = 10, idle_timeout: int = 3600):
        self.max_sessions = max_sessions
        self.idle_timeout = idle_timeout
        self._sessions: dict[str, SessionProcess] = {}
        self._lock = threading.RLock()
        self._cleanup_task: asyncio.Task | None = None

        self._session_dir = get_pi_rpc_session_dir()
        self._session_dir.mkdir(parents=True, exist_ok=True)
        self._registry_file = self._session_dir / REGISTRY_FILENAME
        self._registry: dict[str, dict[str, Any]] = self._load_registry()
        self._restore_sessions_from_registry()

    def _load_registry(self) -> dict[str, dict[str, Any]]:
        if not self._registry_file.exists():
            return {}
        try:
            raw = self._registry_file.read_text(encoding="utf-8")
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
        self._registry_file.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def _sync_registry_from_session(self, session: SessionProcess) -> None:
        self._registry[session.session_id] = {
            "session_id": session.session_id,
            "session_file": session.session_file,
            "workdir": session.workdir,
            "thinking_level": session.thinking_level,
            "title": session.info.title,
            "created_at": session.info.created_at,
            "last_used_at": session.info.last_used_at,
            "message_count": session.info.message_count,
        }
        self._save_registry()

    def _remove_registry_session(self, session_id: str) -> None:
        if session_id in self._registry:
            self._registry.pop(session_id, None)
            self._save_registry()

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
            self._sessions[sid] = session

    def _evict_oldest(self) -> None:
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
        system_prompt: str | None = None,
        title: str | None = None,
    ) -> str:
        del system_prompt  # RPC 链路暂不支持 per-session system prompt
        with self._lock:
            if len(self._sessions) >= self.max_sessions:
                self._evict_oldest()

            sid = str(uuid.uuid4())
            session = SessionProcess(
                session_id=sid,
                workdir=str(cwd) if cwd else str(get_pi_workdir()),
                thinking_level=thinking_level or get_pi_thinking_level(),
            )
            if title:
                session.info.title = title
            self._bootstrap_rpc_session(session)
            self._sessions[sid] = session
            self._sync_registry_from_session(session)
            return sid

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
                extra_args=["--session-dir", str(session_dir)],
            ) as client:
                await client.get_state(request_id=f"{session.session_id}:bootstrap:state")
                await client.new_session(request_id=f"{session.session_id}:bootstrap:new")
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

        session_name = str(state.get("sessionName") or "").strip()
        if session_name:
            session.info.title = session_name

    def get_session(self, session_id: str) -> SessionProcess | None:
        with self._lock:
            session = self._sessions.get(session_id)
            if session:
                session.info.last_used_at = time.time()
                self._sync_registry_from_session(session)
            return session

    def list_sessions(self) -> list[dict[str, Any]]:
        with self._lock:
            items = sorted(
                self._sessions.values(),
                key=lambda s: s.info.last_used_at,
                reverse=True,
            )
            return [item.info.to_dict() for item in items]

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
            self._remove_registry_session(session_id)
            return True

    def cleanup_idle(self) -> list[str]:
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
            return {
                "kind": "status",
                "title": f"工具出错：{tool_name}",
                "detail": "Pi RPC reported a tool execution error.",
                "action": "status",
                "event_type": event_type,
            }
        if event_type == "extension_error":
            return {
                "kind": "status",
                "title": "扩展错误",
                "detail": str(event.get("error") or "Unknown extension error."),
                "action": "status",
                "event_type": event_type,
            }
        return None

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

        if rpc_client is not None and active_loop is not None and active_loop.is_running():
            def schedule_abort() -> None:
                asyncio.create_task(
                    rpc_client.abort(
                        request_id=f"{request_id}:user_abort" if request_id else None
                    )
                )

            active_loop.call_soon_threadsafe(schedule_abort)

        return {
            "success": True,
            "session_id": session_id,
            "detail": "已请求终止当前回复。",
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
        session.info.pending_request_id = request_id or f"pending-{uuid.uuid4()}"
        session.info.last_used_at = time.time()
        self._sync_registry_from_session(session)

        trace: list[dict[str, Any]] = []
        streamed_text_chunks: list[str] = []
        client: PiRpcClient | None = None

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
                extra_args=["--session-dir", str(get_pi_rpc_session_dir())],
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
                    if event_type == "message_update":
                        assistant_event = rpc_event.get("assistantMessageEvent")
                        if not isinstance(assistant_event, dict):
                            continue
                        assistant_event_type = str(assistant_event.get("type") or "")
                        if assistant_event_type == "text_delta":
                            delta = assistant_event.get("delta")
                            if isinstance(delta, str) and delta:
                                streamed_text_chunks.append(delta)
                                yield {"type": "text_delta", "delta": delta}
                            continue
                        if assistant_event_type == "thinking_delta":
                            delta = assistant_event.get("delta")
                            if isinstance(delta, str) and delta:
                                yield {"type": "thinking_delta", "delta": delta}
                            continue
                        if assistant_event_type == "error":
                            if session.abort_requested:
                                yield self._user_aborted_terminal_event(
                                    session=session,
                                    trace=trace,
                                    streamed_text_chunks=streamed_text_chunks,
                                )
                                return
                            reason = str(assistant_event.get("reason") or "error")
                            yield {
                                "type": "error",
                                "message": PI_INTERRUPTED_USER_MESSAGE,
                                "warnings": [f"Pi assistant stream error: {reason}"],
                                "trace": trace,
                            }
                            return
                        continue

                    trace_item = self._rpc_trace_item_from_event(rpc_event)
                    if trace_item:
                        trace.append(trace_item)
                        yield {"type": "trace", "item": trace_item}

                    if event_type == "agent_end":
                        final_text = self._extract_assistant_text_from_messages(
                            rpc_event.get("messages")
                        )
                        if not final_text:
                            final_text = "".join(streamed_text_chunks).strip()
                        yield {
                            "type": "final",
                            "message": final_text or "Pi RPC 未返回可见文本。",
                            "warnings": [],
                            "trace": trace,
                            "history_length": session.info.message_count + 1,
                        }
                        return

        except asyncio.TimeoutError:
            if client is not None:
                try:
                    await client.abort(request_id=f"{request_id}:abort" if request_id else None)
                except Exception:
                    logger.warning("Failed to abort RPC request after timeout", exc_info=True)
            yield {
                "type": "error",
                "message": PI_TIMEOUT_USER_MESSAGE,
                "warnings": ["Pi RPC 流式读取超时。"],
                "trace": trace,
            }
        except PiRpcError as exc:
            if session.abort_requested:
                yield self._user_aborted_terminal_event(
                    session=session,
                    trace=trace,
                    streamed_text_chunks=streamed_text_chunks,
                )
                return
            yield {
                "type": "error",
                "message": f"Pi RPC 调用失败：{exc}",
                "warnings": [str(exc)],
                "trace": trace,
            }
        except Exception as exc:
            if session.abort_requested:
                yield self._user_aborted_terminal_event(
                    session=session,
                    trace=trace,
                    streamed_text_chunks=streamed_text_chunks,
                )
                return
            yield {
                "type": "error",
                "message": f"Pi RPC 未能完成请求：{exc}",
                "warnings": [str(exc)],
                "trace": trace,
            }
        finally:
            session.abort_requested = False
            session.active_rpc_client = None
            session.active_loop = None
            session.info.pending_request_id = None
            session.info.last_used_at = time.time()
            session.info.message_count += 1
            self._sync_registry_from_session(session)
            session.lock.release()

    def send_message(
        self,
        session_id: str,
        message: str,
        history: list[dict[str, str]] | None = None,
        stream: bool = True,
        request_id: str | None = None,
    ) -> dict[str, Any] | None:
        del history
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
        history: list[dict[str, str]] | None = None,
        request_id: str | None = None,
    ):
        del history
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
                    extra_args=["--session-dir", str(get_pi_rpc_session_dir())],
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
            return self._history_from_agent_messages(messages=messages, max_turns=max_turns)
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

        return self._history_from_agent_messages(messages=messages, max_turns=max_turns)

    def replay_history(self, session_id: str, max_turns: int = 200) -> list[dict[str, str]]:
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

        if session:
            online = self._load_history_via_rpc(session=session, max_turns=max_turns)
            if online is not None:
                return online
            if session.session_file:
                offline = self._load_history_from_native_jsonl(
                    session_file=session.session_file,
                    max_turns=max_turns,
                )
                if offline is not None:
                    return offline
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
