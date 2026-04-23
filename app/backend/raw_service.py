from __future__ import annotations

import mimetypes
from pathlib import Path
from typing import Any

from .config import get_knowledge_base_dir


TEXT_EXTENSIONS = {
    ".md",
    ".txt",
    ".json",
    ".yaml",
    ".yml",
    ".csv",
    ".py",
    ".tex",
    ".bib",
}


def _raw_dir() -> Path:
    return get_knowledge_base_dir() / "raw"


def _iter_raw_files() -> list[Path]:
    raw_dir = _raw_dir()
    return sorted(
        path
        for path in raw_dir.rglob("*")
        if path.is_file() and not path.name.startswith(".")
    )


def _safe_raw_path(relative_path: str) -> Path:
    raw_root = _raw_dir().resolve()
    candidate = (raw_root / relative_path).resolve()
    if raw_root not in candidate.parents and candidate != raw_root:
        raise ValueError("Path must stay inside knowledge-base/raw.")
    if not candidate.exists() or not candidate.is_file():
        raise FileNotFoundError(relative_path)
    return candidate


def _safe_raw_target_path(relative_path: str) -> Path:
    raw_root = _raw_dir().resolve()
    candidate = (raw_root / relative_path).resolve()
    if raw_root not in candidate.parents and candidate != raw_root:
        raise ValueError("Path must stay inside knowledge-base/raw.")
    if candidate.suffix.lower() != ".md":
        raise ValueError("Only markdown files are supported.")
    return candidate


def _guess_content_type(path: Path) -> str:
    guessed, _ = mimetypes.guess_type(path.name)
    return guessed or "application/octet-stream"


def _is_textual(path: Path) -> bool:
    return path.suffix.lower() in TEXT_EXTENSIONS


def _read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


def _summary_from_text(text: str) -> str:
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        return stripped[:180]
    return "No summary available yet."


def _summary_for_file(path: Path) -> str:
    if _is_textual(path):
        return _summary_from_text(_read_text(path))

    content_type = _guess_content_type(path)
    if content_type == "application/pdf":
        return "PDF material. Open the source file for full reading."
    return f"{content_type} file."


def _raw_record(path: Path, include_content: bool = False) -> dict[str, Any]:
    raw_dir = _raw_dir()
    rel_path = path.relative_to(raw_dir).as_posix()
    rel_parent = path.parent.relative_to(raw_dir).as_posix()
    category = rel_path.split("/", 1)[0] if "/" in rel_path else "root"
    content_type = _guess_content_type(path)
    is_text = _is_textual(path)

    record: dict[str, Any] = {
        "source": "raw",
        "path": rel_path,
        "title": path.name,
        "summary": _summary_for_file(path),
        "category": category,
        "section": rel_parent or "root",
        "modified_at": path.stat().st_mtime,
        "size": path.stat().st_size,
        "content_type": content_type,
        "is_text": is_text,
        "render_mode": (
            "markdown"
            if path.suffix.lower() == ".md"
            else ("text" if is_text else ("pdf" if content_type == "application/pdf" else "binary"))
        ),
        "download_url": f"/raw/file?path={rel_path}",
        "preview_url": f"/raw/file?path={rel_path}" if content_type == "application/pdf" else None,
    }

    if include_content and is_text:
        record["content"] = _read_text(path)

    return record


def list_raw_files() -> list[dict[str, Any]]:
    return [_raw_record(path) for path in _iter_raw_files()]


def get_raw_file(relative_path: str) -> dict[str, Any]:
    return _raw_record(_safe_raw_path(relative_path), include_content=True)


def create_raw_file(relative_path: str, content: str = "") -> dict[str, Any]:
    path = _safe_raw_target_path(relative_path)
    if path.exists():
        raise FileExistsError(relative_path)

    normalized_content = str(content).replace("\r\n", "\n")
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = path.with_name(f".{path.name}.tmp")
    temp_path.write_text(normalized_content, encoding="utf-8")
    temp_path.replace(path)
    return _raw_record(path, include_content=True)


def delete_raw_file(relative_path: str) -> dict[str, Any]:
    path = _safe_raw_target_path(relative_path)
    if not path.exists():
        raise FileNotFoundError(relative_path)

    raw_root = _raw_dir().resolve()
    record = _raw_record(path)
    path.unlink()

    for parent in path.parents:
        if parent == raw_root:
            break
        try:
            parent.rmdir()
        except OSError:
            break

    return record


def save_raw_file(relative_path: str, content: str) -> dict[str, Any]:
    path = _safe_raw_target_path(relative_path)
    if not path.exists():
        raise FileNotFoundError(relative_path)

    normalized_content = str(content).replace("\r\n", "\n")
    temp_path = path.with_name(f".{path.name}.tmp")
    temp_path.write_text(normalized_content, encoding="utf-8")
    temp_path.replace(path)
    return _raw_record(path, include_content=True)


def search_raw_files(query: str, limit: int = 20) -> list[dict[str, Any]]:
    query = query.strip().lower()
    if not query:
        return list_raw_files()[:limit]

    matches = []
    for path in _iter_raw_files():
        record = _raw_record(path, include_content=_is_textual(path))
        haystacks = [record["title"].lower(), record["summary"].lower(), record["path"].lower()]
        if "content" in record:
            haystacks.append(record["content"].lower())
        if any(query in haystack for haystack in haystacks):
            matches.append(record)

    trimmed = []
    for record in matches[:limit]:
        copy = dict(record)
        copy.pop("content", None)
        trimmed.append(copy)
    return trimmed


def get_raw_file_path(relative_path: str) -> Path:
    return _safe_raw_path(relative_path)
