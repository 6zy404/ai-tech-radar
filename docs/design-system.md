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
  tile. Originally shipped with a per-index resting tilt that straightened
  on hover; removed 2026-07-15 (see "Flat cards" below) in favor of a flat
  rest state with a plain hover lift. The `tilt` prop and each call site's
  `cardTilts` cycling array are still wired through unchanged — the CSS
  rules that rendered the rotation were removed instead of touching every
  call site, so the classes are present in the DOM but inert. A full prop
  removal is a separate, deliberately deferred cleanup.
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

- **`/timeline`** — same night, third adoption round, and the first real
  use of `DossierRegisterRow`. Each topic's chronological entry list now
  renders as a ledger of register rows (`title`/`date`/`href`/`tag`, with
  `tag` set to the entry's source name) instead of the rail-and-dot
  connector list the page used before — a better fit for the archival
  "编辑桌" concept than a timeline-rail metaphor. `DossierRegisterRow`
  itself only covers the compact title/date/tag line, so the entry
  summary renders as a plain paragraph underneath it
  (`.dossier-timeline-node__summary`), indented to align under the title
  column; no changes to `DossierRegisterRow` itself were needed.

- **`/digest` (archive), `/digest/today`, `/digest/[date]`, and
  `/search`** — same night, fourth adoption round. The digest archive
  index (`/digest/page.tsx`, page-specific) swaps its entry cards for
  `DossierCard` + `DossierStampTag`. The shared `DailyDigestContent`
  (rendered by both public digest routes and the workspace preview route)
  gained `DossierCard` for its technology cards, skill/knowledge reference
  cards, and source-reference chips, `DossierStampTag` for the type/
  priority badges, and `DossierCatalogNote` for the "为什么重要" reason
  block — `dossier` is applied directly on `DailyDigestContent`'s own root
  div (not just the page shell), the same self-contained pattern used by
  `TechnologyDetailContent`, so the workspace preview route (which renders
  inside `WorkspacePageShell`, not a dossier-scoped shell) still resolves
  the `--dossier-*` custom properties correctly instead of rendering
  borderless cards. `/search` swaps its result cards for `DossierCard` and
  its GET-form search box for the `.dossier-search` icon-pill markup
  (copied inline, not the `DossierSearchInput` component, since the page
  is an uncontrolled server-rendered form rather than client state).
  Verified this round caught a real bug before commit: the digest preview
  route initially rendered invisible/borderless cards because
  `--dossier-*` custom properties are only defined inside `.dossier`, and
  that route's ancestor shell never carries the class — fixed by moving
  `dossier` onto the component's own root.

- **`/radar` and `/news`** — same night, fifth adoption round, the "each
  need one new state" pages from the original plan. `MyRadarContent`
  swaps `TechnologyListCard` for `DossierTechnologyCard` (the same
  page-specific card built for `/technologies`) — safe because
  `MyRadarContent` is only ever rendered by `/radar`, so the home page's
  own separate `TechnologyListCard` usage is untouched. `/news`'s
  page-specific `NewsCard` swaps to `DossierCard`, matching the identical
  treatment already given to `/search`'s `SearchNewsCard`.

- **Homepage (`/`)** — same night, sixth and final adoption round. All
  three page-specific card components (`HomeTechnologyCard`,
  `SkillPathCard`, `KnowledgePathCard`) plus the digest summary card now
  render through `DossierCard`, with `DossierStampTag` for the priority/
  category pills and `DossierCatalogNote` for the "为什么重要" block —
  none of these are shared with other pages, so all were changed directly
  in `src/app/page.tsx`. The compact news-row list keeps its original
  markup (CSS-reskinned only), since `DossierRegisterRow`'s `Link`-only
  href doesn't support the `target="_blank"` external-link behavior the
  rows need.

**This completes the original migration-cost plan's adoption order**:
every page named in it (`/`, `/technologies`, `/technologies/[slug]`,
`/skills`, `/skills/[slug]`, `/knowledge`, `/knowledge/[slug]`,
`/timeline`, `/digest`, `/digest/today`, `/digest/[date]`, `/search`,
`/radar`, `/news`) now renders the "编辑桌" look.

- **`/network`** — 2026-07-15, owner-authorized follow-up (this page was
  discussed during the original design session but deliberately left out
  of the migration order, since it needed its own hand-written
  force-directed graph rather than a card swap). `ContentNetworkGraph`
  was rewritten from the fixed three-lane layout to a hand-written
  Fruchterman-Reingold-style force simulation (repulsion between every
  node pair, spring attraction along edges, a weak centering force,
  120 fps-driven relaxation over ~150 frames) so the graph's real
  topology — not an artificial technology/skill/knowledge lane split —
  drives the layout. Ships the three confirmed enhancements from
  "Decided specifics" above: search-highlight (`DossierSearchInput`),
  a category filter (`DossierCategoryChips`), and hover-over-edge
  relation labels (an invisible wide hit-line under each thin visible
  edge, `pointer-events`-only, showing `getRelationTypeLabel` in a
  floating tag at the edge midpoint); zoom/pan stayed out per the
  earlier decision. Nodes are draggable (pointer capture + a physics
  "pin" so the simulation doesn't fight a node the reader is currently
  moving). One real bug was caught during live verification and fixed
  before commit: the initial scatter used `Math.cos`/`Math.sin`, which
  the JS spec does not guarantee bit-identical across engines (Node's
  V8 vs. the browser's), producing a genuine hydration mismatch on every
  load; fixed by rendering an SSR-safe plain grid (integer arithmetic
  only, spec-guaranteed identical) for the first paint and only applying
  the trig-based organic scatter from inside a client-only `useEffect`,
  after hydration has already reconciled. A second bug surfaced while
  testing search + node-selection together: dimming combined the two
  lenses with an implicit AND (a node had to satisfy both to stay
  visible), so selecting a node with no connection to the current search
  term dimmed the entire graph to nothing — fixed to a union (a node
  stays visible if it satisfies _either_ active lens). Reuses
  `getContentGraph()` unchanged (no data-layer change); `.dossier`
  overrides reassert the three kind-specific border colors at higher
  specificity than the generic `.dossier .tech-graph__node` rule (which
  flattens borders uniformly — correct for the single-item relationship
  graph's one-center case, wrong for a 33-node overview that needs
  technology/skill/knowledge to stay visually distinguishable). Verified
  with typecheck, lint, format, vitest 61/61, and a live pass (fresh-tab
  reload confirmed zero hydration errors, selection + search + category
  filter combinations checked via computed DOM state, mobile width at
  375px with no horizontal overflow, console clean).

With `/network` done, the whole User-facing Product is now on the
dossier system. The Internal Workspace (`docs/architecture.md` —
workspace pages intentionally keep their own dark console look, separate
from the User-facing Product) remains the only surface still on the
original system, by design, not as unfinished migration work.

### Dark mode (system preference only, 2026-07-15)

Owner-decided the same day the `/network` round shipped: dark mode
follows `prefers-color-scheme: dark` only — no manual toggle, no
persisted state, matching the project's minimal-client-state pattern
elsewhere (`followed-tags.ts`, radar). Two options were discussed (system
preference vs. a localStorage toggle like the followed-tags pattern);
system preference won since it needs no new state or UI and is the
smaller, more contained change.

Almost every dossier rule already routes color through the seven
`--dossier-*` custom properties, so the entire dossier scope repaints
from one `@media (prefers-color-scheme: dark) { .dossier { ...7
redeclared properties... } }` block — custom properties resolve at paint
time, so every earlier `.dossier ...` rule picks up the new values
automatically with zero changes to the ~1100 lines of rules that
reference them.

Live verification surfaced a real scoping gap before this shipped:
`TopNav` (rendered once in `layout.tsx`, a sibling of every page's
content — not a `.dossier` descendant, and shared with the Internal
Workspace too) and the `body` background gradient (visible as light
gutters on either side of `.main-content` on wide viewports, since
`.main-content` is width-capped and centered) both use hardcoded light
colors outside the `.dossier` scope. Theming only `.dossier` would have
left readers with a dark page body under a still-light nav bar and light
gutters down the sides — a visibly half-finished result. Owner confirmed
folding both into this round rather than shipping the gap. `TopNav`'s
dark variant is unconditional (not scoped to `.dossier`), so it also
applies on Internal Workspace pages — harmless/likely an improvement,
since the workspace rail is already dark; the workspace's own
`--workspace-*` styling is untouched otherwise. A few small hardcoded
color literals inside the dossier scope (the `.dossier-card` shadow tint,
and the three kind-specific node border colors added for `/network`)
were deliberately left unchanged — they read as reasonable accent colors
against a dark ground too, and touching them wasn't needed for
correctness. Verified with typecheck, lint, format, vitest 61/61, and a
live pass forcing both color schemes via the browser's color-scheme
emulation (dark: `.dossier`/`.top-nav`/`body` all repaint correctly on
`/network` and a workspace page, zero console errors; light: unchanged
from before, zero regressions).

### Dark-mode contrast completion round (2026-07-16)

Owner-reported: some interface text was too close to its background to
read. A WCAG contrast scan (per-text-node effective-background
computation, run in both color schemes across the public pages and the
workspace) located the cause almost entirely in **dark mode**: the
2026-07-15 dark round only redeclared the seven `--dossier-*` tokens
plus TopNav/body, so every component styled through the older generic
root tokens (`--muted`, `--user-ink`, `--accent`, `--surface-strong`,
...) or hardcoded light-mode colors ended up "half dark" — light panels
under dark-mode light text (`.user-page-header`'s paper gradient, the
tech-detail aside panels, `.home-news-row`, the digest meta strip;
ratios 1.2–2.3) or light-mode dark inks on dark dossier surfaces (the
relationship-graph headings/nodes, hardcoded `#34404a`-family body copy
on the tech/skill pages; 1.16–2.6).

The fix keeps the original round's architecture and finishes it:

- the dark `.dossier` block now also redeclares the generic root tokens
  (scoped to `.dossier`, so the light-by-design Internal Workspace is
  unaffected), which fixed every var-driven failure at once;
- targeted dark overrides remap the hardcoded leftovers to dossier
  tokens (page-header backgrounds drop to the dark ground, aside panels
  to `--dossier-surface`, the `#34404a`/`#34465b`/`#40546a` copy inks to
  `--dossier-ink`/`--dossier-muted`, `#00796f` accents to
  `--dossier-accent`, the graph nodes to surface chips);
- three marginal token values were nudged one step for 4.5:1 small-text
  contrast: dark `--dossier-stamp` `#c97a62`→`#d28a73` (was 4.39 on the
  dark surface), light `--dossier-muted` `#6d6b5b`→`#62604f` (was 4.32
  on the light ground), and `--workspace-nav-active` `#0d9488`→`#0f766e`
  with explicit white active text (was 2.83 — a pre-existing light-mode
  issue too);
- the Internal Workspace, whose light design sat directly on the
  unconditionally-dark body in dark mode (breadcrumbs/headings at
  1.2–2.0), gets an opaque light board behind `.workspace-shell` in dark
  mode instead of a dark redesign;
- accent-on-accent-tint pills (skill hero meta, news tag chips) switch
  their text to ink on the tint.

Re-scanned to zero failures on `/`, `/technologies` (all views), a
technology detail page, `/digest/today`, `/skills` + a skill detail,
`/knowledge` + a knowledge detail, `/network`, `/search`,
`/topics/[tagId]`, and `/workspace/skills`, in both schemes (the few
remaining reports in the light workspace were confirmed to be scanner
artifacts of gradient averaging, not real failures). Zero console
errors; light mode visually unchanged apart from the two one-step token
nudges.

### Flat cards (2026-07-15)

Owner-directed: `DossierCard`'s per-index resting tilt (three rotation
angles cycled by `cardTilts[index % cardTilts.length]`, straightened on
hover) read as too literal/busy once seen across full card grids on real
pages, and was replaced with a flat rest state. Three replacement
directions were mocked up and compared side by side before deciding: (A)
flat with no added ornament, (B) flat plus a folded-corner accent
(`clip-path` + a triangle pseudo-element) to keep some "physical paper"
character, and (C) flat plus a left tab-spine colored by content kind
(technology/skill/knowledge), echoing a folder-tab. C was ruled out during
discussion, not on visual grounds — reusing the technology/skill/knowledge
three-color code (see `RelationshipGraph`/`ContentNetworkGraph` above) only
carries information where multiple kinds appear in the same view; on a
single-kind list page (e.g. every card on `/skills` would show the same
spine color), it would have been decoration with no signal, the exact
failure mode the three-color system elsewhere is careful to avoid. Option
A (plain flat) was chosen.

Implementation was CSS-only: `.dossier-card--tilt-a/b/c` and the
`rotate(...)` in `.dossier-card:hover` were removed from `globals.css`,
leaving `.dossier-card:hover { transform: translateY(-3px); }` (desktop)
/ `-2px` (≤640px). `DossierCard`'s `tilt` prop and the `cardTilts` cycling
arrays in every call site (`technology-browser.tsx`, `my-radar-content.tsx`,
`digest/page.tsx`, `knowledge/page.tsx`, `skills/page.tsx`,
`dossier-technology-card.tsx`, `page.tsx`) were deliberately left
unchanged — the `dossier-card--tilt-*` class names still land in the DOM,
they're just inert with no matching CSS rule. Removing that prop
plumbing from every call site is a separate, deferred cleanup, not bundled
into this visual change. Verified with typecheck, lint, format, vitest
61/61, and a live check that `.dossier-card` elements compute
`transform: none` at rest across `/technologies`, `/skills`, and `/`,
with zero console errors.

### `/network` dot nodes (2026-07-15)

Owner-reported: the whole-graph overview felt chaotic, and got worse when
the page was zoomed. Measured before changing anything (headless overlap
detection over `getBoundingClientRect()`, not a guess): at desktop width
the 33 node labels (avg. ~112px wide) overlapped in **44 pairs** inside a
568×568px canvas; at a narrower simulated-zoom width the same graph hit
**93 overlapping pairs** in a 305×320px canvas. Root cause: the
force-directed layout's "ideal distance" is computed from canvas
area ÷ node count, which assumes point-like nodes — it never accounted
for each node's actual rendered label footprint, so at 33+ nodes the
labels were simply too wide for the space the physics gave them,
independent of how well-tuned the physics constants were. The global nav
and other breakpoints were checked at the same widths and found intact —
the "gets worse when zoomed" report was this same overlap problem
scaling with the shrinking canvas, not a separate layout bug.

Two directions were discussed: (A) keep always-visible text labels and
throw more room at the problem (bigger canvas, single-line ellipsis
titles), or (B) make nodes small dots by default, with the full title
label appearing only for a hovered, selected, or search-matched node.
(B) was chosen — it's the standard scalable pattern for dense force
graphs and doesn't run out of headroom as node count grows, unlike (A).

Implementation: `ContentNetworkGraph` no longer reuses `RelationshipGraph`'s
`tech-graph__node`/`tech-graph__node--<kind>` classes (that class family
still serves its original single-item-graph consumer unchanged). Node
buttons now render a small `.content-network__node-dot` (11px resting,
15px on hover/select/focus, kind-colored fill — fixed hex, not
`--dossier-*` tokens, consistent with this file's precedent of leaving
small accent colors constant across themes) plus an optional
`.content-network__node-label` (a small paper-style tag, positioned above
the dot, `pointer-events: none` so it can't intercept clicks). The label
shows when `node.id === selectedId`, `node.id === hoveredNodeId` (new
state, wired the same way `hoveredEdgeId` already was), or the node
matches the active **search text** specifically — deliberately not
general filter-match, since kind-filter alone can still select a dozen-
plus nodes (e.g. all 17 technology nodes) and forcing every one to show
its label at once would recreate the original crowding problem. Every
node button keeps `aria-label`/`title` set to the full title regardless
of visual label state, so the accessible name and native tooltip are
unaffected by the redesign. The panel's default hint line was updated to
say hovering/searching reveals names, since the always-on label — a
discoverable-by-default affordance — was removed.

Re-measured after the change: **zero overlapping dots** at both the
568×568px desktop canvas and the 305×320px narrow-zoom canvas (down from
44 and 93 label-overlap pairs). Verified with typecheck, lint, format,
vitest 61/61, and a live pass (search-driven labels show exactly the
matching subset, selecting a node shows exactly its own label plus the
connections panel, dark mode's dot ring color matches the canvas
background instead of showing a stray white ring, zero console errors).

### `/network` edge focus + relation-type legend (2026-07-15, same day)

Owner-approved follow-up after node overlap was fixed: measured edge
crossing density separately from node overlap (segment-intersection test
over all edge pairs) and found **789 crossing pairs among the 88 edges**
— roughly a fifth of all possible pairs. Two mockup directions were shown
before implementing (a three-panel before/current/after comparison plus a
legend mock): edges now rest at low opacity (0.35, down from effectively
full solid-color visibility under `.dossier`) and a selected node's own
edges pop to full opacity in the stamp accent color, while everything
else stays faint or drops further via the existing `--dim` class (0.15)
— "quiet until you focus on something" instead of "everything at once".
This reused the existing `isActive`/`isDimmed` per-edge class logic
unchanged; only the CSS `opacity` values for `.content-network__edge`
(new: `opacity: 0.35`) and `.content-network__edge--active` (new:
`opacity: 1`) needed to change — no component logic changes.

Separately, the panel's resting-state legend gained a **relation-type**
section below the existing technology/skill/knowledge kind legend: a new
`relationTypes` memo derived from the actual `edges` prop
(`Array.from(new Set(edges.map(e => e.relationType)))`, deduplicated and
sorted, so it always reflects real data rather than a hardcoded list),
rendered as a wrapped row of `DossierStampTag`s under a small "关系类型"
eyebrow heading — the same relation-type labels already shown per-
connection in the selected-node panel and on edge hover, now also visible
as a glossary before a reader has interacted with anything.

A verification detour worth recording: an early opacity check in the
browser automation tool reported the wrong value (0.35 for both active
and dim edges) immediately after clicking a node. Direct inspection with
`Element.getAnimations()` showed the CSS transition's `currentTime` frozen
at `0` and `document.hidden === true` — the automation tab is reported as
backgrounded, and browsers throttle CSS transition timelines in hidden
tabs. Calling `.finish()` on the stuck animations immediately produced the
correct values (`1` and `0.15`), confirming the CSS itself was correct
and the discrepancy was purely a side effect of how the test tab reports
visibility, not a real bug. Verified with typecheck, lint, format, vitest
61/61, and a live pass (resting opacity 0.35 confirmed directly, active/
dim target values confirmed via forced-animation-completion after ruling
out the tab-visibility artifact, relation legend renders all 7 relation
types actually present in the real data, zero console errors on a fresh
tab).

### Digest page rejoins the detail-page hero (2026-07-29)

Owner-reported: `/digest/today` had visibly drifted out of the system. The
underlying cause was structural rather than cosmetic — **the page had its own
hero primitive**.

Public pages use two hero primitives, and the split is deliberate:

- **List pages** (`/technologies`, `/skills`, `/knowledge`, `/digest`) use the
  shared `PageHeader` → `.user-page-header`, rendered by `UserPageShell`.
- **Detail pages** (`/technologies/[slug]`, and now the digest pages) pass
  `showHeader={false}` and render `.user-article-hero` as the first content
  block, per `docs/page-structure.md` → "User-facing Detail Page".

The digest pages did the first half of that (they passed `showHeader={false}`,
and threw the `title`/`description` props away) but then hand-rolled
`daily-digest-brief-header` instead of using `.user-article-hero` — a
`minmax(0,1fr) auto` grid that resolved to `507.5px | 174px`, with the narrow
column holding four counts and standing three-quarters empty beside 522px of
prose. It also redefined the h1 at a smaller step, skipping
`.user-article-hero h1`'s `text-wrap: balance` / `overflow-wrap: anywhere`.

`daily-digest-brief-header` is now a two-line modifier on top of
`.user-article-hero` (single column, `align-items: start`, a wider `24ch`
measure because a digest title carries a date). The counts moved to an inline
row under the title, matching `.technology-detail-hero__meta`.

Three related fixes in the same round, all leftovers of the 2026-07-14 dossier
migration, which swapped `<div>`s for `DossierCard`s **without removing the
CSS the old markup needed**:

- `.digest-source-chip` kept `border-radius: 999px` from its pill era, so every
  253×177 source card rendered as an ellipse. Note that the 2026-07-14 round
  _did_ add `.dossier .digest-source-chip p/h3` colour rules — the class was
  looked at, and only its colour was adjusted.
- `.digest-technology-card__audience` kept `font-weight: 800`, out-shouting the
  card title.
- `值得跟踪` used a one-column grid against `今日立即关注`'s two.

**Typography-scale gap surfaced, not fixed.** `--fs-display` is a flat `44px`
with no mobile step, and all public hero h1s are pinned to it with
`!important`. The digest is the only page whose title contains an unbreakable
10-character run (`YYYY-MM-DD`), so at 390px the date needs 260px against
244px of measure and reaches 16px into the hero's 22px padding. Keeping the
date on one line (`renderTitleWithUnbreakableDates` + `.nowrap-run`) is
strictly better than splitting it at a hyphen, but the real fix is a
responsive step on `--fs-display`, which would move every public hero and is
therefore an owner decision.

**Contrast note.** Moving the counts out of their white inset box put them on
the dossier paper surface, where the hardcoded `#64748b` measured **4.4:1** —
0.1 under AA. They now inherit `--dossier-muted` (5.87 light / 5.42 dark).
This is the same failure mode as the 2026-07-16 round: a colour that was fine
against one surface silently fails against another, and only measurement
catches it.

### Site-wide visual sweep (2026-07-29, same day)

Two reusable detectors came out of this round. Both were **proven to fire
before their clean results were trusted** — the discipline that the same day's
`AGENTS.md` "Visual verification rule" now requires.

**Flush-edge detector.** Flags any element that draws a full border or a
filled background yet has a side with under 4px of padding. It found the
worst-looking defect of the day: the 2026-07-14 dossier migration applied
`background` + `border` + `border-radius` to five digest containers in one
rule, but three of them had never carried padding, because until that moment
they were invisible layout grids. **A skin and a box model are separate
decisions — adding the first without revisiting the second is how a layout
wrapper becomes a card with text welded to its border.** When adding a
surface to an existing element, check its padding in the same edit.

**Content-overflow detector.** Flags an element painted past its parent's
content box. It found a 105px overflow on all 31 technology detail pages,
traced to a native `<select>` whose options are full technology titles.

The general rule that came out of it: **`min-width: 0` on a grid or flex
column is not enough — its children need it too.** A grid item defaults to
`min-width: auto`, so it refuses to shrink below its content's min-content
width, and one wide descendant re-widens the column its parent carefully
constrained. `.user-article-layout__main > *` and `__aside > *` now carry the
guard. Note also that `max-width: 100%` cannot break this cycle when the
track is being sized _from_ the element's own min-content contribution — the
percentage just resolves back to the oversized track.

### Chinese line breaking: what CSS can and cannot do (2026-07-29)

Measured in Chrome 148 against a Japanese and a Chinese control string:
`word-break: auto-phrase` **changes Japanese line breaks and leaves Chinese
byte-identical**. The feature works; it has no Chinese segmentation. Do not
reach for it here again.

What does work is `Intl.Segmenter('zh-CN', { granularity: 'word' })`, which
runs on the server, so `src/lib/cjk-line-break.ts` produces final markup at
render time and headings never reflow after hydration. It reduces mid-word
breaks; it does not eliminate them — the ICU dictionary keeps 旗舰 / 关注 /
参数 / 承诺 together but splits 权重 / 智能体 / 轻量 / 付费. Those gaps are
asserted in `cjk-line-break.test.ts` so a future improvement surfaces as a
failing expectation instead of passing unnoticed.

**Rejected after measuring, not before:** making `--fs-display` responsive
(`clamp(28px, 4.2vw, 44px)`) produced **identical** breaks at 1600px, 1014px
and 768px and made the detail title _worse_ at 390px — three lines became
five, newly splitting 参数 and 承诺. `--fs-display` still has no mobile step,
which is a real gap (it is why a digest date reaches 16px into the hero's
padding at 390px), but fixing word-splitting is not what it does.

### One skeleton for every public detail page (2026-07-29, second sweep)

The four public detail pages — `/technologies/[slug]`, `/skills/[slug]`,
`/knowledge/[slug]` and the digest pages — now share one geometry, not just one
skin:

```
hero            full measure
body            reading column | aside
```

Measured at 1440px, all four render their hero, reading column and aside on the
same four edges: **272 / 860 / 888 / 1168**.

Before this round the skill and knowledge pages placed the hero **inside** the
reading column, so the aside stood level with the title, and the layout used its
own `min(1120px, 100% - 32px)` container. Their hero was 618 against the
technology page's 896, their column 618 against 588, their aside 300 against 280. Every visual property already matched — the same paper fill, 2px radius,
32px padding and 44px `h1` — which is exactly why this was easy to miss:

> **The skin and the box model are separate decisions.** This is the third form
> the same split has taken (digest sections given a surface but never padding;
> the digest hero given the shared look but not the shared box; now the skill
> hero given the shared look while living in the wrong slot). When a page is
> said to "use the shared primitive", check its measured geometry, not its
> declarations.

The hero had to move in JSX — CSS alone cannot lift a grid item out of its
column — so the fix added `.skill-detail-layout__body` and carried across the
`min-width: 0` guard from `.user-article-layout__body`, since the new column has
the same hazard.

**Known and unfixed:** the aside runs out at roughly a quarter of the page on
all three aside-bearing detail pages, leaving 73–85% of the right side empty.
Sharing one skeleton turns that into a single decision instead of three.

### Colours that are fine on one surface (2026-07-29, second sweep)

`.empty-state--actionable` hardcodes a near-white fill and a slate dashed
border. When the 2026-07-16 round redeclared the text tokens for dark mode, the
fill stayed white and the text went light: **1.19:1** for the heading, 2.52:1
for the body, 2.82:1 for the link. Seven public surfaces render this component.

This is the same failure the 2026-07-16 round was itself written to fix,
recurring in a component that round did not touch. The durable form of the rule:

> A hardcoded colour is a promise about the surface underneath it. Any round
> that changes surfaces must re-measure every hardcoded colour, not only the
> tokens.

Fixed by redeclaring the fill and border inside the dark block, scoped to
`.dossier` so the deliberately light Internal Workspace — which uses the same
class on three pages — is untouched. After: 11.53 / 5.42 / 4.84 dark, light
unchanged.

**Related, still open:** the site has three empty-state components
(`.empty-state`, `.empty-state--actionable`, `.dossier-empty-state`) with three
different looks. Only the failing one was fixed; unifying them would remove the
class of bug rather than the instance.

### What a detector cannot find (2026-07-29, second sweep)

The two detectors from the first sweep were re-proven to fire and then returned
**zero hits across 20 public routes** — while a full look-at-every-page pass
found 13 defects. The three that were fixed illustrate the gap precisely:

- an **unstyled button** has valid DOM, passing contrast and no overflow;
- a **dark-mode colour failure** needs the colour pair computed, not the markup
  inspected;
- a **geometry mismatch between sibling pages** is invisible on any single page
  and only appears when two pages are compared.

A detector encodes a defect you have already met. Screenshots are how you meet
the next one.

**Two claims were withdrawn in this round, both after measuring.** The view-tab
strip appeared to invert its selected/unselected hierarchy — sampling showed it
correct, and a muted brown had read as accent in a downscaled screenshot. More
seriously, a claimed 82px step on the digest page **reached the owner's
confirmation sketch before it was checked**: it came from comparing a padded
container's border box against its own child, and every digest block including
the hero in fact sits at 272/896. Eyeballing a screenshot generates a
hypothesis; it does not close one.

### A full-page screenshot flattens sticky positioning (2026-07-29, second sweep)

The sweep reported that the aside on all three aside-bearing detail pages "runs
out a quarter of the way down, leaving 73–85% of the right column empty". It was
read off the full-page captures, and it was wrong: those asides have carried
`position: sticky` since they were written. Scroll-testing all three confirmed
they stay pinned 86–96px below the viewport top for the entire page, releasing
only where their column ends.

A full-page capture renders the document at its static layout, so a sticky
element appears exactly once, at its unscrolled position. **An "empty column"
below a sticky element is therefore a known false positive of this method.**
When a full-page screenshot suggests a scroll-dependent defect — sticky headers,
sticky asides, scroll-triggered reveals, anything with `position: fixed` — drive
the page and sample the geometry at several scroll offsets before writing it up.

This is the third claim this sweep produced and then withdrew, and the three
have a shared shape worth naming:

| claim                       | how it was produced                       | how it fell           |
| --------------------------- | ----------------------------------------- | --------------------- |
| tab hierarchy inverted      | read off a downscaled screenshot          | sampled the colours   |
| digest hero 82px narrower   | compared two numbers from different boxes | measured the siblings |
| aside leaves the page empty | read off a flattened capture              | scrolled the page     |

Looking at a screenshot is how you **generate** a hypothesis about layout. It is
not how you close one. Every finding that survived to a commit in this round was
confirmed with a number first.
