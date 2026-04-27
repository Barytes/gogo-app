# Architecture Overview

**Last updated:** 2026-04-27

This is the public architecture overview for `gogo-app`. It explains the main parts of the system without requiring readers to follow every historical implementation note.

## Product Boundary

`gogo-app` is a local llm-wiki workspace with a built-in Pi agent. It is responsible for the application UI, local backend APIs, session orchestration, Pi RPC integration, and turning a local knowledge-base folder into a usable product experience.

It is not responsible for defining the entire knowledge-base schema ecosystem, running a multi-user public knowledge pool, or implementing a standalone sync protocol. Those belong to the broader gogo project ideas and are mostly outside this app snapshot.

## Runtime Shape

The app has three main layers:

```text
Frontend workspace
  -> FastAPI backend
  -> Pi RPC agent runtime
```

For content browsing, the chain is:

```text
Frontend workspace
  -> FastAPI backend
  -> local knowledge-base directory
```

The desktop shell is implemented with Tauri. In development mode, Tauri starts the local FastAPI backend and then opens the native window.

## Main Components

- `app/frontend/`: single-page Wiki / Chat workspace, settings panel, inbox panel, and browser-side interaction logic.
- `app/backend/`: FastAPI routes, knowledge-base APIs, session management, Pi RPC transport, provider settings, diagnostics, and security boundary integration.
- `src-tauri/`: Tauri desktop shell and native commands.
- `example-knowledge-base/`: starter llm-wiki workspace used for first-run exploration.
- `docs/`: public docs, archived notes, and demo assets.

## Key Design Boundaries

- The local knowledge base remains the user's durable content layer.
- `gogo-app` consumes knowledge-base structure and makes it usable, but does not try to replace it with app-only storage.
- Pi is used as the current agent runtime through RPC integration.
- Agent sessions are persisted locally so previous conversations can be restored.
- Model/provider setup and diagnostics are exposed because the agent runtime should not be fully hidden from the user.

## Deeper References

- [Developer guide](developer-guide.md)
- [Knowledge base guide](knowledge-base-guide.md)
- [gogo-app architecture](gogo-app-architecture.md)
- [Agent architecture](agent-architecture.md)
- [Session management](session-management.md)
- [Frontend workbench elements](frontend-workbench-elements.md)
