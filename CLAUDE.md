# CLAUDE.md

Project memory for Claude. This file is read automatically at the start of every
session. To avoid duplicating context, it imports the existing repository docs
rather than restating them.

## Primary context (single source of truth)
@AGENTS.md

## Where to start a new session
Read these before doing any work:

- @README.md — current capabilities, routes, commands
- @CHANGELOG.md — version-by-version feature history
- @docs/project-spec.md
- @docs/architecture.md
- @docs/data-model.md
- @docs/page-structure.md
- @docs/security-boundary.md
- @docs/next-task.md

If a detail is not supported by current repository files, mark it as
`Unknown / needs verification` instead of guessing.

## Quick facts
- Stack: Next.js (App Router) + React 19 + TypeScript, local-first prototype.
- Two subsystems: Internal Workspace (editorial/operations) and the public
  User-facing Product. Keep them separate; never leak internal-only fields onto
  public pages or feeds.
- Persistence: local JSON by default; optional local SQLite driver.
- Default verification: `npm run typecheck`.
- Do not run Playwright automatically; UI checks (`npm run ui:check`) are run
  locally by the user.

## House rules
- Keep scope tight; do not expand a task beyond what was asked.
- Prefer reusable components over repeated page code.
- Document structural changes: update README/CHANGELOG and the relevant docs/ file.
