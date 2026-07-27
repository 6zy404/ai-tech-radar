# Deployment Readiness v0

This project is still a local-first prototype, but it can be run in a controlled server or long-running local environment if the internal surfaces are protected.

## Route Boundary

Public user-facing routes:

- `/`
- `/technologies` (also hosts the news/timeline/radar views via `?view=`)
- `/technologies/[slug]`
- `/digest/today`
- `/digest/[date]`
- `/feed.xml`
- `/feed.json`

Internal workspace routes:

- `/workspace`
- `/workspace/sources`
- `/workspace/candidates`
- `/workspace/duplicates`
- `/workspace/technologies`
- `/workspace/digests`
- `/workspace/delivery`
- `/workspace/delivery/schedules`

Internal mutation/API routes:

- `/api/workspace/*`
- `/api/candidates/*`
- legacy internal redirects under `/candidates/*`
- legacy draft redirects under `/technologies/drafts/*`

## Minimal Workspace Protection

This prototype does not implement login, accounts, or RBAC. Instead, controlled deployments can enable a single shared token.

Environment:

```bash
WORKSPACE_ACCESS_ENABLED=true
WORKSPACE_ACCESS_TOKEN=replace-with-a-strong-secret
```

Accepted request forms:

- `Authorization: Bearer <token>`
- `Authorization: Basic <base64 workspace:token>`
- `x-workspace-access-token: <token>`

If `WORKSPACE_ACCESS_ENABLED=true` but `WORKSPACE_ACCESS_TOKEN` is empty, protected routes return `503` instead of silently exposing the workspace.

This is a deployment guardrail, not a production permission system.

## Environment Variables

- `NEXT_PUBLIC_SITE_URL`: public base URL used for digest links and feeds.
- `WORKSPACE_ACCESS_ENABLED`: enables minimal workspace/API token protection.
- `WORKSPACE_ACCESS_TOKEN`: shared token for protected internal routes.
- `LOCAL_DATA_DIR`: local JSON workflow directory; defaults to `./config`.
- `PERSISTENCE_DRIVER`: `json` by default; set to `sqlite` after running database initialization and migration.
- `SQLITE_DATABASE_PATH`: optional SQLite database path; defaults to `./config/ai-tech-radar.sqlite`.
- `TASK_RUNNER_INTERVAL_SECONDS`: watch-loop interval for `npm run tasks:watch`.
- `DELIVERY_WEBHOOK_ENDPOINT`: optional operator reference for generic webhook setup.
- `FEISHU_WEBHOOK_ENDPOINT`: optional operator reference for Feishu webhook setup.
- `LLM_PROVIDER`: optional workspace editorial enrichment provider, `mock` or `openai_compatible`.
- `LLM_API_KEY`: optional API key for the OpenAI-compatible enrichment provider.
- `LLM_BASE_URL`: optional OpenAI-compatible base URL.
- `LLM_MODEL`: optional model name.
- `LLM_TIMEOUT_MS`: optional provider request timeout.

Do not commit real webhook tokens or LLM API keys. Neither local JSON nor the local SQLite file should be treated as a production secret store.

## Task Runner

Windows local run:

```powershell
npm run tasks:run-once
npm run tasks:watch
```

Linux server run-once example:

```bash
cd /srv/ai-tech-radar
npm run tasks:run-once
```

System cron can call `npm run tasks:run-once` on a fixed cadence. PM2 or a platform process manager can run `npm run tasks:watch` if a long-running local loop is preferred.

Avoid running multiple task runners against the same `LOCAL_DATA_DIR`. The local JSON store is not a distributed lock or multi-writer database.

### Scheduled source import (v0)

Each task-runner pass also checks `config/scheduled-import.json` and, when the
configured daily time has passed, runs one batch import for all enabled
sources (`runBatchImportForEnabledSources`, without fallback placeholder
candidates). This keeps the public `/news` fast lane fresh without manual
imports. The config is editable from `/workspace/delivery/schedules`
(enable/disable + daily time, default `08:00` Asia/Shanghai); after each run
`nextRunAt` moves to the next scheduled time, which also prevents same-day
duplicate imports.

### Scheduled digest draft (v0)

The same pass then checks `config/scheduled-digest.json` and, when due,
generates today's digest **draft** (`generateDailyDigest`) — skipping when
the day already has a digest, and never publishing. Editable from the same
schedules page (default `08:00` Asia/Shanghai — keep it no later than the
daily task trigger time, since a later value would only be reached on the
following day's pass; ordering inside a pass is import first, digest
second by code, not by clock).

### Windows Task Scheduler (unattended daily runs)

Register a daily task that calls the runner once (adjust the schedule time and
project path; run from an elevated or the owning user's PowerShell):

```powershell
schtasks /Create /TN "ai-tech-radar-tasks" /SC DAILY /ST 08:05 `
  /TR "cmd /c cd /d C:\Users\Administrator\ai-tech-radar && npm run tasks:run-once >> config\task-runner-cron.log 2>&1"
```

`schtasks /Create` leaves three defaults that make the task skip a day
**silently**, with nothing recorded anywhere — the task simply never fires, so
`config/task-runner.json` shows a gap and the task's own `Last Result` still
reads `0` from whenever it last succeeded. This was measured on the owner's
machine on 2026-07-28: only 6 of the previous 15 days had a runner pass
(2026-07-15…07-19, 07-21, and 07-24…07-26 were all missed). Fix the defaults
right after creating the task:

```powershell
$s = New-ScheduledTaskSettingsSet -StartWhenAvailable `
       -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries `
       -ExecutionTimeLimit (New-TimeSpan -Hours 72) `
       -MultipleInstances IgnoreNew
Set-ScheduledTask -TaskName "ai-tech-radar-tasks" -Settings $s
```

- `StartWhenAvailable` — without it, a start missed because the machine was
  off, asleep, or busy is **never made up**. This is the single most important
  one.
- `AllowStartIfOnBatteries` / `DontStopIfGoingOnBatteries` — the defaults
  refuse to start (and kill a running task) on battery power.
- `ExecutionTimeLimit` and `MultipleInstances` are only repeated because
  `New-ScheduledTaskSettingsSet` builds a **complete** settings object: any
  value left out is reset to its default, not preserved.
- Deliberately **not** enabled: `WakeToRun`. It would wake a sleeping machine
  at the trigger time — a machine-behavior decision for the operator, not a
  project default.

Verify with
`(Get-ScheduledTask -TaskName "ai-tech-radar-tasks").Settings | Select-Object StartWhenAvailable, DisallowStartIfOnBatteries, StopIfGoingOnBatteries`
(expect `True / False / False`). To roll back, run the same command with
`-DisallowStartIfOnBatteries -StopIfGoingOnBatteries` and without
`-StartWhenAvailable`.

What this does **not** do: catch-up runs fire **once**, not once per missed
day, and a missed day's digest draft is never backfilled — the scheduled
digest always generates _today's_ draft.

Other notes:

- Schedule the Windows task a few minutes **after** the configured import time
  so the run is already due when the runner starts.
- `schtasks /Run /TN "ai-tech-radar-tasks"` triggers a manual test run;
  `schtasks /Delete /TN "ai-tech-radar-tasks"` removes it.
- The same duplicate protections apply: an extra run on the same day skips the
  already-run import and already-sent deliveries.

## Local JSON Limits

Local JSON is acceptable for:

- local development
- demos
- single-operator controlled environments
- validating the source -> candidate -> draft -> digest -> delivery workflow

Local JSON is not appropriate for:

- public multi-user production
- concurrent editors
- high-frequency imports
- high-value production secrets
- strict audit/compliance requirements

Future production work should move workflow state into a database and move webhook tokens into a secret store.

## Persistence Boundary

The current persistence workflow is intentionally kept behind a small repository boundary:

- `src/lib/repositories/local-json-store.ts` resolves `LOCAL_DATA_DIR` store files and performs JSON reads/writes.
- `src/lib/repositories/sqlite-store.ts` creates SQLite schema v0 and maps the same workflow stores to SQLite tables when `PERSISTENCE_DRIVER=sqlite`.
- Workflow modules own business transitions and validation.
- Pages and API routes call workflow modules instead of handling JSON files directly.

This keeps deployment behavior stable today and reduces future database migration cost. The database migration route, recommended tables, indexes, and transaction-sensitive workflows are documented in `docs/persistence-plan.md` and `docs/database-migration.md`.

SQLite local setup:

```bash
npm run db:init
npm run db:migrate-json
PERSISTENCE_DRIVER=sqlite npm run dev
```

`db:reset` is local-only and refuses to run unless `ALLOW_DB_RESET=true` is set.

## Readiness Check

Run:

```bash
npm run validate:deployment
```

The check verifies workspace protection helpers, protected/public route classification, task-runner scripts, local JSON write access, endpoint masking, public feed isolation, and client-build secret isolation.

Run `npm run validate:persistence` when changing workflow data shapes. It checks local JSON cross-references and confirms public technology/feed data does not contain internal-only fields.

Run `npm run validate:database` when changing the persistence driver, SQLite schema, migration script, or repository boundary.

Run `npm run validate:workflow-hardening` when changing candidate conversion, draft publishing, digest publishing, delivery, scheduled delivery, task runner, or workflow event logic.

Run `npm run validate:llm-enrichment` when changing the LLM provider boundary, editorial enrichment prompt, output validation, suggestion metadata, or workspace enrichment generation UI.

## Manual Playwright UI Check

Run the UI check from a normal local terminal:

```powershell
node .\scripts\playwright-ui-check.mjs
```

The script writes screenshots and `visual-qa-screenshots/ui-check-results.json`. The JSON result records:

- route URL and HTTP status
- stylesheet responses and `hasFailedStylesheet`
- horizontal overflow and overflowing elements
- workspace/user shell detection
- internal-only term hits on user-facing pages
- key button labels and layout metrics

In Codex sandbox, Chromium launch can fail with `spawn EPERM`. Treat that as a sandbox permission limitation. The correct validation status is `manual validation required` or `manual validation pending` until the command is run in the local PowerShell terminal. Do not mark the Playwright UI check as passed unless the local command completes successfully.
