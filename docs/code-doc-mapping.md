# Code-Doc Mapping

This document defines how code explanation docs map to implementation files.

## Rule

When any mapped code file changes, update the mapped document(s) in the same change.

## Mapping Table

| Doc | Code Files |
|---|---|
| `docs/session-management.md` | `app/frontend/assets/chat.js`, `app/backend/main.py`, `app/backend/session_manager.py`, `app/backend/pi_rpc_client.py`, `app/backend/config.py` |
| `docs/agent-architecture.md` | `app/backend/agent_service.py`, `app/backend/session_manager.py`, `app/backend/pi_rpc_client.py`, `app/backend/config.py` |
| `docs/agent-session-refactor-assessment.md` | `app/backend/agent_service.py`, `app/backend/session_manager.py`, `app/backend/pi_rpc_client.py`, `app/backend/config.py` |
| `docs/frontend-workbench-elements.md` | `app/frontend/index.html`, `app/frontend/assets/styles.css`, `app/frontend/assets/workbench.js`, `app/frontend/assets/wiki.js`, `app/frontend/assets/chat.js`, `app/backend/main.py`, `app/backend/skill_service.py` |
| `docs/gogo-app-architecture.md` | `app/frontend/index.html`, `app/frontend/assets/workbench.js`, `app/frontend/assets/chat.js`, `app/frontend/assets/wiki.js`, `app/backend/main.py`, `app/backend/config.py` |
| `docs/pi-security-boundary.md` | `app/backend/security_service.py`, `app/backend/main.py`, `app/backend/session_manager.py`, `app/backend/agent_service.py`, `app/frontend/index.html`, `app/frontend/assets/workbench.js`, `app/frontend/assets/chat.js` |
| `docs/session-performance-optimization-log.md` | `app/frontend/assets/chat.js`, `app/backend/session_manager.py`, `app/backend/main.py` |
| `docs/model-provider-configuration-options.md` | `app/backend/config.py`, `app/backend/main.py`, `app/frontend/assets/workbench.js`, `src-tauri/src/backend.rs` |
| `docs/slash-command-scope.md` | `app/frontend/assets/chat.js`, `app/frontend/assets/workbench.js`, `app/backend/main.py`, `app/backend/config.py`, `app/backend/skill_service.py` |
| `docs/tauri-migration-plan.md` | `package.json`, `.gitignore`, `app/frontend/index.html`, `app/frontend/assets/desktop-bridge.js`, `app/frontend/assets/workbench.js`, `src-tauri/Cargo.toml`, `src-tauri/build.rs`, `src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json`, `src-tauri/src/main.rs`, `src-tauri/src/backend.rs`, `src-tauri/src/commands.rs` |
| `docs/desktop-packaging-guide.md` | `package.json`, `scripts/desktop-build.mjs`, `src-tauri/tauri.conf.json`, `src-tauri/src/main.rs`, `src-tauri/src/backend.rs`, `app/backend/desktop_entry.py` |
| `docs/desktop-packaging-regressions.md` | `scripts/desktop-build.mjs`, `src-tauri/tauri.conf.json`, `src-tauri/src/main.rs`, `src-tauri/src/backend.rs`, `app/backend/config.py`, `app/backend/session_manager.py`, `app/backend/main.py` |

## How to Extend

For each new code explanation doc:

1. Add one row in the table.
2. Keep file paths explicit and minimal.
3. If one code file affects multiple docs, list it in each relevant row.
