# Roadmap

This is the durable, high-level plan for the project: what it is, what is built,
and what comes next. It complements `docs/reference.md` (what exists today) and
`docs/next-task.md` (current status and the open backlog). Keep it in the repo
so direction survives even if chat history is lost.

## Product identity

A discovery-and-understanding platform for developers tracking new AI
technologies. The core is a chain, not a content store:

> discover → understand → connect → keep tracking

It must not drift into a tech wiki, a news portal, or a generic admin panel.
Two subsystems stay separate: the **Internal Workspace** (editorial/operations)
and the **User-facing Product** (public reading/discovery).

## What is built

1. **Business pipeline / CMS (mostly complete, Workspace-side)**
   sources → import → candidates → duplicate review → draft → publish → daily
   digest → delivery, plus ranking, publish quality gate, content enrichment
   (optional LLM behind a server boundary), local scheduling/task runner,
   operations dashboard, JSON/SQLite persistence, and the deployment/security
   boundary.
2. **Two-subsystem visual split** — Workspace console style vs. user-facing
   reading style, with separate shells and navigation.
3. **User-facing product polish**
   - Chinese-first across UI chrome and content data (technologies, skills,
     knowledge, tags, digest).
   - Navigation localized + grouped + mobile hamburger menu.
   - Accessibility: focus ring, reduced-motion, AA-safe label contrast.
   - Design system tokenized: font family (Inter + system Chinese), size scale,
     spacing scale, merged colour tokens — change one token, the whole site
     updates.
   - "Solid / higher-contrast" visual pass (solid white cards, firmer
     border/shadow, cleaner hero panels); home information hierarchy.
4. **Knowledge relationship network (P2, complete)**
   - `relatedTechnologyIds` on `TechnologyItem`, a navigable "相关技术" section
     on the technology detail page.
   - Relations are semantic: each link carries a relation type (supports /
     builds-on / uses / …) and a short Chinese explanation.
   - A shared `RelationshipGraph` component renders a small, walkable
     visualization on the technology, skill, and knowledge detail pages: the
     current node sits at the centre with its neighbouring technologies, skills,
     and background knowledge as clickable, colour-coded spokes.
   - A shared `RelationDensity` line ("关联 · N 技术 · N 技能 …") appears on all
     three index cards (technology, skill, knowledge).
   - Every relation in the content graph — not just technology-anchored ones —
     now carries an explicit type and Chinese explanation, surfaced as a pill on
     related-card lists and a tooltip on graph nodes.
   - `/network` renders the entire graph (every published technology, skill,
     and knowledge node, every relation edge) in one view, with click-to-focus
     exploration of any node's direct connections.
5. **AI-assisted understanding (P3, agreed scope complete — Compare v0 + Explain v1 + Learning Path v2)**
   - A reader on `/technologies/[slug]` can request a live AI-generated
     comparison against another published technology; results are cached per
     technology pair and always shown with a persistent, unmissable
     "AI-generated, not reviewed" disclaimer.
   - The same reader can also pick their experience level (入门 / 进阶 /
     资深) and request a live AI-generated explanation of the current
     technology tailored to that level (`POST /api/technologies/explain`),
     cached per technology × level, with the same disclaimer discipline.
   - The same reader can also request a graph-grounded learning path
     (`POST /api/technologies/learning-path`): the prompt feeds the
     technology's actual related knowledge and skills from the content graph
     and builds ordered steps on them, cached per technology.
   - All three are public, unprotected routes that call the LLM provider
     directly, each with a dedicated public-mapping function stripping all
     provider/model/prompt metadata before the response leaves the server.
   - This completes the agreed P3 candidate list (Compare → Explain →
     learning path); further P3 ideas are new scope.
6. **Personalization (P4, agreed scope complete)** — followed topics (v0),
   follow entry points on detail pages (v0.1), a personalized digest view
   (v0.2), per-topic RSS feeds plus follow export/import (v0.3), and read /
   read-later marks with a 稍后读 view (v0.4). All of it is browser-local:
   no accounts, no server-side profile, the served page identical for
   everyone.
7. **Public discovery surfaces** — site-wide `/search`, the `/digest` archive,
   the `/digest/weekly` review, topic hubs at `/topics/[tagId]` with per-topic
   feeds, and the nav simplification that folded `/news`, `/timeline` and
   `/radar` into `?view=` tabs on `/technologies`.
8. **Editorial machinery** — the `/workspace/editorial-round` console, typed
   relation editing (LinkRelation v1), skill/knowledge workspace editing with
   copy-on-write over the seeds, technology↔technology relations and the
   `supersedes` version line, importance-based ranking bands with fresh-first
   digest selection, and the scheduled digest draft.
9. **Operational hardening** — a verified backup of the state directory, one
   network path shared by the workspace and the scheduled task, the S4U task
   principal that stopped console-killed runs, source import retry, and
   `measure:news-lane` for what the public fast lane is currently showing.
10. **The dossier design direction, everywhere** — every page of the
    User-facing Product, plus dark mode. The Internal Workspace deliberately
    keeps its own console look.
11. **The AI application track (2026-09-23)** — advisory LLM triage on the
    editorial-round console, measured against 479 real editorial decisions;
    hybrid search (`/search`, keyword + a local embedding model, no API);
    and 问雷达 (`/ask`), a grounded question box whose citations are numbered
    by the code so an invalid one is detectable. Each shipped with its own
    labelled eval set under `eval/`.
12. **Live, and hardened after going live** — `aizyradar.cn` through a
    Cloudflare Tunnel since 2026-09-20, serving the public-only build. The
    2026-09-24 whole-project review then fixed what only production shows:
    a spoofable rate-limit key, non-atomic store writes, validators writing
    into the live data directory, the eight demo seed signals still public,
    a model download that hung silently, a proxy that died on reboot, and
    added per-page metadata, a sitemap, a Chinese 404 and `GET /api/health`.

## Content

The pipeline is no longer the constraint; the content is the product. As of
2026-09-26 (measured through the public getters): **81 published technology
signals**, **16 skills**, **19 knowledge entries**, **30 published digests**,
**13 enabled sources**; the content graph has 116 nodes and 802 typed edges.
The skill/knowledge pool went from 16 full entries and 16 one-sentence seed
stubs to **35 full entries and zero stubs** (the last two, on retrieval, were
written on 2026-09-24 once that topic had six published signals). The eight
April demo signals were archived the same day.

## Completion estimate

| Area                                | Done                                 | Remaining                                                                                                                                                                                                               |
| ----------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Business pipeline / CMS             | ~98%                                 | Workspace visual confirmation, the code-debt decomposition pass, ESLint/Prettier tooling, and the `validate:delivery` fixture fix are all done; no tracked gap remains on this side                                     |
| User-facing visuals / design system | ~95%                                 | per-page desktop+mobile sweep is done for every page previously flagged (`/digest/today`, `/digest/[date]`, `/skills`, `/knowledge` were the last four); remaining work here is polish-on-demand, not a tracked backlog |
| User-facing content                 | ~90%                                 | essentially localized                                                                                                                                                                                                   |
| Knowledge relationship network      | 100% (P2 complete)                   | walkable graph, relation-density line, full semantic typing, and a whole-network overview page all shipped; future work here would be new scope (e.g. filtering, search) rather than finishing P2                       |
| AI assistance / personalization     | P3 and P4 agreed scope both complete | P4 shipped v0 through v0.4 (radar, detail-page follow, personalized digest, topic feeds + follow transfer, read / read-later marks). Anything further in either is new scope, proposed per capability                   |
| Deployment                          | live since 2026-09-20                | Public build behind a Cloudflare Tunnel, ten-second rebuild swaps, verified backups, a health endpoint. Open: bind to `127.0.0.1`, a deploy script, an off-disk backup — see `docs/next-task.md`                        |

**The honest summary: the feature roadmap is finished, and the site is live.**
Everything from 2026-07-22 to mid-September was editorial rounds, content,
visual passes and defect fixes; the one genuinely new track since then is the
AI application work of 2026-09-23 (item 11 above), chosen by the owner. What is
left is operation: rounds, the small operational items in `docs/next-task.md`,
and code debt.

## Roadmap

### P1 — Seal the current pass (short; do first)

- Finalize the "solid / contrast" visual pass.
- Commit and sync docs (`ui-migration-plan.md`) to match code.
- Outcome: UI reaches a token-stable state — future tweaks are token edits, not
  per-page surgery.

### P2 — Knowledge relationship network (the real value; complete)

- ~~Surface relationship density on list cards ("related: N").~~ Done on all
  three index pages via a shared `RelationDensity` component (technology, skill,
  and knowledge cards render the same `关联 · N …` line).
- ~~Smoother multi-hop navigation; optional small relationship visualization.~~
  Done: shared `RelationshipGraph` on the technology, skill, and knowledge detail
  pages makes every node's neighbourhood clickable and walkable.
- ~~Richer cross-entity relation typing.~~ Done: every `relatedXIds` reference
  in the content graph (technology↔technology, technology↔skill,
  technology↔knowledge, skill↔knowledge) now resolves to an explicit
  `LinkRelation` with a real Chinese label, surfaced as a pill on related-card
  lists and a hover tooltip on graph nodes on all three detail pages.
- ~~Optional global/overview graph view.~~ Done: `/network` renders the whole
  graph (all nodes, all edges) with click-to-focus exploration, linked from
  `TopNav`.
- Makes discover → understand → **connect** actually hold. P2 is now feature-
  complete; the roadmap's next open item is P3, which requires explicit
  authorization before starting (see below).

### P3 — AI-assisted understanding (requires explicit authorization)

`AGENTS.md` previously listed AI black-box features as out of scope without an
explicit request — that history matters because it explains why this stayed
locked through P1/P2. The owner has explicitly authorized P3.
**Compare two technologies shipped as v0**, and **Explain at the reader's
level shipped as v1** (2026-07-05, owner chose Explain-first ordering; see
`CHANGELOG.md`'s "AI-assisted understanding" entries and
`docs/project-spec.md`'s "AI-Assisted Understanding" section): a reader on
`/technologies/[slug]` can request a live, cached, disclaimer-labelled AI
comparison against another published technology, or a per-level (入门 / 进阶 /
资深) AI explanation of the current one. **Learning-path generation is the
agreed next P3 candidate** — the owner's Explain-first choice implies it
follows, but confirm before starting. This is the CMS → AI-product turning
point.

### P4 — Personalization (authorized 2026-07-09; v0 through v0.4 shipped)

Followed topics → personalized digest = a personal tech radar.

**v0 shipped** (see `CHANGELOG.md` → "Personalization"): readers follow topic
tags on the public `/radar` page; follows live only in browser localStorage
(no accounts, no server profile), and the radar groups matching published
signals with the existing deterministic Ranking v0 levels plus a per-item
"命中关注：X" explanation line. Remaining P4 ideas (follow entry points on
detail pages, a personalized digest view, follow-based highlights elsewhere)
are future scope to be proposed per capability.

### Interleaved — code debt

`candidate-workflow.ts` (`docs/next-task.md`; 1763 → 549 lines across four
extractions, the last being `technology-draft-workflow.ts` for the record
CRUD/publish/archive logic), `digest-workflow.ts` (887 → 787 lines; store
layer extracted to `digest-store.ts`), and `sqlite-store.ts` (1308 → 681
lines; twelve per-domain files plus `sqlite-primitives.ts` extracted) have
all had the decomposition pattern applied — every file originally flagged
for it is done, as are the ESLint/Prettier config and the
`validate:delivery` fixture fix that used to be listed here. The code debt
open today is different in kind: `globals.css` at 11,000+ lines, test files
outside the typecheck, and the documentation weight fixed on 2026-09-26 —
see `docs/next-task.md`. Do this as interleaved cleanup, not a separate
phase.

## What "done" means, and the path to it

The four phases above are all complete, so "what is left" is no longer a
feature list — it depends on which reading of **done** you take. Three are
possible, and this project's own documents already chose one:

| Reading             | Meaning                                                | Has an end?                  |
| ------------------- | ------------------------------------------------------ | ---------------------------- |
| **A. Deployed**     | public site on a real domain, workspace locked         | **yes, and close**           |
| B. Content mature   | enough signals/skills/knowledge to decide for a reader | no — ongoing operation       |
| C. Feature-complete | accounts, production DB, subscriptions                 | yes, but a different product |

**A is the target**, because `docs/production-readiness.md` already scopes it
that way: a controlled single-operator go-live, with accounts, RBAC, a
production database and distributed scheduling explicitly out of scope (see
`AGENTS.md`). B is what A turns into afterwards. C would change what this
project is.

### Phase 1 — close the current thread

Whatever operational question is open at the time. Effect: the scheduled
pipeline can be treated as infrastructure rather than something still under
observation, which matters once it is the only content source.

### Phase 2 — deploy (done 2026-09-20)

The owner's three answers turned out to be: this machine, `aizyradar.cn`
through a Cloudflare Tunnel, and no workspace on the public server at all —
`npm run build:public` removes the workspace routes from the build, so the
token guard is a second lock rather than the only one, and editorial rounds
run on a local `next dev` against the live data directory. Backups run daily
at 07:45 and are verified by hash. The runbook is `docs/deployment.md`.

### Phase 3 — watch it (2026-09-20 → ongoing)

Production showed what it was expected to, and more, within the first five
days: the host slept through a day, the outbound proxy died on an unattended
reboot, the embedding model never finished downloading and nothing said so,
the live build fell nine commits behind `main`, and the public AI rate limit
could be walked around with one header. All were fixed by 2026-09-25 (see
`CHANGELOG.md`, the 2026-09-24/25 entries). What is still being watched: the
nightly manual sleep, and two processes writing the same store (last writer
wins — they can no longer corrupt it).

### Phase 4 — steady operation (no end)

The import is automatic; the judgment is not. Optimization here means fewer
manual steps per round, not more features. The open list — a few operational
items, code debt, and things only the owner can do — lives in
`docs/next-task.md`.

## Status

**P1 through P4 are all complete**, and the interleaved code-debt list is
empty. The original ordering advice — seal P1, focus P2, confirm before P3 —
has served its purpose and is kept in the sections above as history.

The one piece of that advice still worth obeying: **avoid UI micro-tuning as a
goal**. The ceiling of this project is the relationship network and the
understanding layer, not button spacing. Visual passes remain worth running,
but as verification of content rounds rather than as redesigns — and they earn
their keep: two consecutive passes in August found five reader-visible defects
that every structural check had already passed (a wrong content-type label, a
publisher rendered as a GitHub username, a summary shipping its `**` markers, a
command-line flag split across lines, and ASCII quotes in Chinese prose). None
of those has normal-DOM symptoms. See `AGENTS.md` → "Visual verification rule".

**Now: Phases 3 and 4** — the site is live; the work is rounds, watching, and
the short backlog in `docs/next-task.md`.

## Keeping this document honest

This file went **a month out of date** (2026-07-09 → 2026-08-13) while
`CHANGELOG.md` was updated daily, and then did it again (2026-08-13 →
2026-09-26): for six days after the site went live it still said the
deployment was blocked on the owner. That is worse here than elsewhere: the
header says direction should survive even if chat history is lost, and for
weeks it would have pointed a fresh session at a state that no longer existed.

Update it whenever a phase closes or its status changes — not per feature,
which is what the changelog is for.
