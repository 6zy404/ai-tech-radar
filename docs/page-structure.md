# Page Structure

The project is now organized into two explicit subsystems:

- Internal Workspace
- User-facing Product

They can share components and visual language, but they do not share page responsibilities.

The page template and visual rules are documented in `docs/design-system.md`.
Workspace action hierarchy and button-copy rules are documented in
`docs/workspace-actions.md`.

## Page template families

### Workspace List Page

Used by:

- `/workspace/candidates`
- `/workspace/technologies`
- `/workspace/sources`
- `/workspace/duplicates`
- `/workspace/digests`
- `/workspace/delivery`
- `/workspace/delivery/schedules`
- `/workspace/operations`
- `/workspace/operations/events`

Purpose:

- search and filter internal records
- show operational status
- expose workspace actions
- support review, import, editing, and publishing workflows

These pages use `WorkspacePageShell` and `WorkspaceListToolbar`.

### Workspace Detail Page

Used by:

- `/workspace/candidates/[id]`
- `/workspace/technologies/[id]`
- `/workspace/sources/[id]`
- `/workspace/duplicates/[id]`
- `/workspace/digests/[date]`

Purpose:

- show object status and primary actions
- keep source and workflow traceability visible
- keep internal fields available without making them look like user-facing content
- place raw payload or technical snapshots in lower-priority areas

### User-facing List Page

Used by:

- `/`
- `/news`
- `/technologies`
- `/skills`
- `/knowledge`

Purpose:

- explain the public product entry point
- help users quickly scan published technology items
- help users choose a daily brief, technology signal, skill, or knowledge concept
- prefer Chinese content when available
- keep source, publish date, language availability, and tags visible
- avoid internal fields and reviewer actions

### User-facing Detail Page

Used by:

- `/technologies/[slug]`
- `/digest/today`
- `/digest/[date]`
- `/skills/[slug]`
- `/knowledge/[slug]`

Purpose:

- prioritize reading and understanding
- show title, summary, content, source link, tags, and related knowledge / skills
- support Chinese / original content switching
- avoid raw payload, review status, source health, and duplicate workflow data
- omit the generic page header so the article hero is the first meaningful content block

## Internal Workspace routes

- `/workspace`
  - Internal Editorial Workspace Dashboard
  - internal-only entry point for reviewers, editors, and maintainers
  - explains the internal workflow from Sources -> Import -> Candidates -> Duplicates -> Drafts -> Publish -> Digests -> Delivery -> Schedules
  - shows real local status counts for enabled sources, new candidates, open duplicate groups, drafts, published technologies, digest drafts, delivery channels, and delivery schedules
  - provides a small set of true next actions: importing enabled sources, reviewing candidates, resolving duplicates, editing drafts, managing digests, and opening operations
  - shows a compact operations summary for system health, attention-required count, failed deliveries, failed sources, and latest task-runner state
  - shows recent import, technology workspace, digest, delivery, and scheduled delivery activity when local records exist
  - uses a dark grouped workspace rail on desktop so internal modules are clearly separated from public product navigation
- `/workspace/sources`
  - internal source management list
  - batch import entry for enabled sources
  - latest batch import summary
  - search
  - source type filter
  - enabled / disabled filter
  - latest import status
  - latest import count, failure count, and latest message
  - source quality level, success rate, duplicate rate, and conversion rate
  - enable / disable controls
  - manual source import controls
- `/workspace/sources/new`
  - lightweight source creation form
- `/workspace/sources/[id]`
  - source configuration detail
  - latest import status and message
  - latest import count, latest error, consecutive failure count, total imported count
  - source quality breakdown
  - edit source fields
  - enable / disable source
  - run import for a single source
  - recent imported candidates generated from this source
- `/workspace/candidates`
  - imported candidate review list
  - search
  - source type filter
  - normalized type filter
  - import status filter
  - duplicate hints
  - candidate quality flags for missing fields, duplicate risk, short content, and draft readiness
  - rule-based priority badge for reviewer triage
- `/workspace/duplicates`
  - duplicate group review list
  - open / resolved / ignored group overview
  - entry point for selecting primary candidates
  - internal-only duplicate reasons and group status
- `/workspace/duplicates/[id]`
  - candidate comparison for one duplicate group
  - primary candidate selection
  - resolve / ignore / reopen group actions
  - prevents non-primary duplicate conversion into separate drafts
  - keeps non-primary sources as additional references for the generated draft
- `/workspace/candidates/[id]`
  - imported candidate review detail
  - overview header
  - original summary / content
  - source traceability
  - duplicate comparison section
  - priority level, reasons, warnings, and ranking source
  - review actions
  - raw payload snapshot at the bottom
- `/workspace/technologies`
  - internal technology workspace list
  - draft / published / archived records generated from imported candidates
  - priority badges for draft triage
  - empty state links reviewers back to Candidates because workspace technology detail pages exist only after candidate conversion
- `/workspace/technologies/[id]`
  - internal technology workspace detail
  - editorial notes
  - source candidate traceability
  - draft editing for content, source metadata, tags, related content, and Content Intelligence fields
  - Editorial Enrichment suggestion panel for rule-based, mock LLM, or optional LLM-assisted generation, current-vs-suggested comparison, apply, reject, and regenerate
  - ranking source, priority reasons, and priority warnings
  - publish readiness checks
  - publish / archive actions
  - link to the user-facing page when the record is published
  - applied / rejected / stale enrichment actions are recorded as internal WorkflowEvent entries
- `/workspace/technologies/[id]/preview`
  - user-facing technology detail preview for an unpublished workspace record
  - reuses the user-facing detail renderer
  - does not render internal-only fields such as raw payload, import status, normalized type, or duplicate group
- `/workspace/digests`
  - internal digest list
  - generate today's digest
  - status counts for draft / published / archived digests
  - preview and edit entry points
- `/workspace/digests/[date]`
  - generated digest review and editing detail
  - edit title, summary, editorial summary, and editorial notes
  - selected immediate-attention and watch technologies
  - manual add, exclude, pin, and move up / move down controls
  - publish readiness checks for blocking errors and warnings
  - delivery status, public feed URLs after publication, and share text preview
  - manual delivery to enabled webhook or Feishu webhook channels after publication
  - recent delivery logs for the digest
  - ranking reasons for workspace reviewers
  - related skill / knowledge counts and source count
  - publish / archive controls
- `/workspace/digests/[date]/preview`
  - user-facing digest preview before publication
  - does not make a draft digest publicly available
- `/workspace/delivery`
  - workspace-only delivery channel and delivery log console
  - create and edit generic webhook and Feishu bot webhook delivery channels
  - enable / disable channels
  - inspect masked endpoint URLs, last delivery status, and latest message
  - inspect delivery logs, HTTP response status, errors, and retry linkage
  - retry failed delivery runs
  - not shown in user-facing navigation
- `/workspace/delivery/schedules`
  - workspace-only local scheduled delivery console
  - create and edit schedules for published digest delivery
  - enable / disable schedules
  - run one schedule manually
  - run all due schedules
  - shows local task runner commands: `npm run tasks:run-once` and `npm run tasks:watch`
  - shows the latest `TaskRunnerRun` summary when the command-line runner has executed
  - inspect next run time, last run status, skipped channel count, and linked delivery logs
  - shows the scheduled-import (定时导入) panel: enable/disable the task-runner
    daily source import, edit its daily time, and inspect its next/last run
    plus the latest batch import result
  - keeps schedule configuration, schedule run logs, task-runner logs, and command-line runner details out of user-facing pages
- `/workspace/operations`
  - workspace-only operations dashboard
  - shows system health status, source health, latest import status, latest task-runner status, latest scheduled-delivery status, latest digest status, failed delivery count, and failed workflow event count
  - lists attention-required items such as failed imports, failed deliveries, failed scheduled runs, open duplicate groups, candidate quality issues, and failed WorkflowEvent records
  - shows recent workflow activity and quick links to failed-source, delivery, task-runner, duplicate, digest, and event views
  - sanitizes endpoint-like and token-like values before display
- `/workspace/operations/events`
  - workspace-only WorkflowEvent browser
  - filters by entity type, action, and actor type
  - shows event metadata and before/after snapshots in truncated low-weight panels
  - does not expose full endpoint URLs or token-like values

Legacy routes:

- `/candidates`
- `/candidates/[id]`
- `/technologies/drafts`
- `/technologies/drafts/[id]`

These now redirect to the matching workspace routes.

Workspace deployment boundary:

- `/workspace/*` should be protected before exposing the app outside local development.
- `/api/workspace/*` and `/api/candidates/*` are internal mutation APIs and share the same protection boundary.
- User-facing routes must not call workspace mutation APIs.
- `WORKSPACE_ACCESS_ENABLED=true` turns on the minimal token guard.
- `WorkspacePageShell` renders a compact internal-area warning so operators see the local JSON, endpoint, and task-runner constraints in context.

## User-facing Product routes

- `/`
  - product home
  - explains the public value proposition: what to read first, why it matters, and what background is needed
  - provides three public entry cards for Daily Digest, Technology Signals, and Skills / Knowledge
  - highlights the latest published Daily Digest as the primary start point
  - highlights high-priority published technology signals
  - links readers into Skills and Knowledge as understanding paths
  - links to `/digest/today`, `/technologies`, `/skills`, and `/knowledge`
  - shows a compact latest-news board (今日快讯) linking to `/news`, with the
    auto-aggregation disclaimer
  - does not show workspace actions, source health, delivery, audit, task-runner, or local JSON warnings
- `/news`
  - user-facing auto-aggregated news fast lane (今日快讯)
  - renders recently imported candidates (last 7 days, grouped by day) through
    the dedicated sanitizing map in `src/lib/news.ts` — title, truncated
    summary, source name, external source link, publish date, and display
    tags only
  - always labelled "自动聚合内容，未经编辑精选"; links converted + published
    items to their formal technology signal page
  - hides rejected candidates, fallback placeholder candidates, and
    non-primary duplicates; shows a guided empty state when the window is
    empty
  - does not show import status, raw payloads, candidate IDs, duplicate
    internals, source health, or any workspace action
- `/technologies`
  - user-facing published technology list
  - bilingual content preference for title and summary
  - uses a compact signal-stream layout on desktop so users scan one curated item at a time instead of reading a workspace-style grid
  - cards show signal type, signal strength, audience fit, Content Intelligence why-watch summary, reading difficulty, source, tags, and related context counts
  - cards show productized priority labels such as immediate attention / worth tracking / good to know
  - user-facing wording must not expose demo / mock semantics
- `/technologies/[slug]`
  - user-facing published technology detail
  - bilingual content reading
  - source name, publish date, and original link without making long URLs dominate the page
  - productized priority label and short explanation
  - Content Intelligence modules for why it matters, who should care, technical context, impact areas, reading difficulty, learning path, and follow-up questions
  - tags; the 主题标签 reference panel renders follow-toggle chips
    (`FollowableTagList`) so readers can add the signal's topics to their
    personal radar in place (hero tags stay static)
  - related knowledge as background for understanding the signal, with per-item explanations when available
  - related skills as a practical path for evaluating or acting on the signal, with per-item explanations when available
  - a compare widget (between the related-technologies and related-skills sections) that lets a reader request a live AI-generated comparison against another published technology; always shown with a persistent "AI-generated, not reviewed" disclaimer — the first client-triggered live-generation call anywhere in the User-facing Product (every other data flow on this page is a static server read)
  - an explain widget (between the technical-context and who-should-care sections) that lets a reader pick their experience level (入门 / 进阶 / 资深) and request a live AI-generated explanation of the current technology tailored to that level, cached per technology × level; same persistent "AI-generated, not reviewed" disclaimer discipline as the compare widget
  - a learning-path widget (between the editor-curated learning-path section and the relationship graph) that lets a reader request a live AI-generated learning path grounded in the technology's related knowledge and skills from the content graph, cached per technology; same disclaimer discipline
- `/digest/today`
  - user-facing daily digest entry point
  - shows today's published digest when available
  - otherwise shows the latest published digest, or a public empty state when no digest has been published yet
- `/digest/[date]`
  - user-facing published digest for a specific date
  - shows immediate-attention technologies, worth-tracking technologies, Content Intelligence why-watch snippets, related skills, related knowledge, and source names
  - links to public RSS and JSON feed surfaces without making feeds dominate the reading page
  - personalized view (P4 v0.2, shared with `/digest/today` via
    `DailyDigestContent`): items matching the reader's followed topics carry a
    命中关注 line, and a 只看我关注的 toggle filters the signal sections
    client-side (localStorage follows only; the served content is identical
    for everyone); readers with no follows see one hint line linking to
    `/radar`
  - does not show internal ranking scores, quality flags, candidate data, duplicate group data, manual digest controls, editorial notes, or workspace actions
- `/feed.xml`
  - public RSS feed generated from published daily digest records only
  - excludes draft and archived digests
  - links feed items to `/digest/[date]`
- `/feed.json`
  - public JSON feed generated from published daily digest records only
  - includes digest date, title, summary, public URL, selected public items, skills, knowledge, and source names
  - excludes internal workflow fields
- `/skills`
  - user-facing skill index
  - presents skills as practical abilities for evaluating new AI technology signals
  - shows skill type, heat, learning cost, related published technology examples, and public tags
  - does not show internal quality, reviewer, delivery, or source data
- `/skills/[slug]`
  - user-facing skill detail
  - explains what the skill helps readers do
  - links to published technology signals where the skill is useful
  - links to background knowledge that makes the skill easier to apply
  - the 主题 tags card renders follow-toggle chips (`FollowableTagList`) so
    readers can add the skill's topics to their personal radar in place
- `/knowledge`
  - user-facing knowledge index
  - presents durable concepts that help readers understand fast-moving AI signals
  - shows category, difficulty, related skill count, related published technology examples, and public tags
  - does not show internal quality, reviewer, delivery, or source data
- `/knowledge/[slug]`
  - user-facing knowledge detail
  - explains why the concept is foundational
  - links to published technology signals explained by the concept
  - links to skills that use the concept
  - the 主题 tags card renders follow-toggle chips (`FollowableTagList`) so
    readers can add the concept's topics to their personal radar in place
- `/radar`
  - user-facing personal radar (P4 v0)
  - readers follow topic tags via toggle chips; follows live only in browser
    localStorage (no accounts, no server-side profile)
  - aggregates published technologies whose tags intersect the followed set,
    grouped by the existing deterministic Ranking v0 priority levels and
    date-sorted within groups, reusing `TechnologyListCard`
  - each matched item shows an explicit "命中关注：X" explanation line
  - guided empty states for "no follows yet" and "follows but no matches"
  - does not show internal quality, reviewer, delivery, or source data
- `/network`
  - user-facing whole-network overview
  - renders every published technology, skill, and knowledge item as a node in
    one graph (grouped by kind into three lanes), with an edge for every
    declared relationship and its semantic type
  - clicking a node highlights its direct connections and opens a side panel
    with the node's title, a link to its own detail page, and its connection
    list (relation-type pill + linked title per connection); clicking again
    deselects
  - a lighter, list-based reading of the same node/edge data readers already
    encounter via the per-page `RelationshipGraph`, `RelatedItemsSection`, and
    `RelationDensity` — this page is the one place to see the whole graph at
    once instead of one node's neighbourhood
  - does not show internal quality, reviewer, delivery, or source data
- `/search`
  - user-facing site-wide keyword search (「搜索」 in `TopNav`)
  - server-rendered `?q=` GET form; deterministic case-insensitive substring
    matching on title / summary / tag display names only, with
    space-separated terms ANDed
  - searches the four public content pools: published technology signals,
    skills, knowledge, and the news fast lane; results render grouped per
    content type with counts
  - news results reuse the `src/lib/news.ts` public mapping (`PublicNewsItem`)
    and the news group always carries the fixed 自动聚合 disclaimer
  - guided empty states for "no query yet" and "no matches"
  - does not show internal quality, reviewer, delivery, or source data

## User-facing public view model

Public pages should render safe view data only. Allowed fields include:

- title, summary, and content
- source name, source URL, publisher, and publish date
- tags
- user-friendly priority label and short public reason
- Content Intelligence fields such as `whyItMatters`, `whoShouldCare`, `technicalContext`, `impactAreas`, `learningPath`, `relatedKnowledgeExplanations`, `relatedSkillExplanations`, and `followUpQuestions`
- related public skills and knowledge
- published digest title, summary, selected public technologies, related skills, related knowledge, source names, and public feed URLs

Forbidden on public pages:

- `rawPayload`
- `importStatus`
- `normalizedType`
- `duplicateGroupId`
- `qualityFlags`
- audit or workflow event logs
- delivery logs, delivery channel configuration, schedules, and endpoint URLs
- LLM prompt metadata, suggestion status, reviewer notes, and workspace-only enrichment metadata
- workspace access token or deployment warnings

## Shared component patterns

- `WorkspaceNav`
  - workspace-only grouped navigation for Overview, Sources, Candidates, Duplicates, Drafts, Digests, Delivery, Schedules, and Operations
  - desktop presentation is a dark left rail; narrow screens collapse it into a compact horizontal module navigation
- `WorkspaceBreadcrumbs`
  - workspace-only breadcrumb trail for detail, preview, and creation pages
- `WorkspacePageShell`
  - workspace-only page framing for review, import, source management, and publishing workflows; renders workspace navigation and breadcrumbs
- `PageHeader`
  - shared header primitive used by workspace and user-facing shells with variant-specific styling
- `WorkspaceListToolbar`
  - workspace-only list count and operational summary
- `WorkspaceStatusBadge`
  - workspace-only status treatment for internal technology records and operational state
- `UserPageShell`
  - user-facing page framing for published content
- `UserArticleLayout`
  - user-facing technology detail article layout
- `MetadataRow`
  - compact metadata row, used with different page-level styling
- `TagList`
  - safe public tag rendering helper
- `FollowableTagList`
  - user-facing client component rendering an item's tags as the same
    follow/unfollow toggle chips used on `/radar` (localStorage-backed via
    `src/lib/followed-tags.ts`, reusing the `my-radar__tag-toggle` styles),
    with a hint line linking to `/radar` when any of the page's tags is
    followed; used by the tags section on the technology, skill, and
    knowledge detail pages (hero and related-card tags stay on `TagList`)
- `SourceReference`
  - user-facing original source reference section
- `PageShell`
  - legacy shared page framing for non-refactored foundation pages
- `TopNav`
  - shared global navigation for user-facing Home, Daily Digest, News, Technologies, Skills, Knowledge, Network, My Radar, Search, and the secondary Workspace entry point
- `DetailInfoCard`
  - shared reference / metadata card
- `TagBadge`
  - shared tag presentation
- `RelatedItemsSection`
  - user-facing wrapper for related skills and knowledge inside the article layout
- `RelationshipGraph`
  - shared per-item relationship visualization rendered on the technology,
    skill, and knowledge detail pages: the current item at the centre with its
    directly related technologies/skills/knowledge as clickable, colour-coded,
    tooltip-labelled spokes
- `RelationDensity`
  - shared "关联 · N 技术 · N 技能 …" density line used by all three index cards
- `ContentNetworkGraph`
  - user-facing whole-network overview for `/network`: every published node
    laid out by kind with every relationship edge, click-to-focus exploration,
    and a connection-list side panel
- `TechnologyCompareWidget`
  - user-facing, client-side AI comparison trigger and result panel on the
    technology detail page: pick another published technology, request a live
    comparison from `POST /api/technologies/compare`, always render the
    "AI-generated, not reviewed" disclaimer in the same paint as the result
- `TechnologyExplainWidget`
  - user-facing, client-side per-level AI explanation trigger and result panel
    on the technology detail page: pick an experience level (入门 / 进阶 /
    资深), request a live explanation from `POST /api/technologies/explain`,
    same disclaimer discipline as `TechnologyCompareWidget`
- `MyRadarContent`
  - user-facing client component for `/radar`: followed-tag toggle chips
    (localStorage-backed via `src/lib/followed-tags.ts`), deterministic
    priority-grouped matching of published signals, per-item matched-topic
    explanation line, and guided empty states
- `TechnologyLearningPathWidget`
  - user-facing, client-side AI learning-path trigger and result panel on the
    technology detail page: request a graph-grounded learning path from
    `POST /api/technologies/learning-path`, same disclaimer discipline as
    `TechnologyCompareWidget`
- `DailyDigestContent`
  - user-facing digest renderer shared by public digest pages and workspace preview
  - consumes a public-safe `PublicDigestView` (mapped by `toPublicDigestView`
    in `src/lib/digest-view.ts`) rather than the full `DailyDigest` workflow
    object, so internal-only digest fields never enter the rendered page
    payload
  - a client component (P4 v0.2): renders the followed-topic personalization
    bar, per-item 命中关注 lines, and the 只看我关注的 client-side filter on
    top of the same public-safe props (follows read from localStorage via
    `src/lib/followed-tags.ts`)
- `DailyDigestWorkspaceCard`
  - workspace-only digest list record
- `DailyDigestWorkspaceDetail`
  - workspace-only digest review, editing detail, delivery status, webhook send panel, logs, and share preview
- `DailyDigestStatusActions`
  - workspace-only digest publish / draft / archive controls
- `DailyDigestEditForm`
  - workspace-only digest title, summary, editorial summary, and editorial notes editor
- `DailyDigestItemActions`
  - workspace-only digest item include / exclude / pin / ordering controls
- `DeliveryChannelForm`
  - workspace-only generic webhook and Feishu bot webhook channel create/edit form
- `DeliveryChannelActions`
  - workspace-only delivery channel enable/disable controls
- `DigestDeliveryActions`
  - workspace-only digest send preview and manual send controls
- `DeliveryRunActions`
  - workspace-only failed delivery retry control
- `ScheduledDeliveryForm`
  - workspace-only schedule creation and editing form
- `ScheduledDeliveryActions`
  - workspace-only schedule enable/disable and manual run controls
- `ImportedCandidateReviewActions`
  - workspace-only action bar
- `ExternalSourceBrowser`
  - workspace-only source search, filter, health, and batch import UI
- `ExternalSourceForm`
  - workspace-only source create/edit form
- `ExternalSourceActions`
  - workspace-only enable/disable and import controls
- `ExternalSourceBatchActions`
  - workspace-only import-all-enabled control and latest run summary
- `TechnologyLanguageSwitch`
  - user-facing bilingual content switch
- `TechnologyLanguageIndicators`
  - user-facing translation availability indicators

## Data flow

### Internal Workspace

1. live importer or local fallback
2. source configuration and import state
3. `ImportedCandidate`
4. review state enrichment
5. duplicate detection
6. duplicate group review and primary candidate selection when needed
7. conversion to `TechnologyWorkspaceRecord`
8. Ranking v0 priority calculation
9. workspace draft editing
10. publish readiness evaluation
11. preview through the user-facing renderer
12. workspace publication status control
13. digest generation from published technology records
14. digest editorial adjustments, readiness checks, preview, and publication
15. delivery feed generation from published digests
16. optional manual webhook / Feishu webhook delivery from published digests
17. optional local scheduled delivery from published digests
18. operations health and WorkflowEvent inspection for maintainers

### User-facing Product

1. take only published technology content
2. map workspace records into a safe `TechnologyItem` shape
3. render technology list and detail pages
4. render published daily digest pages
5. render public RSS / JSON digest feeds from published digests
6. keep bilingual fallback on title / summary / content

## Field isolation

The user-facing pages do not render:

- `rawPayload`
- `importStatus`
- `normalizedType`
- `duplicateGroupId`
- duplicate group status and reason codes
- source management fields
- source quality metrics
- candidate quality flags
- priority reasons, warnings, ranking source, and raw priority score
- draft / archived digest status, digest editorial notes, manual digest controls, and manual adjustment IDs
- reviewer actions
- delivery channel configuration, endpoint URLs, delivery logs, scheduled delivery configuration, scheduled run logs, task-runner logs, request payload previews, response body previews, and retry metadata
- operations summaries, WorkflowEvent / AuditLog records, internal failure diagnostics, and task-runner internals
- Editorial Enrichment suggestion records, source inputs, generation mode, provider/model/prompt metadata, token usage, generation errors, reviewer notes, and suggestion review status
- workspace access tokens, workspace module navigation, or deployment-only environment values

The workspace pages are allowed to render them, because those pages are for review and conversion rather than end-user reading.

## UI refactor v0 page behavior

The current page template split is:

- `/`, `/technologies`, `/technologies/[slug]`, `/digest/today`,
  `/digest/[date]`, `/skills`, and `/knowledge` are user-facing reading and
  discovery pages.
- `/workspace/*` pages are internal review, publishing, delivery, scheduling,
  and operations tools.

User-facing updates in this pass:

- homepage hero and entry cards now explain the public product in readable
  copy rather than internal validation wording
- technology cards are intentionally lighter and focus on "what is this",
  "why watch", source, priority, audience, tags, and language availability
- daily digest pages use public digest titles and summaries, and hide validation
  / mock wording when local validation records are used
- skills are grouped by skill type
- knowledge items are grouped by difficulty level

Workspace updates in this pass:

- workspace shells keep the dark internal navigation and compact page headers
- the global workspace warning is shortened so it does not dominate every page
- delivery channel creation and scheduled delivery creation are collapsed by
  default, keeping lists, run state, and logs as the primary view
- workspace pages keep operational status, audit, delivery, task-runner, and
  endpoint configuration out of the user-facing product

## UI Template QA & Consolidation v0

Five pages are the current canonical template references.

Workspace Console Template pages:

- `/workspace/sources`: source management console with compact header, internal
  info bar, source/import summary metrics, compact source rows, one primary
  `Add source` entry, secondary row-level import/detail/edit actions, and
  subdued disable actions.
- `/workspace/candidates`: imported candidate review console with compact
  header, internal info bar, candidate/source sync summary, filters, compact
  candidate rows, duplicate review entry, and conversion/status diagnostics kept
  inside workspace.
- `/workspace/digests`: digest editorial console with compact header, internal
  info bar, digest status metrics, one primary `Generate digest draft` action,
  compact digest rows, and explicit `Review digest`, `Preview digest`, and
  `Open published digest` links.

User-facing Reading Template pages:

- `/technologies`: public technology signal stream with search/type/tag/priority
  filters, no workspace navigation, and signal cards focused on title, one-line
  summary, why-it-matters, source, publish date, audience, difficulty, tags, and
  `Open signal`.
- `/technologies/[slug]`: public technology reading detail with article header,
  source and priority context, reading path sections, related skills and
  related knowledge explanations, follow-up questions, and source reference.

Template boundary rules:

- Workspace templates may show workflow state, diagnostics, quality flags,
  duplicate context, delivery state, and reviewer actions.
- User-facing templates must not show raw import fields, source management
  fields, quality flags, duplicate group internals, delivery logs, audit events,
  LLM prompts, reviewer notes, or workspace navigation.
- Empty states should describe what is missing and provide the next appropriate
  action for that surface. Public empty states must not send users to workspace.

Pages left for later UI migration: none — the list is empty.

`/workspace/operations` (+ `/workspace/operations/events`), `/workspace/duplicates`
(list + detail), and `/workspace/technologies` (list + detail) had a manual
visual-confirmation pass at desktop and mobile widths, and `/digest/today`,
`/digest/[date]`, `/skills` (index + detail), and `/knowledge` (index + detail)
have since had the same pass (layout stacking, horizontal overflow,
internal-field leak scan, console errors — see `docs/next-task.md`). Every page
that was ever on this list has now been confirmed against the current template
standards.
