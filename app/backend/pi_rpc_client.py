from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid
from typing import Any, AsyncIterator


logger = logging.getLogger(__name__)


class PiRpcError(RuntimeError):
    """Raised when RPC command fails or transport breaks."""


class PiRpcClient:
    """
    Minimal async RPC client for `pi --mode rpc`.

    Notes:
    - Uses strict LF (`\\n`) framing (see docs/pi/rpc.md).
    - Uses a single background reader task for stdout.
    - Command responses are dispatched by `id`; stream events go through a queue.
    - Only one prompt stream should be active at a time.
    """

    def __init__(
        self,
        *,
        command_path: str,
        cwd: str,
        timeout_seconds: int | None,
        extra_args: list[str] | None = None,
    ):
        self.command_path = command_path
        self.cwd = cwd
        self.timeout_seconds = max(10, int(timeout_seconds)) if timeout_seconds is not None else None
        self.extra_args = list(extra_args or [])
        self._process: asyncio.subprocess.Process | None = None
        self._stdout_buffer = bytearray()
        self._reader_task: asyncio.Task[None] | None = None
        self._reader_error: Exception | None = None
        self._response_waiters: dict[str, asyncio.Future[dict[str, Any]]] = {}
        self._event_queue: asyncio.Queue[Any] = asyncio.Queue()
        self._write_lock = asyncio.Lock()
        self._prompt_lock = asyncio.Lock()
        self._stream_closed_sentinel = object()
        self._closing = False

    async def __aenter__(self) -> PiRpcClient:
        await self.start()
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        await self.close()

    async def start(self) -> None:
        if self._process and self._process.returncode is None:
            return
        self._stdout_buffer.clear()
        self._reader_error = None
        self._response_waiters.clear()
        self._event_queue = asyncio.Queue()
        self._closing = False
        command = [self.command_path, "--mode", "rpc", *self.extra_args]
        logger.info("Starting Pi RPC process: %s (cwd=%s)", command, self.cwd)
        self._process = await asyncio.create_subprocess_exec(
            *command,
            cwd=self.cwd,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        self._reader_task = asyncio.create_task(self._reader_loop(), name="pi-rpc-reader")

    async def close(self) -> None:
        process = self._process
        reader_task = self._reader_task
        self._closing = True
        if not process:
            self._reader_task = None
            self._process = None
            return

        if process.returncode is None:
            process.terminate()
            try:
                await asyncio.wait_for(process.wait(), timeout=3)
            except asyncio.TimeoutError:
                process.kill()
                await process.wait()

        if reader_task is not None:
            try:
                await asyncio.wait_for(reader_task, timeout=1)
            except asyncio.TimeoutError:
                reader_task.cancel()
                await asyncio.gather(reader_task, return_exceptions=True)
            except Exception:
                logger.debug("Pi RPC reader loop exited during close", exc_info=True)

        self._reader_task = None
        self._process = None
        close_error = PiRpcError("Pi RPC client closed.")
        self._fail_pending_waiters(close_error)
        self._signal_stream_closed()

    async def get_state(self, *, request_id: str | None = None) -> dict[str, Any]:
        response = await self._send_command_and_wait_response(
            command_type="get_state",
            payload={},
            request_id=request_id,
        )
        return response.get("data") if isinstance(response.get("data"), dict) else {}

    async def get_messages(self, *, request_id: str | None = None) -> list[dict[str, Any]]:
        response = await self._send_command_and_wait_response(
            command_type="get_messages",
            payload={},
            request_id=request_id,
        )
        data = response.get("data")
        if not isinstance(data, dict):
            return []
        messages = data.get("messages")
        if not isinstance(messages, list):
            return []
        return [item for item in messages if isinstance(item, dict)]

    async def get_available_models(self, *, request_id: str | None = None) -> list[dict[str, Any]]:
        response = await self._send_command_and_wait_response(
            command_type="get_available_models",
            payload={},
            request_id=request_id,
        )
        data = response.get("data")
        if not isinstance(data, dict):
            return []
        models = data.get("models")
        if not isinstance(models, list):
            return []
        return [item for item in models if isinstance(item, dict)]

    async def get_session_stats(self, *, request_id: str | None = None) -> dict[str, Any]:
        response = await self._send_command_and_wait_response(
            command_type="get_session_stats",
            payload={},
            request_id=request_id,
        )
        return response.get("data") if isinstance(response.get("data"), dict) else {}

    async def abort(self, *, request_id: str | None = None) -> bool:
        command_id = (request_id or str(uuid.uuid4())).strip()
        await self._write_command({"id": command_id, "type": "abort"})
        logger.info("Pi RPC abort sent: id=%s", command_id)
        return True

    async def send_extension_ui_response(
        self,
        *,
        ui_request_id: str,
        value: str | None = None,
        confirmed: bool | None = None,
        cancelled: bool = False,
    ) -> bool:
        request_id = str(ui_request_id or "").strip()
        if not request_id:
            raise PiRpcError("Missing extension UI request id.")

        payload: dict[str, Any] = {
            "type": "extension_ui_response",
            "id": request_id,
        }
        if cancelled:
            payload["cancelled"] = True
        elif value is not None:
            payload["value"] = str(value)
        elif confirmed is not None:
            payload["confirmed"] = bool(confirmed)
        else:
            raise PiRpcError("Extension UI response requires value, confirmed, or cancelled.")

        await self._write_command(payload)
        logger.info(
            "Pi RPC extension UI response sent: id=%s cancelled=%s has_value=%s has_confirmed=%s",
            request_id,
            cancelled,
            value is not None,
            confirmed is not None,
        )
        return True

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
        data = response.get("data")
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
        data = response.get("data")
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
        return bool(response.get("success"))

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
        return bool(response.get("success"))

    async def set_model(
        self,
        *,
        provider: str,
        model_id: str,
        request_id: str | None = None,
    ) -> dict[str, Any]:
        response = await self._send_command_and_wait_response(
            command_type="set_model",
            payload={"provider": provider, "modelId": model_id},
            request_id=request_id,
        )
        data = response.get("data")
        return data if isinstance(data, dict) else {}

    async def compact(
        self,
        *,
        custom_instructions: str | None = None,
        request_id: str | None = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {}
        if custom_instructions and custom_instructions.strip():
            payload["customInstructions"] = custom_instructions.strip()
        response = await self._send_command_and_wait_response(
            command_type="compact",
            payload=payload,
            request_id=request_id,
        )
        data = response.get("data")
        return data if isinstance(data, dict) else {}

    async def prompt_events(
        self,
        *,
        message: str,
        request_id: str | None = None,
        images: list[dict[str, Any]] | None = None,
    ) -> AsyncIterator[dict[str, Any]]:
        if self._prompt_lock.locked():
            raise PiRpcError("Pi RPC prompt stream is already active.")

        await self._prompt_lock.acquire()
        payload: dict[str, Any] = {"message": message}
        if images:
            payload["images"] = images

        try:
            await self._send_command_and_wait_response(
                command_type="prompt",
                payload=payload,
                request_id=request_id,
            )

            while True:
                record = await self._next_event()
                record_type = str(record.get("type") or "")
                yield record
                if record_type == "agent_end":
                    break
        finally:
            self._prompt_lock.release()

    async def _send_command_and_wait_response(
        self,
        *,
        command_type: str,
        payload: dict[str, Any],
        request_id: str | None,
    ) -> dict[str, Any]:
        self._ensure_running()
        command_id = (request_id or str(uuid.uuid4())).strip()
        if command_id in self._response_waiters:
            raise PiRpcError(f"Duplicate Pi RPC command id: {command_id}")

        loop = asyncio.get_running_loop()
        future: asyncio.Future[dict[str, Any]] = loop.create_future()
        self._response_waiters[command_id] = future
        command = {"id": command_id, "type": command_type, **payload}
        started_at = time.monotonic()
        try:
            await self._write_command(command)
            record = await self._wait_with_timeout(
                future,
                label=f"waiting for `{command_type}` response",
            )
        finally:
            self._response_waiters.pop(command_id, None)
            if not future.done():
                future.cancel()

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
        return record

    async def _write_command(self, command: dict[str, Any]) -> None:
        self._ensure_running()
        process = self._process
        if process is None or process.stdin is None:
            raise PiRpcError("Pi RPC stdin is unavailable.")
        raw = json.dumps(command, ensure_ascii=False).encode("utf-8") + b"\n"
        async with self._write_lock:
            process.stdin.write(raw)
            await process.stdin.drain()

    async def _reader_loop(self) -> None:
        reader_error: Exception | None = None
        try:
            while True:
                record = await self._read_record()
                if record is None:
                    if self._closing:
                        return
                    raise PiRpcError("Pi RPC stdout closed unexpectedly.")

                if str(record.get("type") or "") == "response":
                    response_id = str(record.get("id") or "")
                    waiter = self._response_waiters.get(response_id)
                    if waiter is None or waiter.done():
                        logger.debug(
                            "Ignoring unmatched Pi RPC response: id=%s success=%s",
                            response_id,
                            bool(record.get("success")),
                        )
                        continue
                    waiter.set_result(record)
                    continue

                await self._event_queue.put(record)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            reader_error = exc
            if not self._closing:
                logger.warning("Pi RPC reader loop stopped", exc_info=True)
        finally:
            if reader_error is not None:
                self._reader_error = reader_error
                self._fail_pending_waiters(reader_error)
            self._signal_stream_closed()

    async def _read_record(self) -> dict[str, Any] | None:
        while True:
            line = await self._read_line()
            if line is None:
                return None
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

    async def _read_line(self) -> str | None:
        process = self._process
        if process is None or process.stdout is None:
            return None

        while True:
            lf_index = self._stdout_buffer.find(b"\n")
            if lf_index >= 0:
                line = bytes(self._stdout_buffer[:lf_index])
                del self._stdout_buffer[: lf_index + 1]
                if line.endswith(b"\r"):
                    line = line[:-1]
                return line.decode("utf-8", errors="replace")

            chunk = await process.stdout.read(4096)
            if not chunk:
                if self._stdout_buffer:
                    line = bytes(self._stdout_buffer)
                    self._stdout_buffer.clear()
                    if line.endswith(b"\r"):
                        line = line[:-1]
                    return line.decode("utf-8", errors="replace")
                return None

            self._stdout_buffer.extend(chunk)

    async def _next_event(self) -> dict[str, Any]:
        item = await self._wait_with_timeout(
            self._event_queue.get(),
            label="waiting for Pi RPC event",
        )
        if item is self._stream_closed_sentinel:
            if self._reader_error is not None:
                raise self._reader_error
            raise PiRpcError("Pi RPC event stream closed unexpectedly.")
        if not isinstance(item, dict):
            raise PiRpcError("Pi RPC delivered an invalid event payload.")
        return item

    async def _wait_with_timeout(self, awaitable, *, label: str):
        if self.timeout_seconds is None:
            return await awaitable
        try:
            return await asyncio.wait_for(awaitable, timeout=self.timeout_seconds)
        except asyncio.TimeoutError as exc:
            raise asyncio.TimeoutError(
                f"Pi RPC {label} timed out after {self.timeout_seconds}s"
            ) from exc

    def _ensure_running(self) -> None:
        if self._reader_error is not None:
            raise self._reader_error
        if not self._process or self._process.returncode is not None:
            raise PiRpcError("Pi RPC process is not running.")

    def _fail_pending_waiters(self, exc: Exception) -> None:
        waiters = list(self._response_waiters.values())
        self._response_waiters.clear()
        for waiter in waiters:
            if not waiter.done():
                waiter.set_exception(exc)

    def _signal_stream_closed(self) -> None:
        self._event_queue.put_nowait(self._stream_closed_sentinel)
