# AI Tech Radar Prototype

A local-first prototype for a high-impact new-technology discovery and
understanding platform. The goal is not a generic news feed: it helps readers
see **which new technologies matter first** and connects them to the skills and
classic knowledge needed to understand them.

The product is split into two subsystems:

- **Internal Workspace** — configure external sources, import real items, review
  candidates, resolve duplicates, convert candidates into technology drafts,
  edit and enrich draft content, run publish-readiness checks, publish/archive
  records, build and publish Daily Digests, deliver digests to external
  channels, schedule deliveries, and monitor operations.
- **User-facing Product** — a public home, an auto-aggregated news fast lane
  (`/news`), readable technology list/detail pages (published records only),
  published Daily Digest pages, skills/knowledge pages that explain the
  signals, public RSS/JSON feeds, and content-level bilingual support.

> **Status:** working prototype, past the original foundation phase. For the full
> feature history see [`CHANGELOG.md`](CHANGELOG.md). For deep dives on any area
> see the [`docs/`](docs/) directory.

## Current capabilities

- **Ingestion** — real import for RSS / Atom, GitHub releases, and
  official-blog-style pages, with a local fallback layer, batch import,
  source/candidate quality signals, and a task-runner scheduled daily import
  (`config/scheduled-import.json`, managed from
  `/workspace/delivery/schedules`).
- **News fast lane (two-tier content model)** — the 全部快讯 view on
  `/technologies?view=news` publicly renders recently imported candidates
  (last 7 days, grouped by day) through a
  dedicated sanitizing map (`src/lib/news.ts`): title / summary / source /
  date / tags only, always labelled "自动聚合，未经编辑精选", with rejected
  candidates, fallback placeholders, and non-primary duplicates excluded, and
  converted items linking to their published signal. The curated technology
  signal + digest tier stays editor-gated and unchanged.
- **Review** — candidate review workflow with filters, deterministic and
  explainable duplicate detection, and duplicate-group resolution.
- **Drafting & publishing** — candidate → draft conversion, lightweight draft
  editing, deterministic Ranking v0 priority triage, and a Publish Quality Gate
  with user-facing preview.
- **Content intelligence** — editable explanation fields (why it matters, who
  should care, technical context, learning path, etc.) plus optional
  AI-assisted editorial enrichment behind a server-side LLM provider boundary
  (mock by default, OpenAI-compatible when configured) with a prompt-quality
  review loop.
- **Knowledge relationship network** — every technology/skill/knowledge cross-
  reference carries an explicit, Chinese-labelled relation type; a small
  per-item relationship graph is walkable on all three detail pages, and
  `/network` renders the full graph in one view with a hand-written
  force-directed layout, search-highlight, a category filter, hover-over-edge
  relation labels, draggable nodes, and click-to-focus exploration of any
  node's direct connections.
- **Topic hub (`/topics/[tagId]`)** — a per-topic drill-down page merging what
  `/network`, the 按话题 view, and `/search` each show in fragments for one
  topic tag: the tag's published technology signals, tagged skills, tagged
  knowledge, and a "图谱关联" section listing its direct content-graph
  neighbors with relation-type labels. Reached only via a "查看专题" link on
  `FollowableTagList` chips (technology/skill/knowledge detail pages) — no
  index page, no global nav entry. Pure derived view (`getTopicHub` in
  `src/lib/topic-hub.ts`), no new persisted data or AI calls.
- **Compare two technologies (P3 v0)** — reader-triggered, live AI-generated
  comparison (similarities, differences, when to prefer each) between two
  published technologies on the technology detail page. Results are cached
  per technology pair and always shown with an "AI-generated, not reviewed"
  disclaimer; the first public-facing route that calls the LLM provider
  directly (`POST /api/technologies/compare`).
- **Explain at the reader's level (P3 v1)** — reader-triggered, live
  AI-generated explanation of a published technology tailored to a
  self-selected experience level (beginner / intermediate / advanced) on the
  technology detail page. Results are cached per technology × level and shown
  with the same "AI-generated, not reviewed" disclaimer
  (`POST /api/technologies/explain`).
- **Graph-grounded learning path (P3 v2)** — reader-triggered, live
  AI-generated learning path (overview, ordered steps, self-check
  checkpoints) for a published technology, grounded in its related
  knowledge and skills from the content graph. Results are cached per
  technology and shown with the same disclaimer
  (`POST /api/technologies/learning-path`).
- **Personal radar (P4 v0)** — readers follow topic tags (stored only in
  browser localStorage, no accounts) and the 我关注的 view on
  `/technologies?view=followed` aggregates matching published signals into
  the existing priority groups, with an explicit "matched because you follow
  X" line per item. Deterministic filtering on Ranking v0 — no AI ranking, no
  server-side profile. Detail pages carry a follow entry (P4 v0.1): the tags
  section on technology/skill/knowledge detail pages renders the same
  follow-toggle chips, so readers can follow a topic where they read about
  it, with an inline "已加入我的雷达 → 查看" link back to
  `/technologies?view=followed`. Public digest pages carry a personalized view
  (P4 v0.2): items matching followed topics get a "命中关注：X" line, and a
  "只看我关注的" toggle filters the signal sections client-side — the served
  digest stays identical for everyone. Topic-level tracking without accounts
  (P4 v0.3): every topic hub carries a 订阅此话题 block linking its per-topic
  RSS feed (`/topics/[tagId]/feed.xml`, published signals only), the 我关注的
  view lists feed links for followed topics, and followed-topic state can be
  exported/imported as a plain comma-separated 关注码 for cross-device use —
  still no accounts, no server-side profile.
- **Topic timeline** — the 按话题 view on `/technologies?view=timeline`
  groups published technology signals by topic tag, each shown as a
  chronological (newest-first) list linking to its detail page.
  Published-signal data only (no news fast-lane noise); reuses
  `getAllTechnologies` / `getAllTags` and the bilingual title/summary
  helpers, no new data or route.
- **Site-wide search** — public `/search` (an inline search icon in
  `TopNav` opens the query box) with server-rendered `?q=` keyword search
  over published technology signals, skills, knowledge, and the sanitized
  news fast lane. Deterministic, case-insensitive substring matching on
  title / summary / tag names only (space-separated terms are ANDed),
  results grouped per content type, and the fixed auto-aggregation
  disclaimer on the news group. News results reuse the same
  `src/lib/news.ts` public mapping as the 全部快讯 view; no internal fields
  enter the page (`src/lib/search.ts`).
- **Skill/Knowledge workspace editing (v0)** — `/workspace/skills` and
  `/workspace/knowledge` manage the skill and knowledge content pools:
  create new entries, or edit the bundled `src/data` seed entries via
  copy-on-write runtime overrides (`config/skill-workspace.json` /
  `config/knowledge-workspace.json` — seed files stay read-only). Entries
  carry a draft/published status with a minimal publish gate (title / slug /
  summary required and unique slug as blocking errors; short content,
  missing or non-canonical tags, and missing relations as warnings). Public
  `getAllSkills` / `getAllKnowledge` serve the merged view with drafts
  filtered from every public surface (index/detail pages, content graph,
  search, topic hubs).
- **Typed relation editing (LinkRelation v1)** — the related-content
  checkboxes in all three workspace editors (skill, knowledge, and the
  technology draft form) unfold a relation-type select (渊源/借助/释义/
  必备/延伸/印证/关联) plus an optional note while checked. Edits are
  stored as copy-on-write overrides of the read-only seed relations
  (`config/link-relation-workspace.json`, keyed by unordered pair;
  reverting to the seed value removes the override). The public relation
  reads (`findRelationBetween`, detail-page pills and 附注 notes,
  `RelationshipGraph` tooltips, `/network` edge labels, topic hubs) serve
  the merged view via `PUT /api/workspace/relations` +
  `src/lib/link-relation-workflow.ts`.
- **Daily Digest** — editorial workflow that generates, edits, previews, and
  publishes daily briefs, exposed publicly via `/digest/today`, `/digest/[date]`,
  the month-grouped `/digest` archive index, `/feed.xml`, and `/feed.json`.
  The task runner can also generate the day's digest **draft** automatically
  (`config/scheduled-digest.json`, managed from
  `/workspace/delivery/schedules`; skips when the day already has a digest,
  never publishes — publishing stays editor-gated).
- **Delivery** — workspace-only webhook and Feishu channels, manual and
  scheduled sending of published digests, and a local cron/task runner that
  also runs the scheduled daily source import (see
  [`docs/deployment.md`](docs/deployment.md) for Windows Task Scheduler
  setup).
- **Operations** — a workspace operations dashboard, a `WorkflowEvent` audit log,
  and per-subsystem `validate:*` checks.
- **Persistence** — local JSON by default, with an optional SQLite driver.
- **Security boundary** — optional token protection for workspace and internal
  API routes, with internal-only fields kept off public pages and feeds.

## Architecture & route boundary

The codebase is layered: bundled data (`src/data`) → workflow/business logic
(`src/lib`) → App Router pages and API routes (`src/app`) → shared UI
(`src/components`). Pages and API routes call workflow services rather than
reading storage directly.

Public, user-facing routes:

- `/`, `/technologies` (精选/全部快讯/按话题/我关注的 four views via `?view=`),
  `/technologies/[slug]`
- `/digest` (archive), `/digest/today`, `/digest/[date]`
- `/skills`, `/skills/[slug]`, `/knowledge`, `/knowledge/[slug]`
- `/network`
- `/topics/[tagId]` — topic hub (reached via tag chip links, not a nav entry)
- `/topics/[tagId]/feed.xml` — per-topic RSS feed of that topic's published
  technology signals (404 for unknown topics or topics with no published
  signals)
- `/search`
- `/feed.xml`, `/feed.json`
- `/news`, `/timeline`, `/radar` redirect to the matching `/technologies?view=`
- `POST /api/technologies/compare`, `POST /api/technologies/explain`, and
  `POST /api/technologies/learning-path` — public, unprotected by design
  (they only operate on already-published technology content); see
  [`docs/security-boundary.md`](docs/security-boundary.md) for the boundary
  reasoning.

Internal workspace / API routes (optionally token-protected):

- `/workspace/*`
- `/api/workspace/*`, `/api/candidates/*`
- legacy `/candidates/*` and `/technologies/drafts/*` (redirect to workspace)

Public pages must never call mutation APIs, import workspace action components,
or render internal-only fields (raw payloads, import status, normalized type,
duplicate internals, delivery endpoints, schedules, task-runner logs, workflow
events, or workspace tokens).

Optional workspace protection:

```bash
WORKSPACE_ACCESS_ENABLED=true
WORKSPACE_ACCESS_TOKEN=replace-with-a-strong-secret
```

The middleware accepts `Authorization: Bearer <token>`, a Basic-auth password,
or `x-workspace-access-token`. See [`docs/security-boundary.md`](docs/security-boundary.md)
and [`docs/deployment.md`](docs/deployment.md) for the full environment-variable
reference.

## Persistence

JSON is the default store. SQLite is an optional local driver:

```bash
# default
PERSISTENCE_DRIVER=json

# enable SQLite locally
npm run db:init
npm run db:migrate-json
PERSISTENCE_DRIVER=sqlite npm run dev
```

SQLite defaults to `config/ai-tech-radar.sqlite` (override with
`SQLITE_DATABASE_PATH`) and uses Node's built-in `node:sqlite`. The local JSON
store does **not** provide multi-writer locking, role-based permissions, or
production secret handling, and is intended for local development or controlled
single-operator use. See [`docs/persistence-plan.md`](docs/persistence-plan.md)
and [`docs/database-migration.md`](docs/database-migration.md).

## Local run

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

## Useful commands

```bash
npm run typecheck        # default verification
npm run build
npm run lint             # ESLint (next/core-web-vitals + next/typescript + prettier compat)
npm run lint:fix         # ESLint with autofix
npm run format:check     # Prettier check (no writes)
npm run format           # Prettier write
npm run sync:candidates  # refresh imported candidates from live sources

# persistence / task runner
npm run db:init
npm run db:migrate-json
npm run tasks:run-once

# per-subsystem validation scripts
npm run validate:candidates
npm run validate:publishing
npm run validate:sources
npm run validate:duplicates
npm run validate:quality
npm run validate:ranking
npm run validate:digest
npm run validate:delivery
npm run validate:delivery-integration
npm run validate:delivery-channels
npm run validate:scheduled-delivery
npm run validate:tasks
npm run validate:deployment
npm run validate:persistence
npm run validate:database
npm run validate:workflow-hardening
npm run validate:operations
npm run validate:content-intelligence
npm run validate:editorial-enrichment
npm run validate:llm-enrichment
npm run validate:prompt-quality
npm run validate:workspace-boundary
```

### Manual UI validation

```bash
npm run ui:check
```

This launches the locally installed Chromium browser, visits workspace and
user-facing routes, and writes screenshots plus route/CSS/overflow/internal-field
leak checks to `visual-qa-screenshots/`. It is a manual local step; sandbox runs
may fail to launch Chromium (`spawn EPERM`), which is an environment limitation,
not a project failure.

## Local state files

Runtime workflow state lives in `config/` as JSON (the default fallback store):
imported candidates, candidate review state, external sources, technology
workspace records, skill and knowledge workspace records, link relation
overrides, duplicate groups,
daily digests, delivery, scheduled delivery, scheduled import, scheduled
digest draft, task runner,
workflow events, editorial enrichment suggestions, and prompt versions. Set
`LOCAL_DATA_DIR` to point at a different local directory.

## Project structure

- `src/app` — App Router pages and API routes
- `src/components` — shared workspace and user-facing UI
- `src/data` — bundled mock technology/skill/knowledge/tag/relation and fallback
  import data
- `src/lib` — workflow services, importers, duplicate detection, ranking, digest
  and delivery logic, repositories, and localization helpers
- `src/types` — shared TypeScript models
- `scripts` — local workflow, sync, and validation scripts
- `config` — local runtime workflow state
- `docs` — architecture, data model, page structure, design system, and other
  per-topic notes

## Documentation

Start from [`AGENTS.md`](AGENTS.md) and [`CHANGELOG.md`](CHANGELOG.md), then the
relevant file under [`docs/`](docs/): `project-spec`, `architecture`,
`data-model`, `page-structure`, `design-system`, `security-boundary`,
`deployment`, `persistence-plan`, `database-migration`, `workflow-hardening`,
`content-intelligence`, `editorial-enrichment`, `llm-provider`, `prompt-quality`,
`operations`, `workspace-actions`, `editorial-round-playbook`, `decisions`,
`progress`, and `next-task`.

## Intentionally not implemented yet

AI black-box / personalized ranking and recommendation; login / accounts / RBAC;
production database integration and schema migrations; full admin platform;
external monitoring and alert routing; push / email subscription products and
production cron infrastructure; full-site i18n; semantic/AI duplicate detection
beyond the current deterministic rules; distributed scheduling, retry backoff,
and production secret storage; automatic translation APIs; and source deletion /
scheduling / health history / auth.
