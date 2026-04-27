# Design Principles

**Last updated:** 2026-04-27

This document expands the short principles in the README. It describes the product choices that shaped `gogo-app`, rather than trying to present it as a general-purpose knowledge management platform.

## 1. gogo serves the local llm-wiki knowledge base

gogo is an entry point for an llm-wiki-style local knowledge base. The knowledge base should remain readable, movable, and useful outside the app.

In practice, this means the important user content lives in local folders such as `wiki/`, `raw/`, `inbox/`, `skills/`, `schemas/`, and `AGENTS.md`. Stopping use of gogo should not destroy or obscure the user's knowledge.

It also means gogo should avoid becoming the only owner of the workflow. The app can make the workflow easier to use, but the knowledge base remains the durable object.

## 2. Unified Wiki + Agent workspace

The core product bet is that knowledge browsing and agent conversation belong in the same workspace. gogo exists because switching between a note app and a coding agent creates friction in everyday llm-wiki use.

The app therefore has both Wiki and Chat as first-class modes. Reading, editing, quoting pages, uploading files, and asking the agent to continue the work are all part of one surface.

This does not mean every feature must be shown at once. It means the product should preserve a fast path between "I am reading this" and "I want the agent to work with this."

## 3. Focus on llm-wiki, not general knowledge management

gogo is intentionally focused on the llm-wiki workflow: source material enters the workspace, useful knowledge is refined into wiki pages, and the agent helps query, connect, and maintain that structure.

This focus keeps the product boundary clear. gogo is not trying to become a universal file explorer, a generic note app, or a full research database.

The upside of this constraint is a more coherent first-run experience: users are introduced to `inbox/`, `raw/`, `wiki/`, skills, schemas, and the agent as one workflow.

## 4. The user owns the knowledge base

The user should be able to inspect, modify, migrate, and replace the knowledge-base structure and agent-facing rules. gogo should make those structures visible rather than hide them behind app-only state.

This is why skills, schemas, `AGENTS.md`, model settings, diagnostics, and knowledge-base paths are exposed in the product instead of being treated as invisible internals.

When there is a tradeoff between a more controlled product and a more inspectable workflow, gogo generally favors inspectability and user agency.

## 5. Do not over-black-box the agent

The agent is powerful, but it should not feel like opaque magic. Users should be able to see enough of the model, session, command, context, and permission boundaries to understand what the agent is doing.

This principle shows up in model/provider configuration, slash commands, thinking-level controls, context-window visibility, diagnostics, and local security logs.

The goal is not to expose every implementation detail. The goal is to keep the important operating boundaries visible enough that users can trust and steer the system.

## 6. Out of the box

gogo should reduce the setup cost of trying an llm-wiki-style workflow. The ideal first experience is: open the app, configure a model, choose or create a knowledge base, and complete one useful loop.

The example knowledge base exists for this reason. It gives users a starter workspace before they have built their own.

This principle matters especially because gogo is aimed beyond developers who are already comfortable combining Obsidian, terminals, coding agents, and custom prompts.
