# Security Boundary v0

This document defines the current safety boundary between public product pages and internal operational surfaces.

## Public Surfaces

Public routes can be exposed:

- `/`
- `/technologies` (five views via `?view=`: 精选 default, 全部快讯 — the
  auto-aggregated news fast lane, see "News Fast Lane Boundary" below for
  the exact candidate-field allowlist — 按话题, 我关注的, and 稍后读 —
  followed topics, reading marks (已读 / 稍后读) and the last-visit set
  behind the 新 stamps are browser-localStorage only (the 阅读码 export /
  import runs in the browser too), the route serves the same published content to everyone and holds no
  per-reader server state — except, for a reader who turns on
  「有新信号时提醒我」, the push subscription with its followed topics
  ("Reader Push Boundary" below); `/news` and `/timeline` redirect here
  to the matching view)
- `/technologies/[slug]`
- `/digest` (archive index; renders only published digests through the same
  public-copy sanitizers as the digest pages — date, public title/summary,
  and section counts, never editorial notes or manual adjustment ids)
- `/digest/today`
- `/digest/[date]`
- `/digest/weekly` and `/digest/weekly/[week]` (public weekly review — a
  derived view over published technology signals, same published-content
  boundary as the digest; no AI, no internal fields;
  `/digest/weekly/[week]` 404s for a non-canonical key or a signal-less week.
  The one persisted input is the week's editor-written 本周总结, read only
  through `getPublishedWeeklySummaryText` in `src/lib/weekly-summary.ts`:
  the text of a `published` record, withheld when it trips the
  internal-copy guard; no status, timestamps or AI metadata. Drafts never
  reach the page or the RSS — `weekly-summary.test.ts` pins both)
- `/digest/weekly/feed.xml` (weekly-review RSS — derived from the same
  `getWeeklyReview` view as the pages, so it carries only public signal
  titles, week ranges and priority grouping, plus a week's published
  本周总结 as plain text; no AI, no internal fields, no drafts)
- `/skills`
- `/skills/[slug]`
- `/knowledge`
- `/knowledge/[slug]`
- `/network`
- `/sources` (publisher directory; derived only from published signals'
  publisherName / publisherType / sourceName / publishDate / slug / public
  title by `src/lib/source-directory.ts`, whose test pins the output fields.
  Distinct from the internal `/workspace/sources`: no feed URL, import
  status, source health, quality metric or candidate reaches it. Outside
  `protectedPathPrefixes` and outside `build:public`'s excluded
  directories; `validate:deployment` asserts it stays public)
- `/radar` (technology radar; rendered only through `toPublicRadarEntries`
  in `src/lib/radar.ts`, which picks fields by name — number, name, slug,
  quadrant, ring, ring reason, derived change, resolved evidence / knowledge
  / skill titles and slugs, history — and resolves ids only against
  published content. Workspace status, timestamps, raw ids and draft
  entries never reach it; `validate:deployment` writes a draft and asserts
  it stays off, and asserts the key set of every entry. The console that
  edits it, `/workspace/radar` and `/api/workspace/radar`, is under the
  guarded prefixes and absent from `build:public`)
- `/about` (fixed copy explaining how signals are picked; reads no runtime
  content, so no field of any kind reaches it. It names, without values,
  what leaves the browser: AI requests go to the model provider, the rate
  limiter counts per address in process memory, Cloudflare sees the
  address)
- `/topics` (topic index; published counts per topic from the same three
  public pools as the hubs, no internal fields; not a nav entry)
- `/topics/[tagId]` (topic hub; a drill-down destination reached via
  `FollowableTagList` chip links or `/topics`, not a global nav entry —
  merges a tag's published technologies, skills, knowledge, and direct
  `getContentGraph()` neighbors; `notFound()` for an unknown or empty tag;
  its 关注此话题 switch writes the same browser-localStorage follow state as
  the tag chips, with no server-side state)
- `/topics/[tagId]/feed.xml` (per-topic RSS of published technology
  signals only — same published-content boundary as `/feed.xml`; imported
  candidates, drafts, and internal fields never enter it; 404 for unknown
  or signal-less topics)
- `/technologies/feed.xml` (RSS of the newest 50 published technology
  signals — same published-content boundary as the topic feed and rendered
  by the same `renderSignalRssXml`; imported candidates, drafts, archived
  records and internal fields never enter it; the item list re-checks
  `status === "published"` locally)
- `/search` (keyword plus local-embedding search over published technology
  signals, skills, knowledge, and the news fast lane; matching covers only
  title / summary / tag display names, results are identical for everyone,
  and news results go through the same `src/lib/news.ts` mapping as the
  全部快讯 view — including the fixed 自动聚合 disclaimer on the news group,
  so search is a compliant fast-lane surface rather than a new
  candidate→public mapping point. The embedding model runs in-process and
  calls no API; only the three published graph pools are embedded — never
  candidates, not even the sanitized news items — and the vector cache in
  `.cache/search-embeddings.json` holds vectors of already-public text
  only. It is unauthenticated and unthrottled because a query costs local
  CPU, about 10–20ms once the model is loaded, not a provider bill)
  The 内容相近的信号 section on signal pages reads the same vectors
  (published signals only) and adds no route.
- `/feed.xml`
- `/feed.json`
- `*/opengraph-image` on the signal, digest, weekly-review week, skill,
  knowledge and topic routes (1200×630 share images painted from the same
  public fields the page renders; anything the page would 404 on gets the
  site card)
- `/signal-vectors.json` (2026-10-13; the recommendation data file —
  vectors + public card fields — for the browser-side 和你读过的相近). Each
  entry is a published signal's hashed key (`toVisitKey(id)`, not the id),
  slug, title, 80-character gist, date, band label and topic ids — fields
  the list page already renders — plus its centered, quantized search
  vector; nothing else. `buildSignalVectorFile` writes each entry field by
  field and keeps a corpus document only when its id belongs to a published
  signal; `validate:deployment` asserts the published-only rule, a fixed
  key whitelist (`signalVectorEntryKeys`) and that no raw id appears, and
  was shown to fail on an unpublished document and on an extra `id` key.
  The request takes no parameters and no cookies and the response is the
  same for everyone; the reader's 已读 / 稍后读 marks and followed topics
  stay in localStorage and are matched in the browser. The browser asks for
  the file only once the reader has at least one mark, so the request itself
  says only that this browser has some reading history — never which. The
  vectors are of already-public text, the same ones `/search` uses)
- `GET /api/health` (liveness for an external monitor; reports the build id,
  uptime, published-signal count and search-model state — nothing a reader
  could not infer from the site, no paths or env)
- `POST /api/technologies/compare`
- `POST /api/technologies/explain`
- `POST /api/technologies/learning-path`
- `/ask` and `POST /api/ask`
- `/manifest.webmanifest`, `/sw.js`, `/offline` and `/pwa/signal-paths.json`
  (the installable site and offline 稍后读; the map is keyed by hashed id
  and lists published signals only, `validate:deployment` pins both)
- `GET /api/push/config`, `POST /api/push/subscribe`,
  `POST /api/push/unsubscribe` (a reader's own alert subscription — see
  "Reader Push Boundary" below)
- `/en` and `/en/...` (2026-10-14): the English twin of every public page
  above except the feeds, the API routes, the PWA files and `/offline`; same
  getters and mappings as the Chinese page — see "English Interface
  Boundary" below

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

The title, summary and source URL pass through `src/lib/text-sanitize.ts`
(tags stripped, entities decoded) before entering the public shape, both at
import and again in `src/lib/news.ts`, so a feed that ships escaped HTML
cannot put markup in front of readers.

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

**Undecided candidates are public, and that is the design.** The status filter
removes `rejected` only, so a candidate whose effective `importStatus` is still
`new` renders to readers from the moment it is imported until an editor
dispositions it. That is what "未经编辑精选" means, and it is why the
disclaimer is not optional — but the consequence is worth stating in numbers,
because it is not obvious from the rule:

- The lane's composition is driven by **publish rate**, not by source quality.
  Daily tech-media sources produce roughly an order of magnitude more items per
  day than vendor blogs and release feeds, so between an import and the next
  editorial round they dominate the public page.
- Measured 2026-08-10, the day the per-source cap went 4 → 12 and two
  Chinese-language media sources were added: **before that day's round the lane
  showed 33 items, 22 of them (67%) from those two sources**, roughly 15 of
  which were industry PR. **After the round it showed 16 items with 6 from
  those sources**, all of them real. Nothing about the sources changed — only
  whether an editor had looked yet.
- `npm run measure:news-lane` reports the current composition per source and
  how many of the visible items are still undecided. It is read-only and
  respects `LOCAL_DATA_DIR`. `/workspace/sources` already reports per-source
  success / duplicate / conversion rates and a quality level
  (`evaluateSourceQuality`), so this command deliberately does not recompute
  them — it answers the different question of **what a reader is looking at
  right now**.

Two options were measured and **not** taken on 2026-08-10 (see `CHANGELOG.md`
→ "The intake was the bottleneck" and the editorial-round entry): lowering a
noisy source's item cap, which would have cost that source both of its real
signals because they sat at feed positions #8 and #10; and restricting the lane
to dispositioned candidates, which removes the exposure entirely but makes a
public page depend on the editorial round running on schedule — a coupling this
repository has already been bitten by (9 missed scheduled days, plus 5 runs
killed by a console `Ctrl+C`).

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

## Public Build Boundary (`npm run build:public`)

The workspace guard below is a **request-time** lock. `npm run build:public` adds
a **build-time** one: it moves the directories that produce every guarded prefix
out of the tree, runs `next build`, and puts them back. A route that is not in
the build cannot be reached by a misconfigured env var, a middleware that fails
to load, or a token that leaks.

That second lock is not hypothetical hardening. The guard is **off by default**
(`WORKSPACE_ACCESS_ENABLED=false` in `.env.example`), and it has already shipped
inert once — until 2026-07-27 `middleware.ts` sat at the repository root, which
a `src/`-directory project ignores **silently**, so `/workspace` answered `200`
to anyone. Reading the guard's source proved nothing then and proves nothing now.

Excluded directories (`EXCLUDED` in `scripts/build-public.mjs`), one per prefix
in `protectedPathPrefixes`:

| directory                     | route prefix           |
| ----------------------------- | ---------------------- |
| `src/app/workspace`           | `/workspace`           |
| `src/app/api/workspace`       | `/api/workspace`       |
| `src/app/api/candidates`      | `/api/candidates`      |
| `src/app/candidates`          | `/candidates`          |
| `src/app/technologies/drafts` | `/technologies/drafts` |

Measured 2026-09-08, with a full build as the control — a clean result means
nothing unless the control shows the routes were there to remove:

- full build: **96 routes, 69 of them workspace**
- public build: **27 routes, 0 workspace** (96 − 69 = 27)
- served from the public build: 15 public routes at `200`, and `/workspace`,
  `/workspace/sources`, `/workspace/editorial-round`, `/api/workspace/*`,
  `/api/candidates/*`, `/candidates`, `/technologies/drafts` all **`404`** —
  not `401`, because they do not exist
- the 内部工作台 nav entry appears in 1 client chunk of the full build and **0**
  of the public build (`NEXT_PUBLIC_WORKSPACE_UI=off`, set by the script)
- the three public AI routes still answer (`400` on an empty body, i.e. present),
  and a seven-string internal-field scan over four public surfaces is clean

Two invariants keep this from rotting:

1. `validate:deployment` asserts `EXCLUDED` covers every prefix in
   `protectedPathPrefixes` and that each excluded directory exists — so a prefix
   added to the guard but not to the build script fails immediately, without
   needing a build. Proven to fire by adding `/admin` to the guard alone
   (and confirming the injection reached the file first — the repo's CRLF line
   endings silently defeated the first attempt, which then "passed").
2. The script reads the emitted route manifest after building and exits non-zero
   if a workspace route appears, so the claim rests on the build output rather
   than on the script's own bookkeeping.

The middleware is still in the public build, deliberately: it costs nothing and
it still guards if a route is ever added back. Since 2026-10-14 it also runs on
every page request to set the interface-language header (see "English
Interface Boundary" below), so it carries six matchers: the five guarded
prefixes and one for pages.

**Two side effects of `next build` are captured and restored** (`tsconfig.json`
and `next-env.d.ts`). Next appends `<distDir>/types/**/*.ts` to the tsconfig
`include` and leaves it there; because the repo's `include` is `**/*.ts`, a
leftover glob from a verification build points at generated route types for the
workspace routes the public build removes, and the typecheck then fails on
modules that are correctly absent. Hit for real while building the control.

## Minimal Access Protection

`src/middleware.ts` protects workspace/internal paths when:

```bash
WORKSPACE_ACCESS_ENABLED=true
```

The token comes from:

```bash
WORKSPACE_ACCESS_TOKEN=...
```

The middleware accepts Bearer token, Basic auth password, or `x-workspace-access-token`. User-facing routes do not require this token.

This is intentionally small. It is not a replacement for production login, per-user roles, audit trails, or session management.

**Where a workspace request came from is checked before the token, and even with the guard off** (2026-10-14, `checkWorkspaceRequestSource` in `src/lib/workspace-access.ts`). An editorial round runs the unguarded workspace on a local `next dev` pointed at the live data, and the routes read their body with `request.json()`, which ignores the content type — so until that date any page open in the editor's browser could send a `text/plain` POST (a "simple" request, no preflight) and create a source, publish, deliver or push. Now:

- a write (anything but GET / HEAD / OPTIONS) is refused with `403` when `Sec-Fetch-Site` is `cross-site` or `same-site`, or when an `Origin` header — `null` included — does not name the request's own host. Scripts (`scripts/workspace-fetch.mjs`, curl) send neither header and pass;
- outside production the `Host` must be a loopback name (`127.0.0.1`, `localhost`, `[::1]`, `*.localhost`) or one listed in `WORKSPACE_ALLOWED_HOSTS`, so a DNS-rebinding page cannot read the workspace as same-origin. Production is left alone: the public build has no workspace routes.

The three workspace GET routes only read, which is why reads skip the first rule. `src/lib/workspace-access.test.ts` and `src/middleware.test.ts` pin both rules.

## English Interface Boundary (`/en`, 2026-10-14)

Every public page has an English twin under `/en`. The twin reads the same
public getters through the same public mappings as the Chinese page — only the
interface strings and the choice between already-public language fields
(`title.en` / `original` / `zh`) differ — so it adds no new field to any
public surface and no new route that reads internal data.

- **No English twin for anything guarded.** `/workspace`, `/api/*`,
  `/candidates` and `/technologies/drafts` have no `/en` address, and
  `src/app/en/` holds no route under them. `validate:deployment` asserts
  both: no protected prefix has an `/en` twin, and every public page route
  has one (shown to fail with `/en/sources` removed).
  `validate:workspace-boundary` also scans `src/components/pages/` and
  `src/app/en/` for workspace imports (shown to fail on an injected one).
  `build:public` needed no change: the excluded directories are the same and
  the English routes are public.
- **The middleware now runs on page requests** to set `x-site-locale`, which
  the root layout reads for `<html lang>`. It always overwrites a value the
  client sent, and it only ever selects between two interface languages, so a
  forged header changes the `lang` attribute of that one response and
  nothing else. The page matcher skips `_next/`, `api/`, `icons/` and
  static file extensions. Every guarded prefix keeps its own matcher, and
  `validate:deployment` checks with `unstable_doesMiddlewareMatch` that each
  prefix in `protectedPathPrefixes` is still matched and still answers 401 /
  503 with the guard on — a page matcher that swallowed them would otherwise
  be invisible.
- **Nothing new leaves the server.** The English AI widgets and 问雷达 call
  the same routes with the same bodies, and answer in Chinese; feeds have no
  English version (their titles say 「in Chinese」 on English pages).

## Delivery Secrets

Delivery channel endpoint URLs belong to the Internal Workspace only. The workspace list masks sensitive query parameters such as token, key, secret, signature, and auth. Delivery logs store payload previews and response previews, but not full endpoint URLs.

**Secrets in the path** (2026-10-13). Three platforms put the secret in the URL path, where a query mask never looked: a Feishu hook ends in `/open-apis/bot/v2/hook/<token>`, a Discord webhook in `/api/webhooks/<id>/<token>`, and the Telegram Bot API addresses a bot as `/bot<id>:<secret>/`. Until that date the delivery list displayed a Feishu address in full. `maskEndpointUrl` and `maskSecretsInText` in `src/lib/secret-masking.ts` now mask all three, plus a bare `<id>:<secret>` bot token in free text, and run in the endpoint display, workflow-event snapshots (a `token` / `secret` / `password` key that holds a non-URL string becomes `[redacted]`), operations text, task-runner messages, delivery error messages and response previews, and the source health history's error summaries. Tests pin each form, and `validate:delivery-channels` was shown to fail with the Feishu mask removed.

**The Telegram bot token** is stored on the channel in `config/delivery.json` (or the SQLite payload) and read only by `delivery-workflow.ts` and the Telegram adapter, which builds the request URL in memory. Every other read — the workspace pages, the channel API answers, scheduled delivery — gets `toClientDeliveryChannel`, which drops the token and carries `botTokenMasked` (`<bot id>:***`); this matters because the delivery page passes channels to a client component, so a token in that object would ship to the browser. The edit form never prefills it: blank means "keep the stored one". It is never in a `DeliveryRun`, a workflow event or a log. The Discord and Feishu webhook addresses are still shown in full in the edit form, as webhook addresses always have been (masked in the list).

The current local JSON store may still contain configured endpoint URLs for local operation. Do not put production webhook secrets in committed files. A production deployment should use a secret manager or encrypted credential storage.

## Persistence Boundary

Local JSON and local SQLite are implementation details for the current controlled prototype. They are not production secret stores.

Internal workflow stores may contain raw payloads, source URLs, delivery channel endpoints, request/response previews, schedule metadata, task-runner audit messages, and workflow event before/after snapshots. These records must stay behind workspace access protection and must not be mapped directly into public pages or public feeds.

When `PERSISTENCE_DRIVER=sqlite`, the same boundary applies to `config/ai-tech-radar.sqlite` or the configured `SQLITE_DATABASE_PATH`. The SQLite file may contain internal workflow data and delivery endpoint URLs, so it must not be served as a static asset or committed with production secrets.

The safe public mapping is still explicit:

- published workspace technology records are converted to safe `TechnologyItem` shape before public rendering; the public shape carries no `priority` ranking object (score, raw reasons, warnings, and ranking source are internal-only), so ranking internals never enter the RSC payload of client components — public surfaces derive the productized priority level on demand via `evaluateTechnologyPriority`. The same mapping also strips `intelligenceStatus` (added 2026-07-28): it is an editorial workflow state (`draft` / `reviewed` / `needs_enrichment`) that no public surface reads, and shipping it told readers which records the editors consider unfinished. `validate:ranking` asserts both absences
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
- radar workspace records (`config/radar-workspace.json`) reach `/radar`
  only through the merged read in `getMergedPublicRadarEntries` and then
  `toPublicRadarEntries`: draft records are dropped, a draft record hides
  its seed, and the public entry carries no status, timestamps or ids
- link relation overrides (`config/link-relation-workspace.json`) carry only
  the same public fields the seed `LinkRelation` entries already expose
  (pair, relation type, note) and reach public pages through the merged
  read in `getAllLinkRelations`; the editing surface
  (`PUT /api/workspace/relations`) stays behind the workspace boundary
- JSON-LD on public pages is built by `src/lib/structured-data.ts`, which picks fields by name from the public shapes the pages already render; ranking, `intelligenceStatus`, editorial notes and workspace fields cannot appear, a non-published technology yields no output, and the workspace preview never renders it. The serializer escapes `<`, `>`, `&` and U+2028/2029 so content cannot close the script element
- delivery channels, delivery logs, schedules, task-runner records, and workflow events are workspace-only

`npm run validate:persistence` provides a lightweight consistency and isolation check for local workflow data. `npm run validate:database` repeats the critical reference and public-field checks against both JSON and SQLite driver modes. Since 2026-09-24 every `validate:*` script runs against a throwaway copy of the data directory made by `scripts/run-ts-validation.cjs`, so a validator can never write a fixture into the live store; `VALIDATION_DATA_DIR=live` is the explicit opt-out. Store writes are temp-file-then-rename, and a store file that no longer parses throws rather than being read as empty and then overwritten.

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

Candidate triage (`POST /api/workspace/triage-suggestions`, 2026-09-23) is a
workspace-only caller: it lives under `/api/workspace/*`, so it is both behind
the token guard and physically absent from `npm run build:public`. Its output —
a decision, a confidence and a reason per candidate — stays in the workspace and
never reaches a public page or feed. The eval script (`npm run eval:triage`)
reads `.env.local` itself because a plain Node script does not get Next's env
loading; the key is only ever read, never printed or written.

「AI 起草」 (`POST /api/workspace/candidates/[id]/ai-draft`, 2026-10-13) is
the same kind of caller: under `/api/workspace/*`, so guarded and absent from
the public build. It fetches the candidate's source URL server-side (15-second
timeout, 1.5 MB read cap) and sends the article text to the provider. The
draft it writes stays `draft`; its `aiDraft` metadata (model, prompt version,
tokens) and the generation events stay in the workspace — the public mapping
picks fields by name and does not copy them.

「AI 起草导语」 (`POST /api/workspace/digests/[date]/ai-summary` and
`POST /api/workspace/weekly-summaries/[week]/ai-summary`, 2026-10-13) are
the same kind of caller, and narrower: they send only published signals'
public fields (title, summary, why-it-matters, publisher, date) and write
nothing — the draft comes back to an editor's text box, and only the
editor's save writes it. Model, prompt version and tokens are in the
response (workspace-only) and in a workflow event, never on the digest or
the weekly summary record. A published weekly summary carries no AI
disclaimer because an editor confirmed it; a digest's `editorialSummary`
never did.

The current local JSON and SQLite stores may contain workspace-only suggestion metadata. They are not production secret stores. Production deployments should keep provider credentials in environment-managed secret storage and should not commit local data files containing real provider or delivery credentials.

## Public LLM Feature Boundary (Comparison v0 + Explanation v1 + Learning Path v2)

`POST /api/technologies/compare` was the first public route that calls the LLM
provider directly; `POST /api/technologies/explain` and
`POST /api/technologies/learning-path` follow the identical discipline. All
three are intentionally left outside `src/middleware.ts`'s protected path prefixes
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

Three cost controls apply, in this order:

1. **Rate limit** (added 2026-07-27, `src/lib/rate-limit.ts` +
   `src/lib/public-ai-rate-limit.ts`). Each route runs a per-client
   sliding-window check before body parsing, before the cache lookup, and
   therefore before any provider call, and returns `429` with a
   `Retry-After` header once the budget is spent. Since 2026-10-14 the
   header-only `Content-Type` / `Origin` check (below) runs first, so a
   request it refuses does not use up the visitor's budget; then the body is
   read with a cap — 16 KB, 64 KB for `/api/ask` — and anything larger gets
   `413` (`readJsonBodyWithLimit`).
   Defaults: 10 requests per minute and 40 per hour, per client **per route**
   (buckets are keyed `routeId:clientKey`, so exhausting compare does not block
   explain). Override with `PUBLIC_AI_RATE_LIMIT_PER_MINUTE` /
   `PUBLIC_AI_RATE_LIMIT_PER_HOUR`. The `429` body carries only a generic
   Chinese message; it leaks no provider, quota, or client detail.
2. **Site-wide daily cap** (added 2026-10-20, `src/lib/public-ai-daily-cap.ts`).
   The per-client limit bounds one address; nothing bounded the total, so a
   caller with many addresses had no ceiling. Now the four routes together
   make at most `PUBLIC_AI_DAILY_LIMIT` model calls per Asia/Shanghai
   calendar day (default 500, `PUBLIC_AI_DAILY_LIMIT_DEFAULT`; an unset or
   invalid value means the default), then `429` with the same generic
   message and `Retry-After` set to the seconds until 00:00 Beijing time.
   The check runs in `guardPublicAiRequest` **after** the per-client limit
   and before the body is read, so one address burning the budget is stopped
   by its own bucket first and a refused cross-site call never counts.
   **A cache hit does not count**: the check only reads the count; the three
   cached routes count in a hook that fires once the cache lookup has missed,
   right before the provider is called (`AiGenerationCallHooks.onProviderCall`),
   and `/api/ask`, which has no cache, counts every well-formed question just
   before it runs. The count is the file `config/public-ai-usage.json`
   (`{ day, total, byRoute, updatedAt }`, git-ignored, one `runtime_configs`
   row under SQLite), written temp-then-rename like every store, so the
   2–3-second restart of a deploy does not start the day over; a record from
   another day reads as zero and is replaced by the next counted call. A file
   that does not parse reads as zero (logged) — the one store where falling
   back to empty is right, since throwing would turn every public AI request
   into a `500` over one day's count. Two requests arriving together can
   both pass the check and both count, so the day can end a few calls over
   the limit; it is a budget, not a lock. `/workspace/operations` shows the
   count (今日公开 AI 调用 N / 500, per route) and pins a warning at 80% and a
   critical item at 100%; `/api/health` does not carry it.
3. **Per-key result cache**, unchanged. The combined cache space remains
   bounded: technology pairs (compare), published technologies × 3 levels
   (explain), and published technologies × 1 (learning path).

What the limiter deliberately does **not** claim to be: it is in-memory and
per-process (a multi-instance deployment multiplies the effective budget; the
daily cap, being a file in the data directory, is shared by every process that
reads that directory). It is a cost guardrail, not bot protection;
deployment-level rate limiting stays on the gap list below. Before configuring a real-cost provider for a publicly
reachable deployment, review the budgets against expected traffic rather than
assuming the defaults fit.

**The client key was spoofable behind the tunnel until 2026-09-24.** It was
read from the _first_ hop of `x-forwarded-for`; Cloudflare appends the address
it saw to a header the client already sent rather than replacing it, so the
first hop was whatever the caller wrote, and rotating it gave a fresh bucket
per request — while a real DeepSeek key was configured. The key is now taken
from `CF-Connecting-IP` first (the header Cloudflare sets itself), then
`x-real-ip`, then the _last_ hop of `x-forwarded-for`. Anything that reaches
the server without going through the proxy can still set all of these, which
is why the server listens on `127.0.0.1` only since 2026-09-28
(`next start -H 127.0.0.1` in `package.json`): before that, the machine's LAN
address answered `200`, and with the loopback binding the same request is
refused. What is left is a process on the machine itself, which can already
read the store directly. `npm run deploy` re-checks the binding after every
restart — see `docs/deployment.md` → "Keeping the site running". An IPv6
address counts by its `/64` (`toRateLimitBucket`, 2026-10-14): one connection
is usually handed a whole `/64`, so keying on the full address gave a fresh
bucket per address.

**A second guard stops other websites from spending the budget through their
visitors.** A `text/plain` POST is a "simple" cross-origin request that
browsers send without a preflight, so any page could `fetch()` these four
routes and every visitor would count as a fresh client. The routes now require
`Content-Type: application/json` (`415` otherwise), which turns a cross-origin
call into a preflighted one that fails for want of CORS headers, and reject
`Sec-Fetch-Site: cross-site` or a foreign `Origin` with `403`
(`checkPublicAiRequestOrigin` in `src/lib/public-ai-rate-limit.ts`). A script
talking to the server directly is unaffected; that is the rate limit's job.
Since 2026-10-14 the content type is compared as a media type (the part
before `;`), so `text/plain; x=application/json` is a `415`, and an `Origin`
that names no host — `null` from a sandboxed frame — is a `403`. The check
runs before the rate limit, so a refused cross-site call costs the visitor
nothing.

## 问雷达 (`POST /api/ask`)

The fourth public LLM route, and the first with **no result cache**: every
question is new, so the per-client rate limit (route id `ask`, same 10/minute
and 40/hour defaults), the site-wide daily cap (2026-10-20; every well-formed
question counts, since nothing is cached) and a 700-token cap per round are
the whole cost guard.
Measured on the eval set, a question costs about 4,000 prompt tokens over 3.3
tool calls. Like the other three it is checked before the body is read.

- **What the model can reach**: two tools only, both over published content —
  hybrid search across signals, skills and knowledge, and the body of an item
  that search already returned. Candidates, drafts, the news lane and every
  workspace store are out of reach; there is no tool that takes a free-form
  path or URL.
- **What leaves the server**: newline-delimited events carrying status text,
  the retrieved items' public title/href/kind, answer text and the cited /
  invalid reference numbers. No provider name, model name, prompt, token
  count or raw error; a failure becomes one generic message and a server-side
  warning.
- **What the reader is told**: the same 「AI 生成内容，未经编辑审核，仅供参考」
  disclaimer as the other AI features, rendered above the answer; a citation
  number that no tool returned is shown struck through rather than linked.
- **Arriving from `/search`** pre-fills the question but does not submit it,
  so a navigation never spends a model call. A suggested example question is
  filled into the box on click, not submitted, for the same reason.
- **复制答案** assembles its text from what the page already shows and
  sends no request; 复制整段对话 does the same for a conversation.
- **追问** (2026-10-13) keeps the server stateless: the page holds the
  conversation in memory and sends, with each follow-up, the earlier
  questions and answers and the `{ ref, key }` pairs it has shown. Nothing
  else from the client is trusted — each key must match `T: / S: / K:` +
  slug and is read again from published content, so titles, links and kinds
  come from the server, and an unknown or unpublished key is dropped (a later
  citation of its number then reads as invalid). Earlier answers are context,
  never sources, and are capped (600 characters each, 2,400 in all, oldest
  dropped), so a forged history costs at most about 2,000 extra prompt
  tokens per round — about twice a first question's prompt in the worst
  case, measured 4,941 → 5,971 tokens on a real two-turn run. At most 5
  questions per conversation (a sixth is a 400). The rate limit counts every
  follow-up, and the refusal rule and the disclaimer apply to every turn.

## Reader Push Boundary (2026-10-13)

「有新信号时提醒我」 is the first per-reader state the server keeps, so it is
opt-in, minimal and deletable:

- **What is stored** (`config/push-subscriptions.json`, git-ignored; a
  `runtime_configs` row under SQLite): the push endpoint the browser's push
  service issued, its `p256dh` / `auth` keys, the followed topic ids, and
  `createdAt`. The record id is a hash of the endpoint. No IP, no user
  agent, no reading marks — the subscribe route reads nothing from the
  request but its JSON body, and the unit test pins the record's key set.
- **What leaves the server**: the subscribe route answers
  `{ subscribed, topicCount }` and nothing stored
  (`toPublicPushSubscriptionResult`); the workspace panel shows counts per
  topic only; push WorkflowEvents carry counts and the push service's
  hostname, never an endpoint or id. The notification itself is encrypted
  for the browser (RFC 8291), so the push service sees only that a message
  went to that subscription.
- **Who can change a record**: the endpoint is a bearer address, and
  changing topics or unsubscribing also needs its `auth` secret (`409`
  otherwise), which only the subscribing browser holds.
- **Where the server will POST**: only to `https` endpoints on the browser
  push services (`fcm.googleapis.com`, `*.push.services.mozilla.com`,
  `*.notify.windows.com`, `*.push.apple.com`; `allowedPushServiceHosts`).
  Without that list a forged subscription could make the server send
  requests to any address it reaches, including `127.0.0.1`. `redirect:
"error"` keeps a push service from bouncing the request elsewhere.
- **Cost guard**: both public routes run the same `Content-Type` /
  `Sec-Fetch-Site` / `Origin` check as the AI routes, then a per-client
  limiter (20/min, 120/h, buckets per route), then read at most 16 KB of
  body (`413` past it), so another site cannot subscribe its visitors'
  browsers here; the store is capped at 10,000 records.
- **Deletion**: turning alerts off, unfollowing every topic, or the push
  service answering 404 / 410 on the next send deletes the record. /about
  says so in the reader's terms.
- **Sending** is workspace-only (`POST /api/workspace/push`, under the guard
  and absent from `build:public`) and manual.
- **The service worker** never intercepts `/workspace`, `/api`,
  `/candidates` or `/technologies/drafts`, so no internal response can end
  up in a browser cache; it caches only public pages the reader saved, the
  offline shell and hashed static files, under names carrying the build id.

## Remaining Production Gaps

- real authentication and authorization
- per-user audit history
- database-backed locking and transactions
- secure secret storage
- provider credential rotation and secret vault integration
- CSRF protections for authenticated browser mutation flows
- deployment-level rate limiting and bot protection (the public LLM routes now
  carry an in-process per-client limiter — see "Public LLM Feature Boundary"
  above — but a shared, spoof-resistant limit still belongs at the proxy or
  platform layer)
- production observability and alerting
- database-backed referential integrity and transactions
- production database migrations and encrypted credential storage
- audit event retention, export, and compliance policy
