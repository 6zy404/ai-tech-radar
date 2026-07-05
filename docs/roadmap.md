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

## Completion estimate

| Area                                | Done                                                                          | Remaining                                                                                                                                                                                                               |
| ----------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Business pipeline / CMS             | ~98%                                                                          | Workspace visual confirmation, the code-debt decomposition pass, ESLint/Prettier tooling, and the `validate:delivery` fixture fix are all done; no tracked gap remains on this side                                     |
| User-facing visuals / design system | ~95%                                                                          | per-page desktop+mobile sweep is done for every page previously flagged (`/digest/today`, `/digest/[date]`, `/skills`, `/knowledge` were the last four); remaining work here is polish-on-demand, not a tracked backlog |
| User-facing content                 | ~90%                                                                          | essentially localized                                                                                                                                                                                                   |
| Knowledge relationship network      | 100% (P2 complete)                                                            | walkable graph, relation-density line, full semantic typing, and a whole-network overview page all shipped; future work here would be new scope (e.g. filtering, search) rather than finishing P2                       |
| AI assistance / personalization     | P3 agreed scope complete (Compare v0 + Explain v1 + Learning Path v2 shipped) | Further P3 capabilities would be new scope proposed by the owner; P4 personalization not started (still gated as out-of-scope without explicit request)                                                                 |

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

### P4 — Personalization (further out; also requires authorization)

Followed topics → personalized digest = a personal tech radar.

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

## Recommended order

Seal P1 (short) → focus P2 relationship network → stop and confirm with the
owner before P3, because AI/personalization are an explicit authorization
boundary in `AGENTS.md`. Avoid further UI micro-tuning: the project ceiling is
the relationship network and understanding layer, not button spacing.

**Status: P1 and P2 are done, and P3's agreed candidate list is complete** —
Compare (v0), Explain (v1), and the graph-grounded learning path (v2) have
all shipped (see the P3 section above). Any further P3 capability is new
scope to be proposed and authorized by the owner. P4 (personalization) is
untouched and still requires explicit authorization. The interleaved
code-debt list is empty (store decomposition, visual confirmation,
ESLint/Prettier, and the SQLite storage-model decision are all done — see
`docs/next-task.md`).
