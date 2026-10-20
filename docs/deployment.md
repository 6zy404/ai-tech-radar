# Deployment Readiness v0

This project is still a local-first prototype, but it can be run in a controlled server or long-running local environment if the internal surfaces are protected.

## Route Boundary

Public user-facing routes:

- `/`
- `/technologies` (also hosts the news/timeline/followed views via `?view=`)
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
| Domain             | **`aizyradar.cn`** (bought 09-20)   | apex is the public origin; `NEXT_PUBLIC_SITE_URL` pinned in `.env.local`, rebuilt from it  |
| Workspace exposure | **not public at all**               | with a tunnel this is **not** free — it needs an edge deny list _and_ the token; see below |
| Backups            | **same machine, another directory** | `npm run backup:data` as-is; the same-disk risk is accepted, see below                     |

### Exposure: outbound tunnel (chosen 2026-08-13)

The machine sits behind a residential-style connection: inbound 80/443 is
commonly blocked, and the IP address is dynamic. An outbound tunnel
(Cloudflare Tunnel, frp, …) solves those two network problems — the machine
dials out, nothing listens inbound, and the address does not have to be
stable.

That is all it solves. A tunnel changes the network path, not where the site
is run or who runs it, so it has no bearing on whether legal obligations such
as ICP filing (备案) apply. This document draws no conclusion on that; it is
an open owner item that needs professional advice (`docs/next-task.md` →
「卡在 owner 的事」→ 合规). (Corrected 2026-10-14: this paragraph used to say
the tunnel "sidesteps" filing along with the two network problems.)

Buy the domain at a registrar that suits the tunnel provider; `.dev` and
`.app` are worth considering because browsers force HTTPS on them.

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

**These tasks run as the built-in Administrator; a low-privilege account is
prepared, not yet applied (2026-10-15).** The account is RID 500 and
`FilterAdministratorToken` is unset, so UAC gives it no filtered token and
`-RunLevel Limited` filters nothing: the public server and the tunnel run
with full administrator rights (Task Manager → Details → the 提升 / Elevated
column on the `node.exe` that holds port 3000 shows it). It also ties the site
to that one account: on 2026-10-02 an Administrator lockout stopped the server
task from starting for 20 minutes (see "Deploy with one command" below).
[`docs/service-account.md`](service-account.md) and
`scripts/setup-service-account.ps1` move the server, import, backup and tunnel
tasks to two standard local accounts; the owner runs them, and the document
lists what `scripts/deploy.ps1` should change afterwards.

**The server listens on loopback only (2026-09-28).** `npm run start` is
`next start -H 127.0.0.1`. The tunnel connects to `localhost:3000` from the
same machine, so nothing else has a reason to reach the port — and until this
change everything on the local network could. The binding lives in
`package.json` rather than in the task definition, so it is versioned and the
task itself did not have to be re-registered. Measured on the live server,
before and after the deploy that restarted it:

| Request to                    | before, listening on `::` | after, listening on `127.0.0.1` |
| ----------------------------- | ------------------------- | ------------------------------- |
| `127.0.0.1`                   | 200                       | 200                             |
| `localhost`                   | not measured              | 200 — after falling back to v4  |
| `[::1]`                       | not measured              | refused                         |
| the machine's own LAN address | **200 in 16ms**           | **refused**                     |

Through the domain afterwards: seven public routes at 200, and the five denied
prefixes still at 404.

**`localhost` still works, at a price that depends on the client.** It resolves
to `::1` first, which is now refused. Node's `fetch` moves on at once (37ms on
the first request). .NET — `Invoke-WebRequest` — waits about **two seconds** on
the first connection and is fast after that (2045ms, then 10ms). The tunnel is
the client that matters and it pays nothing measurable: twelve sequential
requests for `/api/health` through the domain, 12/12 at 200, mean 512ms,
fastest 406ms, slowest 844ms, and no origin error in the tunnel log. Pointing
the tunnel's ingress at `http://127.0.0.1:3000` would remove the fallback
altogether; it was left alone because there was nothing to gain that could be
measured. **Use `127.0.0.1` in local probes**, not `localhost`.

The LAN row is what the change is for. Besides reaching the site around the
tunnel's deny list, a caller on the network could set `CF-Connecting-IP` to
anything and get a fresh rate-limit bucket per request (see
`docs/security-boundary.md` → "Public LLM Feature Boundary"). `npm run deploy`
checks the binding after every restart and exits `2` when a listener is not a
loopback address.

**When the domain stops answering while port 3000 is fine, see "Tunnel
watchdog" below** — the 2026-10-17 → 10-20 outage, and the task that now
restarts `cloudflared` on its own.

**Rebuild before it matters.** `npm run start` serves whatever `.next` holds,
so it must be rebuilt after `NEXT_PUBLIC_SITE_URL` changes — and **never
build into `.next` while this task is running**, since dev/build/start all
share it.

**Deploy with one command (`scripts/deploy.ps1`, 2026-09-28).** Run from the
checkout the server task serves:

```powershell
npm run deploy            # build beside the running server, swap, restart, verify
npm run deploy:rollback   # swap back to the previous build, restart, verify
powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1 -WhatIf   # print the steps, change nothing
```

What a deploy does, in order:

1. **Preflight, before anything changes.** The scheduled task must serve this
   checkout, and the process on port 3000 must be a `node` started out of this
   checkout's `node_modules`. Run from a git worktree, it refuses. It also
   refuses while the Security log holds any failed logon (event 4625) from
   the last 10 minutes (`-LockoutWindowMinutes`), naming the account and
   process and the time it may run again. On 2026-10-02 headless Chrome
   failed an Administrator logon once per process, the 10-in-10-minutes
   policy locked the account, and the server task — which logs on as that
   account — could not start for 20 minutes; rolling back cannot help,
   because the previous build starts the same way. `deploy:rollback` runs
   the same check. If the log cannot be read, it warns and continues.
2. **Build into `.next-new`** with `npm run build:public` while the server keeps
   serving. A failed build stops here; the server was never touched.
3. **Swap** — stop the task, end the process tree holding the port
   (`Stop-ScheduledTask` leaves the detached `next start` running, so this is
   explicit), rotate logs, `.next` → `.next-old`, `.next-new` → `.next`, start
   the task.
4. **Health check.** `/api/health` must answer `ok` with the **new** build id
   **from a process younger than the restart**. The second condition is not
   decoration: the route reads `BUILD_ID` from disk on every request, so a
   server that was never restarted reports the new id while still running the
   old code.
5. **If the health check fails, roll back automatically**: the previous build
   goes back to `.next`, the task restarts, and the failed build is kept in
   `.next-failed` for inspection until the next deploy.
6. **Report**: four public pages at 200, the listening address, the public URL
   through the tunnel (reported only — the edge has measured anywhere from 0.8s
   to 29s from this network, so it is never a reason to roll back), and the
   measured downtime. One line per run is appended to `config/deploy.log`.

Exit codes: `0` healthy, `1` failed (previous build restored where possible),
`2` healthy but not loopback-only.

**First real run, 2026-09-28 10:37**: build `ihu-mrtG…` → `er8Hdsj9…` (32
routes, 0 workspace), **1.8 seconds** from stopping the old process to a
healthy answer from the new one — against about ten when the same steps were
typed by hand. Checked afterwards by requesting rather than by reading the
script's own output: one listener on `127.0.0.1`, the domain's public routes at
200, the five denied prefixes at 404, and the working tree clean (`tsconfig.json`
restored by the build script).

`.next-old` always holds the previous build, so `deploy:rollback` needs no
arguments, and running it twice returns to where it started. A rollback target
older than 2026-09-25 has no `/api/health`; the script then checks the home
page instead and says so.

**A dependency change needs a stop first.** The script builds against the
`node_modules` the checkout already has and never installs anything, so after
a merge that changes `package-lock.json`, `npm run deploy` alone would build
and serve the old versions. On Windows the running server holds native
modules open (onnxruntime, sharp), so `npm ci` cannot run under it either.
The order that worked on 2026-10-14 (Next.js 15.5.15 → 15.5.27): stop the
server (the script's own ownership check first: the port 3000 listener must
run from this checkout's `node_modules`), `npm ci` in the live checkout —
with `HTTPS_PROXY` cleared if the proxy is down; the cache from a worktree
install made it 16 seconds — then `npm run deploy`. About 1.5 minutes down.
`.next-old` is then a build of the old dependencies, so a rollback means
restoring the lock file and running `npm ci` again before
`deploy:rollback`. Worktrees whose `node_modules` is a junction into the live
checkout see the new versions at once.

**Log rotation happens inside the stop window**, because `config/server.log` is
held open by the running task and cannot be renamed at any other time. A log
over 1 MB (`-LogMaxKB`) becomes `.1`, older generations shift up, three are
kept (`-LogKeep`). It covers `server.log`, `task-runner-cron.log` and
`backup-cron.log`; a log another task is writing at that moment is skipped and
reported, not an error. On 2026-09-28 the three together were about 100 KB, so
nothing rotates yet.

**Rehearse after changing the script**: `npm run deploy:rehearse` builds a
throwaway repository under the temp directory, starts a stand-in server on port
3199 in place of the scheduled task, and drives the real deploy and rollback
through seven scenarios (34 checks, about a minute). Only the scheduled task is
stubbed.

> **The first rehearsal stopped the live server for 78 seconds** (2026-09-28,
> 10:21:52–10:23:10). The harness kept its port in `$port`; the deploy script's
> parameter is `$Port`; PowerShell variable names are case-insensitive and
> dot-sourcing assigns a script's parameters in the caller's scope, so the
> default `3000` overwrote `3199`. The only check standing in the way was "the
> process on the port is `node`", which the live server passes. Two things
> changed: the script now refuses to end a process that was not started from
> its own checkout, and the rehearsal reproduces exactly this case as its first
> scenario. For part of that window the stand-in answered on port 3000, so a
> visitor would have received a bare `ok`.

Doing it by hand is still possible and is what the script replaced — build with
`NEXT_DIST_DIR=.next-new`, `Stop-ScheduledTask`, end the process tree on port
3000, rename the two directories, `Start-ScheduledTask`. Measured by hand on
2026-09-24: about ten seconds of downtime, and `/ask`, which had been `404` on
the 09-21 build, answered `200` on the first request.

**The embedding model does not download on this machine — seed the cache.**
The design was that the first `/search` after a deploy fetches the ~130MB
model through `hf-mirror.com` in the background and answers from keywords
until it is ready. Measured 2026-09-24, it never becomes ready: the mirror
answers the model file with a **302 to `cas-bridge.xethub.hf.co`**, a Hugging
Face host that is neither in `NO_PROXY` nor reachable directly from here, so
the download hangs, `.cache/models/` holds only `config.json`, and every search
logs `not ready within 3000ms` — **no load error is ever logged**, because the
promise neither resolves nor rejects. Two consequences for the runbook:

1. Before the first deploy on a machine, copy a complete
   `.cache/models/Xenova/multilingual-e5-small/` (four files, the `.onnx`
   about 118MB) from any checkout that has one. `.cache/` is gitignored, so it
   survives rebuilds; it does **not** survive a fresh clone.
2. Seeding the cache while the server is up is not enough: a hung load is held
   in the process and never retried, so **restart the server task** after
   copying. Then one warm-up request and a check that a search result carries
   the 语义相近 stamp:

```powershell
Invoke-WebRequest "http://localhost:3000/search?q=quantization" -UseBasicParsing | Out-Null
(Invoke-WebRequest "http://localhost:3000/search?q=%E6%A3%80%E7%B4%A2" -UseBasicParsing).Content -match "语义相近"
```

On 2026-09-24 the corpus embedded within 15 seconds of the restart and
`.cache/search-embeddings.json` (about 1MB) appeared beside the model.

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

### Machine side, done and verified (2026-09-20)

The domain was bought, so the steps that were blocked on it are done. Each one
was verified by requesting, not by reading a config file.

- **`cloudflared` 2026.9.1** installed via winget from Cloudflare's own GitHub
  release; the installer hash was verified by winget.
- **Built with the real origin.** `.env.local` still carried
  `NEXT_PUBLIC_SITE_URL=http://localhost:3000`, and the first build only
  overrode it from the shell — which works once and silently reverts on the
  next plain `npm run build`. The file now pins `https://aizyradar.cn`.
  Verified on the running server: `/feed.xml` links read
  `https://aizyradar.cn/digest/…`.
- **Startup task `ai-tech-radar-server` registered**, exactly the shape above
  (S4U, boot trigger, `ExecutionTimeLimit` zero, `RestartCount 3`,
  `StartWhenAvailable`), read back from `Get-ScheduledTask` after registering.
  **Proven by use rather than by its settings**: the manually started server
  was stopped (port 3000 confirmed closed), the task was triggered, and the
  task-launched process served `/`, `/technologies`, `/digest/today` and
  `/feed.xml` at 200.
- **All three layers dry-run with a disposable token**, removed afterwards
  (`.env.local` confirmed back to an empty token and `ENABLED=false`):

  | Check                                    | Result                          |
  | ---------------------------------------- | ------------------------------- |
  | 3 public routes                          | 200, unaffected by the guard    |
  | all 5 protected prefixes, no token       | **401**                         |
  | `/workspace` with a **wrong** token      | **401** — it compares the value |
  | `/workspace` with the correct token      | 200                             |
  | `scripts/workspace-fetch.mjs` self-check | bare fetch 401, with token 200  |

  The last row is the one that matters for the rounds: turning the token on
  does not block the editorial tooling.

### Live (2026-09-20, same day)

The site is reachable at `https://aizyradar.cn`. Every claim below was checked
by requesting, and the numbers are what this machine measured, including the
one that is not good.

**The `.cn` question is closed: Cloudflare accepted the zone.** It was added on
the free plan and reached `Active` within minutes. At the registrar (Aliyun)
the nameservers went from `dns21/dns22.hichina.com` to `ernest.ns.cloudflare.com`
and `jewel.ns.cloudflare.com`. The registrar quotes 24–48 hours for that to
take effect; three domestic public resolvers (`223.5.5.5`, `119.29.29.29`,
`114.114.114.114`) all returned the Cloudflare nameservers within minutes.
Checking from this machine's own resolver is useless — the campus resolver
does not answer `NS` queries at all, and `8.8.8.8` is unreachable here.

**The guard is on.** The token was generated and written straight into
`.env.local` by a script so the value never appeared in a shell argument or in
any output; `WORKSPACE_ACCESS_ENABLED` and `WORKSPACE_ACCESS_TOKEN` were
flipped together. Env is read at boot, so the server task was restarted — note
that `Stop-ScheduledTask` ends the task instance but leaves the detached
`next start` holding port 3000, which has to be killed before the port frees.

**The tunnel**: name `ai-tech-radar`, id
`887730ab-2c07-4fb4-9a14-4266590a80db`, config in
`C:\Users\Administrator\.cloudflared\config.yml`, 4 connections registered,
edge location `lax01/lax09/lax10`.

**The deny list lives in the tunnel's ingress**, so it runs before anything
reaches this machine:

```yaml
ingress:
  - {
      hostname: aizyradar.cn,
      path: ^/workspace(/.*)?$,
      service: http_status:404
    }
  - {
      hostname: aizyradar.cn,
      path: ^/api/workspace(/.*)?$,
      service: http_status:404
    }
  - {
      hostname: aizyradar.cn,
      path: ^/api/candidates(/.*)?$,
      service: http_status:404
    }
  - {
      hostname: aizyradar.cn,
      path: ^/candidates(/.*)?$,
      service: http_status:404
    }
  - {
      hostname: aizyradar.cn,
      path: ^/technologies/drafts(/.*)?$,
      service: http_status:404
    }
  - { hostname: aizyradar.cn, service: http://localhost:3000 }
  - { service: http_status:404 }
```

`cloudflared tunnel ingress rule <url>` was used to dry-run the matching before
the tunnel ever ran. The row that matters is the pair
`/technologies/some-signal` → the app and `/technologies/drafts/abc` → 404:
the prefix rule does not swallow real signal pages.

**The two layers were told apart by a check that can distinguish them.** The
app answers `401` on these paths and cannot answer `404`; the domain answers
`404`. Measured at the same moment, same paths:

| Path                   | `localhost:3000` (app) | `https://aizyradar.cn` (tunnel) |
| ---------------------- | ---------------------- | ------------------------------- |
| `/workspace`           | 401                    | **404**                         |
| `/workspace/sources`   | 401                    | **404**                         |
| `/api/candidates`      | 401                    | **404**                         |
| `/candidates`          | 401                    | **404**                         |
| `/technologies/drafts` | 401                    | **404**                         |

A published signal page fetched through the domain in the same pass returned
200 in 1.5s, so the origin was alive while those five were being refused —
which rules out "the whole site was down".

Reading the server log proves nothing here, and that was checked rather than
assumed: `next start` writes no per-request line to `config/server.log`, so the
absence of `/workspace` in it is not evidence either way.

**Startup task `ai-tech-radar-tunnel`**, same shape as the server task (S4U,
boot trigger, `ExecutionTimeLimit` zero, `RestartCount 3`,
`StartWhenAvailable`). **Proven by use**: the hand-started `cloudflared` was
killed, the domain went to `502`, the task was triggered, and the
task-launched process served `/`, `/technologies`, `/digest/today` and
`/feed.json` at 200 with the five prefixes still at 404.

**Feed links carry the real origin**: `feed.json` reports
`home_page_url` / `feed_url` on `https://aizyradar.cn` and **zero** items
containing `localhost`.

**Latency is the bad number, and it is architectural.** Ten sequential
requests for the home page, direct (no proxy), from this machine's network:

```
run 1 (09-20)  10/10 at 200 — mean 10.63s, fastest 2.40s, slowest 29.37s
run 2 (09-20)  12/12 at 200 — mean  5.65s, fastest 2.90s, slowest 12.90s
run 3 (09-21)  12/12 at 200 — mean  0.82s, fastest 0.77s, slowest  0.96s
```

One request out of roughly 25 during runs 1 and 2 failed outright (curl exited
before any status, after 10.8s). `/technologies` was as slow as 47s in run 1.

**Run 3 was taken the next day, after the server was rebuilt with
`npm run build:public`, and it withdraws the conclusion the first two runs
supported.** An order of magnitude, and a spread of 0.19s where run 1 spanned
27s.

The cause is not established, so it is not asserted here. Candidates, none of
them tested: the tunnel had come up minutes before run 1 (one of its four
connections failed its first dial and re-registered, and cloudflared logged a
resolver timeout in the same minute), the build is smaller, or the network
simply differed. Cloudflare caching is **not** a candidate for these figures —
the home page is `force-dynamic` and curl fetched only the HTML document, not
the cacheable chunks.

What does hold across all three runs: production timings for these routes are
16–47ms measured locally, so whatever the figure is on a given day, it is
transport rather than the app.

**The mainland-server fallback is therefore not currently justified by
measurement.** Re-measure at a few different times of day before treating
either figure as the steady state.

### The public build is what is served (2026-09-21)

The workspace nav entry was visible on the live site, because the server was
running an ordinary `next build`. It is now rebuilt with `npm run build:public`:
**27 routes, 0 workspace routes.**

This costs nothing operationally, which was checked rather than assumed: the
editorial round runs against an ad-hoc `next dev` (see the playbook), and the
scheduled import and backup are their own tasks, so nothing in the daily
workflow goes through the always-on server.

**The status code alone cannot show the routes are gone**, because the
middleware answers 401 first — the same 401 it gave when they existed. The
discriminating check is to request them **with a valid token**, which used to
return 200/405 and now returns 404:

| Path with a valid token           | Before | After   |
| --------------------------------- | ------ | ------- |
| `/workspace`                      | 200    | **404** |
| `/workspace/sources`              | 200    | **404** |
| `/workspace/editorial-round`      | 200    | **404** |
| `/api/workspace/scheduled-import` | 405    | **404** |
| `/api/candidates`                 | 404*   | **404** |
| `/candidates`                     | —      | **404** |
| `/technologies/drafts`            | 307    | **404** |

The `/api/candidates` row was already 404 for its own reason (there is no GET
collection handler), so it proves nothing on its own; the other six are the
evidence.

The nav string `内部工作台` appears **0 times** in the served HTML and **0**
times across `.next/static`, and three public routes still answer 200 with the
same token. `tsconfig.json` and `next-env.d.ts` were restored by the script
(`git status` clean apart from the scheduled import state).

**Still to do.**

1. **(owner, optional)** add the WAF custom rule below in the Cloudflare
   dashboard. It is now the third layer, not the only edge layer: the ingress
   rules already refuse those paths, the routes no longer exist in the build,
   and a WAF rule would refuse them one hop earlier still

```text
starts_with(http.request.uri.path, "/workspace") or starts_with(http.request.uri.path, "/api/workspace") or starts_with(http.request.uri.path, "/api/candidates") or starts_with(http.request.uri.path, "/candidates") or starts_with(http.request.uri.path, "/technologies/drafts")
```

Action `Block`. It over-blocks by prefix (`/candidates-anything` would match
too); nothing else starts with these five, and over-blocking is the safe
direction here.

**Files that now hold secrets on this machine**, none of them in the repo:
`.env.local` (workspace token) and
`C:\Users\Administrator\.cloudflared\` (`cert.pem` plus the tunnel credentials
JSON — anyone holding that file can serve traffic for this hostname). Once
[`docs/service-account.md`](service-account.md) is applied, the tunnel runs
from a copy of `config.yml` and the credentials in
`C:\ProgramData\ai-tech-radar\cloudflared\`; ingress edits go there, and the
originals stay where they are (`cert.pem` is still what the management
commands use).

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
  Next reads it from `.env.local`; the plain-Node entry points — the task
  runner that sends scheduled digests — get it through the launcher, which
  reads it from the same file since 2026-10-21 (`scripts/with-proxy-env.mjs`,
  alongside the proxy keys). A digest delivery to a real channel, and a push,
  are refused while it is unset or points at this machine, with the variable
  named in the delivery log or the panel (`src/lib/site-url.ts`); until then
  such a send would have carried `http://localhost:3000` links.
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
- `LLM_PROVIDER`: optional LLM provider, `mock` or `openai_compatible`. One
  setting serves the workspace AI features and the four public AI routes —
  see `docs/llm-provider.md` → "Who calls the provider".
- `LLM_API_KEY`: optional API key for the OpenAI-compatible provider. Setting a
  real key makes the public routes spend it per request, within the rate limit
  below.
- `LLM_BASE_URL`: optional OpenAI-compatible base URL.
- `LLM_MODEL`: optional model name.
- `LLM_TIMEOUT_MS`: optional provider request timeout.
- `EMBEDDING_REMOTE_HOST`: where the search embedding model is downloaded
  from on first use; defaults to `https://hf-mirror.com/`, because
  huggingface.co is not reliably reachable from this machine.
- `EMBEDDING_LOAD_TIMEOUT_MS`: how long one attempt to load the search
  embedding model may take before it is abandoned and logged; defaults to
  `120000`. The next search retries.
- `SEARCH_SEMANTIC_TIMEOUT_MS`: how long a search waits for the semantic half
  before answering from keywords alone; defaults to `3000`.
- `SEMANTIC_DEDUP_TIMEOUT_MS`: deadline of the semantic duplicate pass after
  each import; defaults to `60000`. Past it the stored matches are kept as
  they were.
- `PUSH_VAPID_PUBLIC_KEY` / `PUSH_VAPID_PRIVATE_KEY`: the key pair for reader
  push (「有新信号时提醒我」); push is off unless both are set and match. See
  "Reader push keys" below before generating them.
- `PUSH_VAPID_SUBJECT`: optional contact sent to the push services,
  `mailto:` or `https:`; anything else falls back to `NEXT_PUBLIC_SITE_URL`,
  which must then itself be `https:` — a push is refused before any send
  otherwise (2026-10-21, `PushSubjectError`).
- `PUBLIC_AI_RATE_LIMIT_PER_MINUTE`: optional per-client, per-route request
  budget for the four public AI routes; defaults to `10`.
- `PUBLIC_AI_RATE_LIMIT_PER_HOUR`: the same budget over an hour; defaults to
  `40`. Both are enforced in-process (see `docs/security-boundary.md` →
  "Public LLM Feature Boundary"); review them before configuring a real-cost
  provider, and keep a proxy/platform limit for anything abuse-shaped.
- `PUBLIC_AI_DAILY_LIMIT` — site-wide model calls per Asia/Shanghai day across the four public AI routes, `429` until midnight once spent; default 500, counted in `config/public-ai-usage.json`, cache hits not counted; changing it needs a restart (2026-10-20).
- `OPS_ALERT_CHANNEL_ID`: the id of an enabled delivery channel in
  `config/delivery.json` (created at `/workspace/delivery`) that
  `check:pipeline` and the tunnel watchdog send their alerts to
  (`src/lib/ops-alert.ts`; webhook, Feishu, Telegram or Discord). Unset,
  they log one line and send nothing. The scripts run under plain Node, so
  the value is read from the environment, else from `.env.local` under the
  project root (never a fixed path) with Node's own dotenv parser,
  `util.parseEnv` — the one `process.loadEnvFile` uses in the eval scripts.

Do not commit real webhook tokens or LLM API keys. Neither local JSON nor the local SQLite file should be treated as a production secret store.

### Reader push keys

The VAPID pair is generated **once** and then kept for the life of the site:

```bash
node scripts/generate-vapid-keys.mjs   # prints the two PUSH_VAPID_* lines
```

- Put both lines in the server's `.env.local` (and in the editorial-round
  worktree's, since that server sends the pushes) and restart. Never commit
  them.
- Put `PUSH_VAPID_SUBJECT` beside them (a `mailto:` is the usual choice), or
  make sure the same file carries the `https:` `NEXT_PUBLIC_SITE_URL`: the
  push is signed with one or the other, and a sender with neither is refused.
- **Do not replace the pair.** Every browser subscribed against the public
  key; with a new pair the subscription records stay in
  `config/push-subscriptions.json`, but the push services refuse every send,
  and readers are not told.
- **Back it up separately.** `npm run backup:data` copies `LOCAL_DATA_DIR`
  only, not `.env.local`, so the keys need their own copy off this machine
  (a password manager will do). A lost pair cannot be recovered; the only
  way back is a new pair and every reader turning alerts on again.

## Task Runner

Windows local run:

```powershell
npm run tasks:run-once
npm run tasks:watch
```

**Check the first line of each run in `config/task-runner-cron.log`.** It must
read `数据目录：…（真实数据目录）` and name the live directory. From
2026-09-25 to 09-27 it read `验证数据目录：…临时副本，结束后删除` instead,
because the runner was launched through the validators' launcher, and every
import of those four days was deleted with the copy while the log reported
success. The runner now goes through `scripts/run-ts.cjs`; the validators'
launcher refuses it. A second thing to look at when the pool seems quiet:
`nextRunAt` in `config/scheduled-import.json` should be tomorrow, not a date
in the past.

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
- `WakeToRun` was turned **on** on 2026-09-24, on this task and on the backup
  task, after the site went public, on the reasoning that the host slept at
  night and would now wake for the 07:45 backup. **It has never woken the
  machine, because the machine was not asleep** (corrected 2026-10-14; see
  "Keeping the host on" below). The 2026-09-23 outage that prompted it, from
  03:01 to 13:59, was a shutdown with fast startup — Kernel-Power 42 records
  `TargetState=6` — and a wake timer does nothing for a machine that is off.
  The setting is harmless and still on. It was applied with
  `$t = Get-ScheduledTask "ai-tech-radar-tasks"; $s = $t.Settings; $s.WakeToRun = $true; Set-ScheduledTask "ai-tech-radar-tasks" -Settings $s`
  (same for `ai-tech-radar-backup`); roll back with `$s.WakeToRun = $false`.

Verify with
`(Get-ScheduledTask -TaskName "ai-tech-radar-tasks").Settings | Select-Object StartWhenAvailable, DisallowStartIfOnBatteries, StopIfGoingOnBatteries`
(expect `True / False / False`). To roll back, run the same command with
`-DisallowStartIfOnBatteries -StopIfGoingOnBatteries` and without
`-StartWhenAvailable`.

What this does **not** do: catch-up runs fire **once**, not once per missed
day, and a missed day's digest draft is never backfilled — the scheduled
digest always generates _today's_ draft.

#### `StartWhenAvailable` did not survive contact with sleep (2026-08-04)

> **Correction (2026-10-14 review): those mornings were shutdowns, not
> sleep.** Re-read on 2026-10-15, every Kernel-Power 42 entry in the System
> log back to 2025-07-23 — 193 of them — has `EffectiveState=5`, and 192 have
> `TargetState=6`: a shutdown with fast startup. That includes 07-31 04:44 and
> 08-04 01:20; the "user-mode `SetSuspendState` at 01:20" below is that
> shutdown. The conclusion about the task stands — no trigger can fire while
> the machine is off — but "asleep" does not, and nor does the premise of
> `WakeToRun`. One more consequence: after a shutdown the morning starts with
> a **new logon**, not an unlock, so the unlock trigger added below does not
> fire then; the backup task's at-logon trigger (see "Daily backup") is the
> shape that matches. Neither task was changed by this correction.

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

**The explanation above — the machine was not running at 08:05, which the
2026-10-14 correction shows meant shut down rather than asleep — is correct
for 07-31, 08-02 and 08-04 and was then over-applied.** 08-08 was written up as another sleep day without being
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

**Pipeline alert (`check:pipeline`, 2026-09-29).** A third daily task runs
`npm run check:pipeline` from the main checkout at 14:30 — six and a half hours
after the import, late enough to see both a stall and an overdue run. It shows
a Windows toast when the dashboard's pipeline alerts fire (once per alert per
day) and exits 1. It **must** be registered with "Run only when user is logged
on": a task in session 0 has no desktop, so the toast would never appear. Try
it with `npm run check:pipeline -- --test`. The task is
`ai-tech-radar-pipeline-alert`, daily at 14:30, logon type Interactive, action
`cmd.exe /c cd /d C:\Users\Administrator\ai-tech-radar && npm run check:pipeline >> config\pipeline-alert.log 2>&1`
(the log is git-ignored). `scripts/register-windows-tasks.ps1` does not create
it — that script registers S4U tasks, which run in session 0 — so on a new
machine it is registered by hand.

### Tunnel watchdog (2026-10-20)

**The site was unreachable for two and a half days while the server was
healthy the whole time.** On 2026-10-17 at 21:37 the machine restarted and
the tunnel task started `cloudflared` before the campus resolver
(`210.42.24.19`) was answering properly. `cloudflared` resolved
`region1.v2.argotunnel.com` to a **private address, `10.3.33.253`**, and from
then on dialled `10.3.33.253:7844` about once a minute (`connectex: No
connection could be made because the target machine actively refused it`)
while its five-minute DNS refresh timed out every time (`Failed to refresh
DNS local resolver … i/o timeout`), so it never re-resolved. The edge
answered `530` (error 1033, no connector) until 2026-10-20 10:19, when
someone looked. Port 3000 answered `200` throughout; the pipeline alert task
knows nothing about the tunnel, and would only have shown a toast anyway.

Two more things measured while fixing it by hand:

- `Stop-ScheduledTask ai-tech-radar-tunnel` ends the task's `cmd` and leaves
  the child `cloudflared.exe` running, because the action is
  `cmd /c cloudflared … >> tunnel.log 2>&1`. While the old instance still
  shows `Running`, a start is dropped (`MultipleInstances = IgnoreNew`), so
  the process has to be stopped with `Stop-Process` first.
- `https://aizyradar.cn/api/health` is reachable from this machine both
  through the proxy and directly, so the public side can be checked from
  here.

**`scripts/tunnel-watchdog.ps1`**, run every 5 minutes by the task
`ai-tech-radar-tunnel-watchdog`:

1. `GET http://127.0.0.1:3000/api/health` — direct, never through a proxy.
   Its `build` field goes into every alert and every log line, so a message
   says which build was running.
2. `GET https://aizyradar.cn/api/health` — through the proxy or direct,
   decided by `scripts/with-proxy-env.mjs` itself (the watchdog asks it:
   `HTTPS_PROXY` / `HTTP_PROXY` from the environment, else from
   `.env.local`, used only when the proxy answers a TCP connect within
   1.5 s), so the proxy rule has one definition and the watchdog carries no
   `.env.local` parser of its own.
3. The last 20 lines of `tunnel.log`, for an `ERR` line that dials a private
   address (`10/8`, `172.16/12`, `192.168/16`) on port 7844 — the 10-17
   signature.

The tunnel counts as broken on a run when the local check is `200` and the
public check is not `200`, or the log shows a private dial. **Two
consecutive broken runs** → `Stop-ScheduledTask`, `Stop-Process` every
`cloudflared.exe`, wait for the task to leave `Running`,
`Start-ScheduledTask`, wait 30 s, check the domain again, and send an
off-site alert (`docs/operations.md` → "Off-site alerts") saying whether it
recovered. Afterwards: no second restart within 15 minutes; while it stays
down, one alert an hour at most, and one more when the domain comes back. A
local check that is not `200` is not the tunnel's problem: the script then
sends one alert on the second consecutive failure (`localAlerted` in the
state file, cleared when the local check recovers, so the next outage alerts
again) and does nothing else.

State (`publicFailures`, `localFailures`, `localAlerted`, `lastRestartAt`,
`lastAlertAt`, the last run's numbers) is `config/tunnel-watchdog-state.json`; every run appends
one line to `config/tunnel-watchdog.log` (rotated to `.1` past 1 MB). Both
are git-ignored and sit beside the other tasks' logs.

**What it never does**, asserted at runtime before any `Stop-Process`: stop a
process not named `cloudflared`; stop a process that owns a listener on port
3000; call a task cmdlet with any name but the tunnel task's (it refuses
`ai-tech-radar-server` outright); write anywhere but the state file and the
log, neither under `.next`. `-DryRun` runs the three checks against the
real endpoints, prints these assertions with the PIDs they were checked
against, and prints the decision — writing, stopping and sending nothing —
and is the first thing to run after any edit:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\tunnel-watchdog.ps1 -DryRun
```

Measured 2026-10-20 (dry runs, nothing touched, `cloudflared` kept its PID):
a healthy pass reads `本机 200（构建 …）；公网 200（经代理 …）；私网拨号 0 行`
and the assertion line, and exits 0; with the public URL pointed at a 404 and the incident's log lines as
`-TunnelLog`, the run named both reasons, quoted the three `ERR` lines and
printed the restart it would do; with the local URL pointed at a 404 it
reported 本机不健康 and planned nothing.

**Registering it** — `scripts/setup-tunnel-watchdog.ps1` prints the plan
without `-Apply`; run it from the main checkout, since the task's action
carries that path:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\setup-tunnel-watchdog.ps1          # plan only
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\setup-tunnel-watchdog.ps1 -Apply   # dry-run the watchdog, then register
```

S4U as the same user as the other tasks, `StartWhenAvailable`, not stopped
on battery, a 4-minute execution limit and `MultipleInstances = IgnoreNew`
(a hung run must not pile up behind the next), one `-Once` trigger with a
5-minute repetition that never ends. The action is `powershell.exe -File …`
with no `cmd` wrapper, so `Stop-ScheduledTask` ends the real process.
`OPS_ALERT_CHANNEL_ID` has to be in the main checkout's `.env.local` for the
alerts to go anywhere.

**Suggested, not done: let `cloudflared` write its own log.** The tunnel
task's action runs through `cmd /c … >> tunnel.log`, which is the only reason
`Stop-ScheduledTask` cannot stop it. `cloudflared` has `--logfile`:

```powershell
$a = New-ScheduledTaskAction -Execute "C:\Program Files (x86)\cloudflared\cloudflared.exe" `
  -Argument '--config C:\Users\Administrator\.cloudflared\config.yml --logfile C:\Users\Administrator\.cloudflared\tunnel.log tunnel run ai-tech-radar'
Set-ScheduledTask -TaskName "ai-tech-radar-tunnel" -Action $a
```

With that, the task's process is `cloudflared.exe` itself,
`Stop-ScheduledTask` stops it, and the watchdog's `Stop-Process` becomes a
fallback rather than the mechanism. Not applied here: changing the action
takes effect on the next start, which means restarting the tunnel, and that
is the owner's call (`CLAUDE.md` → "Parallel windows"). Check first whether
`--logfile` appends or truncates on start; the watchdog works with either
shape of the task.

**It restarted a healthy tunnel three times on its first evening** (2026-10-20
20:38–21:33). The proxy on 127.0.0.1:7890 stopped answering for an hour, every
public probe through it ended in 「基础连接已经关闭」 — no HTTP answer at all —
and the script counted that as 「公网非 200」, so at 20:53, 21:08 and 21:23 it
stopped and restarted `cloudflared`, each time cutting a tunnel that was fine
for about half a minute, and the 30-second re-check through the same dead
proxy said it was still down. Since that evening the public probe tells the two
cases apart: an HTTP answer from the edge (530, 502 …) means the tunnel, no
answer at all means this machine's network. On no answer it tries the other
route first — direct after the proxy, the proxy (`HTTPS_PROXY` / `HTTP_PROXY`)
after direct — and only when both are silent does it log 公网无响应, count it
in `unreachableRuns` and leave the tunnel alone. Every restart that does not
bring the domain back also doubles the wait before the next one (15, 30, 60,
then 120 minutes, `restartsInEpisode` in the state file), reset when the
domain answers 200 again. Both rules were dry-run against a closed port (both
routes silent → no restart planned) and against a local 404 (an answer → the
restart is planned).

### Proxy for every entry point

**Since 2026-09-25 the launcher probes the proxy first.** The proxy
(`127.0.0.1:7890`) runs only inside a logged-on desktop session, while the
server and tunnel tasks start at boot, so after an unattended reboot every
outbound request — DeepSeek calls, the daily import — went into a dead port
until someone logged in. `with-proxy-env.mjs` now opens one TCP connection to
the configured proxy (1.5s limit) before deciding: unreachable means
`NODE_USE_ENV_PROXY` is left unset and the log says
`[proxy] 代理 127.0.0.1:7890 不可达（ECONNREFUSED），本次直连。`. That
overrides even the explicit `NODE_USE_ENV_PROXY=1` the import task sets on
its command line — a dead proxy with the flag on fails every request in
milliseconds, which nobody wants — while an explicit `0` is never touched.
Direct connections reach `api.deepseek.com`, `github.com` and `hf-mirror.com`
from this machine (measured 2026-09-24), so "go direct" is a real fallback,
not a slower failure. Proven against a dead port both ways: with the probe,
`fetch(github.com)` answered `200` in about 400ms; without it, `ECONNREFUSED`
in 9ms. The decision is per launch, so a server started before the proxy
comes up stays direct until its next restart — which is the trade the boot
task needs.

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
- keeps the newest `BACKUP_KEEP` **days** that have a verified snapshot
  (default 14) — every snapshot taken on those days stays, verified or not,
  and everything older goes, including failed copies. Until 2026-10-21 it kept
  the newest 14 _snapshots_, so five manual `BACKUP_FORCE=1` copies on
  2026-10-12 pushed four real days out of the window (14 snapshots on disk
  covered 9 days). `scripts/backup-retention.mjs` holds the rule, with tests;
- takes **one verified snapshot per day** (since 2026-09-24): if a snapshot
  from today already has a manifest, the run logs it and exits 0.
  `BACKUP_FORCE=1` takes another one anyway. This exists because the task now
  also fires **3 minutes after logon** (`New-ScheduledTaskTrigger -AtLogOn`,
  `Delay = PT3M`, added 2026-09-24 alongside `WakeToRun`) — the machine was
  off at 07:45 on 09-23 (a fast-startup shutdown, at the time misread as
  sleep) and started into a fresh logon — and without the guard
  every logon would add a snapshot and push a real day out of the 14-slot
  window. Roll the trigger back with
  `Set-ScheduledTask "ai-tech-radar-backup" -Trigger (New-ScheduledTaskTrigger -Daily -At 07:45)`;
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

## Keeping the host on (2026-10-14)

**Decision (owner, 2026-10-14): while the site is public, this machine is not
shut down.** Lock the screen (Win+L) instead. A restart — Windows Update, a
driver — is fine: the server and tunnel tasks start at boot without anyone
logging on (the proxy does not; see "Proxy for every entry point"). A shutdown
takes the site down until someone presses the power button.

### What the power log says

Until the 2026-10-14 review this document said the host _slept_ at night and
that `WakeToRun` would bring it back for the 07:45 backup. Both were wrong.
Re-measured on 2026-10-15:

| Event                                                | Since go-live (09-20)                        | Meaning                                                                 |
| ---------------------------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------- |
| Kernel-Power 42, `TargetState=6`, `EffectiveState=5` | 11 of 11                                     | shutdown with fast startup                                              |
| Kernel-Power 42, `TargetState=4`                     | 0                                            | it never went to sleep                                                  |
| User32 1074 (who asked for it)                       | 4, all `RuntimeBroker.exe` for Administrator | the Start menu's power button; the other 7 shutdowns have no 1074 entry |
| Kernel-Power 41, `BugcheckCode=0`                    | 5 (09-21, 09-25, 09-29, 10-01, 10-13)        | power lost, or a reset, without a crash or a clean shutdown             |

Across the whole System log, back to 2025-07-23, 192 of 193 sleep-or-shutdown
entries are the same fast-startup shutdown. A wake timer cannot start a
machine that is off, so `WakeToRun` has never done anything. The review
measured the cost: since 09-20 the site was offline about a third of the time,
and from 10-03 to 10-07 for 4.6 days in one stretch. Who started the 7
shutdowns without a 1074 entry is not known.

`TargetState` and `EffectiveState` use Windows' power-state numbers: `4` sleep
(S3), `5` hibernate, `6` shutdown. A `6` entered as `5` is fast startup, which
writes the kernel to the hibernation file on the way down.

### What to set (the owner's choice)

1. **Do not shut down** while the site is public. If the machine has to go
   off, expect the site to be offline until it is back, and the external check
   below to say so.
2. **No sleep or hibernation on AC power.** On 2026-10-15 both timeouts were
   already 0 (never) on the active plan, so this is about keeping it that way.
3. **Watch the power plan.** The active plan on 2026-10-15 was "Razer Cortex
   Power Plan". Razer Cortex and similar game boosters switch plans when they
   start and stop, and a timeout set on one plan does not carry over to
   another — set it on every plan (below), or check again after Cortex has run.
4. **Power loss has no software fix.** A UPS is the hardware answer. Many
   desktop firmwares also offer "Restore on AC power loss → Power On", which
   brings the machine back by itself when the power returns; the boot tasks
   then bring the site back without a logon.

Fast startup itself is not the cause and does not need to be turned off: a
shutdown is an outage either way.

**Checking — read-only, safe to run at any time:**

```powershell
powercfg /a                 # sleep states this machine supports; lists fast startup when it is on
powercfg /getactivescheme   # the plan in force right now
powercfg /query SCHEME_CURRENT SUB_SLEEP STANDBYIDLE    # AC index 0x00000000 = never sleep
powercfg /query SCHEME_CURRENT SUB_SLEEP HIBERNATEIDLE  # AC index 0x00000000 = never hibernate
powercfg /lastwake          # what woke it last

# shutdowns and sleeps of the last 30 days, with the state Windows entered
Get-WinEvent -FilterHashtable @{ LogName = 'System'; ProviderName = 'Microsoft-Windows-Kernel-Power'; Id = 42; StartTime = (Get-Date).AddDays(-30) } |
  ForEach-Object {
    $d = ([xml]$_.ToXml()).Event.EventData.Data
    [pscustomobject]@{
      Time      = $_.TimeCreated
      Target    = ($d | Where-Object Name -eq 'TargetState').'#text'
      Effective = ($d | Where-Object Name -eq 'EffectiveState').'#text'
    }
  }

# power lost, or a reset, without a clean shutdown
Get-WinEvent -FilterHashtable @{ LogName = 'System'; ProviderName = 'Microsoft-Windows-Kernel-Power'; Id = 41; StartTime = (Get-Date).AddDays(-30) } |
  Select-Object TimeCreated

# which process asked for a shutdown or restart
Get-WinEvent -FilterHashtable @{ LogName = 'System'; Id = 1074; StartTime = (Get-Date).AddDays(-30) } |
  Select-Object TimeCreated, Message
```

On a Chinese-language Windows the `powercfg /query` line reads
`当前交流电源设置索引`. When nothing matches, `Get-WinEvent` prints an error
rather than an empty list — for event 41 that is the good outcome.

**Changing it — these change system power settings; nothing in this
repository runs them, and whether to is the owner's decision:**

```powershell
# never sleep or hibernate on AC power, active plan only
powercfg /change standby-timeout-ac 0
powercfg /change hibernate-timeout-ac 0

# the same on every plan, so a plan switch cannot undo it
powercfg /list | Select-String '([0-9a-fA-F-]{36})' | ForEach-Object {
  $guid = $_.Matches[0].Groups[1].Value
  powercfg /setacvalueindex $guid SUB_SLEEP STANDBYIDLE 0
  powercfg /setacvalueindex $guid SUB_SLEEP HIBERNATEIDLE 0
}
powercfg /setactive SCHEME_CURRENT   # re-apply the active plan so the change takes effect now
```

## Health endpoint and uptime alerts (2026-09-25)

The site was down for about 28 of its first 90 hours (the host shut down
overnight — see "Keeping the host on") and nobody knew until logs were read
days later; a stalled model download logged nothing at all. Two pieces close
that:

**`GET /api/health`** (public, no token, `Cache-Control: no-store`) answers
`200` with `{ status: "ok" }` when every store the home page reads does
read, `503` with `"degraded"` when one does not — the state in which the
site serves errors. Since 2026-10-21 `checks.store` covers the published
signals, the news lane (the candidate snapshot: the largest store, and the
one every import rewrites), the latest published digest, and the skill and
knowledge pools — `{ ok, publishedSignals, newsItems, latestDigest, skills,
knowledge }`, or `{ ok: false, failed: ["news"] }` naming the read that
threw, never a path. Until then it read the signals alone, so a damaged
candidate or digest file would have 500ed the home page while the check
stayed green. The reads are the pages' own memoized ones, so the check costs
nothing extra. The body also carries the running `build` id, `uptimeSeconds`
and the semantic search state:
`search.model` is `idle` / `loading` / `ready` / `failed` from the load gate
in `src/lib/model-load-gate.ts`, `search.corpus` whether the passage vectors
for the current documents exist. A `failed` model does **not** flip the
status: the site keeps answering from keywords, and the reason is in the
server log as `[embeddings] model load failed (…)`. It reports nothing a
reader could not infer from the site — no paths, no env, no provider.

**The model load now has a deadline.** `EMBEDDING_LOAD_TIMEOUT_MS` (default 120000) bounds one load attempt; past it the attempt is logged with its
reason, the state goes `failed`, and the next search starts a fresh attempt
instead of waiting on a hung download forever. Proven with a 1ms timeout
(warned and failed at once) and with the cached model (ready in under a
second). A late failure of an abandoned load never surfaces as an unhandled
rejection.

### External check (in the owner's account)

**Recommended: a hosted monitor.** UptimeRobot, or any service with a free
tier (Better Stack, Cronitor, …):

| Setting  | Value                                                                                             |
| -------- | ------------------------------------------------------------------------------------------------- |
| Type     | HTTP(s) with a keyword check (UptimeRobot calls it "Keyword")                                     |
| URL      | `https://aizyradar.cn/api/health`                                                                 |
| Keyword  | `"status":"ok"` — alert when it is **missing**                                                    |
| Interval | 5 minutes                                                                                         |
| Alert    | after 2 consecutive failures; where a service expresses this as a delay instead, about 10 minutes |
| Contact  | the owner's email or app                                                                          |

This is configured in the owner's account; nothing in this repository creates
or changes it, and the setting names differ between services. When it is set
up, record the date and the service here.

Two consecutive failures is deliberate: the few seconds of a deploy swap are
not an outage. `/api/health` is excluded from the offline Worker (next
section), so the monitor always sees the edge's real `530` or `502`, never the
offline page.

**Without a third-party account: a GitHub Actions schedule.** The workflow
below is an example only. It is **not** committed under `.github/workflows/`,
because a workflow there starts running as soon as it is pushed; copy it to
`.github/workflows/uptime.yml` when you decide to use it.

```yaml
name: uptime
on:
  schedule:
    - cron: "*/5 * * * *" # private repository: "*/30 * * * *", see below
  workflow_dispatch:
permissions: {}
jobs:
  health:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - name: /api/health answers ok (two tries, a minute apart)
        run: |
          for attempt in 1 2; do
            if curl -fsS --max-time 30 https://aizyradar.cn/api/health | grep -q '"status":"ok"'; then
              echo "ok on attempt $attempt"
              exit 0
            fi
            if [ "$attempt" = 1 ]; then sleep 60; fi
          done
          echo "::error::https://aizyradar.cn/api/health failed twice, a minute apart"
          exit 1
```

What to know before choosing it:

- **Who gets the email.** GitHub sends a scheduled workflow's failures to the
  user who created the workflow file or last changed its `cron` line — in this
  one-person repository, the owner — according to that user's Actions
  notification setting (Settings → Notifications → Actions; check that failed
  runs send email). Every failed run is one email, so a long outage sends one
  every five minutes.
- **It is best-effort.** Scheduled runs start late when GitHub is busy — often
  by minutes, sometimes by much more — and some can be dropped. Treat it as a
  coarse check, not a five-minute guarantee.
- **Public repository: 60 days.** GitHub disables scheduled workflows in a
  public repository after 60 days without repository activity; re-enable it
  from the Actions tab.
- **Private repository: minutes.** Each run is billed as at least one minute,
  so every 5 minutes comes to about 8,640 minutes a month against the 2,000
  included in GitHub Free. Run it every 30 minutes (about 1,440) while the
  repository is private; standard runners for a public repository are free.
  As of 2026-10-15 the repository is not on GitHub yet (`docs/next-task.md` →
  「卡在 owner 的事」).
- Like most hosted monitors, it checks from outside mainland China: it answers
  "is the site up", not "is it fast for readers here".

**What this still does not cover**: a wrong `200` — the page renders but its
data is stale or wrong. When the machine is off, the tunnel has no connector
and the edge answers `530` (Cloudflare error 1033); when the machine is up but
the server is not, `cloudflared` answers `502`. The monitor sees both, so the
outages of 09-21 to 09-23 would have alerted.

## What readers see when the site is offline (2026-10-14)

Without anything in front of the tunnel, a reader who arrives while this
machine is off gets Cloudflare's own error page — `530`, error 1033, in
English, about Cloudflare Tunnel — and one who arrives while the server is
down behind a running tunnel gets a bare `502`.
`ops/cloudflare/offline-worker.js` is a Cloudflare Worker that replaces those
with a short page in the site's own voice: Chinese first, one line of English,
saying the site is temporarily offline and that feed readers will retry by
themselves.

What it does — about 90 lines, no dependencies, no bindings:

- forwards every request to the origin unchanged and returns its answer;
- for a `GET` outside `/api/` whose answer is `502`, `503`, `504` or
  `520`–`530`, or that could not be fetched at all, returns the offline page
  instead: status `503`, `Retry-After: 300`, `Cache-Control: no-store`,
  `X-Robots-Tag: noindex` and `X-Site-Offline: 1`;
- never replaces anything on `/api/*` or a non-`GET` request — those get the
  origin's own error, so `/api/health` stays an honest signal for the external
  check;
- calls `passThroughOnException()`, so a bug in the script sends traffic
  straight to the origin instead of breaking the site.

Everything else passes through untouched, including the tunnel's `404` for the
five denied prefixes. Checked on 2026-10-15 against a stubbed `fetch` in Node:
14 cases — `200`, `404`, `500` and `531` passed through, `502` / `520` / `530`
and a failed fetch replaced, `/api/health`, `/api`, `POST` and `HEAD` never
replaced. It has not run on Cloudflare yet.

### Setting it up (Cloudflare dashboard, free plan)

1. **Workers & Pages → Create → Worker**, start from "Hello World", name it
   (for example `radar-offline`) and deploy. Then **Edit code**, replace
   everything with the contents of `ops/cloudflare/offline-worker.js`, and
   deploy again.
2. In the Worker's **Settings → Domains & Routes**, turn off its
   `*.workers.dev` address; it has no use here.
3. Zone `aizyradar.cn` → **Workers Routes → Add route** (or the Worker's
   Domains & Routes → Add → Route): route `aizyradar.cn/*`, Worker
   `radar-offline`. If it asks what to do once the request limit is reached,
   choose **fail open**, so that past the daily quota requests skip the Worker
   and reach the origin exactly as they do today.
4. **Add a second route, `aizyradar.cn/api/*`, with the Worker set to None.**
   Cloudflare uses the most specific matching route, so no `/api/*` request
   runs the Worker at all: the health check, the four AI routes and their
   per-client rate limit, and the push subscription routes keep exactly the
   path they use today. The script's own `/api/` check is the second lock.
5. Optional, to save quota: a third route, `aizyradar.cn/_next/static/*`, with
   the Worker set to None. Those files are fingerprinted and mostly served
   from Cloudflare's cache anyway.

**Quota.** Workers Free allows 100,000 requests a day (reset at 00:00 UTC) and
10 ms of CPU per request. Waiting for the origin is not CPU time, and this
script uses a fraction of a millisecond. Every request on the `aizyradar.cn/*`
route counts — pages, feeds, static files — and requests on the None routes do
not. The Worker's **Metrics** tab shows the daily count.

**Verify** after adding the routes, with the site up:

```bash
curl -sI https://aizyradar.cn/            # 200, and no x-site-offline header
curl -sI https://aizyradar.cn/workspace   # 404: the tunnel's deny rule, passed through
curl -s  https://aizyradar.cn/api/health  # contains "status":"ok"
```

The offline page itself only appears while the origin is unreachable, so the
next planned outage — a restart for Windows Update, say — is the time to look:
`curl -sI https://aizyradar.cn/` should then show `503` with
`x-site-offline: 1`, and `curl -sI https://aizyradar.cn/api/health` the raw
`530` or `502`.

**Remove it** by deleting the routes (Workers Routes, or the Worker's Domains
& Routes); within seconds every request goes straight to the origin again.
Then delete the Worker if it is no longer wanted. Nothing on this machine or in
the app depends on it.

**Saved pages in the installed app are not served during an outage**, with or
without this Worker. The service worker's `networkFirstPage`
(`src/lib/pwa-service-worker.ts`) falls back to its saved copies only when a
request fails outright, and an outage of this site is an answered request —
`530` without the Worker, this page's `503` with it. The copies work when the
reader's own device is offline. Using them during a site outage as well would
be a change to that function (treat `502`–`504` / `520`–`530`, or
`X-Site-Offline: 1`, as a failure) and is not part of this setup.

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
