from __future__ import annotations

from pathlib import Path
import json

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .agent_service import get_agent_backend_status, run_agent_chat, stream_agent_chat
from .config import get_knowledge_base_dir
from .raw_service import (
    get_raw_file,
    get_raw_file_path,
    list_raw_files,
    search_raw_files,
)
from .wiki_service import get_page, get_tree, list_pages, search_pages


ROOT_DIR = Path(__file__).resolve().parents[2]
FRONTEND_DIR = ROOT_DIR / "app" / "frontend"


class ChatTurn(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    history: list[ChatTurn] = Field(default_factory=list)


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
    return run_agent_chat(
        message=request.message,
        history=[_dump_turn(turn) for turn in request.history],
    )


@app.post("/api/chat/stream")
async def chat_stream(request: ChatRequest) -> StreamingResponse:
    history = [_dump_turn(turn) for turn in request.history]

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
