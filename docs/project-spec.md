# Project Spec

## Product position

This project is a local-first prototype for a high-impact new technology discovery and understanding platform.

It is not a generic news site. It separates imported external data from formal user-facing technology content.

## Subsystems

### Internal Workspace

Used by reviewers and editors.

Responsibilities:

- inspect imported external candidates
- manage external source configuration
- review and reject candidates
- inspect duplicate hints
- convert candidates into technology workspace records
- edit draft title, summary, content, tags, source metadata, related knowledge, and related skills
- run Publish Quality Gate v0
- preview user-facing output before publishing
- publish or archive technology records
- generate, preview, and publish daily digest records
- inspect raw payload and internal workflow fields

This is an internal editorial workspace, not a normal user-facing page. Its
pages may contain operational controls, diagnostics, source health, delivery
configuration, and workflow events. It should be protected before exposing the
app outside local development.

### User-facing Product

Used by end users.

Responsibilities:

- explain what the product is from `/` and guide readers into the public discovery flow
- surface the latest published Daily Digest as the primary "start here" entry
- offer `/news` as an auto-aggregated fast lane (two-tier content model): the
  most recently imported items, sanitized and clearly labelled 未经编辑精选,
  alongside — never instead of — the editor-curated signal and digest tier
- render published `TechnologyItem` content only on the curated tier
- support content-level bilingual reading for technology title, summary, and content
- show source links, tags, related knowledge, related skills, priority labels, and Content Intelligence explanations
- show published Daily Digest pages generated from published technology items
- make `/skills` and `/knowledge` useful as learning foundations connected to published technologies
- avoid exposing internal-only fields or review actions

The public product consumes only published, safe content. It must never call
workspace mutation APIs or render workspace navigation, delivery configuration,
audit logs, source health, raw imported payloads, duplicate review fields, or
task-runner information.

## Route and API boundaries

Public pages:

- `/`
- `/news` — auto-aggregated news fast lane (sanitized imported candidates,
  last 7 days; see `docs/security-boundary.md` → "News Fast Lane Boundary")
- `/digest/today`
- `/digest/[date]`
- `/technologies`
- `/technologies/[slug]`
- `/skills`
- `/skills/[slug]`
- `/knowledge`
- `/knowledge/[slug]`
- `/network`
- `/radar` — personal radar; follows are browser-local (localStorage), the
  route itself serves the same published content to everyone
- `/search` — site-wide keyword search over published signals, skills,
  knowledge, and the news fast lane (deterministic title/summary/tag
  matching; news results reuse the `src/lib/news.ts` sanitizing map)
- `/feed.xml`
- `/feed.json`

Public API routes:

- `POST /api/technologies/compare` — generates or returns a cached AI
  comparison between two published technologies. Unprotected by design (see
  `docs/security-boundary.md`); never returns provider/model/prompt-version
  metadata.
- `POST /api/technologies/explain` — generates or returns a cached AI
  explanation of one published technology tailored to a reader-selected
  experience level. Same boundary discipline as the compare route.
- `POST /api/technologies/learning-path` — generates or returns a cached AI
  learning path for one published technology, grounded in its related
  knowledge and skills from the content graph. Same boundary discipline as
  the compare route.

Internal workspace routes:

- `/workspace/*`

Internal mutation APIs:

- `/api/workspace/*`
- `/api/candidates/*`

Public feed/API surfaces:

- `/feed.xml`
- `/feed.json`

Workspace access protection covers `/workspace/*`, `/api/workspace/*`,
`/api/candidates/*`, and legacy internal redirects. Public pages remain
read-only user surfaces.

## Data lifecycle

1. source configuration
2. external source
3. imported raw payload
4. `ImportedCandidate`
5. review and duplicate inspection
6. convert to `TechnologyWorkspaceRecord` draft
7. edit and enrich draft
8. run publish readiness checks
9. preview user-facing output
10. publish
11. generate Daily Digest draft from published content
12. preview and publish digest
13. user-facing display

Source configuration is internal-only and controls which RSS, Atom, GitHub release, and official blog sources can be manually imported into the candidate pool.

## External Source Management v0

The source management UI belongs only to the Internal Workspace.

Routes:

- `/workspace/sources`
- `/workspace/sources/new`
- `/workspace/sources/[id]`

Supported source types:

- `rss`
- `atom`
- `github_release`
- `official_blog`

Source records are stored in local JSON and include:

- identity and config: `id`, `name`, `type`, `url`, `enabled`, `description`
- defaults: `language`, `publisherName`, `publisherType`, `defaultTags`, `defaultNormalizedType`
- import state: `lastFetchedAt`, `lastImportStatus`, `lastImportMessage`, `lastImportCount`, `lastErrorMessage`, `consecutiveFailureCount`, `totalImportedCount`, `lastSuccessfulImportAt`
- timestamps: `createdAt`, `updatedAt`

Imported candidates generated from a source keep `sourceId`, `sourceName`, `sourceType`, `sourceUrl`, `importedAt`, and `importRunId` for traceability.

## Batch Import + Source Health Check v0

Batch import belongs only to the Internal Workspace and is triggered from `/workspace/sources`.

Behavior:

- imports all enabled sources
- skips disabled sources
- records each source result independently
- keeps going when one source fails
- writes imported candidates into the candidate pool
- skips duplicate or already-existing candidate IDs / source URLs instead of blindly appending
- stores the latest batch import summary in local JSON

The batch summary records total sources, enabled sources, skipped disabled sources, successful / failed / partial source counts, created candidates, skipped candidates, and per-source messages.

`lastImportStatus` values:

- `never_run`: no import has been attempted
- `success`: live import completed
- `partial`: live import failed but local fallback created inspectable candidate data
- `failed`: no candidates were imported and the error was recorded

`npm run validate:sources` verifies source validation, duplicate URL rejection, disabled-source behavior, batch import summaries, source health updates, candidate traceability, duplicate skipping, and failed import persistence.

## Scheduled Import + News Fast Lane v0

Shipped 2026-07-13 (owner-authorized) to make content freshness automatic
without weakening the editorial gate:

- The local task runner (`tasks:run-once` / `tasks:watch`) checks
  `config/scheduled-import.json` on every pass and runs one batch import for
  all enabled sources when the configured daily time (default `08:00`
  Asia/Shanghai) has passed. Unattended imports never create fallback
  placeholder candidates. Managed from `/workspace/delivery/schedules`;
  Windows Task Scheduler setup lives in `docs/deployment.md`.
- `/news` (今日快讯) publicly renders the last 7 days of imported candidates
  through the sanitizing map in `src/lib/news.ts` — title / truncated
  summary / source / date / display tags only, always labelled
  自动聚合，未经编辑精选. Rejected, fallback, and non-primary duplicate
  candidates are excluded; converted + published items link to their formal
  signal page. The home page carries a compact latest-news board.
- This is a **two-tier content model**: the fast lane answers "what is
  happening right now", while the curated TechnologyItem + digest tier keeps
  answering "what deserves attention first". The editorial workflow is
  unchanged.

## Publish Quality Gate v0

Blocking errors stop publication:

- missing title
- missing summary
- missing slug
- duplicate slug
- missing source name
- invalid source URL
- invalid publish date
- missing content
- invalid user-facing enum-like fields

Publication requires enough safe fields for the user-facing technology pages:

- localized `title`, `summary`, and `content` with `original` or `zh`
- unique `slug`
- source name and valid source URL
- valid `YYYY-MM-DD` publish date
- valid technology type, source language, translation status, publisher type, importance level, and status

Warnings allow publication but must be visible:

- English-source record without Chinese title and summary
- too few tags
- no related knowledge
- no related skills
- missing publisher name
- short summary
- short content
- empty editorial notes

The preview route `/workspace/technologies/[id]/preview` renders the draft through the user-facing technology detail component without changing publish status and without exposing internal-only fields.

`npm run validate:publishing` verifies the gate rules, warning behavior, user-facing publication lookup, internal-field isolation, and bilingual fallback in the local JSON workflow.

## Content Intelligence v1

Technology records support an explanation layer edited in the Internal Workspace and rendered in the User-facing Product.

Fields include `whyItMatters`, `whoShouldCare`, `technicalContext`, `impactAreas`, `learningPath`, related knowledge explanations, related skill explanations, `followUpQuestions`, `readingDifficulty`, and `intelligenceStatus`.

These fields are user-facing enrichment. They explain what a technology signal means, who should care, what background is needed, which skills help, and what to investigate next. They are not Ranking v0, not recommendation, and not internal quality flags.

Missing explanation fields create publish warnings because the public page becomes less useful, but they do not block publication in v1.

Editorial Enrichment suggestions can help draft these fields inside the Internal Workspace. The safe default is rule-based or mock LLM generation with no API key. Optional OpenAI-compatible LLM-assisted drafting is server-side only, must pass output validation, and still requires editor apply before it updates a draft. Suggestion metadata, provider details, prompt versions, token usage, and generation errors are internal-only.

## Daily Digest Editorial Workflow v1

Daily Digest is a local JSON workflow for producing a public daily brief from published `TechnologyItem` records.

Routes:

- `/workspace/digests`
- `/workspace/digests/[date]`
- `/workspace/digests/[date]/preview`
- `/digest/today`
- `/digest/[date]`

Digest generation uses Ranking v0:

- `high_priority` items enter the immediate-attention section
- `watch` items enter the worth-tracking section
- `low_priority` items are excluded by default
- related skills, related knowledge, and source names are aggregated from selected published technologies

Digest editing keeps generated output and editor decisions separate:

- `highPriorityTechnologyIds` and `watchTechnologyIds` remain the generated Ranking v0 sections
- `manuallyAddedTechnologyIds` adds published technologies that ranking would not include by default
- `excludedTechnologyIds` removes items even if they qualify again during regeneration
- `pinnedTechnologyIds` places selected items first
- `orderedTechnologyIds` preserves simple editor-controlled ordering
- `editorialSummary` stores an editor-written public overview

Regeneration refreshes the generated sections but preserves manual additions, exclusions, pins, ordering, editorial summary, and editorial notes when a digest has already been adjusted.

Digest status values:

- `draft`
- `published`
- `archived`

Draft and archived digests are workspace-only. Published digests can be read through the user-facing digest routes and must not expose candidate, source health, duplicate, raw payload, quality flag, editorial note, manual control, or ranking score internals.

Digest publication is guarded by deterministic readiness checks. Blocking errors include missing title/date, empty digest, duplicate technology references, unknown or unpublished technology references, and selected technologies missing fields required by the public digest. Warnings include no high-priority items, no related skills, no related knowledge, missing editorial summary, no source names, and unusually low or high watch-item count.

## AI-Assisted Understanding (Compare v0 + Explain v1 + Learning Path v2)

P3 ("AI-assisted understanding") was explicitly out of scope in `AGENTS.md` until the
owner authorized it. Compare was the first capability shipped under that
authorization; Explain is the second and the graph-grounded learning path is
the third — all three agreed P3 candidates have now shipped.

- On `/technologies/[slug]`, a reader can pick another published technology and
  request a live AI-generated comparison (similarities, differences, when to
  prefer each).
- Unlike Editorial Enrichment, this is **not** editor-gated: the result is shown
  immediately, with a persistent, always-visible disclaimer
  ("AI 生成内容，未经编辑审核，仅供参考") rendered in the same paint as the result.
  This is a deliberate departure from the rest of the project's "AI suggests,
  editor approves" pattern, made explicit here because it is public-facing and
  unreviewed content.
- Results are cached per unordered technology pair (`POST /api/technologies/compare`)
  so the same pair is only generated once, bounding both cost and repeated-request
  load on the LLM provider.
- Reuses the existing LLM provider boundary (mock by default, OpenAI-compatible
  when configured), the `PromptVersion` system, and the same internal-field
  stripping discipline as Editorial Enrichment — provider name, model name,
  prompt version, and generation mode never appear in the public API response.

Explain (v1) follows the exact same pattern with a different cache dimension:

- On `/technologies/[slug]`, a reader picks their experience level
  (入门 / 进阶 / 资深) and requests a live AI-generated explanation of the
  current technology tailored to that level: a plain-language explanation,
  key points, an optional beginner analogy, and optional next steps.
- Same non-editor-gated model, same always-visible disclaimer rendered in the
  same paint as the result.
- Results are cached per technology × level (`POST /api/technologies/explain`,
  cache key `technologyId::audienceLevel`), so each combination is generated
  at most once.
- Uses a dedicated `technology_explanation` `PromptVersion` purpose and the
  same public-mapping strip (`toPublicExplanationResult` in
  `src/lib/technology-explanation.ts`).

Learning path (v2) completes the sequence, with graph grounding as its
defining trait:

- On `/technologies/[slug]`, a reader requests a live AI-generated learning
  path for the current technology: an overview, ordered steps, and optional
  self-check checkpoints.
- The prompt feeds the technology's actual related knowledge and related
  skills (titles + summaries from the content graph) and instructs the model
  to build the steps on them by name — the P2 relationship network is the
  source material, not free-form generation.
- Same non-editor-gated model, same always-visible disclaimer in the same
  paint as the result.
- Results are cached per technology (`POST /api/technologies/learning-path`,
  keyed by `technologyId`), so each technology's path is generated at most
  once.
- Uses a dedicated `technology_learning_path` `PromptVersion` purpose and the
  same public-mapping strip (`toPublicLearningPathResult` in
  `src/lib/technology-learning-path.ts`).

## UI Design System & Layout Refactor v0

The product now treats visual structure as part of the system boundary:

- User-facing pages should look like a technology discovery and reading product.
  They explain published content, avoid workspace vocabulary, and do not show
  internal validation, demo, mock, delivery, audit, or task-runner details.
- Internal Workspace pages should look like compact operational tools. They may
  show status, source health, duplicate groups, delivery logs, schedules, audit
  events, and local workflow warnings.
- Daily Digest public pages sanitize validation-style local titles and summaries
  into public-facing digest copy.
- Skills and Knowledge indexes are grouped so readers can choose a starting
  point instead of scanning one undifferentiated card grid.
- Delivery and schedule creation forms are collapsed by default in workspace
  pages so operators first see configured state, recent runs, and failures.

This refactor does not add ranking, recommendation, subscription, login,
database behavior, delivery channels, or full-site i18n.

## Personal Radar (P4 v0)

P4 ("personalization") was owner-authorized on 2026-07-09. The v0 scope is
deliberately minimal and keeps every existing boundary intact:

- Readers follow topic tags on `/radar` via toggle chips; follows are stored
  only in the reader's browser `localStorage` — no accounts, no server-side
  profile, no personal data on the server.
- The radar filters published technologies whose tags intersect the followed
  set and groups them with the existing deterministic Ranking v0 levels; each
  item carries an explicit "命中关注：X" explanation line. This is
  deterministic, explainable filtering — not AI ranking and not a
  recommendation system.
- The route serves identical published content to everyone; personalization
  happens entirely client-side.
- Follow entry on detail pages (v0.1, same day): the tags section on the
  technology, skill, and knowledge detail pages renders the same
  follow-toggle chips (`FollowableTagList`), so readers can follow a topic
  where they read about it; a hint line links back to `/radar` when any of
  the page's tags is followed. Same localStorage-only boundary — no new
  routes, no server state.
- Personalized digest view (v0.2, same day): public digest pages highlight
  items matching the reader's followed topics (命中关注 line) and offer a
  只看我关注的 client-side filter with guided empty states. The served
  digest content stays identical for everyone; readers with no follows see
  the digest unchanged apart from one hint line linking to `/radar`. Same
  localStorage-only boundary.

## Current non-goals

- AI black-box ranking
- personalized recommendation beyond the deterministic followed-topic radar
- recommendation system
- push notification
- email subscription
- personalized digest
- login
- production cloud database integration
- full admin platform
- full-site i18n
- AI-based quality scoring
- automated translation
