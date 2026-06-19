# Next Task

> Done since last update: vitest test setup + unit tests (ranking, publish
> readiness, dedup, digest), CI workflow (`.github/workflows/ci.yml` running
> typecheck + test), and the first refactor passes on `candidate-workflow.ts`.

Recommended next task:

Continue decomposing `candidate-workflow.ts` by extracting its remaining
stateful "store" clusters into focused modules.

## Progress so far

`candidate-workflow.ts` has gone from 1763 to ~1264 lines via three pure,
behavior-preserving extractions (each verified with `npm run typecheck`):

- `src/lib/candidate-duplicate-rules.ts` — pure duplicate-detection rules and
  identity helpers (URL/title normalization, token similarity, reason rules,
  stable group id, primary-candidate selection).
- `src/lib/workspace-record-normalizers.ts` — text/field/localized-text
  normalization.
- `src/lib/candidate-conversion-mapping.ts` — candidate → draft field mapping
  (type, publisher, tags, draft text, source reference).

## Remaining clusters to extract (stateful — do one per step)

1. Duplicate-group store: `readDuplicateGroupStore`, `writeDuplicateGroupStore`,
   `analyzeDuplicates` (already dependency-free; takes candidates as a param).
   The higher-level getters (`getDuplicateGroupCandidates`,
   `getDuplicateComparisonsForCandidate`) call back into candidate getters, so
   they must stay in `candidate-workflow.ts` to avoid a circular import.
2. Technology-workspace store: `normalizeTechnologyWorkspaceRecord`,
   `read/writeTechnologyWorkspaceStore`, and the record getters/updaters.
3. Imported-candidate snapshot store: `sanitizeImportedCandidate`,
   snapshot read/write, `mergeImportedCandidatesForSource`.

## How to do it safely

- One cluster per commit; keep extractions as verbatim code-motion (no logic
  changes).
- Push lower-level (store) modules so they do not import `candidate-workflow.ts`;
  pass data in as parameters to avoid circular dependencies.
- After each step run BOTH `npm run typecheck` and `npm run test` locally — the
  sandbox cannot install/run vitest, so behavior verification must happen on the
  developer machine between steps.

## Later (not this task)

- Apply the same decomposition to `sqlite-store.ts` and `digest-workflow.ts`.
- Decide whether the SQLite driver should move from JSON-blob storage to real
  relational tables, or be documented honestly as a document store.
- Add linting/formatting config (ESLint + Prettier).
