# Next Task

> The previous next task — refining `/workspace/technologies` into an internal
> Draft / Published console — is **done**. That page now uses the Workspace
> Console Template (status overview cards, separated draft vs published/archived
> sections, internal-only action language). See `docs/progress.md`.

Recommended next task:

Introduce a real automated test setup and migrate the core `validate:*` script
assertions into it.

## Why

This is currently the largest engineering gap: there are ~25 `validate:*`
scripts run through a custom `run-ts-validation.cjs` runner, but no standard test
framework, so assertions are coarse and hard to run in CI. A real test harness
makes every later change (refactors, persistence work) safer.

## Scope

- Add `vitest` (and `@vitest/coverage-v8` if useful) as dev dependencies.
- Add a `test` script (and optionally `test:watch`) to `package.json`.
- Create an initial `*.test.ts` suite covering the highest-value pure logic
  first: ranking (`src/lib/ranking.ts`), duplicate detection
  (`src/lib/candidate-workflow.ts` detection helpers), and digest publish
  readiness (`src/lib/publish-readiness.ts` / digest workflow guards).
- Keep the existing `validate:*` scripts working; migrate assertions
  incrementally rather than deleting the scripts in one step.
- Do not change the data model, workflow behavior, or any user-facing page.

## Starting Files

- `package.json`
- `src/lib/ranking.ts`
- `src/lib/publish-readiness.ts`
- `src/lib/candidate-workflow.ts`
- existing references: `scripts/validate-ranking-workflow.ts`,
  `scripts/validate-publishing*` / `scripts/validate-candidate-workflow.ts`,
  `scripts/validate-digest-workflow.ts`

## Verification

- `npm run typecheck`
- `npm run test`
- Existing `validate:*` scripts should still pass.
- Playwright visual validation remains a manual local step (`npm run ui:check`),
  run by the user.

## Later (not this task)

- Split oversized modules (e.g. `candidate-workflow.ts`, `sqlite-store.ts`,
  `digest-workflow.ts`) once tests provide a safety net.
- Decide whether the SQLite driver should move from JSON-blob storage to real
  relational tables, or be documented honestly as a document store.
- Add CI (typecheck + test) and linting/formatting config.
