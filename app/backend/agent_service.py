from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, AsyncIterator

from .config import (
    get_pi_command,
    get_pi_command_path,
    get_pi_thinking_level,
    get_pi_timeout_seconds,
    get_pi_workdir,
)
from .pi_rpc_client import PiRpcClient, PiRpcError
from .raw_service import search_raw_files
from .session_manager import get_session_pool
from .wiki_service import search_pages


logger = logging.getLogger(__name__)
PI_TIMEOUT_USER_MESSAGE = "Pi 回复超时，本次请求已自动停止。你可以重试，或切换会话继续提问。"
PI_INTERRUPTED_USER_MESSAGE = "Pi 回复异常中断，本次请求已自动停止。你可以重试，或切换会话继续提问。"


def get_agent_backend_status() -> dict[str, Any]:
    pool = get_session_pool()
    rpc_command_path = get_pi_command_path()
    rpc_available = bool(rpc_command_path)
    return {
        "mode": "pi",
        "pi_backend_mode": "rpc",
        "pi_command": get_pi_command(),
        "pi_command_path": rpc_command_path,
        "pi_rpc_available": rpc_available,
        "pi_thinking_level": get_pi_thinking_level(),
        "pi_workdir": str(get_pi_workdir()),
        "pi_available": rpc_available,
        "session_pool_count": pool.get_session_count(),
    }


def _collect_context(message: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    wiki_hits = search_pages(message, limit=6)
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
    trace: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    return {
        "mode": "pi",
        "message": message,
        "consulted_pages": consulted_pages or [],
        "trace": trace or [],
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


def _prepare_rpc_request(
    message: str, history: list[dict[str, str]]
) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    wiki_hits, raw_hits = _collect_context(message)
    consulted_pages = _build_consulted_pages(wiki_hits, raw_hits)
    history_length = len(history) + 1

    pi_command_path = get_pi_command_path()
    if not pi_command_path:
        return None, _pi_error_response(
            message="当前后端使用 Pi RPC，但运行机器上没有找到 `pi` 命令。",
            warnings=["Pi command not found on PATH."],
            consulted_pages=consulted_pages,
            history_length=history_length,
        )

    full_prompt = _build_pi_prompt(message, history, wiki_hits, raw_hits)
    return (
        {
            "command_path": pi_command_path,
            "cwd": str(get_pi_workdir()),
            "prompt": full_prompt,
            "consulted_pages": consulted_pages,
            "history_length": history_length,
            "timeout_seconds": get_pi_timeout_seconds(),
        },
        None,
    )


def _extract_text_from_content(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if not isinstance(item, dict):
                continue
            text = item.get("text")
            if isinstance(text, str) and text:
                parts.append(text)
        return "".join(parts)
    return ""


def _extract_assistant_text_from_messages(messages: Any) -> str:
    if not isinstance(messages, list):
        return ""
    latest_text = ""
    for item in messages:
        if not isinstance(item, dict):
            continue
        if str(item.get("role") or "") != "assistant":
            continue
        text = _extract_text_from_content(item.get("content"))
        if text.strip():
            latest_text = text.strip()
    return latest_text


def _rpc_trace_item_from_event(event: dict[str, Any]) -> dict[str, Any] | None:
    event_type = str(event.get("type") or "")
    if event_type == "tool_execution_start":
        tool_name = str(event.get("toolName") or "unknown")
        args = event.get("args")
        detail = f"{tool_name}"
        if isinstance(args, dict) and args:
            detail = f"{tool_name} {json.dumps(args, ensure_ascii=False)}"
        return {
            "kind": "tool",
            "title": f"调用工具：{tool_name}",
            "detail": detail,
            "action": "tool",
            "event_type": event_type,
        }
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


async def _run_pi_rpc_agent_chat_async(
    message: str,
    history: list[dict[str, str]],
    request_id: str | None = None,
) -> dict[str, Any]:
    prepared, error_response = _prepare_rpc_request(message, history)
    if error_response:
        return error_response
    assert prepared is not None

    consulted_pages = prepared["consulted_pages"]
    trace: list[dict[str, Any]] = []
    streamed_text_chunks: list[str] = []
    client: PiRpcClient | None = None

    try:
        async with PiRpcClient(
            command_path=prepared["command_path"],
            cwd=prepared["cwd"],
            timeout_seconds=prepared["timeout_seconds"],
            extra_args=["--no-session"],
        ) as rpc_client:
            client = rpc_client
            await rpc_client.get_state(
                request_id=f"{request_id}:state" if request_id else None
            )

            async for event in rpc_client.prompt_events(
                message=prepared["prompt"],
                request_id=request_id,
            ):
                event_type = str(event.get("type") or "")
                if event_type == "message_update":
                    assistant_event = event.get("assistantMessageEvent")
                    if isinstance(assistant_event, dict):
                        assistant_event_type = str(assistant_event.get("type") or "")
                        if assistant_event_type == "text_delta":
                            delta = assistant_event.get("delta")
                            if isinstance(delta, str):
                                streamed_text_chunks.append(delta)
                        elif assistant_event_type == "error":
                            reason = str(assistant_event.get("reason") or "error")
                            return _pi_error_response(
                                message=PI_INTERRUPTED_USER_MESSAGE,
                                warnings=[f"Pi assistant stream error: {reason}"],
                                consulted_pages=consulted_pages,
                                history_length=prepared["history_length"],
                                trace=trace,
                            )
                    continue

                trace_item = _rpc_trace_item_from_event(event)
                if trace_item:
                    trace.append(trace_item)

                if event_type == "agent_end":
                    final_text = _extract_assistant_text_from_messages(event.get("messages"))
                    if not final_text:
                        final_text = "".join(streamed_text_chunks).strip()
                    if not final_text:
                        final_text = "Pi RPC 未返回可见文本。"
                    return {
                        "mode": "pi",
                        "message": final_text,
                        "consulted_pages": consulted_pages,
                        "trace": trace,
                        "history_length": prepared["history_length"],
                        "suggested_prompts": _default_suggested_prompts(),
                        "warnings": [],
                    }

    except asyncio.TimeoutError:
        if client is not None:
            try:
                await client.abort(request_id=f"{request_id}:abort" if request_id else None)
            except Exception:
                logger.warning("Failed to send RPC abort after timeout", exc_info=True)
        return _pi_error_response(
            message=PI_TIMEOUT_USER_MESSAGE,
            warnings=["Pi RPC read timeout."],
            consulted_pages=consulted_pages,
            history_length=prepared["history_length"],
        )
    except PiRpcError as exc:
        logger.exception("Pi RPC call failed")
        return _pi_error_response(
            message=f"Pi RPC 调用失败：{exc}",
            warnings=[str(exc)],
            consulted_pages=consulted_pages,
            history_length=prepared["history_length"],
        )
    except Exception as exc:
        logger.exception("Unexpected Pi RPC error")
        return _pi_error_response(
            message=f"Pi RPC 未能完成请求：{exc}",
            warnings=[str(exc)],
            consulted_pages=consulted_pages,
            history_length=prepared["history_length"],
        )

    return _pi_error_response(
        message="Pi RPC 未返回 agent_end 事件，无法确定最终答复。",
        warnings=["Missing agent_end event from Pi RPC."],
        consulted_pages=consulted_pages,
        history_length=prepared["history_length"],
    )


async def _stream_pi_rpc_chat(
    message: str,
    history: list[dict[str, str]],
    request_id: str | None = None,
) -> AsyncIterator[dict[str, Any]]:
    prepared, error_response = _prepare_rpc_request(message, history)
    if error_response:
        yield _pi_error_event(error_response)
        return
    assert prepared is not None

    consulted_pages = prepared["consulted_pages"]
    yield {
        "type": "context",
        "consulted_pages": consulted_pages,
    }

    trace: list[dict[str, Any]] = []
    streamed_text_chunks: list[str] = []
    client: PiRpcClient | None = None

    try:
        async with PiRpcClient(
            command_path=prepared["command_path"],
            cwd=prepared["cwd"],
            timeout_seconds=prepared["timeout_seconds"],
            extra_args=["--no-session"],
        ) as rpc_client:
            client = rpc_client
            await rpc_client.get_state(
                request_id=f"{request_id}:state" if request_id else None
            )

            async for event in rpc_client.prompt_events(
                message=prepared["prompt"],
                request_id=request_id,
            ):
                event_type = str(event.get("type") or "")

                if event_type == "message_update":
                    assistant_event = event.get("assistantMessageEvent")
                    if not isinstance(assistant_event, dict):
                        continue
                    assistant_event_type = str(assistant_event.get("type") or "")
                    if assistant_event_type == "text_delta":
                        delta = assistant_event.get("delta")
                        if isinstance(delta, str):
                            streamed_text_chunks.append(delta)
                            yield {"type": "text_delta", "delta": delta}
                    elif assistant_event_type == "thinking_delta":
                        delta = assistant_event.get("delta")
                        if isinstance(delta, str):
                            yield {"type": "thinking_delta", "delta": delta}
                    elif assistant_event_type == "error":
                        reason = str(assistant_event.get("reason") or "error")
                        yield _pi_error_event(
                            _pi_error_response(
                                message=PI_INTERRUPTED_USER_MESSAGE,
                                warnings=[f"Pi assistant stream error: {reason}"],
                                consulted_pages=consulted_pages,
                                history_length=prepared["history_length"],
                                trace=trace,
                            )
                        )
                        return
                    continue

                trace_item = _rpc_trace_item_from_event(event)
                if trace_item:
                    trace.append(trace_item)
                    yield {"type": "trace", "item": trace_item}

                if event_type == "agent_end":
                    final_text = _extract_assistant_text_from_messages(event.get("messages"))
                    if not final_text:
                        final_text = "".join(streamed_text_chunks).strip()
                    yield {
                        "type": "final",
                        "message": final_text or "Pi RPC 未返回可见文本。",
                        "warnings": [],
                        "trace": trace,
                        "consulted_pages": consulted_pages,
                        "history_length": prepared["history_length"],
                        "suggested_prompts": _default_suggested_prompts(),
                    }
                    return

    except asyncio.TimeoutError:
        if client is not None:
            try:
                await client.abort(request_id=f"{request_id}:abort" if request_id else None)
            except Exception:
                logger.warning("Failed to send RPC abort after timeout", exc_info=True)
        yield _pi_error_event(
            _pi_error_response(
                message=PI_TIMEOUT_USER_MESSAGE,
                warnings=["Pi RPC read timeout while streaming."],
                consulted_pages=consulted_pages,
                history_length=prepared["history_length"],
            )
        )
        return
    except PiRpcError as exc:
        logger.exception("Pi RPC stream failed")
        yield _pi_error_event(
            _pi_error_response(
                message=f"Pi RPC 调用失败：{exc}",
                warnings=[str(exc)],
                consulted_pages=consulted_pages,
                history_length=prepared["history_length"],
            )
        )
        return
    except Exception as exc:
        logger.exception("Unexpected Pi RPC stream error")
        yield _pi_error_event(
            _pi_error_response(
                message=f"Pi RPC 未能完成请求：{exc}",
                warnings=[str(exc)],
                consulted_pages=consulted_pages,
                history_length=prepared["history_length"],
            )
        )
        return

    yield _pi_error_event(
        _pi_error_response(
            message="Pi RPC 未返回 agent_end 事件，无法确定最终答复。",
            warnings=["Missing agent_end event from Pi RPC stream."],
            consulted_pages=consulted_pages,
            history_length=prepared["history_length"],
        )
    )


def run_agent_chat(
    message: str,
    history: list[dict[str, str]] | None = None,
    request_id: str | None = None,
) -> dict[str, Any]:
    return asyncio.run(
        _run_pi_rpc_agent_chat_async(
            message=message,
            history=history or [],
            request_id=request_id,
        )
    )


async def stream_agent_chat(
    message: str,
    history: list[dict[str, str]] | None = None,
    request_id: str | None = None,
) -> AsyncIterator[dict[str, Any]]:
    async for event in _stream_pi_rpc_chat(
        message=message,
        history=history or [],
        request_id=request_id,
    ):
        yield event


def run_session_chat(
    session_id: str,
    message: str,
    history: list[dict[str, str]] | None = None,
    request_id: str | None = None,
) -> dict[str, Any]:
    pool = get_session_pool()
    result = pool.send_message(
        session_id=session_id,
        message=message,
        history=history or [],
        stream=False,
        request_id=request_id,
    )
    if result is None:
        return {
            "ok": False,
            "error": "Session 不存在或进程已终止",
        }
    return result


async def stream_session_chat(
    session_id: str,
    message: str,
    history: list[dict[str, str]] | None = None,
    request_id: str | None = None,
) -> AsyncIterator[dict[str, Any]]:
    pool = get_session_pool()
    async for event in pool.send_message_async(
        session_id=session_id,
        message=message,
        history=history or [],
        request_id=request_id,
    ):
        yield event
