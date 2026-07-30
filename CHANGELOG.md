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

## Slimming the top of a page — and an argument from precedent, rejected

- **Owner-reported, three complaints in one message** — 2026-07-30: the
  「隐藏已读」switch makes the page jump, the strip at the top of the
  technology / knowledge pages does not match the rest of the site, and the
  whole site carries too much decorative copy. Scope was settled with a
  before/after mockup and three decisions: **report-head** for the page top,
  **the nine list pages only** this round, and **all three fixes together**.
- **The header defect was a missed selector, not a taste difference.** One
  pre-dossier rule paints three headers together; the 2026-07-14 migration
  wrote `.dossier` overrides for the home hero and the article hero and none
  for `.user-page-header`, so the list pages kept a mint gradient, a teal
  border, a 26px radius and a shadow while everything under them was paper and
  hairlines. Dark mode was half-converted: an override dropped the gradient and
  left the teal border and the 26px corner on a dark ground.
- **The obvious fix was rejected, and the reasoning is the entry.** The first
  proposal was to give the header the paper panel its two siblings already
  carried — the same "converge on the shared primitive" move that fixed four
  earlier defects. The owner refused the premise: 「它们已经是目标状态了是老的
  目标 … 没有必要用前朝的剑斩今朝的官」. Consistency with what exists is an
  argument from precedent, and here the precedent _was_ the complaint — the
  panel is why every list page opened with a bordered box restating its own
  title. What shipped separates the two kinds of page top: a **list** header is
  a label (eyebrow + title over a hairline), a **detail/home** hero is an
  object (it holds source, publisher type, priority copy, digest counts) and
  keeps its panel, re-measured unchanged.
- **Two numbers came out of it.** The panel's padding had been indenting the
  title **33px** past the content beneath it; all nine list routes now put
  title, eyebrow and first content block on one left edge, header height
  **191 → 148px**. And `/skills` / `/knowledge` had sat **16px** off their own
  content because the header used `max-width` where the sections use a definite
  `width` + `margin-inline: auto` — under `.user-shell { display: grid }` an
  auto inline margin on a `max-width` item shrinks it to fit and centres it,
  which the first attempt proved by moving the title to 416px and 509px.
- **The read filter shares a row that already exists.** It renders nothing
  until the reader marks a signal, so on its own row it inserted 41px and
  pushed the grid down. Keeping it always visible would have restored the
  defect the null-render was avoiding; reserving space would have left a blank
  row. It now sits in the curated view's toolbar and the saved view's lede row:
  grid top holds at **647px / 434px, 0px shift**, row heights unchanged. The
  saved row needed a `min-height`; the curated row did not (its language switch
  already sets the height) **and therefore does not have one**.
- **Decorative copy: two blocks and a paragraph removed.** The 阅读路径 cards on
  `/skills` and `/knowledge` (three headings + three sentences each, explaining
  how to use the site rather than saying anything about the content) and the
  curated toolbar's two-line explanation. The rule applied: copy that restates
  the title is decoration, copy carrying a number or a state is information —
  so the stats rows stay.
- Verified: typecheck, lint, format, vitest 188/188, plus a live pass over the
  nine list routes — zero content painted outside its parent, no horizontal
  overflow at 1600/1440/1180/1024/900/768/640/390. **Not verified by looking:**
  the Browser pane's screenshot tool was unavailable for this session (the pane
  is not displayed, so the page composites no frames), stated here rather than
  quietly downgraded to DOM checks per the `AGENTS.md` visual verification rule.
  Known and unfixed: at ≤640px the skills/knowledge title still sits 4px off its
  content, and `.skills-library-guide`'s rules are now unreachable but left in
  place, since this repo removes dead CSS in its own commit with a
  computed-style diff.

## Second site-wide sweep — the three defects a detector cannot find

- **Every reader-facing page was screenshotted and looked at, in both colour
  schemes** — 2026-07-29, owner-requested after the first sweep. 25 routes ×
  2 schemes = 50 full-page captures at 1440px, each opened and read, with 1:1
  crops for anything suspicious. The Browser pane's screenshot tool timed out
  again (twice, 30s each), so this ran through Playwright against the locally
  installed Chrome — stated here rather than silently downgraded to DOM checks,
  per the `AGENTS.md` visual verification rule.
- **The two detectors from the first sweep found nothing, and that is the
  point.** Both were re-proven to fire (an injected border-with-no-padding was
  caught 4 times, an injected overflow 8 times) and then returned **zero hits
  across all 20 public routes**. Every defect below was found by looking.
- **13 findings, 12 fixed, 1 withdrawn.** The full screening, with a screenshot
  per finding, went to the owner before any code changed; the owner then picked
  the batches in severity order.
- **A whole block of copy was invisible in dark mode.**
  `.empty-state--actionable` hardcodes a near-white fill, so after the
  2026-07-16 dark round turned its text light, the heading measured **1.19:1**,
  the body 2.52:1 and the link 2.82:1 against a 4.5:1 bar. Seven public
  surfaces render it. Now scoped-dark: 11.53 / 5.42 / 4.84, light untouched.
  **This is the 2026-07-16 lesson recurring verbatim** — a colour that is fine
  on one surface fails on another, and only measurement catches it.
- **The search page's submit button was browser-default chrome** — a square,
  hairline box 12px shorter than the pill beside it, the only unstyled control
  on the public site, and invisible to both detectors because its DOM and its
  contrast are both fine. It now reuses `.action-button--primary`, verified
  value-by-value against the home hero's button rather than by eye.
- **Four sibling detail pages, three different measures.** The skill and
  knowledge pages kept the hero inside the reading column, so the aside stood
  level with the title; hero 618 vs 896, column 618 vs 588, aside 300 vs 280.
  The **skin was already identical** — same fill, radius, padding and h1 size —
  so this was the skin-vs-box-model split in its third form. All four pages now
  render on the same four edges (272 / 860 / 888 / 1168), with no overflow at
  seven widths and the 980px collapse intact.
- **Four alignment defects, all CSS-only, all measured before and after.** The
  home page's 技能 and 知识 columns started **116px apart** — both are grid
  items stretched to the taller one's height, and `align-content: normal` then
  spread that height across the shorter column's own rows, sinking its first
  card while the headings stayed level. The home news rows were **pure white on
  a paper page**, the one card type the 2026-07-14 migration could not convert
  (they need `target="_blank"`, which `DossierRegisterRow` cannot express).
  `/network`'s controls floated between two bordered blocks — **exactly what
  the first sweep fixed on `/technologies`**, on a page that round did not
  cover, which is what fixing page by page costs. And the digest's 今日概览
  reserved a **183px empty label column** beside a nine-line paragraph, the same
  near-empty fixed column the first sweep removed from the digest hero.
- **A third claim was withdrawn — and this one indicts the method.** "The aside
  runs out a quarter of the way down, leaving 73–85% of the right side empty"
  was read off the full-page screenshots. The asides have carried
  `position: sticky` all along, and scroll-testing all three pages showed them
  pinned at 86/96px from the top through the entire page, releasing only at the
  column's end. **A full-page capture flattens sticky positioning into its
  static position**, so "empty column" in such a capture is a known false
  positive — now recorded in `docs/design-system.md` beside the two detectors.
- **One finding was withdrawn after measuring, and one after re-measuring.**
  The view tabs looked like their unselected state out-shouted the selected one;
  sampling the colours showed the hierarchy was correct and the muted brown had
  read as accent in a downscaled screenshot. Worse, a **claimed 82px step on the
  digest page reached the owner's confirmation sketch before it was checked** —
  it came from comparing a padded container's border box against its own child.
  Every digest block, hero included, sits at 272/896. The correction led the
  verification write-up rather than being quietly dropped.
- Verified: typecheck, lint, format, both detectors re-proven and clean, 7
  viewport widths, and contrast re-measured in both schemes.
- **The five consistency findings closed the sweep.** `/technologies` had its
  own hero surface — a radial gradient and a 28px radius against the linear
  gradient and 26px the other seven list pages share; it inherits now. Short
  pages ended above the fold and exposed the body gradient as a hard-edged band
  (277px on `/search`), so the content area reaches the viewport bottom —
  `100dvh`, and the nav measures exactly 61px at every height tested. A stamp
  tag was stretched to **446px around two characters** on the home cards, where
  the same component is 70px on a signal card. The dark-mode empty-state fix was
  completed rather than left as a patch: both public empty-state components now
  draw from the same tokens in both schemes, so the hardcoded fill that caused
  the 1.19:1 failure is gone in light too. And three pages presented a count
  three ways — two of them in the near-empty fixed column the first sweep had
  already removed twice; all three are captions now.
- **The detector caught a leftover the edit missed.** After the count line was
  rebuilt it fired on it — a _third_ dossier rule for that class, shadowed by
  neither of the two that were edited, still painting a background. The
  screenshot from the same pass shows the grey band it would have shipped.
- **Sweep closed: 13 findings, 12 fixed, 1 withdrawn**, across 9 commits.

## Site-wide visual sweep — five more defects, four of them structural

- **Everything here was found by looking, after the digest round proved that
  checking only what you just touched misses the obvious** — 2026-07-29, same
  session. Two detectors were written and, critically, **each was proven to
  fire before its clean results were believed**: one flags a container that
  draws a border or fill but has no inside spacing, one flags content painted
  past its parent's content box.
- **Four containers had a border drawn and no padding** (owner-reported, and
  the most visible defect of the whole day). `.daily-digest-section` and
  `.digest-reference-section` were pure layout grids — `display: grid;
gap: 16px`, no padding, because nothing was ever meant to see them — until
  the 2026-07-14 dossier migration gave five containers a background, border
  and radius in one rule. Only two of the five had ever had padding. So
  今日立即关注 / 值得跟踪 / 值得关注的技能 / 背景知识 rendered their headings
  and cards flush against all four edges, and 今日概览 (a top-ruled divider,
  `padding: 18px 0 0`) showed three flush edges once wrapped in a full border.
  `.daily-digest-feeds` set `border: 0` / `background: transparent`, none of
  which ever won against the more specific dossier rule. All four now use the
  20px that 来源参考 — the one section that looked right — already used.
  **Pre-existing, not introduced by the same day's digest commits** (checked
  against `268feb7`).
- **Every technology detail page overflowed its reading column by 105px.** A
  native `<select>` sizes to its widest option, and the compare widget's
  options are full technology titles — it rendered **558px inside a 487px
  column**. `.user-article-layout__main` sets `min-width: 0` but its children
  did not, so each section sized to that min-content and dragged its siblings
  along; body text ran under the aside panel. `max-width: 100%` cannot fix it
  (the track is sized _from_ that min-content, so 100% resolves back to
  558px); `min-width: 0` plus `flex: 1 1 220px` is what works. Verified at
  seven widths: spilling text runs **16 → 0** at every one.
- **A read card looked broken rather than read.** `background: transparent`
  let the page's grid pattern through, so a read card read as "failed to load"
  beside an unread card's solid paper. It now keeps a surface pulled toward
  the page ground; text measures 5.44 light / 5.19 dark, zero failures.
- **The `/technologies` controls floated between two bordered blocks**, so the
  page read as hero / gap / cards; they are one panel now. **The home digest
  card's two counts sat in a fixed `minmax(150px, 220px)` column** — the same
  near-empty column removed from the digest hero — and are now an inline meta
  row.
- **Chinese headings split words across lines** (首页 「发现值得关 / 注」,
  detail 「…参数旗 / 舰」). `word-break: auto-phrase` was measured against a
  Japanese and a Chinese control: it **changes Japanese and leaves Chinese
  byte-identical**, so `src/lib/cjk-line-break.ts` segments with
  `Intl.Segmenter('zh-CN')` on the server and marks word runs unbreakable.
  The alternative — a responsive `--fs-display` — was **implemented, measured
  and reverted**: identical breaks at 1600/1014/768px and _worse_ at 390px
  (3 lines → 5, newly splitting 参数 and 承诺). Honest limit, pinned in tests
  rather than glossed: 13 of 16 signal titles now break cleanly; 复盘, 智能体
  and 主打 still split, because the ICU dictionary splits them.
- Verified: typecheck, lint, format, vitest **188/188** (7 new, confirmed to
  fail when segmentation is disabled), both detectors re-run clean across the
  touched pages, and live checks in light and dark.
- **Two of the session's own tools were wrong before the code was**: the
  contrast harness could not parse `color-mix`'s `color(srgb 0 0 0)` output
  (0-1 channels, not 0-255) and reported a false 2.44:1 failure; and a Python
  heredoc used to patch files failed silently, exactly as recorded on the same
  day. Both were caught by sanity-checking the tool before trusting its
  output.

## The daily digest page rejoins the house style

- **Owner-reported, and the reflection matters more than the fix** —
  2026-07-29. The owner pointed at `/digest/today` and said its UI was
  obviously wrong. It was, in six separate ways, and none of them was subtle.
  The reason none had ever been flagged is recorded as a rule in `AGENTS.md`
  ("Visual verification rule"): every past round verified only the thing that
  round added, and DOM inspection was repeatedly accepted as a substitute for
  looking at the page. **An ellipse has perfectly normal DOM and passing
  contrast** — only a screenshot shows it.
- **The hero had forked from the shared primitive.** Public detail pages use
  `user-article-hero` (`/technologies/[slug]`); this page hand-rolled
  `daily-digest-brief-header`, a `507.5px | 174px` grid whose narrow column
  held four counts and sat three-quarters empty beside 522px of prose. Both
  routes already passed `showHeader={false}` and then threw the
  `title`/`description` props away. The hero now renders through
  `user-article-hero` as one column, with the counts as an inline meta row
  mirroring `.technology-detail-hero__meta`.
- **The title broke mid-date** — `每日技术简报 - 2026-07-` / `28` — because a
  hyphen is a legal break opportunity. Public hero headings are pinned to
  `--fs-display` with `!important`, so shrinking the type for one page would
  have broken the shared scale; instead `renderTitleWithUnbreakableDates`
  keeps `YYYY-MM-DD` runs on one line without changing a character of the
  title.
- **`今日概览` was a constant.** The panel rendered a sentence hardcoded in the
  component, identical on every digest, while the real editorial summary sat
  in the hero — one page, two summaries, one of them zero-information. The
  panel now carries the editorial summary and is skipped when there is none.
- **Three more, each a leftover of the 2026-07-14 dossier migration:**
  `.digest-source-chip` kept `border-radius: 999px` from its pre-dossier pill
  design after the migration turned it into a full `DossierCard`, rendering
  every 253×177 source card as an **ellipse** (the same round added a colour
  rule for that class — so it was looked at, and only the colour was
  adjusted); `.digest-technology-card__audience` carried `font-weight: 800`,
  making the "适合 …" line louder than the card title above it; and
  `值得跟踪` used a one-column grid against `今日立即关注`'s two, so identical
  cards rendered at two widths on one page, with the P4 match line sitting
  outside each card as a stray floating label.
- **A regression was caught by measuring, not by looking.** Moving the counts
  out of their white inset box dropped the meta row to **4.4:1** in light
  mode — 0.1 under AA. It now inherits `--dossier-muted` and measures 5.87
  light / 5.42 dark; every other changed element measures 5.19–13.32.
- **The CSS cleanup shipped as its own commit, verified by diff rather than by
  eye.** 251 lines: 10 digest classes with no remaining JSX reference, and 18
  top-level rules whose every declaration is redeclared later by an identical
  selector (rules involving `!important` excluded, since order alone does not
  decide there). Computed values for 27 properties plus bounding boxes were
  captured for every digest-classed element on `/digest/today` (79),
  `/digest` (44), and `/workspace/digests/[date]` (27), then recaptured with
  the cleanup stashed — **150 elements, zero differences**. The harness was
  proven both ways: an injected `border-radius: 999px` was detected (3 hits),
  and the stashed revert was confirmed active by finding the 16 removed rule
  instances back in the loaded stylesheets.
- Verified: typecheck, lint, format, vitest 181/181, `validate:digest` /
  `persistence` / `workspace-boundary` / `ranking`, plus a live pass in both
  colour schemes with zero console errors and no horizontal overflow at 390px.
  **Known and deliberately not fixed:** at 390px the date needs 260px against
  244px of measure, so it reaches 16px into the hero's 22px padding. That is
  `--fs-display: 44px` having no mobile step — a site-wide type-scale gap that
  this page merely exposes, and changing it would move every public hero.
  15 digest selectors also still carry partially-overriding duplicate
  declarations, which need per-rule reasoning rather than a provable rule.

## A failed import no longer destroys the source's candidate snapshot

- **The fallback placeholder was replacing real candidates, not joining them**
  — 2026-07-29, fixing the data-loss path recorded in
  `docs/editorial-round-playbook.md` on 07-28. A manual single-source import
  falls back to one synthetic `fallback`-tagged candidate when the live fetch
  fails, and `mergeImportedCandidatesForSource` replaced that source's entries
  wholesale — so a failed re-run traded every real candidate the source had for
  the placeholder. It cost a recovered `Ollama v0.32.5` candidate for real, and
  the snapshot had to be restored from the previous commit.
- **Only the failure path changed.** The success path still replaces, and that
  is deliberate: a live feed is the current truth, and the snapshot is a
  rolling window whose entries age out while `candidate-review-state.json`
  keeps every decision (40 snapshot candidates against 104 review entries on
  the day this was fixed). What is wrong is trading real rows for a synthetic
  one _because the fetch failed_. `mergeImportedCandidatesForSource` gained a
  `preserveExistingCandidates` option, passed only from the fallback branch of
  `runImportForSource`.
- **Repeated failures do not stack placeholders.** The placeholder id embeds
  the date, so a second failure on another day would otherwise add a
  near-identical row; every placeholder carries the source's own feed URL
  rather than an item URL, so the merge skips an incoming candidate whose id
  **or** source URL already exists for that source. The source record's
  `itemCount` is recomputed in this branch too, since the caller sized it from
  the incoming batch alone.
- **The merge rules moved into a pure core** — `buildMergedCandidateSnapshot`
  takes the snapshot, the record, the batch and a `syncedAt` and returns the
  next snapshot with no file I/O and no clock of its own;
  `mergeImportedCandidatesForSource` is now the thin read/write wrapper. Same
  pure-core-plus-wrapper shape as `reading-state.ts` and
  `link-relation-workflow.ts`.
- **Verified by reproducing the loss first.** An isolated `LOCAL_DATA_DIR`
  probe seeded a source with two real candidates and ran a real import against
  an unreachable host: on the reverted code the snapshot came back holding
  **only** `['candidate-source-probe-source-2026-07-28']` — both real
  candidates gone, exactly the 07-28 incident — and on the fixed code it holds
  both plus one placeholder, with `itemCount` 3. Also: typecheck, lint, format,
  vitest **181/181** (10 new tests covering the replace default, preservation,
  the same-feed-URL placeholder skip, id collision, other sources staying
  untouched, `itemCount` in both modes, sort order and input immutability), and
  `validate:sources` / `candidates` / `persistence` / `tasks` / `duplicates` /
  `quality`.

## Publisher type rendered, translation status corrected

- **The remaining payload-without-render gap was closed unevenly, because the
  two fields turned out not to be the same kind of thing** — 2026-07-29,
  owner-selected as the "公开面渲染缺口" item left open by the 07-28 sweep.
  The plan going in was to surface `translationStatus` as a 已翻译 / 原文 hint;
  measuring the real data reversed it.
- **`translationStatus` had drifted, and its truthful replacement carries no
  information** — two measurements, both against the 31 published signals.
  First, the stored field said `pending` on **6 of 31** records that in fact
  carry a complete Chinese title, summary, and body (`gemini-flash-cyber`,
  `openai-long-horizon-safety`, and 4 seed records) — editors had simply not
  flipped the field at publish time, so rendering it would have printed a false
  claim on a fifth of the site. Second, the honest alternative — the existing
  derived `getTechnologyTranslationCoverage`, which reads the content actually
  present rather than the stored flag — returns `full` for **all 31**, so a
  badge built on it would repeat one identical sentence on every page. That is
  decoration with no signal, which is exactly why the 2026-07-15 dossier round
  rejected content-kind card spines. No language badge shipped; the 6 stale
  values were corrected instead (4 seed records edited in place, 2 workspace
  records through the real `PATCH` route — verified field-by-field against the
  previous commit to confirm nothing but `translationStatus`, the recomputed
  `priority` timestamp, and `updatedAt` changed, with both slugs and both
  priority bands preserved).
- **`publisherType` shipped instead, because its distribution is real** —
  big-tech 12 / startup 9 / open-source-community 6 / research-lab 2 / media 2
  across the same 31 signals, and "vendor announcement vs. open-source release
  vs. research lab" genuinely changes how a reader weighs a claim. It renders
  as a hairline chip inside the source row rather than as a fifth aside panel,
  on both `SourceReference` instances (the aside and the foot-of-article 来源参考
  block). The chip is set apart from the publisher _name_ next to it precisely
  because it is a classification, not another name.
- **Nothing new was written for it — three pieces were already built and never
  wired**: `getPublisherTypeLabel` (full Chinese label map, zero call sites),
  the `TechnologyLanguageIndicators` component, and the `languageStateLabel` /
  `publisherTitle` copy keys. Only the first is now connected;
  `TechnologyLanguageIndicators` is deliberately left unwired and documented as
  the leftover of the rejected direction, since a genuinely partial translation
  would make it useful again. `SourceReference` gained one optional prop, so
  every other caller is untouched, and the `.source-reference__publisher-type`
  rule is 5 lines on existing tokens (`--line`, `--dossier-line`), so dark mode
  needed no new value.
- Verified: typecheck, lint, format, vitest 171/171, `validate:ranking` /
  `publishing` / `persistence` / `workspace-boundary` / `content-intelligence`,
  plus a live pass — the chip renders on 5 signals across 4 distinct publisher
  types (2 per page, aside + foot), the payload now reads `translationStatus:
"done"` where it read `"pending"`, no 待翻译 string reaches any page, contrast
  measures **5.87 / 6.35 light** and **5.42 dark** (all above AA), the meta row
  wraps to two lines at a forced 240px aside instead of overflowing, the
  workspace preview route renders it dossier-scoped, 9 public routes still
  return 200, and the console is clean. In `原文` mode the chip shows the raw
  enum (`open-source-community`) — consistent with the hero's type line, which
  has always done the same, and deliberately not "fixed" in this scope.

## Content round — model-to-engine support paths

- **技能「模型与推理引擎的支持路径」published** — 2026-07-28,
  owner-selected from the planning note written earlier the same session. That
  note had just shown the raw "推理与部署" gap does **not** hold (5 of its 11
  signals also carry 前沿模型, 3 also carry 端侧 AI, and the 2 exclusive ones
  are vLLM upgrades that 推理服务容量规划 already names). What survived the
  overlap test was a different question, visible in the signal bodies rather
  than the counts: once you have decided to adopt a new model, **can your
  self-hosted stack actually run it, by which path, and how long until
  production**.
- **The skill's core move is treating "supported" as four levels, not a
  boolean** — 能加载 (reference implementation, a fraction of native speed) →
  有原生建模 → 有性能路径 → 有正确性保障. Each level is anchored in a real
  signal: vLLM v0.26.0's Inkling stack is the anatomy of level 3 (基础建模 /
  分段 CUDA Graph / Hopper FA4 / MTP 推测解码), and level 4 is where Ollama
  v0.32.4 fell — it shipped day-one Laguna support carrying an MLX defect that
  degraded NVFP4 output quality until v0.32.5, **the correction published to
  that signal earlier in this same session**. Then three paths with different
  costs (wait for native support; `--model-impl transformers` across 450+
  architectures, minus the linear-attention exceptions; switch engines), and
  three numbers that must land before go-live — VRAM by weights + KV cache
  rather than parameter count (Inkling: 1T total but ~2TB BF16 / ~600GB
  NVFP4), a correctness baseline diffed against a reference implementation,
  and the gap between a promised open-weights date and an actual usable one
  (Kimi K3).
- **Boundaries written into the prose**, the same hand-off discipline the
  on-device and frontier-release skills use: 旗舰模型发布解读与换代判断 answers
  **该不该换**, this one answers **换得了吗、多久换得了、跑得对不对**,
  推理服务容量规划 takes over once it runs correctly, and 端侧模型部署与硬件适配
  owns the single-machine case.
  Published with **zero blocking errors and zero warnings**, 10 typed relations
  with notes (4 印证, 2 必备, 1 借助, 1 渊源, 2 关联), and reverse
  `relatedSkillIds` on 6 technology records + 4 knowledge entries — all already
  in the workspace store, so no new copy-on-write override was needed. Skills
  12→13. This is also the first entry published since `ContentBody` shipped, so
  its `##` sections, ordered/bulleted lists and bold runs are the first
  editorial body to render as real structure rather than a Markdown-source
  blob. Verified: typecheck, vitest 171/171, `validate:persistence`,
  `validate:database`, plus a live pass — the skill page renders 11 blocks with
  4 headings and all four relation-type pills at 13.32:1 contrast, all 6
  technology pages and all 4 knowledge pages carry the reverse link, and the
  skill appears on `/skills`, `/search`, `/network`, and the topic hub, with no
  literal Markdown, no overflow, and zero console errors.

## `intelligenceStatus` stripped from the public technology shape

- **An editorial workflow state was riding along in every public payload** —
  2026-07-28, found by probing which public fields actually reach rendered
  markup. `intelligenceStatus` (`draft` / `reviewed` / `needs_enrichment`) was
  mapped into the public `TechnologyItem` and shipped in the RSC payload of
  every technology detail page, while **no public surface read it** — so it
  quietly told readers (and scrapers) which records the editors consider
  unfinished. Stripped in `withoutTechnologyPriorityInternals`, the same helper
  and the same reasoning as the 2026-07-10 `priority` removal.
- **Two neighbouring fields were checked and deliberately kept** —
  `translationStatus` and `publisherType` are in the payload unrendered too,
  but both are **required** fields of `TechnologyItem` rather than optional
  (removing them would change the type that `TechnologyWorkspaceRecord`
  extends), and neither reveals editorial judgment: one describes the
  publisher, the other whether a translation exists. That is a rendering gap,
  not a boundary problem, so it stays on the backlog rather than being fixed by
  reflex.
- **The regression guard was verified by breaking it** — `intelligenceStatus`
  was added to `validate:ranking`'s `internalOnlyFields`, and the first reverse
  test **passed when it should have failed**: the assertion runs against a
  record from the workspace→public mapping, while the line first removed lived
  in the seed-item strip. Re-testing against the real mapping produced the
  expected `Published item should not expose intelligenceStatus.` Verified:
  typecheck, lint, format, vitest 171/171, `validate:ranking`, plus a live pass
  — the field is gone from the detail pages (workspace-published and seed), the
  list, the digest, and `/feed.json`, with every page still rendering.

## `already_published` candidate flag (closing the dedup blind spot)

- **Duplicate detection could not see past its own snapshot** — 2026-07-28.
  The rules compare a candidate only against `imported-candidates.live.json`,
  which is a rolling window (40 entries while the review state held 97), so an
  announcement re-published under a changed URL slug re-enters the pool with no
  duplicate group once its earlier twin has aged out. That is exactly how the
  Gemini 3.6 Flash announcement — already published here as
  `gemini-flash-cyber` — came back on 07-28 looking brand new. The playbook's
  only guard was a manual check.
- **The published pool outlives that window, so the check now runs against
  it** — a new `already_published` (已发布过) candidate quality flag fires when
  a candidate matches a published signal by normalized source URL **or** by
  title token similarity ≥ 0.8, reusing the existing deterministic comparison
  helpers (`normalizeUrlForComparison`, `calculateTokenSimilarity`, both
  exported from `candidate-duplicate-rules.ts` rather than reimplemented).
  Additive only, the same shape as the 07-27 `prerelease_version` flag: it
  renders on `/workspace/candidates` and the editorial-round console and
  changes **nothing** about import, conversion, or ranking.
- **The threshold was measured, not guessed** — running the rule over the real
  40-candidate pool first showed genuine re-publications at 0.8 and 1.0 and the
  next-highest unrelated candidate at 0.3, with **nothing in between**, so 0.8
  sits inside a wide gap. The same measurement caught two things a guess would
  have missed: all four exact-URL matches were candidates matching **the signal
  they were themselves converted into** (traceability, not duplication — now
  skipped via `convertedTechnologyId`), and the flag would otherwise feed
  `ranking.ts`'s `flags.length >= 4` penalty, whose "候选存在多项质量问题"
  warning would misdescribe it — so that count now excludes this flag, leaving
  `prerelease_version` behaviour untouched.
- **A unit test fixture was wrong before the code was** — the flagship test
  failed at first because the fixture invented a shortened published title
  (0.75 similarity) instead of the real one. The real candidate title is
  byte-identical to the published record's `title.original`, differing only in
  URL hyphenation. Fixtures now mirror the real records. Verified: typecheck,
  lint, format, vitest **171/171** (11 new tests covering URL matching,
  tracking-parameter normalization, the slug-variant case, the exact-threshold
  sibling, the converted-signal exemption, and the recorded latin-token
  limitation), plus a live pass — the workspace candidate list renders exactly
  one 已发布过 pill, on the Gemini re-import, matching the measurement.

## Signal body rendering (the field nobody could read)

- **The technology detail page never rendered `content` at all** —
  2026-07-28, found while verifying a correction written into that field.
  `src/components/technology-detail-content.tsx` had **zero references** to
  `technology.content`: the page showed the summary plus the Content
  Intelligence fields (为什么重要 / 技术背景 / 谁该关注 / 学习路径 /
  后续问题) and nothing else. Meanwhile a **missing body is a blocking
  publish error**, `src/lib/ranking.ts` scores it for record completeness,
  `technology-localization.ts` derives the 中文/原文 switch from it, and
  `src/lib/content.ts` maps it into the public shape — so all 31 published
  signals carried a body (23 workspace ones averaging 475 characters) that
  was **shipped in the client RSC payload of every detail page and never
  displayed**. The same class as the 2026-07-10 `priority` payload
  hardening, except here the honest fix was the opposite direction: render
  it, because the writing already existed and was better than the bullet
  lists around it.
- **Rendered as a 信号正文 section, with a hand-written Markdown subset** —
  the section sits between 版本脉络 and 为什么重要, and reads through the
  same `getLocalizedTechnologyText` the title and summary use, so the
  中文/原文 switch finally changes the body too instead of only the header.
  Surveying all 23 bodies first showed the editorial writing uses exactly
  **four constructs** — `##` headings, `**bold**`, ordered and bulleted
  lists — with 20 of 23 being plain paragraphs, so `src/lib/technology-body.ts`
  is a deliberate ~60-line subset parser rather than a new dependency
  (matching the hand-written force-directed graph and rate limiter). The
  parser splits blocks; `src/components/technology-body.tsx` renders them.
  The workspace draft detail page, which had been dumping the raw body into
  a single `<p>` (so editors saw literal `##` and `**` too), now reuses the
  same component.
- **An audit for the same failure elsewhere found it on skills and
  knowledge** — the technology page turned out to be the _cheap_ half. Every
  Content Intelligence field was checked empirically (probe each field's real
  value against the served HTML, the method that found the original bug), and
  all nine render. But `/skills/[slug]` and `/knowledge/[slug]` were dumping
  their whole body into a single `<p>`, so 4 entries (3 skills + 1 knowledge)
  displayed **literal `**` markers to readers** and every body rendered as one
  undifferentiated blob with no paragraph breaks. Both pages now use the same
  component, which was renamed `TechnologyBody` → **`ContentBody`**
  (`src/lib/content-body.ts` / `src/components/content-body.tsx`, CSS
  `.content-body*`) since it now serves technologies, skills, knowledge, and
  the workspace draft panel. Measured on
  `/skills/on-device-model-deployment`: one `<p>` with visible `**` became
  6 correct blocks (P/P/OL/P/UL/P) and 10 `<strong>` elements, at 13.32:1
  light and 11.53:1 dark — identical to the sibling paragraphs on the same
  page. The seed skill and knowledge entries use no Markdown at all, so they
  are unaffected.
- **A unit test caught a bug the live page could not** — the first parser
  flushed the paragraph buffer before every plain line, so a paragraph
  wrapped across two source lines would split into two paragraphs. Every
  real body writes one paragraph per line separated by blank lines, so the
  rendered pages looked perfect; only `parseTechnologyBody("前半句，\n后半句。")`
  exposed it. Verified: typecheck, lint, format, vitest **160/160** (12 new
  tests covering paragraph joining, `##`-only heading recognition, list
  grouping and marker switches, the flushed-array reuse hazard, and inline
  bold splitting), `validate:publishing` / `ranking` / `persistence` /
  `workspace-boundary` / `content-intelligence`, plus a live pass — six
  signal pages including a seed technology and the shortest body, zero
  literal Markdown left in the output, dark mode measured at **11.53:1**
  (identical to the neighbouring section, well above AA), no horizontal
  overflow, zero console errors. Not verified: a true 375px viewport — the
  Browser pane in this session would not size below 642px.

## Source import retry + the proxy finding

- **One transient failure no longer costs a source its whole daily import** —
  2026-07-28. The importer called `fetch` bare: no retry, no explicit
  timeout. When the 08:05 scheduled run hit transport failures on the Ollama,
  vLLM and MCP Servers release feeds, all three were simply marked failed
  until the next day — and a re-run recovered the **Ollama v0.32.5 stable
  release**, which would otherwise have aged out unseen.
  `fetchWithRetry` in `src/lib/external-import.ts` now wraps both fetch
  helpers: 3 attempts by default with a linear backoff and an explicit
  20s per-attempt timeout (`IMPORT_FETCH_ATTEMPTS` /
  `IMPORT_FETCH_TIMEOUT_MS` / `IMPORT_FETCH_RETRY_DELAY_MS`, all clamped).
  Transport failures, timeouts, `429` and `5xx` retry; **any other `4xx`
  fails immediately**, because a removed or misconfigured feed is a
  configuration problem that a retry only delays discovering. Each attempt
  returns a typed result rather than throwing, so the retry loop never uses
  exceptions as control flow.
- **The importer does not use a proxy, and that is the actual cause here** —
  found while verifying the fix, and it corrects the first diagnosis. `curl`
  reached all three feeds fine, which looked like transient proxy-side TLS
  flakiness; but Node's global `fetch` (undici) **ignores `HTTPS_PROXY`**, so
  the app was never using the proxy at all. A plain `node -e "fetch(...)"`
  reproduces the failure exactly — `Connect Timeout Error (attempted address:
github.com:443, timeout: 10000ms)` — on unmodified code. Retries therefore
  help only against genuinely transient failures; when a host is reachable
  _only_ via the proxy, every attempt takes the same blocked path. Making the
  importer proxy-aware needs undici's `ProxyAgent`, i.e. a new dependency —
  recorded in `docs/deployment.md` rather than decided unilaterally.
- **A failed manual import destroys that source's candidate list** — the
  other thing the investigation surfaced (documented in
  `docs/editorial-round-playbook.md`). Manual imports fall back to a
  placeholder candidate, and `mergeImportedCandidatesForSource` _replaces_
  the source's snapshot entries, so a failed re-run left one
  `fallback`-tagged placeholder where the recovered v0.32.5 candidate had
  been. Nothing was lost permanently (the snapshot was restored from the
  previous commit, and the feed still lists the release), but the scheduled
  runner's `useFallbackOnFailure: false` is doing more work than it looks.
  Verified: typecheck, lint, format, vitest 148/148 (10 new tests covering
  the retryable-status rule, env parsing and clamping, transport-failure
  recovery, retry exhaustion, the no-retry-on-404 rule, and the underlying
  reason surviving into the final message), `validate:sources`,
  `validate:persistence`.

## Read / read-later marks (P4 v0.4)

- **Readers can finally manage a 31-signal pool** — 2026-07-28,
  owner-selected from the backlog and scoped upfront through a mockup plus
  four confirmed decisions: **both marks** (已读 + 稍后读), **manual only**
  (opening a signal never marks it read), a **fifth view tab** for the
  read-later pile, and **dim-plus-hide-switch** rather than hiding read
  signals outright. Until now a reader could follow topics but had no way to
  say "read this" or "come back to this", so every visit re-presented the
  whole list.
  New `src/lib/reading-state.ts` owns the storage and the pure core
  (`toggleIdInList`, `selectSavedTechnologies`, `applyReadFilter`,
  `countReadTechnologies`) — same boundary as `followed-tags.ts`: two
  localStorage keys, **no accounts, no server-side profile**, the served page
  identical for everyone. `useReadingState` (`src/components/`) subscribes a
  list to those marks through the same custom-event + `storage`-event pair
  the followed-tag radar uses, so every view in the tab — and every open tab
  — stays in sync. `SignalReadingActions` renders the per-card toggle pair
  and `ReadFilterToggle` the "已读 N 条 / 隐藏已读" switch, which renders
  **nothing** until the reader has marked something. `DossierTechnologyCard`
  gained two optional props (`isRead`, `readingActions`) and stays
  presentational — the state lives in the three list views that own it:
  精选 (`TechnologyBrowser`), 我关注的 (`MyRadarContent`), and the new
  稍后读 view (`SavedSignalsContent` on `/technologies?view=saved`),
  most-recently-saved first, with saved ids that no longer resolve to a
  published signal dropped rather than rendered as a dead row.
  **One design decision was corrected during live verification**: the first
  dimming rule recoloured the summary, catalog and source lines to
  `--dossier-muted` — which measured as **zero visual change**, because those
  lines were already muted. A read card now recedes through _surface_ (no
  paper background, dashed border, no shadow) plus an explicit 已读 stamp,
  and only the title drops ink→muted. Deliberately not lower text contrast:
  measured 5.67:1 in light mode and 6.29:1 in dark, both above AA — repeating
  the "half dark" mistake the 2026-07-16 contrast round had to undo was the
  obvious trap here.
  Verified: typecheck, lint, format, vitest 138/138 (11 new tests covering
  toggle order and immutability, save ordering, unresolvable saved ids, the
  hide filter emptying a list, and mark counting), plus a live pass —
  marking, un-marking, persistence across reload, the hide switch filtering
  31→30 with its label flipping, the read-later view filling and emptying
  from its own card, the 我关注的 view carrying the same controls, both
  colour schemes, and no 375px overflow (the 5-tab strip wraps), zero console
  errors. The clicks were dispatched programmatically: the Browser pane's
  screenshot tool times out this session, and coordinate clicks require a
  prior screenshot.

## Content round — visual input skill (the multimodal gap, minus the voice half)

- **技能「视觉输入的组织与核验」published** — 2026-07-28, from a re-run of
  the same topic coverage scan over the full merged pool (31 published
  signals, 15 skills, 18 knowledge). 多模态 came out as the widest remaining
  mismatch — **7 signals against 2 skills** — but the raw count hid the real
  shape: of those 7, **three are voice** (GPT-Live, Real World VoiceEQ, the
  seed voice runtime) and are already served by 「实时语音交互设计」 plus the
  副语言信号 knowledge entry. The genuinely unserved half is **visual input**:
  Inkling accepts images natively, the seed multimodal coding copilots run on
  screenshots, and browser agents decide their next click by looking at the
  page — and nothing on the site told a reader how to feed a model an image
  well, or how to check it actually read it.
  The skill covers the input side (crop and resolution — small UI text blurs
  first once an image becomes visual tokens; numbering and textual anchors
  instead of "上图" when passing several images; and when **not** to use
  native vision at all — dense text and table figures are cheaper and more
  accurate through OCR or the structured source) and then the half that
  matters more: **verification**, because a visual failure is silent — the
  model describes a button that isn't there in exactly the tone it uses when
  correct. Three reproducible checks: make the model restate what it sees
  (position / count / reading) before answering, keep counterfactual images
  (change one digit, remove one control) and see whether the output follows,
  and diff reading-type tasks against an OCR baseline. A closing paragraph
  draws the boundary in prose against 「模型与输出评估」 (designing the eval
  system), 「实时语音交互设计」 (turn-taking and barge-in), and
  「模型微调与后训练定制」 (training the vision model) — the same hand-off
  discipline the on-device and frontier-release skills use.
  Published with **zero blocking errors and zero warnings**, 7 typed
  relations with notes (3 技术 印证, 模型选型 必备, 延迟权衡 借助, 评估闭环
  借助, 人在回路 延伸), and reverse `relatedSkillIds` on 1 technology record
  - 4 knowledge entries (`knowledge-human-loop` is a **first copy-on-write
    override** of that seed entry). Skills 15→16; 多模态 goes 2→3.
    **One candidate rejected with evidence**: a diffusion / generative-visual
    finetuning skill, dropped after reading 「模型微调与后训练定制」's actual
    body — it already covers the SFT / preference-alignment / distillation
    spectrum and puts the weight on data recipes, so the new skill would have
    restated it for one signal (the NeMo Automodel × Diffusers release). The
    coverage count alone would have hidden that, exactly as with the
    inference-engine candidate the day before.
    **The known seed asymmetry applies again**: two of the three anchor
    signals (`tech-multimodal-copilots`, `tech-browser-agents`) are seed
    technologies, which have no copy-on-write overlay, so they cannot carry a
    reverse id. All 7 graph edges exist either way (edges dedupe from either
    side) and were confirmed in the `/network` payload; only those two seed
    pages' own 相关技能 lists omit the skill.
    Verified: typecheck, vitest 127/127, `validate:persistence`,
    `validate:database`, plus a live public pass (skill detail with all 7
    relations and their real notes, the Inkling signal page, 4 knowledge
    pages, the topic hub, `/skills`, search, and the 7 `/network` edges),
    zero console errors, no 375px overflow.

## Content round — frontier release reading skill

- **技能「旗舰模型发布解读与换代判断」published** — 2026-07-27, same day,
  the second gap closed from the same coverage scan. 前沿模型 was the widest
  mismatch left: **8 published signals against 1 skill** (产品策略, for
  contrast, had 3 signals against 4 skills). Seven of those eight signals are
  some form of "vendor shipped a new model" — GPT-5.6, Kimi K3 (2.8T,
  open-weight promise), Inkling (1T total / 41B active MoE), the Gemini Flash
  batch — and the site had no answer for what a reader should _do_ with them.
  The skill sorts a release announcement's numbers into three buckets —
  directly comparable (context length, price per million tokens, licence
  terms, third-party benchmarks), comparable only after conversion (MoE total
  vs. active parameters; training-token counts only alongside the data
  recipe), and effectively incomparable (vendor-defined composite metrics like
  GPT-5.6's "intelligence per unit of compute") — then names the three
  conditions that actually justify switching and the four costs that dominate
  a switch (prompt retuning, eval re-runs, recomputed cost model, downstream
  regression). A closing paragraph draws the boundary against
  「模型与输出评估」 in the prose (that one is _designing your own checks_,
  this one is _reading someone else's announcement and deciding_), the same
  hand-off discipline the on-device skill uses with 「推理服务容量规划」.
  Published with **zero blocking errors and zero warnings**, 8 typed
  relations with notes, and reverse `relatedSkillIds` on 4 technology records
  - 4 knowledge entries (`knowledge-evaluation-loops` is a **first
    copy-on-write override** of that seed entry). Skills 14→15; 前沿模型 goes
    1→2.
    Two candidates were rejected before writing: an open-weight
    licence/compliance skill (only 2–3 signals, and honest output would be a
    checklist rather than usable guidance) and — earlier the same session — an
    inference-engine upgrade skill, dropped after reading
    「推理服务容量规划」's actual body, which already covers exactly that
    ("判断一次推理栈升级或模型更换对自托管服务意味着什么", naming the vLLM
    Model Runner V2 generation switch). The coverage count alone would have
    hidden that.
    Verified: typecheck, vitest 127/127, `validate:persistence`,
    `validate:database`, plus a 13-point live public pass (skill detail with
    its notes and boundary paragraph, all 4 signal pages, 2 knowledge pages,
    the topic hub, search, `/network`), zero console errors, no 375px overflow.
    The dev server died mid-round — the known session-scoped `next dev`
    behaviour from `docs/editorial-round-playbook.md` Step 0 — and the store
    was confirmed to hold **no partial write** before retrying.

## Content round — on-device deployment skill (the empty action layer)

- **技能「端侧模型部署与硬件适配」published** — 2026-07-27, from a topic
  coverage scan run before writing anything. The scan found one lopsided
  topic: 端侧 AI carried **5 published signals and 5 knowledge entries but
  zero skills** — a reader landing on Ollama v0.32.4 (Apple GPU via MLX,
  speculative-decoding draft-head quantization, the Qwen3 MoE mixed-precision
  decode fix) got background concepts and no answer to "what do I practise".
  Two candidates were compared before picking: this one, and a
  「本地优先的数据边界」product skill that was **rejected for real overlap**
  with the 07-27 「AI 工具链选型与自建边界评估」 skill — both would have
  restated the same "which layer do you own" decision line.
  The skill is deliberately bounded to a single machine — quantization tier,
  runtime path (llama.cpp / MLX / CUDA), offload + context length, and
  acceptance measured as **first-token latency + steady-state tokens/s on the
  target device** — and hands off explicitly to 「推理服务容量规划」 the
  moment the question becomes serving many people, which is why it does not
  overlap any of the existing 13 skills. Published through the workspace APIs
  with **zero blocking errors and zero warnings**, 9 typed relations with
  notes (4 技术 印证, 量化/选型 必备, 推测解码 借助, 混合推理 延伸, 延迟权衡
  印证), and reverse `relatedSkillIds` on 3 technology records + 5 knowledge
  entries — the last of which, `knowledge-latency-tradeoffs`, is a **first
  copy-on-write override** of that seed entry. Skills 13→14.
  **One asymmetry found and deliberately not "fixed"**: the seed technology
  `tech-slm-edge` (端侧小语言模型) cannot carry a reverse id, because seed
  **technologies** have no copy-on-write overlay the way seed skills and
  knowledge do. The content-graph edge exists either way (edges dedupe from
  either side), so `/network` and the skill page both connect the pair; only
  that one seed signal's own 相关技能 list omits the skill. Editing
  `src/data/technologies.ts` would fix the list but would make bundled seed
  code reference a runtime-generated `skill-ws-*` id — the exact
  seed-to-runtime coupling that produced the 2026-07-28 sqlite parity
  failure — so it was left alone and recorded here instead.
  Verified: typecheck, vitest 127/127, `validate:persistence`,
  `validate:database` (its overlay-parity check confirms the new skill in
  both drivers), plus a live public pass — skill detail (9 relations with
  their real notes and 印证/必备/借助/延伸 pills), 3 signal pages, 2 knowledge
  pages, the topic hub, `/network` (9 new edges parsed out of the payload,
  including the `tech-slm-edge` one), search, zero console errors, no
  overflow at 375px.

## Go-live drill — the workspace guard was never running

- **`src/middleware.ts` was at the repository root, so Next never loaded it**
  — 2026-07-27, found by actually running a production build with protection
  enabled instead of reading the code. With `WORKSPACE_ACCESS_ENABLED=true`
  and a token configured, `GET /workspace` returned **`200`**. Root cause:
  this project keeps its App Router under `src/`, and in that layout Next
  only looks for `src/middleware.ts`; a root-level `middleware.ts` is ignored
  **silently** — no error, no warning, just `"middleware": {}` in
  `.next/server/middleware-manifest.json`. The guard's logic was correct the
  whole time (that is why the 2026-07-22 readiness assessment, written from
  the source, concluded it was sound), but it had never executed in any mode
  since it was written. Fixed by `git mv middleware.ts src/middleware.ts`;
  the rebuild shows a `ƒ Middleware` route-table line and all five matchers
  in the manifest. `validate:deployment` gained
  `assertMiddlewareIsInDiscoverableLocation`, which was confirmed to
  reproduce the failure when the file is moved back. Re-verified live against
  `next start`: `/workspace`, `/workspace/sources`,
  `/workspace/editorial-round`, `/api/workspace/*`, `/api/candidates/*`, and
  the legacy `/technologies/drafts/*` redirect all return `401` without a
  token and work with it (header, Bearer, and Basic-password forms);
  enabled-but-unconfigured returns `503`; public routes, the public AI route,
  `/digest/weekly`, and the per-topic feed are untouched.
- **The production build no longer depends on Google Fonts** — same drill.
  `npm run build` failed reproducibly with
  `Failed to fetch 'Inter' from Google Fonts` (`ECONNRESET`;
  `fonts.googleapis.com` is unreachable from this machine), which blocked the
  drill outright and made every future build hostage to network conditions.
  Inter was only the first entry of the `--font-sans` stack and was loaded
  with `subsets: ["latin"]` on a Chinese-language site, so CJK glyphs never
  came from it. Removed `next/font/google` from `src/app/layout.tsx` and
  `var(--font-inter)` from the stack; latin glyphs now come from the platform
  UI font already listed as the fallback. The build has zero external
  fetches.
- **`docs/deployment.md` gained a go-live runbook** — the single-server
  shape (reverse proxy, systemd unit, cron replacing Windows Task Scheduler,
  a backup of `config/`), why it has to be that shape (the app writes its
  state to local JSON, so serverless would silently discard every edit), the
  three constraints that follow from the code (single instance only, the
  in-process rate limiter, the task runner racing hand edits), and a
  `curl`-based pre-traffic verification list. Includes the
  `NEXT_PUBLIC_SITE_URL` trap: it is inlined at **build** time, so setting it
  only at runtime leaves `localhost:3000` baked into every feed link —
  confirmed in the drill, where the feed correctly carried the configured
  origin after building with it set.

## Version evolution line + `supersedes` relation type

- **A reader landing on a superseded release now finds out before reading it**
  — 2026-07-27, owner-selected as the public-facing follow-up ("优先展示给大众
  的内容"). Measured first: of 31 published signals, **6 belong to two release
  lines** (vLLM v0.24.0 → v0.25.0 → v0.26.0, Ollama v0.31.2 → v0.32.0 →
  v0.32.4) and **none of them linked to each other**, so `/technologies/
vllm-v0-24-0` gave no hint that two newer releases existed.
  The owner chose explicit editor-marked relations over a
  source-plus-version-number heuristic. Scanning the data before building
  killed the obvious implementation: `extends` (延伸) looked like the right
  type, but of the 4 technology↔technology `extends` edges only **1** was an
  actual version succession — the other 3 were thematic follow-ups (the HF
  security incident pointing at Shippy as a defence model, NeMo Automodel and
  NVIDIA open data as "同一主张的两翼"), so rendering "已有后续" from `extends`
  would have mislabelled 3 of 4 real relations. Fixed by adding an eighth
  `RelationType`, `supersedes` (续作), leaving 延伸 to mean "read this next".
  New `src/lib/technology-evolution.ts` (`buildTechnologyEvolutionChain` pure
  core + `getTechnologyEvolutionChain`) walks the `supersedes` component
  **transitively and undirected** — relations are keyed by unordered pair
  project-wide, so the stored from/to direction is not trusted and the line is
  ordered by `publishDate` with the slug as a stable tie-breaker. Unknown or
  unpublished targets, self-references, and chains shorter than two are
  dropped, so the section simply does not render for the other 25 signals. The
  succession note attaches to the newer side of its pair, reading as "what this
  release carried forward". New `TechnologyEvolutionLine` renders it as the
  first block on `/technologies/[slug]` with 当前 / 最新 marks and a
  `.technology-evolution-*` CSS block on both the generic and `--dossier-*`
  token sets. Content: the two release lines were linked through the real
  workspace APIs (4 `supersedes` pairs with notes, reverse
  `relatedTechnologyIds` on 5 records so `/network` and 相关技术 agree with the
  new section). Verified: typecheck, lint, format, vitest 127/127 (10 new tests
  covering direction-independent ordering, transitive walking, the
  non-`supersedes` types being ignored, cross-kind edges, unknown targets,
  self-references, note placement, and the same-date tie-break), plus a live
  pass — v0.24.0 shows "已有后续" with 2 later releases and links out, v0.26.0
  shows the line with its note and no later count, Ollama v0.32.0 renders
  correctly as a middle step, the Shippy-linked signal correctly shows **no**
  section and keeps its 延伸 label, `/network`'s data-derived legend picked up
  续作 on its own, no overflow at a forced 320px column, zero console errors.

## Public AI route rate limiting (go-live checklist I1)

- **The three public LLM routes are no longer uncapped** — 2026-07-27, the
  last in-repo item of the production-readiness checklist
  (`docs/production-readiness.md` → I1). `POST /api/technologies/compare`,
  `/explain`, and `/learning-path` are unauthenticated by design (they only
  read already-published content), and until now the **only** cost control was
  the per-key result cache: a caller walking through new technology pairs,
  reader levels, or technologies triggered one provider call each, with
  nothing bounding the rate. Harmless under the default mock provider, an open
  cost vector the moment a real `LLM_API_KEY` is configured.
  New `src/lib/rate-limit.ts` is a framework-free sliding-window limiter
  (multiple rules per limiter, insertion-ordered `Map` so key eviction past a
  tracking cap is a front-of-map walk, and — the detail that matters — a
  **rejected attempt is not recorded**, so hammering while blocked cannot push
  the recovery time further out). `src/lib/public-ai-rate-limit.ts` owns the
  policy: 10 requests/minute + 40/hour per client **per route**
  (`routeId:clientKey` buckets, so exhausting compare leaves explain usable),
  overridable via `PUBLIC_AI_RATE_LIMIT_PER_MINUTE` /
  `PUBLIC_AI_RATE_LIMIT_PER_HOUR`. The check is each route's **first**
  statement — before body parsing, before the cache lookup, therefore before
  any provider call — and returns `429` with `Retry-After` and a generic
  Chinese message that leaks no provider, quota, or client detail. The three
  reader widgets needed no change: they already render `payload.error`, so the
  message surfaces in place. Documented honestly as a **cost guardrail, not
  bot protection**: the limiter is in-memory/per-process (a multi-instance
  deploy multiplies the budget) and the client key comes from
  `x-forwarded-for` / `x-real-ip`, which a caller can rotate — with no proxy
  in front every caller shares one bucket, which still caps total provider
  calls. Verified: typecheck, lint, format, vitest 117/117 (9 new tests
  covering window sliding, the no-credit-for-rejected rule, multi-rule
  recovery governed by the longer window, per-key isolation, and cap
  eviction), plus a live pass against `next dev` — 10 × `400` then `429` with
  `Retry-After: 60` on the 11th, a different client IP and the other two
  routes each unaffected (separate buckets), the explain widget still
  rendering a real generated result with its disclaimer, and the `429` message
  rendering in the widget's error slot with zero console errors.

## SQLite driver parity (six missing store adapters)

- **`PERSISTENCE_DRIVER=sqlite` stopped losing every workspace-created
  skill, knowledge entry, and relation override** — 2026-07-28, fixing the
  `validate:database` failure tracked since the 2026-07-27 fixture purge. The
  diagnosis went further than the tracked note ("the driver only seeds
  `src/data` statics"): **six stores had no SQLite adapter at all**, and the
  two halves of the dispatch failed differently.
  `readSqliteJsonStore` fell through to `default: return fallbackValue`, so in
  sqlite mode `skill-workspace.json`, `knowledge-workspace.json`, and
  `link-relation-workspace.json` read as empty (the copy-on-write overlay
  vanished — 13 skills and 18 knowledge entries dropped back to the seed
  pools, and the typed relations reverted to seed defaults), the two schedule
  configs (`scheduled-import.json`, `scheduled-digest.json`) reset to their
  defaults on every read (so `nextRunAt` never persisted — the task runner
  would have treated the import as due on every pass), and the three public AI
  result caches never hit (every compare/explain/learning-path request would
  re-call the provider). `writeSqliteJsonStore` was the loud half: its
  `default` branch throws, so saving a skill, knowledge entry, relation, or
  schedule change in sqlite mode crashed outright.
  Fix: five new repository files following the existing per-domain pattern
  (`sqlite-skill-workspace-store.ts`, `sqlite-knowledge-workspace-store.ts`,
  `sqlite-link-relation-store.ts`, `sqlite-runtime-config-store.ts`,
  `sqlite-technology-ai-cache-store.ts` — the last two each cover more than
  one filename by design: the schedule configs are single objects, not record
  lists, so they share one `runtime_configs` key-value table, and the three AI
  caches are structural siblings), seven new schema tables with their key
  columns and indexes, both dispatch switches, and the new stores threaded
  through `migrateJsonStoresToSqlite` plus its two callers
  (`scripts/db-migrate-json.ts`, `scripts/validate-database.ts`). A missing
  single-object config is deliberately **not** written during migration, so a
  never-configured schedule keeps falling back to its default instead of being
  frozen into a row. `validate:database` now also asserts the new tables exist
  and — the regression guard that would have caught this in the first place —
  that both drivers serve identical skill and knowledge id sets
  (`validateWorkspaceOverlayParity`). Verified: the failing assertion
  reproduced first (`technology … references missing knowledge
knowledge-ws-36346103`), then typecheck, lint, format, vitest 108/108,
  `validate:database` / `persistence` / `tasks` / `digest` green, plus an
  isolated `LOCAL_DATA_DIR` + `SQLITE_DATABASE_PATH` round-trip in sqlite mode
  covering all four previously broken paths (skill create → draft hidden from
  the public pool → publish → visible; relation type + note persisted; a
  schedule config change surviving a re-read; a comparison cache hit on the
  same pair key) — the isolated directory ended up holding only the `.sqlite`
  file, confirming nothing fell back to JSON.

## Content round — quantization knowledge + build-vs-buy skill

- **知识「模型量化与数值精度」and 技能「AI 工具链选型与自建边界评估」
  published** — 2026-07-27, gap analysis over the 23 published signals right
  after that day's editorial round. Quantization had **no entry at all**
  despite being the substance of several signals — the MoE entry covers
  routing and the speculative-decoding entry covers decode, but nothing
  covered which layers tolerate low-bit storage, why mixed per-expert
  precision breaks decoding, or how quantization interacts with speculative
  decoding and graph capture. The build-vs-buy skill captures the reusable
  decision line the Copilot-vs-raw-API signal introduced (decide which layer
  you must own, _then_ compare price) and pairs with the existing
  「模型选型与约束匹配」knowledge. Both published through the workspace APIs
  with **zero publish-gate warnings**, 10 typed relations with notes, and
  reverse `relatedKnowledgeIds` / `relatedSkillIds` on 6 technology records
  (all slugs preserved). Pools: skills 12→13, knowledge 17→18. Verified with a
  9-check public pass (detail pages, indexes, technology detail back-links,
  `/network`, `/search`, the topic hub) plus zero console errors and no 375px
  overflow.

## Demo/validation fixture purge (go-live checklist B3)

- **The live stores no longer carry demo data that would ship as real
  content** — 2026-07-27, closing the last in-repo item of the
  production-readiness checklist (`docs/production-readiness.md` → B3). The
  finding was confirmed before acting: the fixture digest `2026-05-23`
  ("Delivery integration validation") was **published**, and genuinely
  reachable on `/digest`, `/feed.xml`, `/feed.json`, and its own page — the
  public-copy sanitizer hid the validation wording, not the record itself.
  Removed: 3 May validation digests, the 2 disabled `quality-*-source` fake
  sources with their 2 imported candidates and review-state entries, the 2
  leftover validation technology drafts (`editorial-enrichment-draft`,
  `draft-candidate-source-quality-failing-source-2026-05-30`), and 3
  "Validation …" delivery channels plus one orphaned delivery run. Deleting
  them is safe because the two validators that use these fixtures
  (`validate:quality`, `validate:editorial-enrichment`) construct them fresh
  and back up/restore the real stores in a `finally` block — the on-disk
  copies were leftovers from before that discipline. `validate:persistence`
  caught the one reference the first pass missed (a `DeliveryRun` still
  pointing at the deleted digest). Verified: the removed digest now 404s, no
  fixture string appears on any public or workspace surface, and 16
  `validate:*` scripts pass. `validate:database` fails, but **pre-existing and
  unrelated** (confirmed by re-running it at the pre-cleanup commit): the
  SQLite driver seeds only the `src/data` statics, so a published signal
  linked to a workspace-created skill/knowledge entry has no matching row in
  sqlite mode — tracked separately.

## Technology-to-technology relation editing + round triage flags

- **Published signals can finally be linked to each other, and undecided
  candidates carry their quality flags on the round console** — 2026-07-27,
  same session as the ranking/digest fix, from gaps hit while running that
  day's editorial round.
  `relatedTechnologyIds` was missing from `TechnologyWorkspaceRecordUpdate`,
  so it existed **only on the bundled seed data**: none of the 23
  workspace-published signals could be linked to another, and the 相关技术
  section on their detail pages was permanently empty (vLLM v0.26.0 could not
  point at the Inkling signal whose support stack it ships). The field is now
  in the update type, the `PATCH /api/workspace/technologies/[id]` parser, and
  the draft edit form as a third `RelationCheckboxItem` group, so
  technology↔technology links get the same relation type + note editing
  (LinkRelation v1) as knowledge and skills. The workflow drops a
  self-reference — it would render as a self-edge on `/network` — and the
  picker offers **published** technologies only, since a link to an
  unpublished draft would be a dead node. Verified end to end by linking
  `vllm-v0-26-0` → Inkling (印证) and → v0.25.0 (延伸) with notes: stored,
  self-reference dropped, slug preserved, and both rendering on the public
  detail page and `/network`.
  Separately, a new `prerelease_version` candidate quality flag matches a
  pre-release marker on a version-looking token (`v0.32.5-rc0`, `v0.26.0rc1`,
  `v1.0.0-beta.2`) — the single biggest class of round noise, 4 of 16
  candidates on 2026-07-27 and at least one in each of the three prior rounds.
  The first regex draft was rejected during verification for missing
  `v0.26.0rc1` (marker glued straight onto the digits) and false-positiving on
  prose like "Preview: …", so the match now requires the version context.
  `/workspace/editorial-round` renders each undecided candidate's
  review-blocking flags, so a round triages from one screen instead of opening
  every candidate — which is also the practical answer to the Hugging Face
  blog feed carrying **no `<description>` at all** (confirmed by fetching the
  feed directly; the official host is unreachable from this machine, so it is
  a source-data limitation, not a parser bug or a mirror artifact — those items
  simply surface as 缺少摘要 / 缺少正文 now). Review-readiness-only flags
  (`ready_for_review` / `not_convertible`) are deliberately excluded — they say
  nothing about whether an item is worth publishing. Verified with typecheck,
  lint, format, vitest 108/108 (1 new test), and a live pass (form renders 30
  technology options with self excluded and 2 pre-checked; flags render as
  "内容过短 预发布版本" on a briefly reopened candidate, restored afterwards;
  zero console errors).

## Ranking banding + digest fresh-first selection

- **Editorial banding replaces score-only priority levels, and digest
  generation stops repeating itself** — 2026-07-27, owner-selected after a
  measured diagnosis during that day's editorial round. Two coupled defects
  were confirmed with real numbers over the 31 published signals:
  (1) **`priorityLevel` had collapsed** — every published signal scored 80-100
  and landed in `high_priority`, leaving `watch` and `low_priority`
  permanently empty (so `/digest/weekly`'s 值得跟踪 section never had
  content). `priorityScore` measures record _completeness_, which any signal
  that clears the editorial workflow maxes out, and it barely correlated with
  the editor's own `importanceLevel` — a `signal` scored 100 while two
  `critical` records scored 90. (2) **Digest generation was structurally
  repetitive** — `buildDailyDigestFromTechnologies` takes the top 4 by score
  inside a 90-day window, so the same high scorers won every day (four
  consecutive rounds had to hand-exclude the previous digest's items) while
  **9 published signals had never appeared in any digest at all**, including
  `kimi-k3`, `gemini-managed-agents-background-mcp`, and
  `copilot-code-review-tool-workflow-lessons`.
  Fixes, both scoped to the last step of their pipeline: `ranking.ts` now
  resolves the band from the editor's `importanceLevel` with recency able to
  **demote but never promote** — `critical` → `high_priority` always,
  `important` → `high_priority` within 30 days else `watch`, `signal` →
  `watch`, and anything scoring under 45 (broken/incomplete records) still
  falls to `low_priority`. `priorityScore` is unchanged and keeps its job as
  the within-band ordering key; `priorityReasons` now states which rule
  applied. Imported candidates have no editorial importance yet, so they keep
  the original score thresholds. `digest-workflow.ts` gained
  `collectCarriedTechnologyIds` plus a `carriedTechnologyIds` build option:
  signals a published digest already carried sort **last inside each priority
  bucket**, so never-carried signals take the limited slots first, with
  automatic fallback to carried ones so a quiet day never generates an empty
  digest. Measured after the change: levels went 31/0/0 → **15 high / 16
  watch**, `/digest/weekly` renders a real two-section split (2 + 3 cards
  where 值得跟踪 was previously always empty), and a hypothetical next-day
  generation leads with the two never-carried in-window signals instead of
  four repeats. (The other 6 never-carried signals are April seed items
  outside the digest's 90-day window — correctly excluded from a _daily_
  digest.) Verified with typecheck, lint, format, vitest 107/107 (6 new tests
  covering critical-never-demoted, important freshness demotion,
  signal-stays-watch, fresh-first ordering, empty-digest fallback, and
  `collectCarriedTechnologyIds` exclusion rules), `validate:ranking`,
  `validate:digest`, and a live pass with zero console errors.

## Production hardening (go-live checklist, in-repo items)

- **CSP + HSTS, pinned Node, and untracked runtime/secret stores** —
  2026-07-22, the code/config half of the production-readiness assessment's
  go-live checklist (see `docs/production-readiness.md`; the operator-action
  items — workspace token, data reset, site URL — stay open by design).
  `next.config.ts` now emits a `Content-Security-Policy` (`default-src 'self'`,
  with `'unsafe-inline'` for Next's own inline bootstrap/hydration scripts and
  React inline-style attributes) and `Strict-Transport-Security`
  (`max-age=63072000; includeSubDomains`) **in production builds only** — dev
  keeps the baseline headers so `next dev` HMR / React Refresh (which need
  `'unsafe-eval'` + a websocket) still work; the branch resolves inside
  `headers()` and is baked into the build's routes manifest. Verified against a
  real `next start`: both headers present on public routes, and a
  client-interactive page (`/technologies?view=followed`) hydrates, reads and
  writes localStorage, and toggles state with zero CSP violations.
  `package.json` gained `"engines": { "node": ">=22.5.0" }` (the SQLite driver's
  `node:sqlite` needs ≥ 22.5). Six runtime/secret/cache stores are now
  git-ignored and untracked — `config/delivery.json` (the one that would hold a
  real webhook endpoint/token once configured), `workflow-events.json`,
  `task-runner.json`, and the three `technology-*.json` LLM result caches — so
  a real delivery secret can no longer be committed; content, config, and
  editorial-state stores stay tracked because they seed a deployment. Verified
  with typecheck, lint, format, `npm run build`, and the live `next start` CSP
  pass above.

## Editorial round console (`/workspace/editorial-round`)

- **Workspace editorial-round console shipped** — 2026-07-22, owner-selected
  from the product-proposal backlog ("编辑轮控制台"). Scope confirmed upfront
  via an `AskUserQuestion` round plus a depth-comparison mockup
  (orchestration console vs. full inline workbench) and a layout mockup:
  **A) orchestration console** (not a full inline workbench), **nav + dashboard
  entry**, **safe transitions inline**. It collapses the recurring loop in
  `docs/editorial-round-playbook.md` onto one page without duplicating any
  editor. New `src/lib/editorial-round.ts` (`getEditorialRoundState`) is a pure
  read aggregation over the existing workflow getters — undecided candidates
  (effective `importStatus === "new"`, newest-first), open duplicate-group
  count, technology drafts awaiting publish (each with its
  `getTechnologyWorkspacePublishReadiness` blocking/warning summary,
  blocking-first), and today's digest — plus a derived five-phase step tracker
  (处置候选 / 补内容·发布 / 生成简报 / 发布简报 / 公开面核对) whose statuses
  (done / current / todo / blocked) fall out of that state; it owns no new
  persisted data and performs no mutations. The page
  (`src/app/workspace/editorial-round/page.tsx`) renders the summary, tracker,
  and grouped sections; the inline actions live in the client component
  `src/components/editorial-round-actions.tsx` (`CandidateRoundActions`,
  `DraftPublishAction`, `DigestRoundActions`) which reuse the existing
  `/api/candidates/[id]/{status,convert}`,
  `/api/workspace/technologies/[id]/status`,
  `/api/workspace/digests/generate`, and `/api/workspace/digests/[date]/status`
  routes (confirm prompts, 409 publish-gate readiness surfaced inline). An
  open-duplicate-group notice warns that grouped candidates can't convert
  standalone; a soft hint discourages generating the digest while candidates or
  drafts remain. A 编辑轮 entry was added to `WorkspaceNav` (控制台 group) and a
  打开编辑轮 card to the `/workspace` dashboard; new `.editorial-round-*` CSS on
  the workspace tokens. Verified with typecheck, lint, format, vitest 101/101
  (5 new tests covering candidate filtering/sorting, dup-block step, draft
  readiness ordering, and digest step derivation), and a live workspace pass
  (real round state: 10 undecided, 3 open dup groups → candidate step blocked,
  today's digest draft → generate step done; nav + dashboard entries; no
  horizontal overflow at 375px; zero console errors). The inline mutations were
  not fired during verification — they reuse pre-existing, unit-covered
  endpoints and firing them would be making the owner's editorial decisions.

## Weekly review page (`/digest/weekly`)

- **Public weekly review shipped** — 2026-07-22, owner-selected from the
  product-proposal backlog ("周回顾页"). A public, time-boxed sibling of the
  Daily Digest and a pure derived view like `/network` and the digest archive:
  new `src/lib/weekly-review.ts` (`getWeeklyReview(weekKey?)` +
  `getWeeklyReviewArchive`) persists nothing and calls no LLM. It buckets
  published technology signals into natural weeks (Monday–Sunday, computed in
  UTC from the plain `YYYY-MM-DD` publish dates), classifies each with the same
  deterministic `evaluateTechnologyPriority` the rest of the public product
  uses, and groups them into 立即关注 (`high_priority`) / 值得跟踪 (`watch`)
  — `low_priority` is excluded, matching the digest's default (owner-chosen
  after a side-by-side comparison mockup of the two tail layouts). Two routes:
  `/digest/weekly` (current week, with a four-number summary — 本周信号 /
  立即关注 / 值得跟踪 / 覆盖主题 — an empty state for a quiet week, and the
  past-week archive folded into the bottom) and `/digest/weekly/[week]`
  (a specific week keyed by its canonical Monday date, e.g.
  `/digest/weekly/2026-07-13`; `notFound()` for a non-canonical/non-Monday
  key, an invalid date, or a week with no shown signals). Both render through
  the shared server component `WeeklyReviewContent` in dossier styling
  (`DossierCard` / `DossierStampTag`, a new `.weekly-review-*` CSS block on the
  existing `--dossier-*` tokens). Discoverability is by cross-link only (no new
  nav entry, consistent with the nav-minimalism direction): a 本周回顾 link on
  the `/digest` archive page and in the public digest pages' 订阅简报 block.
  Scope confirmed upfront via an `AskUserQuestion` round and a mockup (route
  `/digest/weekly`; natural week + archive; priority grouping; no low_priority
  tail). Verified with typecheck, lint, format, vitest 96/96 (6 new tests
  covering week bucketing, low-priority exclusion, newest-first sort,
  canonical-key resolution, and archive grouping/exclusion), and a live pass
  (populated week renders 8 signal cards + archive; current week shows the
  empty state; non-canonical key 404s; both cross-links wired; dossier tokens
  resolve; no horizontal overflow at 375px; zero console errors).

## Scheduled digest draft (task runner automation)

- **The task runner now generates the day's digest draft automatically** —
  2026-07-21, owner-selected from the product-proposal backlog ("定时简报
  草稿"). A structural sibling of Scheduled Import v0: new
  `src/lib/scheduled-digest.ts` (`ScheduledDigestConfig` in
  `config/scheduled-digest.json`, same `nextRunAt`-advance timing model,
  bootstrap "missing `nextRunAt` = due now", default 08:00
  Asia/Shanghai). Each `tasks:run-once` / `tasks:watch` pass checks it
  after the scheduled import and, when due, generates a `status = draft`
  digest for today via the existing `generateDailyDigest` — **skipping
  entirely when the day already has a digest** (unattended runs never
  touch a digest an editor may be adjusting) and **never publishing**
  (the editorial gate is unchanged; the editorial round becomes
  edit-and-publish instead of generate-edit-publish). A failed generation
  downgrades the runner pass to `partial` and still advances `nextRunAt`
  so watch mode doesn't hot-loop the failure. Managed from
  `/workspace/delivery/schedules` (new 定时简报草稿 panel +
  `ScheduledDigestActions`, `PATCH /api/workspace/scheduled-digest`).
  The default time deliberately matches the import's 08:00: in-pass code
  order (import first, digest second) guarantees sequencing, and a later
  time than the daily Task Scheduler trigger would degrade to
  every-other-day generation. `validate:tasks` pins a disabled
  scheduled-digest config during its runs (and asserts the skip message)
  so validation never writes real digest stores. Verified with
  typecheck, lint, format, vitest 90/90, `validate:tasks`, and an
  isolated `LOCAL_DATA_DIR` functional pass covering all three branches
  (generate → draft written + `nextRunAt` advanced; not-due skip;
  already-exists skip).

## Topic-level RSS + follow transfer (P4 v0.3)

- **Per-topic RSS feeds and cross-device follow transfer** — 2026-07-21,
  owner-selected from the "追踪能力" gap discussion as the zero-unseal
  option (email subscription and accounts stay excluded; this deepens the
  keep-tracking loop within the existing no-accounts boundary). New public
  route `/topics/[tagId]/feed.xml` (`renderTopicRssXml` in
  `src/lib/topic-feed.ts`): an RSS 2.0 feed of the topic's **published
  technology signals only** (newest first, bilingual-preferred titles and
  summaries, no news fast-lane items), 404 for unknown topics or topics
  with no published signals; `escapeXml` / `formatRssDate` are now exported
  from `digest-delivery.ts` and reused, and the dependency-free
  `topicFeedPath` helper lives in `feed-paths.ts` so the client component
  can link it. Entry points: a 订阅此话题 block on `/topics/[tagId]`
  (shown only when the topic has published signals) and, on the 我关注的
  view, a feed-link row listing each followed topic that has at least one
  published signal. Same view also gains follow transfer: 导出关注 copies
  the followed-tag ids as a plain comma-separated 关注码 to the clipboard
  (prompt fallback), 导入关注 accepts a pasted code, validates ids against
  canonical tags, and merges them into the local follow set — cross-device
  follows without accounts, matching the P4 localStorage-only boundary.
  Verified with typecheck, lint, format, vitest 90/90, and a live pass
  (feed XML valid and escaped for tag-inference with 7 items, unknown-tag
  404, both entry points rendering, zero console errors).

## Detail-page relation notes rendered for real

- **Skill/knowledge detail pages now render the stored relation 附注** —
  2026-07-21, found during the fourth content round: the 背景概念 cards on
  `/skills/[slug]` and the 搭配技能 cards on `/knowledge/[slug]` hardcoded
  a generic one-liner in `DossierCatalogNote`, even when the pair's
  `LinkRelation` carried an editor-written note (both pages already looked
  the notes up via `findRelationBetween` for the `RelationshipGraph`
  tooltips — the card markup just never used them). Now the real note
  renders when present, with the old generic sentence kept as the
  fallback for untyped pairs. The technology detail page
  (`DossierRelatedItemsSection`) already did this correctly and is
  unchanged. Verified with typecheck, lint, format, vitest 90/90, and a
  live pass (custom notes visible on both page kinds, zero console
  errors).

## Partial-update slug preservation fix

- **`updateTechnologyWorkspaceRecord` no longer regenerates the slug on
  partial updates** — 2026-07-19, found live during the same-day content
  round: a PATCH that omitted `slug` fell through
  `normalizeSlug(undefined, title.original)` and silently rebuilt the slug
  from the **original (English) title**, breaking the public URL of every
  record touched by a partial API update (the workspace edit form always
  sends `slug`, so the bug never surfaced through the UI). Five published
  signals had their slugs clobbered and restored during verification. Fix:
  an absent `slug` now keeps the existing value; an explicit `slug` still
  normalizes with title fallback. Verified with a partial-PATCH round-trip
  (slug preserved), typecheck, lint, format, and vitest 90/90.

## LinkRelation v1 (typed relation editing)

- **Typed relation editing across all three workspace editors** —
  2026-07-19, owner-chosen as the next initiative after the same-day
  editorial round, closing the one item Skill/Knowledge workspace editing
  v0 explicitly deferred. Scope confirmed upfront via a form mockup and
  three decisions: all three workspaces (skill, knowledge, **and** the
  technology draft editor — the four signals published earlier the same
  day were exactly the "every relation renders as generic 关联" pain
  case), copy-on-write over the 56 seed relations in
  `src/data/relations.ts` (seed file stays read-only), and both
  `relationType` and `note` editable. Implementation: new
  `src/lib/link-relation-workflow.ts` — `config/link-relation-workspace.json`
  overlay store keyed by **unordered pair** (an override wins over the
  seed for the same pair regardless of `from`/`to` direction), pure cores
  (`applyLinkRelationOverlay`, `findRelationIn`, `planLinkRelationSync`)
  with 13 vitest tests, and a sync rule that keeps the store minimal: a
  value equal to the seed removes the override (clean revert), the
  generic default (`related-to`, no note) with no seed entry is never
  persisted, and pairs not mentioned in a save are left untouched (so
  edits from the other side of a shared pair survive). `LinkRelation.note`
  became optional to support type-only overrides. `content.ts`'s
  `findRelationBetween`, `buildRelationItems` (previously
  direction-sensitive; now unordered like everything else), and
  `getContentGraph` (single merged read instead of per-edge lookups) all
  read the merged view, so edits flow to detail-page pills and 附注 notes,
  `RelationshipGraph` tooltips, `/network` edge labels, and topic hubs
  with no component changes. New `PUT /api/workspace/relations` (batch
  upsert per source entity, under the existing token boundary),
  `link_relation.updated` workflow events, and a shared
  `RelationCheckboxItem` component: each related-content checkbox unfolds
  a relation-type select (七种档案语汇) plus note input via CSS `:has`
  while checked — forms stay fully uncontrolled, and the new-entry forms
  keep plain checkboxes (relations become editable after first save).
  Live-verified end to end: the Inkling draft's four relations set to
  必备/延伸/借助 with notes through the real form (store written, public
  detail pills + notes and `/network` edge types confirmed), and a seed
  pair override → revert round-trip leaving the store empty. Verified
  with typecheck, lint, format, and vitest 90/90.

## Dark-mode contrast completion round

- **Site-wide contrast fixes, dark mode completed** — 2026-07-16,
  owner-reported ("有一些界面字的颜色和背景颜色相近导致看不清字"). A WCAG
  contrast scan in both color schemes located the cause almost entirely
  in dark mode: the 2026-07-15 dark round only redeclared the seven
  `--dossier-*` tokens (+ TopNav/body), leaving every component styled
  through older generic root tokens or hardcoded light-mode colors
  "half dark" — worst cases at 1.16–1.8:1 (page headers keeping their
  light paper gradients under dark-mode light text, the tech-detail
  aside panels, the home news rows, relationship-graph headings/nodes,
  hardcoded `#34404a`-family body copy). CSS-only fix in
  `globals.css`'s dark media block: (1) the dark `.dossier` scope now
  also redeclares the generic root tokens (`--muted`, `--user-ink`,
  `--accent`, `--surface-strong`, ...) so the light-by-design workspace
  is untouched; (2) targeted overrides remap the hardcoded leftovers to
  dossier tokens; (3) three marginal values nudged one step for 4.5:1
  (dark `--dossier-stamp`, light `--dossier-muted`, and
  `--workspace-nav-active` + white active-link text — the last a
  pre-existing light-mode issue); (4) in dark mode the Internal
  Workspace gets an opaque light board behind `.workspace-shell`
  instead of sitting on the dark body. Re-scanned to zero failures
  across 11 public routes + the workspace in both schemes, zero console
  errors, light mode visually unchanged apart from the two token
  nudges. Full audit notes in `docs/design-system.md` → "Dark-mode
  contrast completion round". Verified with typecheck, lint, format.

## Skill/Knowledge workspace editing v0

- **Workspace editing flow for skills and knowledge shipped** — 2026-07-16,
  owner-approved via a design mockup after choosing the content-side
  direction (the skill/knowledge pools were previously only editable by
  changing `src/data` seed code — the structural bottleneck for content
  growth). Three confirmed scope decisions: seed entries are editable via
  copy-on-write runtime overrides (seed files stay read-only), entries carry
  a draft/published status flow with a minimal publish gate, and v0 edits
  related-content ids only (typed `LinkRelation` editing deferred). Four
  commits: (1) `src/lib/skill-workflow.ts` / `knowledge-workflow.ts` — new
  `config/skill-workspace.json` / `knowledge-workspace.json` stores,
  copy-on-write update/status transitions (editing a seed copies it into
  the store as `published`, since the seed version is already live; new
  records start as `draft`), pure cores (`buildXWorkspaceEntries`,
  `evaluateXPublishReadiness`, `applyXWorkspaceOverlay`) with 16 vitest
  tests, `skill.*`/`knowledge.*` workflow events; (2) API routes
  `POST/PATCH /api/workspace/{skills,knowledge}[/[id]]` and
  `POST .../[id]/status` mirroring the technology route shapes (409 +
  readiness payload on blocked publish), all under the existing
  `/api/workspace/*` token boundary; (3) workspace pages —
  `/workspace/skills` and `/workspace/knowledge` lists (草稿/已发布/内置种子/
  工作台覆盖 tiles, origin badges via a shared `ContentWorkspaceEntryCard`),
  `new` + `[id]` edit pages (shared `ContentWorkspaceStatusActions` with
  confirm + readiness errors, existing `PublishReadinessPanel`, per-domain
  forms with canonical-`TopicTag` checkboxes and related-content pickers),
  技能/知识 nav entries and breadcrumb labels; (4) public wiring —
  `getAllSkills` / `getAllKnowledge` in `src/lib/content.ts` now serve the
  merged seed+workspace view with drafts filtered, and the previously
  seed-direct reads (`getSkillBySlug` / `getKnowledgeBySlug`,
  `resolveTitle` / `resolveSlug`, `getContentGraph`) were converged onto
  them so the overlay applies consistently across index/detail pages, the
  content graph, search, and topic hubs. Publish gate: title/slug/summary
  required + unique slug blocking; short content, missing/non-canonical
  tags, and missing relations as warnings. Live-verified end to end:
  draft invisible on `/skills` → publish → visible on index/detail/search;
  seed override visible publicly and reverting cleanly after store
  cleanup; 409 readiness on blocked publish; zero console errors.
  Verified with typecheck, lint, format, and vitest 77/77.

## Topic hub (`/topics/[tagId]`)

- **Per-topic drill-down page shipped** — 2026-07-15, same session as the nav
  simplification above, owner-directed after reviewing a page mockup and an
  index-page mockup (the index page was explicitly declined — no `/topics`
  listing, no global nav entry). `getTopicHub(tagId)` in the new
  `src/lib/topic-hub.ts` merges what `/network`, the 按话题 view, and
  `/search` each show in fragments for one topic tag: published
  technologies tagged with it (newest-first, reusing the same bilingual
  title/summary helpers `/timeline` uses), tagged skills, tagged knowledge,
  and a "图谱关联" section — every node in `getContentGraph()` connected by
  an edge to any of the above, excluding nodes already shown in the three
  lists, each carrying its edge's Chinese relation-type label. Returns
  `undefined` (→ `notFound()`) for an unknown tag id or one with no content
  in any of the three pools. The only entry point is a new "查看专题" link
  rendered on every chip in `FollowableTagList` (technology/skill/knowledge
  detail pages) — deliberately scoped narrower than the generic `TagList`
  used site-wide on index cards, related-item cards, and search results,
  which stay pure display with no new interactive surface. Pure derived
  view: no new persisted fields, no AI calls, no internal fields. Verified
  with typecheck, lint, format, vitest 61/61, and a live pass (tag-inference
  showing 6 signals + 10 graph neighbors, tag-ai-agents showing all four
  sections including directly-tagged skills/knowledge, an unknown tag id
  returning a real 404, zero console errors).

## Nav simplification: /news, /timeline, /radar folded into /technologies

- **Public nav cut from 10 items to 6** — 2026-07-15, owner-directed after
  reviewing a before/after mockup and comparison page. 今日快讯 (`/news`),
  时间线 (`/timeline`), and 我的雷达 (`/radar`) were three different
  filters/groupings over the same published-technology data, not
  independent destinations, so they're now four views on `/technologies`
  switched by a `?view=` query param and a tab strip (精选 default,
  `news`/全部快讯, `timeline`/按话题, `followed`/我关注的). `/technologies/page.tsx`
  reads the `view` param and renders `TechnologyBrowser` (unchanged),
  the new `NewsFeedSection` and `TopicTimelineSection` components
  (extracted verbatim from the old news/timeline pages, with
  `getTimelineTopics` changed to take `technologies`/`tags` as parameters
  instead of re-fetching them), or the existing `MyRadarContent` (reused
  as-is). `src/app/{news,timeline,radar}/page.tsx` are now one-line
  `redirect()`s to the matching `?view=`, matching the existing
  `src/app/candidates/page.tsx` legacy-redirect pattern. All four cross-page
  links that pointed at the old routes (`page.tsx`'s home news-board link,
  `daily-digest-content.tsx`'s two personalization-bar links, and
  `followable-tag-list.tsx`'s follow hint) were repointed at the matching
  `/technologies?view=` URL. The 搜索 nav link was replaced with an
  always-visible inline search icon/box in `TopNav` that still GETs to the
  untouched `/search` page. Confirmed before starting that every CSS
  class used by the moved-in JSX (`.news-day`, `.news-card`, `.timeline-topic`,
  `.dossier-timeline-node`, `.my-radar`, etc.) was already unscoped (only
  extra rules were scoped to the generic `.dossier` ancestor, which
  `/technologies` already carries), so the merge needed zero CSS selector
  rewrites — only new `.technology-view-tabs`/`.top-nav__search` blocks.
  Verified with typecheck, lint, format, vitest, and a live pass (all four
  `?view=` values, the three old routes redirecting correctly, the search
  toggle, and the repointed cross-links).

## `DossierCard` tilt prop cleanup

- **Removed the inert `tilt` prop and `cardTilts` arrays** — 2026-07-15,
  same day, closing out the one deferred cleanup item flagged when the
  resting tilt was removed in favor of a flat rest state (see "Dossier
  direction — flat cards" below). That change was CSS-only at the time;
  `DossierCard`'s and `DossierTechnologyCard`'s `tilt` prop and every call
  site's `cardTilts` cycling array still computed a value and passed it
  down, but the class it produced no longer had any CSS behind it. Removed
  for real across 8 files (`dossier-card.tsx`, `dossier-technology-card.tsx`,
  `technology-browser.tsx`, `my-radar-content.tsx`, `src/app/page.tsx`,
  `src/app/digest/page.tsx`, `src/app/knowledge/page.tsx`,
  `src/app/skills/page.tsx`) — net -64 lines, no visual change. Verified
  with typecheck, lint, and format:check.

## `/network` edge focus + relation-type legend

- **Edge crossing density reduced, relation-type legend added** —
  2026-07-15, same day, owner-approved follow-up after the node-overlap
  fix. Measured edge crossing density (segment-intersection test): 789
  crossing pairs among the graph's 88 edges. Edges now rest at low
  opacity (0.35) by default; a selected node's own edges pop to full
  opacity in the stamp accent color, everything else stays faint or drops
  further via the existing dim state — reused the existing per-edge
  active/dim class logic unchanged, only the CSS opacity values changed.
  Separately, the panel's resting-state legend gained a relation-type
  section (必备/关联/渊源/…) below the existing kind legend, derived live
  from the actual edge data (deduplicated `relationType` values, not a
  hardcoded list) and rendered as `DossierStampTag`s — the same relation
  labels already shown per-connection and on edge hover, now also visible
  as a glossary before any interaction. See `docs/design-system.md` →
  "Dossier direction" → "`/network` edge focus + relation-type legend
  (2026-07-15, same day)" for the full writeup, including a verification
  detour where the browser automation tool initially reported wrong
  opacity values due to CSS transitions being throttled in a backgrounded
  tab — confirmed via `Element.getAnimations()` to be a test-tooling
  artifact, not a real bug. Verified with typecheck, lint, format, vitest
  61/61, and a live pass (opacity values confirmed correct, relation
  legend shows all 7 types present in the real data, zero console errors
  on a fresh tab).

## `/network` dot nodes (overlap fix)

- **Node overlap fixed on `/network`** — 2026-07-15, owner-reported the
  whole-graph overview "felt chaotic" and got worse when zoomed. Measured
  before fixing: 44 overlapping node-label pairs at desktop width (33
  labels, avg. ~112px wide, in a 568×568px canvas), 93 pairs at a
  narrower simulated-zoom width (305×320px canvas) — the force layout's
  "ideal distance" formula never accounted for actual label footprint, so
  labels were simply too wide for the room the physics gave them. Fixed
  by making nodes small kind-colored dots by default (11-15px), with the
  full title label appearing only when a node is hovered, selected, or
  matches the active search text — not general category-filter match,
  since a filtered category can still hold a dozen-plus nodes. Every node
  keeps `aria-label`/`title` set to its full title regardless of visual
  state, so screen readers and native tooltips are unaffected. Re-measured
  after the fix: zero overlapping dots at both canvas sizes tested. See
  `docs/design-system.md` → "Dossier direction" → "`/network` dot nodes
  (2026-07-15)" for the full writeup. Verified with typecheck, lint, format,
  vitest 61/61, and a live pass (search shows exactly the matching
  labels, selection shows exactly its own label plus the connections
  panel, dark mode's dot ring blends into the canvas background, zero
  console errors).

## Dossier direction — flat cards (tilt removed)

- **`DossierCard` tilt removed** — 2026-07-15, owner-directed. The
  per-index resting tilt (three rotation angles, straightened on hover)
  read as too busy across full card grids and was replaced with a flat
  rest state plus a plain hover lift. Three replacement directions were
  mocked up and compared before deciding: plain flat, flat with a
  folded-corner accent, and flat with a content-kind-colored tab spine.
  The colored-spine option was ruled out during discussion: the existing
  technology/skill/knowledge three-color code only carries information
  where multiple kinds share a view (`/network`, the per-item
  `RelationshipGraph`) — on a single-kind list page every card would show
  the same spine color, which is exactly the decoration-with-no-signal
  failure mode that color system is careful to avoid elsewhere. Plain flat
  was chosen. Implementation was CSS-only: the `.dossier-card--tilt-a/b/c`
  rotation rules were removed from `globals.css`; `DossierCard`'s `tilt`
  prop and every call site's `cardTilts` cycling array were deliberately
  left unchanged (the tilt class names still land in the DOM, just inert)
  — a full prop removal is a separate, deferred cleanup. See
  `docs/design-system.md` → "Dossier direction" → "Flat cards
  (2026-07-15)" for the full writeup. Verified with typecheck, lint,
  format, vitest 61/61, and a live check that cards compute
  `transform: none` at rest on `/technologies`, `/skills`, and `/`, zero
  console errors.

## Dossier direction — dark mode (system preference only)

- **Dark mode for the dossier direction** — 2026-07-15, same day as the
  `/network` round, owner-decided to follow `prefers-color-scheme: dark`
  only (no manual toggle, no persisted state — the smaller, more
  contained option, matching this project's minimal-client-state pattern
  elsewhere). Since almost every dossier rule already routes color
  through the seven `--dossier-*` custom properties, the whole scope
  repaints from one `@media (prefers-color-scheme: dark) { .dossier {
... } }` block redeclaring those seven values — no changes needed to
  the ~1100 lines of rules that reference them. Live verification caught
  a real scoping gap before shipping: `TopNav` (rendered once in
  `layout.tsx`, outside `.dossier`, shared with the Internal Workspace)
  and the `body` background gradient (visible as gutters beside
  `.main-content` on wide viewports) both used hardcoded light colors —
  theming only `.dossier` would have left a dark page under a still-light
  nav bar. Both got their own dark variant in this round; `TopNav`'s is
  unconditional, so it also applies on Workspace pages (harmless, likely
  an improvement next to the already-dark rail). See
  `docs/design-system.md` → "Dossier direction" → "Dark mode (system
  preference only, 2026-07-15)" for the full writeup. Verified with
  typecheck, lint, format, vitest 61/61, and a live pass forcing both
  color schemes via browser emulation on `/network` and a workspace page
  (zero console errors in either scheme, light mode unchanged).

## Dossier direction adoption — /network (force-directed rebuild)

- **Dossier direction live on `/network`** — 2026-07-15, owner-authorized
  follow-up to the six-round migration below. Unlike every other round,
  this wasn't a card-component swap: `ContentNetworkGraph` was rewritten
  from its fixed three-lane layout to a hand-written, Fruchterman-
  Reingold-style force-directed simulation (node repulsion, spring-edge
  attraction, a weak centering force, ~150 relaxation frames) so the
  33-node/88-edge graph's real topology drives the layout instead of an
  artificial technology/skill/knowledge lane split. Ships the three
  enhancements confirmed in the original design session: search-highlight
  (`DossierSearchInput`), a category filter (`DossierCategoryChips`), and
  hover-over-edge relation labels; nodes are also draggable. Zoom/pan
  stayed out, per the earlier decision not to add it at this node count.
  Two real bugs were caught and fixed during live verification before
  commit: (1) the initial node scatter used `Math.cos`/`Math.sin`, which
  the JS spec doesn't guarantee bit-identical across Node's and the
  browser's V8 builds, causing a genuine hydration mismatch on every
  load — fixed by rendering an SSR-safe integer-arithmetic grid for first
  paint and only applying the trig-based organic scatter from inside a
  client-only effect, after hydration; (2) combining node-selection with
  search/filter used an implicit AND across the two lenses, so selecting
  a node unrelated to the current search term dimmed the entire graph to
  nothing — fixed to a union (a node stays visible if it satisfies either
  active lens). See `docs/design-system.md` → "Dossier direction" →
  "Adopted pages" for the full writeup. With this, the whole User-facing
  Product is on the dossier system; only the Internal Workspace remains
  on the original system, by design. Verified with typecheck, lint,
  format, vitest 61/61, and a live pass (fresh-tab reload confirmed zero
  hydration errors, selection/search/filter combinations checked via
  computed DOM state, mobile width at 375px with no overflow, console
  clean).

## Dossier direction adoption — homepage (migration complete)

- **Dossier direction live on `/` (homepage)** — 2026-07-14, same night,
  sixth and final adoption round. `HomeTechnologyCard`, `SkillPathCard`,
  `KnowledgePathCard`, and the digest summary card (all page-specific,
  not shared with any other page) now render through `DossierCard`, with
  `DossierStampTag` for the priority/category pills and
  `DossierCatalogNote` for the "为什么重要" block. The compact news-row
  list keeps its original markup (CSS reskin only), since
  `DossierRegisterRow`'s `Link`-only href doesn't support the
  `target="_blank"` behavior those external-link rows need. This
  completes the original migration-cost plan's adoption order: every
  page named in it now renders the "编辑桌" look. `/network` (its own
  hand-written force-directed graph, not a card swap) was discussed as a
  target for this direction but was never placed in the adoption order
  and remains unmigrated, alongside the Internal Workspace by design.
  Verified with typecheck, lint, format, vitest 61/61, and a live pass
  (all sections render — hero, digest card, priority signals, news rows,
  skill/knowledge cards — mobile width without overflow, zero console
  errors, `/network` confirmed unaffected).

## Dossier direction adoption — /radar & /news

- **Dossier direction live on `/radar` and `/news`** — 2026-07-14, same
  night, fifth adoption round, closing out the "each need one new state"
  pages from the original plan. `MyRadarContent` swaps its
  `TechnologyListCard` usage for `DossierTechnologyCard` (the same
  page-specific card built for `/technologies`) — safe to change directly
  since `MyRadarContent` is only ever rendered by `/radar`, so the home
  page's independent `TechnologyListCard` usage is untouched. `/news`'s
  page-specific `NewsCard` swaps to `DossierCard`, the same treatment
  `/search`'s `SearchNewsCard` already got. Verified with typecheck, lint,
  format, vitest 61/61, and a live pass (follow/unfollow toggle still
  filters correctly, disclaimer and tags render, mobile width without
  overflow, zero console errors, home page confirmed unaffected).

## Dossier direction adoption — digest & search

- **Dossier direction live on `/digest`, `/digest/today`, `/digest/[date]`,
  and `/search`** — 2026-07-14, same night, fourth adoption round. The
  digest archive index swaps its entry cards for `DossierCard` +
  `DossierStampTag`. The shared `DailyDigestContent` component (rendered
  by both public digest routes and the workspace digest-preview route)
  gained `DossierCard` for technology/reference/source cards,
  `DossierStampTag` for type/priority badges, and `DossierCatalogNote` for
  the "为什么重要" reason block. `/search` swaps result cards for
  `DossierCard` and its GET-form search input for the `.dossier-search`
  icon-pill markup (inlined, since the page is an uncontrolled
  server-rendered form rather than client state, so the
  `DossierSearchInput` component's controlled-input API doesn't fit).
  A real bug was caught and fixed before commit: `dossier` was only added
  to the two public digest page shells at first, but the workspace
  digest-preview route renders `DailyDigestContent` inside
  `WorkspacePageShell` (no `.dossier` ancestor there), so its new
  `DossierCard`/`DossierStampTag` instances resolved `--dossier-*` custom
  properties to nothing and rendered borderless/invisible cards. Fixed by
  moving `dossier` onto `DailyDigestContent`'s own root div — the same
  self-contained pattern `TechnologyDetailContent` already used — so the
  component carries its own dossier scope regardless of which shell wraps
  it. Verified with typecheck, lint, format, vitest 61/61, and a live pass
  on all four routes plus the workspace preview route (cards render with
  visible borders/backgrounds there too, mobile width without overflow,
  zero console errors).

## Dossier direction adoption — /timeline

- **Dossier direction live on `/timeline`** — 2026-07-14, same night, third
  adoption round and the first real use of `DossierRegisterRow`
  (previously unused since the component slice shipped). Each topic's
  chronological entry list now renders as a ledger of register rows
  (`title` + `date` + `href` + a `tag` set to the entry's source name)
  instead of the rail-and-dot connector list the page used before — the
  ledger reads better against the archival "编辑桌" concept than a
  timeline-rail metaphor. Since `DossierRegisterRow` only covers the
  compact title/date/tag line, the entry summary renders as a plain
  paragraph underneath, indented to align under the title column
  (`.dossier-timeline-node__summary`); the component itself needed no
  changes. Verified with typecheck, lint, format, vitest 61/61, and a live
  pass (10 topics rendered, newest-first ordering confirmed per topic,
  detail-page links resolve, mobile width without overflow, console
  clean).

## Dossier direction adoption — skills & knowledge

- **Dossier direction live on `/skills`, `/skills/[slug]`, `/knowledge`,
  `/knowledge/[slug]`** — 2026-07-14, same night, the second adoption round
  right after `/technologies`. Unlike the technology pages, these four
  routes hand-roll their own card/section markup per route rather than
  sharing components, so `DossierCard`, `DossierStampTag`, and
  `DossierCatalogNote` were used directly in each `page.tsx` (no new
  page-specific sibling components needed). Every index card's outcome
  blurb and every related-item note — including the skill↔knowledge "附注"
  note on both detail pages — now renders through `DossierCatalogNote`;
  heat/cost/category/difficulty pills and relation-type labels render
  through `DossierStampTag`. `RelationshipGraph`, `TagList`,
  `FollowableTagList`, and `RelationDensity` needed no changes at all — the
  `.dossier`-scoped CSS written for the technology round already targets
  their shared classnames, so they picked up the look for free once these
  pages added the `dossier` class. Verified with typecheck, lint, format,
  vitest 61/61, and a live pass across all four pages (index + detail,
  relation pills, catalog notes, mobile width at 375px with no horizontal
  overflow, zero console errors) plus a regression check that home,
  `/radar`, and the technology pages were unaffected.

## Dossier direction adoption — /technologies

- **Dossier direction live on `/technologies` and `/technologies/[slug]`** —
  2026-07-14, later the same day as the staged component slice below, the
  first real page-by-page adoption per the migration order recorded in
  `docs/design-system.md`. Both pages now render the archival "编辑桌" look
  end to end: `/technologies` (`TechnologyBrowser`) uses `DossierSearchInput`
  and three `DossierCategoryChips` rows (type/tag/priority) in place of
  `SearchFilterBar`, and a new `DossierTechnologyCard` in place of
  `TechnologyListCard` for each signal (tilt cycled per card). The detail
  page (`TechnologyDetailContent`, also reused by the workspace preview
  route) gained a new `DossierRelatedItemsSection` for the
  相关技术/相关技能/相关知识 sections — the flagship "附注" feature this whole
  direction was designed to prove, rendering each connection's
  `relatedSkillExplanations`/`relatedKnowledgeExplanations` note through
  `DossierCatalogNote` with no data-model change — plus `DossierStampTag`
  for the hero/priority pill. `TechnologyListCard`, `SearchFilterBar`, and
  `RelatedItemsSection` were deliberately left unchanged (new page-specific
  siblings were added instead), since all three are still shared with pages
  not yet migrated (home, `/radar`, skills, knowledge). The three AI widgets
  (compare/explain/learning-path) and `RelationshipGraph` — also shared with
  the not-yet-migrated skill/knowledge detail pages — were reskinned through
  `.dossier`-scoped CSS on their existing classnames rather than forked, so
  they pick up the look on this page while staying inert everywhere else.
  Both pages opt in with one added `dossier` class on their shell/layout
  root; every other `.user-shell` page is unaffected. Verified with
  typecheck, lint, format, vitest 61/61, and a live pass in the dev server
  (filter interactions, related-item notes, mobile width at 375px with no
  horizontal overflow, zero console errors).

## UI direction exploration & copy tone fixes

- **Dossier design direction v0 (staged)** — 2026-07-14, owner-directed
  visual-identity exploration for the User-facing Product. Evaluated three
  full directions via HTML/CSS mockups (an "instrument console," a
  "knowledge graph," and an editorial "编辑桌"/dossier direction) against
  every public page type; the dossier direction was selected and specified
  in full (palette, type, motion, card language, `/network`'s hand-written
  force-directed graph replacing the corkboard concept it started from,
  icon-pill search, stamp-chip filters). See `docs/design-system.md` →
  "Dossier direction (staged)" for the complete specification. A first
  slice of six reusable components shipped
  (`src/components/dossier-*.tsx`) plus a `.dossier`-scoped token/class
  block in `globals.css` — verified with typecheck, lint, format, and a
  live rendering + interaction check, but **not wired into any real page
  yet**; this is staged scaffolding for a future page-by-page migration,
  not a shipped feature.
- **Copy tone fixes** — 2026-07-14, same session, the one real (non-staged)
  code change it produced. The `RelationType` label vocabulary
  (建立在/需要/支持/解释/相关, `getRelationTypeLabel` in
  `src/lib/technology-localization.ts`) read like word-for-word English
  translations, including a passive "被…于" mirror for the reverse
  direction. Rewritten to five archival-register words used symmetrically
  in both directions (渊源/借助/释义/必备/延伸/印证/关联 — seven values;
  `RelationType` has `uses`/`extends` beyond the original five named in
  discussion). Auditing this pattern elsewhere in the public UI turned up
  more instances: a duplicated-with-drift priority-label dictionary
  (`daily-digest-content.tsx` and `my-radar-content.tsx` each hardcoded
  their own copy of `getPriorityLevelLabel`'s three labels, and had
  already diverged — `了解即可` vs. the canonical `可以了解`, itself
  replaced with `背景参考`), the `whyItMatters` field heading
  "为什么值得看" unified to "为什么重要" across all seven places it
  appeared (public and workspace), two passive "被评为…/由…解释"
  constructions rewritten active, and two bare verb+object stat lines
  given the `已` aspect marker natural Chinese count lines normally carry.
  Verified with typecheck, lint, format, vitest 61/61, and a live pass
  over `/`, `/digest/today`, `/radar`, `/knowledge`, and a technology
  detail page.

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

## Topic timeline

- **Public topic timeline v0 (`/timeline`)** — 2026-07-14, the other half of
  the "topic timeline" idea from the search proposal, shipped as its own
  page per the one-page-per-task rule. New public `/timeline` (「时间线」 in
  `TopNav`) groups every published technology signal by topic tag and
  renders each topic as a chronological (newest-first) list of dated nodes
  linking to `/technologies/[slug]` — e.g. seeing the vLLM release cadence or
  the Ollama agent-workbench pivot laid out in order under 推理与部署 / AI
  智能体. Scoped to published-signal data only (no news fast-lane items, to
  keep each topic's story readable instead of noisy); topics are sorted by
  signal count then name, and only topics with at least one published signal
  render. Implementation: no new data layer — reuses `getAllTechnologies()` /
  `getAllTags()` and the existing bilingual title/summary helpers
  (`getPreferredTechnologyTitle/Summary`). New `.timeline-*` CSS (a simple
  connector-line + dot rail per topic) on existing tokens. Verified with
  typecheck, lint, format, and a live pass (10 topics rendered, newest-first
  ordering confirmed per topic, detail-page links resolve, mobile width
  without overflow, console clean).

## Digest archive

- **Public digest archive index v0 (`/digest`)** — 2026-07-14, shipped the
  same day as site-wide search as the follow-up discoverability slice.
  Previously published digests were only reachable via `/digest/today` or by
  knowing the exact date URL. The new public `/digest` page lists every
  `status = published` digest grouped by month (newest first), each entry
  showing the date, public title and summary (via the existing
  `getPublicDigestTitle` / `getPublicDigestSummary` sanitizers in
  `src/lib/public-copy.ts`), and immediate-attention / worth-tracking counts,
  linking to `/digest/[date]`. The 订阅简报 section on both public digest
  pages gained a 往期简报归档 link. Scope deliberately cut to one page per
  the house rule — the topic-timeline idea from the same proposal remains a
  separate future task. Draft/archived digests, editorial notes, and manual
  adjustment ids never render; the archive exposes exactly the digest set
  already public in `/feed.xml` / `/feed.json`. New `.digest-archive-*` CSS
  on existing tokens. Verified with typecheck, lint, format, and a live pass
  (month grouping, sanitized May fixture title, entry links, leak scan,
  no overflow, console clean).

## Site-wide search

- **Public site-wide search v0** — 2026-07-14, owner-authorized as the next
  capability after the news fast lane. New public `/search` page (「搜索」 in
  `TopNav`) with server-rendered `?q=` keyword search over the four public
  content pools: published technology signals, skills, knowledge, and the
  news fast lane. Matching is deterministic and explainable — case-insensitive
  substring match on title / summary / tag display names only (content bodies
  deliberately excluded to keep results low-noise), with space-separated
  terms ANDed. Results render grouped per content type with per-group counts;
  the news group always carries the fixed 自动聚合 disclaimer, making search
  a compliant fast-lane surface. Implementation: new `src/lib/search.ts`
  (`searchPublicContent` + `PublicSearchResults`), reusing
  `getAllTechnologies` / `getAllSkills` / `getAllKnowledge` (published-only
  public shapes), `getPublicNewsItems` (the existing `src/lib/news.ts`
  sanitizing map — no new candidate→public mapping point was created), and
  `getPreferredTechnologyTitle/Summary` for bilingual display; new
  `src/app/search/page.tsx` (Next 15 async `searchParams`, plain GET form,
  guided empty states for "no query" and "no matches") and a `.search-*`
  CSS block on existing tokens. No AI, no external service, no new API
  route; the served results are identical for everyone. Verified with
  typecheck, lint, and a live pass (Chinese/English queries, multi-term AND,
  case-insensitivity, news-group disclaimer, mobile width without overflow,
  no new console errors).

## News fast lane & scheduled import

- **News fast lane + task-runner scheduled import v0 (two-tier content
  model)** — 2026-07-13, owner-authorized to solve content freshness/volume
  without weakening the editorial gate. Two coupled pieces:
  1. **Public news fast lane (`/news` + home board)**: recently imported
     candidates (last 7 days, grouped by day, capped at 200) are now publicly
     readable through a new dedicated sanitizing layer `src/lib/news.ts` —
     the single mapping point where an `ImportedCandidate` may reach a public
     surface. Only title / truncated summary / source name / source URL /
     publish date / display tags cross the boundary; `rawPayload`,
     `importStatus`, `normalizedType`, duplicate-group internals, and
     candidate IDs never enter the RSC payload. Rejected candidates,
     `fallback`-tagged placeholder candidates, and non-primary members of
     open/resolved duplicate groups are excluded; candidates already
     converted + published link to their formal signal page. Every surface
     carries the fixed "自动聚合内容，未经编辑精选" disclaimer. New `/news`
     page (「今日快讯」 in `TopNav`), a compact latest-news board on the home
     page, and `.news-*` / `.home-news-*` CSS on existing tokens. The curated
     TechnologyItem/digest tier is untouched — the fast lane deliberately
     contrasts with it rather than replacing it.
  2. **Scheduled daily import in the task runner**: each
     `tasks:run-once` / `tasks:watch` pass now also checks
     `config/scheduled-import.json` (new `src/lib/scheduled-import.ts`;
     default enabled, 08:00 Asia/Shanghai) and, when due, runs one batch
     import for all enabled sources with `useFallbackOnFailure: false` so
     unattended runs never mint placeholder candidates. Same
     `nextRunAt`-advance timing model as `ScheduledDelivery` (bootstrap:
     missing `nextRunAt` = due now), which doubles as same-day duplicate
     protection. Import status folds into the `TaskRunnerRun` status
     (failed import downgrades a successful pass to `partial`) and messages.
     Managed from `/workspace/delivery/schedules` (new 定时导入 panel,
     `ScheduledImportActions` client component, `PATCH
/api/workspace/scheduled-import`); Windows Task Scheduler setup
     documented in `docs/deployment.md`. `validate:tasks` now pins a
     disabled scheduled-import config during its runs (and asserts the
     skip message) so validation never triggers live network imports.

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

- **Public technology RSC payload hardening** — 2026-07-10: public
  `TechnologyItem`s no longer carry the persisted `priority` ranking object
  (`priorityScore`, raw `priorityReasons`/`priorityWarnings`,
  `rankingSource`). Those fields were never rendered on public pages, but
  because the technology detail, digest, and radar renderers are client
  components, the full ranking object was serialized into their RSC flight
  payloads — the same class of leak fixed earlier for digest pages via
  `PublicDigestView`. The public mapping in `src/lib/content.ts`
  (`toUserFacingTechnologyItem` + seed-item strip) now omits `priority`
  entirely; every public surface already derived the productized priority
  level on demand via `evaluateTechnologyPriority` (pure over public
  fields), so no component changed. `validate:ranking` now asserts the
  inverse contract: published technologies expose no ranking internals and
  the priority level stays derivable. The full `TechnologyPriorityRanking`
  remains on `TechnologyWorkspaceRecord` behind the workspace boundary.
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

- **Digest generation copy localization (Chinese)** — 2026-07-10, the final
  slice of the localization sequence and the only one that touches public
  content generation: the default digest title template
  (`getDefaultDigestTitle` in `digest-store.ts`, now `每日技术简报 - 日期`),
  the generated digest summary (`buildDigestSummary` in
  `digest-workflow.ts`, now `今日 N 条立即关注，N 条值得跟踪，覆盖 N 个来源。`
  plus a Chinese empty-digest fallback), the `normalizeDigest` summary
  fallback, and the default editorial-note templates are now generated in
  Chinese. The two published real digests (2026-07-09 / 2026-07-10) had
  their English default titles/summaries backfilled to the new Chinese
  copy via `updateDailyDigest` (editor-written Chinese editorial summaries
  untouched); the May delivery-validation fixtures were left as-is since
  `public-copy.ts` already sanitizes them on public surfaces. Share text
  and the public-copy fallbacks were already Chinese. Verified with
  typecheck, lint, format, vitest 54/54, the six digest/delivery
  validators, and a live pass over `/digest/today`, `/digest/2026-07-09`,
  `/feed.xml`, `/feed.json`, and the home digest card (feed item titles now
  Chinese, zero leftover generation English, zero console errors).
- **Workspace diagnostic-string localization (Chinese)** — 2026-07-10, the
  owner-chosen follow-up to Workspace UI localization v0: the six categories
  of lib-generated diagnostic strings deliberately left English in that pass
  are now generated in Chinese — Ranking v0 `priorityReasons` /
  `priorityWarnings` (`src/lib/ranking.ts`), Publish Quality Gate messages
  (`publish-readiness.ts`), digest publish-readiness messages
  (`digest-workflow.ts`), source import messages (`source-workflow.ts`,
  `external-import.ts`, including the fallback-candidate placeholder copy),
  delivery / scheduled-delivery / task-runner messages, and operations
  statusReasons + attention-item copy (`operations-metrics.ts`). The vitest
  tests and validate scripts asserting those strings were updated in the
  same change (`ranking.test.ts`, `validate:ranking`,
  `validate:delivery-integration`, `validate:delivery-channels`,
  `validate:scheduled-delivery`, `validate:tasks`, `validate:operations`);
  `validate:workspace-boundary` — found to have been silently stale since
  earlier copy refactors (it asserted "Internal Workspace" copy that no
  longer existed pre-localization) — was re-pointed at the current Chinese
  nav/dashboard/action copy. Historical English messages already persisted
  in `config/` stores are intentionally untouched (audit data; they age out
  naturally). Digest _generation_ copy (default title/summary/editorial-note
  templates, which feed public digest content), workflow event action codes,
  and imported data content remain English by design. Verified with
  typecheck, lint, format, vitest 54/54, and all 22 `validate:*` scripts
  green.
- **Workspace UI localization v0 (Chinese)** — 2026-07-10: all Internal
  Workspace UI chrome is now Chinese — the workspace nav/groups and
  breadcrumbs, every `/workspace/*` page title/description/section label,
  dashboard, table heads, form labels and placeholders, buttons, confirm
  dialogs, empty states, hints, client action messages, and date formatting
  (`en` → `zh-CN`). Display-label helpers (`source-display`,
  `imported-candidate-display`, `quality-display`, `delivery-labels`,
  `getRankingSourceLabel`, operations metric labels) now return Chinese, and
  workspace components pass `"zh"` to the bilingual `getPriorityLevelLabel`;
  status enums rendered raw before (draft/published, open/resolved,
  success/failed, healthy/critical …) gained local label maps. Deliberately
  NOT translated in this pass: lib-generated diagnostic strings persisted in
  data or asserted by `validate:*` scripts (ranking `priorityReasons`
  / `priorityWarnings`, import/delivery run messages, readiness check
  messages, workflow event snapshots, operations `statusReasons` /
  attention-item text) plus data content itself. Public pages untouched — the
  translated label helpers are workspace-only, and the bilingual public
  priority-label behavior is preserved. Verified with typecheck, lint,
  format, vitest 54/54, `validate:operations`, and a live sweep of all 11
  workspace routes (leftover-English scan showed only in-scope diagnostic
  and data strings, zero console errors).

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

- **Personalized digest view (P4 v0.2)** — shipped 2026-07-09, the third
  P4 slice: the public digest pages (`/digest/today` and `/digest/[date]`,
  both rendered by `DailyDigestContent`) now react to the reader's followed
  topics. When the reader follows topics, a personalization bar appears
  between 今日概览 and the signal sections showing "已关注 N 个话题，本期命中
  M 条" plus a "只看我关注的" toggle; matched items carry the same
  "命中关注：X" explanation line as `/radar` (highlight always on, full
  editorial curation shown by default). Turning the filter on hides
  non-matching items, hides a signal section entirely when it has no matches,
  and shows a guided empty state with a one-click "查看全部内容" reset when
  nothing matches. Readers with no follows see the digest unchanged except a
  one-line hint linking to `/radar`. Implementation: `DailyDigestContent`
  became a client component (same pattern as `technology-detail-content.tsx`),
  reusing `src/lib/followed-tags.ts` and the `my-radar__*` chip/match-line
  styles; the `rssFeedPath` / `jsonFeedPath` constants moved to a new
  dependency-free `src/lib/feed-paths.ts` (re-exported from
  `digest-delivery.ts` for existing consumers) so the client bundle does not
  pull the filesystem-backed digest workflow. Skills / knowledge / sources /
  feed sections are untouched, and the route still serves identical published
  content to everyone — personalization is entirely client-side, consistent
  with the P4 v0 boundary. Verified with typecheck, lint, format:check,
  vitest 54/54, and a live pass on `/digest/today` (highlight, filter on/off,
  zero-match empty state + reset, no-follows hint, mobile width without
  overflow, no console errors).
- **Detail-page follow entry (P4 v0.1)** — shipped 2026-07-09, immediately
  after P4 v0, as the owner-chosen follow-up: readers can now follow a topic
  from where they read about it, not only on `/radar`. The tags section on
  all three user-facing detail pages (technology `/technologies/[slug]`,
  skill `/skills/[slug]`, knowledge `/knowledge/[slug]`) now renders the new
  shared client component `FollowableTagList`
  (`src/components/followable-tag-list.tsx`) instead of the static `TagList`:
  each tag becomes the same follow/unfollow toggle chip used on `/radar`
  (reusing the `my-radar__tag-toggle` styles and the localStorage helpers in
  `src/lib/followed-tags.ts`, so state syncs across components and tabs).
  Below the chips, one hint line closes the loop: "点击话题，将它加入我的雷达"
  when none of the page's tags are followed, or "已加入我的雷达 · 查看" with a
  link to `/radar` when at least one is. Hero tags and the small tags on
  related-item cards stay static (`TagList`); no accounts, no server state —
  the same P4 v0 boundary. Verified with typecheck, lint, format:check,
  vitest 54/54, and a live pass on all three detail pages (toggle on/off,
  localStorage + hint sync, mobile width without overflow, no new console
  errors).
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
