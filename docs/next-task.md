# Next Task

> See `docs/roadmap.md` for the high-level plan. The current active direction is
> the P2 knowledge relationship network (technology↔technology relations are
> shipped and semantically labelled). The `candidate-workflow.ts` decomposition
> below remains valid as interleaved cleanup, not a blocking phase.

> Done since last update: vitest test setup + unit tests (ranking, publish
> readiness, dedup, digest), CI workflow (`.github/workflows/ci.yml` running
> typecheck + test), the first three refactor passes on `candidate-workflow.ts`,
> and the duplicate-group store extraction (step 1 below).

Recommended next task:

Continue decomposing `candidate-workflow.ts` by extracting its remaining
stateful "store" clusters into focused modules.

## Progress so far

`candidate-workflow.ts` has gone from 1763 to 997 lines via four pure,
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

## Remaining clusters to extract (stateful — do one per step)

1. ~~Duplicate-group store.~~ Done — see above.
2. Technology-workspace store: `normalizeTechnologyWorkspaceRecord`,
   `read/writeTechnologyWorkspaceStore`, and the record getters/updaters.
3. Imported-candidate snapshot store: `sanitizeImportedCandidate`,
   snapshot read/write, `mergeImportedCandidatesForSource`.

## How to do it safely

- One cluster per commit; keep extractions as verbatim code-motion (no logic
  changes).
- Push lower-level (store) modules so they do not import `candidate-workflow.ts`;
  pass data in as parameters to avoid circular dependencies.
- After each step run BOTH `npm run typecheck` and `npm run test` locally.
  Vitest runs fine in some working environments (verified for step 1: 19/19
  tests green) but CLAUDE.md documents a constrained Cowork sandbox where
  `tsx`/`vitest` cannot run — if that's the environment in use, fall back to
  `npm run typecheck` plus a manual smoke test of the affected workspace pages
  (e.g. `/workspace/duplicates` and a group detail page for the duplicate-group
  cluster) before committing.

## Later (not this task)

- Apply the same decomposition to `sqlite-store.ts` and `digest-workflow.ts`.
- Decide whether the SQLite driver should move from JSON-blob storage to real
  relational tables, or be documented honestly as a document store.
- Add linting/formatting config (ESLint + Prettier).
