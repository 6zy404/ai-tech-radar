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
  first: ranking (`src