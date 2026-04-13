# Code-Doc Mapping

This document defines how code explanation docs map to implementation files.

## Rule

When any mapped code file changes, update the mapped document(s) in the same change.

## Mapping Table

| Doc | Code Files |
|---|---|
| `docs/pi-sdk-bridge-architecture.md` | `app/backend/pi_sdk_bridge.mjs` |
| `docs/session-management.md` | `app/frontend/assets/chat.js`, `app/backend/main.py`, `app/backend/session_manager.py`, `app/backend/pi_sdk_bridge.mjs` |
| `docs/agent-architecture.md` | `app/backend/agent_service.py`, `app/backend/pi_sdk_bridge.mjs` |
| `docs/agent-session-refactor-assessment.md` | `app/backend/agent_service.py`, `app/backend/session_manager.py`, `app/backend/pi_sdk_bridge.mjs`, `app/backend/session_event_store.py` |

## How to Extend

For each new code explanation doc:

1. Add one row in the table.
2. Keep file paths explicit and minimal.
3. If one code file affects multiple docs, list it in each relevant row.
