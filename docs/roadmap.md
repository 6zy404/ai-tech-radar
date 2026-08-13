# Roadmap

This is the durable, high-level plan for the project: what it is, what is built,
and what comes next. It complements `docs/progress.md` (detailed status) and
`docs/next-task.md` (the immediate next task). Keep it in the repo so direction
survives even if chat history is lost.

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

## Content

The pipeline is no longer the constraint; the content is the product. As of
2026-08-13: **42 published technology signals**, **15 skills**, **18 knowledge
entries**, **20 published daily digests**, **13 enabled sources**. The
skill/knowledge pool went from 16 full entries and 16 one-sentence seed stubs
to 33 full entries with 2 stubs left, both deliberately on hold until their
topic has more than its current three published signals.

## Completion estimate

| Area                                | Done                                  | Remaining                                                                                                                                                                                                               |
| ----------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Business pipeline / CMS             | ~98%                                  | Workspace visual confirmation, the code-debt decomposition pass, ESLint/Prettier tooling, and the `validate:delivery` fixture fix are all done; no tracked gap remains on this side                                     |
| User-facing visuals / design system | ~95%                                  | per-page desktop+mobile sweep is done for every page previously flagged (`/digest/today`, `/digest/[date]`, `/skills`, `/knowledge` were the last four); remaining work here is polish-on-demand, not a tracked backlog |
| User-facing content                 | ~90%                                  | essentially localized                                                                                                                                                                                                   |
| Knowledge relationship network      | 100% (P2 complete)                    | walkable graph, relation-density line, full semantic typing, and a whole-network overview page all shipped; future work here would be new scope (e.g. filtering, search) rather than finishing P2                       |
| AI assistance / personalization     | P3 and P4 agreed scope both complete  | P4 shipped v0 through v0.4 (radar, detail-page follow, personalized digest, topic feeds + follow transfer, read / read-later marks). Anything further in either is new scope, proposed per capability                   |
| Deployment                          | code side done; 4 operator steps left | Rate limiting, CSP + HSTS, pinned Node, purged fixtures and untracked runtime stores all landed. What remains needs a machine and a domain — see "What 'done' means" below                                              |

**The honest summary: the feature roadmap is finished.** Everything since
2026-07-22 has been editorial rounds, content, visual passes, and defect fixes
— not new phases. What is left is a deployment plus an ongoing operation.

## Roadmap

### P1 — Seal the current pass (short; do first)

- Finalize the "solid / contrast" visual pass.
- Commit and sync docs (`progress.md`, `ui-migration-plan.md`) to match code.
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
for it is done. Remaining code debt: ESLint/Prettier config, and a
pre-existing `npm run validate:delivery` fixture mismatch found (not caused)
during the `sqlite-store.ts` work and flagged separately. Do this as
interleaved cleanup, not a separate phase.

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

### Phase 2 — deploy (about half a day, blocked on the owner)

Of the 9-step go-live checklist, **the 5 code/config steps are done** (public
AI route rate limiting, production CSP + HSTS, pinned Node, purged demo
fixtures, runtime stores untracked). The remaining 4 are deployment actions,
none of which need new code:

1. Turn on `WORKSPACE_ACCESS_ENABLED` + a strong token — **and verify by
   requesting the route, not by reading the middleware**. That is exactly how
   the inert-guard bug went unnoticed for weeks.
2. Move the live data directory out of the repository.
3. Set `NEXT_PUBLIC_SITE_URL` — it is inlined at **build** time, so setting it
   only at runtime bakes `localhost` into every feed link.
4. Schedule the daily backup.

Plus HTTPS in front, a build, and a smoke test.

**The only blocker is three answers**: which machine and domain, who may reach
the workspace, and where backups go.

### Phase 3 — watch it for about two weeks

The things only production shows: whether the scheduled task behaves on a new
machine (this project has lost runs to sleep _and_ to a console `Ctrl+C`),
whether the backup actually restores, whether feed links are right, and
whether two writers ever collide on the unlocked JSON store.

### Phase 4 — steady operation (no end)

The import is automatic; the judgment is not. Optimization here means fewer
manual steps per round, not more features.

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

**Next: Phase 2 above** — the deployment. It needs three answers from the owner
before any of it can start.

## Keeping this document honest

This file went **a month out of date** (2026-07-09 → 2026-08-13) while
`CHANGELOG.md` was updated daily. That is worse here than elsewhere: the header
says direction should survive even if chat history is lost, and for a month it
would have pointed a fresh session at a state that no longer existed.

Update it whenever a phase closes or its status changes — not per feature,
which is what the changelog is for.
