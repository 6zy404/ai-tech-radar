# Reference — capabilities, routes, commands

The developer-facing detail that used to live in the README. The project
overview is in [`README.md`](../README.md) (中文) /
[`README.en.md`](../README.en.md) (English); the version-by-version history is
in [`CHANGELOG.md`](../CHANGELOG.md).

The product is split into two subsystems:

- **Internal Workspace** — configure external sources, import real items, review
  candidates, resolve duplicates, convert candidates into technology drafts,
  edit and enrich draft content, run publish-readiness checks, publish/archive
  records, build and publish Daily Digests, deliver digests to external
  channels, schedule deliveries, and monitor operations.
- **User-facing Product** — a public home, an auto-aggregated news fast lane
  (`/news`), readable technology list/detail pages (published records only),
  published Daily Digest pages, skills/knowledge pages that explain the
  signals, public RSS/JSON feeds, content-level bilingual support, and an
  English interface for every public page under `/en` (2026-10-14).

> **Status:** working prototype, past the original foundation phase. For the full
> feature history see [`CHANGELOG.md`](../CHANGELOG.md). For deep dives on any area
> see the [`docs/`](./) directory.

## Current capabilities

- **Ingestion** — real import for RSS / Atom, GitHub releases, and
  official-blog-style pages, with a local fallback layer, batch import,
  source/candidate quality signals, and a task-runner scheduled daily import
  (`config/scheduled-import.json`, managed from
  `/workspace/delivery/schedules`). Each source keeps its last 30 import
  attempts (time, status, created / skipped, a URL-free error summary;
  `src/lib/source-health-history.ts`), drawn as a row of cells on
  `/workspace/sources/[id]` with a table as the text version, and the list
  shows each source's 14-day success rate; sources older than the field were
  backfilled from the stored batch runs. A disabled source can be deleted
  there (`DELETE /api/workspace/sources/[id]`, 409 while enabled): its
  configuration and history go, its candidates and published signals stay
  (2026-10-13).
- **News fast lane (two-tier content model)** — the 全部快讯 view on
  `/technologies?view=news` publicly renders recently imported candidates
  (last 7 days, grouped by day) through a
  dedicated sanitizing map (`src/lib/news.ts`): title / summary / source /
  date / tags only, always labelled "自动聚合，未经编辑精选", with rejected
  candidates, fallback placeholders, and non-primary duplicates excluded, and
  converted items linking to their published signal. The curated technology
  signal + digest tier stays editor-gated and unchanged. Only `rejected` is
  filtered, so **candidates awaiting a decision are publicly visible** until an
  editorial round dispositions them — which means the lane's composition
  follows each source's publish _rate_, not its quality. Measured on
  2026-08-10: before that day's round the lane was 33 items with 67% from two
  daily-media sources; after it, 16 items with 38%. `npm run measure:news-lane`
  reports the current split, and
  [`docs/security-boundary.md`](security-boundary.md) → "News Fast Lane
  Boundary" records the two alternatives that were measured and rejected.
- **Review** — candidate review workflow with filters, deterministic and
  explainable duplicate detection, and duplicate-group resolution. Right after
  each scheduled import the task runner **auto-rejects** exactly three kinds of
  candidate — pre-release version tags, announcements already published on
  the site, and defacement signatures (a title opening 「hacked by …」 and no
  longer than eight words, `src/lib/defacement-title.ts`; the 全部快讯 lane
  also hides these before the runner gets to them, 2026-10-09)
  (`src/lib/candidate-auto-triage.ts`) — because every round rejected
  them by hand while they sat public on the news lane. Everything else still
  waits for an editor; title-only items are deliberately not auto-rejected.
  Since 2026-10-13 the same pass also runs **semantic duplicate detection**
  with the local embedding model (`src/lib/semantic-dedup*.ts`, 60 s
  deadline, one line in the task-runner messages; the workspace import routes
  start it in the background): candidates ≥ 0.96 cosine apart by at most 3
  days join one duplicate group (`semantic_similar`, so the news lane shows
  only the primary), and a candidate ≥ 0.92 against a published signal gets
  the `similar_to_published` hint — never an auto-reject. English/Chinese
  pairs of one announcement are beyond this model. Thresholds and their
  precision/recall: `eval/dedup/README.md`.
- **Drafting & publishing** — candidate → draft conversion, lightweight draft
  editing, deterministic Ranking v0 priority triage, and a Publish Quality Gate
  with user-facing preview. Since 2026-10-12 the gate also warns (never
  blocks) when a related technology, skill or knowledge item has no relation
  type — it would show as the fallback 关联 — and when every topic tag is one
  of the three broad topics (AI 智能体 / 前沿模型 / 推理与部署), naming the
  narrower ones to check (`src/lib/publish-readiness.ts`).
- **Content intelligence** — editable explanation fields (why it matters, who
  should care, technical context, learning path, etc.) plus optional
  AI-assisted editorial enrichment behind a server-side LLM provider boundary
  (mock by default, OpenAI-compatible when configured) with a prompt-quality
  review loop.
- **Knowledge relationship network** — every technology/skill/knowledge cross-
  reference carries an explicit, Chinese-labelled relation type; a small
  per-item relationship view — the current item, then its neighbours grouped
  by kind — is walkable on all three detail pages, and
  `/network` renders the full graph in one view with a hand-written
  force-directed layout, search-highlight, a category filter, hover-over-edge
  relation labels, draggable nodes, and click-to-focus exploration of any
  node's direct connections, deep-linkable as `/network?focus=<node id>`
  from a 在关系网络中查看 link on every detail page's relationship view
  (`src/lib/network-focus.ts`).
- **先读这些 (prerequisite reading chain)** — on skill and knowledge detail
  pages with `requires` (必备) prerequisites, the reading column opens with
  the items to read first: up to 3 levels, the farthest first, published
  skills and knowledge only, cycles stop (`getPrerequisiteChain` in
  `src/lib/prerequisite-chain.ts`). The direct prerequisites move up from the
  related-items area instead of appearing twice. This is the one place that
  reads a relation's **direction** (`from` needs `to` first); everywhere
  else pairs are unordered. Measured 2026-09-29: 16 of 35 pages have a chain
  (skills 13/16, knowledge 3/19). Pure derived view, no new persisted data.
  The editors choose a 必备 relation's direction (我需要先读它 / 它需要先读我),
  prefilled from the stored one, so saving from either side no longer
  reverses it (2026-09-29).
- **Content bodies** — a shared `ContentBody` renderer for the long-form
  body of a technology, skill, or knowledge record. The technology detail
  page gained a 信号正文 section (between 版本脉络 and 为什么重要) read
  through the same localization helper as the title and summary, so the
  中文/原文 switch applies to the body too; the skill and knowledge detail
  pages and the workspace draft panel render through the same component.
  Editorial bodies use only `##` headings, `**bold**`, inline `` `code` `` and
  ordered/bulleted lists, so `src/lib/content-body.ts` parses that subset by
  hand instead of adding a Markdown dependency. Inline code was added
  2026-08-02, after the MCP 2.0 signal shipped its backticks to readers
  verbatim for want of it. Until 2026-07-28 the technology body was
  written by every editorial round, required by the publish gate, and never
  displayed anywhere public, while skill and knowledge bodies rendered as a
  single paragraph with their `**` markers visible.
  Since 2026-10-12 the signal page's body links the first mention of a
  knowledge concept to `/knowledge/[slug]` (`ContentBody`'s optional
  `knowledgeLinks`; skill, knowledge and digest bodies pass none). The
  phrases are a hand-written table, `knowledgeAliases` in
  `src/lib/knowledge-autolink.ts` (knowledge id → aliases, the title
  added; published items only). One link per item per body; never in a
  heading, inline code, or inside 《》 unless the whole title matches;
  latin aliases match whole words, case-insensitively; a space in an alias
  also matches a hyphen or nothing; `except` phrases cancel known Chinese
  false hits (「提示词微调」). The server sends only the targets either
  language of the body mentions, and the 中文/原文 switch re-links. Underlined
  at half the text colour; plain text in print. 83 of 107 Chinese bodies
  carry at least one link (measured 2026-10-12).
  The knowledge page reads the same links backwards (2026-10-12): a
  正文里提到它的信号 section after 这个概念能解释的技术信号 lists the
  published signals whose body links it, minus those already in that
  section, newest first, each with an excerpt around the mention
  (`getKnowledgeMentions` in `src/lib/knowledge-mentions.ts`, which walks
  the body exactly as `ContentBody` does, so the two pages cannot
  disagree). Six rows, the rest folded; omitted when empty. Measured that
  day: 200 links in the Chinese bodies, 146 already hand-listed, 54 new
  rows on 13 of 27 knowledge pages (14 at most). Pure derived view.
- **Signal page reading time and share card** (2026-09-29) — the hero meta
  row shows 约 N 分钟读完 / About N min read, computed from the prose the
  page shows in the current language (Chinese 400 characters/min, English
  200 words/min, rounded up, minimum 1; `src/lib/reading-time.ts`). The
  skill and knowledge pages show the same line in their hero meta row,
  counted from the hero summary and the body
  (`estimateContentDetailReadingMinutes`, 2026-09-30). Every
  published signal, digest (`/digest/[date]`, `/digest/today`), weekly
  review (`/digest/weekly` and `/digest/weekly/[week]`), skill, knowledge item and topic hub
  serves a 1200×630 share image through its own `opengraph-image` route
  (og:image / twitter:image with `summary_large_image`; list pages keep the
  plain summary card), painted by one renderer
  (`src/lib/share-card-image.tsx`) from builders in `src/lib/share-card.ts`:
  dossier colours, public fields only — no priority, no internal fields;
  anything the page would 404 on gets the site card. The digest card leads
  with the editorial summary's first sentence and falls back to the title
  when that sentence has a character outside the font subset (checked
  against the font's cmap, `src/lib/font-cmap.ts`). The CJK glyphs come from
  a Noto Serif SC Bold subset under `assets/fonts/` (OFL, 1.16 MB; GB2312
  level 1 plus every character on the site when it was cut); check coverage
  with `node assets/fonts/check-share-card-font.cjs . <data dir>`. A title
  never ends on a line holding one character (`bindTrailingUnit` in
  `share-card.ts`, 2026-09-30); an image route with no dynamic segment
  (`/digest/today`, `/digest/weekly`) must declare
  `export const dynamic = "force-dynamic"`, or `next build` prerenders it
  and the card freezes on the build day's issue — `/digest/today`'s did
  until 2026-09-30. Every public page also announces its RSS / JSON feeds
  with `<link rel="alternate">` (feed autodiscovery; `buildPageMetadata`'s
  `feeds` option in `src/lib/site-metadata.ts`).
- **收录于 on the signal page** (2026-10-01) — the technology detail page
  ends, before 来源参考, with the published digests that carried the signal,
  newest first, each linking to `/digest/[date]` and tagged with its section
  (立即关注 / 值得跟踪), then the weekly review of its week
  (`/digest/weekly/[week]`) when that review lists it. Membership is the
  digest page's own `getDigestTechnologySections` (manual additions,
  exclusions and pins included), so it cannot claim an issue that does not
  show the signal; only the date, public title and section cross
  (`src/lib/signal-digest-appearances.ts`). Rendered only when at least one
  published digest carried the signal — the weekly review alone would put it
  on nearly every page (measured 2026-10-01: 91 of 92 signals have one); never
  on the workspace preview. Listed in 本页目录; kept in print.
- **上一条 / 下一条 on the signal page** (2026-10-02) — the technology
  detail page ends, after 来源参考, with the same `IssuePager` as the digest
  and weekly-review pages (unit 条): ← 上一条 is the older signal and 下一条 →
  the newer one, the same direction as ← 上一期 on the digest pages; each tile
  names the other signal's title, cut at a clause past 40 characters.
  Neighbours are read by position off `getAllTechnologies()` — the array the
  精选 list renders by default, so same-day signals keep its order — not
  re-sorted (`src/lib/signal-neighbors.ts`). Publish order only; unrelated
  to 版本脉络. Never on the workspace preview; hidden in print.
- **复制链接 and section links** (2026-10-02) — the signal, skill, knowledge
  and digest pages end their hero meta row with a quiet 复制链接 button that
  copies the page's canonical address (`getSiteUrl()` + the page's own path,
  never the address bar; `/digest/today` copies `/digest/<date>`), reads
  已复制 for two seconds and announces it through a status line; if the
  clipboard is refused the address appears selected in a read-only box. Every
  section with a 本页目录 id carries a faint 「#」 beside its h2 (outside the
  heading, so its text and accessible name are unchanged) that copies
  `<canonical>#<id>` and replaces the hash without a history entry. No
  request, no storage; hidden in print and on draft previews
  (`src/components/copy-link-button.tsx`, `section-link.tsx`,
  `src/lib/page-link.ts`).
- **Reading progress and 返回顶部** (2026-10-02) — the signal, skill,
  knowledge, digest (`/digest/[date]`, `/digest/today`) and weekly-review
  pages show a 3px progress line fixed just under the top nav, measuring the
  page's reading region rather than the whole page (the signal page's reading
  column, `.skill-detail-main`, the digest root, the weekly-review root),
  and, once the reader is more than one screen down, a round 返回顶部 button
  bottom-right that scrolls to the top (instantly under reduced motion) and
  moves focus to `#main-content`. Both are `position: fixed`, so the page
  does not move; the line is `aria-hidden`; neither prints; nothing under
  `/workspace`. No request, no storage (`src/components/reading-progress.tsx`,
  `src/lib/reading-progress.ts`).
- **本页目录 on the signal, skill, knowledge and digest pages** (2026-09-30) — the technology detail page's
  aside ends with a table of the sections the page actually renders (omitted
  below three; the AI widgets and the foot 来源参考 are not listed). The
  current section is highlighted as the reader scrolls (IntersectionObserver,
  `aria-current="location"`); a click scrolls smoothly, or instantly under
  reduced motion, lands the section 86px down, updates the hash without a
  history entry and moves focus to its heading. With a table in it the aside
  is no longer one sticky block: the panels above scroll away and only the
  table stays pinned. Below 920px it is a folded 「本页目录 · N 节」
  `<details>` at the top of the reading column. Entry selection is
  `selectPageTocEntries` / `getTechnologyTocCandidates` in
  `src/lib/page-toc.ts`. The skill and knowledge pages mount the same
  `PageToc` with `getContentDetailTocCandidates` (先读这些, the body,
  关系网络, the related signals and the other kind's entries), switching to
  the folded version at 980px, their own aside breakpoint (2026-09-30).
  The digest pages (`/digest/[date]`, `/digest/today`) have no aside, so
  they mount the same `PageToc` folded between the hero and 本期概览 at
  every width, with entries from `getDigestTocCandidates`, counted after the
  只看我关注的 filter (2026-09-30).
- **Publisher type on the signal page** — the technology detail page's source
  row carries the publisher's _type_ (大型科技公司 / 创业公司 / 研究实验室 /
  开源社区 / 媒体) as a hairline chip beside the publisher name, on both the
  aside panel and the foot-of-article 来源参考 block, so a reader can tell a
  vendor announcement from an open-source release before reading. Added
  2026-07-29 by connecting the already-written `getPublisherTypeLabel` and one
  optional `SourceReference` prop. `translationStatus` was measured in the same
  pass and deliberately **not** rendered: the derived translation coverage is
  `full` for **every** published signal (re-measured 2026-08-07 at n=37), so
  any badge would be a constant — see `docs/data-model.md` → `TechnologyItem`.
- **Version evolution line** — a 版本脉络 section on the technology detail page
  showing where the signal you are reading sits in its release line. Built only
  from explicit `supersedes` (续作) relations between published technologies —
  no heuristic — ordered by publish date and marked 当前 / 最新; an older
  release leads with "这条信号已有后续" and names the latest one. Pure derived
  view (`getTechnologyEvolutionChain` in `src/lib/technology-evolution.ts`),
  no new persisted data. Signals outside a release line render nothing.
- **Similar signals (内容相近的信号)** — the technology detail page lists up
  to three other published signals closest to it in the search embedding
  space (`src/lib/similar-signals.ts`): the same local passage vectors as
  `/search`, centered on the pool's mean vector, kept only above a
  pool-relative floor (2.5 standard deviations over all pairwise scores; 42
  of 91 signals show it, measured 2026-09-29), excluding the signal's
  相关技术 and its 版本脉络 line. Labelled 按内容自动匹配、未经编辑挑选.
  Omitted, with no placeholder, when the model or vectors are not ready
  within `SEARCH_SEMANTIC_TIMEOUT_MS`. Pure derived view, no LLM, no
  persisted data.
- **和你读过的相近 (local recommendations, 2026-10-13)** — the home page
  (after 现在最值得关注) and the foot of the 稍后读 view show published
  signals close to the ones the reader marked 已读 or 稍后读, each with its
  reason: 和你读过的《X》相近 / 和你存下的《X》相近, plus
  「也属于你关注的「Y」」 when a followed topic lifted it. Computed **in the
  browser**: the marks never leave localStorage. The server publishes one
  recommendation data file (vectors + public card fields) that is the same
  for everyone, `/signal-vectors.json`: per published signal its search
  vector, centered on the pool mean and quantized to int8, and the card
  fields the list page already shows — slug, title, an 80-character gist,
  date, band label, topic ids — keyed by `toVisitKey(id)`, the 7-character
  hash the 新 stamps use, so the long workspace ids never ship (format 2,
  `Xenova/multilingual-e5-small`, 384 dimensions; 110 signals = 106 KB,
  64 KB gzipped; `Cache-Control: public, max-age=600` + ETag; 503 when the
  model is not ready). The browser fetches it only once the reader has a
  mark, so the home page itself carries nothing for the block. Scoring is
  内容相近的信号's: centered cosine to the nearest of the newest 30 marks,
  kept only above mean + 2.5 standard deviations of all pairwise scores (the
  file carries both), at most 2 per seed, 3 on the home page and 4 on
  稍后读; a followed topic reorders what cleared the floor and never adds to
  it. Measured 2026-10-13 on 110 signals: a reader with one mark gets
  something for 80 of 110 signals, with three random marks 98%; decoding
  takes 1.5–4 ms and scoring 0.2–1 ms in the browser. No mark, no file, or
  nothing above the floor: the block is absent, with no placeholder
  (`src/lib/local-recommend.ts`, `local-recommend-vectors.ts`,
  `src/components/use-local-recommendations.ts`).
- **Topic hub (`/topics/[tagId]`)** — a per-topic drill-down page merging what
  `/network`, the 按话题 view, and `/search` each show in fragments for one
  topic tag: the tag's published technology signals, tagged skills, tagged
  knowledge, and a "图谱关联" section listing its direct content-graph
  neighbors with relation-type labels. Reached via 查看专题 links on
  `FollowableTagList` chips (technology/skill/knowledge detail pages), the
  `/topics` index (`getTopicIndex`, same file), or the 按话题 view's
  查看全部话题 link — no global nav entry. Pure derived view (`getTopicHub` in
  `src/lib/topic-hub.ts`), no new persisted data or AI calls.
  Since 2026-10-08 it opens with a 话题图谱: a static picture of at most 16
  nodes (up to 10 of the topic's best-connected items plus the outside
  neighbours most linked to them), laid out once on the server with
  /network's force layout plus a label-separation pass, edges coloured by
  relation family, linking to `/network?focus=<its best-connected item>`
  (`src/lib/topic-graph.ts`, `src/components/topic-mini-graph.tsx`).
- **Filter box on /skills and /knowledge** (2026-10-02) — both index pages
  carry one shared filter box (`LibraryFilter` on `DossierSearchInput`)
  under the stats row. It matches title, summary, tag names and the category
  the entry is filed under (a skill's 技能方向 heading, a concept's category),
  case-insensitive, every space-separated term required — /search's keyword
  rule (`src/lib/library-filter.ts`). Groups with no match are hidden; a
  status line reads 筛出 N / M, or on no match links the words to
  `/search?q=…&type=skills|knowledge`. The filter lives in `?q=`, read on the
  server for the first paint and synced with `history.replaceState`; no
  storage, and a bare page renders every card.
- **信源一览 (`/sources`)** (2026-10-02) — every publisher behind a
  published signal, grouped by `publisherName` (the organisation behind the
  announcement, not the feed it came through), with its signal count, its
  newest signals (up to three, date and linked title) and the feeds it
  arrived via, in sections by publisher type with jump chips; most signals
  first. A pure derived view over published signals' public fields
  (`buildSourceDirectory` in `src/lib/source-directory.ts`) — it never reads
  the source configuration, import runs, source health or candidates that
  `/workspace/sources` shows. Reached from a 信源一览 link beside RSS 订阅 in
  the `/technologies` header; not a nav entry; in the sitemap.
  `validate:deployment` and `validate:workspace-boundary` cover it.
  A card links 看全部 N 条 → to `/technologies?publisher=<slug>` when it
  lists fewer signals than it counts; publishers are grouped by that slug.
  The signal page's publisher name links to its card (published records
  only; 2026-10-08).
- **本站怎么挑信号 (`/about`)** (2026-10-12) — a fixed-copy public page
  explaining, in seven sections, where signals come from, the editing
  steps, the priority bands, why the 全部快讯 lane is unedited (undecided
  candidates included), the eight relation types, which features are
  AI-generated and unreviewed, and what the site stores and does not
  (with what does leave the browser: AI requests to the model provider, the
  rate limiter's in-memory count, Cloudflare; since 2026-10-13 also what a
  new-signal alert subscription stores and how to delete it). Band names, relation labels, the
  AI disclaimer and the 30-day window are read from the code that renders
  them; the share of 关联 is counted from the graph on each request
  (`getFallbackRelationPercent`, 6% on 2026-10-14). Reached from a 怎么挑信号 link in the `/technologies` header; not a
  nav entry; in the sitemap. The signal page's band sentence
  (`getPriorityUserSummary`) names the same rules since that day.
- **技术雷达 (`/radar`)** (2026-10-13) — one entry per technology
  itself (vLLM, MCP, LoRA, 推测解码 …), not per release, placed in one of
  four quadrants (模型与训练 / 智能体与应用 / 推理与部署 / 工具与方法) and
  one of four rings (采用 / 试用 / 评估 / 暂缓, innermost first), each with a
  one-sentence ring reason, 2–4 published signals as evidence, related
  knowledge and skills, and a ring history. A hand-written SVG radar
  (`src/components/radar-view.tsx`, no chart library): numbered dots,
  solid for unchanged, hollow for 本期新进 or moved; dot positions come from
  a deterministic slot grid per (quadrant, ring) cell, the slot picked by an
  FNV-1a hash of the entry id, so no two dots touch and none leaves its cell
  (`src/lib/radar-layout.ts`, pinned by tests). Beside it a list grouped by
  quadrant, 「编号 名称 · 环位」, as native `<details>`: the picture's text
  alternative (the SVG is `aria-hidden`), keyboard-operable and
  server-rendered; a click on a dot opens the same item, and the address
  carries `#radar-<slug>` (`replaceState`). 本期 is the 30 days ending on
  the radar's newest history line, so the page only changes when an editor
  changes something; the first edition is the baseline and marks nothing
  new (`deriveRadarChange` in `src/lib/radar.ts`). One public mapping,
  `toPublicRadarEntries`, resolves ids against published signals, skills
  and knowledge only; an entry with no published evidence is left off. In
  the top nav (雷达), the sitemap, with a share card and a CollectionPage
  JSON-LD; prints the list only. Seeds in `src/data/radar.ts` (40 entries,
  first edition 2026-10-13); edited from `/workspace/radar` through a
  copy-on-write overlay in `config/radar-workspace.json`
  (`src/lib/radar-workflow.ts`), where every ring change appends a history
  line and records `radar_entry.ring_changed`. Until this date `/radar`
  was a redirect to `/technologies?view=followed`.
- **Compare two technologies (P3 v0)** — reader-triggered, live AI-generated
  comparison (similarities, differences, when to prefer each) between two
  published technologies on the technology detail page. Results are cached
  per technology pair and always shown with an "AI-generated, not reviewed"
  disclaimer; the first public-facing route that calls the LLM provider
  directly (`POST /api/technologies/compare`).
- **Explain at the reader's level (P3 v1)** — reader-triggered, live
  AI-generated explanation of a published technology tailored to a
  self-selected experience level (beginner / intermediate / advanced) on the
  technology detail page. Results are cached per technology × level and shown
  with the same "AI-generated, not reviewed" disclaimer
  (`POST /api/technologies/explain`).
- **Graph-grounded learning path (P3 v2)** — reader-triggered, live
  AI-generated learning path (overview, ordered steps, self-check
  checkpoints) for a published technology, grounded in its related
  knowledge and skills from the content graph. Results are cached per
  technology and shown with the same disclaimer
  (`POST /api/technologies/learning-path`).
- **精选 filters in the address** (2026-10-01) — the curated view keeps its
  search and type / tag / priority filters in
  `?q=&type=&tag=&priority=&publisher=&sort=`,
  read on the server so a shared link renders filtered, and kept in step with
  `history.replaceState` (no history entries). Unknown values are treated as
  absent; defaults are never written. A 排序 switch — 最新发布 (default) /
  按优先级档位 (Ranking v0 bands, newest first within a band) — sits on the
  existing toolbar row; the order is the same for every reader
  (`src/lib/technology-browser-query.ts`). `publisher` (2026-10-08) is the
  publisher slug a /sources card uses for its `#publisher-<slug>` anchor
  (`getPublisherSlug`); it arrives only by link and then shows as a
  全部发布方 · <name> chip row.
- **Personal radar (P4 v0)** — readers follow topic tags (stored only in
  browser localStorage, no accounts) and the 我关注的 view on
  `/technologies?view=followed` aggregates matching published signals into
  the existing priority groups, with an explicit "matched because you follow
  X" line per item. Deterministic filtering on Ranking v0 — no AI ranking, no
  server-side profile. Detail pages carry a follow entry (P4 v0.1): the tags
  section on technology/skill/knowledge detail pages renders the same
  follow-toggle chips, so readers can follow a topic where they read about
  it, with an inline "已加入我的雷达 → 查看" link back to
  `/technologies?view=followed`. Public digest pages carry a personalized view
  (P4 v0.2): items matching followed topics get a "命中关注：X" line, and a
  "只看我关注的" toggle filters the signal sections client-side — the served
  digest stays identical for everyone. Topic-level tracking without accounts
  (P4 v0.3): every topic hub carries a 跟进此话题 block — a 关注此话题
  switch (站内 · 我的雷达, the same localStorage follow state as the tag
  chips; `TopicFollowToggle`, 2026-09-30) beside its per-topic RSS feed
  (站外 · RSS 阅读器, `/topics/[tagId]/feed.xml`, published signals only,
  shown only when the topic has any), the 我关注的
  view lists feed links for followed topics, and followed-topic state can be
  exported/imported as a plain comma-separated 关注码 for cross-device use —
  still no accounts, no server-side profile. Reading marks (P4 v0.4): every
  signal card in the 精选 / 我关注的 / 稍后读 views carries a 稍后读 and a
  已读 toggle, read cards recede (no paper, dashed border, 已读 stamp) and
  can be hidden with a 隐藏已读 switch, and the new 稍后读 view
  (`/technologies?view=saved`) lists what the reader saved, most recent
  first. Marks are manual — opening a signal never marks it read — and live
  only in browser localStorage (`src/lib/reading-state.ts`), so the served
  page stays identical for everyone. The 稍后读 view exports and imports
  them as a 阅读码 (`rm1:`, hashed signal ids; checked against the published
  signals and merged, never overwritten, on import;
  `src/lib/reading-transfer.ts`, 2026-09-30) — in the browser only, never
  through the server, and separate from the 关注码.
  新 since the last visit (2026-09-30): on the home page's priority cards
  and the 精选 / 我关注的 views, a signal the reader has not seen before
  carries a 新 stamp on its top edge, and the 精选 count row adds
  上次来访后新增 N 条 (hidden at 0). "Seen" is the set of published signals
  the reader's previous visit knew about, kept in one localStorage key
  (`ai-tech-radar:visit-state`, hashed ids, replaced — not accumulated — on
  every visit, so archived ids drop out); a visit is a run of page loads no
  more than 30 minutes apart, so a refresh or a new tab keeps the marks. A
  first visit marks nothing, a signal marked 已读 is never new, and only the
  pages that hold the full published list read or write the key
  (`src/lib/visit-state.ts`, `src/components/visit-baseline.tsx`).
  Keyboard shortcuts (2026-09-29): the 精选 / 我关注的 / 稍后读 views take
  j / k (move between signal cards; focus lands on the card's title link,
  which gets an outline and scrolls clear of the sticky nav), Enter / o
  (open), s (稍后读), x (已读) and ? (a modal list of the keys; Esc closes).
  Inputs, Ctrl/Meta/Alt chords, IME composition and Enter on links or
  buttons are left alone; 全部快讯 and 按话题 have none. Marks go through the
  existing reading state (`src/lib/signal-shortcuts.ts`,
  `use-signal-shortcuts.ts`). The ? list carries a 关闭单键快捷键 switch
  (WCAG 2.1.4); off, only ? responds. It is stored as one localStorage
  preference key, the same boundary as the theme choice.
- **Installable site, offline 稍后读, new-signal alerts (2026-10-13)** —
  `/manifest.webmanifest` (`src/app/manifest.ts`, icons in `public/` from
  `scripts/generate-pwa-icons.mjs`) makes the site installable. A service
  worker at `/sw.js` (`src/lib/pwa-service-worker.ts`, served by a route so
  its cache names carry the build id; a deploy replaces every old cache)
  keeps the shell (`/offline`, the manifest, icons), the hashed
  `/_next/static` files and exactly the signal pages saved for 稍后读. The
  page sends the worker the saved signals as hashed keys (postMessage, no
  request); the worker resolves them with `/pwa/signal-paths.json`
  (published signals, `toVisitKey` → path, the same for everyone). Pages
  are network-first; offline, a saved page comes from the cache and
  anything else gets `/offline`, which lists the saved copies. It never
  touches `/workspace`, `/api` (all of it), `/candidates` or
  `/technologies/drafts` (`pwaRequestKind`, pinned by tests).
  **「有新信号时提醒我」** on the 我关注的 view: the browser subscribes with the
  VAPID public key and `POST /api/push/subscribe` stores endpoint, keys,
  followed topic ids and creation time — nothing else
  (`src/lib/push-subscriptions.ts`, `config/push-subscriptions.json`,
  git-ignored). Every follow change on any page re-sends the topics
  (batched, `PwaRegistration`); an empty list, turning it off
  (`POST /api/push/unsubscribe`, which needs the subscription's auth
  secret) or a 404/410 from the push service deletes the record. The
  endpoint must be a known push service (FCM, Mozilla, Apple, WNS); both
  routes are rate limited (20/min, 120/h per client) and origin-checked
  like the AI routes. Sending is manual: `/workspace/delivery` → 新信号提醒
  counts first, then sends one merged notification per subscriber for the
  signals published on a chosen date that match their topics
  (`POST /api/workspace/push`, `src/lib/push-dispatch.ts`); a signal is
  pushed once; failures are reported per push service. Encryption
  (RFC 8291) and VAPID (RFC 8292) are written on `node:crypto`
  (`src/lib/push-crypto.ts`), pinned by the RFC test vectors. Off unless
  `PUSH_VAPID_PUBLIC_KEY` / `PUSH_VAPID_PRIVATE_KEY` are set
  (`node scripts/generate-vapid-keys.mjs`; optional `PUSH_VAPID_SUBJECT`);
  off, the toggle does not render. This machine reaches the push services
  only through the proxy (measured 2026-10-13), so the sending server must
  start through `with-proxy-env` with proxy settings it can see —
  `docs/editorial-round-playbook.md` Step 7b.
- **Topic timeline** — the 按话题 view on `/technologies?view=timeline`
  groups published technology signals by topic tag, each shown as a
  chronological (newest-first) list linking to its detail page.
  Published-signal data only (no news fast-lane noise); reuses
  `getAllTechnologies` / `getAllTags` and the bilingual title/summary
  helpers, no new data or route.
  Since 2026-10-12 each topic lists its newest five signals
  (`TIMELINE_TOPIC_LIMIT` in `src/components/topic-timeline-section.tsx`),
  its count reads 「N 条信号 · 最近 5 条」 when cut, and it ends with
  查看专题 · 共 N 条 → (查看专题 → when not cut) to `/topics/[tagId]`, which
  keeps the full list. A row of jump chips (`#topic-<tagId>`, the /sources
  pattern) opens the view. A signal is listed under every topic it carries,
  so the full lists ran to 322 rows for 107 signals: 54,479px at 1440,
  115,766px at 390; now 91 rows, 19,089px and 37,569px.
- **问雷达 (`/ask`)** — a public question box answered only
  from published signals, skills and knowledge, with every claim cited. The
  model (DeepSeek or any OpenAI-compatible endpoint; a search-only mock when
  no key is set) runs a small tool loop — `search_radar` (hybrid search)
  and `read_item` (an item's body) — for up to three rounds, then answers
  with streaming output. Reference numbers are assigned by the code, not
  the model, so an invalid citation is detectable; when the site has nothing,
  the answer must open with 「站内没有直接相关的内容」. The news lane is not a
  tool. `POST /api/ask` streams newline-delimited JSON events
  (`src/lib/ask-radar.ts`, tools in `src/lib/ask-radar-tools.ts`,
  streaming + tool calling in `src/lib/llm/chat-stream.ts`). On a 20-question
  set (`npm run eval:ask`) `deepseek-chat` grounded 14/14 and declined 6/6
  with 0 invalid citations — a set written by the builder that everything
  passed, stated as such in [`eval/ask/README.md`](../eval/ask/README.md).
  `/search` links each query across as a question (pre-filled, not asked).
  Before the first question the page offers up to six example questions
  built by fixed rules from published content (`buildAskExamples` in
  `src/lib/ask-examples.ts` — the newest signals, a linked signal pair, and
  the most-cited knowledge / topic / skill); clicking one fills the box
  without asking. Once an answer is done, a quiet 复制答案 button copies
  plain text: the question, the answer as shown, the cited sources with
  absolute links, and the AI disclaimer; an invalid citation is written
  `[n?]` with a note, and when the clipboard is refused a selected
  read-only text box appears instead. It is built only from what the page
  already shows and sends no request (`buildAskCopyText` in
  `src/lib/ask-answer-copy.ts`, 2026-09-30).
  **追问** (2026-10-13): once an answer is done, a box under it asks a
  follow-up, up to 5 questions per conversation, then 开新对话. The
  conversation lives in the page's memory only (a reload starts over); each
  follow-up sends the earlier questions and answers — each answer cut to 600
  characters, 2,400 in all, oldest dropped first — and the `{ ref, key }`
  pairs already shown. The server stays stateless: it re-reads each key from
  published content (titles and links never come from the request), keeps
  those numbers, and numbers anything new after the highest, so one number
  means one item for the whole conversation and a follow-up may cite an
  earlier item (`src/lib/ask-conversation.ts`, `resolveAskPriorSources`).
  A first question's prompt is byte for byte the one `ASK_PROMPT_VERSION`
  measured; follow-up additions are tagged `ASK_FOLLOWUP_PROMPT_VERSION`.
  The rate limit counts each follow-up as a request; 复制答案 becomes
  复制整段对话 (every turn, one source list, the disclaimer once).
- **Site-wide search (hybrid)** — public `/search` (an inline search icon
  in `TopNav` opens the query box) over published technology signals,
  skills, knowledge, and the sanitized news fast lane. Two halves, merged per
  group by reciprocal rank fusion and labelled 关键词 / 语义相近 on each
  result (`src/lib/hybrid-search.ts`, pure ranking in
  `src/lib/hybrid-search-ranking.ts`): case-insensitive substring matching
  on title / summary / tag names (space-separated terms ANDed,
  `src/lib/search.ts`), and similarity from a **local** embedding model
  (`Xenova/multilingual-e5-small`, q8, run in-process by transformers.js —
  no API, nothing leaves the server; `src/lib/embeddings.ts`). A semantic
  result must score at least 1.75 standard deviations above the mean for
  that query, at most 5 per group. The news lane stays keyword-only. When
  every result came from meaning alone the page says there was no literal
  match; when the model is not ready (first download, a load failure, or
  past `SEARCH_SEMANTIC_TIMEOUT_MS`, default 3000) that request answers
  from keywords and says so. Measured against 43 labelled queries
  (`npm run eval:search`): on the test split keyword search found something
  relevant for 33% of queries and hybrid for 93%, with precision falling from
  94% to 40%, and off-topic queries now always return something. See
  [`eval/search/README.md`](../eval/search/README.md).
  Keyword-matched results mark each literal hit of the query with `<mark>`
  in their title, summary and tag chips (`highlightSearchTerms` in
  `src/lib/search-highlight.ts`); results found by meaning alone carry no
  marks. When a query term matches only the original-language title a
  signal card does not display (e.g. "agent" on a card titled 智能体), the
  card adds 原标题：… under its title — 72 characters around the hit, the
  hit marked — judged per term (`src/lib/search-original-title.ts`,
  2026-09-30). When a hit sits only in the part of a summary cut at 160
  characters, the summary is shown around the hit instead (160 characters,
  starting and ending at a clause); when it sits only in the other
  language's summary, the card adds 原文摘要：… (72 characters, the hit
  marked), judged per term (`src/lib/search-card-text.ts`, 2026-09-30).
  The news group and meaning-only results still carry no marks.
  Results can be narrowed to one group with
  `?type=technologies|skills|knowledge|news` (`src/lib/search-filter.ts`,
  2026-09-30); a row of link chips above the summary shows each group's
  unfiltered count, an empty group is shown disabled, and an unknown value
  means no filter. Filtering is server-side, so it works without JS; every
  group is still computed, because the counts and the pool-wide semantic
  cutoff need them.
- **Skill/Knowledge workspace editing (v0)** — `/workspace/skills` and
  `/workspace/knowledge` manage the skill and knowledge content pools:
  create new entries, or edit the bundled `src/data` seed entries via
  copy-on-write runtime overrides (`config/skill-workspace.json` /
  `config/knowledge-workspace.json` — seed files stay read-only). Entries
  carry a draft/published status with a minimal publish gate (title / slug /
  summary required and unique slug as blocking errors; short content,
  missing or non-canonical tags, and missing relations as warnings). Public
  `getAllSkills` / `getAllKnowledge` serve the merged view with drafts
  filtered from every public surface (index/detail pages, content graph,
  search, topic hubs).
- **Typed relation editing (LinkRelation v1)** — the related-content
  checkboxes in all three workspace editors (skill, knowledge, and the
  technology draft form) unfold a relation-type select (渊源/借助/释义/
  必备/延伸/续作/印证/关联) plus an optional note while checked. Edits are
  stored as copy-on-write overrides of the read-only seed relations
  (`config/link-relation-workspace.json`, keyed by unordered pair;
  reverting to the seed value removes the override). The public relation
  reads (`findRelationBetween`, detail-page pills and 附注 notes,
  `RelationshipGraph` tooltips, `/network` edge labels, topic hubs) serve
  the merged view via `PUT /api/workspace/relations` +
  `src/lib/link-relation-workflow.ts`. A pair left on the default type is
  not stored at all, which is how the fallback 关联 reached 18.1% of the
  graph's edges; on 2026-10-12 every such pair was read and typed by hand
  (`scripts/type-fallback-relations.ts`), leaving 69 of 1137 (6.1%).
- **Daily Digest** (public name since 2026-09-24: **技术简报**, no longer
  "每日" — the task runner still drafts one per day, but publishing is
  editor-gated and in practice happens a few times a month, so the nav, the
  home page, the feed titles and the generated default title
  `技术简报 - YYYY-MM-DD` stopped promising a daily cadence; the routes and
  the workflow vocabulary below are unchanged) — editorial workflow that
  generates, edits, previews, and
  publishes daily briefs, exposed publicly via `/digest/today`, `/digest/[date]`,
  the month-grouped `/digest` archive index, `/feed.xml`, and `/feed.json`.
  The task runner can also generate the day's digest **draft** automatically
  (`config/scheduled-digest.json`, managed from
  `/workspace/delivery/schedules`; skips when the day already has a digest,
  never publishes — publishing stays editor-gated).
  **AI 起草导语** (2026-10-13): the digest edit form and the editorial-round
  console's 今日简报 block draft `editorialSummary` from the issue's
  selected signals, in the page's sections and order
  (`POST /api/workspace/digests/[date]/ai-summary`, prompt
  `digest-summary-v1` in `src/lib/digest-ai-summary.ts`). The draft fills
  a box and is never saved by the request; the editor saves it. Paragraphs
  and `**bold**` only; a draft past 400 characters is kept with a warning
  (only text past 1,200 is cut), and words the public guard hides (demo /
  mock / test …) are flagged. Model, prompt version and tokens go to a
  `digest.ai_summary_drafted` workflow event.
- **Weekly review (`/digest/weekly`)** — a public, time-boxed sibling of the
  daily digest: a derived view (`getWeeklyReview` in
  `src/lib/weekly-review.ts`, no AI) that buckets
  published technology signals into natural weeks (Monday–Sunday), classifies
  each with the same deterministic Ranking v0 the rest of the product uses,
  and groups them into 立即关注 / 值得跟踪 (low-priority excluded, matching
  the digest). `/digest/weekly` is the current week (with an empty state and
  the past-week archive folded in); `/digest/weekly/[week]` is a specific week
  keyed by its Monday date (`notFound()` for a non-canonical key or a week
  with no signals). Reached via 本周回顾 links on `/digest` and the public
  digest pages — no new nav entry.
  The weekly review also has an RSS 2.0 feed at `/digest/weekly/feed.xml`
  (`renderWeeklyReviewRssXml` in `src/lib/weekly-feed.ts`): one item per
  natural week with shown signals, up to the current week, newest first,
  capped at 12, each linking to `/digest/weekly/[week]` and listing that
  week's 立即关注 / 值得跟踪 titles. Linked from a 订阅 block at the foot of
  both weekly-review pages.
  Both the daily digest pages and the weekly-review pages end with a shared
  previous / next pager (`IssuePager`), each link naming the other issue's
  date or week range: digests step between published issues only (drafts
  and archived digests are skipped), weeks between weeks with at least one
  shown signal, never past the current week (`findIssueNeighbors` in
  `src/lib/issue-neighbors.ts`).
  **本周总结** (2026-10-13) is the one persisted thing about a week: an
  editor-written paragraph per week, keyed by its Monday, `draft` or
  `published` (`src/lib/weekly-summary.ts`, `config/weekly-summaries.json`,
  a `runtime_configs` row under SQLite). Edited at
  `/workspace/weekly-summaries` (nav 周总结), where 「AI 起草导语」 drafts it
  from the week's signals (prompt `weekly-summary-v1`), 保存草稿 saves and
  发布总结 publishes. Published text only shows on the week's page, in the
  same panel as a digest's 本期概览 under the four numbers, and as 本周总结：…
  in that week's RSS item; drafts nowhere. Being editor-confirmed it carries
  no AI disclaimer; the page description then says the list is derived and
  the summary editor-written.
- **Delivery** — workspace-only generic webhook, Feishu, Telegram (Bot API
  `sendMessage`, bot token + chat id, HTML subset, 4096) and Discord
  (webhook, one embed) channels (Telegram and Discord 2026-10-13, tested
  against a local stand-in server only), manual and
  scheduled sending of published digests, and a local cron/task runner that
  also runs the scheduled daily source import (see
  [`docs/deployment.md`](deployment.md) for Windows Task Scheduler
  setup).
- **Editorial round console (`/workspace/editorial-round`)** — a workspace-only
  orchestration page that collapses the recurring editorial-round loop (see
  [`docs/editorial-round-playbook.md`](editorial-round-playbook.md)) onto
  one screen: a round summary, a step tracker, undecided candidates grouped by
  source, largest group first (with inline 转为草稿 / 拒绝), an open-duplicate-group block notice, drafts awaiting
  publish (with per-draft publish-readiness summary + inline 发布), today's
  digest (inline 生成 / 发布, soft "publish everything first" hint), and a
  public-surface verify checklist. Pure read state (`getEditorialRoundState`
  in `src/lib/editorial-round.ts`); the inline actions reuse the existing
  candidate/technology/digest API routes, so no editor is duplicated.
- **LLM candidate triage + evaluation** — a model suggests 发布 / 标记已看 /
  拒绝 for each undecided candidate on the editorial-round console, with a
  confidence and a one-line reason (生成模型建议 button,
  `POST /api/workspace/triage-suggestions`). **Advisory only**: it writes
  suggestions to `config/candidate-triage-suggestions.json` and never changes a
  candidate's status. The suggestions are measured against real editorial
  decisions: `npm run build:triage-dataset` rebuilds a labelled set from the
  git history of the candidate snapshot (625 of 629 decisions recovered, time
  split at 2026-08-10: 146 example-pool / 479 test), and
  `npm run eval:triage` reports accuracy, per-class precision/recall, a
  confusion matrix, publish-vs-not, token usage and latency against a
  majority-class baseline and the existing pre-release rule. Prompt version is
  a code constant (`TRIAGE_PROMPT_VERSION` in
  `src/lib/candidate-llm-triage.ts`) so a reported number stays tied to the
  prompt it measured. See [`eval/triage/README.md`](../eval/triage/README.md).
- **「AI 起草」 (2026-10-13)** — an undecided candidate on the editorial-round
  console or its detail page can be drafted in one click
  (`POST /api/workspace/candidates/[id]/ai-draft`): the server reads the
  primary source (`src/lib/source-page-fetch.ts`; GitHub release pages
  through the REST API), the model writes the Chinese title, summary, body,
  explanation fields, type, publisher, topic ids and related knowledge and
  skills with relation types (`src/lib/candidate-llm-draft.ts`, prompt
  version `CANDIDATE_DRAFT_PROMPT_VERSION`), and the candidate is converted
  with those fields in one write (`src/lib/candidate-llm-draft-workflow.ts`).
  Unknown ids are dropped, the body is cut down to what `ContentBody`
  renders, and any validation failure leaves no draft and no status change.
  The draft stays `draft`; the model, prompt version, source origin, tokens
  and latency are recorded on `aiDraft` and in an editorial note, workspace
  only. Measured on 9 real candidates with `deepseek-chat`: 0 blocking
  issues, about 6.4k + 2.1k tokens and 10–13 seconds each (CHANGELOG).
- **Operations** — a workspace operations dashboard, a `WorkflowEvent` audit log,
  and per-subsystem `validate:*` checks. The dashboard pins two deterministic
  pipeline alerts above everything else: a stalled scheduled import (critical —
  while enabled, the last import in which a source succeeded is over 36 hours
  old, or `nextRunAt` is over 6 hours past) and a candidate backlog (warning —
  over 20 undecided candidates or the oldest over 7 days, linking to
  `/workspace/editorial-round`). Since 2026-10-20 it also shows today's
  public AI model calls against the site-wide daily cap (今日公开 AI 调用
  N / 500, split by route) and pins an item at 80% (warning) and 100%
  (critical). Thresholds are constants in
  `src/lib/operations-metrics.ts`; see [`docs/operations.md`](operations.md).
- **Structured data (JSON-LD)** — signal pages carry a schema.org
  `NewsArticle` (isBasedOn the original announcement, further source
  references as citation, the share card as image), digest pages a
  `CollectionPage` whose `ItemList` is the issue's signals, skill and
  knowledge pages an `Article` (knowledge `about` a `DefinedTerm`), every
  detail page a `BreadcrumbList`, and the home page a `WebSite`
  (`src/lib/structured-data.ts`, rendered by `src/components/json-ld.tsx`).
  Public fields only; drafts emit none.
- **Keyboard access** — every page's first Tab stop is a 跳到正文 skip link
  (to `#main-content`, or `#workspace-content` past the workspace rail), and
  every focusable element draws one `:focus-visible` ring coloured by
  `--focus-ring`, measured at 4.4:1 or better in both schemes.
- **Print** (2026-09-30) — the signal, digest, weekly-review, skill and
  knowledge pages print (or save as PDF) as reading copies: light colours in
  either scheme, no nav, buttons, AI widgets, 本页目录, relationship graph,
  pager or subscribe blocks, and outbound links in the body and source
  references followed by their URL. A4 page counts dropped from 7 → 4
  (signal), 12 → 9 (digest), 19 → 11 (skill). Every rule is in
  `src/app/styles/print.css`, one `@media print` block.
- **English interface (`/en`, 2026-10-14)** — every public page has an
  English twin at `/en` + its address (`/en`, `/en/technologies/<slug>`,
  `/en/digest/weekly/<week>` …; route files in `src/app/en/`, share images
  included). The interface is English; content is shown in the language it
  exists in, never machine-translated: a signal's `en` text, else its
  original when the source is English, else the Chinese. Skills, knowledge,
  editors' notes and digest ledes are Chinese. Chinese content on an English
  page carries `lang="zh-CN"`, and a page with any says so once in a
  low-key 「Chinese only」 line (`ChineseOnlyNote`). A signal's original
  body is shown only when it is an article (≥ 400 characters,
  `englishBodyMinLength`); otherwise the Chinese write-up under a note.
  问雷达 and the three AI widgets answer in Chinese and say so. Page bodies
  live in `src/components/pages/` and take a `locale`; the Chinese route
  file and its `/en` twin only pass it. Interface strings are in
  `src/lib/i18n/copy/` (`{ zh, en }`, English typed `typeof zh`); topic
  names in `src/lib/i18n/topic-names.ts`. `<html lang>` comes from the
  `x-site-locale` header the middleware sets on every page request. The nav
  carries a 中 / EN link to the same page in the other language (query and
  hash kept; absent where there is no twin, `hasEnglishTwin`); every page
  names both versions with hreflang (`x-default` = Chinese), and the
  sitemap lists both. Chinese addresses and pages are unchanged. No English
  feeds, API routes, `/offline` or workspace.
- **Persistence** — local JSON by default, with an optional SQLite driver.
- **Security boundary** — optional token protection for workspace and internal
  API routes, with internal-only fields kept off public pages and feeds.

## Architecture & route boundary

The codebase is layered: bundled data (`src/data`) → workflow/business logic
(`src/lib`) → App Router pages and API routes (`src/app`) → shared UI
(`src/components`). Pages and API routes call workflow services rather than
reading storage directly.

Public, user-facing routes:

- `/`, `/technologies` (精选/全部快讯/按话题/我关注的/稍后读 five views via
  `?view=`),
  精选 also takes `?q=&type=&tag=&priority=&publisher=&sort=`,
  `/technologies/[slug]`
- `/digest` (archive), `/digest/today`, `/digest/[date]`,
  `/digest/weekly` (本周回顾), `/digest/weekly/[week]` (per-week review)
- `/skills` (`?q=` filter), `/skills/[slug]`, `/knowledge` (`?q=` filter),
  `/knowledge/[slug]`
- `/network` (`?focus=<node id>` preselects a node)
- `/radar` — 技术雷达, technologies by quadrant and ring with their evidence
  signals (`#radar-<slug>` opens an entry); a nav entry
- `/sources` — publisher directory derived from published signals (not a
  nav entry; linked from the `/technologies` header)
- `/about` — 本站怎么挑信号, how signals are picked and what the site does
  not collect (not a nav entry; linked from the `/technologies` header)
- `/topics` — topic index: every topic with at least one published signal,
  skill or knowledge item (the same rule as the hub's `notFound()`), with its
  description and the three counts, ordered by signal count then name; not a
  nav entry
- `/topics/[tagId]` — topic hub (reached via tag chip links or `/topics`, not
  a nav entry)
- `/topics/[tagId]/feed.xml` — per-topic RSS feed of that topic's published
  technology signals (404 for unknown topics or topics with no published
  signals)
- `/technologies/feed.xml` — RSS of the newest 50 published technology
  signals, newest first (`renderAllSignalsRssXml` in `src/lib/signal-feed.ts`,
  sharing its item renderer with the per-topic feed); announced on every
  `/technologies` view and linked from its header (RSS 订阅)
- `/search`, `/ask`
- `/en`, `/en/...` — the English twin of every public page in this list
  except the feeds, `/signal-vectors.json`, the PWA files, `/offline` and
  the API routes (`/en/news`, `/en/timeline` redirect to the English
  `/technologies` views; `/en/.../opengraph-image` are English share cards)
- `/feed.xml`, `/feed.json`
- `/signal-vectors.json` — the recommendation data file (vectors + public
  card fields) for the browser-side 和你读过的相近; no parameters
- `/manifest.webmanifest`, `/sw.js` (the service worker), `/offline`
  (noindex) and `/pwa/signal-paths.json` (hashed signal key → path) — the
  installable site and offline 稍后读
- `GET /api/push/config`, `POST /api/push/subscribe`,
  `POST /api/push/unsubscribe` — a reader's own new-signal alert
  subscription; rate limited and origin-checked, never answer with a
  stored field
- `/digest/weekly/feed.xml` — weekly-review RSS (published signals only)
- `/news`, `/timeline` redirect to the matching `/technologies?view=` (`/radar`
  did too until 2026-10-13; it is now the technology radar)
- `GET /api/health` — public liveness check for an external uptime monitor:
  `200 { status: "ok" }` while the store reads, `503` when it does not, plus
  the build id, uptime, published-signal count and the semantic search
  model/corpus state (see `docs/deployment.md` → "Health endpoint and uptime
  alerts")
- `POST /api/technologies/compare`, `POST /api/technologies/explain`,
  `POST /api/technologies/learning-path` and `POST /api/ask` — public, unauthenticated by design
  (they only operate on already-published technology content), but rate
  limited per client per route (default 10/minute and 40/hour, override with
  `PUBLIC_AI_RATE_LIMIT_PER_MINUTE` / `PUBLIC_AI_RATE_LIMIT_PER_HOUR`) and,
  all four together, capped at `PUBLIC_AI_DAILY_LIMIT` model calls per
  Asia/Shanghai day (default 500; a cache hit is not a model call and does
  not count; `429` with `Retry-After` to midnight once spent; the count
  lives in `config/public-ai-usage.json` so a restart keeps it; 2026-10-20);
  see [`docs/security-boundary.md`](security-boundary.md) for the boundary
  reasoning.

Internal workspace / API routes (optionally token-protected):

- `/workspace/*` (including `/workspace/weekly-summaries`)
- `/api/workspace/*`, `/api/candidates/*`
- legacy `/candidates/*` and `/technologies/drafts/*` (redirect to workspace)

Public pages must never call mutation APIs, import workspace action components,
or render internal-only fields (raw payloads, import status, normalized type,
duplicate internals, delivery endpoints, schedules, task-runner logs, workflow
events, or workspace tokens).

Optional workspace protection:

```bash
WORKSPACE_ACCESS_ENABLED=true
WORKSPACE_ACCESS_TOKEN=replace-with-a-strong-secret
```

The middleware accepts `Authorization: Bearer <token>`, a Basic-auth password,
or `x-workspace-access-token`. See [`docs/security-boundary.md`](security-boundary.md)
and [`docs/deployment.md`](deployment.md) for the full environment-variable
reference.

## Persistence

JSON is the default store. SQLite is an optional local driver:

```bash
# default
PERSISTENCE_DRIVER=json

# enable SQLite locally
npm run db:init
npm run db:migrate-json
PERSISTENCE_DRIVER=sqlite npm run dev
```

SQLite defaults to `config/ai-tech-radar.sqlite` (override with
`SQLITE_DATABASE_PATH`) and uses Node's built-in `node:sqlite`. The local JSON
store does **not** provide multi-writer locking, role-based permissions, or
production secret handling, and is intended for local development or controlled
single-operator use. See [`docs/persistence-plan.md`](persistence-plan.md)
and [`docs/database-migration.md`](database-migration.md).

## Local run

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

## Useful commands

```bash
npm run typecheck        # default verification
npm run build            # full app, workspace included — for local use
npm run build:public     # public-only build: the workspace routes are physically absent
npm run dev              # dev server, loopback only (next dev -H 127.0.0.1)
npm run start            # production server, loopback only (next start -H 127.0.0.1)
npm run deploy           # Windows host: build beside the live server, swap, restart, health-check, auto-rollback
npm run deploy:rollback  # swap back to the previous build (.next-old) and restart
npm run deploy:rehearse  # drive the deploy script against a stand-in server on port 3199
npm run lint             # ESLint (next/core-web-vitals + next/typescript + prettier compat)
npm run lint:fix         # ESLint with autofix
npm run format:check     # Prettier check (no writes)
npm run format           # Prettier write
npm run sync:candidates  # refresh imported candidates from live sources
npm run gen:favicon      # rebuild src/app/favicon.ico from its generator
node scripts/generate-pwa-icons.mjs  # rebuild the PWA icons under public/
node scripts/generate-vapid-keys.mjs # print a VAPID pair for reader push (.env.local only, never committed)
npm run backup:data      # verified timestamped snapshot of LOCAL_DATA_DIR
npm run measure:news-lane # who the public 全部快讯 view is currently showing
node scripts/run-ts.cjs scripts/measure-semantic-dedup.ts [--unlabelled] # semantic dedup precision/recall per threshold against eval/dedup/labels.jsonl
node scripts/run-ts.cjs scripts/refresh-semantic-dedup.ts # run the post-import semantic dedup once and list what it found (writes candidate-semantic-matches.json)
node scripts/run-ts.cjs scripts/repair-entities.ts [--apply] [--published-text] # one-off: strip HTML / decode entities left in stored imports (dry run by default)
node scripts/run-ts.cjs scripts/fix-boilerplate-originals.ts [--apply] # one-off: InfoQ 「点击查看原文」-only originals → their Chinese text (dry run by default)
node scripts/run-ts.cjs scripts/fix-github-blog-footer.ts [--apply]    # one-off: strip GitHub Blog's "appeared first on" footer from published signals (dry run by default)
node scripts/run-ts.cjs scripts/type-fallback-relations.ts [--apply] # one-off: give the fallback 关联 edges a relation type, and two related signals to each of the seven signals that had none (dry run by default)
node scripts/run-ts.cjs scripts/retag-signals.ts [--apply]           # one-off: put the nine 2026-10-12 topics on published signals, skills and knowledge, and narrow 智能体 / 前沿模型 / 推理与部署 (dry run by default)
npm run check:pipeline   # Windows toast when the scheduled import stalls or candidates pile up (once per alert per day; -- --dry-run / -- --test)
npm run build:triage-dataset # rebuild the triage eval set from git history
npm run eval:triage      # score LLM triage against real editorial decisions (-- --limit N for a sample)
npm run eval:search      # score keyword / semantic / hybrid search on labelled queries (-- --grid to sweep the cutoff)
npm run eval:ask         # score 问雷达: citation validity, grounding, refusals (EVAL_ENV_FILE to borrow a .env.local)

# persistence / task runner — launched by scripts/run-ts.cjs against the REAL
# data directory (it prints which one); never through run-ts-validation.cjs,
# whose throwaway copy discarded four days of imports (2026-09-25 to 09-27)
npm run db:init
npm run db:migrate-json
npm run tasks:run-once

# per-subsystem validation scripts — each runs against a throwaway copy of the
# data directory (scripts/run-ts-validation.cjs), never the real config/;
# VALIDATION_DATA_DIR=live opts out. `validate:all` runs the whole set in order.
# That launcher accepts only validate-* and eval-* scripts.
npm run validate:all
npm run validate:candidates
npm run validate:publishing
npm run validate:sources
npm run validate:duplicates
npm run validate:quality
npm run validate:ranking
npm run validate:digest
npm run validate:delivery
npm run validate:delivery-integration
npm run validate:delivery-channels
npm run validate:scheduled-delivery
npm run validate:tasks
npm run validate:deployment   # also: share-image / icon / sitemap routes without a dynamic segment must declare their render mode
npm run validate:persistence
npm run validate:database
npm run validate:workflow-hardening
npm run validate:operations
npm run validate:content-intelligence
npm run validate:editorial-enrichment
npm run validate:llm-enrichment
npm run validate:prompt-quality
npm run validate:workspace-boundary
```

### Manual UI validation

```bash
npm run ui:check
```

This launches the locally installed Chromium browser, visits workspace and
user-facing routes, and writes screenshots plus route/CSS/overflow/internal-field
leak checks to `visual-qa-screenshots/`. It is a manual local step; sandbox runs
may fail to launch Chromium (`spawn EPERM`), which is an environment limitation,
not a project failure.

### Computed-style diff (structural CSS changes)

```bash
npm run css:diff -- capture before.json
npm run css:diff -- capture after.json --routes-from before.json
npm run css:diff -- diff before.json after.json
```

For CSS refactors that must change nothing. `capture` drives the installed
Chrome (headless) over ~63 public and workspace routes at 1440 light, 1440 dark
and 390, recording every element's full computed style and box plus the exact
stylesheet text each page received; `diff` compares two captures. It refuses
port 3000 (the live site): serve each build on its own port
(`NEXT_DIST_DIR=… next build`, then `next start -p 3100`) against a copy of the
data. A clean result means something only after a same-build control reads 0
and a deliberate probe (`--probe "<css>"`, or a real edit in its own build)
reads non-zero — see `docs/design-system.md` → "Splitting globals.css".
When the stylesheet is meant to change (a regroup), add `--css-may-change` to
`diff`: the computed styles must still match, the CSS text no longer does.

```bash
npm run css:regroup -- plan  --dom before.json components/<name>=<root>,<root>
npm run css:regroup -- apply --dom before.json components/<name>=<root>,<root>
```

Moves a component's rules out of the numbered layer files into
`src/app/styles/components/` or `pages/`, checking every pair of rules the move
reorders for a possible tie and leaving any rule it cannot prove safe in place,
with a comment. `--dom` takes a `css:diff` capture for the class combinations
real elements carry. Follow every `apply` with a build and a `css:diff`
against the build before it. See `docs/design-system.md` → "Gathering each
component into one file".

## Local state files

Runtime workflow state lives in `config/` as JSON (the default fallback store):
imported candidates, candidate review state, external sources, technology
workspace records, skill and knowledge workspace records, radar workspace
records, link relation overrides, duplicate groups,
daily digests, delivery, scheduled delivery, scheduled import, scheduled
digest draft, task runner,
workflow events, editorial enrichment suggestions, candidate triage
suggestions, reader push subscriptions (git-ignored), today's public AI call
count against the daily cap (`public-ai-usage.json`, git-ignored), and prompt
versions. Set `LOCAL_DATA_DIR` to point at a different local directory.

## Project structure

- `src/app` — App Router pages and API routes; `src/app/styles/` holds the
  global stylesheet: `pages/` (8) and `components/` (58), one page's or
  component's own rules each, and 46 numbered files with the shared rules and
  layers, all imported by `globals.css` in cascade order
- `src/components` — shared workspace and user-facing UI
- `src/data` — bundled mock technology/skill/knowledge/tag/relation and fallback
  import data
- `src/lib` — workflow services, importers, duplicate detection, ranking, digest
  and delivery logic, repositories, and localization helpers
- `src/types` — shared TypeScript models
- `scripts` — local workflow, sync, and validation scripts
- `config` — local runtime workflow state
- `docs` — architecture, data model, page structure, design system, and other
  per-topic notes

## Documentation

Start from [`AGENTS.md`](../AGENTS.md) and [`CHANGELOG.md`](../CHANGELOG.md), then the
relevant file under [`docs/`](./): `project-spec`, `architecture`,
`data-model`, `page-structure`, `design-system`, `security-boundary`,
`deployment`, `persistence-plan`, `database-migration`, `workflow-hardening`,
`content-intelligence`, `editorial-enrichment`, `llm-provider`, `prompt-quality`,
`operations`, `workspace-actions`, `editorial-round-playbook`,
`production-readiness`, `decisions`, and `next-task`. The session log that
used to live in `next-task` is archived in `history/next-task-log.md`.

## Intentionally not implemented yet

AI black-box / personalized ranking and recommendation; login / accounts / RBAC;
production database integration and schema migrations; full admin platform;
external monitoring and alert routing; push / email subscription products and
production cron infrastructure; machine translation of content, English
feeds and English AI answers (the interface has an English version since
2026-10-14, the content does not); semantic/AI duplicate detection
beyond the current deterministic rules; distributed scheduling, retry backoff,
and production secret storage; automatic translation APIs; and per-source
scheduling / auth.
