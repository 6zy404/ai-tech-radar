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

> **In-repo follow-up landed 2026-07-22** (same session as this report): the
> parts of the checklist that are code/config changes rather than operator/ops
> actions were applied — **I3** (production CSP + HSTS added and verified),
> **I4** (Node `engines` pinned to `>=22.5.0`), and the **git-tracking half of
> B2** (the runtime/secret/cache stores `config/delivery.json`,
> `workflow-events.json`, `task-runner.json`, and the three
> `technology-*.json` LLM caches are now git-ignored, so a real delivery
> endpoint/token can no longer be committed). The remaining items are operator
> actions at deploy time (B1 token, B4 site URL) or an ops decision (I2 backups);
> they stay open by design and are marked ✓ Addressed inline below where code
> landed. I1 (public LLM route rate limiting) landed as code on 2026-07-27.

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
  unconfigured (`src/middleware.ts:43` → `503`), the token compare is
  constant-time (`safeEqual`, `workspace-access.ts:40`), and Bearer / Basic /
  `x-workspace-access-token` are all accepted. The mechanism is sound; the
  default is the risk.
- ⚠️ **The mechanism was sound and still never ran** (found 2026-07-27, fixed
  the same day). This assessment was written from the source, which was
  correct — but the file lived at the repository root, and a project with its
  App Router under `src/` only loads `src/middleware.ts`. Next ignores the
  root copy **silently**: no error, no warning, just an empty
  `"middleware": {}` in `.next/server/middleware-manifest.json`. A go-live
  drill with `WORKSPACE_ACCESS_ENABLED=true` and a token configured returned
  `200` on `/workspace`. Moving the file to `src/middleware.ts` fixed it;
  `validate:deployment` now asserts the location, and re-running that
  assertion against the old path reproduces the failure. **Lesson for every
  future security claim in this document: reading the code is not evidence.**
- Verified live 2026-07-27 against a real `next start` production build:
  `/workspace` and every internal prefix return `401` without a token and
  `200` with it (header, Bearer, and Basic password forms all accepted);
  `/api/workspace/*` returns the `401` as JSON; enabled-but-unconfigured
  returns `503`; public routes, the public AI route, the weekly review, and
  the per-topic feed are unaffected.
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
- ✓ Addressed (git-tracking half, 2026-07-22): `config/delivery.json` plus the
  runtime/cache stores `workflow-events.json`, `task-runner.json`, and the
  three `technology-*.json` LLM caches are now git-ignored and untracked
  (still written locally). Content/config/editorial-state stores stay tracked
  because they seed a deploy. Fully externalizing live data via
  `LOCAL_DATA_DIR` remains the production pattern (operator choice).

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
- ✓ Addressed (2026-07-27): the live stores were purged. Confirmed first that
  the fixture digest `2026-05-23` ("Delivery integration validation") was
  genuinely reachable on `/digest`, `/feed.xml`, `/feed.json`, and its own
  page — the sanitizer hid the wording, not the record. Removed: 3 May
  validation digests (one of them **published**), the 2 disabled
  `quality-*-source` fake sources and their 2 imported candidates + review
  state, the 2 leftover validation technology drafts
  (`editorial-enrichment-draft`, `draft-candidate-source-quality-failing-…`),
  and 3 "Validation …" delivery channels plus the orphaned delivery run.
  Safe to delete because both validators that use these fixtures
  (`validate:quality`, `validate:editorial-enrichment`) build them fresh and
  back up/restore the real stores in a `finally` — the on-disk copies were
  leftovers from before that discipline. `validate:persistence` caught one
  reference this pass missed (a `DeliveryRun` still pointing at the deleted
  digest), which is exactly what it exists for. Re-verified: the removed
  digest now 404s, no fixture strings on any public or workspace surface, and
  16 `validate:*` scripts pass. `validate:database` fails, but **pre-existing
  and unrelated** — the SQLite driver seeds only `src/data` statics, so a
  signal linked to a workspace-created skill/knowledge entry has no matching
  row in sqlite mode (confirmed failing at the pre-cleanup commit).

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
- ✓ Addressed (2026-07-27): all three routes now run a per-client sliding-window
  limiter before any parsing, cache lookup, or provider call
  (`src/lib/rate-limit.ts` + `src/lib/public-ai-rate-limit.ts`), returning `429`
  with `Retry-After` when the budget is spent. Defaults are 10 requests/minute
  and 40/hour per client **per route**, overridable with
  `PUBLIC_AI_RATE_LIMIT_PER_MINUTE` / `PUBLIC_AI_RATE_LIMIT_PER_HOUR`. Two
  honest limits of this implementation: it is in-memory and per-process (a
  multi-instance deploy multiplies the effective budget), and the client key
  comes from `x-forwarded-for` / `x-real-ip`, which a determined caller can
  rotate — with no proxy in front, every caller shares one bucket, which still
  caps total provider calls. It is a cost guardrail, not bot protection; a
  reverse-proxy or platform limit is still the right layer for the latter.

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
- ✓ Addressed (2026-07-22): `next.config.ts` now emits, **in production builds
  only** (dev keeps the baseline so HMR/React Refresh still work), a
  `default-src 'self'` CSP (with `'unsafe-inline'` for Next's own inline
  bootstrap/hydration scripts and React inline-style attributes) plus
  `Strict-Transport-Security: max-age=63072000; includeSubDomains`. Verified
  against a real `next start`: headers present, and a client-interactive page
  hydrates, reads/writes localStorage, and toggles state with zero CSP
  violations. Nonce-based `script-src` (dropping `'unsafe-inline'`) is the
  stricter follow-up.

### I4. Node runtime not pinned

`package.json` declares no `engines`. The optional SQLite driver uses Node's
built-in `node:sqlite` (`src/lib/repositories/sqlite-store.ts`), which requires
Node ≥ 22.5. A deploy on an older Node silently breaks SQLite mode.

- Action: pin `engines.node` (e.g. `>=22.5`) and pin the deploy runtime, or
  stay on the JSON driver and document the Node floor.
- ✓ Addressed (2026-07-22): `package.json` now declares
  `"engines": { "node": ">=22.5.0" }`. Pin the deploy runtime to match.

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
   verify `/workspace` is `401` without it (B1). Verify it by **requesting the
   route**, not by reading the middleware — that is how the inert-guard bug
   above went unnoticed. Full step-by-step server setup:
   `docs/deployment.md` → "Go-live runbook".
2. Move live data out of git or `.gitignore` the live stores; keep only seed
   fixtures tracked (B2).
3. ~~Reset/purge demo & validation fixtures from the live stores (B3).~~ Done
   2026-07-27 — see B3.
4. Set `NEXT_PUBLIC_SITE_URL` to the real HTTPS origin; check `/feed.xml` (B4).
5. ~~Keep `LLM_PROVIDER=mock`, or add a rate limiter before any real key
   (I1).~~ Done 2026-07-27 — the routes are limited by default; before
   configuring a real key, review the per-minute/per-hour budgets for the
   expected traffic (see I1).
6. Put the app behind HTTPS; add HSTS + a `default-src 'self'` CSP (I3).
7. Pin the Node runtime (≥ 22.5 if using SQLite) (I4).
8. Set up a daily backup of `LOCAL_DATA_DIR` / the `.sqlite` file (I2).
9. `npm run build` + smoke-test the public routes and a token-gated workspace
   route before opening traffic.
