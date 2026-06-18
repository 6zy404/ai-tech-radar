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

## Response conventions (agreed with the user)
- When the user asks "what's next / 接下来怎么办 / 接下来应该做什么", treat the
  previous stage as already complete. Do NOT re-confirm whether it is done.
- Structure the answer:
  1. First, in plain language: what this next stage is doing, and what effect /
     outcome it achieves once finished.
  2. Then give the concrete task(s) and the steps/instructions to execute.
- In Cowork, Claude executes directly by default (showing the steps it will run).
  Only hand the user a copy-paste instruction to run elsewhere (Codex/terminal)
  if they ask for that.

## Working environment notes (Cowork)
This project is edited in Cowork with the folder mounted. Known quirks and the
workarounds that already proved reliable in this repo:

- Mount staleness: a file written via the editor is sometimes not yet visible to
  the shell/git (git may say "nothing to commit", or a file may look truncated).
  Fix: rewrite that file through the shell (`cat > file <<'EOF' ... EOF`) and
  re-check, or just re-read it.
- Git index corruption on large writes ("fatal: index file corrupt / bad
  signature"). Workaround: commit via a temp index on tmpfs —
  `export GIT_INDEX_FILE=/tmp/idx; rm -f "$GIT_INDEX_FILE"; git read-tree HEAD;
  git add -A; git commit -m "..."`, then rebuild the on-disk index with
  `unset GIT_INDEX_FILE; rm -f .git/index; git reset`.
- The sandbox has no npm registry access and a broken esbuild binary, so
  `vitest` and `tsx` cannot run there. `npm run typecheck` DOES work (tsc is
  installed) and is the in-sandbox safety gate. Run `npm run test`,
  `npm install`, and `npm run ui:check` on the developer machine.
