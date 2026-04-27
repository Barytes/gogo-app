# Developer Guide

**Last updated:** 2026-04-27

This document contains the source-based development notes that used to live in the README. The README is now kept as the product-facing entry point, while this file is the entry point for developers who want to run, inspect, or build `gogo-app` from source.

## Tech Stack

- **Backend:** FastAPI, Python, uvicorn
- **Frontend:** Plain HTML / CSS / JavaScript
- **Desktop shell:** Tauri v2, Rust
- **Agent runtime:** Pi RPC integration
- **Knowledge base:** Local Markdown-oriented folders with `wiki/`, `raw/`, `inbox/`, and `skills/`
- **Markdown / math rendering:** Marked, KaTeX

## Quick Start: Web Mode

Web mode is the simplest way to inspect the project from source.

Prerequisites:

- Python 3.9+
- `uv`
- Node.js 22 or 24 if you want to exercise the Pi integration path.

Setup:

```bash
cd gogo-app
cp .env.example .env
uv sync
uv run uvicorn app.backend.main:app --reload
```

Open:

```text
http://127.0.0.1:8000/
```

Useful compatibility routes:

```text
http://127.0.0.1:8000/chat
http://127.0.0.1:8000/wiki
```

The default `.env.example` points `KNOWLEDGE_BASE_DIR` at `./example-knowledge-base`, which is the recommended starter workspace for local exploration.

## Quick Start: Desktop Dev Mode

Desktop mode uses Tauri and is intended for development and exploration. It should not be treated as a polished end-user release.

Prerequisites:

- Node.js 22 or 24
- Rust stable toolchain
- Python runtime
- Platform-specific Tauri desktop dependencies

Setup:

```bash
cd gogo-app
npm install
npm run desktop:dev
```

`npm run desktop:dev` starts the local FastAPI backend through Tauri's `beforeDevCommand`, waits for `http://127.0.0.1:8000`, and opens the native shell.

## Desktop Build Notes

The repository contains a Tauri build path:

```bash
npm run desktop:build
```

Current caveats:

- macOS `.app` / `.dmg` build experiments have existed, but final end-user distribution is not the current maintenance target.
- Windows packaging still requires real machine or CI runner validation.
- Bundling Pi may require `GOGO_DESKTOP_PI_BINARY` or `GOGO_DESKTOP_PI_RUNTIME_ROOT`.
- Signing, notarization, clean-machine validation, and auto-update are not complete.

For historical packaging notes, see:

- [Desktop packaging guide](../archive/packaging/desktop-packaging-guide.md)
- [Release target and boundaries](../archive/planning/release-target-and-boundaries.md)
- [Tauri migration plan](../archive/packaging/tauri-migration-plan.md)

## Repository Map

```text
gogo-app/
  app/
    backend/        FastAPI services, session handling, Pi RPC integration
    frontend/       Single-page workspace assets
  src-tauri/        Tauri desktop shell
  example-knowledge-base/
                    Starter local knowledge-base workspace
  docs/             Public docs, archived notes, and demo assets
  scripts/          Development and desktop build helpers
```

## Recommended Developer Reading

- [Documentation index](../index.md)
- [Architecture overview](architecture-overview.md)
- [gogo-app architecture](gogo-app-architecture.md)
- [Agent architecture](agent-architecture.md)
- [Session management](session-management.md)
- [Frontend workbench elements](frontend-workbench-elements.md)

## License Note

This repository does not currently include a public license file. Add a `LICENSE` before treating the project as reusable open source. MIT is the recommended default for a lightweight portfolio release unless there is a specific reason to choose another license.
