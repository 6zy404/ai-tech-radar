# UI Migration Plan

Project Context Recovery v0. This file tracks UI template migration only.

## Workspace Console Template

Rules:

- Internal workspace shell and workspace navigation only.
- Compact page header, not a marketing hero.
- Lightweight internal-risk/info bar.
- Summary metrics near the top.
- Main object list as table-like rows or compact record cards.
- One clear page-level primary action.
- Row-level secondary actions for inspect, edit, import, review, or preview.
- Risky actions such as disable, reject, archive, and exclude stay subdued and
  require confirmation where appropriate.
- Diagnostics, health messages, workflow events, source health, delivery
  details, and task-runner state remain low-priority workspace content.

Migrated:

- `/workspace/sources`
- `/workspace/candidates`
- `/workspace/digests`

Pending:

- `/workspace/technologies`
- `/workspace/duplicates`
- `/workspace/operations`

Uncertain:

- `/workspace`
- `/workspace/sources/new`
- `/workspace/sources/[id]`
- `/workspace/candidates/[id]`
- `/workspace/duplicates/[id]`
- `/workspace/technologies/[id]`
- `/workspace/technologies/[id]/preview`
- `/workspace/digests/[date]`
- `/workspace/digests/[date]/preview`
- `/workspace/delivery`
- `/workspace/delivery/schedules`
- `/workspace/operations/events`

## User-facing Reading Template

Rules:

- User-facing shell and public navigation only.
- Content-first reading rhythm.
- Signal cards focus on title, summary, source, priority, why it matters,
  audience, and a small number of tags.
- Technology details should read like an article: why it matters, technical
  context, audience, learning path, related skills, related knowledge, and
  follow-up questions.
- Hide missing optional explanation fields instead of rendering empty headings.
- Never render workspace navigation, workflow actions, audit records, delivery
  configuration, source health, raw import fields, quality flags, reviewer
  notes, or internal API controls.

Migrated:

- `/technologies`
- `/technologies/[slug]`

Pending:

- `/digest/today`
- `/digest/[date]`

Uncertain:

- `/`

## Learning Support Template

Rules:

- User-facing shell and public navigation only.
- Explain skills and knowledge as learning support for technology signals.
- Group indexes so readers can choose a starting point.
- Detail pages should connect the skill or concept to related published
  technologies.
- Avoid workspace vocabulary and internal workflow state.

Migrated:

- `/skills`
- `/skills/[slug]`
- `/knowledge`
- `/knowledge/[slug]`

Uncertain:

- Approval status after visual review: Unknown / needs verification.

## Notes

- Current code uses `WorkspacePageShell` across workspace pages and
  `UserPageShell` across user-facing pages.
- Current code uses `UserArticleLayout` in technology detail content.
- Playwright visual verification has not been run in this recovery task.
