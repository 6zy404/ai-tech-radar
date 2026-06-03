# AI Tech Radar Prototype

This repository is a local-first prototype for a high-impact new technology discovery and understanding platform.

The product is split into two subsystems:

- Internal Workspace
  - manage external source configuration
  - import real external items
  - review candidates
  - inspect duplicates
  - convert candidates into technology drafts
  - edit draft content and publication metadata
  - publish or archive internal technology records
- User-facing Product
  - explain the public discovery flow from the home page
  - display only formal `TechnologyItem` records
  - surface published Daily Digest pages as the primary "start here" reading path
  - provide readable technology list and detail pages
  - keep bilingual content support at the content level
  - connect technologies to related skills and knowledge pages that help readers understand the signals

## Current scope

What is implemented now:

- Next.js + TypeScript app foundation
- Core models for technologies, skills, knowledge, tags, relations, imported candidates, external sources, and workspace technology records
- Real external source import with local fallback:
  - RSS / Atom
  - GitHub releases
  - official blog style update pages
- External Source Management v0 with:
  - local JSON source configuration
  - source search and filters
  - create / edit source form
  - enable / disable controls
  - manual single-source import
  - batch import for enabled sources
  - source health status, import count, failure count, and latest message
  - source quality signals for stability, duplicate rate, conversion rate, and rejection rate
- `ImportedCandidate` review workflow with:
  - search
  - source type filter
  - normalized type filter
  - import status filter
  - duplicate hints
  - candidate quality flags for missing fields, duplicates, short content, and draft readiness
  - review actions
  - raw payload inspection
- Rule-based duplicate detection v0
- Candidate Duplicate Review v1 with:
  - persistent duplicate groups
  - explainable duplicate reasons
  - primary candidate selection
  - resolved / ignored group status
  - conversion guard for non-primary duplicate candidates
  - additional source references carried into generated technology drafts
- Candidate to technology draft conversion
- Ranking v0 priority triage:
  - rule-based `high_priority | watch | low_priority`
  - explainable reasons and warnings
  - workspace priority badges for candidates and technology records
  - user-facing priority labels without exposing score details
- Daily Digest Editorial Workflow v1:
  - generates a draft digest from published `TechnologyItem` records
  - uses Ranking v0 priority levels to split immediate attention vs watch items
  - supports editable title, generated summary, and editorial summary
  - supports manual add, exclude, pin, and simple ordering controls
  - preserves manual adjustments when a digest is regenerated
  - aggregates related skills, related knowledge, and public source names
  - supports workspace preview, publish readiness checks, and publish controls
  - exposes user-facing `/digest/today` and `/digest/[date]` pages after publication
- Digest Delivery Surface v0:
  - exposes published digests through `/feed.xml` and `/feed.json`
  - excludes draft and archived digests from public feeds
  - shows delivery status and share text preview in the workspace digest detail page
- Digest Delivery Integration v1:
  - adds workspace-only generic webhook and Feishu webhook delivery channels
  - supports JSON and text payload formats
  - allows manual send for published digests only
  - records delivery logs with success / failure / retry state
  - keeps endpoint URLs and delivery logs out of user-facing pages
- Scheduled Delivery v0:
  - adds workspace-only schedules for sending published digests to enabled channels
  - provides a local runner for due schedules and manual schedule runs
  - records schedule-level runs while preserving per-channel `DeliveryRun` logs
  - prevents same-day duplicate scheduled sends for the same schedule / digest / channel
- Real Cron / Task Runner v1:
  - adds command-line entry points for running due delivery schedules once or in a local watch loop
  - records task-runner audit summaries in local JSON
  - reuses the existing scheduled-delivery duplicate protection
  - keeps task-runner commands and logs inside the Internal Workspace only
- Deployment Readiness & Security Boundary v0:
  - defines public user-facing routes, internal workspace routes, and internal API routes
  - adds optional token protection for `/workspace/*`, `/api/workspace/*`, `/api/candidates/*`, and legacy internal redirects
  - documents environment variables, local JSON limits, and task-runner deployment options
  - adds `npm run validate:deployment` for route boundary, endpoint masking, local data, and client-build secret checks
- Persistence Migration Planning v0:
  - keeps the local JSON workflow intact while clarifying the future database migration path
  - centralizes local JSON file mechanics in `src/lib/repositories/local-json-store.ts`
  - confirms pages and API routes call workflow services instead of directly reading JSON files
  - documents object storage, internal/user-facing fields, future tables, indexes, and transaction needs
  - adds `npm run validate:persistence` for cross-object reference and public-data isolation checks
- Database Migration v0:
  - adds an optional SQLite persistence driver while keeping JSON as the default fallback
  - creates schema v0 for sources, import runs, candidates, duplicate groups, technology drafts, published technologies, knowledge, skills, digests, delivery, schedules, and task runs
  - adds `npm run db:init`, `npm run db:migrate-json`, `npm run db:reset`, and `npm run validate:database`
  - keeps database access behind repository/store helpers instead of exposing SQL in pages or API routes
  - preserves existing JSON files as migration input and backup
- Database-backed Workflow Hardening v1:
  - adds a workspace-only `WorkflowEvent` audit log for candidate conversion, duplicate resolution, draft publishing, digest publishing, delivery, schedules, task runner runs, and source import updates
  - strengthens conversion, publish, delivery, and scheduled-delivery guards so repeated or invalid operations return clear results instead of silently creating duplicate records
  - adds lightweight workflow event panels to workspace detail pages without exposing audit data to user-facing pages
  - adds `npm run validate:workflow-hardening` for atomicity guards, duplicate execution protection, audit logging, and public-field isolation
- Observability & Admin Operations v0:
  - adds `/workspace/operations` as an internal operations dashboard for system health, attention-required items, failures, quick links, and recent workflow activity
  - adds `/workspace/operations/events` as a filtered WorkflowEvent browser for internal audit and debugging
  - summarizes failed imports, failed deliveries, failed scheduled runs, task-runner status, digest status, open duplicates, and candidate quality issues
  - adds `npm run validate:operations` for operations summary, failure visibility, event lookup, workspace navigation, and public-field isolation checks
- Content Intelligence v1:
  - adds editable explanation fields to technology drafts, including why it matters, who should care, technical context, impact areas, learning path, related knowledge explanations, related skill explanations, follow-up questions, reading difficulty, and enrichment status
  - publishes those fields into safe user-facing `TechnologyItem` records
  - warns editors when explanation fields are missing without blocking historical content publication
  - improves `/technologies`, `/technologies/[slug]`, and Daily Digest pages with user-facing explanation modules
  - adds `npm run validate:content-intelligence` for persistence, publication, fallback, digest usage, and public-field isolation checks
- AI-assisted Editorial Enrichment v0:
  - adds workspace-only `EditorialEnrichmentSuggestion` records for rule-based, mock LLM, and optional LLM-assisted explanation drafts
  - adds a server-side LLM provider boundary with `mock` and `openai_compatible` providers
  - falls back to mock generation when no API key is configured
  - validates and sanitizes model output before any suggestion can be applied
  - lets editors generate, compare, apply, reject, and regenerate suggestions on `/workspace/technologies/[id]`
  - records generated / failed / applied / rejected / stale events in `WorkflowEvent`
  - keeps suggestions, source inputs, provider metadata, prompt metadata, token usage, generation errors, and reviewer notes out of user-facing pages
  - adds `npm run validate:editorial-enrichment`
  - adds `npm run validate:llm-enrichment`
- Prompt Quality & Editorial Review v1:
  - adds workspace-only `PromptVersion` records for editorial enrichment prompt templates and output schemas
  - records `promptVersionId` on every enrichment suggestion
  - lets editors review suggestion quality with score, labels, notes, rejection reason, and selected-field apply tracking
  - keeps multiple historical suggestions per draft and marks outdated draft suggestions stale instead of overwriting them
  - records prompt and suggestion review events in `WorkflowEvent`
  - adds `npm run validate:prompt-quality`
- Internal technology workspace with:
  - draft / published / archived status
  - source traceability back to the candidate
  - lightweight editing for title, summary, content, tags, related knowledge, related skills, source metadata, content intelligence fields, and editorial notes
  - Publish Quality Gate v0 before publication
  - user-facing preview before publication
  - publish controls
- User-facing technology list and detail pages that only consume published technology content
- User-facing Product IA & Discovery Flow v0:
  - turns `/` into a public product home with latest digest, priority signals, and Skills / Knowledge entry points
  - adds Daily Digest to the global public navigation
  - keeps Workspace as a secondary editorial entry point rather than the main public path
  - makes `/skills`, `/skills/[slug]`, `/knowledge`, and `/knowledge/[slug]` explain how skills and concepts connect to published technology signals
  - keeps public empty states pointed at public routes rather than workspace operations
- Technology bilingual content support for:
  - title
  - summary
  - content
- Design System v0 for separating:
  - Internal Workspace page templates
  - User-facing Product page templates
- Workspace Navigation & Information Architecture v0 with:
  - `/workspace` as the internal dashboard
  - workflow overview for Sources -> Import -> Candidates -> Duplicates -> Drafts -> Publish -> Digests
  - shared workspace module navigation on every `/workspace/*` page
  - breadcrumbs on workspace detail and preview pages
  - visible entry points for sources, candidates, duplicates, drafts, and digests
- Workspace Boundary & Action Clarity v0 with:
  - the global navigation entry treated as a secondary editorial workspace entry
  - `/workspace` positioned as an internal editorial dashboard, not a public page
  - explicit public / workspace / internal API route boundaries
  - result-oriented workspace action labels
  - confirmation prompts for destructive, external-send, regeneration, retry, and overwrite actions
  - disabled and empty-state helper text for common workspace prerequisites

## Real source coverage

Current live source instances:

- OpenAI News RSS
- GitHub Releases Atom for `modelcontextprotocol/typescript-sdk`
- GitHub Releases API for `modelcontextprotocol/typescript-sdk`
- Anthropic News pages

The project keeps a local fallback candidate layer so it can still run even when live refresh is unavailable.

## External Source Management v0

Source management is an Internal Workspace feature only.

Routes:

- `/workspace/sources`
- `/workspace/sources/new`
- `/workspace/sources/[id]`

Current source fields:

- `id`
- `name`
- `type`: `rss | atom | github_release | official_blog`
- `url`
- `enabled`
- `description`
- `language`
- `publisherName`
- `publisherType`
- `defaultTags`
- `defaultNormalizedType`
- `lastFetchedAt`
- `lastImportStatus`: `never_run | success | failed | partial`
- `lastImportMessage`
- `lastImportCount`
- `lastErrorMessage`
- `consecutiveFailureCount`
- `totalImportedCount`
- `lastSuccessfulImportAt`
- `createdAt`
- `updatedAt`

Editors can create or edit a source, enable or disable it, manually run import for a single source, or run `Import enabled sources` from `/workspace/sources`.

Batch Import v0 runs each enabled source independently. Disabled sources are skipped. A single failed source records `failed` or `partial` health state and does not stop the rest of the batch. The latest batch summary records total sources, enabled sources, skipped disabled sources, success / partial / failed counts, newly created candidates, and skipped duplicate or existing candidates.

Imported candidates keep `sourceId`, `sourceName`, `sourceType`, `sourceUrl`, `importedAt`, and `importRunId` when available so reviewers can trace a candidate back to the source detail page and the batch import run that produced it.

If a live import fails, the UI records a readable failure or partial-fallback message instead of crashing. The workflow still uses local JSON files and does not add a database.

## Database Migration v0

The default persistence mode remains JSON:

```bash
PERSISTENCE_DRIVER=json
```

SQLite can be enabled locally after initialization and migration:

```bash
npm run db:init
npm run db:migrate-json
PERSISTENCE_DRIVER=sqlite npm run dev
```

SQLite defaults to `config/ai-tech-radar.sqlite` and can be overridden with `SQLITE_DATABASE_PATH`.

This v0 uses Node's built-in `node:sqlite` module to avoid adding a heavy ORM. It creates database tables for the current workflow objects, stores full domain records as JSON payloads plus key indexed columns, and keeps the workflow/service layer stable.

See [`docs/database-migration.md`](docs/database-migration.md), [`docs/persistence-plan.md`](docs/persistence-plan.md), and [`docs/workflow-hardening.md`](docs/workflow-hardening.md) for schema, migration, driver switching, workflow audit events, and remaining production gaps.

## Content Intelligence v1

Content Intelligence is the user understanding layer on top of published technologies. It is edited in the Internal Workspace and displayed on user-facing technology and digest pages.

It adds fields such as `whyItMatters`, `whoShouldCare`, `technicalContext`, `impactAreas`, `learningPath`, related knowledge / skill explanations, `followUpQuestions`, `readingDifficulty`, and `intelligenceStatus`.

This is different from Ranking v0. Ranking decides priority level; Content Intelligence explains meaning, audience, context, and next steps. It is also different from Candidate Quality Signals, which are internal review checks for imported data completeness.

See [`docs/content-intelligence.md`](docs/content-intelligence.md) for field definitions, publish warnings, page behavior, and later work.

## AI-assisted Editorial Enrichment v0

Editorial Enrichment is a workspace-only assistant layer for Content Intelligence. It creates rule-based, mock LLM, or optional LLM-assisted suggestions for `whyItMatters`, audience, technical context, impact areas, learning path, related knowledge / skill explanations, follow-up questions, and reading difficulty.

By default it does not require an external API key. `rule_based` uses deterministic local templates, `mock_llm` uses a local mock provider, and `llm_assisted` calls an OpenAI-compatible provider only when `LLM_PROVIDER=openai_compatible` and `LLM_API_KEY` are configured. Without a key, `llm_assisted` safely falls back to `mock_llm`.

Editors explicitly review suggestions in `/workspace/technologies/[id]`; applying a suggestion writes selected generated fields into the draft only and does not publish content. Rejecting keeps reviewer notes for workspace audit. Regenerating keeps old suggestions and marks older draft suggestions `stale` when source inputs changed. Invalid JSON or unsafe provider output is stored as a failed suggestion with `generationError` and cannot be applied.

Publish Quality Gate warns when no enrichment suggestion exists or when the latest suggestion is still unreviewed. User-facing pages never render `EditorialEnrichmentSuggestion`, `generationMode`, `sourceInputs`, suggestion status, reviewer notes, provider name, model name, prompt version, token usage, or generation errors.

See [`docs/editorial-enrichment.md`](docs/editorial-enrichment.md) and [`docs/llm-provider.md`](docs/llm-provider.md) for the data structure, provider boundary, output validation, and workflow.

## Prompt Quality & Editorial Review v1

Prompt Quality adds a review loop around Editorial Enrichment suggestions. The active `PromptVersion` is used during generation, each suggestion stores `promptVersionId`, and editors can record `reviewStatus`, `qualityScore`, `qualityLabels`, reviewer notes, rejection reason, and the fields that were applied.

This is internal editorial tooling. It does not publish generated content automatically, does not rank technologies, and does not expose prompt or review metadata to user-facing pages.

See [`docs/prompt-quality.md`](docs/prompt-quality.md) for the prompt version structure, review fields, apply/reject behavior, WorkflowEvent actions, validation command, and later work.

## Source Quality + Candidate Quality Signals v0

Quality signals are Internal Workspace helpers only. They are not impact ranking and they do not affect user-facing ordering.

Source quality is computed from local source state, recent import runs, and linked candidates:

- import success rate
- total / successful / failed import runs
- total linked candidates
- converted candidate count and conversion rate
- rejected candidate count and rejection rate
- duplicate candidate count and duplicate rate
- consecutive failure count
- last successful import time
- `qualityLevel`: `good | watch | poor | unknown`

Candidate quality is computed from each `ImportedCandidate`:

- missing summary
- missing content
- missing publisher
- invalid source URL
- invalid publish date
- missing tags
- possible duplicate
- too short
- ready for review
- conversion blocked

These signals appear in `/workspace/sources`, `/workspace/sources/[id]`, and `/workspace/candidates`. They are intentionally excluded from user-facing technology pages.

## Ranking v0

Ranking v0 is a deterministic priority triage layer. It is not personalization, recommendation, or AI scoring.

Priority levels:

- `high_priority`: immediate attention
- `watch`: worth tracking
- `low_priority`: good to know

Each ranking result contains:

- `priorityLevel`
- `priorityScore`
- `priorityReasons`
- `priorityWarnings`
- `rankingUpdatedAt`
- `rankingSource`: `rule_based | manual_override`

Current rule-based inputs:

- source quality level, success rate, duplicate rate, conversion rate, and rejection rate
- candidate quality flags such as missing content, invalid URL, possible duplicate, and ready-for-review
- duplicate group state and additional source references
- content completeness for title, summary, content, tags, related knowledge, and related skills
- recency from publish date or import date
- publisher and source metadata

Workspace pages show priority level, reasons, warnings, and ranking source. User-facing technology pages show only a productized priority label such as “立即关注 / 值得跟踪 / 可以了解” plus a short why-watch summary. They do not show quality flags, source quality metrics, duplicate internals, or raw scoring details.

## Daily Digest Editorial Workflow v1

Daily Digest creates a daily reading brief from published `TechnologyItem` records. It is not push delivery, email subscription, personalization, or AI summarization.

Routes:

- `/workspace/digests`
- `/workspace/digests/[date]`
- `/workspace/digests/[date]/preview`
- `/digest/today`
- `/digest/[date]`
- `/feed.xml`
- `/feed.json`

Digest records use:

- `status`: `draft | published | archived`
- `title`
- `summary`
- `editorialSummary`
- `highPriorityTechnologyIds`
- `watchTechnologyIds`
- `manuallyAddedTechnologyIds`
- `excludedTechnologyIds`
- `pinnedTechnologyIds`
- `orderedTechnologyIds`
- `skillIds`
- `knowledgeIds`
- `sourceNames`
- `generatedAt`
- `updatedAt`
- `lastRegeneratedAt`
- `publishedAt`
- `editorialNotes`

Generation rules:

- read only published `TechnologyItem` records
- evaluate each item with Ranking v0
- put `high_priority` items into the immediate-attention section
- put `watch` items into the worth-tracking section
- exclude `low_priority` items by default unless an editor manually adds them
- keep manually excluded items out even if they still qualify during regeneration
- show pinned items first
- put `high_priority` items into “今日立即关注”
- put `watch` items into “值得跟踪”
- exclude `low_priority` items by default
- aggregate related skills and knowledge from selected technology items
- aggregate source names from selected technology items

Regenerate behavior:

- if a digest has no manual edits, regeneration refreshes the generated sections normally
- if a digest has manual edits, regeneration preserves `editorialSummary`, manual additions, exclusions, pins, and order
- regeneration never publishes a digest automatically

Digest publish readiness blocking errors:

- missing title or invalid date
- no selected technology items
- referenced technology item does not exist or is not published
- duplicate technology references in the digest
- selected technology item is missing user-facing fields needed by the public digest

Digest publish readiness warnings:

- no high-priority items
- no related skills
- no related knowledge
- missing editorial summary
- no source names
- unusually low or high watch-item count

Workspace pages show editable copy, generated sections, manual item controls, readiness checks, ranking reasons, digest status, and publish controls. User-facing digest pages show only public technology summaries, why-watch copy, related skills, related knowledge, and public source names. Draft and archived digests are not publicly available.

`npm run validate:digest` verifies digest generation, editing, manual include/exclude/order controls, regenerate preservation, publish readiness blocking, published date lookup, draft digest isolation, and internal-field isolation.

## Digest Delivery Surface v0

Digest delivery is a low-risk public distribution surface for already published digests. It is not email delivery, a bot integration, push notification, subscription management, or personalization.

Public delivery routes:

- `/feed.xml`: RSS feed generated from published digest records
- `/feed.json`: JSON Feed generated from published digest records

Feed rules:

- only `published` digests are included
- `draft` and `archived` digests are excluded
- feed items link to `/digest/[date]`
- feed content is generated from published `TechnologyItem` records and public digest copy
- feed output does not include raw payloads, import status, normalized type, duplicate group fields, quality flags, workspace notes, manual adjustment IDs, or ranking scores

Workspace delivery status lives on `/workspace/digests/[date]`. Published digests show the public digest URL, RSS feed URL, JSON feed URL, last updated time, and a read-only share text preview for manual posting. Draft digests show a workspace-only status and do not show misleading public links.

`npm run validate:delivery` verifies published-only feed filtering, draft / archived exclusion, internal-field isolation, latest-published digest lookup, share text safety, and valid feed item links.

## Digest Delivery Integration v1 + Channel Expansion v1

Digest Delivery Integration v1 is a workspace-only sending layer for already published daily digests. Channel Expansion v1 keeps the generic webhook path and adds a Feishu bot webhook adapter. It is not a subscription system, email product, push notification system, scheduler, or account-based delivery product.

Routes:

- `/workspace/delivery`: manage delivery channels and delivery logs
- `/workspace/digests/[date]`: preview and manually send a published digest to an enabled channel

Delivery channel fields:

- `id`
- `name`
- `type`: `webhook | feishu_webhook`; `email | telegram | discord` are reserved only
- `enabled`
- `endpointUrl`
- `description`
- `format`: `json | text`
- `lastDeliveredAt`
- `lastDeliveryStatus`: `pending | success | failed`
- `lastDeliveryMessage`
- `createdAt`
- `updatedAt`

Each send creates a `DeliveryRun` log with digest date, channel, channel type, status, request payload preview, response status, response body preview, error message, and optional retry linkage. Endpoint URLs are masked in workspace lists and are never rendered on user-facing digest pages. Delivery logs do not store the complete endpoint URL.

Adapter and payload rules:

- only `published` digests can be sent
- draft and archived digests are blocked
- payload content comes from the published digest and published `TechnologyItem` records
- generic webhook JSON payloads include digest title, summary, public digest URL, high-priority items, watch items, related skills, related knowledge, sources, generated time, and delivered time
- generic webhook text payloads reuse the public share text preview
- Feishu webhook sends a Feishu bot text message: `msg_type = text` with digest title, date, top 3 immediate-attention items, top 3 watch items, and public digest URL
- payloads and public pages do not expose raw payloads, import status, normalized type, duplicate group fields, quality flags, workspace notes, endpoint URLs, or delivery logs

Local validation can use `mock://success` and `mock://failed` channels without calling an external network endpoint. Real webhook and Feishu webhook endpoints are sent with HTTP POST. Do not store real production webhook secrets in the local JSON workflow; production should move endpoint secrets to a secure secret store.

`npm run validate:delivery-integration` verifies channel creation, disabled-channel blocking, draft / archived digest blocking, successful and failed sends, retry log linkage, payload safety, endpoint masking, and public-feed isolation.
`npm run validate:delivery-channels` verifies generic webhook compatibility, Feishu payload shape, disabled / draft blocking, Feishu mock send success, failed Feishu logs, retry linkage, endpoint masking, and user-facing isolation.

## Scheduled Delivery v0

Scheduled Delivery v0 is a local, auditable runner for already published digests. It is not a production cron platform, subscription system, email product, account-based delivery system, or retry scheduler.

Routes:

- `/workspace/delivery/schedules`: manage delivery schedules, run due schedules, and inspect schedule run results
- `/workspace/delivery`: manage destination channels and per-channel delivery logs

Scheduled delivery fields:

- `id`
- `name`
- `enabled`
- `digestTarget`: `latest_published_digest | digest_by_date`
- `digestDate`
- `channelIds`
- `scheduleTime`: simple `HH:mm`
- `timezone`: defaults to `Asia/Shanghai`
- `lastRunAt`
- `nextRunAt`
- `lastRunStatus`: `never_run | success | failed | partial`
- `lastRunMessage`
- `createdAt`
- `updatedAt`

Run rules:

- schedules only decide when to send
- delivery channels decide where to send
- daily digests decide what content is sent
- `DeliveryRun` remains the per-channel send log
- `ScheduledDeliveryRun` groups one schedule execution across channels
- disabled schedules do not run
- disabled channels are skipped
- only `published` digests can be sent
- a single channel failure does not stop the remaining channels
- scheduled runs skip the same schedule / digest / channel on the same local day; manual runs are explicit force runs for validation or operator action

`npm run validate:scheduled-delivery` verifies schedule creation, disabled schedule blocking, published-only digest sending, disabled-channel skipping, channel failure isolation, schedule run persistence, per-channel delivery log creation, duplicate scheduled send protection, manual runs, and user-facing isolation.

## Real Cron / Task Runner v1

Task Runner v1 turns Scheduled Delivery from a manually callable workflow into a local command-line runner. It is still not a production cron platform, subscription system, distributed scheduler, or account-based notification product.

Commands:

- `npm run tasks:run-once`: runs all schedules that are currently due, writes `ScheduledDeliveryRun` and `DeliveryRun` records, writes a `TaskRunnerRun` summary, logs the result, and exits.
- `npm run tasks:watch`: runs the same due-schedule check in a local loop. The default interval is 60 seconds. It can be changed with `TASK_RUNNER_INTERVAL_SECONDS=30` or `npm run tasks:watch -- --interval=30`.

Runner behavior:

- disabled schedules are skipped
- schedules with future `nextRunAt` are skipped
- only published digests can be sent
- disabled channels are skipped by the scheduled-delivery layer
- a failed schedule or channel does not crash the whole runner
- terminal logs include due count, skipped count, success / failed / partial counts, delivery logs created, and start / finish timestamps
- terminal logs and stored runner messages sanitize URLs and token-like values
- repeated scheduled runs keep the same schedule / digest / channel from being sent more than once on the same local day

The workspace page `/workspace/delivery/schedules` shows the local runner commands and the latest recorded task-runner result. A production deployment should call `npm run tasks:run-once` from system cron, PM2, GitHub Actions, or a platform scheduler, but that production scheduler is intentionally outside this prototype.

`npm run validate:tasks` verifies run-once behavior, no-due-schedule exits, disabled schedule and channel skipping, no-published-digest handling, delivery failure tolerance, watch-loop simulation, duplicate protection, log sanitization, and user-facing isolation.

## Deployment Readiness & Security Boundary v0

Deployment readiness keeps the local-first prototype safe enough for controlled environments without adding a full account system or database.

Public routes:

- `/`
- `/technologies`
- `/technologies/[slug]`
- `/digest/today`
- `/digest/[date]`
- `/feed.xml`
- `/feed.json`

Internal workspace/API routes:

- `/workspace/*`
- `/api/workspace/*`
- `/api/candidates/*`
- legacy `/candidates/*`
- legacy `/technologies/drafts/*`

Optional workspace protection:

```bash
WORKSPACE_ACCESS_ENABLED=true
WORKSPACE_ACCESS_TOKEN=replace-with-a-strong-secret
```

The middleware accepts `Authorization: Bearer <token>`, Basic auth password, or `x-workspace-access-token`. User-facing pages remain public and must not render internal fields, delivery endpoints, schedules, task-runner logs, or workspace tokens.

Environment variables are documented in `.env.example`, [`docs/deployment.md`](docs/deployment.md), [`docs/security-boundary.md`](docs/security-boundary.md), and [`docs/llm-provider.md`](docs/llm-provider.md). The important deployment variables are `NEXT_PUBLIC_SITE_URL`, `LOCAL_DATA_DIR`, `TASK_RUNNER_INTERVAL_SECONDS`, `WORKSPACE_ACCESS_ENABLED`, and `WORKSPACE_ACCESS_TOKEN`. Optional server-side LLM enrichment variables are `LLM_PROVIDER`, `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`, and `LLM_TIMEOUT_MS`.

The current local JSON workflow is suitable for local development and controlled single-operator deployments. It is not a multi-user production database and should not store production webhook secrets.

`npm run validate:deployment` verifies the access helper behavior, protected/public route split, task-runner scripts, local JSON write access, endpoint masking, public feed isolation, and client-build secret isolation.

## Workflow summary

1. Source configuration
2. External source
3. Imported raw payload
4. `ImportedCandidate`
5. review + duplicate inspection
6. resolve duplicate groups and choose a primary candidate when needed
7. convert to technology draft
8. edit and enrich the internal workspace record
9. compute rule-based priority
10. run Publish Quality Gate v0 and preview
11. publish
12. generate Daily Digest draft from published technology items
13. edit, validate, preview, and publish digest
14. expose published digest through public RSS / JSON feeds
15. optionally send published digest manually to enabled webhook or Feishu webhook channels
16. optionally run scheduled delivery for published digests through enabled channels
17. optionally invoke due schedules through the local task runner
18. inspect internal operations health and WorkflowEvent activity
19. user-facing technology list, detail, and digest pages

## Workspace Navigation & Information Architecture v0

`/workspace` is the Internal Editorial Workspace Dashboard. It is the starting point for reviewers and editors, not a public content page.

The dashboard shows:

- an internal workflow explanation
- status counts for enabled sources, new candidates, open duplicate groups, drafts, published technologies, and digest drafts
- a clickable workflow overview: Sources -> Import -> Candidates -> Duplicates -> Drafts -> Publish -> Digests -> Delivery -> Schedules -> Operations
- a small set of primary action cards for importing enabled sources, reviewing candidates, resolving duplicates, editing drafts, managing digests, and opening operations
- a compact operations summary with system health, attention-required count, failed deliveries, failed sources, and latest task-runner state
- recent activity based only on local import, technology workspace, digest, and delivery records

Every workspace route uses a workspace-only second-level navigation:

- Overview: `/workspace`
- Sources: `/workspace/sources`
- Candidates: `/workspace/candidates`
- Duplicates: `/workspace/duplicates`
- Drafts: `/workspace/technologies`
- Digests: `/workspace/digests`
- Delivery: `/workspace/delivery`
- Schedules: `/workspace/delivery/schedules`
- Operations: `/workspace/operations`

Workspace detail and preview routes also show breadcrumbs such as `Workspace / Sources / Source detail`. This keeps internal modules connected without exposing workspace navigation to user-facing routes.

Workspace action rules are documented in [`docs/workspace-actions.md`](docs/workspace-actions.md). The short version:

- primary actions should be limited to one or two per page or panel
- button labels describe the result, for example `Run source import`, `Save draft edits`, `Convert to technology draft`, or `Send to selected channel`
- destructive actions such as reject, archive, disable, and exclude require confirmation
- external sends, delivery retries, digest regeneration, and enrichment suggestion overwrites require confirmation
- disabled buttons should explain the prerequisite instead of silently doing nothing

## Candidate Duplicate Review v1

Duplicate review is an Internal Workspace workflow only.

Routes:

- `/workspace/duplicates`
- `/workspace/duplicates/[id]`

Duplicate detection is deterministic and explainable. Current reasons:

- `same_source_url`
- `similar_title`
- `same_publisher_near_date`
- `same_repo_release_family`
- `same_canonical_url`

Each `DuplicateGroup` stores `candidateIds`, a `primaryCandidateId`, `status`, reasons, and timestamps. Status values are:

- `open`: needs reviewer attention
- `resolved`: reviewer selected the primary candidate
- `ignored`: reviewer marked the group as a false positive

When a resolved group is converted, only the primary candidate can generate the `TechnologyWorkspaceRecord`. Non-primary candidates are blocked from generating separate drafts. Their source information is retained as `sourceReferences` on the draft so the final record can keep traceability without duplicating user-facing content.

## Publish Quality Gate v0

Before a `TechnologyWorkspaceRecord` can move to `published`, the workspace runs deterministic readiness checks.

Blocking errors stop publication:

- missing title, summary, slug, source name, source URL, publish date, or content
- invalid source URL
- invalid publish date
- duplicate slug
- invalid enum-like fields needed by the user-facing technology pages

Required publish fields for the user-facing technology pages:

- localized `title`, `summary`, and `content` with at least `original` or `zh`
- unique `slug`
- valid `sourceName`, `sourceUrl`, and `publishDate`
- valid `type`, `sourceLanguage`, `translationStatus`, `publisherType`, `importanceLevel`, and `status`

Warnings do not stop publication, but they are shown to the editor:

- English-source record without Chinese title and summary
- too few tags
- missing related knowledge
- missing related skills
- missing publisher name
- short summary
- short content
- empty editorial notes
- missing `whyItMatters`
- missing `whoShouldCare`
- missing related knowledge explanations
- missing related skill explanations
- missing learning path
- missing follow-up questions

The workspace preview route lets editors inspect the draft through the user-facing technology detail renderer without publishing it:

- `/workspace/technologies/[id]/preview`

`npm run validate:publishing` exercises the local publishing workflow without adding a test framework. It verifies blocked incomplete drafts, duplicate slugs, warning-only publishing, user-facing list/detail lookup, internal-field isolation, and bilingual fallback.

## Observability & Admin Operations v0

Operations is an Internal Workspace feature for maintainers. It is not an external monitoring platform and it does not appear in the user-facing product.

Routes:

- `/workspace/operations`: system health summary, attention-required items, failed imports, failed deliveries, failed scheduled runs, quick links, and recent WorkflowEvent activity
- `/workspace/operations/events`: filtered WorkflowEvent browser with entity type, action, actor type, timestamp, metadata, and sanitized before/after snapshots

Health status is deterministic:

- `healthy`: recent import, delivery, task-runner, schedule, duplicate, and quality signals show no current attention items
- `warning`: limited failures or review work exists, such as failed deliveries, partial imports, open duplicate groups, or candidate quality issues
- `critical`: task runner failure, failed scheduled run, failed source import, consecutive source failures, or publish-failure workflow events need immediate attention
- `unknown`: there is not enough operational history to judge

Attention-required items are generated from local workflow data: failed source imports, consecutive source failures, failed deliveries, failed scheduled runs, open duplicate groups, candidate quality blocking issues, failed workflow events, and latest failed task-runner runs.

Operations pages sanitize endpoint-like and token-like values before display. User-facing pages and feeds must never show operations summaries, WorkflowEvent records, delivery logs, task-runner records, endpoint URLs, or workspace tokens.

`npm run validate:operations` checks operations metrics, failed import/delivery/schedule visibility, WorkflowEvent lookup, endpoint sanitization, workspace navigation, route presence, and public-field isolation.

Current route split:

- Internal Workspace
  - `/workspace`
  - `/workspace/candidates`
  - `/workspace/candidates/[id]`
  - `/workspace/technologies`
  - `/workspace/technologies/[id]`
  - `/workspace/digests`
  - `/workspace/digests/[date]`
- User-facing Product
  - `/`
  - `/technologies`
  - `/technologies/[slug]`
  - `/digest/today`
  - `/digest/[date]`
  - `/skills`
  - `/skills/[slug]`
  - `/knowledge`
  - `/knowledge/[slug]`

Internal mutation APIs:

- `/api/workspace/*`
- `/api/candidates/*`

Public pages must not call these mutation APIs and must not import workspace
action components. Public feeds are limited to `/feed.xml` and `/feed.json`.

Legacy `/candidates` and `/technologies/drafts` routes now redirect to the internal workspace routes.

## Design System v0

The UI is split into two page families so the product does not feel like one repeated card stack.

Internal Workspace pages use `WorkspacePageShell` and workspace-oriented record layouts. They prioritize review, filtering, status, source health, publish readiness, and operational actions.

User-facing Product pages use `UserPageShell` and article/content layouts. They prioritize reading, bilingual technology content, source links, tags, and related knowledge / skills.

Design System v0 now uses a shared `PageHeader` primitive with different workspace and user-facing variants. Workspace list pages use denser operational records and explicit status badges. User-facing technology detail pages skip the generic page header so the article hero is the first meaningful reading block.

Current templates are documented in [`docs/design-system.md`](docs/design-system.md):

- Workspace List Page
- Workspace Detail Page
- Product Home Page
- User-facing Technology List Page
- User-facing Technology Detail Page
- User-facing Digest Page
- User-facing Skill / Knowledge Index Page
- User-facing Skill / Knowledge Detail Page

Internal-only fields such as `rawPayload`, `importStatus`, `normalizedType`, and `duplicateGroupId` remain limited to workspace pages.

## Bilingual support

Current bilingual support covers `TechnologyItem` content only.

- localized fields:
  - `title`
  - `summary`
  - `content`
- structure:
  - `original`
  - `zh`
  - `en` when useful
- user-facing behavior:
  - prefer Chinese when it exists
  - fall back to original when Chinese is missing
  - keep the original source link visible

This does not introduce route-based i18n or full-site internationalization.

## Local run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Useful commands

```bash
npm run typecheck
npm run build
npm run sync:candidates
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
npm run db:init
npm run db:migrate-json
npm run tasks:run-once
```

## Manual UI validation

Playwright UI checking is intentionally a manual local validation step in this environment:

```powershell
npm run ui:check
```

The script launches the locally installed Chromium browser, visits the workspace and user-facing routes, writes screenshots to `visual-qa-screenshots/`, and writes route status, CSS stylesheet status, horizontal overflow checks, shell detection, and internal-field leak checks to `visual-qa-screenshots/ui-check-results.json`.

Codex sandbox runs can fail to launch Chromium with `spawn EPERM`. That is a sandbox permission limitation, not a project validation failure. When that happens, mark Playwright as `manual validation required` / `manual validation pending` and run the command from the local PowerShell terminal instead. Do not report Playwright as passed unless the local script completed successfully.

## Local state files

Runtime workflow state is stored in `config/`:

- `imported-candidates.live.json`
- `candidate-review-state.json`
- `external-sources.json`
- `technology-workspace.json`
- `duplicate-groups.json`
- `daily-digests.json`
- `delivery.json`
- `scheduled-delivery.json`
- `task-runner.json`
- `workflow-events.json`
- `editorial-enrichment-suggestions.json`
- `prompt-versions.json`

These files are local-only and remain the default fallback store.

Set `LOCAL_DATA_DIR` to point the workflow at a different local data directory. Use this only in controlled environments; the local JSON store does not provide multi-writer locking, role-based permissions, or production secret handling.

The current persistence boundary is documented in [`docs/persistence-plan.md`](docs/persistence-plan.md), with workflow hardening details in [`docs/workflow-hardening.md`](docs/workflow-hardening.md). Local JSON read/write mechanics are centralized in `src/lib/repositories/local-json-store.ts`; SQLite v0 lives in `src/lib/repositories/sqlite-store.ts`. Workflow modules own business state transitions, `workflow-events.json` / `workflow_events` records low-weight audit events, and `editorial-enrichment-suggestions.json` / `editorial_enrichment_suggestions` stores workspace-only enrichment suggestions. Future Postgres/Supabase work should replace repository implementations first instead of rewriting pages.

## What is intentionally not implemented yet

- AI black-box ranking
- personalized recommendation
- impact scoring
- recommendation system
- push notification
- login / user account system
- production database integration
- full admin platform
- full-site i18n
- AI-based or semantic duplicate detection beyond the current deterministic rules
- advanced ranking models beyond deterministic v0 rules
- push, email subscription, production cron service, AI digest writing, and personalized digest logic
- distributed scheduling, retry backoff policy, worker supervision, and production secret storage
- production login, RBAC, database migration, CSRF strategy, and secret manager integration
- production database schema migrations, ORM selection, and full cross-workflow transaction implementation
- external monitoring integration, alert routing, event retention policy, and operations recovery tooling
- automatic translation APIs
- scheduled background sync and advanced source management UI
- source deletion, source scheduling, source health history, and source auth
- advanced editorial approval flows beyond the current draft editor
- deeper content quality checks beyond deterministic publish readiness rules

## Project structure

- `src/app`
  - App Router pages and API routes
- `src/components`
  - shared UI for workspace and user-facing pages
- `src/data`
  - bundled mock technology, skill, knowledge, tag, relation, and fallback import data
- `src/lib`
  - content helpers, importer logic, duplicate detection, digest workflow state, ranking, and localization helpers
- `src/types`
  - shared TypeScript models
- `scripts`
  - local workflow scripts for syncing and validating imported candidates
- `config`
  - local runtime workflow state
- `docs`
  - architecture, data model, page structure, and design system notes
