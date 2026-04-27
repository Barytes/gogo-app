# gogo Documentation Index

**Last updated:** 2026-04-27

## Folder Layout

- `public/`: current docs that are still useful for understanding the project, running it from source, or reading the implementation.
- `archive/`: historical plans, packaging notes, logs, deprecated maintenance files, and vendored reference docs.
- `assets/`: README and documentation media assets.

## Public Docs

These documents are suitable for readers, reviewers, and developers coming to the project fresh.

- [Design principles](public/design-principles.md) - product principles and tradeoffs
- [Knowledge base guide](public/knowledge-base-guide.md) - `wiki/`, `raw/`, `inbox/`, skills, schemas, and `AGENTS.md`
- [Architecture overview](public/architecture-overview.md) - main app layers and runtime boundaries
- [Developer guide](public/developer-guide.md) - local setup, desktop development, build notes, and repo map

## Public Implementation References

These are more detailed implementation notes. They are still useful, but you usually do not need to read them first.

- [gogo-app architecture](public/gogo-app-architecture.md) - app responsibilities, frontend/backend shape, and current implementation boundary
- [Agent architecture](public/agent-architecture.md) - Pi RPC agent backend and runtime orchestration
- [Session management](public/session-management.md) - session persistence, recovery, and history behavior
- [Frontend workbench elements](public/frontend-workbench-elements.md) - Wiki / Chat workspace UI elements and data sources
- [Knowledge-base architecture](public/knowledge-base-architecture.md) - deeper knowledge-base responsibilities and schema boundaries
- [Pi security boundary](public/pi-security-boundary.md) - local security mode, audit logs, and command/write boundaries
- [Slash command scope](public/slash-command-scope.md) - slash command product boundary and source rules

## Archive

Archived documents are kept for traceability. They may be stale, incomplete, or written for a previous project phase.

### Planning

- [Open-source readiness refactor plan](archive/planning/open-source-readiness-refactor-plan.md)
- [Release target and boundaries](archive/planning/release-target-and-boundaries.md)
- [Product definition belief](archive/planning/product-definition-belief.md)
- [Tolaria documentation lessons for gogo](archive/planning/tolaria-documentation-lessons-for-gogo.md)
- [Agent session refactor assessment](archive/planning/agent-session-refactor-assessment.md)

### Packaging

- [Desktop packaging options](archive/packaging/desktop-packaging-options.md)
- [Desktop packaging guide](archive/packaging/desktop-packaging-guide.md)
- [Desktop packaging regressions](archive/packaging/desktop-packaging-regressions.md)
- [Tauri migration plan](archive/packaging/tauri-migration-plan.md)

### Logs

- [Problem log](archive/logs/problem-log.md)
- [Session performance optimization log](archive/logs/session-performance-optimization-log.md)
- [Documentation cleanup audit](archive/logs/documentation-cleanup-audit-2026-04-15.md)

### Deprecated

- [Archived TASKS](archive/deprecated/TASKS.md)
- [Archived code-doc mapping](archive/deprecated/code-doc-mapping.md)
- [Archived model provider options](archive/deprecated/model-provider-configuration-options.md)

### Vendored References

- [Pi docs mirror](archive/vendor/pi/README.md) - local copy of Pi documentation used as implementation reference for Pi-related work
