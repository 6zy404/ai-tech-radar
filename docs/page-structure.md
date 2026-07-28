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

- `/workspace/editorial-round`
- `/workspace/candidates`
- `/workspace/technologies`
- `/workspace/skills`
- `/workspace/knowledge`
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
- `/workspace/skills/[id]`
- `/workspace/knowledge/[id]`
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
- `/technologies` (also hosts the 全部快讯/按话题/我关注的 views via `?view=`)
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
- `/workspace/editorial-round`
  - workspace-only editorial-round orchestration console
  - collapses the recurring loop in `docs/editorial-round-playbook.md` onto one
    page: a round summary (待决 / 待发布草稿 / 简报 counts), a derived
    five-phase step tracker (处置候选 / 补内容·发布 / 生成简报 / 发布简报 /
    公开面核对, statuses done / current / todo / blocked), undecided candidates
    with inline 转为草稿 / 拒绝 and their review-blocking quality flags
    (缺少摘要 / 缺少正文 / 预发布版本 / 已发布过 …, added 2026-07-27 so a round can triage
    the batch without opening each candidate detail page; the
    review-readiness-only flags are deliberately left off), an
    open-duplicate-group block notice, drafts
    awaiting publish with a per-draft publish-readiness summary + inline 发布,
    today's digest with inline 生成 / 发布 and a soft "publish everything first"
    hint, and a public-surface verify link checklist
  - pure read state (`getEditorialRoundState` in `src/lib/editorial-round.ts`),
    no new persisted data; the inline actions reuse the existing
    candidate/technology/digest API routes (no editor duplicated), so 写内容 /
    简报编辑判断 / 候选详情 still link out to the existing workspace pages
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
  - draft editing for content, source metadata, tags, related content — knowledge, skills, and (since 2026-07-27) other **published technologies**, each with per-link relation type + note since LinkRelation v1 — and Content Intelligence fields
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
- `/workspace/skills` and `/workspace/knowledge`
  - workspace-only skill / knowledge content consoles (Skill/Knowledge
    workspace editing v0)
  - status tiles for 草稿 / 已发布 / 内置种子（未覆盖）/ 工作台覆盖
  - workspace entries (new + seed overrides) listed before untouched seeds,
    each row carrying a draft/published badge and an origin badge
    (工作台新建 / 内置种子 / 种子已覆盖)
  - one primary 新建 action per console (`/workspace/skills/new`,
    `/workspace/knowledge/new`)
- `/workspace/skills/[id]` and `/workspace/knowledge/[id]`
  - skill / knowledge edit detail: status panel with confirm-gated
    publish / unpublish, the shared `PublishReadinessPanel`, and the edit
    form (title, slug, summary, content, per-kind attributes,
    canonical-`TopicTag` checkbox picker, related-content pickers with
    per-link relation type + note editing since LinkRelation v1)
  - editing a seed entry copies it into the workspace store
    (copy-on-write); the origin note explains that seed code files are
    never modified
  - links to the public page when the entry is published
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
  - shows the scheduled-digest (定时简报草稿) panel: enable/disable the
    task-runner daily digest-draft generation, edit its daily time, and
    inspect its next/last run; drafts only — the digest publish gate is
    untouched, and days that already have a digest are skipped
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
  - shows a compact latest-news board (今日快讯) linking to
    `/technologies?view=news`, with the auto-aggregation disclaimer
  - does not show workspace actions, source health, delivery, audit, task-runner, or local JSON warnings
- `/technologies`
  - user-facing published technology hub with four views switched by a
    `?view=` query param and a tab strip at the top of the page; `/news`,
    `/timeline`, and `/radar` each redirect here to the matching view
    (`src/app/{news,timeline,radar}/page.tsx` are one-line `redirect()`s)
  - 精选 (default, no `view` param, `TechnologyBrowser`): user-facing
    published technology list; bilingual content preference for title and
    summary; uses a compact signal-stream layout on desktop so users scan
    one curated item at a time instead of reading a workspace-style grid;
    cards show signal type, signal strength, audience fit, Content
    Intelligence why-watch summary, reading difficulty, source, tags, and
    related context counts; cards show productized priority labels such as
    immediate attention / worth tracking / good to know; user-facing
    wording must not expose demo / mock semantics
  - 全部快讯 (`?view=news`, `NewsFeedSection`): user-facing auto-aggregated
    news fast lane (今日快讯); renders recently imported candidates (last 7
    days, grouped by day) through the dedicated sanitizing map in
    `src/lib/news.ts` — title, truncated summary, source name, external
    source link, publish date, and display tags only; always labelled
    "自动聚合内容，未经编辑精选"; links converted + published items to their
    formal technology signal page; hides rejected candidates, fallback
    placeholder candidates, and non-primary duplicates; shows a guided
    empty state when the window is empty; does not show import status, raw
    payloads, candidate IDs, duplicate internals, source health, or any
    workspace action
  - 按话题 (`?view=timeline`, `TopicTimelineSection`): published technology
    signals grouped by topic tag, each rendered as a chronological
    (newest-first) list of dated nodes linking to `/technologies/[slug]`;
    topics sorted by signal count, then name; only topics with at least one
    published signal are shown; published-signal data only — no news
    fast-lane items, no internal fields; guided empty state when no
    published signals exist yet
  - 我关注的 (`?view=followed`, `MyRadarContent`): readers follow topic tags
    via toggle chips; follows live only in browser localStorage (no
    accounts, no server-side profile); aggregates published technologies
    whose tags intersect the followed set, grouped by the existing
    deterministic Ranking v0 priority levels and date-sorted within groups;
    each matched item shows an explicit "命中关注：X" explanation line;
    guided empty states for "no follows yet" and "follows but no matches";
    does not show internal quality, reviewer, delivery, or source data
  - 稍后读 (`?view=saved`, `SavedSignalsContent`): the signals the reader
    marked 稍后读, most-recently-saved first; saved ids that no longer
    resolve to a published signal are dropped instead of rendered as a dead
    row; guided empty states for "nothing saved yet" and "saved but all
    read"; marks live only in browser localStorage
    (`src/lib/reading-state.ts`), so the served page is identical for
    everyone
  - reading marks (P4 v0.4) apply across the 精选 / 我关注的 / 稍后读 views:
    each signal card carries a 稍后读 and a 已读 toggle
    (`SignalReadingActions`), a read card recedes (transparent surface,
    dashed border, muted title, 已读 stamp) and the shared
    `ReadFilterToggle` offers 隐藏已读 once at least one signal is marked.
    Marks are always explicit reader actions — opening a signal never marks
    it read
- `/technologies/[slug]`
  - user-facing published technology detail
  - a 版本脉络 evolution-line section as the first content block, rendered only
    when the signal is part of a `supersedes` chain (`TechnologyEvolutionLine`,
    fed by `getTechnologyEvolutionChain`): the full line ordered oldest-first
    with 当前 / 最新 marks, links to the other releases, and the succession note
    for the current step. On an older release the heading reads 这条信号已有后续
    and names the latest one — the point of the section is that a reader landing
    on a superseded release finds out before reading it. Signals with no
    succession relation render nothing here
  - a 信号正文 section (after 版本脉络, before 为什么重要) rendering the
    record's `content` field through `TechnologyBody`; resolved with the same
    `getLocalizedTechnologyText` helper as the title and summary, so the
    中文/原文 switch applies to the body as well. Renders nothing when the
    body is empty. Added 2026-07-28 — before that the page never rendered
    `content` at all, even though the publish gate treats a missing body as
    a blocking error
  - bilingual content reading
  - source name, publisher name, publisher type, publish date, and original
    link without making long URLs dominate the page. The publisher type
    (大型科技公司 / 创业公司 / 研究实验室 / 开源社区 / 媒体) renders as a
    hairline chip inside the source row on both `SourceReference` instances —
    the aside panel and the 来源参考 block at the foot of the article — so a
    reader can tell a vendor announcement from an open-source release before
    reading. Added 2026-07-29; the chip is a classification, which is why it
    is set apart from the publisher _name_ sitting beside it
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
- `/digest`
  - user-facing digest archive index (往期简报)
  - lists all published digests grouped by month, newest first, with date,
    public title, public summary, and immediate-attention / worth-tracking
    counts, each linking to `/digest/[date]`
  - uses the same public-copy sanitizers as the digest pages; never renders
    draft/archived digests, editorial notes, or manual adjustment ids
  - linked from the 订阅简报 section on public digest pages (往期简报归档)
  - carries a 本周回顾 action link to `/digest/weekly`
- `/digest/weekly`
  - user-facing weekly review (本周回顾): a time-boxed sibling of the daily
    digest, not a nav entry — reached via 本周回顾 cross-links on `/digest`
    and the public digest pages' 订阅简报 block
  - renders the current natural week (Monday–Sunday): a four-number summary
    (本周信号 / 立即关注 / 值得跟踪 / 覆盖主题), published technology signals
    grouped by the deterministic Ranking v0 levels 立即关注 (`high_priority`)
    and 值得跟踪 (`watch`) — `low_priority` excluded, matching the digest — a
    guided empty state for a quiet week, and the past-week archive folded in
  - pure derived view (`getWeeklyReview` / `getWeeklyReviewArchive` in
    `src/lib/weekly-review.ts`), rendered by the shared `WeeklyReviewContent`
    component in dossier styling; no new persisted data, no AI, no internal
    fields
- `/digest/weekly/[week]`
  - a specific past/other natural week keyed by its canonical Monday date
    (`YYYY-MM-DD`, e.g. `/digest/weekly/2026-07-13`); same layout as
    `/digest/weekly` plus a 回到本周回顾 link
  - `notFound()` for a non-canonical (non-Monday) key, an invalid date, or a
    week with no shown signals
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
    `/technologies?view=followed`
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
  - explains what the skill helps readers do, with the body rendered through
    the shared `ContentBody` component
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
  - explains why the concept is foundational, with the body rendered through
    the shared `ContentBody` component
  - links to published technology signals explained by the concept
  - links to skills that use the concept
  - the 主题 tags card renders follow-toggle chips (`FollowableTagList`) so
    readers can add the concept's topics to their personal radar in place
- `/network`
  - user-facing whole-network overview, dossier direction (2026-07-15)
  - renders every published technology, skill, and knowledge item as a node in
    one graph, laid out by a hand-written force-directed simulation (node
    repulsion, spring-edge attraction, a weak centering force) so the graph's
    real topology — not a fixed technology/skill/knowledge lane split — drives
    the layout, with an edge for every declared relationship and its semantic
    type
  - a search box highlights matching node titles; category chips filter by
    kind (technology/skill/knowledge); hovering an edge shows its relation
    label; nodes can be dragged to reposition them; search/filter and node
    selection combine as a union (a node stays visible if it matches either)
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
  - user-facing site-wide keyword search (an inline search icon in `TopNav`
    opens the query box, GETs to this page)
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
- `/topics/[tagId]`
  - user-facing topic hub: a drill-down destination, not a global nav entry
    or index page — reached only via "查看专题" links on `FollowableTagList`
    chips (technology/skill/knowledge detail pages)
  - merges what `/network`, the 按话题 view, and `/search` each show in
    fragments for one topic tag into a single page: the tag's published
    technology signals (newest first), tagged skills, tagged knowledge, and
    a "图谱关联" section listing the topic's direct graph neighbors (via
    `getContentGraph()`, excluding nodes already shown in the three
    sections above) with their relation-type label
  - `notFound()` for an unknown tag id or a tag with no published content in
    any of the three pools (`getTopicHub` in `src/lib/topic-hub.ts`)
  - published-content only; no internal fields, no new AI calls, no new
    persisted data — a pure derived view like `/network`'s content graph
  - carries a 订阅此话题 block (when the topic has published signals)
    linking the per-topic RSS feed
- `/topics/[tagId]/feed.xml`
  - per-topic RSS 2.0 feed (`renderTopicRssXml` in `src/lib/topic-feed.ts`)
    of the topic's published technology signals only, newest first, with
    bilingual-preferred titles/summaries linking to `/technologies/[slug]`
  - 404 for unknown topics or topics with no published signals; news
    fast-lane candidates never enter the feed

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
- `ContentWorkspaceEntryCard`
  - workspace-only list row shared by the skill and knowledge consoles:
    title, summary, per-kind metadata, draft/published badge, and origin
    badge (工作台新建 / 内置种子 / 种子已覆盖)
- `ContentWorkspaceStatusActions`
  - workspace-only publish / unpublish control shared by the skill and
    knowledge edit pages, with confirmation prompts and 409 readiness
    messages surfaced inline
- `SkillWorkspaceForm` / `KnowledgeWorkspaceForm`
  - workspace-only create/edit forms with canonical-`TopicTag` checkbox
    pickers and related-content pickers; submit to the
    `/api/workspace/{skills,knowledge}` routes
- `RelationCheckboxItem`
  - workspace-only related-content checkbox shared by all three editors
    (skill, knowledge, technology draft): while checked it unfolds a
    relation-type select and note input (CSS `:has`, forms stay
    uncontrolled); its helpers collect the values from FormData and sync
    them to `PUT /api/workspace/relations` (LinkRelation v1)
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
    follow/unfollow toggle chips used on the 我关注的 view
    (localStorage-backed via `src/lib/followed-tags.ts`, reusing the
    `my-radar__tag-toggle` styles), with a hint line linking to
    `/technologies?view=followed` when any of the page's tags is
    followed; used by the tags section on the technology, skill, and
    knowledge detail pages (hero and related-card tags stay on `TagList`)
  - each chip also renders a small "查看专题" link to `/topics/[tagId]`
    alongside the follow toggle — the only entry point into the topic hub
- `SourceReference`
  - user-facing original source reference section; the optional
    `publisherTypeLabel` prop adds the publisher-type chip to the meta row
    (used by both instances on the technology detail page, absent everywhere
    else). The meta row is `flex-wrap`, so the chip wraps rather than
    overflowing on a narrow aside
- `PageShell`
  - legacy shared page framing for non-refactored foundation pages
- `TopNav`
  - shared global navigation for user-facing Home, Daily Digest, Technologies
    (which also hosts the former News/Timeline/My Radar views), Skills,
    Knowledge, Network, an inline search icon/box (GETs to `/search`), and
    the secondary Workspace entry point
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
    laid out by a hand-written force-directed simulation with every
    relationship edge, search-highlight, a category filter, hover-over-edge
    relation labels, draggable nodes, click-to-focus exploration, and a
    connection-list side panel
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
  - user-facing client component rendered by the 我关注的 view on
    `/technologies?view=followed`: followed-tag toggle chips
    (localStorage-backed via `src/lib/followed-tags.ts`), deterministic
    priority-grouped matching of published signals, per-item matched-topic
    explanation line, and guided empty states
  - also renders a per-followed-topic RSS feed-link row (topics with at
    least one published signal, via the dependency-free `topicFeedPath` in
    `src/lib/feed-paths.ts`) and 导出关注 / 导入关注 follow-transfer
    buttons (plain comma-separated 关注码 via clipboard/prompt, ids
    validated against canonical tags on import, merged into the local
    follow set)
- `TechnologyLearningPathWidget`
  - user-facing, client-side AI learning-path trigger and result panel on the
    technology detail page: request a graph-grounded learning path from
    `POST /api/technologies/learning-path`, same disclaimer discipline as
    `TechnologyCompareWidget`
- `DossierCard` / `DossierStampTag` / `DossierCatalogNote` /
  `DossierRegisterRow` / `DossierSearchInput` / `DossierCategoryChips`
  - reusable component slice for the "编辑桌" (dossier) design direction;
    adopted on `/technologies` and `/technologies/[slug]` (see
    `DossierTechnologyCard` and `DossierRelatedItemsSection` below) —
    `DossierRegisterRow` remains unused until a page needs a ledger-style
    row. See `docs/design-system.md` → "Dossier direction" for the full
    specification and remaining adoption order.
- `DossierTechnologyCard`
  - user-facing dossier-styled index card for `/technologies`; a
    page-specific sibling of `TechnologyListCard` (kept unchanged, since it
    is still shared with the home page and the 我关注的 view's
    `MyRadarContent`)
- `ContentBody`
  - shared renderer for the long-form `content` body of a technology, skill,
    or knowledge record. Used by the technology detail page's 信号正文
    section, the skill detail page's 这项技能能帮你做什么 section, the
    knowledge detail page's 这个概念是什么意思 section, and the workspace
    draft detail page's 记录正文 panel. Consumes the block list from
    `parseContentBody` (`src/lib/content-body.ts`), a hand-written subset
    parser covering only the four constructs the editorial bodies actually
    use — `##` headings, `**bold**`, ordered and bulleted lists — so no
    Markdown dependency was added. Unknown syntax degrades to plain
    paragraph text. Before 2026-07-28 the skill and knowledge pages rendered
    their whole body inside one `<p>`, so Markdown markers were visible to
    readers and paragraph breaks were lost
- `TechnologyEvolutionLine`
  - user-facing 版本脉络 section on the technology detail page; consumes the
    derived `TechnologyEvolutionChain` (no internal fields, no new persisted
    data) and renders nothing when the signal has no `supersedes` chain
- `DossierRelatedItemsSection`
  - user-facing dossier-styled rendering of the technology detail page's
    相关技术/相关技能/相关知识 sections, showing each connection's note
    through `DossierCatalogNote`; a page-specific sibling of
    `RelatedItemsSection` (kept unchanged, since it is still shared with
    the not-yet-migrated skill and knowledge detail pages)
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
- `editorial-round-actions` (`CandidateRoundActions` / `DraftPublishAction` /
  `DigestRoundActions`)
  - workspace-only client action components used by the editorial-round
    console: inline 转为草稿 / 拒绝 (candidate), 发布 (draft), and 生成 / 发布
    (digest), each with a confirm prompt and 409 publish-gate readiness
    surfaced inline; all reuse the existing candidate/technology/digest API
    routes (no new endpoints)
- `WeeklyReviewContent`
  - user-facing server component shared by `/digest/weekly` and
    `/digest/weekly/[week]`: renders the four-number week summary, the
    priority-grouped signal cards (`DossierCard` / `DossierStampTag`), the
    quiet-week empty state, and the 往期周回顾 archive list; consumes the
    pure-derived `WeeklyReviewData` + `WeeklyReviewArchiveEntry[]` from
    `src/lib/weekly-review.ts` (no internal fields)
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
- `ScheduledDigestActions`
  - workspace-only enable/disable + daily-time controls for the task-runner
    scheduled digest-draft generation (`PATCH /api/workspace/scheduled-digest`)
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
