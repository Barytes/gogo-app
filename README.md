# gogo-app

Web workbench for browsing an external research knowledge base and chatting with a local agent backend.

## What It Does

- Unified single-page workbench
- Wiki and raw material browsing
- Chat panel backed by Pi SDK
- FastAPI backend with simple local-file APIs
- External knowledge-base repo support via `KNOWLEDGE_BASE_DIR`

## Setup

1. Create `.env` from `.env.example`.
2. Point `KNOWLEDGE_BASE_DIR` at your local `knowledge-base` repo.
3. Install Python dependencies:

```bash
uv sync
```

4. Install the Node dependency:

```bash
npm install
```

5. Start the server:

```bash
uv run uvicorn app.backend.main:app --reload
```

6. Open:

- `http://127.0.0.1:8000/`

The compatibility routes `http://127.0.0.1:8000/chat` and `http://127.0.0.1:8000/wiki` also open the same workbench page.

## Agent Backend

`/api/chat` now only uses Pi.

- Python backend calls a local Node bridge
- the bridge uses `@mariozechner/pi-coding-agent`
- Pi runs with a read-only workdir rooted at `PI_WORKDIR` or `KNOWLEDGE_BASE_DIR`

## Repo Boundary

This repo only contains the application layer:

- FastAPI backend
- static frontend
- app-facing documentation

Prompt assets, schemas, and knowledge content live in a separate `knowledge-base` repository.

## Docs

- [docs/mvp-architecture.md](docs/mvp-architecture.md)
- [docs/product-definition-belief.md](docs/product-definition-belief.md)
- [AGENTS.md](AGENTS.md)
