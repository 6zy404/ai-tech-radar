# Design System v0

This document defines the current page templates and visual boundaries for the local-first prototype.

The goal is not to make every page identical. The goal is to keep the product coherent while making Internal Workspace pages clearly different from User-facing Product pages.

## Page audit summary

### Internal Workspace pages

- `/workspace/candidates`
- `/workspace/candidates/[id]`
- `/workspace/technologies`
- `/workspace/technologies/[id]`
- `/workspace/sources`
- `/workspace/sources/[id]`
- `/workspace/digests`
- `/workspace/digests/[date]`
- `/workspace/delivery`
- `/workspace/delivery/schedules`
- `/workspace/operations`
- `/workspace/operations/events`

These pages are operational surfaces for reviewers and editors. They can show workflow status, source health, duplicate hints, raw payload, readiness checks, and workspace actions.

Every Internal Workspace page uses a workspace-only second-level navigation with Overview, Sources, Candidates, Duplicates, Drafts, Digests, Delivery, Schedules, and Operations. Workspace detail and preview pages also show breadcrumbs so editors can move back to the correct module list.

On desktop, the workspace navigation is presented as a dark grouped left rail. This intentionally separates workspace operations from the lighter public product surfaces. On narrow screens it collapses back into a compact horizontal module navigation.

Workspace pages also show a compact internal-boundary note. It reminds operators that workspace access should be token-protected before deployment, delivery endpoints are sensitive, local JSON is a controlled-environment store, and multiple task runners should not write to the same data directory.

Workspace actions follow the hierarchy in `docs/workspace-actions.md`: primary,
secondary, destructive, status, and diagnostic. Button labels must describe the
result of the action, dangerous actions require confirmation, and disabled
actions should explain the missing prerequisite.

### User-facing Product pages

- `/`
- `/technologies`
- `/technologies/[slug]`
- `/digest/today`
- `/digest/[date]`
- `/skills`
- `/skills/[slug]`
- `/knowledge`
- `/knowledge/[slug]`
- `/feed.xml`
- `/feed.json`

These pages are public discovery and reading surfaces. They should only consume
safe published technology, skill, knowledge, and digest data.

### Findings that drove v0 refactor

- Workspace list pages and user-facing list pages were both card-heavy, which made their responsibilities feel too similar.
- Workspace detail pages and user-facing detail pages shared too much generic panel styling.
- The user-facing technology detail page had an extra generic page header above the article, which weakened the reading-first hierarchy.
- Workspace action areas were present, but did not always read as operational controls.
- Internal-only fields were already routed to workspace pages, but the visual boundary needed to be clearer so users do not confuse review data with published content.

## Product visual principles

### Internal Workspace

Internal Workspace pages are for reviewers, editors, and maintainers.

They should feel like an operational tool:

- compact but readable
- status-forward
- filter and action areas are visible
- source traceability and workflow state are easy to scan
- raw payload and internal diagnostics stay available, but lower in visual priority

Workspace pages may show internal fields such as `importStatus`, `normalizedType`, `duplicateGroupId`, source health, publish readiness, and raw payload.

### User-facing Product

User-facing pages are for end users trying to understand new technologies quickly.

They should feel like a content product:

- reading-first
- clear title, summary, source, tags, and publish date
- generous line height and article-like hierarchy
- bilingual content switching for technology content
- source link is visible but does not dominate the article

User-facing pages must not expose internal workflow fields.

## Page templates

### Workspace List Page

Routes:

- `/workspace/candidates`
- `/workspace/technologies`
- `/workspace/sources`
- `/workspace/digests`
- `/workspace/delivery`
- `/workspace/delivery/schedules`
- `/workspace/operations`
- `/workspace/operations/events`

Template:

- `WorkspacePageShell`
- workspace module navigation
- breadcrumb context
- clear workspace section label
- compact description of the operational task
- search / filter toolbar
- count and status summary via `WorkspaceListToolbar`
- list, table, or record cards optimized for review and management
- primary actions near the page header or toolbar

Visual rules:

- max content width follows the app container
- toolbar and cards use neutral workspace surfaces
- status badges should be obvious
- list rows may be denser than user-facing cards

### Workspace Detail Page

Routes:

- `/workspace/candidates/[id]`
- `/workspace/technologies/[id]`
- `/workspace/sources/[id]`
- `/workspace/digests/[date]`

Template:

- `WorkspacePageShell`
- workspace module navigation
- breadcrumb context
- object title, status, and primary actions near the top
- main column for review or editing
- aside column for reference, source, and workflow metadata
- raw payload or technical snapshots placed in lower-priority sections

Visual rules:

- desktop layout uses main + aside
- do not force mechanical equal heights
- long links and raw payload must wrap or scroll inside their own containers
- action bars are workspace-only
- delivery channel config, endpoint URLs, webhook payload previews, schedules, scheduled run logs, and delivery logs are workspace-only and should use operational styling rather than article styling
- operations pages use summary cards, attention lists, compact failure rows, and low-weight sanitized event snapshots; they should not become user-facing content pages

### Product Home Page

Routes:

- `/`

Template:

- `UserPageShell` with the generic header hidden
- editorial hero explaining the product promise
- latest published Daily Digest entry
- immediate-priority technology signal cards
- public Skills and Knowledge discovery paths
- links to `/digest/today`, `/technologies`, `/skills`, and `/knowledge`

Visual rules:

- home is not a workspace dashboard and must not show workspace status, operations, source health, delivery, or task-runner data
- the main question is "what should I read first and what background do I need?"
- the hero should route readers into three public choices: read today's digest, browse technology signals, or build background through skills and knowledge
- empty states point to public pages, never to workspace actions

### User-facing Technology List Page

Routes:

- `/technologies`

Template:

- `UserPageShell`
- content-oriented page title and description
- search / filter controls are present but visually lighter than workspace tools
- `TechnologyListCard` focuses on title, signal type, why it matters, source, date, language availability, related context counts, and tags

Visual rules:

- cards should communicate “what this is” quickly
- cards should also communicate who should care and whether the item is an early signal, important watch item, or critical signal
- cards may use Content Intelligence fields for a short why-it-matters signal, audience hints, and reading difficulty
- desktop technology cards should behave like a compact curated signal stream, not a workspace management grid
- user-facing copy must not say demo, mock, or that the record is only for demonstration
- no internal state, source health, raw payload, duplicate hints, or review actions
- Chinese text is preferred when available, with fallback to original text

### User-facing Technology Detail Page

Routes:

- `/technologies/[slug]`

Template:

- `UserPageShell`
- `UserArticleLayout`
- article hero for title, summary, language switch, source metadata, and productized priority label
- main reading column for content and Content Intelligence modules
- aside reference column for source, language availability, priority summary, and tags

Visual rules:

- article title is the primary visual element
- source and original link are visible but secondary
- Content Intelligence modules explain why the signal matters, who should care, technical context, impact areas, learning path, and follow-up questions
- related skills and knowledge should include explanatory notes, not only IDs or plain labels
- missing explanation fields are hidden instead of rendering empty headings
- no internal workflow, quality, delivery, audit, source health, or duplicate data

### User-facing Digest Page

Routes:

- `/digest/today`
- `/digest/[date]`
- `/feed.xml`
- `/feed.json`

Template:

- `UserPageShell`
- digest hero for date, title, summary, and immediate/watch counts
- immediate-attention section for high-priority published technologies
- worth-tracking section for watch-level published technologies
- related Skills and Knowledge sections
- source references and optional public feed links

Visual rules:

- digest pages should read as a daily brief: overview first, immediate-attention items next, watch items after that, then skills / knowledge / sources
- digest feed links are auxiliary delivery affordances and should not compete with the digest content itself
- workspace digest pages may show editorial controls, readiness checks, manual adjustment state, delivery send controls, and delivery logs; public digest pages must only show the published brief
- deployment and task-runner warnings belong only in workspace pages; public pages must not display workspace access, endpoint, schedule, or runner details
- operations and audit surfaces belong only in workspace pages; public pages must not display system health, attention items, workflow events, delivery logs, or task runner summaries

### User-facing Skill / Knowledge Index Page

Routes:

- `/skills`
- `/knowledge`

Template:

- `UserPageShell`
- shared Learning Support Index Template
- intro panel explaining how the library helps readers understand AI technology signals
- three-step guide that explains how to use the library
- grouped lightweight cards using the same padding, border, radius, and shadow rules
- cards that show summary, category/type, difficulty or learning cost, what the item helps readers evaluate or understand, limited tags, and links to related published technologies

Visual rules:

- these are not generic static lists; they are understanding foundations for technology discovery
- cards should answer "what does this help me evaluate or understand?"
- related technology links should use public technology pages only
- `/skills` and `/knowledge` share the same max width, section rhythm, intro panel, grouped card grid, empty-state treatment, and badge weight
- index cards are lightweight and scannable; they should not become backend records or detail pages

### User-facing Skill / Knowledge Detail Page

Routes:

- `/skills/[slug]`
- `/knowledge/[slug]`

Template:

- `UserPageShell` with detail-style hero
- shared Learning Support Detail Template
- article-style main column with a large hero, lead explanation, why-it-matters/context section, related items, and learning next steps
- related published technologies
- related skills or knowledge with explanatory notes and clear links such as `Open related signal`, `View skill`, or `View concept`
- compact profile aside for low-weight category, difficulty, counts, topics, and page-use guidance

Visual rules:

- details should feel like learning-path pages, not database records
- no internal workflow state, source configuration, or workspace controls
- aside content must remain secondary to the article body
- missing optional fields should be hidden rather than rendered as empty headings

## Visual specifications

### Width

- App container: `min(1180px, calc(100% - 32px))`
- Workspace detail aside: roughly `280px-340px`
- User-facing article main column: max `780px`
- User-facing article aside: roughly `260px-320px`

### Spacing

- Workspace pages use tighter gaps: `16px-22px`
- User-facing pages use more open gaps: `24px-30px`
- Article body line height should stay generous enough for long Chinese or English text

### Typography scale

User-facing pages use a centralized typographic scale defined as CSS custom
properties in `src/app/globals.css` `:root` and applied only under `.user-shell`
(public pages). The Internal Workspace and the shared `TopNav` keep their
existing typography.

- Font family: `--font-sans` — Inter / Source Han Sans (思源黑体) / system-ui
  fallback chain (no web font is loaded; preferred faces are used only if
  installed)
- `--fs-h1` `28px` — page / hero titles (`h1`)
- `--fs-section` `22px` — section and intro headings (`h2`)
- `--fs-card-title` `18px` — card titles (`h3`, and card titles that use `h2`)
- `--fs-body` `15px` — body text (`p`, `li`, `dd`)
- `--fs-label` `13px` — eyebrows, metadata, and small labels
- `--lh-base` `1.5` — unified line-height across headings and text blocks

The scale is applied through a single `.user-shell`-scoped layer at the end of
`globals.css`. It uses `!important` so the central scale stays authoritative over
the older per-page sizes; page components reference the tokens instead of
hard-coding font sizes. This is a typography-only layer: it does not change
layout, color, logic, or component structure.

- Workspace page title: large but operational, around `2rem-3.25rem` (unchanged)
- Workspace metadata: small, dense, and label-forward (unchanged)

### Cards

- Workspace cards should look like records or rows.
- User-facing cards should look like content previews.
- Do not reuse a card style when it makes page purpose unclear.

### Badges

- Workspace status badges communicate operational state.
- User-facing tags and language badges communicate reading context.
- Avoid using internal status badge styles on user-facing pages.

### Metadata row

- Workspace metadata may include status, source type, normalized type, publisher, dates, and workflow state.
- Workspace delivery metadata may include channel status, masked endpoint URLs, HTTP status, retry linkage, schedule time, next run, last run status, and skipped channel counts.
- User-facing metadata should only include source, publisher, publish date, public type, language availability, and tags.

### Action bar

- Workspace pages may show review, import, edit, publish, archive, preview, and manual digest delivery actions.
- User-facing pages must not show reviewer/editor actions.

### Navigation

- Global navigation is for the product-level routes: Home, Daily Digest, Technologies, Skills, Knowledge, and the secondary Workspace entry.
- The global Workspace entry is labeled as an internal workspace entry point so
  it is not confused with a public product page.
- Workspace navigation is a second-level internal nav rendered only inside `WorkspacePageShell`.
- User-facing pages must not render workspace module links or workspace breadcrumbs.
- `/workspace` is the dashboard entry point and should make the workflow relationship between Sources, Candidates, Duplicates, Drafts, Publish, Digests, Delivery, and Schedules visible.
- `/workspace/operations` is the operational health entry point and should make source failures, delivery failures, scheduled run failures, task runner state, and workflow events easy to discover.

## Field display boundary

Internal-only fields are allowed only inside Internal Workspace:

- `rawPayload`
- `importStatus`
- `normalizedType`
- `duplicateGroupId`
- `relatedCandidateIds`
- `reviewedAt`
- `convertedTechnologyId`
- source health fields
- publish readiness fields
- digest editorial notes and draft / archived digest status
- digest manual adjustment IDs and workspace-only delivery controls
- delivery channel configuration, endpoint URLs, schedules, scheduled run logs, request payload previews, response previews, errors, and retry metadata
- workspace access protection state and deployment-only warnings
- editorial enrichment suggestion records, source inputs, generation mode, provider/model/prompt metadata, token usage, validation warnings, generation errors, and reviewer notes

User-facing fields:

- localized `title`
- localized `summary`
- localized `content`
- `sourceName`
- `sourceUrl`
- `publisherName`
- `publisherType`
- `publishDate`
- `tags`
- `relatedKnowledgeIds`
- `relatedSkillIds`
- `whyItMatters`
- `whoShouldCare`
- `technicalContext`
- `impactAreas`
- `learningPath`
- `relatedKnowledgeExplanations`
- `relatedSkillExplanations`
- `followUpQuestions`
- `readingDifficulty`
- `intelligenceStatus`
- content language and translation availability
- published digest title, summary, selected public technology items, related skills, related knowledge, and source names
- public digest feed URLs and feed items derived from published digest data only
- public digest pages may link to RSS / JSON feeds, but must not show webhook channel, schedule, or delivery log information
- public pages must not show workspace navigation, workspace access tokens, task-runner commands, delivery endpoint URLs, or local JSON deployment warnings
- public pages must not show operations summaries, attention-required items, workflow events, audit logs, delivery logs, task-runner summaries, or failure diagnostics
- public pages may show Content Intelligence enrichment fields because those fields are edited user-facing explanations, not internal diagnostics

User-facing technology pages must consume safe `TechnologyItem` data, not raw `ImportedCandidate` or source management records.

## Current coverage

Implemented in v0:

- `PageHeader`
- `WorkspacePageShell`
- `WorkspaceNav`
- `WorkspaceBreadcrumbs`
- `WorkspaceListToolbar`
- `WorkspaceStatusBadge`
- `UserPageShell`
- `UserArticleLayout`
- `MetadataRow`
- `TagList`
- `SourceReference`
- `RelatedItemsSection`
- `DailyDigestContent`
- `DailyDigestWorkspaceCard`
- `DailyDigestWorkspaceDetail`
- `DailyDigestEditForm`
- `DailyDigestItemActions`
- workspace-specific list/detail styling
- user-facing technology list/detail styling
- user-facing digest brief styling
- digest publish readiness and editorial adjustment controls inside workspace pages only
- digest delivery status, feed link, and share text treatment for workspace digest details
- public RSS / JSON digest feed surfaces
- workspace generic webhook / Feishu webhook delivery channel and delivery log surfaces
- workspace digest manual delivery preview and send controls
- workspace scheduled delivery list, run controls, and schedule run status surfaces
- workspace deployment boundary note and minimal access-protection documentation
- workspace operations dashboard and workflow event browser
- workspace Content Intelligence editing fields on technology draft detail
- workspace Editorial Enrichment panel for suggestion generation, compare, apply, reject, and stale status
- workspace LLM-assisted enrichment controls with server-side provider metadata and output validation state
- user-facing Content Intelligence modules on technology detail and digest cards

Still left for later:

- deeper accessibility audit
- mobile visual pass beyond basic responsive layout
- extracting every remaining legacy class name
- visual regression screenshots
- richer digest editing ergonomics such as drag-and-drop ordering
- visual pass for future Telegram, Discord, email, and other non-webhook delivery channels if they are implemented
- richer bilingual treatment for Content Intelligence fields
- per-field visual diffing for future AI-assisted editorial suggestions

## UI Design System & Layout Refactor v0

This pass makes the visual split between the public product and the Internal
Workspace more explicit without changing business workflows.

User-facing pages use a lighter discovery and reading surface:

- warm page background, teal highlights, soft cards, and wide reading rhythm
- homepage entry cards for Daily Digest, Technology Signals, and Skills /
  Knowledge
- technology cards focused on title, source, priority, audience, why-it-matters,
  and a small number of tags
- Daily Digest public copy avoids internal validation, demo, and mock wording
- Skills and Knowledge indexes are grouped by type or difficulty so readers know
  where to start

Workspace pages use a compact internal-operations surface:

- dark workspace navigation, compact headers, smaller security boundary notes
- denser cards and forms, lower visual shadows, and clearer primary actions
- create forms for delivery channels and schedules are collapsed by default so
  list status and recent runs remain the main workspace view
- endpoint URLs, schedules, delivery logs, task-runner status, and audit events
  remain workspace-only

Design tokens are intentionally still plain CSS custom properties in
`src/app/globals.css`. The current project does not introduce a component
library or new dependency for this refactor.

On public pages the later `--ui-*` and `--skills-*` palettes resolve to the
canonical base tokens (`--accent`, `--muted`, `--user-ink`, `--bg`, `--line`,
`--accent-soft`) through a `.user-shell`-scoped override, so user-facing
surfaces use one brand palette instead of three. The Internal Workspace still
reads the original `--ui-*` values (it shares some of them), and a few
intentionally distinct tokens — card surface, soft tints, shadows, and the
accessible `--ui-teal-strong` — are kept rather than collapsed.

## UI Template QA & Consolidation v0

The current baseline templates are now split into two stable families.

Workspace Console Template:

- compact page header instead of a large marketing hero
- lightweight internal info bar that states workspace-only risk without
  dominating the page
- summary metrics near the top for count, health, state, or last-run context
- table or compact list rows for the main object list
- one clear page-level primary action
- row-level secondary actions for inspect, edit, import, review, or preview
- risky actions such as disable, reject, archive, or exclude stay visually
  subdued
- diagnostics, health messages, workflow events, source health, and delivery
  details stay low priority

The Workspace Console Template currently covers:

- `/workspace/sources`
- `/workspace/candidates`
- `/workspace/digests`

User-facing Reading Template:

- user-facing header and public navigation only
- content-first layout with generous reading rhythm
- lightweight signal cards focused on title, summary, source, priority,
  why-it-matters, audience, and a small number of tags
- article reading path for technology details: why it matters, technical
  context, audience, learning path, related skills, related knowledge, and
  follow-up questions
- missing optional explanation fields are hidden rather than rendered as empty
  headings
- public pages never render workspace navigation, workflow actions, audit
  records, delivery configuration, source health, raw import fields, or
  reviewer notes

The User-facing Reading Template currently covers:

- `/technologies`
- `/technologies/[slug]`

The Learning Support Index Template currently covers:

- `/skills`
- `/knowledge`

The Learning Support Detail Template currently covers:

- `/skills/[slug]`
- `/knowledge/[slug]`

Pages still left for later template migration:

- `/digest/today`
- `/digest/[date]`
- `/workspace/operations`
- `/workspace/duplicates`
- `/workspace/technologies`

## Dossier direction (adoption in progress — /technologies live, 2026-07-14)

An owner-directed visual-identity exploration for the User-facing Product
produced a fully specified alternate direction — nicknamed "编辑桌"
(editor's desk / dossier) — evaluated against alternatives (an "instrument
console" direction and a "knowledge graph" direction, both rejected) through
a series of HTML/CSS mockups covering every public page type. It has now
started shipping to real pages, one page-family per round per the adoption
order below; everything not yet migrated still renders the teal/cream token
system described above. This section exists so a future session can pick up
the remaining migration without re-deriving the decisions.

Concept: content reads as an archival dossier — index cards, catalog
numbers, rubber-stamp tags, and "附注" (annotation) cross-reference notes
that state _why_ a related item is connected, not just that it is. The
defining feature is reusing this pattern for real: technology detail pages
already carry `relatedKnowledgeExplanations` / `relatedSkillExplanations`
fields (see `docs/data-model.md`), so the dossier's connective-note idea
needs no new data, only new layout.

Decided specifics:

- **Palette / type**: sage-grey paper (`#e6e7de` ground, `#f8f6ee` card
  surface), Georgia/宋体 serif for headings and body, `ui-monospace` for
  metadata (dates, catalog numbers, section eyebrows), rust-red stamp
  accent (`#8a3b2a`) for tags, deep pine accent (`#34524a`) for structural
  emphasis. Deliberately not the cream+serif+terracotta combination common
  in AI-generated design, nor a corkboard/pushpin motif (tried and
  rejected as too literal).
- **Fonts**: system fonts for launch (zero cost, no external dependency).
  Custom fonts (思源宋体 Bold for CJK headings, Fraunces for Latin/numeral
  text) are a deferred follow-up — `fonts.gstatic.com` is unreachable from
  the primary dev machine (same class of issue as the npm/Hugging Face
  mirror workarounds elsewhere in this project), so any real
  implementation must self-host pre-subsetted `woff2` files rather than
  rely on `next/font/google` fetching live.
- **Relation vocabulary**: `RelationType` labels rewritten to read as
  native Chinese rather than translated English, and to use the _same_
  word from both directions instead of an English-shaped passive mirror
  (see `getRelationTypeLabel` in `src/lib/technology-localization.ts`,
  already shipped — see CHANGELOG "Copy tone fixes").
- **`/network` relationship graph**: a hand-written force-directed layout
  (repulsion + spring edges + drag, no external graph library — `d3` and
  similar are unreachable via CDN in this environment) rendered on the
  same flat grid-paper background as every other dossier page, not a
  corkboard skin. Confirmed enhancements: search-highlight + category
  filter (stamp-chip style), an embedded "local graph" widget scoped to
  one item's direct neighbors on detail pages, and hover-over-edge
  relation labels. Zoom/pan was explored and explicitly rejected as not
  worth its cost at the current node count (~13 in mockups; the real page
  has ~24) — revisit only if the real graph proves visually cramped.
- **Search input**: icon-pill style (rounded, magnifying-glass icon) —
  chosen over an underline-only input, a bordered "index card" input, and
  a library-request-slip style, after comparing all four against the same
  live filtering behavior.
- **Category filter**: rubber-stamp toggle chips, matching the tag-filter
  chips already used on `/technologies` and `/radar` rather than
  introducing a new shape.

### Component library

Built 2026-07-14, first wired into real pages the same day (see "Adopted
pages" below):

- `DossierCard` (`src/components/dossier-card.tsx`) — bordered index-card
  tile with a resting tilt that straightens on hover / collapses on narrow
  screens.
- `DossierStampTag` (`src/components/dossier-stamp-tag.tsx`) — rubber-stamp
  label; renders as a `<button>` with `aria-pressed` when given `onClick`,
  otherwise a static `<span>`.
- `DossierCatalogNote` (`src/components/dossier-catalog-note.tsx`) — the
  "附注" cross-reference annotation block.
- `DossierRegisterRow` (`src/components/dossier-register-row.tsx`) — a
  compact date + title + tag row for archive/timeline/relation lists.
  **Still unused** — no adopted page has needed a ledger-style row yet;
  the topic timeline is its likely first real consumer.
- `DossierSearchInput` (`src/components/dossier-search-input.tsx`) —
  the confirmed icon-pill search box.
- `DossierCategoryChips` (`src/components/dossier-category-chips.tsx`) —
  the confirmed stamp-chip category filter, composed from
  `DossierStampTag`.

All CSS lives under a single `.dossier` root class in `globals.css`
(`--dossier-*` custom properties, prefixed to avoid any collision with the
live `--bg` / `--accent` / etc. tokens), so applying it to a page is
additive and cannot regress any currently shipped page.

### Adopted pages

- **`/technologies` (list)** — `TechnologyBrowser` now renders
  `DossierSearchInput` + three `DossierCategoryChips` rows (type/tag/
  priority, replacing `SearchFilterBar`) and a new
  `DossierTechnologyCard` (`src/components/dossier-technology-card.tsx`,
  cycling the three tilt variants) instead of `TechnologyListCard` for
  each signal. `TechnologyListCard` and `SearchFilterBar` themselves were
  left unchanged, since both are still shared with the home page and
  `/radar` (not yet migrated) — the new components are page-specific
  siblings, not variant props on the shared ones.
- **`/technologies/[slug]` (detail, incl. the workspace preview route that
  reuses the same renderer)** — `TechnologyDetailContent` gained a new
  `DossierRelatedItemsSection` (`src/components/dossier-related-items-section.tsx`)
  for the 相关技术/相关技能/相关知识 sections: each connection renders as a
  `DossierCard` with its relation-type `DossierStampTag` and its note
  through `DossierCatalogNote` — the "附注" pattern this whole direction
  was designed around, reusing the existing `relatedSkillExplanations` /
  `relatedKnowledgeExplanations` data with no schema change. The hero and
  priority pill use `DossierStampTag`; the catalog-number line
  (`工具 · 第 2026-07-14 号`) is shared CSS between the hero and the list
  card. The three AI widgets (compare/explain/learning-path) and the
  `RelationshipGraph` component are still shared with the not-yet-migrated
  skill/knowledge detail pages, so they were **not** forked — they get the
  dossier look through `.dossier`-scoped CSS overrides on their existing
  classnames (`.user-article-section`, `.tech-graph__*`,
  `.technology-compare-widget__*`) instead, which is inert on any page
  without a `.dossier` ancestor.
- Both pages opt in by adding a `dossier` class next to `user-shell`
  (`UserPageShell`'s `className` prop) or directly on `UserArticleLayout`'s
  root article; every other `.user-shell` page is unaffected because none
  of them carry that class yet.
- **`/skills`, `/skills/[slug]`, `/knowledge`, `/knowledge/[slug]`** — same
  day, second adoption round. Unlike the technology pages, these four
  routes don't share card/section components with each other or with
  anything else (each `page.tsx` hand-rolls its own
  `skill-library-card` / `skill-detail-related-card` markup), so no new
  page-specific sibling components were needed: `DossierCard`,
  `DossierStampTag`, and `DossierCatalogNote` are imported and used
  directly in all four page files in place of the plain
  `<article>`/`<div>`/`<span>` markup they used before. The index-card
  outcome blurb ("帮助你判断" / "帮助你理解") and every related-item note
  (including the skill↔knowledge "附注" note) now render through
  `DossierCatalogNote`; the heat/cost/category/difficulty pills and each
  relation-type label render through `DossierStampTag`. `RelationshipGraph`,
  `TagList`, `FollowableTagList`, and `RelationDensity` are reused as-is —
  they already picked up the dossier look for free from the CSS overrides
  written for the technology round, since those target the shared
  classnames (`.tech-graph__*`, `.tag-badge`, `.my-radar__tag-toggle`)
  rather than being technology-page-specific.

Next up per the original migration-cost plan: the topic timeline
(structurally closest, cheapest — `DossierRegisterRow`'s first real use),
then the digest pages and search, then `/radar` and `/news` (each need one
new state), and the homepage last since it aggregates every other
component. Dark/light theming for this direction is still an explicit open
question, not decided.
