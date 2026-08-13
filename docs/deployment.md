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

### The middleware must live at `src/middleware.ts`

The guard is implemented in `src/middleware.ts`. **The location is
load-bearing**: this project keeps its App Router under `src/`, and Next only
looks for middleware at `src/middleware.ts` in that layout. A copy at the
repository root is ignored **silently** — the build prints no error, no
warning, and `.next/server/middleware-manifest.json` simply comes out with an
empty `"middleware": {}`.

That is exactly how this shipped: the file sat at the repository root from the
start, so the workspace guard never ran in any mode until the 2026-07-27
go-live drill requested `/workspace` with protection enabled and got `200`.
Reading the middleware source proves nothing — it was correct the whole time.
`npm run validate:deployment` now asserts the file's location, and the fastest
manual check is:

```bash
npm run build
# expect a "ƒ Middleware" line in the route table, and a non-empty
# "middleware" object in .next/server/middleware-manifest.json
```

Never verify workspace protection by reading code alone. Request a protected
route without a token against a real `next start` and confirm the `401`.

## Deployment decisions (owner, 2026-08-13)

The runbook below was written for a Linux server. The owner has since chosen a
different target, so read the runbook for its reasoning and use these decisions
for the specifics.

| Question           | Decision                            | What follows                                                                               |
| ------------------ | ----------------------------------- | ------------------------------------------------------------------------------------------ |
| Where              | **this Windows machine**            | Task Scheduler stays; the systemd + cron sections below do not apply                       |
| Domain             | **none yet, will buy one**          | `NEXT_PUBLIC_SITE_URL` and HTTPS both wait — it is inlined at **build** time               |
| Workspace exposure | **not public at all**               | with a tunnel this is **not** free — it needs an edge deny list _and_ the token; see below |
| Backups            | **same machine, another directory** | `npm run backup:data` as-is; the same-disk risk is accepted, see below                     |

### Exposure: outbound tunnel (chosen 2026-08-13)

The machine sits behind a residential-style connection, so the three things
that would otherwise sink a domain purchase are: ICP filing for anything
resolving to a mainland-hosted service, inbound 80/443 commonly blocked, and a
dynamic IP. An outbound tunnel (Cloudflare Tunnel, frp, …) sidesteps all three
— the machine dials out, nothing listens inbound, and the address does not
have to be stable. Buy the domain at a registrar that suits the tunnel provider;
`.dev` and `.app` are worth considering because browsers force HTTPS on them.

**Honest caveat:** tunnel edges vary in how well they serve mainland visitors.
Measure it before assuming it is fine.

#### A tunnel does NOT keep the workspace private by itself

This is the correction that matters, and it inverts the note this file carried
before the tunnel was chosen. A reverse proxy can route by path, so "just don't
route the workspace outward" is a real option there. **A tunnel maps a hostname
to one local port**, so the moment the domain resolves,
`https://<domain>/workspace` is reachable. Privacy of the workspace stops being
a consequence of topology and becomes something you have to configure.

And it collides with the token advice: the middleware does not distinguish
request origin, so turning the token on also blocks the editorial rounds, which
drive `/api/workspace/*` and `/api/candidates/*` over `localhost`.

Three layers, and the third is new work that makes the first two compatible:

| Layer          | What it does                                                | Lives in                      |
| -------------- | ----------------------------------------------------------- | ----------------------------- |
| Tunnel edge    | deny the same 5 prefixes `src/middleware.ts` matches        | tunnel/CDN config             |
| App middleware | `WORKSPACE_ACCESS_ENABLED=true` + token, as the second lock | `.env.local`                  |
| Round tooling  | send the token header on every workspace API call           | `scripts/workspace-fetch.mjs` |

The deny list must stay identical to `config.matcher` in `src/middleware.ts`:

```
/workspace/*   /api/workspace/*   /api/candidates/*   /candidates/*   /technologies/drafts/*
```

Both lists are five entries precisely so they can be compared by eye. If a new
internal prefix is ever added, it has to be added in both places — the app one
fails closed, the edge one does not.

#### Keeping the site running

The tunnel points at a local port, so something has to be listening on it
across reboots. `npm run start` (not `dev` — that is the HMR server and shares
`.next` with builds) via the same Task Scheduler pattern the import job uses,
triggered at startup instead of daily:

```powershell
$action  = New-ScheduledTaskAction -Execute "cmd" -Argument '/c cd /d C:\Users\Administrator\ai-tech-radar && npm run start >> config\server.log 2>&1'
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType S4U -RunLevel Limited
$settings  = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)
Register-ScheduledTask -TaskName "ai-tech-radar-server" -Action $action -Trigger $trigger -Principal $principal -Settings $settings
```

Four settings are doing real work here:

- **`S4U`** — a background session with no console, so the server cannot be
  killed by a stray `Ctrl+C` or a closing window. That is not hypothetical:
  17% of the import task's runs died that way before it was changed.
- **`-ExecutionTimeLimit ([TimeSpan]::Zero)`** — no time limit. The default
  would stop a long-running server after three days.
- **`-RestartCount 3`** — bring it back if the process dies.
- **`-StartWhenAvailable`** — start it after a missed trigger rather than
  waiting for the next boot.

**Rebuild before it matters.** `npm run start` serves whatever `.next` holds,
so it must be rebuilt after `NEXT_PUBLIC_SITE_URL` changes — and **never
rebuild while this task is running**, since dev/build/start all share `.next`.
Stop the task, build, start it again.

`scripts/workspace-fetch.mjs` is that third layer. It adds the token header
when one is configured and behaves exactly like `fetch` when none is, so
nothing changes until the token is switched on. It doubles as a self-check:

```bash
node scripts/workspace-fetch.mjs http://localhost:3000/workspace
```

**Verify by requesting, never by reading.** Re-verified against a real
`next start` on 2026-08-13, with the guard temporarily enabled and a disposable
token (removed afterwards, `.env.local` confirmed back to an empty value):

| Check                              | Result                          |
| ---------------------------------- | ------------------------------- |
| all 5 protected prefixes, no token | **401**                         |
| same 5 through `workspaceFetch`    | reached the route (200/405/307) |
| a **wrong** token                  | **401** — it compares the value |
| Bearer and Basic forms             | 200                             |
| 5 public routes                    | 200, unaffected                 |

Repeat this against the real domain once the tunnel is up, and separately
confirm the edge denies `/workspace` **without the request reaching the app at
all** — otherwise the app-level 401 is hiding the fact that the edge rule is
missing.

**On `config/` staying in git (checklist B2).** The runtime and secret stores
(`delivery.json`, `workflow-events.json`, `task-runner.json`, the three LLM
caches) are already untracked, so a real webhook token cannot be committed.
The 14 that remain tracked are **content and editorial state** — signals,
digests, relations, review decisions — and on a single-machine deployment the
repository _is_ the deployment, so keeping them tracked is what gives the
content a history and a way back. Moving them to a `LOCAL_DATA_DIR` outside the
tree would end that, and every editorial round would stop being a commit.
**Decision: they stay tracked.** Revisit only if the deployment ever stops
being the same checkout the editing happens in.

**On the same-disk backup.** `npm run backup:data` verifies every copied file
by SHA-256 and keeps a manifest, so it protects against the failure this
project actually hits — a store written wrong, truncated, or deleted. It does
**not** protect against losing the disk. Accepted knowingly; revisit when the
content is worth more than the machine.

**Still to do, in order.** Owner steps are marked; the rest is repo work.

1. **(owner)** register the backup task — command in "Daily backup (Windows)"
   below; it is a system change
2. **(repo)** teach the editorial-round tooling to send the workspace token, so
   turning the token on does not block editing
3. **(repo)** a production run setup: `npm run start` kept alive across reboots
4. **(owner)** buy the domain
5. **(repo)** set `NEXT_PUBLIC_SITE_URL` to it and **rebuild** — it is inlined
   at build time, so a runtime-only value leaves `localhost` in every feed link
6. **(owner)** stand up the tunnel, and deny the five internal prefixes at its
   edge
7. **(both)** flip the workspace token, then verify by request: public routes
   200, `/workspace` denied at the edge, and 401 from the app without a token

Steps 2 and 3 do not need the domain and can be done now. `npm run build` was
re-verified on 2026-08-13 and passes with `ƒ Middleware` present in the route
table.

## Go-live runbook (single operator, one server)

The target this runbook assumes: one always-on Linux server, one Node process,
public pages open to everyone, workspace locked behind the shared token.
**See "Deployment decisions" above for where this project actually landed** —
the shape reasoning still applies, the Linux specifics do not.

**Why this shape.** The app writes its runtime state to `config/*.json`
(candidates, drafts, digests, relation overrides, schedule state), so it needs
a persistent disk and exactly one writer. That rules out serverless platforms,
where the filesystem is read-only and non-persistent — edits would report
success and vanish. It also runs daily scheduled work, so the machine has to
stay up. Three constraints follow from the code and are not negotiable at this
stage:

- **Single instance only.** The JSON store has no multi-writer locking, so a
  second process (or a second replica) will clobber the first.
- **The rate limiter is in-process memory.** With one instance the configured
  budget is the real budget; with several, each keeps its own counters.
- **The task runner writes the same files you edit by hand.** Avoid editing in
  the workspace during the minute the daily job fires.

### 1. Prerequisites

- A server with Node ≥ 22.5 (`package.json` pins this; `node:sqlite` needs it)
- A domain with DNS pointing at the server
- A reverse proxy that terminates TLS (Caddy issues and renews certificates
  with no extra configuration)
- A strong random token, generated and stored by the operator:
  `openssl rand -base64 32`

### 2. Build with the real site URL

`NEXT_PUBLIC_SITE_URL` carries the `NEXT_PUBLIC_` prefix, so Next **inlines it
at build time**. Setting it only at runtime leaves `localhost:3000` baked into
every feed item and digest share link:

```bash
export NEXT_PUBLIC_SITE_URL=https://radar.example.com
npm ci
npm run build
```

The build needs no network access to any font or asset CDN — the Google Fonts
dependency was removed on 2026-07-27 precisely so the build cannot fail on a
restricted network.

### 3. Run it under systemd

```ini
# /etc/systemd/system/ai-tech-radar.service
[Unit]
Description=AI Tech Radar
After=network.target

[Service]
Type=simple
User=radar
WorkingDirectory=/srv/ai-tech-radar
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=NEXT_PUBLIC_SITE_URL=https://radar.example.com
Environment=WORKSPACE_ACCESS_ENABLED=true
EnvironmentFile=/etc/ai-tech-radar.env
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Keep `WORKSPACE_ACCESS_TOKEN=...` in `/etc/ai-tech-radar.env` with mode `0600`,
owned by root — not in the unit file, which is world-readable.

### 4. Terminate TLS

```caddyfile
# /etc/caddy/Caddyfile
radar.example.com {
  reverse_proxy 127.0.0.1:3000
}
```

Caddy obtains and renews the certificate on its own. The app already sends CSP
and HSTS in production builds, so the proxy does not need to add them.

### 5. Replace the Windows task with cron

```cron
5 8 * * * cd /srv/ai-tech-radar && /usr/bin/npm run tasks:run-once >> /var/log/ai-tech-radar-tasks.log 2>&1
```

Unlike Windows Task Scheduler, cron has no "skip if on battery" or "never catch
up a missed run" defaults to disarm — but it also does not catch up a missed
run, so a server that was down over the scheduled minute simply misses that
day. The scheduled digest draft is always generated for _today_, so a missed
day is never backfilled.

### 6. Back up the state directory

```bash
# daily, before the task runner window
tar czf "/var/backups/radar-$(date +%F).tar.gz" -C /srv/ai-tech-radar config
```

Send the archive off the machine (object storage, another host, or a private
repository). `config/` is the entire product state — losing it loses every
published signal, digest, and relation edit.

### 7. Verify before opening traffic

Run these against the real server, not a dev build:

```bash
curl -o /dev/null -w '%{http_code}\n' https://radar.example.com/            # 200
curl -o /dev/null -w '%{http_code}\n' https://radar.example.com/workspace   # 401
curl -o /dev/null -w '%{http_code}\n' \
  -H "x-workspace-access-token: $TOKEN" https://radar.example.com/workspace # 200
curl -s https://radar.example.com/feed.xml | grep -c localhost              # 0
curl -sI https://radar.example.com/ | grep -i -e content-security -e strict-transport
```

A `200` on `/workspace` without a token means the guard is not running — see
the middleware-location section above before going any further.

## Environment Variables

- `NEXT_PUBLIC_SITE_URL`: public base URL used for digest links and feeds.
- `WORKSPACE_ACCESS_ENABLED`: enables minimal workspace/API token protection.
- `WORKSPACE_ACCESS_TOKEN`: shared token for protected internal routes.
- `LOCAL_DATA_DIR`: local JSON workflow directory; defaults to `./config`.
- `PERSISTENCE_DRIVER`: `json` by default; set to `sqlite` after running database initialization and migration.
- `SQLITE_DATABASE_PATH`: optional SQLite database path; defaults to `./config/ai-tech-radar.sqlite`.
- `TASK_RUNNER_INTERVAL_SECONDS`: watch-loop interval for `npm run tasks:watch`.
- `IMPORT_FETCH_ATTEMPTS`: source-fetch attempts before a source is marked
  failed (default `3`, capped at `5`). Retries cover transport failures,
  timeouts, `429`, and `5xx`; a `4xx` is treated as a configuration problem
  and fails immediately.
- `IMPORT_FETCH_TIMEOUT_MS`: per-attempt timeout (default `20000`, capped at
  `120000`).
- `IMPORT_FETCH_RETRY_DELAY_MS`: base backoff between attempts (default `800`,
  multiplied by the attempt number).

> **The importer does not use an HTTP proxy by default.** Node's global
> `fetch` (undici) ignores `HTTP_PROXY` / `HTTPS_PROXY`, so the app connects
> directly even when the shell's `curl` reaches the same host through a proxy.
> On a machine where a source host is only reachable via a proxy, every import
> of that source fails with `fetch failed` (undici's connect timeout is ~10s),
> and retries do not help — they take the same blocked path. Diagnosed
> 2026-07-28 against three `github.com` release feeds, and still reproducing
> on 2026-08-07: the same minute, `curl` returned **200 in 3.27s** while a
> plain `node -e "fetch(...)"` failed **12 of 13 attempts**, and the scheduled
> import came back `partial` with exactly those three sources failed.
>
> **On Node 24 this is fixable without a dependency, and it is now enabled on
> this machine's scheduled task** (2026-08-09). `NODE_USE_ENV_PROXY=1` makes
> the built-in fetch honour the proxy environment variables. The earlier note
> here said the `undici` package's `ProxyAgent` was the only route; that
> predated the flag and was wrong from Node 24 onwards.
>
> **The proxy is not transparent, so the flag alone is not the right setting.**
> Measured over three full batch imports against the real ten sources, each
> from an identical baseline in an isolated `LOCAL_DATA_DIR`:
>
> | configuration                        | sources OK  | elapsed | what failed                     |
> | ------------------------------------ | ----------- | ------- | ------------------------------- |
> | no flag (the old default)            | **6 / 10**  | 137s    | 3 GitHub feeds + Google AI Blog |
> | `NODE_USE_ENV_PROXY=1`               | **9 / 10**  | 7–14s   | **Hugging Face Blog**           |
> | flag + `hf-mirror.com` in `NO_PROXY` | **10 / 10** | 6–7s    | nothing                         |
>
> The middle row is the finding worth keeping. Through the proxy,
> `hf-mirror.com/blog/feed.xml` returns **200 with `text/html` and 3,736
> bytes** — a Chinese-language interception page — where a direct connection
> returns **200 with `application/rss+xml` and 243,285 bytes** of real RSS.
> **It is a successful-looking wrong response, not a transport error.** The
> importer's parser rejected it ("不支持的订阅源格式"), which is why it was
> visible at all; a more permissive parser would have ingested the page.
> `hf-mirror.com` is one of this project's most productive sources, so it is
> excluded from the proxy rather than the flag being abandoned.
>
> The scheduled task therefore runs with both variables:
>
> ```text
> cmd /c cd /d C:\Users\Administrator\ai-tech-radar && set NODE_USE_ENV_PROXY=1 && set NO_PROXY=localhost,127.0.0.1,::1,.local,hf-mirror.com && npm run tasks:run-once >> config\task-runner-cron.log 2>&1
> ```
>
> Verified end to end on 2026-08-09 by triggering the real task: exit code 0,
> **10/10 sources succeeded in 12 seconds** against 137 seconds before, and
> `nextRunAt` advanced normally so the run is not repeated.
>
> **Rollback** — restore the original single-command action:
>
> ```powershell
> $a = New-ScheduledTaskAction -Execute 'cmd' -Argument '/c cd /d C:\Users\Administrator\ai-tech-radar && npm run tasks:run-once >> config\task-runner-cron.log 2>&1'
> Set-ScheduledTask -TaskName "ai-tech-radar-tasks" -Action $a
> ```
>
> Remaining caveats:
>
> - `NODE_USE_ENV_PROXY` is **experimental** in Node 24 and `package.json`
>   pins only a lower bound, so a Node upgrade could change this. The failure
>   mode is mild — back to 6/10.
> - ~~The variables are on the **scheduled task only**, so the web server still
>   connects directly.~~ Closed 2026-08-10 — see "Proxy for every entry point"
>   below. The scheduled task's inline `set` is now redundant rather than
>   load-bearing, and is left in place because it costs nothing and keeps the
>   task working even if the wrapper is bypassed.
> - **One measurement was not enough.** The first flagged batch run returned
>   **0/10** and would have produced the opposite recommendation. The proxy was
>   verified alive, concurrency and request options were each ruled out, and
>   two re-runs both gave 9/10 — the first result was transient.

- `DELIVERY_WEBHOOK_ENDPOINT`: optional operator reference for generic webhook setup.
- `FEISHU_WEBHOOK_ENDPOINT`: optional operator reference for Feishu webhook setup.
- `LLM_PROVIDER`: optional workspace editorial enrichment provider, `mock` or `openai_compatible`.
- `LLM_API_KEY`: optional API key for the OpenAI-compatible enrichment provider.
- `LLM_BASE_URL`: optional OpenAI-compatible base URL.
- `LLM_MODEL`: optional model name.
- `LLM_TIMEOUT_MS`: optional provider request timeout.
- `PUBLIC_AI_RATE_LIMIT_PER_MINUTE`: optional per-client, per-route request
  budget for the three public AI routes; defaults to `10`.
- `PUBLIC_AI_RATE_LIMIT_PER_HOUR`: the same budget over an hour; defaults to
  `40`. Both are enforced in-process (see `docs/security-boundary.md` →
  "Public LLM Feature Boundary"); review them before configuring a real-cost
  provider, and keep a proxy/platform limit for anything abuse-shaped.

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

#### `StartWhenAvailable` did not survive contact with sleep (2026-08-04)

The settings above were applied on 2026-07-28 and are still in place, and the
task still skipped three of the next seven days: **07-31, 08-02 and 08-04**.
The cause is not the task. On each of those mornings the machine was **asleep
at 08:05** — on 08-04 the kernel power log shows a user-mode `SetSuspendState`
at 01:20 and the session state climbing back out of low power only at
**09:30** — and `WakeToRun` is deliberately off, so the trigger had no way to
fire. The days it did run (07-29, 07-30, 08-01, 08-03) are exactly the days
the machine was already awake.

`StartWhenAvailable` should have made the run up shortly after the 09:30
resume and did not: Windows recorded `NumberOfMissedRuns: 1` and moved
`NextRunTime` straight to the following day. **Why it did not fire is not
recoverable**, because the Task Scheduler history log ships disabled, so no
per-attempt record exists. Enable it so the next occurrence leaves evidence:

```powershell
wevtutil sl Microsoft-Windows-TaskScheduler/Operational /e:true
```

The fix applied instead of `WakeToRun` is a **second trigger** that fires when
the operator unlocks the machine — i.e. when they actually start using it —
with a two-minute delay so the network is up after a resume:

```powershell
$task = Get-ScheduledTask -TaskName "ai-tech-radar-tasks"
$class = Get-CimClass -ClassName MSFT_TaskSessionStateChangeTrigger `
  -Namespace Root/Microsoft/Windows/TaskScheduler
$unlock = New-CimInstance -CimClass $class -ClientOnly
$unlock.StateChange = 8            # TASK_SESSION_UNLOCK
$unlock.UserId = "$env:USERDOMAIN\$env:USERNAME"
$unlock.Delay = "PT2M"
$unlock.Enabled = $true
Set-ScheduledTask -TaskName "ai-tech-radar-tasks" `
  -Trigger @($task.Triggers[0], $unlock)
```

Unlock rather than logon, because resuming from sleep does not log the
operator back on — it unlocks an existing session.

**This cannot double-import, and that is a property of the app rather than of
the trigger.** `scheduled-import.json` and `scheduled-digest.json` each carry a
`nextRunAt` that the runner advances after a successful pass, so a second run
on the same day reports `定时导入未到期` / `定时简报草稿未到期` and writes
nothing. Verified by running `tasks:run-once` twice in one day: the second pass
finished in under a millisecond having done exactly that.

Roll back with
`Set-ScheduledTask -TaskName "ai-tech-radar-tasks" -Trigger $task.Triggers[0]`.

#### Not every missed run was sleep — 17% were killed by Ctrl+C (2026-08-09)

**The sleep explanation above is correct for 07-31, 08-02 and 08-04 and was
then over-applied.** 08-08 was written up as another sleep day without being
checked. It was not. The Task Scheduler history enabled on 08-04 finally had
something to say, and it says the opposite:

| 08-08 08:05:01 | `id=107` time trigger fired, `id=129` process started                         |
| -------------- | ----------------------------------------------------------------------------- |
| 08-08 08:05:03 | finished, return code **3221225786** = `0xC000013A` = `STATUS_CONTROL_C_EXIT` |

The machine was awake, the task fired on time, and the process was killed two
seconds in. `config/task-runner-cron.log` shows npm's banner and then a bare
`^C^C` where the run should be.

**It had happened before.** Across the whole log, **5 of 29 npm invocations
(17%) never reached the runner** — four leaving a literal `^C^C`, three of
those with cmd's `终止批处理操作吗(Y/N)?` prompt still attached, and one dying
silently.

**Root cause was the task's own principal**: `LogonType: Interactive` with
`Hidden: False`. The task ran inside the operator's interactive session with a
visible console window, and that console receives `CTRL_C_EVENT` /
`CTRL_CLOSE_EVENT` — closing the window, a disconnecting session, or a stray
keystroke all kill the run. `ExecutionTimeLimit` is 72 hours, so a timeout is
ruled out by the two-second death.

**Fix — run it without a console at all:**

```powershell
$p = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType S4U -RunLevel Limited
Set-ScheduledTask -TaskName "ai-tech-radar-tasks" -Principal $p
```

S4U runs in a background session with no interactive console, so there is no
window to close and no dependency on anyone being logged on. Verified by
triggering the real task: **exit code 0**, the runner reached and logged
normally, no `^C`, and the not-due branches reported correctly so nothing was
re-imported. Triggers, `StartWhenAvailable` and the proxy variables are
untouched.

Roll back with
`Set-ScheduledTask -TaskName "ai-tech-radar-tasks" -Principal (New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited)`.

**The method note matters more than the fix.** Two readings disagreed during
this investigation and both were technically right: `cat -A` showed `^C^C`,
while a byte scan reported **zero** control characters in the file. The file
contains no control bytes — `cmd.exe` writes the caret notation as **literal
text**. The wrong step was concluding "no Ctrl-C" from the byte scan instead
of asking why the two disagreed.

Other notes:

- Schedule the Windows task a few minutes **after** the configured import time
  so the run is already due when the runner starts.
- `schtasks /Run /TN "ai-tech-radar-tasks"` triggers a manual test run;
  `schtasks /Delete /TN "ai-tech-radar-tasks"` removes it.
- The same duplicate protections apply: an extra run on the same day skips the
  already-run import and already-sent deliveries.

### Proxy for every entry point

Until 2026-08-10 the proxy variables lived on the scheduled task's command line
only, so the **same** import took one network path at 08:05 and a different one
when triggered from the workspace UI. `scripts/with-proxy-env.mjs` now wraps
`dev`, `start`, `tasks:run-once` and `tasks:watch`; `scripts/proxy-env.mjs` is
the single definition of what that environment is.

**Why a launcher and not application code.** `NODE_USE_ENV_PROXY` is read at
process **bootstrap**. Measured against a proxy pointed at a dead port, which
discriminates regardless of whether the direct route happens to work that day:

| how the flag is set                    | fetch result | engaged? |
| -------------------------------------- | ------------ | -------- |
| `NODE_USE_ENV_PROXY=1 node script.mjs` | FAIL 7ms     | yes      |
| `process.env.NODE_USE_ENV_PROXY = "1"` | OK 504ms     | **no**   |
| `node --use-env-proxy script.mjs`      | FAIL 8ms     | yes      |
| `NODE_OPTIONS=--use-env-proxy`         | FAIL 8ms     | yes      |

An earlier probe the same day concluded the opposite — that setting it at
runtime worked — because it ran while direct connectivity was flapping, so a
lucky direct connection looked like a proxied one. **The dead-port proxy is the
instrument that cannot be fooled that way**; a probe that only tries the happy
path cannot tell "the proxy carried it" from "it did not need the proxy".

The wrapper also reads `HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY` out of
`.env.local` before spawning, filling only what the real environment left
unset. That is not redundancy with Next's own `.env` loading — Next loads it
_after_ bootstrap, far too late for this flag — and it is what makes the
setting survive a launcher with a bare environment. Measured: an IDE preview
pane reported `未检测到代理配置` while the identical command from a shell did
not.

The wrapper logs one line on every run, **including when it does nothing**:

```
[proxy] 已启用代理（NODE_USE_ENV_PROXY=1）…，直连例外：hf-mirror.com（来自 .env.local：…）
[proxy] 未检测到代理配置（HTTP_PROXY / HTTPS_PROXY），保持直连。
```

Silence on the inactive branch is indistinguishable from the wrapper not
running at all, which cost a real diagnostic detour the day it was written. Set
`PROXY_ENV_QUIET=1` to suppress it.

An explicit `NODE_USE_ENV_PROXY` is never overridden, so the scheduled task's
own value still wins and `NODE_USE_ENV_PROXY=0` remains a working escape hatch.

### Daily backup (Windows)

`npm run backup:data` (`scripts/backup-local-data.mjs`) takes a timestamped
copy of `LOCAL_DATA_DIR` and verifies it. It is the mitigation for the
durability gap in `docs/production-readiness.md` → I2: the JSON store has no
multi-writer locking, and the task runner writes the same files the operator
edits through the workspace UI.

What it does, and why each part is there:

- copies to `BACKUP_DIR/config-YYYY-MM-DD_HHmmss` (default
  `<userprofile>\ai-tech-radar-backups`, deliberately **outside** the repo so
  it is neither committed nor picked up by the Next file watcher);
- re-reads every copied file and compares **SHA-256 per file** against the
  source — a backup nobody verified is a backup nobody can rely on, so this
  runs every time rather than behind a flag. A mismatch fails the run and
  **keeps** the bad copy for inspection;
- writes `backup-manifest.json` (file count, byte total, per-file hashes)
  into each snapshot, so a later store corruption can be traced to the first
  snapshot that shows it;
- refuses to write an **empty** backup, so a mis-set `LOCAL_DATA_DIR` cannot
  quietly push good snapshots out of the retention window;
- prunes to `BACKUP_KEEP` (default 14), newest kept;
- exits non-zero on any failure, so Task Scheduler records a failure instead of
  reporting success.

Register it to run daily at 07:45 — **before** the 08:05 import task, so the
snapshot is of a settled store rather than one mid-write:

```powershell
$action  = New-ScheduledTaskAction -Execute "cmd" -Argument '/c cd /d C:\Users\Administrator\ai-tech-radar && npm run backup:data >> config\backup-cron.log 2>&1'
$trigger = New-ScheduledTaskTrigger -Daily -At 7:45am
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType S4U -RunLevel Limited
$settings  = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries
Register-ScheduledTask -TaskName "ai-tech-radar-backup" -Action $action -Trigger $trigger -Principal $principal -Settings $settings
```

`S4U` and `-StartWhenAvailable` are not incidental — they are the two settings
whose absence cost the import task 9 missed days and 5 console-killed runs (see
the two sections above). Starting the backup task from the same known-good
shape avoids re-learning both lessons.

Verify with `schtasks /Run /TN "ai-tech-radar-backup"`, then check
`config\backup-cron.log` and the snapshot directory. Remove with
`schtasks /Delete /TN "ai-tech-radar-backup"`.

**What this does not protect against, stated plainly:** the snapshots land on
the same physical disk, so a disk failure loses both. It covers the failure
mode this project actually hits — a store written wrong, truncated, or deleted.
Copying `BACKUP_DIR` off the machine periodically is still worth doing.

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
