from __future__ import annotations

import asyncio
import json
import subprocess
from typing import Any, AsyncIterator

from .config import (
    get_pi_node_command,
    get_pi_node_command_path,
    get_pi_sdk_bridge_path,
    get_pi_thinking_level,
    get_pi_timeout_seconds,
    get_pi_workdir,
)
from .raw_service import search_raw_files
from .wiki_service import search_pages


def get_agent_backend_status() -> dict[str, Any]:
    pi_sdk_bridge_path = get_pi_sdk_bridge_path()
    return {
        "mode": "pi",
        "pi_node_command": get_pi_node_command(),
        "pi_node_command_path": get_pi_node_command_path(),
        "pi_sdk_bridge_path": str(pi_sdk_bridge_path),
        "pi_thinking_level": get_pi_thinking_level(),
        "pi_workdir": str(get_pi_workdir()),
        "pi_available": bool(get_pi_node_command_path()) and pi_sdk_bridge_path.exists(),
    }


def _collect_context(message: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    wiki_hits = search_pages(message, limit=4)
    raw_hits = search_raw_files(message, limit=4)
    return wiki_hits, raw_hits


def _build_pi_prompt(
    message: str,
    history: list[dict[str, str]],
    wiki_hits: list[dict[str, Any]],
    raw_hits: list[dict[str, Any]],
) -> str:
    prompt_lines = [
        "Current user question:",
        message,
    ]

    if history:
        prompt_lines.extend(["", "Recent chat history:"])
        for turn in history[-6:]:
            role = turn.get("role", "user")
            content = turn.get("content", "")
            prompt_lines.append(f"- {role}: {content}")

    if wiki_hits:
        prompt_lines.extend(["", "Relevant wiki pages already retrieved by the backend:"])
        for page in wiki_hits:
            prompt_lines.append(
                f"- [wiki] {page['path']} | {page['title']} | {page['summary']}"
            )

    if raw_hits:
        prompt_lines.extend(["", "Relevant raw materials already retrieved by the backend:"])
        for item in raw_hits:
            prompt_lines.append(
                f"- [raw] {item['path']} | {item['title']} | {item['summary']}"
            )

    return "\n".join(prompt_lines)


def _build_pi_system_prompt() -> str:
    prompt_lines = [
        "You are answering inside a research knowledge-base workbench.",
        "Use the local repository as the primary source of truth.",
        "Prefer maintained wiki pages first, then raw materials when needed.",
        "Treat this interaction as read-only. Do not edit files, run destructive commands, or write back changes.",
        "If the local knowledge base is insufficient, say what is missing clearly.",
        "Answer in Chinese unless the material clearly requires another language.",
        "Cite the consulted local files you actually rely on.",
    ]
    return "\n".join(prompt_lines)


def _build_consulted_pages(
    wiki_hits: list[dict[str, Any]], raw_hits: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    pages = [
        {
            "path": page["path"],
            "title": page["title"],
            "category": page["category"],
            "summary": page["summary"],
            "source": "wiki",
        }
        for page in wiki_hits
    ]
    pages.extend(
        {
            "path": item["path"],
            "title": item["title"],
            "category": item["category"],
            "summary": item["summary"],
            "source": "raw",
        }
        for item in raw_hits
    )
    return pages


def _default_suggested_prompts() -> list[str]:
    return [
        "请基于本地知识库继续展开这个判断。",
        "这些页面之间的主要张力是什么？",
        "如果只做一个下一步实验，最该做什么？",
    ]


def _pi_error_response(
    *,
    message: str,
    warnings: list[str],
    consulted_pages: list[dict[str, Any]] | None = None,
    history_length: int = 1,
) -> dict[str, Any]:
    return {
        "mode": "pi",
        "message": message,
        "consulted_pages": consulted_pages or [],
        "trace": [],
        "history_length": history_length,
        "suggested_prompts": [
            "请只根据当前命中的本地页面回答。",
            "请说明还缺哪些知识库内容。",
            "请把这个问题拆成更小的检索问题。",
        ],
        "warnings": warnings,
    }


def _pi_error_event(error_response: dict[str, Any]) -> dict[str, Any]:
    return {
        "type": "error",
        "message": error_response["message"],
        "warnings": error_response["warnings"],
        "consulted_pages": error_response["consulted_pages"],
        "trace": error_response.get("trace", []),
        "history_length": error_response["history_length"],
        "suggested_prompts": error_response["suggested_prompts"],
    }


def _prepare_pi_request(
    message: str, history: list[dict[str, str]]
) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    wiki_hits, raw_hits = _collect_context(message)
    consulted_pages = _build_consulted_pages(wiki_hits, raw_hits)
    history_length = len(history) + 1

    pi_node_command_path = get_pi_node_command_path()
    if not pi_node_command_path:
        return None, _pi_error_response(
            message=(
                "当前后端只支持 Pi agent，但运行机器上没有找到可用的 Node.js。\n"
                "请先安装 Node.js，并在 gogo-app 目录执行 `npm install`。"
            ),
            warnings=[
                "Node.js command not found on PATH.",
                "Install Node.js and the Pi SDK dependency.",
            ],
            consulted_pages=consulted_pages,
            history_length=history_length,
        )

    pi_sdk_bridge_path = get_pi_sdk_bridge_path()
    if not pi_sdk_bridge_path.exists():
        return None, _pi_error_response(
            message="Pi SDK bridge 脚本不存在，当前无法执行聊天请求。",
            warnings=["Pi SDK bridge script not found."],
            consulted_pages=consulted_pages,
            history_length=history_length,
        )

    payload = {
        "cwd": str(get_pi_workdir()),
        "system_prompt": _build_pi_system_prompt(),
        "prompt": _build_pi_prompt(message, history, wiki_hits, raw_hits),
        "thinking_level": get_pi_thinking_level(),
    }
    return (
        {
            "command": [pi_node_command_path, str(pi_sdk_bridge_path)],
            "cwd": str(get_pi_workdir()),
            "payload": payload,
            "consulted_pages": consulted_pages,
            "history_length": history_length,
        },
        None,
    )


def _run_pi_agent_chat(message: str, history: list[dict[str, str]]) -> dict[str, Any]:
    prepared, error_response = _prepare_pi_request(message, history)
    if error_response:
        return error_response
    assert prepared is not None

    try:
        result = subprocess.run(
            prepared["command"],
            cwd=prepared["cwd"],
            input=json.dumps(prepared["payload"]),
            capture_output=True,
            text=True,
            timeout=get_pi_timeout_seconds(),
            check=False,
        )
    except subprocess.TimeoutExpired:
        return _pi_error_response(
            message="Pi SDK 调用超时，本次请求没有拿到有效回复。",
            warnings=["Pi SDK bridge timed out."],
            consulted_pages=prepared["consulted_pages"],
            history_length=prepared["history_length"],
        )

    if result.returncode != 0:
        stderr = (result.stderr or "").strip()
        return _pi_error_response(
            message=(
                "Pi SDK 调用失败，本次请求没有拿到有效回复。\n"
                f"Pi stderr: {stderr or 'no stderr output'}"
            ),
            warnings=[stderr or "Pi SDK bridge exited with a non-zero status."],
            consulted_pages=prepared["consulted_pages"],
            history_length=prepared["history_length"],
        )

    try:
        pi_response = json.loads(result.stdout or "{}")
    except json.JSONDecodeError:
        return _pi_error_response(
            message="Pi SDK 返回了无法解析的响应。",
            warnings=["Pi SDK bridge returned invalid JSON."],
            consulted_pages=prepared["consulted_pages"],
            history_length=prepared["history_length"],
        )

    if not pi_response.get("ok"):
        bridge_error = str(
            pi_response.get("error") or "Pi SDK bridge reported an unknown error."
        )
        return _pi_error_response(
            message=f"Pi SDK 未能成功完成请求。\nPi error: {bridge_error}",
            warnings=[bridge_error],
            consulted_pages=prepared["consulted_pages"],
            history_length=prepared["history_length"],
        )

    message_text = (str(pi_response.get("message") or "")).strip() or "Pi SDK 未返回可见文本。"
    warnings = [
        str(item).strip()
        for item in pi_response.get("warnings", [])
        if str(item).strip()
    ]

    return {
        "mode": "pi",
        "message": message_text,
        "consulted_pages": prepared["consulted_pages"],
        "trace": pi_response.get("trace", []),
        "history_length": prepared["history_length"],
        "suggested_prompts": _default_suggested_prompts(),
        "warnings": warnings,
    }


async def stream_agent_chat(
    message: str, history: list[dict[str, str]] | None = None
) -> AsyncIterator[dict[str, Any]]:
    prepared, error_response = _prepare_pi_request(message, history or [])
    if error_response:
        yield _pi_error_event(error_response)
        return
    assert prepared is not None

    consulted_pages = prepared["consulted_pages"]
    yield {
        "type": "context",
        "consulted_pages": consulted_pages,
    }

    payload = dict(prepared["payload"])
    payload["stream"] = True

    process = await asyncio.create_subprocess_exec(
        *prepared["command"],
        cwd=prepared["cwd"],
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )

    assert process.stdin is not None
    process.stdin.write(json.dumps(payload).encode("utf-8"))
    await process.stdin.drain()
    process.stdin.close()

    timeout_seconds = get_pi_timeout_seconds()
    final_event_seen = False

    assert process.stdout is not None
    while True:
        try:
            raw_line = await asyncio.wait_for(
                process.stdout.readline(),
                timeout=timeout_seconds,
            )
        except asyncio.TimeoutError:
            process.kill()
            await process.wait()
            yield _pi_error_event(
                _pi_error_response(
                    message="Pi SDK 调用超时，本次请求没有拿到有效回复。",
                    warnings=["Pi SDK bridge timed out while streaming."],
                    consulted_pages=consulted_pages,
                    history_length=prepared["history_length"],
                )
            )
            return

        if not raw_line:
            break

        line = raw_line.decode("utf-8", errors="replace").strip()
        if not line:
            continue

        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            yield {
                "type": "trace",
                "item": {
                    "kind": "status",
                    "title": "Bridge parse warning",
                    "detail": "收到了一条无法解析的 Pi 事件。",
                },
            }
            continue

        if not isinstance(event, dict):
            continue

        event_type = str(event.get("type") or "").strip()
        if event_type == "final":
            final_event_seen = True
            event.setdefault("consulted_pages", consulted_pages)
            event.setdefault("history_length", prepared["history_length"])
            event.setdefault("suggested_prompts", _default_suggested_prompts())
            yield event
            continue

        if event_type == "error":
            final_event_seen = True
            event.setdefault("consulted_pages", consulted_pages)
            event.setdefault("history_length", prepared["history_length"])
            event.setdefault(
                "suggested_prompts",
                [
                    "请只根据当前命中的本地页面回答。",
                    "请说明还缺哪些知识库内容。",
                    "请把这个问题拆成更小的检索问题。",
                ],
            )
            yield event
            continue

        yield event

    stderr = ""
    if process.stderr is not None:
        stderr_bytes = await process.stderr.read()
        stderr = stderr_bytes.decode("utf-8", errors="replace").strip()

    returncode = await process.wait()
    if returncode != 0 and not final_event_seen:
        yield _pi_error_event(
            _pi_error_response(
                message=(
                    "Pi SDK 调用失败，本次请求没有拿到有效回复。\n"
                    f"Pi stderr: {stderr or 'no stderr output'}"
                ),
                warnings=[stderr or "Pi SDK bridge exited with a non-zero status."],
                consulted_pages=consulted_pages,
                history_length=prepared["history_length"],
            )
        )


def run_agent_chat(message: str, history: list[dict[str, str]] | None = None) -> dict[str, Any]:
    return _run_pi_agent_chat(message=message, history=history or [])
