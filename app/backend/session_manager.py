"""
Session 管理器模块

提供 Pi SDK Session 的池化管理，支持：
- Session 创建、获取、归还、销毁
- 长连接支持（避免每条问题新建 session）
- 多会话并行（支持用户同时开启多个对话）
- Session 元数据管理（创建时间、最后使用时间等）
"""

from __future__ import annotations

import asyncio
import json
import logging
import subprocess
import threading
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

from .config import (
    get_pi_node_command_path,
    get_pi_sdk_bridge_path,
    get_session_event_store_dir,
    get_pi_thinking_level,
    get_pi_timeout_seconds,
    get_pi_workdir,
)
from .session_event_store import SessionEventStore


logger = logging.getLogger(__name__)


@dataclass
class SessionInfo:
    """Session 元数据"""

    session_id: str
    created_at: float = field(default_factory=time.time)
    last_used_at: float = field(default_factory=time.time)
    message_count: int = 0
    title: str = ""  # 会话标题（可由用户设置或自动生成）

    def to_dict(self) -> dict[str, Any]:
        return {
            "session_id": self.session_id,
            "created_at": self.created_at,
            "last_used_at": self.last_used_at,
            "message_count": self.message_count,
            "title": self.title or f"会话 {self.session_id[:8]}",
        }


@dataclass
class SessionProcess:
    """Session 进程包装器"""

    session_id: str
    process: subprocess.Popen | None = None
    info: SessionInfo = field(default_factory=lambda: SessionInfo(session_id=""))
    lock: threading.Lock = field(default_factory=threading.Lock)
    _stdin_lock: threading.Lock = field(default_factory=threading.Lock)

    def __post_init__(self):
        self.info.session_id = self.session_id


class SessionPool:
    """
    Session 池管理器

    维护一个 Pi SDK Session 的池子，支持复用和并发访问。
    每个 Session 对应一个独立的 Node.js 子进程，通过 stdin/stdout 通信。
    """

    def __init__(self, max_sessions: int = 10, idle_timeout: int = 3600):
        """
        Args:
            max_sessions: 最大 Session 数量
            idle_timeout: Session 空闲超时（秒），超时后自动回收
        """
        self.max_sessions = max_sessions
        self.idle_timeout = idle_timeout
        self._sessions: dict[str, SessionProcess] = {}
        self._lock = threading.RLock()
        self._cleanup_task: asyncio.Task | None = None
        self._event_store = SessionEventStore(get_session_event_store_dir())

    def _record_event(
        self,
        *,
        event_type: str,
        session_id: str,
        request_id: str | None = None,
        payload: dict[str, Any] | None = None,
    ) -> None:
        try:
            self._event_store.append_event(
                event_type=event_type,
                session_id=session_id,
                request_id=request_id,
                payload=payload,
            )
        except Exception:
            logger.exception("Failed to append session event")

    def create_session(
        self,
        cwd: str | None = None,
        thinking_level: str | None = None,
        system_prompt: str | None = None,
    ) -> str:
        """
        创建新 Session

        Args:
            cwd: 工作目录
            thinking_level: 思考级别
            system_prompt: 系统提示词

        Returns:
            session_id
        """
        with self._lock:
            if len(self._sessions) >= self.max_sessions:
                # 池子已满，回收最老的空闲 Session
                self._evict_oldest()

            session_id = str(uuid.uuid4())
            session_process = SessionProcess(session_id=session_id)
            self._sessions[session_id] = session_process

            # 启动 Node.js 子进程（长连接模式）
            process = self._start_session_process(
                cwd=cwd,
                thinking_level=thinking_level,
                system_prompt=system_prompt,
            )
            session_process.process = process
            self._record_event(
                event_type="session_created",
                session_id=session_id,
                payload={
                    "cwd": str(cwd) if cwd else str(get_pi_workdir()),
                    "thinking_level": thinking_level or get_pi_thinking_level(),
                    "has_system_prompt": bool(system_prompt),
                },
            )

            return session_id

    def _start_session_process(
        self,
        cwd: str | None = None,
        thinking_level: str | None = None,
        system_prompt: str | None = None,
    ) -> subprocess.Popen:
        """启动 Node.js Session 进程"""
        node_command = get_pi_node_command_path() or "node"
        bridge_path = get_pi_sdk_bridge_path()
        workdir = str(cwd) if cwd else str(get_pi_workdir())
        level = thinking_level or get_pi_thinking_level()

        # 构建初始化 payload
        init_payload = {
            "cwd": workdir,
            "thinking_level": level,
            "system_prompt": system_prompt or "",
            "mode": "long_running",  # 长连接模式标识
        }

        process = subprocess.Popen(
            [node_command, str(bridge_path)],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
            cwd=workdir,
        )

        # 发送初始化配置（非阻塞）
        def send_init():
            try:
                process.stdin.write(json.dumps(init_payload) + "\n")
                process.stdin.flush()
            except Exception:
                pass  # 初始化失败不影响后续使用

        threading.Thread(target=send_init, daemon=True).start()

        return process

    def get_session(self, session_id: str) -> SessionProcess | None:
        """
        获取 Session

        Args:
            session_id: Session ID

        Returns:
            SessionProcess 或 None（不存在）
        """
        with self._lock:
            session = self._sessions.get(session_id)
            if session:
                session.info.last_used_at = time.time()
            return session

    def return_session(self, session_id: str) -> None:
        """
        归还 Session 到池中

        Args:
            session_id: Session ID
        """
        with self._lock:
            session = self._sessions.get(session_id)
            if session:
                session.info.last_used_at = time.time()
                session.info.message_count += 1

    def destroy_session(self, session_id: str) -> bool:
        """
        销毁 Session

        Args:
            session_id: Session ID

        Returns:
            是否成功销毁
        """
        with self._lock:
            session = self._sessions.pop(session_id, None)
            if session:
                self._record_event(
                    event_type="session_destroyed",
                    session_id=session_id,
                    payload={"message_count": session.info.message_count},
                )
                self._terminate_process(session)
                return True
            return False

    def _terminate_process(self, session: SessionProcess) -> None:
        """终止 Session 进程"""
        with session.lock:
            if session.process:
                try:
                    session.process.terminate()
                    session.process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    session.process.kill()
                except Exception:
                    pass
                session.process = None

    def _evict_oldest(self) -> None:
        """回收最老的空闲 Session"""
        oldest_id = None
        oldest_time = float("inf")

        for sid, session in self._sessions.items():
            if session.info.last_used_at < oldest_time:
                oldest_time = session.info.last_used_at
                oldest_id = sid

        if oldest_id:
            self.destroy_session(oldest_id)

    def list_sessions(self) -> list[dict[str, Any]]:
        """
        列出所有活跃 Session

        Returns:
            Session 元数据列表
        """
        with self._lock:
            return [session.info.to_dict() for session in self._sessions.values()]

    def get_session_count(self) -> int:
        """获取当前 Session 数量"""
        with self._lock:
            return len(self._sessions)

    def cleanup_idle(self) -> list[str]:
        """
        清理空闲超时的 Session

        Returns:
            被清理的 Session ID 列表
        """
        cleaned = []
        now = time.time()

        with self._lock:
            to_remove = []
            for sid, session in self._sessions.items():
                if now - session.info.last_used_at > self.idle_timeout:
                    to_remove.append(sid)

            for sid in to_remove:
                self.destroy_session(sid)
                cleaned.append(sid)

        return cleaned

    def replay_history(self, session_id: str, max_turns: int = 200) -> list[dict[str, str]]:
        """
        Rebuild chat history from persisted JSONL events.

        Args:
            session_id: Session ID
            max_turns: Max number of turns (user/assistant items) to return
        """
        events = self._event_store.load_session_events(session_id)
        if not events:
            return []

        requests: dict[str, dict[str, Any]] = {}
        order: list[str] = []
        last_key: str | None = None

        def ensure_request(key: str, ts: float) -> dict[str, Any]:
            if key not in requests:
                requests[key] = {
                    "first_ts": ts,
                    "user_message": "",
                    "assistant_buffer": "",
                    "final_message": "",
                    "error_message": "",
                }
                order.append(key)
            return requests[key]

        for index, record in enumerate(events):
            if not isinstance(record, dict):
                continue
            event_type = str(record.get("type") or "")
            ts = float(record.get("ts") or 0.0)
            request_id = record.get("request_id")
            request_key = str(request_id).strip() if request_id else ""
            if not request_key:
                if event_type == "request_started":
                    request_key = f"legacy-{index}"
                elif last_key:
                    request_key = last_key
                else:
                    request_key = f"orphan-{index}"

            request_state = ensure_request(request_key, ts)
            last_key = request_key

            payload = record.get("payload")
            payload = payload if isinstance(payload, dict) else {}

            if event_type == "request_started":
                message = payload.get("message")
                if isinstance(message, str) and message.strip():
                    request_state["user_message"] = message
                continue

            if event_type != "stream_event":
                continue

            stream_type = str(payload.get("type") or "")
            if stream_type == "text_delta":
                delta = payload.get("delta")
                if isinstance(delta, str) and delta:
                    request_state["assistant_buffer"] += delta
                continue

            if stream_type == "text_replace":
                text = payload.get("text")
                if isinstance(text, str):
                    request_state["assistant_buffer"] = text
                continue

            if stream_type == "final":
                final_message = payload.get("message")
                if isinstance(final_message, str) and final_message.strip():
                    request_state["final_message"] = final_message
                continue

            if stream_type == "error":
                error_message = payload.get("message")
                if isinstance(error_message, str) and error_message.strip():
                    request_state["error_message"] = error_message

        history: list[dict[str, str]] = []
        for key in order:
            state = requests.get(key, {})
            user_message = str(state.get("user_message") or "").strip()
            if user_message:
                history.append({"role": "user", "content": user_message})

            assistant_message = (
                str(state.get("final_message") or "").strip()
                or str(state.get("assistant_buffer") or "").strip()
                or str(state.get("error_message") or "").strip()
            )
            if assistant_message:
                history.append({"role": "assistant", "content": assistant_message})

        if max_turns > 0 and len(history) > max_turns:
            return history[-max_turns:]
        return history

    async def start_cleanup_loop(self, interval: int = 300) -> None:
        """
        启动后台清理循环

        Args:
            interval: 清理间隔（秒）
        """

        if self._cleanup_task and not self._cleanup_task.done():
            return

        async def cleanup_loop():
            while True:
                await asyncio.sleep(interval)
                self.cleanup_idle()

        self._cleanup_task = asyncio.create_task(cleanup_loop())

    def stop_cleanup_loop(self) -> None:
        """停止后台清理循环"""
        if self._cleanup_task:
            self._cleanup_task.cancel()
            self._cleanup_task = None

    def send_message(
        self,
        session_id: str,
        message: str,
        history: list[dict[str, str]] | None = None,
        stream: bool = True,
        request_id: str | None = None,
    ) -> dict[str, Any] | None:
        """
        发送消息到 Session（同步模式）

        Args:
            session_id: Session ID
            message: 用户消息
            history: 对话历史
            stream: 是否流式

        Returns:
            响应数据或 None
        """
        session = self.get_session(session_id)
        if not session or not session.process:
            return None

        thinking_level = get_pi_thinking_level()
        payload = {
            "prompt": message,
            "history": history or [],
            "thinking_level": thinking_level,
            "stream": stream,
            "request_id": request_id,
        }
        self._record_event(
            event_type="request_started",
            session_id=session_id,
            request_id=request_id,
            payload={
                "message": message,
                "history_length": len(history or []),
                "stream": stream,
            },
        )

        with session._stdin_lock:
            try:
                session.process.stdin.write(json.dumps(payload) + "\n")
                session.process.stdin.flush()

                if not stream:
                    # 同步模式：读取完整响应
                    line = session.process.stdout.readline()
                    if line:
                        self.return_session(session_id)
                        response = json.loads(line)
                        self._record_event(
                            event_type="request_completed",
                            session_id=session_id,
                            request_id=request_id,
                            payload={"stream": stream, "ok": True},
                        )
                        return response
                else:
                    # 流式模式：由调用者自行读取
                    self.return_session(session_id)
                    self._record_event(
                        event_type="request_completed",
                        session_id=session_id,
                        request_id=request_id,
                        payload={"stream": stream, "ok": True},
                    )
                    return {"ok": True}

            except Exception:
                self._record_event(
                    event_type="request_failed",
                    session_id=session_id,
                    request_id=request_id,
                    payload={"stream": stream, "reason": "sync_send_exception"},
                )
                return None

        return None

    async def send_message_async(
        self,
        session_id: str,
        message: str,
        history: list[dict[str, str]] | None = None,
        request_id: str | None = None,
    ):
        """
        发送消息到 Session（异步流式模式）

        Args:
            session_id: Session ID
            message: 用户消息
            history: 对话历史

        Yields:
            事件字典
        """
        session = self.get_session(session_id)
        if not session or not session.process:
            yield {"type": "error", "message": "Session 不存在或进程已终止"}
            return

        thinking_level = get_pi_thinking_level()
        payload = {
            "prompt": message,
            "history": history or [],
            "thinking_level": thinking_level,
            "stream": True,
            "request_id": request_id,
        }
        self._record_event(
            event_type="request_started",
            session_id=session_id,
            request_id=request_id,
            payload={
                "message": message,
                "history_length": len(history or []),
                "stream": True,
            },
        )
        terminal_type = "stream_ended"

        try:
            with session._stdin_lock:
                session.process.stdin.write(json.dumps(payload) + "\n")
                session.process.stdin.flush()

            # 异步读取流式响应
            loop = asyncio.get_event_loop()
            stream_timeout_seconds = max(30, int(get_pi_timeout_seconds()))
            while True:
                try:
                    line = await asyncio.wait_for(
                        loop.run_in_executor(None, session.process.stdout.readline),
                        timeout=stream_timeout_seconds,
                    )
                except asyncio.TimeoutError:
                    timeout_event = {
                        "type": "error",
                        "message": f"Session 响应超时（>{stream_timeout_seconds}s），请重试。",
                        "warnings": [f"Session stream timeout after {stream_timeout_seconds}s."],
                    }
                    self._record_event(
                        event_type="stream_event",
                        session_id=session_id,
                        request_id=request_id,
                        payload=timeout_event,
                    )
                    yield timeout_event
                    terminal_type = "timeout"
                    break
                if not line:
                    returncode = session.process.poll()
                    if returncode is not None:
                        stderr_text = ""
                        try:
                            if session.process.stderr:
                                stderr_text = session.process.stderr.read().strip()
                        except Exception:
                            stderr_text = ""
                        detail = (
                            f"Session 进程已退出（code={returncode}）。"
                            + (f" stderr: {stderr_text}" if stderr_text else "")
                        )
                        exited_event = {
                            "type": "error",
                            "message": detail,
                            "warnings": [detail],
                        }
                        self._record_event(
                            event_type="stream_event",
                            session_id=session_id,
                            request_id=request_id,
                            payload=exited_event,
                        )
                        yield exited_event
                        terminal_type = "process_exited"
                    break
                try:
                    event = json.loads(line.strip())
                    self._record_event(
                        event_type="stream_event",
                        session_id=session_id,
                        request_id=request_id,
                        payload=event,
                    )
                    yield event
                    if event.get("type") in ("final", "error"):
                        terminal_type = str(event.get("type"))
                        break
                except json.JSONDecodeError:
                    continue

        finally:
            self.return_session(session_id)
            self._record_event(
                event_type="request_completed",
                session_id=session_id,
                request_id=request_id,
                payload={"stream": True, "terminal_type": terminal_type},
            )


# 全局 Session 池实例
_global_pool: SessionPool | None = None


def get_session_pool() -> SessionPool:
    """获取全局 Session 池"""
    global _global_pool
    if _global_pool is None:
        _global_pool = SessionPool()
    return _global_pool


def reset_session_pool() -> None:
    """重置全局 Session 池（用于测试或重启）"""
    global _global_pool
    if _global_pool:
        _global_pool.stop_cleanup_loop()
        # 销毁所有 Session
        session_ids = list(_global_pool._sessions.keys())
        for sid in session_ids:
            _global_pool.destroy_session(sid)
    _global_pool = None
