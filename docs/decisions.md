# Decisions

Project Context Recovery v0. These are working decisions for future Codex
sessions.

## Product Boundary

- Workspace is the internal editing / operations workbench.
- User-facing is the public reading and technology discovery product for normal
  users.
- Workspace may show workflow state, diagnostics, source health, delivery logs,
  schedules, task-runner state, raw payloads, audit events, and mutation
  actions.
- User-facing pages must show safe published content and must not expose
  workspace internals.

## UI Work Rules

- UI tasks default to visual-layer changes only.
- One page per task.
- Do not modify API, workflow, data model, persistence, or routing unless the
  task explicitly asks for it.
- Keep Workspace Console pages visually distinct from User-facing Reading pages.

## Context Rules

- Long-term context belongs in repository documents, not chat history.
- If current files do not prove a detail, write `Unknown / needs verification`.
- Start new sessions by reading `AGENTS.md`, README, core docs, and the recovery
  docs before editing.

## Verification Rules

- Playwright is run by the user on their own machine.
- Codex should not run Playwright unless explicitly asked.
- Codex default verification is `npm run typecheck`.
- For the next UI refinement task, only run `npm run typecheck`.
