from __future__ import annotations

from pathlib import Path
import json

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .agent_service import get_agent_backend_status, run_agent_chat, stream_agent_chat, run_session_chat, stream_session_chat
from .config import get_knowledge_base_dir
from .raw_service import (
    get_raw_file,
    get_raw_file_path,
    list_raw_files,
    search_raw_files,
)
from .wiki_service import get_page, get_tree, list_pages, search_pages
from .session_manager import (
    get_session_pool,
    reset_session_pool,
)


ROOT_DIR = Path(__file__).resolve().parents[2]
FRONTEND_DIR = ROOT_DIR / "app" / "frontend"


class ChatTurn(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    history: list[ChatTurn] = Field(default_factory=list)
    session_id: str | None = Field(default=None, description="Session ID（可选，用于多轮对话）")


class CreateSessionRequest(BaseModel):
    title: str = Field(default="", description="会话标题")
    system_prompt: str = Field(default="", description="系统提示词")


app = FastAPI(
    title="Research Knowledge Base MVP",
    description="FastAPI backend for a lightweight chat and wiki browser MVP.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/assets", StaticFiles(directory=FRONTEND_DIR / "assets"), name="assets")


def _dump_turn(turn: ChatTurn) -> dict[str, str]:
    if hasattr(turn, "model_dump"):
        return turn.model_dump()
    return turn.dict()


@app.get("/", include_in_schema=False)
def landing_page() -> FileResponse:
    return FileResponse(FRONTEND_DIR / "index.html")


@app.get("/chat", include_in_schema=False)
def chat_page() -> FileResponse:
    return FileResponse(FRONTEND_DIR / "index.html")


@app.get("/wiki", include_in_schema=False)
def wiki_page_shell() -> FileResponse:
    return FileResponse(FRONTEND_DIR / "index.html")


@app.get("/api/health")
def healthcheck() -> dict[str, object]:
    agent_status = get_agent_backend_status()
    return {
        "status": "ok",
        "knowledge_base_dir": str(get_knowledge_base_dir()),
        "agent_mode": agent_status["mode"],
        "agent_status": agent_status,
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


@app.post("/api/chat")
def chat(request: ChatRequest) -> dict[str, object]:
    # 如果提供了 session_id，使用 session 池；否则使用旧的单次运行模式
    if request.session_id:
        return run_session_chat(
            session_id=request.session_id,
            message=request.message,
            history=[_dump_turn(turn) for turn in request.history],
        )
    return run_agent_chat(
        message=request.message,
        history=[_dump_turn(turn) for turn in request.history],
    )


@app.post("/api/chat/stream")
async def chat_stream(request: ChatRequest) -> StreamingResponse:
    history = [_dump_turn(turn) for turn in request.history]

    # 如果提供了 session_id，使用 session 池；否则使用旧的单次运行模式
    if request.session_id:
        async def session_event_stream():
            async for event in stream_session_chat(
                session_id=request.session_id,
                message=request.message,
                history=history,
            ):
                yield f"{json.dumps(event, ensure_ascii=False)}\n"
        return StreamingResponse(session_event_stream(), media_type="application/x-ndjson")

    async def event_stream():
        async for event in stream_agent_chat(
            message=request.message,
            history=history,
        ):
            yield f"{json.dumps(event, ensure_ascii=False)}\n"

    return StreamingResponse(event_stream(), media_type="application/x-ndjson")


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


@app.get("/api/raw/files")
def raw_files() -> dict[str, object]:
    items = list_raw_files()
    return {"items": items, "count": len(items)}


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
    )
    session = pool.get_session(session_id)
    if request.title:
        session.info.title = request.title
    return {"session_id": session_id, "session": session.info.to_dict()}


@app.delete("/api/sessions/{session_id}")
def destroy_session(session_id: str) -> dict[str, object]:
    """销毁指定会话"""
    pool = get_session_pool()
    success = pool.destroy_session(session_id)
    return {"success": success, "session_id": session_id}


@app.get("/api/sessions/{session_id}")
def get_session(session_id: str) -> dict[str, object]:
    """获取会话详情"""
    pool = get_session_pool()
    session = pool.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session not found: {session_id}")
    return {"session": session.info.to_dict()}


@app.post("/api/sessions/{session_id}/chat/stream")
async def session_chat_stream(session_id: str, request: ChatRequest) -> StreamingResponse:
    """会话流式聊天"""
    pool = get_session_pool()
    session = pool.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session not found: {session_id}")

    history = [{"role": turn.role, "content": turn.content} for turn in request.history]

    async def event_stream():
        async for event in pool.send_message_async(
            session_id=session_id,
            message=request.message,
            history=history,
        ):
            yield f"{json.dumps(event, ensure_ascii=False)}\n"

    return StreamingResponse(event_stream(), media_type="application/x-ndjson")
