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

## SQLite Storage Model (decided 2026-07-05)

- The optional SQLite driver is a **document store**, and that is intentional —
  not a half-finished relational migration.
- Each domain table stores the full domain object as a JSON `payload` column;
  reads are whole-store (`SELECT payload`), writes are whole-store
  (clear table + reinsert), matching the JSON-file contract exactly.
- The key columns (`status`, `slug`, `date`, `enabled`, …) and indexes are
  **denormalized copies kept for two purposes only**: rehearsing the future
  Postgres/Supabase table shapes documented in `docs/persistence-plan.md`, and
  allowing external SQL inspection of local state. Business code does not
  query them (the only SQL readers are the three static-content seed readers
  and the schema stats helper).
- A move to real relational tables was considered and rejected: it would
  require changing every workflow module from "read/write whole store" to
  per-record repository operations — production database work that
  `AGENTS.md` explicitly keeps out of scope — while the JSON driver (the
  default) would still keep the old semantics, forking the two drivers.
- Revisit this decision only when a real multi-user / production database
  migration is explicitly authorized; the documented repository seams and key
  columns are the prepared starting point for that work.

## Verification Rules

- Playwright is run by the user on their own machine.
- Codex should not run Playwright unless explicitly asked.
- Codex default verification is `npm run typecheck`.
- For the next UI refinement task, only run `npm run typecheck`.
