# Next Task

> See `docs/roadmap.md` for the high-level plan. P1 (visual pass) and P2
> (knowledge relationship network) are both done. P3 (AI-assisted
> understanding) has been explicitly authorized and its first capability,
> Compare two technologies, has shipped as v0. Explain and learning-path
> generation remain unauthorized and should not be started without a fresh
> explicit request from the owner; P4 (personalization) is untouched and
> still requires explicit authorization. Until further P3/P4 direction is
> given, the main remaining interleaved work is the SQLite storage-model
> decision (see "Later" below) — the store-decomposition pattern has been
> applied to every file it was planned for, and the ESLint/Prettier config
> has now shipped too (see "ESLint + Prettier config (done)" below).

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
Prettier config (done)" below. The remaining tracked code debt is the SQLite
storage-model decision under "Later"; beyond that, new product work waits on
explicit P3/P4 direction from the owner.

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

## Later (not this task)

- Decide whether the SQLite driver should move from JSON-blob storage to real
  relational tables, or be documented honestly as a document store.
