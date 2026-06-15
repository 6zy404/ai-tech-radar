# Progress

Project Context Recovery v0. Based on current repository files only.

## Core Features Present

- Next.js + TypeScript app foundation.
- Internal Workspace for sources, candidates, duplicates, technology drafts,
  digests, delivery, schedules, operations, and workflow events.
- User-facing product for home, technologies, digest, skills, knowledge, and
  public feeds.
- Local JSON persistence by default, with optional SQLite driver documented and
  scripted.
- External source configuration and import workflow for RSS, Atom, GitHub
  releases, and official-blog style sources.
- Imported candidate review, duplicate detection/review, candidate conversion,
  technology draft editing, publish readiness, preview, publish, and archive.
- Deterministic source/candidate quality signals and Ranking v0 priority labels.
- Daily Digest editorial workflow, public digest pages, RSS feed, and JSON feed.
- Workspace-only delivery channels, scheduled delivery, task runner, operations
  dashboard, and workflow audit events.
- Content Intelligence fields, editorial enrichment suggestions, LLM provider
  boundary, prompt versions, and prompt/suggestion review metadata.
- Optional workspace access middleware for workspace and internal API routes.

## Pages Present

User-facing:

- `/`
- `/technologies`
- `/technologies/[slug]`
- `/digest/today`
- `/digest/[date]`
- `/skills`
- `/skills/[slug]`
- `/knowledge`
- `/knowledge/[slug]`
- `/feed.xml`
- `/feed.json`

Internal Workspace:

- `/workspace`
- `/workspace/sources`
- `/workspace/sources/new`
- `/workspace/sources/[id]`
- `/workspace/candidates`
- `/workspace/candidates/[id]`
- `/workspace/duplicates`
- `/workspace/duplicates/[id]`
- `/workspace/technologies`
- `/workspace/technologies/[id]`
- `/workspace/technologies/[id]/preview`
- `/workspace/digests`
- `/workspace/digests/[date]`
- `/workspace/digests/[date]/preview`
- `/workspace/delivery`
- `/workspace/delivery/schedules`
- `/workspace/operations`
- `/workspace/operations/events`

Legacy/internal redirects or compatibility pages exist in `src/app`:

- `/candidates`
- `/candidates/[id]`
- `/technologies/drafts`
- `/technologies/drafts/[id]`

## UI Migration State

Completed according to `docs/design-system.md`, `docs/page-structure.md`, and
current shell/component usage:

- Workspace Console Template: `/workspace/sources`, `/workspace/candidates`,
  `/workspace/digests`.
- User-facing Reading Template: `/technologies`, `/technologies/[slug]`.
- Learning Support templates: `/skills`, `/skills/[slug]`, `/knowledge`,
  `/knowledge/[slug]`.

Suspected partial or pending:

- `/digest/today`
- `/digest/[date]`
- `/workspace/operations`
- `/workspace/duplicates`
- `/workspace/technologies`

## Needs Human Confirmation

- Visual quality and responsive behavior: Unknown / needs verification because
  Playwright was not run.
- Whether the Learning Support pages are fully approved: current code and
  `docs/design-system.md` indicate they use the template, but
  `docs/page-structure.md` still lists `/skills` and `/knowledge` in a later
  migration section.
- Whether `/workspace/operations` should be considered an admin dashboard:
  current repo implements it as internal operations, while the project non-goals
  still say no full admin platform.
- Whether existing dirty working-tree changes are final user-approved state:
  Unknown / needs verification.
