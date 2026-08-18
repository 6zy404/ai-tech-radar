# Architecture Overview

## System split

This project is intentionally split into two subsystems.

### Internal Workspace

Used by reviewers, editors, or operators.

Responsibilities:

- inspect imported external data
- manage external source configuration
- review `ImportedCandidate` records
- inspect duplicate hints
- move candidate status through `new / reviewed / converted / rejected`
- convert candidates into technology drafts
- edit technology draft content and publication metadata
- run publish readiness checks and preview user-facing output
- publish or archive internal technology records
- inspect raw payload and normalized fields

### User-facing Product

Used by end users.

Responsibilities:

- display formal `TechnologyItem` content only on the curated tier
- offer an auto-aggregated news fast lane (the 全部快讯 view on
  `/technologies?view=news`) rendered through a dedicated sanitizing map
  (`src/lib/news.ts`) and always labelled as unedited aggregation — the
  deliberate two-tier exception to "candidates are workspace-only" (see
  `docs/security-boundary.md` → "News Fast Lane Boundary")
- provide readable technology list and detail pages
- show title, summary, content, source, tags, related skills, and related knowledge
- prefer Chinese content when translation exists
- preserve access to the original source

## Why the split matters

The imported candidate layer is noisy by design:

- it can contain raw payloads
- fields can be missing
- source formats vary
- duplicates are common

That is acceptable inside the Internal Workspace. It is not acceptable in the user-facing product.

The user-facing product should only consume formal published technology records.

## Lifecycle

The current lifecycle is:

1. source configuration
2. external source
3. imported raw payload
4. `ImportedCandidate`
5. review + duplicate group resolution
6. convert the primary candidate to `TechnologyWorkspaceRecord` with `status = draft`
7. editorial follow-up and draft editing
8. Publish Quality Gate v0 and user-facing preview
9. publish to `status = published`
10. generate a Daily Digest draft from published technology items
11. preview and publish the digest
12. generate public RSS / JSON feed surfaces from published digests
13. optionally send published digests manually to workspace-configured webhook or Feishu webhook channels
14. optionally run local scheduled delivery for published digests through enabled channels
15. optionally execute due schedules through the local task runner
16. enforce deployment route boundaries for workspace/API access
17. inspect internal operations health and workflow events
18. user-facing technology list, detail, digest, and feed routes

Archived records stay in the workspace but are excluded from the main user-facing feed.

Source configuration is managed through `/workspace/sources`.

## Workspace information architecture v0

`/workspace` is the Internal Editorial Workspace Dashboard and the single entry
point for operational work. It is not a public product page.

It summarizes the full local workflow:

1. Sources
2. Import
3. Candidates
4. Duplicates
5. Drafts
6. Publish
7. Digests
8. Delivery
9. Schedules
10. Operations

Each step links to the responsible workspace module. The dashboard also shows real local status counts for enabled sources, new candidates, open duplicate groups, draft technology records, published technology records, and digest drafts.

All `/workspace/*` pages share a workspace-only second-level navigation:

- Overview
- Editorial round (`/workspace/editorial-round`) — orchestration console that
  collapses the recurring editorial-round loop (candidates → publish → digest →
  verify) onto one page; pure read state (`getEditorialRoundState` in
  `src/lib/editorial-round.ts`) with inline actions that reuse the existing
  candidate/technology/digest API routes (no editor duplicated). See
  `docs/editorial-round-playbook.md` for the underlying step-by-step flow.
- Sources
- Candidates
- Duplicates
- Drafts
- Skills
- Knowledge
- Digests
- Delivery
- Schedules
- Operations

Skills and Knowledge are the content consoles added by Skill/Knowledge
workspace editing v0: they manage the skill / knowledge pools (new entries
plus copy-on-write overrides of the `src/data` seeds) with a
draft/published status flow and a minimal publish gate; drafts never reach
public pages.

Workspace detail and preview pages also show breadcrumbs so editors can return to the correct module list. This navigation is intentionally not rendered on user-facing pages such as `/technologies`, `/technologies/[slug]`, `/digest/today`, or `/digest/[date]`.

Workspace action copy follows `docs/workspace-actions.md`. Primary actions are
limited, result-oriented, and close to the affected workflow object. Destructive
actions, external sends, retry sends, digest regeneration, and suggestion
overwrites require confirmation. Disabled actions should explain their missing
prerequisite instead of silently doing nothing.

Route and API boundaries:

- Public routes: `/`, `/technologies` (also hosts the news/timeline/radar views via `?view=`), `/technologies/[slug]`, `/digest/today`, `/digest/[date]`, `/skills`, `/knowledge`, `/feed.xml`, and `/feed.json`
- Internal routes: `/workspace/*`
- Internal mutation APIs: `/api/workspace/*` and `/api/candidates/*`
- Public pages do not import workspace action components and do not call workspace mutation APIs

## Observability & Admin Operations v0

Operations is the internal observability layer built from data the system already records: source health, import runs, delivery runs, scheduled-delivery runs, task-runner runs, digest status, duplicate groups, candidate quality signals, and WorkflowEvent audit records.

Routes:

- `/workspace/operations`: operations dashboard for health, attention-required items, failures, quick links, and recent activity
- `/workspace/operations/events`: filtered WorkflowEvent browser for internal audit and debugging

The operations helper layer owns the aggregation logic:

- `getSystemHealthSummary()`
- `getAttentionRequiredItems()`
- `getRecentWorkflowEvents()`
- failed import, delivery, scheduled-run, and task-runner summaries

Health states are deterministic and explainable:

- `healthy`: no current failed import, failed delivery, failed schedule, failed task runner, open duplicate, or candidate quality blocker
- `warning`: reviewable issues exist but the system is still operating, such as failed delivery, partial import, open duplicate, or candidate quality issue
- `critical`: a task runner failed, a scheduled run failed, a source import failed, consecutive source failures exist, or a publish workflow event failed
- `unknown`: insufficient local operational history

Attention-required items are generated from concrete local records. They do not change ranking, recommendation, import, publish, digest, or delivery behavior. This phase only makes internal state easier to see.

Operations data is workspace-only. User-facing pages and feeds must not render operations summaries, WorkflowEvent records, delivery logs, scheduled run details, task-runner records, endpoint URLs, or internal error details.

## Source Management v0

External sources are stored in local JSON and can be created, edited, enabled, disabled, and manually imported from the Internal Workspace.

Supported source types:

- RSS
- Atom
- GitHub release
- official blog

Manual import writes imported candidates into the local candidate snapshot. Each candidate keeps `sourceId`, `sourceName`, `sourceType`, `sourceUrl`, `importedAt`, and `importRunId` when available so reviewers can move between source detail, candidate detail, and the import run that produced it.

Import failures update the source with `lastImportStatus = failed` or `partial` and a readable message instead of crashing the workspace UI.

## Batch Import + Source Health v0

Batch import is triggered from `/workspace/sources` and runs every enabled source.

Rules:

- disabled sources are skipped
- each source result is recorded independently
- one failed source does not stop the rest of the batch
- duplicate candidate IDs or normalized source URLs are skipped instead of blindly appended
- imported candidates remain internal until reviewed and converted

Source health is stored on each `ExternalSource`:

- `lastFetchedAt`
- `lastImportStatus`
- `lastImportMessage`
- `lastImportCount`
- `lastErrorMessage`
- `consecutiveFailureCount`
- `totalImportedCount`
- `lastSuccessfulImportAt`

The latest batch import summary is stored in local JSON with per-source messages and created/skipped candidate counts. This is observability for the import workflow, not ranking or recommendation.

## Source Quality + Candidate Quality Signals v0

Quality signals are the next internal observability layer after source health and duplicate review. They are deterministic review aids and must not be treated as impact ranking.

Source quality is computed from:

- current source health fields
- recent batch import results
- linked imported candidates
- candidate status after review or conversion
- duplicate relationships

The workspace displays `qualityLevel`, success rate, duplicate rate, conversion rate, rejection rate, and failure count so reviewers can quickly see which sources are stable, noisy, or failing.

Candidate quality is computed from each `ImportedCandidate` and highlights missing summary, missing content, missing publisher, invalid URL, invalid date, missing tags, possible duplicate, short content, and draft readiness.

These signals remain internal-only. They do not change `/technologies` ordering, do not create recommendations, and do not appear in user-facing technology pages.

## Ranking v0

Ranking v0 turns source and candidate signals into an explainable technology priority result.

Priority levels:

- `high_priority`: immediate attention
- `watch`: worth tracking
- `low_priority`: good to know

Ranking inputs:

- source quality level, import success rate, duplicate rate, conversion rate, and rejection rate
- candidate quality flags, including missing summary/content, invalid URL, possible duplicate, and ready-for-review
- duplicate group status and additional references from resolved duplicate groups
- content completeness for technology title, summary, content, tags, related knowledge, and related skills
- publish/import recency
- publisher and source metadata

For **published technology records**, the final band is resolved from the
editor's `importanceLevel`, with recency able to demote but never promote
(changed 2026-07-27 — see `CHANGELOG.md` → "Ranking banding + digest
fresh-first selection" for the measurement that motivated it):

- `critical` → `high_priority`, regardless of age
- `important` → `high_priority` within 30 days of publication, otherwise `watch`
- `signal` → `watch`
- any record scoring under 45 (missing summary/content, invalid URL or date)
  → `low_priority`, and a severe warning caps an otherwise-eligible record at
  `watch`

`priorityScore` is still computed exactly as before and is still the ordering
key **inside** a band; it is no longer the band boundary itself. The reason it
cannot be: the score measures record completeness, so every signal that clears
the editorial workflow lands in the 80-100 range, which made all 31 published
signals `high_priority` and left `watch`/`low_priority` unreachable.

Imported candidates have no editorial `importanceLevel` yet, so they keep the
original score thresholds (`>= 75` high, `>= 45` watch).

The ranking helper produces `priorityReasons` and `priorityWarnings` so reviewers can understand why a record was classified, including which banding rule applied. `rankingSource` currently supports `rule_based` and `manual_override`; the manual override data shape exists, but the editing UI is intentionally deferred.

Internal Workspace pages show priority level, ranking source, reasons, and warnings for candidates and technology records. User-facing pages show a productized priority label and short explanation without exposing quality flags, source health details, duplicate group internals, or raw score details.

Ranking v0 is not a recommendation engine. It does not use user profiles, personalize order, send push notifications, or run AI scoring.

## Content Intelligence v1

Content Intelligence v1 is the user understanding layer for published `TechnologyItem` records. It is edited in the Internal Workspace and rendered in the User-facing Product.

Fields include `whyItMatters`, `whoShouldCare`, `technicalContext`, `impactAreas`, `learningPath`, related knowledge explanations, related skill explanations, `followUpQuestions`, `readingDifficulty`, and `intelligenceStatus`.

Workflow:

- editors enrich a `TechnologyWorkspaceRecord` at `/workspace/technologies/[id]`
- Publish Quality Gate shows warnings for missing explanation fields
- publication copies the safe explanation fields into the user-facing `TechnologyItem`
- `/technologies` uses short explanation signals on cards
- `/technologies/[slug]` renders the full explanation modules
- Daily Digest cards use `whyItMatters`, audience hints, and related context counts

Content Intelligence is not Ranking v0 and not Source/Candidate Quality Signals. Ranking answers priority; quality signals answer review completeness; Content Intelligence answers what the technology means, who should care, and how to learn more.

Optional LLM-assisted drafting is available only inside the Internal Workspace Editorial Enrichment flow. It does not publish model output, does not replace editor review, and falls back to local mock generation when no server-side API key is configured.

### AI-assisted Editorial Enrichment v0

Editorial Enrichment is a workspace-only assistant layer for Content Intelligence. It stores `EditorialEnrichmentSuggestion` records separately from `TechnologyWorkspaceRecord` so generated copy is never published automatically.

Workflow:

- editor generates a suggestion on `/workspace/technologies/[id]`
- the editor chooses rule-based, mock LLM, or optional LLM-assisted generation
- the rule-based generator builds fields from the current draft, priority reasons, tags, related knowledge, and related skills
- the optional LLM path uses a server-side provider abstraction, a centralized prompt template, and output validation before storing a suggestion
- editor compares current fields with suggested fields
- Apply writes generated fields into the draft and records `editorial_enrichment.applied`
- Reject stores reviewer notes and records `editorial_enrichment.rejected`
- Regenerate creates a new suggestion and marks outdated draft suggestions `stale`

Supported provider modes:

- `rule_based`: deterministic local templates
- `mock_llm`: local mock provider with no API key
- `llm_assisted`: OpenAI-compatible provider when configured; otherwise falls back to `mock_llm`

Provider calls are server-side only. The provider layer reads `LLM_PROVIDER`, `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`, and `LLM_TIMEOUT_MS` from the environment and never passes API keys to client components. Invalid JSON, unsupported fields, unsafe internal fields, or empty usable output create a failed suggestion that cannot be applied.

### Prompt Quality & Editorial Review v1

Prompt Quality v1 adds a lightweight prompt-version and human review layer to Editorial Enrichment.

`PromptVersion` records store the editorial enrichment prompt template, output schema, version, purpose, and status. Generation uses the active prompt version and stores `promptVersionId` on every `EditorialEnrichmentSuggestion`. If no local prompt version store exists, the workflow creates the default active prompt and records `prompt_version.created`.

Editors can review each suggestion on `/workspace/technologies/[id]` before applying it. Review metadata includes `reviewStatus`, `qualityScore`, `qualityLabels`, `reviewerNotes`, `rejectionReason`, `appliedFields`, and `reviewedAt`. Apply all marks a suggestion accepted, apply selected fields marks it partially accepted, and reject records a rejection reason without changing the draft.

The workflow keeps multiple suggestions per draft. Regeneration creates a new suggestion and marks older draft suggestions stale when source inputs changed. This lets editors compare outputs and later improve prompts based on concrete review history.

Prompt version, provider, model, token usage, source inputs, quality scores, reviewer notes, rejection reasons, and suggestion history are workspace-only. User-facing technology pages and digest pages only render applied Content Intelligence fields after normal publication.

Publish Quality Gate warns when no suggestion exists or the latest suggestion is still unreviewed. User-facing pages never render suggestion records, source inputs, generation mode, reviewer notes, suggestion status, provider/model metadata, prompt version, token usage, or generation errors.

## Daily Digest Editorial Workflow v1

Daily Digest is a reading layer built on published `TechnologyItem` records and Ranking v0. It is not push delivery, email subscription, personalization, or AI-written editorial judgment.

Digest generation rules:

- read only published technology items
- evaluate each item with Ranking v0
- place `high_priority` items in the immediate-attention section
- place `watch` items in the worth-tracking section
- exclude `low_priority` items by default
- prefer signals that **no published digest has carried yet**: within each
  priority bucket, already-carried signals sort last, so never-carried ones
  take the limited slots first. Selection falls back to carried signals once
  the never-carried pool is exhausted, so a quiet day still produces a
  non-empty digest (`collectCarriedTechnologyIds` +
  `BuildDailyDigestOptions.carriedTechnologyIds`, added 2026-07-27)
- aggregate related skill IDs and knowledge IDs from selected items
- aggregate public source names from selected items

Digest Editorial Workflow v1 adds editor control without changing the Ranking v0 inputs:

- `editorialSummary` for the public overview
- `manuallyAddedTechnologyIds` for explicit inclusion
- `excludedTechnologyIds` for explicit exclusion
- `pinnedTechnologyIds` for priority placement
- `orderedTechnologyIds` for simple move up / move down ordering

Regeneration refreshes generated high/watch sections while preserving manual additions, exclusions, pins, order, editorial summary, and editorial notes. This prevents a regenerate action from silently wiping editor work.

Digest records are stored in local JSON and move through `draft | published | archived`. Draft and archived digests are visible in the Internal Workspace only. Published digests are available at `/digest/[date]`; `/digest/today` shows today's published digest, the latest published digest, or a public empty state when no digest has been published yet.

Workspace digest pages show generated sections, manual item controls, ranking reasons, readiness checks, editorial notes, preview links, and publish controls. User-facing digest pages show public technology summaries, why-watch copy, related skills, related knowledge, and source names without exposing raw ranking scores, candidate quality flags, source health details, duplicate internals, manual controls, editorial notes, or imported candidate data.

Digest publish readiness blocks missing title/date, empty selected content, duplicate references, unknown or unpublished technology references, and selected technologies missing required public fields. Warnings surface missing high-priority items, related skills, related knowledge, editorial summary, source names, and unusual watch-section size.

## Digest Delivery Surface v0

Digest Delivery Surface v0 provides stable public feed endpoints for published daily digests only:

- `/feed.xml`
- `/feed.json`

The delivery helper reads `DailyDigest` records, filters to `status = published`, maps each digest to public feed data, and links each item to `/digest/[date]`. Draft and archived digests are excluded by default.

The feed payload contains public digest title, date, summary, selected high-priority and watch technologies, related skill names, related knowledge names, source names, and public digest URLs. It does not include raw payloads, import status, normalized type, duplicate group internals, source health, candidate quality flags, manual digest adjustment IDs, editorial notes, or priority scores.

`/workspace/digests/[date]` shows delivery status for editors. Published digests display the public digest URL, RSS feed URL, JSON feed URL, last updated time, and a read-only share text preview. Draft digests are clearly marked as not publicly delivered yet and do not show misleading public links.

The surface-only stage intentionally does not send anything to external platforms. Email subscription, Telegram bots, push delivery, scheduling, and delivery analytics remain out of scope.

## Digest Delivery Integration v1 + Channel Expansion v1

Digest Delivery Integration v1 adds a workspace-only manual sending layer after Digest Delivery Surface v0. Channel Expansion v1 keeps the generic webhook adapter and adds a Feishu bot webhook adapter while preserving the same digest publication gate.

Core rules:

- only `DailyDigest.status = published` can be sent
- draft and archived digests are blocked before any webhook request
- delivery does not mutate digest content
- the same digest can be sent to multiple channels
- the same digest can be sent to the same channel more than once, but every attempt creates a delivery log
- retry creates a new delivery log with `retryOfDeliveryRunId`

Active channel types:

- `webhook`: generic HTTP POST adapter supporting JSON and text payloads
- `feishu_webhook`: Feishu bot webhook adapter using Feishu text-message JSON

Reserved channel types:

- `email`
- `telegram`
- `discord`

Reserved types are documented extension points only; no subscription, Telegram, Discord, email, cron, or account system is implemented.

`DeliveryChannel` records live in local JSON and are managed at `/workspace/delivery`. Workspace pages may show masked endpoint URLs and send status. User-facing digest pages and feeds never render channel configuration, endpoint URLs, delivery logs, request payload previews, response bodies, or retry metadata.

Delivery adapters live under `src/lib/delivery/adapters`. Each adapter owns `buildPayload`, `send`, and `validateChannelConfig`; the workflow layer owns channel persistence, published-only checks, retry linkage, and `DeliveryRun` logs.

Generic webhook JSON payloads are built from published digest data and published `TechnologyItem` records. They include public digest URL, high-priority items, watch items, related skills, related knowledge, source names, generated time, and delivered time. Generic text payloads reuse the public share text. Feishu webhook payloads use `msg_type: "text"` and include digest title, date, top 3 immediate-attention items, top 3 watch items, and the public digest URL. No payload includes raw payloads, import status, normalized type, duplicate group fields, quality flags, ranking scores, editorial notes, endpoint URLs, or delivery internals.

The current local JSON workflow is suitable for local development and controlled environments only. Production delivery should store webhook endpoint secrets outside JSON, in a dedicated secret store or environment-managed credential system.

## Scheduled Delivery v0

Scheduled Delivery v0 adds a local runner on top of the existing digest delivery layer. It is an Internal Workspace feature only and does not add subscriptions, production cron, user accounts, email unsubscribe flows, or a distributed scheduler.

Object responsibilities:

- `DailyDigest` owns the published content to send.
- `DeliveryChannel` owns the destination and platform adapter.
- `DeliveryRun` records one per-channel send attempt.
- `ScheduledDelivery` owns when a digest should be sent and which channels to target.
- `ScheduledDeliveryRun` records one schedule execution and links to the generated per-channel delivery logs.

Schedule rules:

- disabled schedules do not run
- `latest_published_digest` resolves to the latest `status = published` digest
- `digest_by_date` resolves to a specific published digest date
- draft and archived digests are blocked before any channel send
- disabled channels are skipped
- a failed channel does not stop the remaining channels
- scheduled runs skip the same schedule / digest / channel on the same local day
- manual runs are explicit force runs for operator validation and still write logs

The workspace route `/workspace/delivery/schedules` shows schedule configuration, next run, last run status, manual run controls, due-run controls, and recent schedule runs. User-facing routes never show schedule configuration, channel IDs, endpoint URLs, delivery logs, scheduled run logs, or internal delivery status.

## Real Cron / Task Runner v1

Task Runner v1 is a local execution layer for Scheduled Delivery — and, since
the news fast lane milestone, for the scheduled daily source import. It does
not introduce a production cron service, distributed scheduler, subscription
system, user accounts, or a database.

Object responsibilities:

- `ScheduledDelivery` still owns when to send and which channels to target.
- `runScheduleById` and `runDueSchedules` still own the schedule execution rules.
- `DeliveryChannel` and delivery adapters still own destination-specific sending.
- `DeliveryRun` still records each per-channel delivery attempt.
- `ScheduledDeliveryRun` still records one schedule execution across channels.
- `TaskRunnerRun` records one command-line runner pass across all due schedules.
- `ScheduledImportConfig` (`src/lib/scheduled-import.ts`,
  `config/scheduled-import.json`) owns when the daily source import runs;
  `runBatchImportForEnabledSources` still owns the import itself.
- `ScheduledDigestConfig` (`src/lib/scheduled-digest.ts`,
  `config/scheduled-digest.json`) owns when the daily digest **draft** is
  generated; `generateDailyDigest` still owns the generation itself. Runs
  after the scheduled import in the same pass, skips when the day already
  has a digest, and never publishes.

Command entry points:

- `npm run tasks:run-once` executes due schedules once and exits. This is the intended target for future system cron, PM2, GitHub Actions, or platform scheduler integration.
- `npm run tasks:watch` runs the same check in a local loop for development. It is not a production worker supervisor.

Execution rules:

- disabled schedules are not due
- future schedules are skipped
- each due schedule is executed independently so one failure does not stop the rest
- the scheduled-delivery layer blocks draft and archived digests
- disabled channels are skipped
- duplicate protection prevents the same schedule / digest / channel from being sent more than once in the same local day during scheduled runs
- manual force runs remain separate from scheduled task-runner runs
- each pass first runs the scheduled source import when it is due (enabled
  and `nextRunAt` missing or in the past); the run advances `nextRunAt` to
  the next daily time, which also prevents same-day duplicate imports
- unattended imports run without fallback placeholder candidates; a failed
  import downgrades an otherwise successful runner pass to `partial`

Audit and logging:

- runner summaries are stored in `config/task-runner.json`
- terminal logs show start time, finish time, mode, due schedule count, skipped schedule count, success / failed / partial counts, and delivery logs created
- runner messages sanitize endpoint URLs and token-like values
- workspace `/workspace/delivery/schedules` shows the latest task-runner result and the commands to run locally

User-facing routes never show task-runner commands, schedule configuration, delivery logs, endpoint URLs, or task-runner audit records.

## Deployment Readiness & Security Boundary v0

Deployment readiness defines which parts of the local-first prototype can be public and which must remain internal.

Public user-facing routes:

- `/`
- `/technologies` (also hosts the news/timeline/radar views via `?view=`)
- `/technologies/[slug]`
- `/digest/today`
- `/digest/[date]`
- `/feed.xml`
- `/feed.json`

Internal workspace and mutation routes:

- `/workspace/*`
- `/api/workspace/*`
- `/api/candidates/*`
- legacy `/candidates/*`
- legacy `/technologies/drafts/*`

`src/middleware.ts` can protect internal routes with a single environment-token boundary (the path matters — see `docs/deployment.md` → "The middleware must live at `src/middleware.ts`"):

- `WORKSPACE_ACCESS_ENABLED=true`
- `WORKSPACE_ACCESS_TOKEN=<strong token>`

The middleware accepts Bearer token, Basic auth password, and `x-workspace-access-token`. If protection is enabled without a configured token, protected routes fail closed with `503`.

This is not production authentication or RBAC. It is a minimal deployment guardrail so a controlled server does not accidentally expose source import, publishing, delivery, schedule, or task-runner controls.

Local workflow files can move from `./config` to another path via `LOCAL_DATA_DIR`. The helper boundary keeps JSON reads and writes in workflow services so a future database migration has a clear replacement seam.

Delivery endpoint URLs remain workspace-only. List/detail displays use endpoint masking and delivery logs do not store full endpoint URLs. Public feeds and digest pages are generated only from published digest data and safe published technology fields.

## Persistence Migration Planning v0

The project still uses local JSON for runtime workflow state. Persistence Migration Planning v0 does not add a database. It clarifies the data boundary so a future database migration can replace repository code without rewriting pages.

Current persistence layers:

- `src/lib/repositories/local-json-store.ts` owns local JSON file paths and read/write mechanics.
- Workflow modules such as `source-workflow.ts`, `candidate-workflow.ts`, `technology-draft-workflow.ts`, `digest-workflow.ts`, `delivery-workflow.ts`, `scheduled-delivery-workflow.ts`, and `task-runner.ts` own state transitions.
- App pages and API routes call workflow modules and should not directly read or write JSON files.

### Store-read memoization

Two derived views memoize their store reads, keyed on
`getStoreRevision()` + `getLocalStoreFingerprint()` from
`local-json-store.ts`:

- `getCandidateWorkflowData` (`candidate-workflow.ts`, added 2026-08-17)
- the three merged content pools behind `getAllTechnologies` /
  `getAllSkills` / `getAllKnowledge` (`content.ts`, added 2026-08-18)

Both existed because a whole-store read sat inside a per-item helper, and
both grew in silently as the content grew — `/workspace` reached 125
seconds per render, and `getContentGraph` reached 380ms by calling
`resolveTitle`/`resolveSlug` (each a full merged read) once per node.

The key deliberately has two halves. The **revision counter** catches writes
made by this process; the **file fingerprint** catches writes made by
another one, because `tasks:run-once` writes the same files from its own
process. Under the SQLite driver the fingerprint is null and only the
counter applies, which is why the two are combined rather than either used
alone.

Two rules for anything added here:

- **Memoize the source read, not the returned value**, unless the value is
  provably never mutated by a caller. The content pools still build and sort
  a fresh array per call for exactly this reason.
- **Prove invalidation on both write paths**, not just the in-process one.
  Each cache has tests covering same-process and other-process writes, and
  removing the fingerprint half must fail only the second — if it fails
  neither, the test is not holding the half that exists for the task runner.

### Measuring a slow route

`next dev` timings are not a proxy for production timings, and the error is
not a constant factor — it reorders routes. Measured 2026-08-18 across 20
dynamically-rendered routes, dev/prod ranged from **1.8× to 24.7×**: that
day’s scan reported `/technologies` at 445ms as the slowest public route, and
it is **16ms** in production, while routes the scan put mid-pack are the
genuinely expensive ones.

- **Use the dev/prod ratio as the triage step.** A route whose cost is real
  work — file reads, JSON parsing, large derived views — barely moves between
  the two (`/workspace` 1.8×, `/workspace/operations` 2.2×, `/feed.xml`
  1.8×). A route whose cost is React component rendering collapses
  (`/technologies` 24.7×). **A low ratio means there is something to fix; a
  high one means the dev server was measuring itself.**
- **Build the production control into a separate `distDir`**
  (`NEXT_DIST_DIR=.next-prod next build`, served with `next start` on another
  port). `next build` and `next dev` share `.next`, and running a build
  against a live dev server is a recorded way to wedge it. `next build` also
  rewrites `tsconfig.json`; revert it afterwards.
- **Compare only like for like.** A prerendered route’s production number is
  a file being served, not a render. Five public routes were in that state
  when this was first measured and have since been made dynamic (see
  CHANGELOG — “Five public pages would have shipped frozen at build time”),
  so only the favicon, the icon and the 404 are prerendered now; check
  `.next-prod/prerender-manifest.json` before reading any route’s prod time
  as a render cost.
- **Hold the payload constant when bisecting a render.** The per-card cost on
  `/technologies` was isolated with a temporary prop that rendered N of 63
  cards while still serializing all 63, which separates rendering from RSC
  serialization; without that the two move together and neither is
  attributable.
- **Microbenchmark the suspect before rewriting it.** Two rounds running,
  the plausible culprit has had the right shape and the wrong magnitude — a
  linear `.find()` worth 10ms, and a `new Intl.Segmenter` per card worth
  9.3µs. Both would have produced a clean-looking commit that fixed nothing.

Future repository seams:

- source repository for `ExternalSource` and `ImportRun`
- candidate repository for `ImportedCandidate` and review state
- duplicate repository for `DuplicateGroup`
- technology repository for drafts and published workspace records
- digest repository for generated and edited digest records
- delivery repository for channels and delivery logs
- schedule repository for scheduled delivery and runner audit records

Flows that need transactions after database migration:

- candidate conversion to technology draft plus candidate status update
- duplicate group resolution plus primary-candidate conversion guard
- draft publication plus slug uniqueness
- digest generation/regeneration while preserving manual adjustments
- digest publication plus selected published technology validation
- delivery log insert plus channel last-delivery update
- scheduled delivery run plus per-channel delivery logs
- source import plus candidate insertion plus source health update

`docs/persistence-plan.md` contains the object audit, future tables, recommended indexes, sensitive/internal field list, transaction risks, and migration order. `npm run validate:persistence` checks current local JSON consistency and public-data isolation.

## Database Migration v0

Database Migration v0 adds an optional SQLite driver without changing the page/API contract.

Driver selection:

- `PERSISTENCE_DRIVER=json`: default local JSON workflow.
- `PERSISTENCE_DRIVER=sqlite`: workflow stores are backed by `config/ai-tech-radar.sqlite` or `SQLITE_DATABASE_PATH`.

Repository boundary:

- `local-json-store.ts` keeps the JSON implementation.
- `sqlite-store.ts` owns SQLite schema creation, table mapping, and JSON-store-compatible reads/writes.
- Workflow modules continue to call the same store functions and own business state transitions.
- Pages and API routes still do not write SQL directly.

SQLite schema v0 covers:

- `sources`, `import_runs`, `import_run_source_results`
- `imported_candidate_sources`, `imported_candidates`, `candidate_review_states`
- `duplicate_groups`
- `technology_drafts`, `technologies`, `knowledge_items`, `skill_items`
- `daily_digests`
- `delivery_channels`, `delivery_logs`
- `scheduled_deliveries`, `scheduled_delivery_runs`
- `task_runs`
- `skill_workspace_records`, `knowledge_workspace_records`,
  `link_relation_overrides` (added 2026-07-28 — the workspace content overlays
  had no SQLite adapter, so sqlite mode served the seed pools only)
- `runtime_configs` (single-object schedule configs, keyed by JSON filename),
  `technology_comparisons`, `technology_explanations`,
  `technology_learning_paths`

This v0 stores each domain object as a JSON payload plus key columns and indexes. That keeps the migration small while making future Postgres/Supabase tables and indexes explicit.

SQLite writes are transaction-protected per store replacement. Cross-store business transactions are still a later production hardening step.

## Database-backed Workflow Hardening v1

Workflow Hardening v1 adds guardrails on top of the optional SQLite driver and the existing JSON fallback. It does not replace the persistence driver or add a user system.

New internal audit object:

- `WorkflowEvent` in `workflow-events.json`
- `workflow_events` in SQLite mode

Recorded workflow actions include candidate conversion, conversion failure, duplicate group resolution, draft edit/publish, digest generation/edit/publish, delivery success/failure, schedule runs, task runner runs, and source import updates.

The event store is internal-only. Workspace detail pages can show recent events in low-weight audit panels. User-facing routes never render workflow events, delivery logs, endpoint URLs, task runner records, or internal error details.

Hardening rules added in this stage:

- Candidate conversion still writes the draft before marking candidate state as converted; if review-state persistence fails after draft creation, the workflow attempts to restore the prior draft store and rethrows the error.
- Repeated candidate conversion returns the existing draft instead of creating duplicate records.
- Non-primary candidates in a resolved duplicate group remain blocked from standalone draft conversion.
- Publish readiness still blocks invalid draft publishing; failed and successful publish attempts now produce workflow events.
- Digest publish readiness blocks invalid or unpublished technology references; failed and successful publish attempts now produce workflow events.
- Delivery success and failure both persist `DeliveryRun` and workflow events.
- Scheduled delivery keeps existing same-day duplicate protection for schedule / digest / channel and records schedule-level events.

This is not full production ACID across all workflow stores. The remaining production step is to move multi-object workflows into database-native transactions and locks.

## Current external source support

The first version supports a small set of stable real source types:

- RSS / Atom
- GitHub release feeds / release API
- official blog style update pages

All sources map into the same `ImportedCandidate` structure and preserve `rawPayload`.

## Duplicate Review v1

Duplicate review is rule-based, explainable, and limited to the Internal Workspace.

Detection rules:

- identical normalized `sourceUrl`
- identical canonical link from RSS / Atom / official blog payloads when available
- highly similar normalized title tokens
- same publisher plus similar title within a near publish-date window
- GitHub release items from the same repository release family

Each reason is stored as a code such as `same_source_url`, `similar_title`, `same_publisher_near_date`, `same_repo_release_family`, or `same_canonical_url`.

The workflow creates lightweight `DuplicateGroup` records with:

- candidate IDs
- primary candidate ID
- status: `open | resolved | ignored`
- reason codes
- timestamps

Reviewers use `/workspace/duplicates` and `/workspace/duplicates/[id]` to compare candidates and choose the primary. Once a group is resolved, only the primary candidate may generate a technology draft. Non-primary candidates are blocked from standalone conversion and are preserved as additional source references on the generated draft.

The goal is reviewer assistance and duplicate prevention, not automatic impact scoring or recommendation.

## Publish Quality Gate v0

Publishing is guarded by deterministic rules in the local workflow layer.

Blocking errors prevent publication:

- missing title, summary, slug, source name, source URL, publish date, or content
- invalid source URL
- invalid publish date
- duplicate slug against static technologies or other workspace records
- invalid user-facing enum-like fields such as type, language, publisher type, importance, or status

Warnings allow publication but remain visible to the editor:

- English-source item without Chinese title and summary
- too few tags
- no related knowledge
- no related skills
- missing publisher name
- short summary
- short content
- empty editorial notes

The preview route reuses the user-facing technology detail component and maps the workspace record into a safe `TechnologyItem` shape before rendering.

## Current bilingual scope

The bilingual system is content-level, not route-level.

Current support:

- `TechnologyItem.title`
- `TechnologyItem.summary`
- `TechnologyItem.content`

The user-facing product prefers Chinese when available and falls back to original text when translation is missing.

The internal workspace remains compatible with the same data shape but does not prioritize bilingual reading UX.

## Current limits

Not implemented yet:

- impact scoring
- recommendation logic
- personalized ranking
- push notification
- full admin platform
- full-site i18n
- production database-backed persistence beyond the current local SQLite driver
- automated publishing workflows
- source deletion, production credential storage, and long-term source health history
- advanced editorial approval flow beyond the current draft editor
- AI/editorial quality scoring beyond deterministic publish checks
- advanced ranking models beyond deterministic v0 rules
- push notification, email subscription, production cron, AI digest writing, and personalized digest logic
- semantic or AI duplicate detection beyond deterministic rules
