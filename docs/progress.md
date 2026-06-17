# Progress

Based on current repository files only. Last reconciled after committing the
previously-uncommitted UI/design-system work (commit `e336e58`) and the project
documentation refresh (commit `05d45ae`).

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
  `/workspace/digests`, `/workspace/technologies` (now a draft/published/archived
  console with status overview cards and separated draft vs published sections).
- User-facing Reading Template: `/technologies`, `/technologies/[slug]`.
- Learning Support templates: `/skills`, `/skills/[slug]`, `/knowledge`,
  `/knowledge/[slug]`.

Verified via `npm run ui:check` (Playwright, 1440px viewport, 24 routes): all
routes return 200, stylesheets load, workspace pages render the workspace shell
+ nav + breadcrumbs, user-facing pages render the user shell, and no internal
terms leak onto any user-facing page or feed. The pages previously listed as
"pending" (`/digest/today`, `/digest/[date]`, `/workspace/operations`,
`/workspace/duplicates`) all render correctly on the shared templates.

Known visual issues from that run:

- `/workspace/delivery`: page-level horizontal overflow (