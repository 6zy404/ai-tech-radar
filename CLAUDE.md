# CLAUDE.md

Project memory for Claude. This file is read automatically at the start of every
session. To avoid duplicating context, it imports the existing repository docs
rather than restating them.

## Primary context (single source of truth)

@AGENTS.md

## Where to start a new session

Read these before doing any work:

- @README.md — project overview (Chinese; English in README.en.md)
- @docs/reference.md — current capabilities, routes, commands
- @docs/project-spec.md
- @docs/architecture.md
- @docs/data-model.md
- @docs/page-structure.md
- @docs/security-boundary.md
- @docs/next-task.md — current status and the open backlog (a status board,
  not a log)

Read on demand, not auto-imported (together they are 800 KB, three quarters
of what every session used to load):

- `CHANGELOG.md` — the feature history, one dated entry per change. Read it
  before claiming something was never done, and add to it per the
  documentation rules in AGENTS.md.
- `docs/history/next-task-log.md` — the 2026-07-10 → 2026-09-24 session log,
  archived verbatim. Grep it when a note refers to a past round's exact wording.

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

## Parallel windows (agreed with the user, 2026-09-28)

The user runs several Claude windows at once. Each window gets its own git
worktree and branch from the desktop app, so code edits cannot overwrite each
other. What the windows **share** is the problem, and these rules cover it:

- **One window owns the live site** (the "主控" window). Only it may run an
  editorial round, `npm run deploy` / `deploy:rollback`, restart anything on
  port 3000, fast-forward `main`, or edit `docs/next-task.md`. If your task is
  not one of those, you are not the owner — say so and hand it back.
- **Only the owner's worktree may point at the live data.** The line
  `LOCAL_DATA_DIR=C:/Users/Administrator/ai-tech-radar/config` belongs in the
  owner's `.env.local` alone. Any other window's dev server reads its own
  worktree's `config/` copy, which is safe to write and throw away.
  `npm run tasks:run-once` from a worktree writes that worktree's copy too;
  its first log line names the directory — read it.
- **Ports**: port 3000 is the live site. Start a dev server with
  `preview_start` (config `dev`, `autoPort`) and use the port it returns.
  Production-build controls (`css:diff`, `next start -p …`) take a port from
  the window's own range: 主控 3100–3199, second window 3200–3299, third
  3300–3399. Check the port is free before starting.
- **Shared docs**: every branch adds its own dated `CHANGELOG.md` entry (on a
  merge conflict keep both entries). Feature windows do **not** edit
  `docs/next-task.md`; they list what should change there in their final
  message, and the owner applies it when merging. Touch `docs/reference.md`
  only when the task changes a capability, route or command.
- **Merging**: one branch at a time, fast-forward into `main` by the owner,
  after typecheck + tests pass on that branch. Every other window then syncs
  with the base branch before continuing.
- **Heavy jobs** (`next build`, `build:public`, `css:diff`, `validate:all`,
  `eval:*`) never run in two windows at once — the live site shares this CPU.
  Keep it to two or three windows.
- **File overlap**: a window's starter prompt names the directories it owns.
  Do not edit outside them without asking; if the task turns out to need
  another window's files, stop and say so.
- `git stash` is shared by every worktree — see the environment note on it;
  prefer a WIP commit.

## Proactive conversation handoff (agreed with the user)

Claude should watch for good moments to start a fresh conversation and flag them
without being asked. A good moment is when ALL of: the current stage is finished,
everything is committed, and `git status` is clean — or when the chat has grown
long enough to feel slow.

When such a moment arrives, proactively tell the user:

1. That now is a good point to open a new conversation (and that the tree is
   clean / everything is committed).
2. A ready-to-paste starter prompt for the new window. The prompt should: point
   the new session at `CLAUDE.md` and `docs/next-task.md`, briefly note what was
   just completed, and state the next step to begin.

Keep it a short suggestion, not a hard stop — the user decides whether to switch.
