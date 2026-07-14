# Next Task

> Update 2026-07-14: **Public site-wide search v0 shipped** (owner-authorized
> after the news fast lane; scope aligned upfront: graph three types + news,
> server-rendered `?q=`, title/summary/tags matching only). New public
> `/search` page (「搜索」 in `TopNav`), `src/lib/search.ts`
> (`searchPublicContent`, deterministic case-insensitive AND matching), and a
> `.search-*` CSS block; news results reuse the `src/lib/news.ts` mapping and
> always render the 自动聚合 disclaimer, so no new candidate→public mapping
> point was created. Verified with typecheck, lint, and a live pass (CN/EN
> queries, multi-term AND, disclaimer, mobile width, console clean). See
> `CHANGELOG.md` → "Site-wide search". Also on 2026-07-14: the Windows Task
> Scheduler daily task `ai-tech-radar-tasks` (08:05) was registered and
> test-run on the owner's machine — the deployment.md manual step is done, so
> daily imports now run unattended.

> Update 2026-07-13: **News fast lane + scheduled import v0 shipped**
> (owner-authorized, "content freshness/volume" direction — see
> `CHANGELOG.md` → "News fast lane & scheduled import" for the full entry).
> Two pieces: (1) public `/news` (今日快讯, in `TopNav`, plus a home board)
> renders the last 7 days of imported candidates through the new sanitizing
> map `src/lib/news.ts` — the single candidate→public mapping point, with
> rejected/fallback/non-primary-duplicate exclusion and a fixed
> 自动聚合，未经编辑精选 disclaimer; (2) the task runner now runs a scheduled
> daily source import (`src/lib/scheduled-import.ts`,
> `config/scheduled-import.json`, default 08:00 Asia/Shanghai, no fallback
> placeholders on unattended runs), managed from
> `/workspace/delivery/schedules` (定时导入 panel +
> `PATCH /api/workspace/scheduled-import`), with Windows Task Scheduler
> setup documented in `docs/deployment.md`. `validate:tasks` pins a disabled
> import config during validation so it never triggers live imports. The
> curated signal/digest tier and its editorial gate are unchanged
> (two-tier content model, recorded in `docs/project-spec.md` →
> "Scheduled Import + News Fast Lane v0" and `docs/security-boundary.md` →
> "News Fast Lane Boundary").

> Update 2026-07-10: Workspace UI localization v0 shipped — all Internal
> Workspace UI chrome is now Chinese (see `CHANGELOG.md` → "Navigation, IA &
> design system"). The follow-up diagnostic-string pass shipped the same
> day (owner-chosen): ranking reasons/warnings, publish & digest readiness
> messages, import / delivery / schedule / task-runner messages, and
> operations statusReasons / attention items are now generated in Chinese,
> with the asserting vitest tests and validate scripts updated to match
> (all 22 validators green). Historical English messages already persisted
> in `config/` are intentionally left as-is (audit data); they age out as
> new records are written. The digest _generation_ copy (default digest
> title/summary/editorial-note templates, which feed public content) was
> localized the same day as the final slice, with the two published real
> digests backfilled to the new Chinese titles/summaries. Still English by
> design: workflow event action codes and data content itself.

> See `docs/roadmap.md` for the high-level plan. P1 (visual pass) and P2
> (knowledge relationship network) are both done. P3 (AI-assisted
> understanding) has completed its agreed candidate list: Compare (v0),
> Explain (v1), and the graph-grounded learning path (v2) have all shipped
> (the last two on 2026-07-05, owner-authorized). P4 (personalization) was
> owner-authorized on 2026-07-09 and its v0 — the followed-topics personal
> radar at `/radar`, localStorage-only, deterministic Ranking v0 grouping —
> has shipped (see "Personal radar (done)" below), followed the same day by
> the owner-chosen v0.1 — the detail-page follow entry (see "Detail-page
> follow entry (done)" below) — and v0.2 — the personalized digest view
> (see "Personalized digest view (done)" below). Any further P3 or P4
> capability is new scope to be proposed by the owner per capability. The
> tracked code-debt list is empty: the store-decomposition pattern has been
> applied to every file it was planned for, the ESLint/Prettier config has
> shipped, and the SQLite storage-model decision has been made (document
> store by design — see `docs/decisions.md`). The first real
> content-production rounds have also run: five real external sources are
> configured, and five enriched real signals (gpt-live, vllm, ollama, plus
> gpt-5-6 and chatgpt-work from the 2026-07-10 round) and the 2026-07-09 /
> 2026-07-10 digests are published. The 2026-07-10 round also added the
> canonical tag `tag-frontier-models` (前沿模型), dispositioned all 10 open
> candidates (2 published, 2 reviewed-not-selected, 6 rejected including 4
> fallback placeholders and 2 stale May quality fixtures), and closed the
> last open duplicate group.

> Done since last update: vitest test setup + unit tests (ranking, publish
> readiness, dedup, digest), CI workflow (`.github/workflows/ci.yml` running
> typecheck + test), the first three refactor passes on `candidate-workflow.ts`,
> all three originally-planned store extractions from `candidate-workflow.ts`
> (duplicate-group, technology-workspace, imported-candidate snapshot), a
> Workspace visual-confirmation pass (found and fixed a breadcrumb bug on
> `/workspace/delivery` and `/workspace/operations` sub-pages), the
> `digest-store.ts` extraction from `digest-workflow.ts`, Compare two
> technologies (P3 v0, see `CHANGELOG.md`), a second Workspace
> visual-confirmation pass covering `/workspace` dashboard,
> `/workspace/duplicates` (list + detail), `/workspace/operations` (+ events),
> and `/workspace/technologies` (list + detail) at desktop and mobile widths —
> found and fixed a real CSS specificity bug where `.detail-layout` and
> `.candidate-review-layout` sidebars overlapped the main content on mobile
> (≤900px) instead of stacking below it, affecting `/workspace/duplicates/[id]`,
> `/workspace/candidates/[id]`, `/workspace/sources/[id]`, and
> `/workspace/technologies/[id]` — the `candidate-workflow.ts` →
> `technology-draft-workflow.ts` extraction (resolving the "harder cut" this
> file used to flag as needing fresh analysis), and the `sqlite-store.ts`
> decomposition into twelve per-domain files plus `sqlite-primitives.ts` (see
> below) — every file originally flagged for this decomposition pattern has
> now had it applied. Also found (via a `validate:*` regression sweep, not
> caused by this work) and flagged a pre-existing `npm run validate:delivery`
> failure for separate follow-up. Most recently: a user-facing
> visual-confirmation pass covering `/digest/today`, `/digest/[date]`,
> `/skills` (index + detail), and `/knowledge` (index + detail) at desktop and
> mobile widths — checking layout stacking, horizontal overflow, an
> internal-field leak scan of rendered text, and console errors. No new bugs
> found this round; this empties `docs/page-structure.md`'s "pages left for
> later UI migration" list entirely.

Recommended next task:

Every file originally flagged for the store-decomposition pattern
(`candidate-workflow.ts` → `technology-draft-workflow.ts`, `digest-workflow.ts`
→ `digest-store.ts`, `sqlite-store.ts` → twelve domain files) is now done, and
every page ever flagged for visual confirmation (workspace and user-facing)
has had its desktop+mobile pass — see the sections below for each. The
linting/formatting config (ESLint + Prettier) has also shipped — see "ESLint +
Prettier config (done)" below. The SQLite storage-model decision has also been
made and recorded (2026-07-05): the driver stays a document store by design —
see `docs/decisions.md` → "SQLite Storage Model" and the storage-model note in
`docs/database-migration.md`. With that, the tracked code-debt list is empty.

Most recently (2026-07-05): **Explain at the reader's level (P3 v1)** shipped —
see `CHANGELOG.md` → "AI-assisted understanding" for the full description. It
is a deliberate structural clone of Compare v0: new
`src/lib/technology-explanation.ts` (workflow + `toPublicExplanationResult`
public strip), `technology-explanation-store.ts` (cache keyed
`technologyId::audienceLevel` in `config/technology-explanations.json`),
`llm/prompts/technology-explanation.ts`,
`llm/technology-explanation-output.ts` (validator on the shared
`output-sanitization.ts` helpers), a `technology_explanation` `PromptVersion`
purpose with default, a mock-provider branch, public
`POST /api/technologies/explain`, and the `TechnologyExplainWidget` on
`/technologies/[slug]` (between 技术背景 and 谁该关注, reusing the compare
widget's CSS). Verified with typecheck, lint, format:check, vitest 45/45 (14
new tests), and a live end-to-end pass in the dev server (widget renders, POST
returns the public-safe shape with the disclaimer, provider metadata absent
from the response, cache record written).

That learning-path candidate has now shipped too (2026-07-05, same day,
owner-authorized): **Graph-grounded learning path (P3 v2)** — see
`CHANGELOG.md` → "AI-assisted understanding". New
`src/lib/technology-learning-path.ts` (workflow + `toPublicLearningPathResult`
public strip), `technology-learning-path-store.ts` (cache keyed by
`technologyId` in `config/technology-learning-paths.json`),
`llm/prompts/technology-learning-path.ts` (feeds the technology's related
knowledge/skills — titles + summaries — into the prompt and instructs the
model to build steps on them by name), `llm/technology-learning-path-output.ts`
(overview + steps required, checkpoints optional), a
`technology_learning_path` `PromptVersion` purpose with default, a
mock-provider branch that references real related item titles, public
`POST /api/technologies/learning-path`, and the `TechnologyLearningPathWidget`
on `/technologies/[slug]` (between the editor-curated 学习路径 section and
the relationship graph, reusing the compare widget's CSS). Verified with
typecheck, lint, format:check, vitest 54/54 (9 new tests), and a live
end-to-end pass (steps reference the real related knowledge「API 契约与接口
边界」and skill「智能体工作流设计」for tech-mcp; disclaimer renders first in
the result; provider metadata absent from the response; cache record
written). One bug was found and fixed during live verification: the mock's
title extraction missed because the prompt labels include "(from the content
graph)" — the regex label now escapes it, and the stale ungrounded cache
record was deleted before re-verifying.

With that, **the agreed P3 candidate list (Compare → Explain → learning path)
is complete.** There is no predefined next task: further P3 capabilities are
new scope for the owner to propose, and P4 (personalization) still requires
explicit authorization.

The pre-existing `npm run validate:delivery` fixture mismatch flagged above is
now fixed: the script's fixture digest title (`Delivery validation digest ...`)
and summary contained the word "validation", which `getPublicDigestTitle` /
`getPublicDigestSummary` (`src/lib/public-copy.ts`, added later by the UI
refactor's public-copy sanitization) intentionally rewrite into generic public
digest copy — so the feed-title assertions failed against the sanitized output.
The fixture copy was renamed to public-safe wording (`Public delivery digest
...`); the sanitizer behavior itself was correct and unchanged.

## Progress so far

`candidate-workflow.ts` has gone from 1763 to 744 lines via six pure,
behavior-preserving extractions (each verified with `npm run typecheck` and
`npm run test`):

- `src/lib/candidate-duplicate-rules.ts` — pure duplicate-detection rules and
  identity helpers (URL/title normalization, token similarity, reason rules,
  stable group id, primary-candidate selection).
- `src/lib/workspace-record-normalizers.ts` — text/field/localized-text
  normalization.
- `src/lib/candidate-conversion-mapping.ts` — candidate → draft field mapping
  (type, publisher, tags, draft text, source reference).
- `src/lib/candidate-duplicate-store.ts` — `DuplicateGroupStore`/
  `DuplicateAnalysis` types, `readDuplicateGroupStore`,
  `writeDuplicateGroupStore`, and `analyzeDuplicates`. `candidate-workflow.ts`
  now imports these three functions instead of defining them; the higher-level
  getters (`getDuplicateGroupCandidates`, `updateDuplicateGroup`,
  `getDuplicateComparisonsForCandidate`) stayed put as planned, since they call
  back into candidate getters and would create a circular import otherwise.
- `src/lib/candidate-technology-workspace-store.ts` — `TechnologyWorkspaceStore`
  type, `normalizeTechnologyWorkspaceRecord` (private), `readTechnologyWorkspaceStore`,
  and `writeTechnologyWorkspaceStore`. Deliberately narrower than the original
  plan's wording ("...and the record getters/updaters"): the getters/updaters
  (`getTechnologyWorkspaceRecords`, `updateTechnologyWorkspaceRecord`, publish/
  archive transitions, candidate→draft conversion, etc.) turned out to be
  woven through ~500 lines of cross-cutting logic (workflow events, publish
  readiness, candidate conversion) rather than a self-contained cluster like
  the duplicate-group getters were. Moving all of that in one step risked a much
  larger, higher-risk change than the "one cluster per commit" rule intends, so
  only the clean store layer moved this round.
- `src/lib/candidate-import-snapshot-store.ts` — `sanitizeImportedCandidate`
  (private), `buildFallbackSnapshot` (private), `readImportedCandidateSnapshot`,
  `writeImportedCandidateSnapshot`, `getImportedCandidateSourceId`, and
  `mergeImportedCandidatesForSource`. `getImportedCandidateSourceId` and
  `mergeImportedCandidatesForSource` were previously re-exported through
  `candidate-workflow.ts` for `source-workflow.ts`'s benefit; updated
  `source-workflow.ts` to import them directly from the new module instead of
  keeping a re-export hop.

## Remaining clusters to extract

1. ~~Duplicate-group store.~~ Done — see above.
2. ~~Technology-workspace store (read/write/normalize layer).~~ Done — see
   above.
3. ~~Imported-candidate snapshot store.~~ Done — see above.
4. ~~Technology-draft-workflow (record getters/updaters, publish/archive
   transitions).~~ Done — see "technology-draft-workflow.ts extraction" below.

All four clusters are extracted. `candidate-workflow.ts` no longer has an
obvious further cluster to pull out — see "Recommended next task" above.

## technology-draft-workflow.ts extraction (done)

`candidate-workflow.ts` went from 834 to 549 lines (285 lines moved, plus 4
dead imports removed — `topicTags`, `getImportedCandidateSourceId`,
`mergeImportedCandidatesForSource`, and the `CandidateNormalizedType` /
`ImportedCandidateSourceRecord` types had been left behind by earlier
extractions and were no longer referenced anywhere in the file).

The step 2 entry above previously described this as needing "fresh dependency
analysis" to decide whether "candidate → draft conversion" and "draft
publish/archive transitions" could split into two modules. That framing
turned out to be the wrong cut. Conversion (`convertImportedCandidateToDraft`,
`getCandidateDraftConversionReadiness`) is inherently a _candidate-side_
operation — its primary side effect is mutating candidate review state, which
is private to `candidate-workflow.ts` — so it cannot be separated from
candidate review without exposing that private state. But conversion and
publish/archive turned out **not** to depend on each other in the direction
that matters: publish/archive/CRUD on `TechnologyWorkspaceRecord` never reads
candidate or duplicate-group data, so _that_ half is a clean, self-contained
cut. Conversion keeps one call into it (`getTechnologyWorkspaceRecordById`,
for idempotency) — a one-directional import, not a cycle.

- `src/lib/technology-draft-workflow.ts` — `TechnologyWorkspaceRecordUpdate`,
  `getTechnologyWorkspaceRecords`, `getTechnologyWorkspaceRecordById`,
  `getTechnologyDrafts`, `getTechnologyDraftById`,
  `getPublishedTechnologyWorkspaceRecords`,
  `getTechnologyWorkspacePublishReadiness`, `updateTechnologyWorkspaceStatus`,
  `updateTechnologyWorkspaceRecord`, `publishTechnologyWorkspaceRecord`.
  `candidate-workflow.ts` now imports only `getTechnologyWorkspaceRecordById`
  back from it (used once, in `convertImportedCandidateToDraft`'s idempotency
  check).
- Confirmed via grep before moving anything: every external consumer of these
  functions (`src/lib/content.ts`, `src/lib/editorial-enrichment.ts`, and six
  `src/app/**` page/route files) already imported them independently of any
  candidate/duplicate-group function — none needed a mixed import split
  except `src/app/workspace/page.tsx` and `src/lib/content.ts`, which had one
  function from each module in the same `import` statement and needed
  splitting into two.
- 10 `scripts/validate-*.ts` files also imported these functions directly
  (via relative paths, not the `@/` alias) and needed the same redirect;
  4 of them had a mixed A/B import needing a split.
- Verified with `npm run typecheck`, `npm run test` (31/31), and all 10
  affected `npm run validate:*` scripts (candidates, content-intelligence,
  database, duplicates, editorial-enrichment, llm-enrichment, persistence,
  prompt-quality, ranking, workflow-hardening) — all passed unchanged. Also
  live-checked `/workspace/technologies`, a technology draft detail page, and
  the public `/technologies` list (which reads through `content.ts`) — all
  rendered identical real data with no console errors.

## digest-workflow.ts decomposition (done)

`digest-workflow.ts` has gone from 887 to 787 lines via one extraction,
following the exact same pattern:

- `src/lib/digest-store.ts` — `DailyDigestStore` type, `getTodayDateString`,
  `getDefaultDigestTitle`, `uniqueIds`, `normalizeDigest`,
  `readDailyDigestStore`, and `writeDailyDigestStore`. Unlike the
  candidate-workflow extractions, several of these (`getTodayDateString`,
  `uniqueIds`) are small pure helpers used throughout the _rest_ of
  `digest-workflow.ts`'s business logic too, not just inside the store
  functions — they moved along with the store because they have no
  dependencies of their own, and `digest-workflow.ts` now imports them back
  from `digest-store.ts` rather than duplicating them.
- `getTodayDateString` was previously re-exported through `digest-workflow.ts`
  for three external consumers (`src/app/digest/today/page.tsx`,
  `src/app/workspace/digests/page.tsx`,
  `src/app/api/workspace/digests/generate/route.ts`); updated all three to
  import it directly from `digest-store.ts` instead of keeping the re-export.
- Verified with `npm run typecheck`, `npm run test` (19/19 including
  `digest-workflow.test.ts`'s 6 tests), and live reads of `/digest/today`,
  `/workspace/digests`, a digest detail page, and the home page's digest card
  — all rendered correct real data with no console errors.

`digest-workflow.ts` still has real business logic left (digest generation,
readiness evaluation, item-control mutations, publish transitions) — this was
a single clean cut, not a full decomposition of the file.

## How to do it safely

- One cluster per commit; keep extractions as verbatim code-motion (no logic
  changes).
- Push lower-level (store) modules so they do not import `candidate-workflow.ts`;
  pass data in as parameters to avoid circular dependencies.
- Check for other files importing the symbols being moved (e.g.
  `source-workflow.ts` imported two functions from `candidate-workflow.ts` that
  moved in step 3) — update those imports to point at the new module directly
  rather than leaving a re-export hop.
- After each step run BOTH `npm run typecheck` and `npm run test` locally.
  Vitest runs fine in some working environments (verified for steps 1-3: 19/19
  tests green each time) but CLAUDE.md documents a constrained Cowork sandbox
  where `tsx`/`vitest` cannot run — if that's the environment in use, fall back
  to `npm run typecheck` plus a manual smoke test of the affected workspace
  pages (e.g. `/workspace/duplicates`, `/workspace/technologies`,
  `/workspace/candidates` and `/workspace/sources`' "Import enabled sources"
  action for the three clusters done so far) before committing.

## sqlite-store.ts decomposition (done)

`sqlite-store.ts` went from 1308 to 681 lines via one extraction pass covering
all twelve domains at once (unlike the `candidate-workflow.ts` cut, every
domain here follows the exact same shape — a `read<X>Store`/`write<X>Store`
pair keyed by JSON filename in a central dispatch switch — so there was no
per-domain risk analysis needed, just mechanical, verbatim code motion times
twelve):

- `src/lib/repositories/sqlite-primitives.ts` — `SqliteDatabase` type and the
  generic per-table helpers (`selectPayloads`, `clearTables`, `getTableCount`,
  `runSqliteTransaction`, `getTimestamp`, `parsePayload`) every domain file
  depends on.
- Twelve `src/lib/repositories/sqlite-<domain>-store.ts` files — one per
  `readSqliteJsonStore`/`writeSqliteJsonStore` switch case (external source,
  imported candidate, candidate review state, duplicate group, technology
  workspace, daily digest, delivery, scheduled delivery, task runner,
  workflow event, editorial enrichment, prompt version). See
  `docs/database-migration.md`'s Repository Boundary section for the full
  list and import direction (domain files never import each other or
  `sqlite-store.ts` back).
- `sqlite-store.ts` keeps: driver/path resolution, `openSqliteDatabase`,
  `initializeSqliteDatabase`/`resetSqliteDatabase`, `getSqliteSchemaStats`,
  the `initializeSqliteSchema` DDL block (left untouched — it's one atomic
  `exec()` call defining all tables together, not twelve separable pieces),
  `seedStaticContent`, the dispatch table itself, `migrateJsonStoresToSqlite`,
  and the three `readSqlite*` static-content readers.
- Verified with `npm run typecheck`, `npm run test` (31/31), and — since this
  refactor specifically touches the SQLite driver code path that vitest
  doesn't exercise — `npm run validate:database` (the primary correctness
  gate for this change) plus 16 other `npm run validate:*` scripts, all
  passing unchanged. One unrelated pre-existing failure was found during this
  sweep (`npm run validate:delivery`, confirmed broken identically on the
  commit before this refactor via `git stash`) and flagged separately rather
  than fixed inline — not caused by this change.

## Personal radar (done)

P4 v0, owner-authorized and shipped 2026-07-09 (scope choices confirmed with
the owner: tags-only follows, priority-grouped radar). New public `/radar`
page ("我的雷达" in `TopNav`): `src/lib/followed-tags.ts` (localStorage
helpers + change event), `src/components/my-radar-content.tsx` (tag toggle
chips, deterministic Ranking v0 grouping, per-item 命中关注 line, guided
empty states, reusing `TechnologyListCard`), `src/app/radar/page.tsx`, and a
small `my-radar__*` CSS block on existing tokens. No accounts, no server
profile, no AI ranking — see `docs/project-spec.md` → "Personal Radar
(P4 v0)". A content defect was found and fixed during verification: the
three real published signals used freeform tag strings instead of canonical
`TopicTag` ids, so tag matching (and card tag rendering) missed them; a new
canonical `tag-inference` (推理与部署) was added to `src/data/tags.ts` and
the three records were re-tagged. Verified with typecheck, lint,
format:check, vitest 54/54, and a live end-to-end pass (follow toggles →
grouped matches with explanation lines → persistence across reload → mobile
width without overflow → zero console errors).

## Personalized digest view (done)

P4 v0.2, owner-chosen and shipped 2026-07-09 (scope aligned via upfront
questions: highlight + optional filter, light hint for readers with no
follows, hidden sections + total empty state when the filter matches
nothing). `DailyDigestContent` became a `"use client"` component (same
pattern as `technology-detail-content.tsx`) and now renders: a
personalization bar between 今日概览 and the signal sections (已关注 N /
命中 M + 只看我关注的 toggle, or a one-line `/radar` hint when no follows),
per-item 命中关注 lines reusing `my-radar__match-line`, client-side section
filtering with per-section hiding, and a guided zero-match empty state with
a 查看全部内容 reset. Enabler: `rssFeedPath` / `jsonFeedPath` moved to the
new dependency-free `src/lib/feed-paths.ts` (re-exported from
`digest-delivery.ts`) because the client component must not import the
fs-backed digest workflow. New `.daily-digest-personal-bar` CSS block.
Verified with typecheck, lint, format:check, vitest 54/54, and a live pass
on `/digest/today` covering all four states (highlight, filter with all
matched, zero-match empty state + reset, no-follows hint) plus mobile width
and console checks.

## Detail-page follow entry (done)

P4 v0.1, owner-chosen and shipped 2026-07-09 (scope aligned via upfront
questions: followable chips in the body tags section only, all three detail
pages, chip state + radar link feedback, hero tags stay static). New shared
client component `src/components/followable-tag-list.tsx` renders an item's
tags as the same follow/unfollow toggle chips as `/radar` (reusing
`my-radar__tag-toggle` styles and `src/lib/followed-tags.ts`), plus a hint
line ("点击话题，将它加入我的雷达" / "已加入我的雷达 · 查看" linking to
`/radar`). Adopted in the tags section of `technology-detail-content.tsx`,
`src/app/skills/[slug]/page.tsx`, and `src/app/knowledge/[slug]/page.tsx`;
hero and related-card tags stay on the static `TagList`. Small
`.followable-tag-list` CSS block next to the my-radar styles. Verified with
typecheck, lint, format:check, vitest 54/54, and a live pass on all three
detail pages (toggle both directions with localStorage + hint sync, mobile
width without overflow, no new console errors).

## ESLint + Prettier config (done)

Previously the "Add linting/formatting config" item under "Later"; now shipped
(see `CHANGELOG.md` → "Developer tooling" for the full description). In short:
flat-config ESLint 9 (`eslint.config.mjs`, `next/core-web-vitals` +
`next/typescript` + `eslint-config-prettier`), Prettier calibrated to the
existing house style (`trailingComma: "none"`, `endOfLine: "auto"` for the
CRLF working tree), `lint` / `lint:fix` / `format` / `format:check` scripts,
and four dead-code removals surfaced by the first lint pass. `npm run lint`
is clean; verified with `npm run typecheck`, `npm run test` (31/31),
`validate:database`, and `validate:digest`. Note for future sessions:
`registry.npmjs.org` was unreachable from this machine (TLS reset), so the
dev dependencies were installed via `registry.npmmirror.com` with the
owner's approval and `package-lock.json` `resolved` URLs normalized back to
the official registry (integrity hashes are identical between the two).

## SQLite storage-model decision (done)

Previously the last "Later" item ("decide whether the SQLite driver should
move from JSON-blob storage to real relational tables, or be documented
honestly as a document store"). Decided 2026-07-05 with the owner: **the
driver stays a document store, documented honestly.** Analysis confirmed the
driver's reads/writes move whole domain stores (`SELECT payload` /
clear-and-reinsert) exactly matching the JSON-file contract, and no business
code queries the denormalized key columns. A relational move would require
per-record repository semantics across every workflow module — production
database work `AGENTS.md` keeps out of scope — while the default JSON driver
kept the old semantics. Recorded in `docs/decisions.md` → "SQLite Storage
Model", with aligned wording in `docs/database-migration.md` and
`docs/data-model.md`. Revisit only when a production database migration is
explicitly authorized.

## Later (not this task)

- (empty — the tracked code-debt list is clear; new product work waits on
  explicit P3/P4 direction from the owner)
