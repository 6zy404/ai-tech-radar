# Changelog

This file records the version-by-version feature history of the AI Tech Radar
prototype. It is the historical companion to `README.md`, which describes the
**current** state of the project.

The prototype is pre-release, so entries are grouped by feature milestone rather
than by semantic version or release date. Milestones are listed newest-first.
For per-topic deep dives, see the `docs/` directory.

> Migration note: this changelog was extracted from the README's running feature
> log so that the README can stay focused on the current state. Earlier entries
> were reconstructed from that log and may not carry exact dates.

## Foundation
- Next.js + TypeScript app foundation.
- Core models for technologies, skills, knowledge, tags, relations, imported
  candidates, external sources, and workspace technology records.
- Bundled mock data to demonstrate the platform structure.

## Source ingestion & candidate review
- **External Source Management v0** — local JSON source configuration, source
  search/filters, create/edit form, enable/disable, manual single-source import,
  batch import for enabled sources, and source health status (import count,
  failure count, latest message). Real import for RSS / Atom, GitHub releases,
  and official-blog-style pages, with a local fallback candidate layer.
- **Source Quality + Candidate Quality Signals v0** — workspace-only quality
  signals for source stability, duplicate rate, conversion rate, rejection rate,
  and per-candidate flags (missing fields, duplicates, short content, draft
  readiness). Excluded from user-facing pages.
- **ImportedCandidate review workflow** — search, source-type filter, normalized
  type filter, import status filter, duplicate hints, review actions, and raw
  payload inspection.
- **Rule-based duplicate detection v0** and **Candidate Duplicate Review v1** —
  persistent, explainable duplicate groups, primary candidate selection,
  resolved/ignored status, a conversion guard for non-primary duplicates, and
  additional source references carried into generated drafts.

## Drafting, ranking & publishing
- **Candidate → technology draft conversion** and an internal technology
  workspace with draft/published/archived status, source traceability, and
  lightweight editing.
- **Ranking v0** — deterministic priority triage
  (`high_priority | watch | low_priority`) with explainable reasons/warnings,
  workspace priority badges, and productized user-facing priority labels that do
  not expose raw scores.
- **Publish Quality Gate v0** — deterministic publish-readiness checks
  (blocking errors and non-blocking warnings) plus a user-facing preview before
  publication.

## Content intelligence & AI-assisted enrichment
- **Content Intelligence v1** — editable explanation fields (why it matters, who
  should care, technical context, impact areas, learning path, related
  knowledge/skill explanations, follow-up questions, reading difficulty,
  enrichment status) published into safe user-facing records.
- **AI-assisted Editorial Enrichment v0** — workspace-only enrichment
  suggestions via rule-based, mock LLM, and optional LLM-assisted generation,
  behind a server-side LLM provider boundary (`mock` and `openai_compatible`),
  with output validation/sanitization and generate/compare/apply/reject/
  regenerate flows. Falls back to mock generation when no API key is configured.
- **Prompt Quality & Editorial Review v1** — workspace-only `PromptVersion`
  records, per-suggestion `promptVersionId`, and a review loop with score,
  labels, notes, rejection reason, applied-field tracking, and stale-suggestion
  handling.

## Daily digest & delivery
- **Daily Digest Editorial Workflow v1** — generates a draft digest from
  published technologies using Ranking v0, with editable copy, manual
  add/exclude/pin/order controls that survive regeneration, aggregated related
  skills/knowledge/sources, preview, publish-readiness checks, and public
  `/digest/today` and `/digest/[date]` pages.
- **Digest Delivery Surface v0** — public `/feed.xml` and `/feed.json` for
  published digests only, with internal fields excluded.
- **Digest Delivery Integration v1 + Channel Expansion v1** — workspace-only
  generic webhook and Feishu webhook channels, JSON/text payloads, manual send
  for published digests only, and delivery logs with success/failure/retry
  state. Endpoint URLs are masked and kept off user-facing pages.
  (`email | telegram | discord` channel types are reserved/typed but not full
  delivery products.)
- **Scheduled Delivery v0** — workspace-only schedules for sending published
  digests to enabled channels, a local runner for due/manual runs,
  schedule-level run records alongside per-channel `DeliveryRun` logs, and
  same-day duplicate-send protection.
- **Real Cron / Task Runner v1** — `tasks:run-once` and `tasks:watch`
  command-line entry points, task-runner audit summaries, reuse of the
  duplicate-send protection, and URL/token sanitization in logs.

## Persistence, hardening & operations
- **Deployment Readiness & Security Boundary v0** — explicit public/workspace/
  internal-API route boundaries, optional token protection for workspace routes,
  documented environment variables, and `validate:deployment` checks.
- **Persistence Migration Planning v0** — centralized local JSON mechanics in
  `src/lib/repositories/local-json-store.ts`, confirmation that pages/APIs call
  workflow services instead of reading JSON directly, and a documented future
  database path.
- **Database Migration v0** — optional SQLite driver (Node's built-in
  `node:sqlite`) with JSON as the default fallback, schema v0 for the current
  workflow objects, `db:init` / `db:migrate-json` / `db:reset` /
  `validate:database`, and DB access kept behind repository/store helpers.
- **Database-backed Workflow Hardening v1** — a workspace-only `WorkflowEvent`
  audit log, stronger conversion/publish/delivery/schedule guards against
  duplicate or invalid operations, workspace-only event panels, and
  `validate:workflow-hardening`.
- **Observability & Admin Operations v0** — `/workspace/operations` health
  dashboard and `/workspace/operations/events` filtered audit browser,
  summarizing failed imports/deliveries/scheduled runs, task-runner status,
  digest status, open duplicates, and candidate quality issues.

## Navigation, IA & design system
- **Workspace Navigation & Information Architecture v0** — `/workspace`
  dashboard, a clickable Sources → Import → Candidates → Duplicates → Drafts →
  Publish → Digests workflow overview, shared workspace navigation, and
  breadcrumbs on detail/preview pages.
- **Workspace Boundary & Action Clarity v0** — result-oriented action labels,
  confirmation prompts for destructive/external-send/regeneration/retry/
  overwrite actions, and helpful disabled/empty states.
- **User-facing Product IA & Discovery Flow v0** — public product home with the
  latest digest, priority signals, and Skills/Knowledge entry points; Daily
  Digest in global navigation; and skills/knowledge pages that explain how they
  connect to published technology signals.
- **Design System v0** — separate `WorkspacePageShell` / `UserPageShell` page
  families and a shared `PageHeader` primitive, keeping internal-only fields off
  user-facing layouts.
- **Bilingual support** — content-level localization (`original` / `zh` / `en`)
  for technology title, summary, and content, with Chinese-preferred display and
  original-source fallback. No route-based i18n.
