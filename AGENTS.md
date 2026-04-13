# Repository AGENTS Guide

This repository contains the standalone Web MVP application for the research knowledge base.

## Scope

This root `AGENTS.md` applies to the web application and project-level architecture files in this repository.

The knowledge content, prompt files, and wiki pages live in a separate sibling repository pointed to by `KNOWLEDGE_BASE_DIR`.

For knowledge-base content rules, consult the external knowledge-base repo, especially:

- `AGENTS.md` inside that knowledge-base repository

For Pi agent / Pi SDK / bridge-related behavior and API questions, use the local Pi docs mirror first:

- `docs/pi/` (copied Pi documentation)

## Document Hierarchy

```
product-definition-belief.md (North Star)
    ↓
client-architecture.md + server-architecture.md (Architecture Design)
    ↓
TASKS.md (Task List - describes gaps between code and architecture)
    ↓
Code Implementation
```

### Document Responsibilities

| Document | Purpose | Update Trigger |
|----------|---------|----------------|
| `product-definition-belief.md` | Core value proposition and goals | Rarely; only when product vision changes |
| `client-architecture.md` | Local client architecture design | When client architecture decisions change |
| `server-architecture.md` | Server architecture design | When server architecture decisions change |
| `agent-architecture.md` | Agent service architecture design | When Agent service implementation changes |
| `TASKS.md` | Current code status + task list tracking gaps | Every code change; keep synced with code |

## Code-Architecture Sync Rules

### Rule 1: Architecture is the Guide

Code should follow `client-architecture.md` and `server-architecture.md`. These documents describe the target architecture that the code should implement.

### Rule 2: TASKS.md Tracks Gaps

`TASKS.md` describes:
- Current code implementation status
- Gaps between code and architecture
- Tasks needed to close those gaps

**Whenever code is modified, update `TASKS.md`**:
- Mark completed tasks as done (or remove them)
- Update code status descriptions
- Add new tasks if new gaps are introduced

### Rule 3: Architecture Changes Trigger Task Cleanup

Whenever `client-architecture.md` or `server-architecture.md` is modified:
- Review `TASKS.md` and remove outdated tasks
- Add new tasks for newly described features
- Modify existing tasks if requirements changed
- Keep `TASKS.md` aligned with current architecture

### Rule 4: Never Let TASKS.md Stale

If you implement a feature described in `TASKS.md`:
- Complete the implementation in code
- Immediately update `TASKS.md` to reflect the new status
- Do not leave completed tasks in the list

### Rule 5: Agent Architecture Sync

`docs/agent-architecture.md` describes the Agent service implementation in detail.

**Whenever `app/backend/agent_service.py` or `app/backend/pi_sdk_bridge.mjs` is modified:**
- Update `docs/agent-architecture.md` to reflect the changes
- Keep the "当前实现状态" section accurate
- Update the "与架构的差距" table if gaps change
- Update the "变更日志" at the end

This document should be treated as a living specification that always matches the current code.

### Rule 6: Session/Bridge Docs Must Match Code

Code explanation documents and their corresponding code files are centrally maintained in:

- `docs/code-doc-mapping.md`

**Whenever any mapped code file is modified, update the mapped doc(s) in the same change.**

### Rule 7: Pi-Related Changes Must Reference Local Pi Docs

When working on Pi-related implementation (e.g. `app/backend/pi_sdk_bridge.mjs`, session behavior, RPC/SDK usage):

- Consult `docs/pi/` first as the primary reference.
- If behavior differs from current code, document the gap in architecture/task docs before changing implementation.

## When Implementing Features

1. **Read architecture first** — Understand the design in `client-architecture.md` or `server-architecture.md`
2. **Check `TASKS.md`** — See if the task is already described
3. **Implement the code**
4. **Update `TASKS.md`** — Mark task as completed, update code status

## When Architecture Changes

1. **Modify the architecture document** (`client-architecture.md` or `server-architecture.md`)
2. **Immediately update `TASKS.md`**:
   - Remove tasks that are no longer relevant
   - Add new tasks for new features
   - Modify tasks if the implementation approach changed

## File Structure

```
gogo-app/
├── AGENTS.md                 # This file - contribution guidelines
├── TASKS.md                  # Current code status + task list (KEEP SYNCED)
├── README.md                 # Project overview
├── docs/
│   ├── product-definition-belief.md    # North Star
│   ├── client-architecture.md          # Client design
│   ├── server-architecture.md          # Server design
│   ├── agent-architecture.md           # Agent service design (KEEP SYNCED)
│   ├── pi/                             # Local mirror of Pi docs (reference first for Pi-related work)
│   └── code-doc-mapping.md             # Code explanation doc ↔ code mapping
├── app/
│   ├── backend/
│   │   ├── main.py           # FastAPI entry point
│   │   ├── config.py         # Configuration
│   │   ├── agent_service.py  # Agent chat service
│   │   ├── pi_sdk_bridge.mjs # Pi SDK bridge
│   │   ├── wiki_service.py   # Wiki knowledge service
│   │   ├── raw_service.py    # Raw material service
│   │   ├── write_service.py  # (TODO) Write-back service
│   │   └── git_sync_service.py # (TODO) Git sync service
│   └── frontend/
│       ├── index.html
│       └── assets/
│           ├── chat.js
│           ├── wiki.js
│           ├── workbench.js
│           └── sync.js       # (TODO) Sync UI
└── ...
```
