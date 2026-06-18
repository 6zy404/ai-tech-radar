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

Visual issues found and fixed:

- `/workspace/delivery`: page-level horizontal overflow (~32px). Root cause was
  the workspace content column (`.workspace-shell__content`) using an implicit
  `auto` grid track that expanded to its widest child (the delivery tables).
  Fixed by capping it with `grid-template-columns: minmax(0, 1fr)`, and by
  making the delivery log table and channel table scroll inside their own boxes
  (`min-width: 0; overflow-x: auto`) instead of clipping. Re-verified with
  `ui:check`: `horizontalOverflow` is now `false` and the content column is back
  to 1060px.

Not a bug (working as designed):

- `/workspace/sources`: the source table is wrapped in
  `.source-console-table-scroll` (`overflow-x: auto`), so on viewports narrower
  than the table's comfortable width (~1120px) it scrolls horizontally inside
  its own box. The Actions column is reachable by scrolling the table sideways;
  it is not lost. The `ui:check` screenshot shows it at scroll position 0, which
  is why the action buttons sit off the right edge. The delivery log and channel
  tables now use the same pattern.

Resolved (wide-table fit):

- The wide workspace tables (sources, delivery channels, delivery logs) had
  column minimums summing to ~1120-1347px, wider than the ~1060px content
  column, so the Actions column required sideways scrolling. Column minimums
  were reduced (cells stack/wrap vertically, so narrower columns just add a
  little row height) so each table fits the content column. Verified via
  `ui:check`: every route now reports `horizontalOverflow: false` and an empty
  `overflowingElements`, and the Actions column is visible without scrolling.

## Needs Human Confirmation

- Spot-check the saved screenshots in `visual-qa-screenshots/` for spacing and
  typography polish (automated checks only cover layout/leak signals).
- Whether the Learning Support pages are fully approved: current code and
  `docs/design-system.md` indicate they use the template, but
  `docs/page-structure.md` still lists `/skills` and `/knowledge` in a later
  migration section.
- Whether `/workspace/operations` should be considered an admin dashboard:
  current repo implements it as internal operations, while the project non-goals
  still say no full admin platform.

## Resolved

- Previously-uncommitted working-tree changes (a large UI/design