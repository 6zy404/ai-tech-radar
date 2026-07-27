# Changelog

This file records the version-by-version feature history of the AI Tech Radar
prototype. It is the historical companion to `README.md`, which describes the
**current** state of the project.

The prototype is pre-release, so entries are grouped by feature milestone rather
than by semantic version or release date. Milestones are listed newest-first.
For per-topic deep dives, see the `docs/` directory.

> Migration note: this changelog was extracted from the README's running feature
> log so that the README can stay focused on the current state. Earlier entries
> were reconstructed from that log and may not carry exact dates.

## Public AI route rate limiting (go-live checklist I1)

- **The three public LLM routes are no longer uncapped** — 2026-07-27, the
  last in-repo item of the production-readiness checklist
  (`docs/production-readiness.md` → I1). `POST /api/technologies/compare`,
  `/explain`, and `/learning-path` are unauthenticated by design (they only
  read already-published content), and until now the **only** cost control was
  the per-key result cache: a caller walking through new technology pairs,
  reader levels, or technologies triggered one provider call each, with
  nothing bounding the rate. Harmless under the default mock provider, an open
  cost vector the moment a real `LLM_API_KEY` is configured.
  New `src/lib/rate-limit.ts` is a framework-free sliding-window limiter
  (multiple rules per limiter, insertion-ordered `Map` so key eviction past a
  tracking cap is a front-of-map walk, and — the detail that matters — a
  **rejected attempt is not recorded**, so hammering while blocked cannot push
  the recovery time further out). `src/lib/public-ai-rate-limit.ts` owns the
  policy: 10 requests/minute + 40/hour per client **per route**
  (`routeId:clientKey` buckets, so exhausting compare leaves explain usable),
  overridable via `PUBLIC_AI_RATE_LIMIT_PER_MINUTE` /
  `PUBLIC_AI_RATE_LIMIT_PER_HOUR`. The check is each route's **first**
  statement — before body parsing, before the cache lookup, therefore before
  any provider call — and returns `429` with `Retry-After` and a generic
  Chinese message that leaks no provider, quota, or client detail. The three
  reader widgets needed no change: they already render `payload.error`, so the
  message surfaces in place. Documented honestly as a **cost guardrail, not
  bot protection**: the limiter is in-memory/per-process (a multi-instance
  deploy multiplies the budget) and the client key comes from
  `x-forwarded-for` / `x-real-ip`, which a caller can rotate — with no proxy
  in front every caller shares one bucket, which still caps total provider
  calls. Verified: typecheck, lint, format, vitest 117/117 (9 new tests
  covering window sliding, the no-credit-for-rejected rule, multi-rule
  recovery governed by the longer window, per-key isolation, and cap
  eviction), plus a live pass against `next dev` — 10 × `400` then `429` with
  `Retry-After: 60` on the 11th, a different client IP and the other two
  routes each unaffected (separate buckets), the explain widget still
  rendering a real generated result with its disclaimer, and the `429` message
  rendering in the widget's error slot with zero console errors.

## SQLite driver parity (six missing store adapters)

- **`PERSISTENCE_DRIVER=sqlite` stopped losing every workspace-created
  skill, knowledge entry, and relation override** — 2026-07-28, fixing the
  `validate:database` failure tracked since the 2026-07-27 fixture purge. The
  diagnosis went further than the tracked note ("the driver only seeds
  `src/data` statics"): **six stores had no SQLite adapter at all**, and the
  two halves of the dispatch failed differently.
  `readSqliteJsonStore` fell through to `default: return fallbackValue`, so in
  sqlite mode `skill-workspace.json`, `knowledge-workspace.json`, and
  `link-relation-workspace.json` read as empty (the copy-on-write overlay
  vanished — 13 skills and 18 knowledge entries dropped back to the seed
  pools, and the typed relations reverted to seed defaults), the two schedule
  configs (`scheduled-import.json`, `scheduled-digest.json`) reset to their
  defaults on every read (so `nextRunAt` never persisted — the task runner
  would have treated the import as due on every pass), and the three public AI
  result caches never hit (every compare/explain/learning-path request would
  re-call the provider). `writeSqliteJsonStore` was the loud half: its
  `default` branch throws, so saving a skill, knowledge entry, relation, or
  schedule change in sqlite mode crashed outright.
  Fix: five new repository files following the existing per-domain pattern
  (`sqlite-skill-workspace-store.ts`, `sqlite-knowledge-workspace-store.ts`,
  `sqlite-link-relation-store.ts`, `sqlite-runtime-config-store.ts`,
  `sqlite-technology-ai-cache-store.ts` — the last two each cover more than
  one filename by design: the schedule configs are single objects, not record
  lists, so they share one `runtime_configs` key-value table, and the three AI
  caches are structural siblings), seven new schema tables with their key
  columns and indexes, both dispatch switches, and the new stores threaded
  through `migrateJsonStoresToSqlite` plus its two callers
  (`scripts/db-migrate-json.ts`, `scripts/validate-database.ts`). A missing
  single-object config is deliberately **not** written during migration, so a
  never-configured schedule keeps falling back to its default instead of being
  frozen into a row. `validate:database` now also asserts the new tables exist
  and — the regression guard that would have caught this in the first place —
  that both drivers serve identical skill and knowledge id sets
  (`validateWorkspaceOverlayParity`). Verified: the failing assertion
  reproduced first (`technology … references missing knowledge
knowledge-ws-36346103`), then typecheck, lint, format, vitest 108/108,
  `validate:database` / `persistence` / `tasks` / `digest` green, plus an
  isolated `LOCAL_DATA_DIR` + `SQLITE_DATABASE_PATH` round-trip in sqlite mode
  covering all four previously broken paths (skill create → draft hidden from
  the public pool → publish → visible; relation type + note persisted; a
  schedule config change surviving a re-read; a comparison cache hit on the
  same pair key) — the isolated directory ended up holding only the `.sqlite`
  file, confirming nothing fell back to JSON.

## Content round — quantization knowledge + build-vs-buy skill

- **知识「模型量化与数值精度」and 技能「AI 工具链选型与自建边界评估」
  published** — 2026-07-27, gap analysis over the 23 published signals right
  after that day's editorial round. Quantization had **no entry at all**
  despite being the substance of several signals — the MoE entry covers
  routing and the speculative-decoding entry covers decode, but nothing
  covered which layers tolerate low-bit storage, why mixed per-expert
  precision breaks decoding, or how quantization interacts with speculative
  decoding and graph capture. The build-vs-buy skill captures the reusable
  decision line the Copilot-vs-raw-API signal introduced (decide which layer
  you must own, _then_ compare price) and pairs with the existing
  「模型选型与约束匹配」knowledge. Both published through the workspace APIs
  with **zero publish-gate warnings**, 10 typed relations with notes, and
  reverse `relatedKnowledgeIds` / `relatedSkillIds` on 6 technology records
  (all slugs preserved). Pools: skills 12→13, knowledge 17→18. Verified with a
  9-check public pass (detail pages, indexes, technology detail back-links,
  `/network`, `/search`, the topic hub) plus zero console errors and no 375px
  overflow.

## Demo/validation fixture purge (go-live checklist B3)

- **The live stores no longer carry demo data that would ship as real
  content** — 2026-07-27, closing the last in-repo item of the
  production-readiness checklist (`docs/production-readiness.md` → B3). The
  finding was confirmed before acting: the fixture digest `2026-05-23`
  ("Delivery integration validation") was **published**, and genuinely
  reachable on `/digest`, `/feed.xml`, `/feed.json`, and its own page — the
  public-copy sanitizer hid the validation wording, not the record itself.
  Removed: 3 May validation digests, the 2 disabled `quality-*-source` fake
  sources with their 2 imported candidates and review-state entries, the 2
  leftover validation technology drafts (`editorial-enrichment-draft`,
  `draft-candidate-source-quality-failing-source-2026-05-30`), and 3
  "Validation …" delivery channels plus one orphaned delivery run. Deleting
  them is safe because the two validators that use these fixtures
  (`validate:quality`, `validate:editorial-enrichment`) construct them fresh
  and back up/restore the real stores in a `finally` block — the on-disk
  copies were leftovers from before that discipline. `validate:persistence`
  caught the one reference the first pass missed (a `DeliveryRun` still
  pointing at the deleted digest). Verified: the removed digest now 404s, no
  fixture string appears on any public or workspace surface, and 16
  `validate:*` scripts pass. `validate:database` fails, but **pre-existing and
  unrelated** (confirmed by re-running it at the pre-cleanup commit): the
  SQLite driver seeds only the `src/data` statics, so a published signal
  linked to a workspace-created skill/knowledge entry has no matching row in
  sqlite mode — tracked separately.

## Technology-to-technology relation editing + round triage flags

- **Published signals can finally be linked to each other, and undecided
  candidates carry their quality flags on the round console** — 2026-07-27,
  same session as the ranking/digest fix, from gaps hit while running that
  day's editorial round.
  `relatedTechnologyIds` was missing from `TechnologyWorkspaceRecordUpdate`,
  so it existed **only on the bundled seed data**: none of the 23
  workspace-published signals could be linked to another, and the 相关技术
  section on their detail pages was permanently empty (vLLM v0.26.0 could not
  point at the Inkling signal whose support stack it ships). The field is now
  in the update type, the `PATCH /api/workspace/technologies/[id]` parser, and
  the draft edit form as a third `RelationCheckboxItem` group, so
  technology↔technology links get the same relation type + note editing
  (LinkRelation v1) as knowledge and skills. The workflow drops a
  self-reference — it would render as a self-edge on `/network` — and the
  picker offers **published** technologies only, since a link to an
  unpublished draft would be a dead node. Verified end to end by linking
  `vllm-v0-26-0` → Inkling (印证) and → v0.25.0 (延伸) with notes: stored,
  self-reference dropped, slug preserved, and both rendering on the public
  detail page and `/network`.
  Separately, a new `prerelease_version` candidate quality flag matches a
  pre-release marker on a version-looking token (`v0.32.5-rc0`, `v0.26.0rc1`,
  `v1.0.0-beta.2`) — the single biggest class of round noise, 4 of 16
  candidates on 2026-07-27 and at least one in each of the three prior rounds.
  The first regex draft was rejected during verification for missing
  `v0.26.0rc1` (marker glued straight onto the digits) and false-positiving on
  prose like "Preview: …", so the match now requires the version context.
  `/workspace/editorial-round` renders each undecided candidate's
  review-blocking flags, so a round triages from one screen instead of opening
  every candidate — which is also the practical answer to the Hugging Face
  blog feed carrying **no `<description>` at all** (confirmed by fetching the
  feed directly; the official host is unreachable from this machine, so it is
  a source-data limitation, not a parser bug or a mirror artifact — those items
  simply surface as 缺少摘要 / 缺少正文 now). Review-readiness-only flags
  (`ready_for_review` / `not_convertible`) are deliberately excluded — they say
  nothing about whether an item is worth publishing. Verified with typecheck,
  lint, format, vitest 108/108 (1 new test), and a live pass (form renders 30
  technology options with self excluded and 2 pre-checked; flags render as
  "内容过短 预发布版本" on a briefly reopened candidate, restored afterwards;
  zero console errors).

## Ranking banding + digest fresh-first selection

- **Editorial banding replaces score-only priority levels, and digest
  generation stops repeating itself** — 2026-07-27, owner-selected after a
  measured diagnosis during that day's editorial round. Two coupled defects
  were confirmed with real numbers over the 31 published signals:
  (1) **`priorityLevel` had collapsed** — every published signal scored 80-100
  and landed in `high_priority`, leaving `watch` and `low_priority`
  permanently empty (so `/digest/weekly`'s 值得跟踪 section never had
  content). `priorityScore` measures record _completeness_, which any signal
  that clears the editorial workflow maxes out, and it barely correlated with
  the editor's own `importanceLevel` — a `signal` scored 100 while two
  `critical` records scored 90. (2) **Digest generation was structurally
  repetitive** — `buildDailyDigestFromTechnologies` takes the top 4 by score
  inside a 90-day window, so the same high scorers won every day (four
  consecutive rounds had to hand-exclude the previous digest's items) while
  **9 published signals had never appeared in any digest at all**, including
  `kimi-k3`, `gemini-managed-agents-background-mcp`, and
  `copilot-code-review-tool-workflow-lessons`.
  Fixes, both scoped to the last step of their pipeline: `ranking.ts` now
  resolves the band from the editor's `importanceLevel` with recency able to
  **demote but never promote** — `critical` → `high_priority` always,
  `important` → `high_priority` within 30 days else `watch`, `signal` →
  `watch`, and anything scoring under 45 (broken/incomplete records) still
  falls to `low_priority`. `priorityScore` is unchanged and keeps its job as
  the within-band ordering key; `priorityReasons` now states which rule
  applied. Imported candidates have no editorial importance yet, so they keep
  the original score thresholds. `digest-workflow.ts` gained
  `collectCarriedTechnologyIds` plus a `carriedTechnologyIds` build option:
  signals a published digest already carried sort **last inside each priority
  bucket**, so never-carried signals take the limited slots first, with
  automatic fallback to carried ones so a quiet day never generates an empty
  digest. Measured after the change: levels went 31/0/0 → **15 high / 16
  watch**, `/digest/weekly` renders a real two-section split (2 + 3 cards
  where 值得跟踪 was previously always empty), and a hypothetical next-day
  generation leads with the two never-carried in-window signals instead of
  four repeats. (The other 6 never-carried signals are April seed items
  outside the digest's 90-day window — correctly excluded from a _daily_
  digest.) Verified with typecheck, lint, format, vitest 107/107 (6 new tests
  covering critical-never-demoted, important freshness demotion,
  signal-stays-watch, fresh-first ordering, empty-digest fallback, and
  `collectCarriedTechnologyIds` exclusion rules), `validate:ranking`,
  `validate:digest`, and a live pass with zero console errors.

## Production hardening (go-live checklist, in-repo items)

- **CSP + HSTS, pinned Node, and untracked runtime/secret stores** —
  2026-07-22, the code/config half of the production-readiness assessment's
  go-live checklist (see `docs/production-readiness.md`; the operator-action
  items — workspace token, data reset, site URL — stay open by design).
  `next.config.ts` now emits a `Content-Security-Policy` (`default-src 'self'`,
  with `'unsafe-inline'` for Next's own inline bootstrap/hydration scripts and
  React inline-style attributes) and `Strict-Transport-Security`
  (`max-age=63072000; includeSubDomains`) **in production builds only** — dev
  keeps the baseline headers so `next dev` HMR / React Refresh (which need
  `'unsafe-eval'` + a websocket) still work; the branch resolves inside
  `headers()` and is baked into the build's routes manifest. Verified against a
  real `next start`: both headers present on public routes, and a
  client-interactive page (`/technologies?view=followed`) hydrates, reads and
  writes localStorage, and toggles state with zero CSP violations.
  `package.json` gained `"engines": { "node": ">=22.5.0" }` (the SQLite driver's
  `node:sqlite` needs ≥ 22.5). Six runtime/secret/cache stores are now
  git-ignored and untracked — `config/delivery.json` (the one that would hold a
  real webhook endpoint/token once configured), `workflow-events.json`,
  `task-runner.json`, and the three `technology-*.json` LLM result caches — so
  a real delivery secret can no longer be committed; content, config, and
  editorial-state stores stay tracked because they seed a deployment. Verified
  with typecheck, lint, format, `npm run build`, and the live `next start` CSP
  pass above.

## Editorial round console (`/workspace/editorial-round`)

- **Workspace editorial-round console shipped** — 2026-07-22, owner-selected
  from the product-proposal backlog ("编辑轮控制台"). Scope confirmed upfront
  via an `AskUserQuestion` round plus a depth-comparison mockup
  (orchestration console vs. full inline workbench) and a layout mockup:
  **A) orchestration console** (not a full inline workbench), **nav + dashboard
  entry**, **safe transitions inline**. It collapses the recurring loop in
  `docs/editorial-round-playbook.md` onto one page without duplicating any
  editor. New `src/lib/editorial-round.ts` (`getEditorialRoundState`) is a pure
  read aggregation over the existing workflow getters — undecided candidates
  (effective `importStatus === "new"`, newest-first), open duplicate-group
  count, technology drafts awaiting publish (each with its
  `getTechnologyWorkspacePublishReadiness` blocking/warning summary,
  blocking-first), and today's digest — plus a derived five-phase step tracker
  (处置候选 / 补内容·发布 / 生成简报 / 发布简报 / 公开面核对) whose statuses
  (done / current / todo / blocked) fall out of that state; it owns no new
  persisted data and performs no mutations. The page
  (`src/app/workspace/editorial-round/page.tsx`) renders the summary, tracker,
  and grouped sections; the inline actions live in the client component
  `src/components/editorial-round-actions.tsx` (`CandidateRoundActions`,
  `DraftPublishAction`, `DigestRoundActions`) which reuse the existing
  `/api/candidates/[id]/{status,convert}`,
  `/api/workspace/technologies/[id]/status`,
  `/api/workspace/digests/generate`, and `/api/workspace/digests/[date]/status`
  routes (confirm prompts, 409 publish-gate readiness surfaced inline). An
  open-duplicate-group notice warns that grouped candidates can't convert
  standalone; a soft hint discourages generating the digest while candidates or
  drafts remain. A 编辑轮 entry was added to `WorkspaceNav` (控制台 group) and a
  打开编辑轮 card to the `/workspace` dashboard; new `.editorial-round-*` CSS on
  the workspace tokens. Verified with typecheck, lint, format, vitest 101/101
  (5 new tests covering candidate filtering/sorting, dup-block step, draft
  readiness ordering, and digest step derivation), and a live workspace pass
  (real round state: 10 undecided, 3 open dup groups → candidate step blocked,
  today's digest draft → generate step done; nav + dashboard entries; no
  horizontal overflow at 375px; zero console errors). The inline mutations were
  not fired during verification — they reuse pre-existing, unit-covered
  endpoints and firing them would be making the owner's editorial decisions.

## Weekly review page (`/digest/weekly`)

- **Public weekly review shipped** — 2026-07-22, owner-selected from the
  product-proposal backlog ("周回顾页"). A public, time-boxed sibling of the
  Daily Digest and a pure derived view like `/network` and the digest archive:
  new `src/lib/weekly-review.ts` (`getWeeklyReview(weekKey?)` +
  `getWeeklyReviewArchive`) persists nothing and calls no LLM. It buckets
  published technology signals into natural weeks (Monday–Sunday, computed in
  UTC from the plain `YYYY-MM-DD` publish dates), classifies each with the same
  deterministic `evaluateTechnologyPriority` the rest of the public product
  uses, and groups them into 立即关注 (`high_priority`) / 值得跟踪 (`watch`)
  — `low_priority` is excluded, matching the digest's default (owner-chosen
  after a side-by-side comparison mockup of the two tail layouts). Two routes:
  `/digest/weekly` (current week, with a four-number summary — 本周信号 /
  立即关注 / 值得跟踪 / 覆盖主题 — an empty state for a quiet week, and the
  past-week archive folded into the bottom) and `/digest/weekly/[week]`
  (a specific week keyed by its canonical Monday date, e.g.
  `/digest/weekly/2026-07-13`; `notFound()` for a non-canonical/non-Monday
  key, an invalid date, or a week with no shown signals). Both render through
  the shared server component `WeeklyReviewContent` in dossier styling
  (`DossierCard` / `DossierStampTag`, a new `.weekly-review-*` CSS block on the
  existing `--dossier-*` tokens). Discoverability is by cross-link only (no new
  nav entry, consistent with the nav-minimalism direction): a 本周回顾 link on
  the `/digest` archive page and in the public digest pages' 订阅简报 block.
  Scope confirmed upfront via an `AskUserQuestion` round and a mockup (route
  `/digest/weekly`; natural week + archive; priority grouping; no low_priority
  tail). Verified with typecheck, lint, format, vitest 96/96 (6 new tests
  covering week bucketing, low-priority exclusion, newest-first sort,
  canonical-key resolution, and archive grouping/exclusion), and a live pass
  (populated week renders 8 signal cards + archive; current week shows the
  empty state; non-canonical key 404s; both cross-links wired; dossier tokens
  resolve; no horizontal overflow at 375px; zero console errors).

## Scheduled digest draft (task runner automation)

- **The task runner now generates the day's digest draft automatically** —
  2026-07-21, owner-selected from the product-proposal backlog ("定时简报
  草稿"). A structural sibling of Scheduled Import v0: new
  `src/lib/scheduled-digest.ts` (`ScheduledDigestConfig` in
  `config/scheduled-digest.json`, same `nextRunAt`-advance timing model,
  bootstrap "missing `nextRunAt` = due now", default 08:00
  Asia/Shanghai). Each `tasks:run-once` / `tasks:watch` pass checks it
  after the scheduled import and, when due, generates a `status = draft`
  digest for today via the existing `generateDailyDigest` — **skipping
  entirely when the day already has a digest** (unattended runs never
  touch a digest an editor may be adjusting) and **never publishing**
  (the editorial gate is unchanged; the editorial round becomes
  edit-and-publish instead of generate-edit-publish). A failed generation
  downgrades the runner pass to `partial` and still advances `nextRunAt`
  so watch mode doesn't hot-loop the failure. Managed from
  `/workspace/delivery/schedules` (new 定时简报草稿 panel +
  `ScheduledDigestActions`, `PATCH /api/workspace/scheduled-digest`).
  The default time deliberately matches the import's 08:00: in-pass code
  order (import first, digest second) guarantees sequencing, and a later
  time than the daily Task Scheduler trigger would degrade to
  every-other-day generation. `validate:tasks` pins a disabled
  scheduled-digest config during its runs (and asserts the skip message)
  so validation never writes real digest stores. Verified with
  typecheck, lint, format, vitest 90/90, `validate:tasks`, and an
  isolated `LOCAL_DATA_DIR` functional pass covering all three branches
  (generate → draft written + `nextRunAt` advanced; not-due skip;
  already-exists skip).

## Topic-level RSS + follow transfer (P4 v0.3)

- **Per-topic RSS feeds and cross-device follow transfer** — 2026-07-21,
  owner-selected from the "追踪能力" gap discussion as the zero-unseal
  option (email subscription and accounts stay excluded; this deepens the
  keep-tracking loop within the existing no-accounts boundary). New public
  route `/topics/[tagId]/feed.xml` (`renderTopicRssXml` in
  `src/lib/topic-feed.ts`): an RSS 2.0 feed of the topic's **published
  technology signals only** (newest first, bilingual-preferred titles and
  summaries, no news fast-lane items), 404 for unknown topics or topics
  with no published signals; `escapeXml` / `formatRssDate` are now exported
  from `digest-delivery.ts` and reused, and the dependency-free
  `topicFeedPath` helper lives in `feed-paths.ts` so the client component
  can link it. Entry points: a 订阅此话题 block on `/topics/[tagId]`
  (shown only when the topic has published signals) and, on the 我关注的
  view, a feed-link row listing each followed topic that has at least one
  published signal. Same view also gains follow transfer: 导出关注 copies
  the followed-tag ids as a plain comma-separated 关注码 to the clipboard
  (prompt fallback), 导入关注 accepts a pasted code, validates ids against
  canonical tags, and merges them into the local follow set — cross-device
  follows without accounts, matching the P4 localStorage-only boundary.
  Verified with typecheck, lint, format, vitest 90/90, and a live pass
  (feed XML valid and escaped for tag-inference with 7 items, unknown-tag
  404, both entry points rendering, zero console errors).

## Detail-page relation notes rendered for real

- **Skill/knowledge detail pages now render the stored relation 附注** —
  2026-07-21, found during the fourth content round: the 背景概念 cards on
  `/skills/[slug]` and the 搭配技能 cards on `/knowledge/[slug]` hardcoded
  a generic one-liner in `DossierCatalogNote`, even when the pair's
  `LinkRelation` carried an editor-written note (both pages already looked
  the notes up via `findRelationBetween` for the `RelationshipGraph`
  tooltips — the card markup just never used them). Now the real note
  renders when present, with the old generic sentence kept as the
  fallback for untyped pairs. The technology detail page
  (`DossierRelatedItemsSection`) already did this correctly and is
  unchanged. Verified with typecheck, lint, format, vitest 90/90, and a
  live pass (custom notes visible on both page kinds, zero console
  errors).

## Partial-update slug preservation fix

- **`updateTechnologyWorkspaceRecord` no longer regenerates the slug on
  partial updates** — 2026-07-19, found live during the same-day content
  round: a PATCH that omitted `slug` fell through
  `normalizeSlug(undefined, title.original)` and silently rebuilt the slug
  from the **original (English) title**, breaking the public URL of every
  record touched by a partial API update (the workspace edit form always
  sends `slug`, so the bug never surfaced through the UI). Five published
  signals had their slugs clobbered and restored during verification. Fix:
  an absent `slug` now keeps the existing value; an explicit `slug` still
  normalizes with title fallback. Verified with a partial-PATCH round-trip
  (slug preserved), typecheck, lint, format, and vitest 90/90.

## LinkRelation v1 (typed relation editing)

- **Typed relation editing across all three workspace editors** —
  2026-07-19, owner-chosen as the next initiative after the same-day
  editorial round, closing the one item Skill/Knowledge workspace editing
  v0 explicitly deferred. Scope confirmed upfront via a form mockup and
  three decisions: all three workspaces (skill, knowledge, **and** the
  technology draft editor — the four signals published earlier the same
  day were exactly the "every relation renders as generic 关联" pain
  case), copy-on-write over the 56 seed relations in
  `src/data/relations.ts` (seed file stays read-only), and both
  `relationType` and `note` editable. Implementation: new
  `src/lib/link-relation-workflow.ts` — `config/link-relation-workspace.json`
  overlay store keyed by **unordered pair** (an override wins over the
  seed for the same pair regardless of `from`/`to` direction), pure cores
  (`applyLinkRelationOverlay`, `findRelationIn`, `planLinkRelationSync`)
  with 13 vitest tests, and a sync rule that keeps the store minimal: a
  value equal to the seed removes the override (clean revert), the
  generic default (`related-to`, no note) with no seed entry is never
  persisted, and pairs not mentioned in a save are left untouched (so
  edits from the other side of a shared pair survive). `LinkRelation.note`
  became optional to support type-only overrides. `content.ts`'s
  `findRelationBetween`, `buildRelationItems` (previously
  direction-sensitive; now unordered like everything else), and
  `getContentGraph` (single merged read instead of per-edge lookups) all
  read the merged view, so edits flow to detail-page pills and 附注 notes,
  `RelationshipGraph` tooltips, `/network` edge labels, and topic hubs
  with no component changes. New `PUT /api/workspace/relations` (batch
  upsert per source entity, under the existing token boundary),
  `link_relation.updated` workflow events, and a shared
  `RelationCheckboxItem` component: each related-content checkbox unfolds
  a relation-type select (七种档案语汇) plus note input via CSS `:has`
  while checked — forms stay fully uncontrolled, and the new-entry forms
  keep plain checkboxes (relations become editable after first save).
  Live-verified end to end: the Inkling draft's four relations set to
  必备/延伸/借助 with notes through the real form (store written, public
  detail pills + notes and `/network` edge types confirmed), and a seed
  pair override → revert round-trip leaving the store empty. Verified
  with typecheck, lint, format, and vitest 90/90.

## Dark-mode contrast completion round

- **Site-wide contrast fixes, dark mode completed** — 2026-07-16,
  owner-reported ("有一些界面字的颜色和背景颜色相近导致看不清字"). A WCAG
  contrast scan in both color schemes located the cause almost entirely
  in dark mode: the 2026-07-15 dark round only redeclared the seven
  `--dossier-*` tokens (+ TopNav/body), leaving every component styled
  through older generic root tokens or hardcoded light-mode colors
  "half dark" — worst cases at 1.16–1.8:1 (page headers keeping their
  light paper gradients under dark-mode light text, the tech-detail
  aside panels, the home news rows, relationship-graph headings/nodes,
  hardcoded `#34404a`-family body copy). CSS-only fix in
  `globals.css`'s dark media block: (1) the dark `.dossier` scope now
  also redeclares the generic root tokens (`--muted`, `--user-ink`,
  `--accent`, `--surface-strong`, ...) so the light-by-design workspace
  is untouched; (2) targeted overrides remap the hardcoded leftovers to
  dossier tokens; (3) three marginal values nudged one step for 4.5:1
  (dark `--dossier-stamp`, light `--dossier-muted`, and
  `--workspace-nav-active` + white active-link text — the last a
  pre-existing light-mode issue); (4) in dark mode the Internal
  Workspace gets an opaque light board behind `.workspace-shell`
  instead of sitting on the dark body. Re-scanned to zero failures
  across 11 public routes + the workspace in both schemes, zero console
  errors, light mode visually unchanged apart from the two token
  nudges. Full audit notes in `docs/design-system.md` → "Dark-mode
  contrast completion round". Verified with typecheck, lint, format.

## Skill/Knowledge workspace editing v0

- **Workspace editing flow for skills and knowledge shipped** — 2026-07-16,
  owner-approved via a design mockup after choosing the content-side
  direction (the skill/knowledge pools were previously only editable by
  changing `src/data` seed code — the structural bottleneck for content
  growth). Three confirmed scope decisions: seed entries are editable via
  copy-on-write runtime overrides (seed files stay read-only), entries carry
  a draft/published status flow with a minimal publish gate, and v0 edits
  related-content ids only (typed `LinkRelation` editing deferred). Four
  commits: (1) `src/lib/skill-workflow.ts` / `knowledge-workflow.ts` — new
  `config/skill-workspace.json` / `knowledge-workspace.json` stores,
  copy-on-write update/status transitions (editing a seed copies it into
  the store as `published`, since the seed version is already live; new
  records start as `draft`), pure cores (`buildXWorkspaceEntries`,
  `evaluateXPublishReadiness`, `applyXWorkspaceOverlay`) with 16 vitest
  tests, `skill.*`/`knowledge.*` workflow events; (2) API routes
  `POST/PATCH /api/workspace/{skills,knowledge}[/[id]]` and
  `POST .../[id]/status` mirroring the technology route shapes (409 +
  readiness payload on blocked publish), all under the existing
  `/api/workspace/*` token boundary; (3) workspace pages —
  `/workspace/skills` and `/workspace/knowledge` lists (草稿/已发布/内置种子/
  工作台覆盖 tiles, origin badges via a shared `ContentWorkspaceEntryCard`),
  `new` + `[id]` edit pages (shared `ContentWorkspaceStatusActions` with
  confirm + readiness errors, existing `PublishReadinessPanel`, per-domain
  forms with canonical-`TopicTag` checkboxes and related-content pickers),
  技能/知识 nav entries and breadcrumb labels; (4) public wiring —
  `getAllSkills` / `getAllKnowledge` in `src/lib/content.ts` now serve the
  merged seed+workspace view with drafts filtered, and the previously
  seed-direct reads (`getSkillBySlug` / `getKnowledgeBySlug`,
  `resolveTitle` / `resolveSlug`, `getContentGraph`) were converged onto
  them so the overlay applies consistently across index/detail pages, the
  content graph, search, and topic hubs. Publish gate: title/slug/summary
  required + unique slug blocking; short content, missing/non-canonical
  tags, and missing relations as warnings. Live-verified end to end:
  draft invisible on `/skills` → publish → visible on index/detail/search;
  seed override visible publicly and reverting cleanly after store
  cleanup; 409 readiness on blocked publish; zero console errors.
  Verified with typecheck, lint, format, and vitest 77/77.

## Topic hub (`/topics/[tagId]`)

- **Per-topic drill-down page shipped** — 2026-07-15, same session as the nav
  simplification above, owner-directed after reviewing a page mockup and an
  index-page mockup (the index page was explicitly declined — no `/topics`
  listing, no global nav entry). `getTopicHub(tagId)` in the new
  `src/lib/topic-hub.ts` merges what `/network`, the 按话题 view, and
  `/search` each show in fragments for one topic tag: published
  technologies tagged with it (newest-first, reusing the same bilingual
  title/summary helpers `/timeline` uses), tagged skills, tagged knowledge,
  and a "图谱关联" section — every node in `getContentGraph()` connected by
  an edge to any of the above, excluding nodes already shown in the three
  lists, each carrying its edge's Chinese relation-type label. Returns
  `undefined` (→ `notFound()`) for an unknown tag id or one with no content
  in any of the three pools. The only entry point is a new "查看专题" link
  rendered on every chip in `FollowableTagList` (technology/skill/knowledge
  detail pages) — deliberately scoped narrower than the generic `TagList`
  used site-wide on index cards, related-item cards, and search results,
  which stay pure display with no new interactive surface. Pure derived
  view: no new persisted fields, no AI calls, no internal fields. Verified
  with typecheck, lint, format, vitest 61/61, and a live pass (tag-inference
  showing 6 signals + 10 graph neighbors, tag-ai-agents showing all four
  sections including directly-tagged skills/knowledge, an unknown tag id
  returning a real 404, zero console errors).

## Nav simplification: /news, /timeline, /radar folded into /technologies

- **Public nav cut from 10 items to 6** — 2026-07-15, owner-directed after
  reviewing a before/after mockup and comparison page. 今日快讯 (`/news`),
  时间线 (`/timeline`), and 我的雷达 (`/radar`) were three different
  filters/groupings over the same published-technology data, not
  independent destinations, so they're now four views on `/technologies`
  switched by a `?view=` query param and a tab strip (精选 default,
  `news`/全部快讯, `timeline`/按话题, `followed`/我关注的). `/technologies/page.tsx`
  reads the `view` param and renders `TechnologyBrowser` (unchanged),
  the new `NewsFeedSection` and `TopicTimelineSection` components
  (extracted verbatim from the old news/timeline pages, with
  `getTimelineTopics` changed to take `technologies`/`tags` as parameters
  instead of re-fetching them), or the existing `MyRadarContent` (reused
  as-is). `src/app/{news,timeline,radar}/page.tsx` are now one-line
  `redirect()`s to the matching `?view=`, matching the existing
  `src/app/candidates/page.tsx` legacy-redirect pattern. All four cross-page
  links that pointed at the old routes (`page.tsx`'s home news-board link,
  `daily-digest-content.tsx`'s two personalization-bar links, and
  `followable-tag-list.tsx`'s follow hint) were repointed at the matching
  `/technologies?view=` URL. The 搜索 nav link was replaced with an
  always-visible inline search icon/box in `TopNav` that still GETs to the
  untouched `/search` page. Confirmed before starting that every CSS
  class used by the moved-in JSX (`.news-day`, `.news-card`, `.timeline-topic`,
  `.dossier-timeline-node`, `.my-radar`, etc.) was already unscoped (only
  extra rules were scoped to the generic `.dossier` ancestor, which
  `/technologies` already carries), so the merge needed zero CSS selector
  rewrites — only new `.technology-view-tabs`/`.top-nav__search` blocks.
  Verified with typecheck, lint, format, vitest, and a live pass (all four
  `?view=` values, the three old routes redirecting correctly, the search
  toggle, and the repointed cross-links).

## `DossierCard` tilt prop cleanup

- **Removed the inert `tilt` prop and `cardTilts` arrays** — 2026-07-15,
  same day, closing out the one deferred cleanup item flagged when the
  resting tilt was removed in favor of a flat rest state (see "Dossier
  direction — flat cards" below). That change was CSS-only at the time;
  `DossierCard`'s and `DossierTechnologyCard`'s `tilt` prop and every call
  site's `cardTilts` cycling array still computed a value and passed it
  down, but the class it produced no longer had any CSS behind it. Removed
  for real across 8 files (`dossier-card.tsx`, `dossier-technology-card.tsx`,
  `technology-browser.tsx`, `my-radar-content.tsx`, `src/app/page.tsx`,
  `src/app/digest/page.tsx`, `src/app/knowledge/page.tsx`,
  `src/app/skills/page.tsx`) — net -64 lines, no visual change. Verified
  with typecheck, lint, and format:check.

## `/network` edge focus + relation-type legend

- **Edge crossing density reduced, relation-type legend added** —
  2026-07-15, same day, owner-approved follow-up after the node-overlap
  fix. Measured edge crossing density (segment-intersection test): 789
  crossing pairs among the graph's 88 edges. Edges now rest at low
  opacity (0.35) by default; a selected node's own edges pop to full
  opacity in the stamp accent color, everything else stays faint or drops
  further via the existing dim state — reused the existing per-edge
  active/dim class logic unchanged, only the CSS opacity values changed.
  Separately, the panel's resting-state legend gained a relation-type
  section (必备/关联/渊源/…) below the existing kind legend, derived live
  from the actual edge data (deduplicated `relationType` values, not a
  hardcoded list) and rendered as `DossierStampTag`s — the same relation
  labels already shown per-connection and on edge hover, now also visible
  as a glossary before any interaction. See `docs/design-system.md` →
  "Dossier direction" → "`/network` edge focus + relation-type legend
  (2026-07-15, same day)" for the full writeup, including a verification
  detour where the browser automation tool initially reported wrong
  opacity values due to CSS transitions being throttled in a backgrounded
  tab — confirmed via `Element.getAnimations()` to be a test-tooling
  artifact, not a real bug. Verified with typecheck, lint, format, vitest
  61/61, and a live pass (opacity values confirmed correct, relation
  legend shows all 7 types present in the real data, zero console errors
  on a fresh tab).

## `/network` dot nodes (overlap fix)

- **Node overlap fixed on `/network`** — 2026-07-15, owner-reported the
  whole-graph overview "felt chaotic" and got worse when zoomed. Measured
  before fixing: 44 overlapping node-label pairs at desktop width (33
  labels, avg. ~112px wide, in a 568×568px canvas), 93 pairs at a
  narrower simulated-zoom width (305×320px canvas) — the force layout's
  "ideal distance" formula never accounted for actual label footprint, so
  labels were simply too wide for the room the physics gave them. Fixed
  by making nodes small kind-colored dots by default (11-15px), with the
  full title label appearing only when a node is hovered, selected, or
  matches the active search text — not general category-filter match,
  since a filtered category can still hold a dozen-plus nodes. Every node
  keeps `aria-label`/`title` set to its full title regardless of visual
  state, so screen readers and native tooltips are unaffected. Re-measured
  after the fix: zero overlapping dots at both canvas sizes tested. See
  `docs/design-system.md` → "Dossier direction" → "`/network` dot nodes
  (2026-07-15)" for the full writeup. Verified with typecheck, lint, format,
  vitest 61/61, and a live pass (search shows exactly the matching
  labels, selection shows exactly its own label plus the connections
  panel, dark mode's dot ring blends into the canvas background, zero
  console errors).

## Dossier direction — flat cards (tilt removed)

- **`DossierCard` tilt removed** — 2026-07-15, owner-directed. The
  per-index resting tilt (three rotation angles, straightened on hover)
  read as too busy across full card grids and was replaced with a flat
  rest state plus a plain hover lift. Three replacement directions were
  mocked up and compared before deciding: plain flat, flat with a
  folded-corner accent, and flat with a content-kind-colored tab spine.
  The colored-spine option was ruled out during discussion: the existing
  technology/skill/knowledge three-color code only carries information
  where multiple kinds share a view (`/network`, the per-item
  `RelationshipGraph`) — on a single-kind list page every card would show
  the same spine color, which is exactly the decoration-with-no-signal
  failure mode that color system is careful to avoid elsewhere. Plain flat
  was chosen. Implementation was CSS-only: the `.dossier-card--tilt-a/b/c`
  rotation rules were removed from `globals.css`; `DossierCard`'s `tilt`
  prop and every call site's `cardTilts` cycling array were deliberately
  left unchanged (the tilt class names still land in the DOM, just inert)
  — a full prop removal is a separate, deferred cleanup. See
  `docs/design-system.md` → "Dossier direction" → "Flat cards
  (2026-07-15)" for the full writeup. Verified with typecheck, lint,
  format, vitest 61/61, and a live check that cards compute
  `transform: none` at rest on `/technologies`, `/skills`, and `/`, zero
  console errors.

## Dossier direction — dark mode (system preference only)

- **Dark mode for the dossier direction** — 2026-07-15, same day as the
  `/network` round, owner-decided to follow `prefers-color-scheme: dark`
  only (no manual toggle, no persisted state — the smaller, more
  contained option, matching this project's minimal-client-state pattern
  elsewhere). Since almost every dossier rule already routes color
  through the seven `--dossier-*` custom properties, the whole scope
  repaints from one `@media (prefers-color-scheme: dark) { .dossier {
... } }` block redeclaring those seven values — no changes needed to
  the ~1100 lines of rules that reference them. Live verification caught
  a real scoping gap before shipping: `TopNav` (rendered once in
  `layout.tsx`, outside `.dossier`, shared with the Internal Workspace)
  and the `body` background gradient (visible as gutters beside
  `.main-content` on wide viewports) both used hardcoded light colors —
  theming only `.dossier` would have left a dark page under a still-light
  nav bar. Both got their own dark variant in this round; `TopNav`'s is
  unconditional, so it also applies on Workspace pages (harmless, likely
  an improvement next to the already-dark rail). See
  `docs/design-system.md` → "Dossier direction" → "Dark mode (system
  preference only, 2026-07-15)" for the full writeup. Verified with
  typecheck, lint, format, vitest 61/61, and a live pass forcing both
  color schemes via browser emulation on `/network` and a workspace page
  (zero console errors in either scheme, light mode unchanged).

## Dossier direction adoption — /network (force-directed rebuild)

- **Dossier direction live on `/network`** — 2026-07-15, owner-authorized
  follow-up to the six-round migration below. Unlike every other round,
  this wasn't a card-component swap: `ContentNetworkGraph` was rewritten
  from its fixed three-lane layout to a hand-written, Fruchterman-
  Reingold-style force-directed simulation (node repulsion, spring-edge
  attraction, a weak centering force, ~150 relaxation frames) so the
  33-node/88-edge graph's real topology drives the layout instead of an
  artificial technology/skill/knowledge lane split. Ships the three
  enhancements confirmed in the original design session: search-highlight
  (`DossierSearchInput`), a category filter (`DossierCategoryChips`), and
  hover-over-edge relation labels; nodes are also draggable. Zoom/pan
  stayed out, per the earlier decision not to add it at this node count.
  Two real bugs were caught and fixed during live verification before
  commit: (1) the initial node scatter used `Math.cos`/`Math.sin`, which
  the JS spec doesn't guarantee bit-identical across Node's and the
  browser's V8 builds, causing a genuine hydration mismatch on every
  load — fixed by rendering an SSR-safe integer-arithmetic grid for first
  paint and only applying the trig-based organic scatter from inside a
  client-only effect, after hydration; (2) combining node-selection with
  search/filter used an implicit AND across the two lenses, so selecting
  a node unrelated to the current search term dimmed the entire graph to
  nothing — fixed to a union (a node stays visible if it satisfies either
  active lens). See `docs/design-system.md` → "Dossier direction" →
  "Adopted pages" for the full writeup. With this, the whole User-facing
  Product is on the dossier system; only the Internal Workspace remains
  on the original system, by design. Verified with typecheck, lint,
  format, vitest 61/61, and a live pass (fresh-tab reload confirmed zero
  hydration errors, selection/search/filter combinations checked via
  computed DOM state, mobile width at 375px with no overflow, console
  clean).

## Dossier direction adoption — homepage (migration complete)

- **Dossier direction live on `/` (homepage)** — 2026-07-14, same night,
  sixth and final adoption round. `HomeTechnologyCard`, `SkillPathCard`,
  `KnowledgePathCard`, and the digest summary card (all page-specific,
  not shared with any other page) now render through `DossierCard`, with
  `DossierStampTag` for the priority/category pills and
  `DossierCatalogNote` for the "为什么重要" block. The compact news-row
  list keeps its original markup (CSS reskin only), since
  `DossierRegisterRow`'s `Link`-only href doesn't support the
  `target="_blank"` behavior those external-link rows need. This
  completes the original migration-cost plan's adoption order: every
  page named in it now renders the "编辑桌" look. `/network` (its own
  hand-written force-directed graph, not a card swap) was discussed as a
  target for this direction but was never placed in the adoption order
  and remains unmigrated, alongside the Internal Workspace by design.
  Verified with typecheck, lint, format, vitest 61/61, and a live pass
  (all sections render — hero, digest card, priority signals, news rows,
  skill/knowledge cards — mobile width without overflow, zero console
  errors, `/network` confirmed unaffected).

## Dossier direction adoption — /radar & /news

- **Dossier direction live on `/radar` and `/news`** — 2026-07-14, same
  night, fifth adoption round, closing out the "each need one new state"
  pages from the original plan. `MyRadarContent` swaps its
  `TechnologyListCard` usage for `DossierTechnologyCard` (the same
  page-specific card built for `/technologies`) — safe to change directly
  since `MyRadarContent` is only ever rendered by `/radar`, so the home
  page's independent `TechnologyListCard` usage is untouched. `/news`'s
  page-specific `NewsCard` swaps to `DossierCard`, the same treatment
  `/search`'s `SearchNewsCard` already got. Verified with typecheck, lint,
  format, vitest 61/61, and a live pass (follow/unfollow toggle still
  filters correctly, disclaimer and tags render, mobile width without
  overflow, zero console errors, home page confirmed unaffected).

## Dossier direction adoption — digest & search

- **Dossier direction live on `/digest`, `/digest/today`, `/digest/[date]`,
  and `/search`** — 2026-07-14, same night, fourth adoption round. The
  digest archive index swaps its entry cards for `DossierCard` +
  `DossierStampTag`. The shared `DailyDigestContent` component (rendered
  by both public digest routes and the workspace digest-preview route)
  gained `DossierCard` for technology/reference/source cards,
  `DossierStampTag` for type/priority badges, and `DossierCatalogNote` for
  the "为什么重要" reason block. `/search` swaps result cards for
  `DossierCard` and its GET-form search input for the `.dossier-search`
  icon-pill markup (inlined, since the page is an uncontrolled
  server-rendered form rather than client state, so the
  `DossierSearchInput` component's controlled-input API doesn't fit).
  A real bug was caught and fixed before commit: `dossier` was only added
  to the two public digest page shells at first, but the workspace
  digest-preview route renders `DailyDigestContent` inside
  `WorkspacePageShell` (no `.dossier` ancestor there), so its new
  `DossierCard`/`DossierStampTag` instances resolved `--dossier-*` custom
  properties to nothing and rendered borderless/invisible cards. Fixed by
  moving `dossier` onto `DailyDigestContent`'s own root div — the same
  self-contained pattern `TechnologyDetailContent` already used — so the
  component carries its own dossier scope regardless of which shell wraps
  it. Verified with typecheck, lint, format, vitest 61/61, and a live pass
  on all four routes plus the workspace preview route (cards render with
  visible borders/backgrounds there too, mobile width without overflow,
  zero console errors).

## Dossier direction adoption — /timeline

- **Dossier direction live on `/timeline`** — 2026-07-14, same night, third
  adoption round and the first real use of `DossierRegisterRow`
  (previously unused since the component slice shipped). Each topic's
  chronological entry list now renders as a ledger of register rows
  (`title` + `date` + `href` + a `tag` set to the entry's source name)
  instead of the rail-and-dot connector list the page used before — the
  ledger reads better against the archival "编辑桌" concept than a
  timeline-rail metaphor. Since `DossierRegisterRow` only covers the
  compact title/date/tag line, the entry summary renders as a plain
  paragraph underneath, indented to align under the title column
  (`.dossier-timeline-node__summary`); the component itself needed no
  changes. Verified with typecheck, lint, format, vitest 61/61, and a live
  pass (10 topics rendered, newest-first ordering confirmed per topic,
  detail-page links resolve, mobile width without overflow, console
  clean).

## Dossier direction adoption — skills & knowledge

- **Dossier direction live on `/skills`, `/skills/[slug]`, `/knowledge`,
  `/knowledge/[slug]`** — 2026-07-14, same night, the second adoption round
  right after `/technologies`. Unlike the technology pages, these four
  routes hand-roll their own card/section markup per route rather than
  sharing components, so `DossierCard`, `DossierStampTag`, and
  `DossierCatalogNote` were used directly in each `page.tsx` (no new
  page-specific sibling components needed). Every index card's outcome
  blurb and every related-item note — including the skill↔knowledge "附注"
  note on both detail pages — now renders through `DossierCatalogNote`;
  heat/cost/category/difficulty pills and relation-type labels render
  through `DossierStampTag`. `RelationshipGraph`, `TagList`,
  `FollowableTagList`, and `RelationDensity` needed no changes at all — the
  `.dossier`-scoped CSS written for the technology round already targets
  their shared classnames, so they picked up the look for free once these
  pages added the `dossier` class. Verified with typecheck, lint, format,
  vitest 61/61, and a live pass across all four pages (index + detail,
  relation pills, catalog notes, mobile width at 375px with no horizontal
  overflow, zero console errors) plus a regression check that home,
  `/radar`, and the technology pages were unaffected.

## Dossier direction adoption — /technologies

- **Dossier direction live on `/technologies` and `/technologies/[slug]`** —
  2026-07-14, later the same day as the staged component slice below, the
  first real page-by-page adoption per the migration order recorded in
  `docs/design-system.md`. Both pages now render the archival "编辑桌" look
  end to end: `/technologies` (`TechnologyBrowser`) uses `DossierSearchInput`
  and three `DossierCategoryChips` rows (type/tag/priority) in place of
  `SearchFilterBar`, and a new `DossierTechnologyCard` in place of
  `TechnologyListCard` for each signal (tilt cycled per card). The detail
  page (`TechnologyDetailContent`, also reused by the workspace preview
  route) gained a new `DossierRelatedItemsSection` for the
  相关技术/相关技能/相关知识 sections — the flagship "附注" feature this whole
  direction was designed to prove, rendering each connection's
  `relatedSkillExplanations`/`relatedKnowledgeExplanations` note through
  `DossierCatalogNote` with no data-model change — plus `DossierStampTag`
  for the hero/priority pill. `TechnologyListCard`, `SearchFilterBar`, and
  `RelatedItemsSection` were deliberately left unchanged (new page-specific
  siblings were added instead), since all three are still shared with pages
  not yet migrated (home, `/radar`, skills, knowledge). The three AI widgets
  (compare/explain/learning-path) and `RelationshipGraph` — also shared with
  the not-yet-migrated skill/knowledge detail pages — were reskinned through
  `.dossier`-scoped CSS on their existing classnames rather than forked, so
  they pick up the look on this page while staying inert everywhere else.
  Both pages opt in with one added `dossier` class on their shell/layout
  root; every other `.user-shell` page is unaffected. Verified with
  typecheck, lint, format, vitest 61/61, and a live pass in the dev server
  (filter interactions, related-item notes, mobile width at 375px with no
  horizontal overflow, zero console errors).

## UI direction exploration & copy tone fixes

- **Dossier design direction v0 (staged)** — 2026-07-14, owner-directed
  visual-identity exploration for the User-facing Product. Evaluated three
  full directions via HTML/CSS mockups (an "instrument console," a
  "knowledge graph," and an editorial "编辑桌"/dossier direction) against
  every public page type; the dossier direction was selected and specified
  in full (palette, type, motion, card language, `/network`'s hand-written
  force-directed graph replacing the corkboard concept it started from,
  icon-pill search, stamp-chip filters). See `docs/design-system.md` →
  "Dossier direction (staged)" for the complete specification. A first
  slice of six reusable components shipped
  (`src/components/dossier-*.tsx`) plus a `.dossier`-scoped token/class
  block in `globals.css` — verified with typecheck, lint, format, and a
  live rendering + interaction check, but **not wired into any real page
  yet**; this is staged scaffolding for a future page-by-page migration,
  not a shipped feature.
- **Copy tone fixes** — 2026-07-14, same session, the one real (non-staged)
  code change it produced. The `RelationType` label vocabulary
  (建立在/需要/支持/解释/相关, `getRelationTypeLabel` in
  `src/lib/technology-localization.ts`) read like word-for-word English
  translations, including a passive "被…于" mirror for the reverse
  direction. Rewritten to five archival-register words used symmetrically
  in both directions (渊源/借助/释义/必备/延伸/印证/关联 — seven values;
  `RelationType` has `uses`/`extends` beyond the original five named in
  discussion). Auditing this pattern elsewhere in the public UI turned up
  more instances: a duplicated-with-drift priority-label dictionary
  (`daily-digest-content.tsx` and `my-radar-content.tsx` each hardcoded
  their own copy of `getPriorityLevelLabel`'s three labels, and had
  already diverged — `了解即可` vs. the canonical `可以了解`, itself
  replaced with `背景参考`), the `whyItMatters` field heading
  "为什么值得看" unified to "为什么重要" across all seven places it
  appeared (public and workspace), two passive "被评为…/由…解释"
  constructions rewritten active, and two bare verb+object stat lines
  given the `已` aspect marker natural Chinese count lines normally carry.
  Verified with typecheck, lint, format, vitest 61/61, and a live pass
  over `/`, `/digest/today`, `/radar`, `/knowledge`, and a technology
  detail page.

## Foundation

- Next.js + TypeScript app foundation.
- Core models for technologies, skills, knowledge, tags, relations, imported
  candidates, external sources, and workspace technology records.
- Bundled mock data to demonstrate the platform structure.

## Source ingestion & candidate review

- **External Source Management v0** — local JSON source configuration, source
  search/filters, create/edit form, enable/disable, manual single-source import,
  batch import for enabled sources, and source health status (import count,
  failure count, latest message). Real import for RSS / Atom, GitHub releases,
  and official-blog-style pages, with a local fallback candidate layer.
- **Source Quality + Candidate Quality Signals v0** — workspace-only quality
  signals for source stability, duplicate rate, conversion rate, rejection rate,
  and per-candidate flags (missing fields, duplicates, short content, draft
  readiness). Excluded from user-facing pages.
- **ImportedCandidate review workflow** — search, source-type filter, normalized
  type filter, import status filter, duplicate hints, review actions, and raw
  payload inspection.
- **Rule-based duplicate detection v0** and **Candidate Duplicate Review v1** —
  persistent, explainable duplicate groups, primary candidate selection,
  resolved/ignored status, a conversion guard for non-primary duplicates, and
  additional source references carried into generated drafts.

## Topic timeline

- **Public topic timeline v0 (`/timeline`)** — 2026-07-14, the other half of
  the "topic timeline" idea from the search proposal, shipped as its own
  page per the one-page-per-task rule. New public `/timeline` (「时间线」 in
  `TopNav`) groups every published technology signal by topic tag and
  renders each topic as a chronological (newest-first) list of dated nodes
  linking to `/technologies/[slug]` — e.g. seeing the vLLM release cadence or
  the Ollama agent-workbench pivot laid out in order under 推理与部署 / AI
  智能体. Scoped to published-signal data only (no news fast-lane items, to
  keep each topic's story readable instead of noisy); topics are sorted by
  signal count then name, and only topics with at least one published signal
  render. Implementation: no new data layer — reuses `getAllTechnologies()` /
  `getAllTags()` and the existing bilingual title/summary helpers
  (`getPreferredTechnologyTitle/Summary`). New `.timeline-*` CSS (a simple
  connector-line + dot rail per topic) on existing tokens. Verified with
  typecheck, lint, format, and a live pass (10 topics rendered, newest-first
  ordering confirmed per topic, detail-page links resolve, mobile width
  without overflow, console clean).

## Digest archive

- **Public digest archive index v0 (`/digest`)** — 2026-07-14, shipped the
  same day as site-wide search as the follow-up discoverability slice.
  Previously published digests were only reachable via `/digest/today` or by
  knowing the exact date URL. The new public `/digest` page lists every
  `status = published` digest grouped by month (newest first), each entry
  showing the date, public title and summary (via the existing
  `getPublicDigestTitle` / `getPublicDigestSummary` sanitizers in
  `src/lib/public-copy.ts`), and immediate-attention / worth-tracking counts,
  linking to `/digest/[date]`. The 订阅简报 section on both public digest
  pages gained a 往期简报归档 link. Scope deliberately cut to one page per
  the house rule — the topic-timeline idea from the same proposal remains a
  separate future task. Draft/archived digests, editorial notes, and manual
  adjustment ids never render; the archive exposes exactly the digest set
  already public in `/feed.xml` / `/feed.json`. New `.digest-archive-*` CSS
  on existing tokens. Verified with typecheck, lint, format, and a live pass
  (month grouping, sanitized May fixture title, entry links, leak scan,
  no overflow, console clean).

## Site-wide search

- **Public site-wide search v0** — 2026-07-14, owner-authorized as the next
  capability after the news fast lane. New public `/search` page (「搜索」 in
  `TopNav`) with server-rendered `?q=` keyword search over the four public
  content pools: published technology signals, skills, knowledge, and the
  news fast lane. Matching is deterministic and explainable — case-insensitive
  substring match on title / summary / tag display names only (content bodies
  deliberately excluded to keep results low-noise), with space-separated
  terms ANDed. Results render grouped per content type with per-group counts;
  the news group always carries the fixed 自动聚合 disclaimer, making search
  a compliant fast-lane surface. Implementation: new `src/lib/search.ts`
  (`searchPublicContent` + `PublicSearchResults`), reusing
  `getAllTechnologies` / `getAllSkills` / `getAllKnowledge` (published-only
  public shapes), `getPublicNewsItems` (the existing `src/lib/news.ts`
  sanitizing map — no new candidate→public mapping point was created), and
  `getPreferredTechnologyTitle/Summary` for bilingual display; new
  `src/app/search/page.tsx` (Next 15 async `searchParams`, plain GET form,
  guided empty states for "no query" and "no matches") and a `.search-*`
  CSS block on existing tokens. No AI, no external service, no new API
  route; the served results are identical for everyone. Verified with
  typecheck, lint, and a live pass (Chinese/English queries, multi-term AND,
  case-insensitivity, news-group disclaimer, mobile width without overflow,
  no new console errors).

## News fast lane & scheduled import

- **News fast lane + task-runner scheduled import v0 (two-tier content
  model)** — 2026-07-13, owner-authorized to solve content freshness/volume
  without weakening the editorial gate. Two coupled pieces:
  1. **Public news fast lane (`/news` + home board)**: recently imported
     candidates (last 7 days, grouped by day, capped at 200) are now publicly
     readable through a new dedicated sanitizing layer `src/lib/news.ts` —
     the single mapping point where an `ImportedCandidate` may reach a public
     surface. Only title / truncated summary / source name / source URL /
     publish date / display tags cross the boundary; `rawPayload`,
     `importStatus`, `normalizedType`, duplicate-group internals, and
     candidate IDs never enter the RSC payload. Rejected candidates,
     `fallback`-tagged placeholder candidates, and non-primary members of
     open/resolved duplicate groups are excluded; candidates already
     converted + published link to their formal signal page. Every surface
     carries the fixed "自动聚合内容，未经编辑精选" disclaimer. New `/news`
     page (「今日快讯」 in `TopNav`), a compact latest-news board on the home
     page, and `.news-*` / `.home-news-*` CSS on existing tokens. The curated
     TechnologyItem/digest tier is untouched — the fast lane deliberately
     contrasts with it rather than replacing it.
  2. **Scheduled daily import in the task runner**: each
     `tasks:run-once` / `tasks:watch` pass now also checks
     `config/scheduled-import.json` (new `src/lib/scheduled-import.ts`;
     default enabled, 08:00 Asia/Shanghai) and, when due, runs one batch
     import for all enabled sources with `useFallbackOnFailure: false` so
     unattended runs never mint placeholder candidates. Same
     `nextRunAt`-advance timing model as `ScheduledDelivery` (bootstrap:
     missing `nextRunAt` = due now), which doubles as same-day duplicate
     protection. Import status folds into the `TaskRunnerRun` status
     (failed import downgrades a successful pass to `partial`) and messages.
     Managed from `/workspace/delivery/schedules` (new 定时导入 panel,
     `ScheduledImportActions` client component, `PATCH
/api/workspace/scheduled-import`); Windows Task Scheduler setup
     documented in `docs/deployment.md`. `validate:tasks` now pins a
     disabled scheduled-import config during its runs (and asserts the
     skip message) so validation never triggers live network imports.

## Drafting, ranking & publishing

- **Candidate → technology draft conversion** and an internal technology
  workspace with draft/published/archived status, source traceability, and
  lightweight editing.
- **Ranking v0** — deterministic priority triage
  (`high_priority | watch | low_priority`) with explainable reasons/warnings,
  workspace priority badges, and productized user-facing priority labels that do
  not expose raw scores.
- **Publish Quality Gate v0** — deterministic publish-readiness checks
  (blocking errors and non-blocking warnings) plus a user-facing preview before
  publication.

## Content intelligence & AI-assisted enrichment

- **Content Intelligence v1** — editable explanation fields (why it matters, who
  should care, technical context, impact areas, learning path, related
  knowledge/skill explanations, follow-up questions, reading difficulty,
  enrichment status) published into safe user-facing records.
- **AI-assisted Editorial Enrichment v0** — workspace-only enrichment
  suggestions via rule-based, mock LLM, and optional LLM-assisted generation,
  behind a server-side LLM provider boundary (`mock` and `openai_compatible`),
  with output validation/sanitization and generate/compare/apply/reject/
  regenerate flows. Falls back to mock generation when no API key is configured.
- **Prompt Quality & Editorial Review v1** — workspace-only `PromptVersion`
  records, per-suggestion `promptVersionId`, and a review loop with score,
  labels, notes, rejection reason, applied-field tracking, and stale-suggestion
  handling.

## Daily digest & delivery

- **Daily Digest Editorial Workflow v1** — generates a draft digest from
  published technologies using Ranking v0, with editable copy, manual
  add/exclude/pin/order controls that survive regeneration, aggregated related
  skills/knowledge/sources, preview, publish-readiness checks, and public
  `/digest/today` and `/digest/[date]` pages.
- **Digest Delivery Surface v0** — public `/feed.xml` and `/feed.json` for
  published digests only, with internal fields excluded.
- **Digest Delivery Integration v1 + Channel Expansion v1** — workspace-only
  generic webhook and Feishu webhook channels, JSON/text payloads, manual send
  for published digests only, and delivery logs with success/failure/retry
  state. Endpoint URLs are masked and kept off user-facing pages.
  (`email | telegram | discord` channel types are reserved/typed but not full
  delivery products.)
- **Scheduled Delivery v0** — workspace-only schedules for sending published
  digests to enabled channels, a local runner for due/manual runs,
  schedule-level run records alongside per-channel `DeliveryRun` logs, and
  same-day duplicate-send protection.
- **Real Cron / Task Runner v1** — `tasks:run-once` and `tasks:watch`
  command-line entry points, task-runner audit summaries, reuse of the
  duplicate-send protection, and URL/token sanitization in logs.

## Persistence, hardening & operations

- **Public technology RSC payload hardening** — 2026-07-10: public
  `TechnologyItem`s no longer carry the persisted `priority` ranking object
  (`priorityScore`, raw `priorityReasons`/`priorityWarnings`,
  `rankingSource`). Those fields were never rendered on public pages, but
  because the technology detail, digest, and radar renderers are client
  components, the full ranking object was serialized into their RSC flight
  payloads — the same class of leak fixed earlier for digest pages via
  `PublicDigestView`. The public mapping in `src/lib/content.ts`
  (`toUserFacingTechnologyItem` + seed-item strip) now omits `priority`
  entirely; every public surface already derived the productized priority
  level on demand via `evaluateTechnologyPriority` (pure over public
  fields), so no component changed. `validate:ranking` now asserts the
  inverse contract: published technologies expose no ranking internals and
  the priority level stays derivable. The full `TechnologyPriorityRanking`
  remains on `TechnologyWorkspaceRecord` behind the workspace boundary.
- **Deployment Readiness & Security Boundary v0** — explicit public/workspace/
  internal-API route boundaries, optional token protection for workspace routes,
  documented environment variables, and `validate:deployment` checks.
- **Persistence Migration Planning v0** — centralized local JSON mechanics in
  `src/lib/repositories/local-json-store.ts`, confirmation that pages/APIs call
  workflow services instead of reading JSON directly, and a documented future
  database path.
- **Database Migration v0** — optional SQLite driver (Node's built-in
  `node:sqlite`) with JSON as the default fallback, schema v0 for the current
  workflow objects, `db:init` / `db:migrate-json` / `db:reset` /
  `validate:database`, and DB access kept behind repository/store helpers.
- **Database-backed Workflow Hardening v1** — a workspace-only `WorkflowEvent`
  audit log, stronger conversion/publish/delivery/schedule guards against
  duplicate or invalid operations, workspace-only event panels, and
  `validate:workflow-hardening`.
- **Observability & Admin Operations v0** — `/workspace/operations` health
  dashboard and `/workspace/operations/events` filtered audit browser,
  summarizing failed imports/deliveries/scheduled runs, task-runner status,
  digest status, open duplicates, and candidate quality issues.

## Navigation, IA & design system

- **Digest generation copy localization (Chinese)** — 2026-07-10, the final
  slice of the localization sequence and the only one that touches public
  content generation: the default digest title template
  (`getDefaultDigestTitle` in `digest-store.ts`, now `每日技术简报 - 日期`),
  the generated digest summary (`buildDigestSummary` in
  `digest-workflow.ts`, now `今日 N 条立即关注，N 条值得跟踪，覆盖 N 个来源。`
  plus a Chinese empty-digest fallback), the `normalizeDigest` summary
  fallback, and the default editorial-note templates are now generated in
  Chinese. The two published real digests (2026-07-09 / 2026-07-10) had
  their English default titles/summaries backfilled to the new Chinese
  copy via `updateDailyDigest` (editor-written Chinese editorial summaries
  untouched); the May delivery-validation fixtures were left as-is since
  `public-copy.ts` already sanitizes them on public surfaces. Share text
  and the public-copy fallbacks were already Chinese. Verified with
  typecheck, lint, format, vitest 54/54, the six digest/delivery
  validators, and a live pass over `/digest/today`, `/digest/2026-07-09`,
  `/feed.xml`, `/feed.json`, and the home digest card (feed item titles now
  Chinese, zero leftover generation English, zero console errors).
- **Workspace diagnostic-string localization (Chinese)** — 2026-07-10, the
  owner-chosen follow-up to Workspace UI localization v0: the six categories
  of lib-generated diagnostic strings deliberately left English in that pass
  are now generated in Chinese — Ranking v0 `priorityReasons` /
  `priorityWarnings` (`src/lib/ranking.ts`), Publish Quality Gate messages
  (`publish-readiness.ts`), digest publish-readiness messages
  (`digest-workflow.ts`), source import messages (`source-workflow.ts`,
  `external-import.ts`, including the fallback-candidate placeholder copy),
  delivery / scheduled-delivery / task-runner messages, and operations
  statusReasons + attention-item copy (`operations-metrics.ts`). The vitest
  tests and validate scripts asserting those strings were updated in the
  same change (`ranking.test.ts`, `validate:ranking`,
  `validate:delivery-integration`, `validate:delivery-channels`,
  `validate:scheduled-delivery`, `validate:tasks`, `validate:operations`);
  `validate:workspace-boundary` — found to have been silently stale since
  earlier copy refactors (it asserted "Internal Workspace" copy that no
  longer existed pre-localization) — was re-pointed at the current Chinese
  nav/dashboard/action copy. Historical English messages already persisted
  in `config/` stores are intentionally untouched (audit data; they age out
  naturally). Digest _generation_ copy (default title/summary/editorial-note
  templates, which feed public digest content), workflow event action codes,
  and imported data content remain English by design. Verified with
  typecheck, lint, format, vitest 54/54, and all 22 `validate:*` scripts
  green.
- **Workspace UI localization v0 (Chinese)** — 2026-07-10: all Internal
  Workspace UI chrome is now Chinese — the workspace nav/groups and
  breadcrumbs, every `/workspace/*` page title/description/section label,
  dashboard, table heads, form labels and placeholders, buttons, confirm
  dialogs, empty states, hints, client action messages, and date formatting
  (`en` → `zh-CN`). Display-label helpers (`source-display`,
  `imported-candidate-display`, `quality-display`, `delivery-labels`,
  `getRankingSourceLabel`, operations metric labels) now return Chinese, and
  workspace components pass `"zh"` to the bilingual `getPriorityLevelLabel`;
  status enums rendered raw before (draft/published, open/resolved,
  success/failed, healthy/critical …) gained local label maps. Deliberately
  NOT translated in this pass: lib-generated diagnostic strings persisted in
  data or asserted by `validate:*` scripts (ranking `priorityReasons`
  / `priorityWarnings`, import/delivery run messages, readiness check
  messages, workflow event snapshots, operations `statusReasons` /
  attention-item text) plus data content itself. Public pages untouched — the
  translated label helpers are workspace-only, and the bilingual public
  priority-label behavior is preserved. Verified with typecheck, lint,
  format, vitest 54/54, `validate:operations`, and a live sweep of all 11
  workspace routes (leftover-English scan showed only in-scope diagnostic
  and data strings, zero console errors).

- **Workspace Navigation & Information Architecture v0** — `/workspace`
  dashboard, a clickable Sources → Import → Candidates → Duplicates → Drafts →
  Publish → Digests workflow overview, shared workspace navigation, and
  breadcrumbs on detail/preview pages.
- **Workspace Boundary & Action Clarity v0** — result-oriented action labels,
  confirmation prompts for destructive/external-send/regeneration/retry/
  overwrite actions, and helpful disabled/empty states.
- **User-facing Product IA & Discovery Flow v0** — public product home with the
  latest digest, priority signals, and Skills/Knowledge entry points; Daily
  Digest in global navigation; and skills/knowledge pages that explain how they
  connect to published technology signals.
- **Design System v0** — separate `WorkspacePageShell` / `UserPageShell` page
  families and a shared `PageHeader` primitive, keeping internal-only fields off
  user-facing layouts.
- **User-facing Typography Scale v0** — centralized font family and a five-step
  size scale (`--fs-h1` 28 / `--fs-section` 22 / `--fs-card-title` 18 /
  `--fs-body` 15 / `--fs-label` 13) plus a unified `--lh-base` 1.5 line-height,
  defined as `:root` tokens in `src/app/globals.css` and applied only under
  `.user-shell` (public pages). Internal Workspace and the shared TopNav keep
  their existing typography. Typography-only: no layout, color, logic, or
  component-structure changes.
- **Bilingual support** — content-level localization (`original` / `zh` / `en`)
  for technology title, summary, and content, with Chinese-preferred display and
  original-source fallback. No route-based i18n.

## Knowledge relationship network

- **Technology-to-technology relations v0** — optional `relatedTechnologyIds` on
  `TechnologyItem`, seeded with real cross-links between published technologies
  (e.g. MCP ↔ browser agents ↔ agent workbenches), rendered as a navigable
  "相关技术" section on the technology detail page via the existing
  `RelatedItemsSection`. First step toward making the Technology / Skill /
  Knowledge graph visible and walkable per the product rule, rather than three
  separate lists.
- **Walkable relationship graph across all three detail pages** — the small
  relationship visualization (previously only on the technology detail page) is
  now a shared, generic `RelationshipGraph` component rendered on the technology,
  skill, and knowledge detail pages. Each page shows the current node at the
  centre with its neighbouring technologies, skills, and background knowledge as
  clickable spokes (colour-coded by kind), so a reader can hop
  technology → skill → knowledge → technology and always land on another page
  that shows its own neighbourhood. This makes discover → understand →
  **connect** hold across every entity type, not just technologies.
- **Shared relationship-density line on all three index cards** — extracted the
  technology list card's "关联 · N 技术 · N 技能 …" line into a reusable
  `RelationDensity` component and adopted it on the skill and knowledge index
  cards, which previously showed a different pill-count style. All three index
  pages now render the same relationship-density line.
- **Full semantic relation typing across the content graph** — every
  technology↔technology, technology↔skill, technology↔knowledge, and
  skill↔knowledge link that exists as a `relatedXIds` reference now has an
  explicit `LinkRelation` entry (27 new entries: 12 skill↔knowledge, 6
  technology↔knowledge, 9 technology↔skill), so relation-type pills and graph
  tooltips show a real Chinese label (建立在 / 需要 / 支持 / 解释 / …) instead of
  falling back to the generic "相关". A new `findRelationBetween` helper in
  `src/lib/content.ts` looks up the relation regardless of which side
  `LinkRelation` records as `from`/`to`. The skill and knowledge detail pages
  now show the same relation-type pill (reusing `.user-related-section__relation`)
  on each related-content card that the technology detail page already showed,
  and the shared `RelationshipGraph` nodes carry a hover tooltip with the
  relation label and explanation.
- **Whole-network overview page (`/network`)** — the final P2 item. A new
  `getContentGraph()` helper in `src/lib/content.ts` computes every published
  technology/skill/knowledge node and every `relatedXIds` reference between
  them (deduplicated as an undirected edge, typed via `findRelationBetween`).
  The new `ContentNetworkGraph` client component renders all 24 nodes grouped
  into three lanes by kind with every edge drawn between them; clicking any
  node highlights its direct connections, dims the rest, and opens a side
  panel with the node's title, a link to its own detail page, and its full
  connection list (relation-type pill + linked title per connection). Added to
  `TopNav` as "关系网络". This is the one place a reader can see the whole
  discover → understand → connect graph at once, instead of one node's
  neighbourhood at a time.

## AI-assisted understanding

- **Compare two technologies (P3 v0)** — the first capability shipped under P3
  ("AI-assisted understanding"), which `AGENTS.md` had listed as out of scope
  until the project owner explicitly authorized it, and scoped to exactly one
  thing: comparing two published technologies. Explain and learning-path
  generation remain deferred. On `/technologies/[slug]`, a reader can pick
  another published technology from a dropdown built from
  `getAllTechnologies()` (already published-only) and request a live
  AI-generated comparison (similarities, differences, when to prefer each),
  rendered by the new client-side `TechnologyCompareWidget` between the
  "相关技术" and "相关技能" sections. Unlike Editorial Enrichment, this is
  **not** editor-gated: the result is shown immediately, always paired with a
  persistent "AI 生成内容，未经编辑审核，仅供参考" disclaimer in the same paint
  as the result, so unlabeled AI content is never visible. This is also the
  project's first public, unprotected route that calls the LLM provider
  directly (`POST /api/technologies/compare`); results are cached per
  unordered technology-id pair (`config/technology-comparisons.json`) so the
  same pair is generated at most once, and a single public-mapping function
  (`toPublicComparisonResult` in `src/lib/technology-comparison.ts`) strips
  provider name, model name, prompt version, generation mode, and validation/
  generation-error details before any response leaves the server — the same
  internal-field discipline the existing LLM Provider Boundary already
  required for Editorial Enrichment, now enforced on a public response for the
  first time. Reuses the existing `PromptVersion` system (extended to support
  a `technology_comparison` purpose alongside `editorial_enrichment`) and a
  newly shared `src/lib/llm/output-sanitization.ts` helper module extracted
  from the Editorial Enrichment output validator.
- **Explain a technology at the reader's level (P3 v1)** — the second P3
  capability, authorized by the owner after Compare v0 and built as a
  deliberate structural clone of it. On `/technologies/[slug]`, a reader picks
  their experience level (入门 / 进阶 / 资深) in the new
  `TechnologyExplainWidget` (rendered between the 技术背景 and 谁该关注
  sections) and requests a live AI-generated explanation tailored to that
  level: a plain-language `explanation`, `keyPoints`, an optional beginner
  `analogy`, and optional `nextSteps`. Results are cached per technology ×
  level (`config/technology-explanations.json`, cache key
  `technologyId::audienceLevel`) so each combination is generated at most
  once, served by the new public `POST /api/technologies/explain` route and
  always rendered with the same persistent "AI 生成内容，未经编辑审核，仅供参考"
  disclaimer in the same paint as the result. Reuses the Compare
  infrastructure wholesale: the server-side LLM provider boundary (mock by
  default), a new `technology_explanation` `PromptVersion` purpose with a
  purpose-aware default, the shared `output-sanitization.ts` validator
  helpers, and a dedicated public-mapping function
  (`toPublicExplanationResult` in `src/lib/technology-explanation.ts`) that
  strips provider name, model name, prompt version, generation mode, and
  validation/generation-error details before any response leaves the server.
- **Graph-grounded learning path (P3 v2)** — the third and final P3 capability
  from the agreed candidate list, completing the Compare → Explain → learning
  path sequence. On `/technologies/[slug]`, a reader clicks 生成学习路径 in
  the new `TechnologyLearningPathWidget` (rendered between the editor-curated
  学习路径 section and the relationship graph) and receives a live
  AI-generated learning path for the current technology: a path `overview`,
  ordered `steps` (3–6), and optional self-check `checkpoints`. The defining
  difference from Compare/Explain is **graph grounding**: the prompt feeds
  the technology's actual related knowledge and related skills (titles +
  summaries from the content graph) and instructs the model to build the
  steps on them by name — connecting P2's relationship network to P3's AI
  layer. Results are cached per technology
  (`config/technology-learning-paths.json`, keyed by `technologyId`), served
  by the new public `POST /api/technologies/learning-path` route, and always
  rendered with the same persistent "AI 生成内容，未经编辑审核，仅供参考"
  disclaimer in the same paint as the result. Same structural template as
  Compare/Explain: a `technology_learning_path` `PromptVersion` purpose with
  purpose-aware default, shared `output-sanitization.ts` validator helpers,
  a mock-provider branch (which references real related knowledge/skill
  titles extracted from the prompt), and a dedicated public-mapping function
  (`toPublicLearningPathResult` in `src/lib/technology-learning-path.ts`)
  stripping all provider/model/prompt metadata from the public response.

## Personalization

- **Personalized digest view (P4 v0.2)** — shipped 2026-07-09, the third
  P4 slice: the public digest pages (`/digest/today` and `/digest/[date]`,
  both rendered by `DailyDigestContent`) now react to the reader's followed
  topics. When the reader follows topics, a personalization bar appears
  between 今日概览 and the signal sections showing "已关注 N 个话题，本期命中
  M 条" plus a "只看我关注的" toggle; matched items carry the same
  "命中关注：X" explanation line as `/radar` (highlight always on, full
  editorial curation shown by default). Turning the filter on hides
  non-matching items, hides a signal section entirely when it has no matches,
  and shows a guided empty state with a one-click "查看全部内容" reset when
  nothing matches. Readers with no follows see the digest unchanged except a
  one-line hint linking to `/radar`. Implementation: `DailyDigestContent`
  became a client component (same pattern as `technology-detail-content.tsx`),
  reusing `src/lib/followed-tags.ts` and the `my-radar__*` chip/match-line
  styles; the `rssFeedPath` / `jsonFeedPath` constants moved to a new
  dependency-free `src/lib/feed-paths.ts` (re-exported from
  `digest-delivery.ts` for existing consumers) so the client bundle does not
  pull the filesystem-backed digest workflow. Skills / knowledge / sources /
  feed sections are untouched, and the route still serves identical published
  content to everyone — personalization is entirely client-side, consistent
  with the P4 v0 boundary. Verified with typecheck, lint, format:check,
  vitest 54/54, and a live pass on `/digest/today` (highlight, filter on/off,
  zero-match empty state + reset, no-follows hint, mobile width without
  overflow, no console errors).
- **Detail-page follow entry (P4 v0.1)** — shipped 2026-07-09, immediately
  after P4 v0, as the owner-chosen follow-up: readers can now follow a topic
  from where they read about it, not only on `/radar`. The tags section on
  all three user-facing detail pages (technology `/technologies/[slug]`,
  skill `/skills/[slug]`, knowledge `/knowledge/[slug]`) now renders the new
  shared client component `FollowableTagList`
  (`src/components/followable-tag-list.tsx`) instead of the static `TagList`:
  each tag becomes the same follow/unfollow toggle chip used on `/radar`
  (reusing the `my-radar__tag-toggle` styles and the localStorage helpers in
  `src/lib/followed-tags.ts`, so state syncs across components and tabs).
  Below the chips, one hint line closes the loop: "点击话题，将它加入我的雷达"
  when none of the page's tags are followed, or "已加入我的雷达 · 查看" with a
  link to `/radar` when at least one is. Hero tags and the small tags on
  related-item cards stay static (`TagList`); no accounts, no server state —
  the same P4 v0 boundary. Verified with typecheck, lint, format:check,
  vitest 54/54, and a live pass on all three detail pages (toggle on/off,
  localStorage + hint sync, mobile width without overflow, no new console
  errors).
- **Personal radar (P4 v0)** — the first capability shipped under P4
  ("personalization"), owner-authorized on 2026-07-09 with a deliberately
  minimal, boundary-respecting design: **no accounts, no server-side profile,
  no AI ranking**. Readers follow topic tags via toggle chips on the new
  public `/radar` page ("我的雷达", added to `TopNav`); follows are stored
  only in browser `localStorage`
  (`src/lib/followed-tags.ts`, key `ai-tech-radar:followed-tag-ids`, with a
  custom event + `storage` listener for cross-component sync). The radar
  aggregates published technologies whose tags intersect the followed set,
  groups them with the existing deterministic Ranking v0 priority levels
  (立即关注 / 值得跟踪 / 了解即可, date-sorted within groups, reusing
  `TechnologyListCard`), and shows an explainability line per item
  (命中关注：X). Empty states guide first-time and no-match cases. Also fixed
  a content defect found during verification: the three real published
  signals (gpt-live / vllm / ollama) used freeform tag strings instead of
  canonical `TopicTag` ids, so they could not be matched by tag anywhere; a
  new canonical tag `tag-inference` (推理与部署) was added and the three
  records were re-tagged (`tag-multimodal`, `tag-inference`,
  `tag-inference` + `tag-on-device`).

## Developer tooling

- **Linting & formatting config v0 (ESLint + Prettier)** — flat-config ESLint 9
  (`eslint.config.mjs`) extending `next/core-web-vitals`, `next/typescript`,
  and `eslint-config-prettier`, with `.claude/**`, `config/**`, and build
  output ignored, `@typescript-eslint/no-require-imports` disabled for `.cjs`
  scripts, and unused-vars tuned to allow `_`-prefixed bindings and
  destructuring rest siblings. Prettier config (`.prettierrc.json` /
  `.prettierignore`) is calibrated to the existing house style — double
  quotes, semicolons, no trailing commas, 80 columns — plus `endOfLine:
"auto"` because the working tree is checked out with `core.autocrlf=true`
  (CRLF), which Prettier's default `lf` setting would otherwise flag in every
  file. New commands: `npm run lint`, `lint:fix`, `format`, `format:check`.
  The first lint pass surfaced and removed four pieces of dead code (an
  orphaned private `getAutoDigestContentIds` in `digest-workflow.ts` and
  unused imports in `validate-database.ts` and the delivery schedules page).
  Also fixed the pre-existing `validate:delivery` fixture mismatch: its
  fixture digest copy contained the word "validation", which the public-copy
  sanitizer (`src/lib/public-copy.ts`) intentionally rewrites out of public
  digest titles, so the feed-title assertions failed; the fixture was renamed
  to public-safe wording and the sanitizer left unchanged.
