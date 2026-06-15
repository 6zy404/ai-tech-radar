# Next Task

Recommended next task:

Refine `/workspace/technologies` as an internal Draft / Published technology
management console.

## Scope

- Only modify `/workspace/technologies`.
- Do not modify user-facing `/technologies`.
- Do not modify API.
- Do not modify data model.
- Do not modify workflow.
- Only run `npm run typecheck`.

## Intent

Make `/workspace/technologies` follow the Workspace Console Template:

- compact internal page structure
- draft / published / archived summary
- clear separation between draft management and published records
- internal-only action language
- no public reading-page visual treatment

## Starting Files

- `src/app/workspace/technologies/page.tsx`
- `src/components/technology-draft-card.tsx`
- `src/components/workspace-page-shell.tsx`
- `src/components/workspace-list-toolbar.tsx`
- `src/app/globals.css`

## Verification

- Run only `npm run typecheck`.
- Playwright visual validation is manual and should be run by the user outside
  Codex if needed.
