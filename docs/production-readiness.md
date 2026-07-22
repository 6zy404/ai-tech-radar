# Production Readiness Assessment

> Read-only assessment produced 2026-07-22. Scope target chosen by the owner:
> **a controlled single-operator go-live** — deploy the public read-only site
> to a real domain, lock the Internal Workspace behind the token guard, and
> keep the local JSON (or single-file SQLite) store with one operator. This is
> the smallest target that matches the current architecture; multi-user
> accounts, RBAC, a production database, and distributed cron stay out of scope
> (see `AGENTS.md` → "What is intentionally NOT implemented yet").
>
> This document is a **gap report**, not a how-to. The step-by-step deploy
> mechanics live in [`docs/deployment.md`](deployment.md); the trust boundary
> lives in [`docs/security-boundary.md`](security-boundary.md). Where those
> already list a known limitation, this report says whether it actually blocks
> _this_ target and what the operator must do about it.

## Verdict

The prototype is **close to a controlled go-live and the production build
passes** (`npm run build` succeeds; all routes compile, including the two
shipped 2026-07-22). It is **not safe to expose as-is** until the four blocking
items below are handled — all four are configuration/data hygiene, not missing
code. None of them require new features for this target.

| Severity                        | Count | Nature                           |
| ------------------------------- | ----- | -------------------------------- |
| Blocking (fix before exposing)  | 4     | config + data hygiene            |
| Important (should fix / decide) | 4     | hardening + durability           |
| Out of scope for this target    | —     | accounts, RBAC, prod DB, scaling |

## Blocking gaps — must be handled before the app is reachable

### B1. Workspace protection is OFF by default (fail-open)

`isWorkspaceAccessEnabled` returns `false` unless `WORKSPACE_ACCESS_ENABLED` is
explicitly `true`/`1`/`yes` (`src/lib/workspace-access.ts:18`), and
`.env.example` ships `WORKSPACE_ACCESS_ENABLED=false`. If the operator deploys
without flipping it, **the entire Internal Workspace and every mutation API
(`/workspace/*`, `/api/workspace/*`, `/api/candidates/*`, and the legacy
redirects) is publicly reachable** — anyone could import, edit, publish,
delete, or send deliveries.

- Action: set `WORKSPACE_ACCESS_ENABLED=true` and a strong random
  `WORKSPACE_ACCESS_TOKEN` (32+ bytes) in the deployment environment, then
  verify a request to `/workspace` without the token returns `401` and with it
  returns `200`.
- Good news, once enabled: the guard fails **closed** when enabled but
  unconfigured (`middleware.ts:43` → `503`), the token compare is
  constant-time (`safeEqual`, `workspace-access.ts:40`), and Bearer / Basic /
  `x-workspace-access-token` are all accepted. The mechanism is sound; the
  default is the risk.
- Residual: this is a single shared token, not per-user auth or session
  management — acceptable for one operator, but rotate it if it leaks and
  always terminate TLS in front of it (the token travels in a header).

### B2. Runtime/config stores are committed to git — latent secret leak

All 18 `config/*.json` stores are git-tracked (`git ls-files config/`),
including `config/delivery.json`. Today they hold only mock endpoints
(`mock://success` / `mock://failed`), so **nothing sensitive is leaked yet** —
but the moment a real webhook endpoint, Feishu bot URL, or token is configured
through the workspace, it is written into `config/delivery.json` and will be
committed on the next `git add -A`. The same applies to a real `LLM_API_KEY`
only via env (that one is correctly kept out of the stores).

- Action: before configuring any real delivery channel, stop tracking the
  live stores — either move production data to a `LOCAL_DATA_DIR` outside the
  repo, or `git rm --cached config/delivery.json` (and the other live stores)
  and add them to `.gitignore`, keeping only seed/demo fixtures tracked.
- `.env.example` already documents the intent ("Real endpoints … should not be
  committed"), and `docs/security-boundary.md` → "Delivery Secrets" calls for a
  secret store; this gap is that guidance not yet being enforced by
  `.gitignore`.

### B3. Committed stores contain demo/validation fixtures that would ship as real content

The tracked stores carry seeded validation data: `config/delivery.json` has
"Validation success/failed/disabled webhook" channels and a May delivery run;
digest/candidate stores carry May validation fixtures. On the public side the
digest copy sanitizer (`src/lib/public-copy.ts`) rewrites validation-flavored
titles, but the **news fast lane and candidate-derived surfaces render imported
candidate data directly**, so stale demo candidates could appear publicly, and
the workspace would present fake delivery channels as if real.

- Action: reset the live stores to a clean state before go-live (purge demo
  channels/runs, validation digests, and stale candidates), or point
  `LOCAL_DATA_DIR` at a fresh directory and re-import real sources.

### B4. `NEXT_PUBLIC_SITE_URL` must be set to the real origin

Feed and digest links are built from `NEXT_PUBLIC_SITE_URL`, which defaults to
`http://localhost:3000` (`.env.example`). Evidence it propagates: the committed
delivery payload preview embeds `http://localhost:3000/digest/2026-05-23` and
`…/technologies/…` URLs. Left unset, `/feed.xml`, `/feed.json`, the per-topic
feeds, and digest share text all emit localhost links to the public.

- Action: set `NEXT_PUBLIC_SITE_URL=https://<real-domain>` at build/runtime and
  spot-check `/feed.xml` after deploy.

## Important — should fix or make an explicit decision

### I1. Public LLM routes are unprotected and unthrottled

`POST /api/technologies/{compare,explain,learning-path}` are intentionally
outside the middleware matcher (they only operate on already-published
content). With the default `LLM_PROVIDER=mock` there is **no external cost or
key**, so for a go-live that keeps the mock provider this is not a real
exposure. The moment a real `LLM_API_KEY` is configured, these become a
public, uncapped cost/abuse vector — the only bound is the per-key result cache
(`docs/security-boundary.md` → "Public LLM Feature Boundary").

- Decision for this target: keep the mock provider for go-live (recommended),
  **or** add basic rate limiting / a reverse-proxy limit before configuring a
  real provider. Do not ship a real key without a limiter.

### I2. Persistence durability: no locking, no backup, concurrent writers

The default JSON store has no multi-writer locking (`AGENTS.md`,
`docs/security-boundary.md`), and `CLAUDE.md` documents real "index corruption
on large writes" observed in this repo. In production the scheduled task runner
(daily 08:00 import + digest draft) writes to the same stores the operator may
be editing through the UI — two concurrent writers to unlocked JSON.

- Action: (a) add a backup of `LOCAL_DATA_DIR` (or the `.sqlite` file) —
  even a daily copy; (b) prefer the single-file SQLite driver
  (`PERSISTENCE_DRIVER=sqlite`), which at least wraps each store write in a
  transaction; (c) avoid editing in the workspace at the same minute the task
  runner fires. Cross-store transactions remain unimplemented (documented,
  acceptable at this scale).

### I3. Missing transport-security headers (CSP, HSTS)

`next.config.ts` sets a good baseline (`X-Content-Type-Options: nosniff`,
`X-Frame-Options: SAMEORIGIN`, `Referrer-Policy`, `Permissions-Policy`) but no
`Content-Security-Policy` and no `Strict-Transport-Security`.

- Action: add HSTS once served over HTTPS, and a CSP scoped to the app's own
  origin (the public pages load no third-party scripts, so a fairly strict
  `default-src 'self'` with the needed `style-src` is feasible). Low effort,
  meaningfully raises the floor.

### I4. Node runtime not pinned

`package.json` declares no `engines`. The optional SQLite driver uses Node's
built-in `node:sqlite` (`src/lib/repositories/sqlite-store.ts`), which requires
Node ≥ 22.5. A deploy on an older Node silently breaks SQLite mode.

- Action: pin `engines.node` (e.g. `>=22.5`) and pin the deploy runtime, or
  stay on the JSON driver and document the Node floor.

## Operational readiness (single operator)

- **TLS**: terminate HTTPS in front of the app (reverse proxy); the workspace
  token and Basic-auth password travel in headers.
- **Scheduling**: the task runner is the "cron" — Windows Task Scheduler setup
  is already documented in `docs/deployment.md`. Keep one runner per data
  directory (`CLAUDE.md`).
- **Logs**: `config/task-runner-cron.log` is git-ignored and runner messages
  sanitize endpoint/token-like values (`docs/security-boundary.md`) — good.
- **Backups**: see I2 — the one operational must-add.

## What already holds up (confirmed, not just claimed)

- `npm run build` passes cleanly; every route compiles.
- Workspace guard fails **closed** when enabled-but-unconfigured (`503`), uses
  a constant-time token compare, and covers all internal path prefixes incl.
  legacy redirects (`middleware.ts`, `workspace-access.ts`).
- Public/internal field isolation is enforced at explicit mapping seams
  (`toUserFacingTechnologyItem`, `toPublicDigestView`, `src/lib/news.ts`, the
  `toPublic*Result` LLM strips) and guarded by `validate:*` scripts; public
  `TechnologyItem`s carry no ranking object.
- Secrets are read server-side only; `LLM_API_KEY` never reaches client
  components; the provider defaults to `mock`.
- `.env.example` is complete and annotated for every variable.
- Baseline security headers are present; feeds/pages derive from
  published-only data.

## Explicitly out of scope for this target

Per `AGENTS.md`, deferred and **not** required for a controlled single-operator
go-live: user accounts / login / RBAC, production database integration and
migrations, multi-writer locking and cross-store transactions, distributed
scheduling, a secret vault, per-user audit history, and public-scale rate
limiting / bot protection. Revisit these only when the target changes to a
public-scale or multi-user deployment.

## Go-live checklist (ordered)

1. Set `WORKSPACE_ACCESS_ENABLED=true` + a strong `WORKSPACE_ACCESS_TOKEN`;
   verify `/workspace` is `401` without it (B1).
2. Move live data out of git or `.gitignore` the live stores; keep only seed
   fixtures tracked (B2).
3. Reset/purge demo & validation fixtures from the live stores (B3).
4. Set `NEXT_PUBLIC_SITE_URL` to the real HTTPS origin; check `/feed.xml` (B4).
5. Keep `LLM_PROVIDER=mock`, or add a rate limiter before any real key (I1).
6. Put the app behind HTTPS; add HSTS + a `default-src 'self'` CSP (I3).
7. Pin the Node runtime (≥ 22.5 if using SQLite) (I4).
8. Set up a daily backup of `LOCAL_DATA_DIR` / the `.sqlite` file (I2).
9. `npm run build` + smoke-test the public routes and a token-gated workspace
   route before opening traffic.
