# Security Boundary v0

This document defines the current safety boundary between public product pages and internal operational surfaces.

## Public Surfaces

Public routes can be exposed:

- `/`
- `/technologies` (four views via `?view=`: 精选 default, 全部快讯 — the
  auto-aggregated news fast lane, see "News Fast Lane Boundary" below for
  the exact candidate-field allowlist — 按话题, and 我关注的 — follows are
  browser-localStorage only, the route serves the same published content to
  everyone and holds no per-reader server state; `/news`, `/timeline`, and
  `/radar` redirect here to the matching view)
- `/technologies/[slug]`
- `/digest` (archive index; renders only published digests through the same
  public-copy sanitizers as the digest pages — date, public title/summary,
  and section counts, never editorial notes or manual adjustment ids)
- `/digest/today`
- `/digest/[date]`
- `/digest/weekly` and `/digest/weekly/[week]` (public weekly review — a
  pure derived view over published technology signals, same published-content
  boundary as the digest; no persisted data, no AI, no internal fields;
  `/digest/weekly/[week]` 404s for a non-canonical key or a signal-less week)
- `/skills`
- `/skills/[slug]`
- `/knowledge`
- `/knowledge/[slug]`
- `/network`
- `/topics/[tagId]` (topic hub; a drill-down destination reached only via
  `FollowableTagList` chip links, not a global nav entry or index page —
  merges a tag's published technologies, skills, knowledge, and direct
  `getContentGraph()` neighbors; `notFound()` for an unknown or empty tag)
- `/topics/[tagId]/feed.xml` (per-topic RSS of published technology
  signals only — same published-content boundary as `/feed.xml`; imported
  candidates, drafts, and internal fields never enter it; 404 for unknown
  or signal-less topics)
- `/search` (deterministic keyword search over published technology
  signals, skills, knowledge, and the news fast lane; matching covers only
  title / summary / tag display names, results are identical for everyone,
  and news results go through the same `src/lib/news.ts` mapping as the
  全部快讯 view — including the fixed 自动聚合 disclaimer on the news group,
  so search is a compliant fast-lane surface rather than a new
  candidate→public mapping point)
- `/feed.xml`
- `/feed.json`
- `POST /api/technologies/compare`
- `POST /api/technologies/explain`
- `POST /api/technologies/learning-path`

They must not render:

- `rawPayload`
- `importStatus`
- `normalizedType`
- `duplicateGroupId`
- quality flags
- workspace-only notes
- delivery endpoint URLs
- delivery logs
- scheduled delivery configuration
- task runner information
- workflow event / audit log information
- workspace access tokens
- LLM provider configuration
- `LLM_API_KEY`
- editorial enrichment provider/model metadata
- editorial enrichment prompt versions, token usage, validation warnings, or generation errors

## News Fast Lane Boundary

The 全部快讯 view on `/technologies?view=news` (and the home news board) is
the one deliberate exception to "imported candidates are workspace-only": it
renders recently imported candidates publicly, but only through the
dedicated sanitizing map in
`src/lib/news.ts` (`PublicNewsItem`). That module is the single place an
`ImportedCandidate` may cross into a public surface.

Allowed to cross the boundary:

- `originalTitle` (as `title`)
- `originalSummary` (trimmed and truncated)
- `sourceName` and `sourceUrl`
- `publishDate` (or the imported-at date when the publish date is invalid)
- display tag names (canonical `TopicTag` names when the tag is a known id)
- a link to the published technology page when the candidate was converted
  and published (slug + public title only)

Never crosses the boundary:

- `rawPayload`, `originalContent`, `importStatus`, `normalizedType`
- candidate IDs, `duplicateGroupId`, duplicate reasons, review state
- source health, quality flags, import run internals

Filtering rules enforced in the same module: rejected candidates are hidden,
`fallback`-tagged placeholder candidates are hidden, non-primary members of
open/resolved duplicate groups are hidden, and the window is capped (last 7
days, max 200 items). Every fast-lane surface renders the fixed
"自动聚合内容，未经编辑精选" disclaimer so unreviewed content is always
labelled.

## Internal Surfaces

Workspace routes and internal APIs are operational tools for reviewers and maintainers:

- `/workspace/*`
- `/api/workspace/*`
- `/api/candidates/*`
- legacy `/candidates/*`
- legacy `/technologies/drafts/*`

These routes may show source health, raw payloads, delivery logs, schedules, task runner summaries, workflow events, and workflow actions. They should be protected before deployment.

User-facing pages must not import workspace action components or call internal
mutation APIs. Workspace actions are allowed to mutate local JSON / SQLite state,
trigger imports, publish records, send delivery payloads, and run schedules only
behind the workspace boundary.

## Minimal Access Protection

`middleware.ts` protects workspace/internal paths when:

```bash
WORKSPACE_ACCESS_ENABLED=true
```

The token comes from:

```bash
WORKSPACE_ACCESS_TOKEN=...
```

The middleware accepts Bearer token, Basic auth password, or `x-workspace-access-token`. User-facing routes do not require this token.

This is intentionally small. It is not a replacement for production login, per-user roles, audit trails, or session management.

## Delivery Secrets

Delivery channel endpoint URLs belong to the Internal Workspace only. The workspace list masks sensitive query parameters such as token, key, secret, signature, and auth. Delivery logs store payload previews and response previews, but not full endpoint URLs.

The current local JSON store may still contain configured endpoint URLs for local operation. Do not put production webhook secrets in committed files. A production deployment should use a secret manager or encrypted credential storage.

## Persistence Boundary

Local JSON and local SQLite are implementation details for the current controlled prototype. They are not production secret stores.

Internal workflow stores may contain raw payloads, source URLs, delivery channel endpoints, request/response previews, schedule metadata, task-runner audit messages, and workflow event before/after snapshots. These records must stay behind workspace access protection and must not be mapped directly into public pages or public feeds.

When `PERSISTENCE_DRIVER=sqlite`, the same boundary applies to `config/ai-tech-radar.sqlite` or the configured `SQLITE_DATABASE_PATH`. The SQLite file may contain internal workflow data and delivery endpoint URLs, so it must not be served as a static asset or committed with production secrets.

The safe public mapping is still explicit:

- published workspace technology records are converted to safe `TechnologyItem` shape before public rendering; the public shape carries no `priority` ranking object (score, raw reasons, warnings, and ranking source are internal-only), so ranking internals never enter the RSC payload of client components — public surfaces derive the productized priority level on demand via `evaluateTechnologyPriority`
- published digest feed data is derived from published digest and published technology fields only
- digest pages render through a public-safe `PublicDigestView`
  (`toPublicDigestView` in `src/lib/digest-view.ts`), so internal digest
  fields (editorial notes, manual adjustment id lists) never enter the page
  payload — the full `DailyDigest` object stays in the workflow layer
- skill and knowledge workspace records
  (`config/skill-workspace.json` / `config/knowledge-workspace.json`) reach
  public pages only through the merged read in `getAllSkills` /
  `getAllKnowledge`: draft records are filtered from every public surface,
  and the merged items carry no workspace-only fields (`status`, origin,
  and timestamps stay behind the workspace boundary)
- link relation overrides (`config/link-relation-workspace.json`) carry only
  the same public fields the seed `LinkRelation` entries already expose
  (pair, relation type, note) and reach public pages through the merged
  read in `getAllLinkRelations`; the editing surface
  (`PUT /api/workspace/relations`) stays behind the workspace boundary
- delivery channels, delivery logs, schedules, task-runner records, and workflow events are workspace-only

`npm run validate:persistence` provides a lightweight consistency and isolation check for local workflow data. `npm run validate:database` repeats the critical reference and public-field checks against both JSON and SQLite driver modes.

## Task Runner Boundary

Task runner commands and audit summaries are internal-only:

- `npm run tasks:run-once`
- `npm run tasks:watch`
- `config/task-runner.json`
- `config/scheduled-import.json` (scheduled daily source import configuration)
- `config/scheduled-digest.json` (scheduled daily digest-draft generation
  configuration)

Public digest and technology pages must not display runner configuration or
logs. The 全部快讯 fast lane shows imported content but never the import
schedule, runner status, or import run messages.

## Workflow Event Boundary

Database-backed Workflow Hardening v1 adds `workflow-events.json` and SQLite `workflow_events` as an internal audit trail for critical state changes such as candidate conversion, draft publishing, digest publishing, delivery failures, scheduled runs, and task-runner executions.

Workflow events are not a user-facing feature. They may include sanitized snapshots and diagnostic metadata, so they must only appear in workspace audit panels. Endpoint-like and token-like fields are sanitized before storage, but production deployments still need proper retention policy, access control, and secure secret storage.

## LLM Provider Boundary

LLM Provider Integration v0 is server-side only. Historically every caller was
workspace-only (Editorial Enrichment); the technology comparison feature (see
"Public LLM Feature Boundary" below) is the first public-facing caller, so the
rules in this section now apply to both.

Environment variables:

- `LLM_PROVIDER`: `mock` or `openai_compatible`
- `LLM_API_KEY`: optional API key for the OpenAI-compatible provider
- `LLM_BASE_URL`: optional OpenAI-compatible base URL
- `LLM_MODEL`: optional model name
- `LLM_TIMEOUT_MS`: optional request timeout

Security rules:

- API keys are read only from server-side workflow/API code.
- Client components never receive `LLM_API_KEY`.
- User-facing pages and feeds never render provider name, model name, prompt version, token usage, validation warnings, generation errors, or source inputs.
- Missing `LLM_API_KEY` falls back to the local mock provider instead of failing builds or validation.
- LLM output is parsed, sanitized, and rejected if it contains internal-only fields or invalid structure.
- Workflow events store only provider/model/status metadata and sanitized errors, not request headers or API keys.

The current local JSON and SQLite stores may contain workspace-only suggestion metadata. They are not production secret stores. Production deployments should keep provider credentials in environment-managed secret storage and should not commit local data files containing real provider or delivery credentials.

## Public LLM Feature Boundary (Comparison v0 + Explanation v1 + Learning Path v2)

`POST /api/technologies/compare` was the first public route that calls the LLM
provider directly; `POST /api/technologies/explain` and
`POST /api/technologies/learning-path` follow the identical discipline. All
three are intentionally left outside `middleware.ts`'s protected path prefixes
rather than gated behind `WORKSPACE_ACCESS_TOKEN`, because:

- they only ever operate on technologies already returned by `getAllTechnologies()`,
  which is published-only — there is no way to reach draft or archived content
  through these routes. The learning-path prompt additionally reads related
  knowledge/skill items, which are also public content.
- results are cached before any provider call: per unordered technology-id
  pair for compare (`config/technology-comparisons.json`), per
  technology × reader level for explain
  (`config/technology-explanations.json`, cache key
  `technologyId::audienceLevel`), and per technology for the learning path
  (`config/technology-learning-paths.json`, keyed by `technologyId`), so each
  cache key is generated by the provider at most once; repeated requests are
  served from cache with no new provider call.
- each response is mapped through a single public-mapping function
  (`toPublicComparisonResult` in `src/lib/technology-comparison.ts`;
  `toPublicExplanationResult` in `src/lib/technology-explanation.ts`;
  `toPublicLearningPathResult` in `src/lib/technology-learning-path.ts`) that
  strips `providerName`, `modelName`, `promptVersionId`, `promptVersion`,
  `generationMode`, `outputValidationWarnings`, and `generationError` before
  the JSON ever leaves the server — the same internal-field discipline the LLM
  Provider Boundary above already requires, enforced at a public rather than
  workspace-only response.
- generated output is shown to readers **without editorial review**, unlike
  Editorial Enrichment's suggest → apply flow. All responses always carry a
  `disclaimer` field, and the client widgets render it in the same paint as
  the result so unlabeled AI content is never visible.

Production-grade rate limiting for these routes is not implemented (see
"public LLM route rate limiting" below) — the per-key cache is the only cost
control in this prototype. The combined cache space remains bounded:
technology pairs (compare), published technologies × 3 levels (explain), and
published technologies × 1 (learning path). This is acceptable for a
local-first, mock-provider-by-default prototype but must be revisited before
any real-cost LLM provider is configured for a publicly reachable deployment.

## Remaining Production Gaps

- real authentication and authorization
- per-user audit history
- database-backed locking and transactions
- secure secret storage
- provider credential rotation and secret vault integration
- CSRF protections for authenticated browser mutation flows
- deployment-level rate limiting and bot protection
- public LLM route rate limiting (currently bounded only by per-pair caching, see "Public LLM Feature Boundary" above)
- production observability and alerting
- database-backed referential integrity and transactions
- production database migrations and encrypted credential storage
- audit event retention, export, and compliance policy
