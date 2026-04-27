# Knowledge Base Guide

**Last updated:** 2026-04-27

gogo is built around an llm-wiki-style local knowledge base. The knowledge base is a normal folder on disk, not a database hidden inside the app.

## Core Layout

A typical local knowledge base contains:

```text
knowledge-base/
  wiki/
  raw/
  inbox/
  skills/
  schemas/
  AGENTS.md
```

`wiki/` contains maintained pages: summaries, concepts, comparisons, decisions, reusable notes, and other material that should become part of the durable knowledge layer.

`raw/` contains source material. It is the evidence layer that the agent can return to when wiki pages are not enough.

`inbox/` is a temporary entry point for new files. Files can be uploaded through gogo or placed there directly before being ingested into the knowledge base.

`skills/` and `schemas/` describe agent-facing workflows and rules. They are intentionally visible so users can inspect and change how the agent works with the knowledge base.

`AGENTS.md` gives the agent initial instructions for working inside the knowledge base.

## Intended Workflow

The basic loop is:

1. Put new material into `inbox/`.
2. Ingest useful source material into `raw/`.
3. Ask the agent to create or update pages in `wiki/`.
4. Query the wiki first, and return to raw sources when the answer needs verification.
5. Lint or clean the wiki over time to reduce duplicates, stale pages, missing links, and conflicts.

This workflow is why gogo exposes both Wiki and Chat as primary surfaces. The user should be able to read a page, ask the agent about it, quote it into a prompt, upload new material, and continue shaping the knowledge base without switching tools.

## Example Workspace

The repository includes [example-knowledge-base](../../example-knowledge-base), a small starter workspace for local exploration. It is the recommended first knowledge base when running gogo from source or trying the app for the first time.

## Independence From gogo

The knowledge base does not have to be used only with gogo. Because it is made of local files and agent-readable conventions, users can also work with it using other coding agents or editors.

This is an intentional product boundary: gogo should improve the llm-wiki workflow without making the user's knowledge dependent on gogo itself.
