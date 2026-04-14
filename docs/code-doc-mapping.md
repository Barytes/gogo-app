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
| `docs/frontend-workbench-elements.md` | `app/frontend/index.html`, `app/frontend/assets/styles.css`, `app/frontend/assets/workbench.js`, `app/frontend/assets/wiki.js`, `app/frontend/assets/chat.js` |

## How to Extend

For each new code explanation doc:

1. Add one row in the table.
2. Keep file paths explicit and minimal.
3. If one code file affects multiple docs, list it in each relevant row.
