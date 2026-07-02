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
- **User-facing Product** — a public home, readable technology list/detail
  pages (published records only), published Daily Digest pages, skills/knowledge
  pages that explain the signals, public RSS/JSON feeds, and content-level
  bilingual support.

> **Status:** working prototype, past the original foundation phase. For the full
> feature history see [`CHANGELOG.md`](CHANGELOG.md). For deep dives on any area
> see the [`docs/`](docs/) directory.

## Current capabilities

- **Ingestion** — real import for RSS / Atom, GitHub releases, and
  official-blog-style pages, with a local fallback layer, batch import, and
  source/candidate quality signals.
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
  `/network` renders the full graph in one view with click-to-focus
  exploration of any node's direct connections.
- **Compare two technologies (P3 v0)** — reader-triggered, live AI-generated
  comparison (similarities, differences, when to prefer each) between two
  published technologies on the technology detail page. Results are cached
  per technology pair and always shown with an "AI-generated, not reviewed"
  disclaimer; the first public-facing route that calls the LLM provider
  directly (`POST /api/technologies/compare`).
- **Daily Digest** — editorial workflow that generates, edits, previews, and
  publishes daily briefs, exposed publicly via `/digest/today`, `/digest/[date]`,
  `/feed.xml`, and `/feed.json`.
- **Delivery** — workspace-only webhook and Feishu channels, manual and
  scheduled sending of published digests, and a local cron/task runner.
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

- `/`, `/technologies`, `/technologies/[slug]`
- `/digest/today`, `/digest/[date]`
- `/skills`, `/skills/[slug]`, `/knowledge`, `/knowledge/[slug]`
- `/network`
- `/feed.xml`, `/feed.json`
- `POST /api/technologies/compare` — public, unprotected by design (it only
  operates on already-published technology content); see
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
workspace records, duplicate groups, daily digests, delivery, scheduled
delivery, task runner, workflow events, editorial enrichment suggestions, and
prompt versions. Set `LOCAL_DATA_DIR` to point at a different local directory.

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
`operations`, `workspace-actions`, `decisions`, `progress`, and `next-task`.

## Intentionally not implemented yet

AI black-box / personalized ranking and recommendation; login / accounts / RBAC;
production database integration and schema migrations; full admin platform;
external monitoring and alert routing; push / email subscription products and
production cron infrastructure; full-site i18n; semantic/AI duplicate detection
beyond the current deterministic rules; distributed scheduling, retry backoff,
and production secret storage; automatic translation APIs; and source deletion /
scheduling / health history / auth.
