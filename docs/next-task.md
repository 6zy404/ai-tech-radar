# Next Task

> See `docs/roadmap.md` for the high-level plan. P1 (visual pass) and P2
> (knowledge relationship network) are both done. The project is at the P3
> decision point: do not start P3 (AI-assisted understanding) or P4
> (personalization) without an explicit request from the owner. Until then,
> the `candidate-workflow.ts` decomposition below is suitable interleaved work.

> Done since last update: vitest test setup + unit tests (ranking, publish
> readiness, dedup, digest), CI workflow (`.github/workflows/ci.yml` running
> typecheck + test), the first three refactor passes on `candidate-workflow.ts`,
> and all three originally-planned store extractions (duplicate-group,
> technology-workspace, imported-candidate snapshot).

Recommended next task:

The three stateful "store" clusters originally planned for
`candidate-workflow.ts` are now all extracted (see Progress below). The file
is down to 744 lines, all of it either genuine cross-cutting business logic
(candidate review, conversion, publish transitions, workflow events) or
exported getters/updaters that read/write those stores. There is no more
"free" store extraction left — the next decomposition step needs fresh
analysis of `candidate-workflow.ts` rather than following this pre-written
list, e.g. deciding whether "candidate → draft conversion" and "draft
publish/archive transitions" can be split into two separate modules without
creating a circular import (both currently call back into candidate getters
and workflow-event helpers, so this is a harder cut than the three that are
done).

If no one has picked up that analysis yet, equally suitable next steps: apply
the same decomposition pattern to `sqlite-store.ts` or `digest-workflow.ts`
(see "Later" below), or work through the Workspace-side visual confirmation
item from `docs/roadmap.md`'s completion estimate.

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
   above. The record getters/updaters and candidate→draft conversion logic
   remain in `candidate-workflow.ts` (see "Recommended next task" above for
   why, and for the harder follow-up cut this leaves open).
3. ~~Imported-candidate snapshot store.~~ Done — see above.

All three originally-planned stateful clusters are extracted. Further
decomposition of `candidate-workflow.ts` (the conversion/publish logic left
behind by step 2) needs fresh dependency analysis, not a checklist item — see
"Recommended next task" above.

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

## Later (not this task)

- Apply the same decomposition to `sqlite-store.ts` and `digest-workflow.ts`.
- Decide whether the SQLite driver should move from JSON-blob storage to real
  relational tables, or be documented honestly as a document store.
- Add linting/formatting config (ESLint + Prettier).
