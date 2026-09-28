# Observability & Admin Operations v0

Operations v0 is an Internal Workspace observability layer. It helps maintainers see whether the local workflow is healthy, which failures need attention, and what changed recently.

It is not a production monitoring stack, alerting system, Prometheus/Grafana integration, user system, or external incident platform.

## Routes

- `/workspace/operations`: operations dashboard
- `/workspace/operations/events`: WorkflowEvent browser

These routes are workspace-only. They must not appear in user-facing navigation.

## Operations dashboard

`/workspace/operations` shows:

- system health summary
- attention-required items
- failed source imports
- failed deliveries
- failed scheduled runs
- recent WorkflowEvent activity
- quick links to related workspace modules

The dashboard reads existing local state:

- source health and import runs
- delivery runs
- scheduled-delivery runs
- task-runner runs
- digest status
- duplicate groups
- candidate quality flags
- WorkflowEvent records

It does not mutate workflow data.

## Health status

Health status is deterministic:

- `healthy`: no current failed import, failed delivery, failed schedule, failed task runner, open duplicate, or candidate quality blocker
- `warning`: limited failures or review work exists, such as failed delivery, partial import, open duplicate group, or candidate quality issue
- `critical`: task runner failure, scheduled run failure, source import failure, consecutive source failures, or publish-failure workflow events exist
- `unknown`: there is not enough operational history to judge

The status is a maintenance signal only. It is not ranking, recommendation, or impact scoring.

## Attention required

Attention items are generated from concrete local records:

- failed source import
- consecutive source failure
- failed delivery
- failed scheduled run
- open duplicate group
- candidate quality blocking issue
- failed WorkflowEvent
- latest failed or partial task-runner run

Each item links back to the most relevant workspace page when available.

### Pipeline alerts (2026-09-29)

- 定时导入已停摆 (critical): the scheduled import is enabled and the newest
  `ImportRun` with `successfulSources > 0` finished more than
  `IMPORT_STALL_THRESHOLD_HOURS` (36) ago. That run record lives in the same
  data directory as the candidates it merged, so a task runner writing to
  another directory (the 2026-09-25..27 failure) leaves it behind.
- 定时导入逾期未运行 (critical): `scheduled-import.json`'s `nextRunAt` is more
  than `SCHEDULED_IMPORT_OVERDUE_HOURS` (6) in the past.
- 该跑一轮编辑轮了 (warning): more than `CANDIDATE_BACKLOG_MAX_COUNT` (20)
  undecided candidates, or the oldest imported more than
  `CANDIDATE_BACKLOG_MAX_AGE_DAYS` (7) days ago.

All three are pinned at the top of 需要关注 and appear in the health reasons.
Workspace only — never on public pages, feeds or `/api/health`. First check
when one fires: the first line of the task runner log names the data
directory it wrote to.

## WorkflowEvent browser

`/workspace/operations/events` supports filtering by:

- `entityType`
- `action`
- `actorType`

Each event row shows:

- action
- entity type and ID
- actor type
- creation time
- metadata
- before/after snapshot preview

Snapshots are truncated and shown in low-weight panels. Endpoint-like and token-like values are sanitized before display.

## Failure investigation

Use the operations dashboard for the first triage pass:

- Failed imports: open the linked source detail, review `lastImportMessage`, `lastErrorMessage`, and consecutive failures.
- Failed deliveries: open delivery logs, inspect channel type, digest date, response status, and sanitized error message.
- Failed scheduled runs: open the schedule page, inspect skipped/failed channel counts and linked delivery logs.
- Failed workflow events: open the event browser, filter by failed action, and compare metadata and snapshots.
- Task runner failures: open the delivery schedules page and inspect the latest `TaskRunnerRun` summary.

## Manual UI check status

The Playwright UI check is run manually from the local terminal:

```powershell
node .\scripts\playwright-ui-check.mjs
```

It writes `visual-qa-screenshots/ui-check-results.json` with route status, CSS loading status, horizontal overflow metrics, workspace/user shell detection, and internal-field leak checks. If Codex sandbox reports Chromium `spawn EPERM`, leave Playwright as `manual validation pending` and use the local PowerShell result as the source of truth.

## User-facing isolation

User-facing pages and feeds must not render:

- operations summaries
- WorkflowEvent or AuditLog records
- delivery logs
- scheduled run logs
- task-runner records
- endpoint URLs
- workspace access tokens
- internal error details

Operations data is for maintainers only.

## Why no external monitoring yet

This prototype still runs on local JSON or optional SQLite in a controlled environment. External monitoring and alert routing would add operational complexity before the workflow has production infrastructure.

Prometheus, Grafana, hosted alerting, log shipping, incident routing, and retention policy are intentionally deferred.

## Later work

- alert routing for critical operations states
- event retention and archive policy
- structured error taxonomy
- recovery tools for replaying failed workflows
- task-runner lock visibility
- production log shipping
- Prometheus/Grafana or hosted observability integration
- authenticated operator identity in WorkflowEvent records
