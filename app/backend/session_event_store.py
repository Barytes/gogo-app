from __future__ import annotations

import json
import threading
import time
from pathlib import Path
from typing import Any


class SessionEventStore:
    """Append-only JSONL event store for session replay/debugging."""

    def __init__(self, root_dir: Path):
        self.root_dir = root_dir
        self.sessions_dir = self.root_dir / "sessions"
        self.global_file = self.root_dir / "events.jsonl"
        self._lock = threading.RLock()

    def _ensure_dirs(self) -> None:
        self.sessions_dir.mkdir(parents=True, exist_ok=True)

    def _session_file(self, session_id: str) -> Path:
        safe_session_id = str(session_id or "").strip()
        if (
            not safe_session_id
            or "/" in safe_session_id
            or "\\" in safe_session_id
            or ".." in safe_session_id
        ):
            raise ValueError(f"Invalid session id: {session_id!r}")
        return self.sessions_dir / f"{safe_session_id}.jsonl"

    def append_event(
        self,
        *,
        event_type: str,
        session_id: str,
        request_id: str | None = None,
        payload: dict[str, Any] | None = None,
    ) -> None:
        record: dict[str, Any] = {
            "ts": time.time(),
            "type": event_type,
            "session_id": session_id,
        }
        if request_id:
            record["request_id"] = request_id
        if payload is not None:
            record["payload"] = payload

        line = json.dumps(record, ensure_ascii=False)
        session_file = self._session_file(session_id)

        with self._lock:
            self._ensure_dirs()
            with session_file.open("a", encoding="utf-8") as handle:
                handle.write(line + "\n")
            with self.global_file.open("a", encoding="utf-8") as handle:
                handle.write(line + "\n")

    def load_session_events(self, session_id: str) -> list[dict[str, Any]]:
        """Load all persisted events for a session from JSONL."""
        try:
            session_file = self._session_file(session_id)
        except ValueError:
            return []
        if not session_file.exists():
            return []

        events: list[dict[str, Any]] = []
        with self._lock:
            with session_file.open("r", encoding="utf-8") as handle:
                for raw_line in handle:
                    line = raw_line.strip()
                    if not line:
                        continue
                    try:
                        parsed = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    if isinstance(parsed, dict):
                        events.append(parsed)
        return events
