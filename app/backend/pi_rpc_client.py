from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid
from collections import deque
from dataclasses import dataclass
from typing import Any, AsyncIterator


logger = logging.getLogger(__name__)


class PiRpcError(RuntimeError):
    """Raised when RPC command fails or transport breaks."""


@dataclass
class PiRpcResponse:
    data: dict[str, Any]
    pending_events: list[dict[str, Any]]


class PiRpcClient:
    """
    Minimal async RPC client for `pi --mode rpc`.

    Notes:
    - Uses strict LF (`\\n`) framing (see docs/pi/rpc.md).
    - Supports command/response correlation with `id`.
    - This client is intentionally single-flight for F1.
    """

    def __init__(
        self,
        *,
        command_path: str,
        cwd: str,
        timeout_seconds: int,
        extra_args: list[str] | None = None,
    ):
        self.command_path = command_path
        self.cwd = cwd
        self.timeout_seconds = max(10, int(timeout_seconds))
        self.extra_args = list(extra_args or [])
        self._process: asyncio.subprocess.Process | None = None
        self._stdout_buffer = bytearray()

    async def __aenter__(self) -> PiRpcClient:
        await self.start()
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        await self.close()

    async def start(self) -> None:
        if self._process and self._process.returncode is None:
            return
        command = [self.command_path, "--mode", "rpc", *self.extra_args]
        logger.info("Starting Pi RPC process: %s (cwd=%s)", command, self.cwd)
        self._process = await asyncio.create_subprocess_exec(
            *command,
            cwd=self.cwd,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

    async def close(self) -> None:
        process = self._process
        self._process = None
        if not process:
            return

        if process.returncode is None:
            process.terminate()
            try:
                await asyncio.wait_for(process.wait(), timeout=3)
            except asyncio.TimeoutError:
                process.kill()
                await process.wait()

    async def get_state(self, *, request_id: str | None = None) -> dict[str, Any]:
        response = await self._send_command_and_wait_response(
            command_type="get_state",
            payload={},
            request_id=request_id,
        )
        return response.data.get("data") if isinstance(response.data.get("data"), dict) else {}

    async def get_messages(self, *, request_id: str | None = None) -> list[dict[str, Any]]:
        response = await self._send_command_and_wait_response(
            command_type="get_messages",
            payload={},
            request_id=request_id,
        )
        data = response.data.get("data")
        if not isinstance(data, dict):
            return []
        messages = data.get("messages")
        if not isinstance(messages, list):
            return []
        return [item for item in messages if isinstance(item, dict)]

    async def abort(self, *, request_id: str | None = None) -> bool:
        response = await self._send_command_and_wait_response(
            command_type="abort",
            payload={},
            request_id=request_id,
        )
        return bool(response.data.get("success"))

    async def new_session(
        self,
        *,
        request_id: str | None = None,
        parent_session: str | None = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {}
        if parent_session:
            payload["parentSession"] = parent_session
        response = await self._send_command_and_wait_response(
            command_type="new_session",
            payload=payload,
            request_id=request_id,
        )
        data = response.data.get("data")
        return data if isinstance(data, dict) else {}

    async def switch_session(
        self,
        *,
        session_path: str,
        request_id: str | None = None,
    ) -> dict[str, Any]:
        response = await self._send_command_and_wait_response(
            command_type="switch_session",
            payload={"sessionPath": session_path},
            request_id=request_id,
        )
        data = response.data.get("data")
        return data if isinstance(data, dict) else {}

    async def set_session_name(
        self,
        *,
        name: str,
        request_id: str | None = None,
    ) -> bool:
        response = await self._send_command_and_wait_response(
            command_type="set_session_name",
            payload={"name": name},
            request_id=request_id,
        )
        return bool(response.data.get("success"))

    async def set_thinking_level(
        self,
        *,
        level: str,
        request_id: str | None = None,
    ) -> bool:
        response = await self._send_command_and_wait_response(
            command_type="set_thinking_level",
            payload={"level": level},
            request_id=request_id,
        )
        return bool(response.data.get("success"))

    async def prompt_events(
        self,
        *,
        message: str,
        request_id: str | None = None,
        images: list[dict[str, Any]] | None = None,
    ) -> AsyncIterator[dict[str, Any]]:
        payload: dict[str, Any] = {"message": message}
        if images:
            payload["images"] = images

        response = await self._send_command_and_wait_response(
            command_type="prompt",
            payload=payload,
            request_id=request_id,
        )
        for event in response.pending_events:
            yield event

        while True:
            record = await self._read_record(self.timeout_seconds)
            record_type = str(record.get("type") or "")
            if record_type == "response":
                # Ignore unrelated responses in single-flight mode.
                continue
            yield record
            if record_type == "agent_end":
                break

    async def _send_command_and_wait_response(
        self,
        *,
        command_type: str,
        payload: dict[str, Any],
        request_id: str | None,
    ) -> PiRpcResponse:
        if not self._process or self._process.returncode is not None:
            raise PiRpcError("Pi RPC process is not running.")

        command_id = (request_id or str(uuid.uuid4())).strip()
        command = {"id": command_id, "type": command_type, **payload}
        await self._write_command(command)

        started_at = time.monotonic()
        pending: deque[dict[str, Any]] = deque()
        while True:
            record = await self._read_record(self.timeout_seconds)
            if str(record.get("type") or "") != "response":
                pending.append(record)
                continue
            if str(record.get("id") or "") != command_id:
                pending.append(record)
                continue

            elapsed_ms = int((time.monotonic() - started_at) * 1000)
            logger.info(
                "Pi RPC response: command=%s id=%s success=%s elapsed_ms=%s",
                command_type,
                command_id,
                bool(record.get("success")),
                elapsed_ms,
            )

            if not bool(record.get("success")):
                error_text = str(record.get("error") or "unknown RPC error")
                raise PiRpcError(f"RPC command `{command_type}` failed: {error_text}")
            return PiRpcResponse(data=record, pending_events=list(pending))

    async def _write_command(self, command: dict[str, Any]) -> None:
        if not self._process or self._process.stdin is None:
            raise PiRpcError("Pi RPC stdin is unavailable.")
        raw = json.dumps(command, ensure_ascii=False).encode("utf-8") + b"\n"
        self._process.stdin.write(raw)
        await self._process.stdin.drain()

    async def _read_record(self, timeout_seconds: int) -> dict[str, Any]:
        while True:
            line = await self._read_line(timeout_seconds)
            if line is None:
                raise PiRpcError("Pi RPC stdout closed unexpectedly.")
            stripped = line.strip()
            if not stripped:
                continue
            try:
                parsed = json.loads(stripped)
            except json.JSONDecodeError:
                logger.warning("Ignoring malformed RPC line: %s", stripped[:240])
                continue
            if isinstance(parsed, dict):
                return parsed

    async def _read_line(self, timeout_seconds: int) -> str | None:
        if not self._process or self._process.stdout is None:
            return None

        while True:
            lf_index = self._stdout_buffer.find(b"\n")
            if lf_index >= 0:
                line = bytes(self._stdout_buffer[:lf_index])
                del self._stdout_buffer[: lf_index + 1]
                if line.endswith(b"\r"):
                    line = line[:-1]
                return line.decode("utf-8", errors="replace")

            try:
                chunk = await asyncio.wait_for(
                    self._process.stdout.read(4096),
                    timeout=timeout_seconds,
                )
            except asyncio.TimeoutError as exc:
                raise asyncio.TimeoutError(
                    f"Pi RPC read timeout after {timeout_seconds}s"
                ) from exc

            if not chunk:
                if self._stdout_buffer:
                    line = bytes(self._stdout_buffer)
                    self._stdout_buffer.clear()
                    if line.endswith(b"\r"):
                        line = line[:-1]
                    return line.decode("utf-8", errors="replace")
                return None

            self._stdout_buffer.extend(chunk)
