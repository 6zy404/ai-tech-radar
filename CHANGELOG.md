# Changelog

This file records the version-by-version feature history of the AI Tech Radar
prototype. It is the historical companion to `README.md`, which describes the
**current** state of the project.

The prototype is pre-release, so entries are grouped by feature milestone rather
than by semantic version or release date. Milestones are listed newest-first.
For per-topic deep dives, see the `docs/` directory.

> Migration note: this changelog was extracted from the README's running feature
> log so that the README can stay focused on the current state. Earlier entries
> were reconstructed from that log and may not carry exact dates.

## Foundation

- Next.js + TypeScript app foundation.
- Core models for technologies, skills, knowledge, tags, relations, imported
  candidates, external sources, and workspace technology records.
- Bundled mock data to demonstrate the platform structure.

## Source ingestion & candidate review

- **External Source Management v0** — local JSON source configuration, source
  search/filters, create/edit form, enable/disable, manual single-source import,
  batch import for enabled sources, and source health status (import count,
  failure count, latest message). Real import for RSS / Atom, GitHub releases,
  and official-blog-style pages, with a local fallback candidate layer.
- **Source Quality + Candidate Quality Signals v0** — workspace-only quality
  signals for source stability, duplicate rate, conversion rate, rejection rate,
  and per-candidate flags (missing fields, duplicates, short content, draft
  readiness). Excluded from user-facing pages.
- **ImportedCandidate review workflow** — search, source-type filter, normalized
  type filter, import status filter, duplicate hints, review actions, and raw
  payload inspection.
- **Rule-based duplicate detection v0** and **Candidate Duplicate Review v1** —
  persistent, explainable duplicate groups, primary candidate selection,
  resolved/ignored status, a conversion guard for non-primary duplicates, and
  additional source references carried into generated drafts.

## Drafting, ranking & publishing

- **Candidate → technology draft conversion** and an internal technology
  workspace with draft/published/archived status, source traceability, and
  lightweight editing.
- **Ranking v0** — deterministic priority triage
  (`high_priority | watch | low_priority`) with explainable reasons/warnings,
  workspace priority badges, and productized user-facing priority labels that do
  not expose raw scores.
- **Publish Quality Gate v0** — deterministic publish-readiness checks
  (blocking errors and non-blocking warnings) plus a user-facing preview before
  publication.

## Content intelligence & AI-assisted enrichment

- **Content Intelligence v1** — editable explanation fields (why it matters, who
  should care, technical context, impact areas, learning path, related
  knowledge/skill explanations, follow-up questions, reading difficulty,
  enrichment status) published into safe user-facing records.
- **AI-assisted Editorial Enrichment v0** — workspace-only enrichment
  suggestions via rule-based, mock LLM, and optional LLM-assisted generation,
  behind a server-side LLM provider boundary (`mock` and `openai_compatible`),
  with output validation/sanitization and generate/compare/apply/reject/
  regenerate flows. Falls back to mock generation when no API key is configured.
- **Prompt Quality & Editorial Review v1** — workspace-only `PromptVersion`
  records, per-suggestion `promptVersionId`, and a review loop with score,
  labels, notes, rejection reason, applied-field tracking, and stale-suggestion
  handling.

## Daily digest & delivery

- **Daily Digest Editorial Workflow v1** — generates a draft digest from
  published technologies using Ranking v0, with editable copy, manual
  add/exclude/pin/order controls that survive regeneration, aggregated related
  skills/knowledge/sources, preview, publish-readiness checks, and public
  `/digest/today` and `/digest/[date]` pages.
- **Digest Delivery Surface v0** — public `/feed.xml` and `/feed.json` for
  published digests only, with internal fields excluded.
- **Digest Delivery Integration v1 + Channel Expansion v1** — workspace-only
  generic webhook and Feishu webhook channels, JSON/text payloads, manual send
  for published digests only, and delivery logs with success/failure/retry
  state. Endpoint URLs are masked and kept off user-facing pages.
  (`email | telegram | discord` channel types are reserved/typed but not full
  delivery products.)
- **Scheduled Delivery v0** — workspace-only schedules for sending published
  digests to enabled channels, a local runner for due/manual runs,
  schedule-level run records alongside per-channel `DeliveryRun` logs, and
  same-day duplicate-send protection.
- **Real Cron / Task Runner v1** — `tasks:run-once` and `tasks:watch`
  command-line entry points, task-runner audit summaries, reuse of the
  duplicate-send protection, and URL/token sanitization in logs.

## Persistence, hardening & operations

- **Deployment Readiness & Security Boundary v0** — explicit public/workspace/
  internal-API route boundaries, optional token protection for workspace routes,
  documented environment variables, and `validate:deployment` checks.
- **Persistence Migration Planning v0** — centralized local JSON mechanics in
  `src/lib/repositories/local-json-store.ts`, confirmation that pages/APIs call
  workflow services instead of reading JSON directly, and a documented future
  database path.
- **Database Migration v0** — optional SQLite driver (Node's built-in
  `node:sqlite`) with JSON as the default fallback, schema v0 for the current
  workflow objects, `db:init` / `db:migrate-json` / `db:reset` /
  `validate:database`, and DB access kept behind repository/store helpers.
- **Database-backed Workflow Hardening v1** — a workspace-only `WorkflowEvent`
  audit log, stronger conversion/publish/delivery/schedule guards against
  duplicate or invalid operations, workspace-only event panels, and
  `validate:workflow-hardening`.
- **Observability & Admin Operations v0** — `/workspace/operations` health
  dashboard and `/workspace/operations/events` filtered audit browser,
  summarizing failed imports/deliveries/scheduled runs, task-runner status,
  digest status, open duplicates, and candidate quality issues.

## Navigation, IA & design system

- **Workspace Navigation & Information Architecture v0** — `/workspace`
  dashboard, a clickable Sources → Import → Candidates → Duplicates → Drafts →
  Publish → Digests workflow overview, shared workspace navigation, and
  breadcrumbs on detail/preview pages.
- **Workspace Boundary & Action Clarity v0** — result-oriented action labels,
  confirmation prompts for destructive/external-send/regeneration/retry/
  overwrite actions, and helpful disabled/empty states.
- **User-facing Product IA & Discovery Flow v0** — public product home with the
  latest digest, priority signals, and Skills/Knowledge entry points; Daily
  Digest in global navigation; and skills/knowledge pages that explain how they
  connect to published technology signals.
- **Design System v0** — separate `WorkspacePageShell` / `UserPageShell` page
  families and a shared `PageHeader` primitive, keeping internal-only fields off
  user-facing layouts.
- **User-facing Typography Scale v0** — centralized font family and a five-step
  size scale (`--fs-h1` 28 / `--fs-section` 22 / `--fs-card-title` 18 /
  `--fs-body` 15 / `--fs-label` 13) plus a unified `--lh-base` 1.5 line-height,
  defined as `:root` tokens in `src/app/globals.css` and applied only under
  `.user-shell` (public pages). Internal Workspace and the shared TopNav keep
  their existing typography. Typography-only: no layout, color, logic, or
  component-structure changes.
- **Bilingual support** — content-level localization (`original` / `zh` / `en`)
  for technology title, summary, and content, with Chinese-preferred display and
  original-source fallback. No route-based i18n.

## Knowledge relationship network

- **Technology-to-technology relations v0** — optional `relatedTechnologyIds` on
  `TechnologyItem`, seeded with real cross-links between published technologies
  (e.g. MCP ↔ browser agents ↔ agent workbenches), rendered as a navigable
  "相关技术" section on the technology detail page via the existing
  `RelatedItemsSection`. First step toward making the Technology / Skill /
  Knowledge graph visible and walkable per the product rule, rather than three
  separate lists.
- **Walkable relationship graph across all three detail pages** — the small
  relationship visualization (previously only on the technology detail page) is
  now a shared, generic `RelationshipGraph` component rendered on the technology,
  skill, and knowledge detail pages. Each page shows the current node at the
  centre with its neighbouring technologies, skills, and background knowledge as
  clickable spokes (colour-coded by kind), so a reader can hop
  technology → skill → knowledge → technology and always land on another page
  that shows its own neighbourhood. This makes discover → understand →
  **connect** hold across every entity type, not just technologies.
- **Shared relationship-density line on all three index cards** — extracted the
  technology list card's "关联 · N 技术 · N 技能 …" line into a reusable
  `RelationDensity` component and adopted it on the skill and knowledge index
  cards, which previously showed a different pill-count style. All three index
  pages now render the same relationship-density line.
- **Full semantic relation typing across the content graph** — every
  technology↔technology, technology↔skill, technology↔knowledge, and
  skill↔knowledge link that exists as a `relatedXIds` reference now has an
  explicit `LinkRelation` entry (27 new entries: 12 skill↔knowledge, 6
  technology↔knowledge, 9 technology↔skill), so relation-type pills and graph
  tooltips show a real Chinese label (建立在 / 需要 / 支持 / 解释 / …) instead of
  falling back to the generic "相关". A new `findRelationBetween` helper in
  `src/lib/content.ts` looks up the relation regardless of which side
  `LinkRelation` records as `from`/`to`. The skill and knowledge detail pages
  now show the same relation-type pill (reusing `.user-related-section__relation`)
  on each related-content card that the technology detail page already showed,
  and the shared `RelationshipGraph` nodes carry a hover tooltip with the
  relation label and explanation.
- **Whole-network overview page (`/network`)** — the final P2 item. A new
  `getContentGraph()` helper in `src/lib/content.ts` computes every published
  technology/skill/knowledge node and every `relatedXIds` reference between
  them (deduplicated as an undirected edge, typed via `findRelationBetween`).
  The new `ContentNetworkGraph` client component renders all 24 nodes grouped
  into three lanes by kind with every edge drawn between them; clicking any
  node highlights its direct connections, dims the rest, and opens a side
  panel with the node's title, a link to its own detail page, and its full
  connection list (relation-type pill + linked title per connection). Added to
  `TopNav` as "关系网络". This is the one place a reader can see the whole
  discover → understand → connect graph at once, instead of one node's
  neighbourhood at a time.

## AI-assisted understanding

- **Compare two technologies (P3 v0)** — the first capability shipped under P3
  ("AI-assisted understanding"), which `AGENTS.md` had listed as out of scope
  until the project owner explicitly authorized it, and scoped to exactly one
  thing: comparing two published technologies. Explain and learning-path
  generation remain deferred. On `/technologies/[slug]`, a reader can pick
  another published technology from a dropdown built from
  `getAllTechnologies()` (already published-only) and request a live
  AI-generated comparison (similarities, differences, when to prefer each),
  rendered by the new client-side `TechnologyCompareWidget` between the
  "相关技术" and "相关技能" sections. Unlike Editorial Enrichment, this is
  **not** editor-gated: the result is shown immediately, always paired with a
  persistent "AI 生成内容，未经编辑审核，仅供参考" disclaimer in the same paint
  as the result, so unlabeled AI content is never visible. This is also the
  project's first public, unprotected route that calls the LLM provider
  directly (`POST /api/technologies/compare`); results are cached per
  unordered technology-id pair (`config/technology-comparisons.json`) so the
  same pair is generated at most once, and a single public-mapping function
  (`toPublicComparisonResult` in `src/lib/technology-comparison.ts`) strips
  provider name, model name, prompt version, generation mode, and validation/
  generation-error details before any response leaves the server — the same
  internal-field discipline the existing LLM Provider Boundary already
  required for Editorial Enrichment, now enforced on a public response for the
  first time. Reuses the existing `PromptVersion` system (extended to support
  a `technology_comparison` purpose alongside `editorial_enrichment`) and a
  newly shared `src/lib/llm/output-sanitization.ts` helper module extracted
  from the Editorial Enrichment output validator.
- **Explain a technology at the reader's level (P3 v1)** — the second P3
  capability, authorized by the owner after Compare v0 and built as a
  deliberate structural clone of it. On `/technologies/[slug]`, a reader picks
  their experience level (入门 / 进阶 / 资深) in the new
  `TechnologyExplainWidget` (rendered between the 技术背景 and 谁该关注
  sections) and requests a live AI-generated explanation tailored to that
  level: a plain-language `explanation`, `keyPoints`, an optional beginner
  `analogy`, and optional `nextSteps`. Results are cached per technology ×
  level (`config/technology-explanations.json`, cache key
  `technologyId::audienceLevel`) so each combination is generated at most
  once, served by the new public `POST /api/technologies/explain` route and
  always rendered with the same persistent "AI 生成内容，未经编辑审核，仅供参考"
  disclaimer in the same paint as the result. Reuses the Compare
  infrastructure wholesale: the server-side LLM provider boundary (mock by
  default), a new `technology_explanation` `PromptVersion` purpose with a
  purpose-aware default, the shared `output-sanitization.ts` validator
  helpers, and a dedicated public-mapping function
  (`toPublicExplanationResult` in `src/lib/technology-explanation.ts`) that
  strips provider name, model name, prompt version, generation mode, and
  validation/generation-error details before any response leaves the server.
- **Graph-grounded learning path (P3 v2)** — the third and final P3 capability
  from the agreed candidate list, completing the Compare → Explain → learning
  path sequence. On `/technologies/[slug]`, a reader clicks 生成学习路径 in
  the new `TechnologyLearningPathWidget` (rendered between the editor-curated
  学习路径 section and the relationship graph) and receives a live
  AI-generated learning path for the current technology: a path `overview`,
  ordered `steps` (3–6), and optional self-check `checkpoints`. The defining
  difference from Compare/Explain is **graph grounding**: the prompt feeds
  the technology's actual related knowledge and related skills (titles +
  summaries from the content graph) and instructs the model to build the
  steps on them by name — connecting P2's relationship network to P3's AI
  layer. Results are cached per technology
  (`config/technology-learning-paths.json`, keyed by `technologyId`), served
  by the new public `POST /api/technologies/learning-path` route, and always
  rendered with the same persistent "AI 生成内容，未经编辑审核，仅供参考"
  disclaimer in the same paint as the result. Same structural template as
  Compare/Explain: a `technology_learning_path` `PromptVersion` purpose with
  purpose-aware default, shared `output-sanitization.ts` validator helpers,
  a mock-provider branch (which references real related knowledge/skill
  titles extracted from the prompt), and a dedicated public-mapping function
  (`toPublicLearningPathResult` in `src/lib/technology-learning-path.ts`)
  stripping all provider/model/prompt metadata from the public response.

## Personalization

- **Personal radar (P4 v0)** — the first capability shipped under P4
  ("personalization"), owner-authorized on 2026-07-09 with a deliberately
  minimal, boundary-respecting design: **no accounts, no server-side profile,
  no AI ranking**. Readers follow topic tags via toggle chips on the new
  public `/radar` page ("我的雷达", added to `TopNav`); follows are stored
  only in browser `localStorage`
  (`src/lib/followed-tags.ts`, key `ai-tech-radar:followed-tag-ids`, with a
  custom event + `storage` listener for cross-component sync). The radar
  aggregates published technologies whose tags intersect the followed set,
  groups them with the existing deterministic Ranking v0 priority levels
  (立即关注 / 值得跟踪 / 了解即可, date-sorted within groups, reusing
  `TechnologyListCard`), and shows an explainability line per item
  (命中关注：X). Empty states guide first-time and no-match cases. Also fixed
  a content defect found during verification: the three real published
  signals (gpt-live / vllm / ollama) used freeform tag strings instead of
  canonical `TopicTag` ids, so they could not be matched by tag anywhere; a
  new canonical tag `tag-inference` (推理与部署) was added and the three
  records were re-tagged (`tag-multimodal`, `tag-inference`,
  `tag-inference` + `tag-on-device`).

## Developer tooling

- **Linting & formatting config v0 (ESLint + Prettier)** — flat-config ESLint 9
  (`eslint.config.mjs`) extending `next/core-web-vitals`, `next/typescript`,
  and `eslint-config-prettier`, with `.claude/**`, `config/**`, and build
  output ignored, `@typescript-eslint/no-require-imports` disabled for `.cjs`
  scripts, and unused-vars tuned to allow `_`-prefixed bindings and
  destructuring rest siblings. Prettier config (`.prettierrc.json` /
  `.prettierignore`) is calibrated to the existing house style — double
  quotes, semicolons, no trailing commas, 80 columns — plus `endOfLine:
"auto"` because the working tree is checked out with `core.autocrlf=true`
  (CRLF), which Prettier's default `lf` setting would otherwise flag in every
  file. New commands: `npm run lint`, `lint:fix`, `format`, `format:check`.
  The first lint pass surfaced and removed four pieces of dead code (an
  orphaned private `getAutoDigestContentIds` in `digest-workflow.ts` and
  unused imports in `validate-database.ts` and the delivery schedules page).
  Also fixed the pre-existing `validate:delivery` fixture mismatch: its
  fixture digest copy contained the word "validation", which the public-copy
  sanitizer (`src/lib/public-copy.ts`) intentionally rewrites out of public
  digest titles, so the feed-title assertions failed; the fixture was renamed
  to public-safe wording and the sanitizer left unchanged.
