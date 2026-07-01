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

## Completion estimate

| Area | Done | Remaining |
|---|---|---|
| Business pipeline / CMS | ~85% | visual confirmation of a few Workspace pages (duplicates, operations, dashboard) |
| User-facing visuals / design system | ~85% | finish the contrast pass; per-page mobile sweep |
| User-facing content | ~90% | essentially localized |
| Knowledge relationship network | 100% (P2 complete) | walkable graph, relation-density line, full semantic typing, and a whole-network overview page all shipped; future work here would be new scope (e.g. filtering, search) rather than finishing P2 |
| AI assistance / personalization | 0% | not started (and gated as out-of-scope without explicit request) |

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
`AGENTS.md` currently lists AI black-box features as out of scope without an
explicit request. When authorized: Explain / Compare / generate a learning path
beside a technology. This is the CMS → AI-product turning point.

### P4 — Personalization (further out; also requires authorization)
Followed topics → personalized digest = a personal tech radar.

### Interleaved — code debt
Continue decomposing `candidate-workflow.ts` (`docs/next-task.md`; already
1763 → ~1264 lines). Do this as interleaved cleanup, not a separate phase.

## Recommended order

Seal P1 (short) → focus P2 relationship network → stop and confirm with the
owner before P3, because AI/personalization are an explicit authorization
boundary in `AGENTS.md`. Avoid further UI micro-tuning: the project ceiling is
the relationship network and understanding layer, not button spacing.

**Status: P1 and P2 are both done.** The project is now at the P3 decision
point. Do not start P3 (Explain / Compare / learning-path generation) or P4
(personalization) without an explicit request from the owner — until then,
suitable work is: interleaved code debt (`candidate-workflow.ts` decomposition,
`docs/next-task.md`), Workspace-side visual confirmation, or small fixes/polish
surfaced along the way.
