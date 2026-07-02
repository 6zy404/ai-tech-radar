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
5. **Compare two technologies (P3 v0, in progress)**
   - A reader on `/technologies/[slug]` can request a live AI-generated
     comparison against another published technology; results are cached per
     technology pair and always shown with a persistent, unmissable
     "AI-generated, not reviewed" disclaimer.
   - The project's first public, unprotected route that calls the LLM
     provider directly (`POST /api/technologies/compare`), with a dedicated
     public-mapping function stripping all provider/model/prompt metadata
     before the response leaves the server.
   - Explain and learning-path generation are not part of this v0.

## Completion estimate

| Area | Done | Remaining |
|---|---|---|
| Business pipeline / CMS | ~95% | Workspace visual confirmation (dashboard, duplicates, operations, technologies) is done; remaining gap is a fresh dependency analysis for the `candidate-workflow.ts` cut, not visual work |
| User-facing visuals / design system | ~85% | finish the contrast pass; per-page mobile sweep |
| User-facing content | ~90% | essentially localized |
| Knowledge relationship network | 100% (P2 complete) | walkable graph, relation-density line, full semantic typing, and a whole-network overview page all shipped; future work here would be new scope (e.g. filtering, search) rather than finishing P2 |
| AI assistance / personalization | P3 in progress (Compare v0 shipped) | Explain and learning-path generation not started; P4 personalization not started (still gated as out-of-scope without explicit request) |

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
locked through P1/P2. The owner has now explicitly authorized P3, and
**Compare two technologies has shipped as v0** (see `CHANGELOG.md`'s
"AI-assisted understanding" entry and `docs/project-spec.md`'s
"AI-Assisted Understanding v0 (Compare)" section): a reader can request a
live, cached, disclaimer-labelled AI comparison between two published
technologies on `/technologies/[slug]`. Explain and learning-path generation
are still deferred — not started, and not re-authorized by the Compare work.
This is the CMS → AI-product turning point.

### P4 — Personalization (further out; also requires authorization)
Followed topics → personalized digest = a personal tech radar.

### Interleaved — code debt
`candidate-workflow.ts` (`docs/next-task.md`; 1763 → 549 lines across four
extractions, the last being `technology-draft-workflow.ts` for the record
CRUD/publish/archive logic) and `digest-workflow.ts` (887 → 787 lines; store
layer extracted to `digest-store.ts`) have both had the decomposition pattern
applied about as far as it profitably goes for now. `sqlite-store.ts`
(1164 lines) hasn't been touched yet — that and ESLint/Prettier config are
the remaining items. Do this as interleaved cleanup, not a separate phase.

## Recommended order

Seal P1 (short) → focus P2 relationship network → stop and confirm with the
owner before P3, because AI/personalization are an explicit authorization
boundary in `AGENTS.md`. Avoid further UI micro-tuning: the project ceiling is
the relationship network and understanding layer, not button spacing.

**Status: P1 and P2 are both done. P3 is in progress under explicit
authorization** — Compare two technologies has shipped as v0 (see the P3
section above). Explain and learning-path generation remain unauthorized and
should not be started without a fresh explicit request. P4 (personalization)
is untouched and still requires explicit authorization. Suitable interleaved
work in the meantime: `candidate-workflow.ts` decomposition
(`docs/next-task.md`), Workspace-side visual confirmation, or small
fixes/polish surfaced along the way.
