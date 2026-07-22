# Next Task

> Update 2026-07-22 (latest): **Production-readiness assessment written**
> (`docs/production-readiness.md`) — owner-selected from the backlog, scoped to
> a **controlled single-operator go-live** (public read-only site + token-locked
> workspace + local storage). Read-only assessment, no code changed. Evidence
> gathered live: `npm run build` **passes** (all routes compile incl. the two
> new ones); workspace guard covers all internal prefixes and fails **closed**
> when enabled-but-unconfigured with a constant-time token compare. Verdict:
> close to go-live but **4 blocking config/data-hygiene items** first — (B1)
> workspace protection is **off by default** (`WORKSPACE_ACCESS_ENABLED=false`
> in `.env.example`; `isWorkspaceAccessEnabled` false unless set) so a deploy
> without it is fully open; (B2) all 18 `config/*.json` stores are git-tracked,
> so a real delivery endpoint/token would be committed (only `mock://` today —
> latent, not active); (B3) committed demo/validation fixtures would ship as
> real content/channels; (B4) `NEXT_PUBLIC_SITE_URL` defaults to localhost and
> propagates into feeds/digest links. Plus 4 important items (public LLM routes
> unthrottled — moot under the default mock provider; JSON store no
> locking/backup + concurrent task-runner writes; no CSP/HSTS; Node not
> pinned though `node:sqlite` needs ≥22.5). Full write-up incl. a confirmed-good
> list, out-of-scope items, and an ordered go-live checklist in
> `docs/production-readiness.md`; indexed in README's doc list. **Next actual
> step**: none predefined — remaining backlog is dev-server 退出根因, content
> growth, and the next editorial round; or act on the go-live checklist (that
> would be config/ops work, largely outside this repo).

> Update 2026-07-22 (earlier): **Editorial round console shipped
> (`/workspace/editorial-round`)** — owner-selected from the backlog, scope
> locked via `AskUserQuestion` + a depth-comparison mockup (orchestration
> console vs. full inline workbench) + a layout mockup: **A) orchestration
> console**, **nav + dashboard entry**, **safe transitions inline**. Collapses
> the `editorial-round-playbook` loop onto one page without duplicating any
> editor. New `src/lib/editorial-round.ts` (`getEditorialRoundState`) is a pure
> read aggregation over existing getters — undecided candidates (effective
> `importStatus === "new"`), open dup-group count, drafts awaiting publish
> (each with its `getTechnologyWorkspacePublishReadiness` summary,
> blocking-first), today's digest — plus a derived five-phase step tracker
> (done/current/todo/blocked). Page + `editorial-round-actions.tsx` client
> component (`CandidateRoundActions` / `DraftPublishAction` /
> `DigestRoundActions`) reuse the existing candidate/technology/digest API
> routes (confirm + 409 readiness inline); no new endpoints, no new persisted
> data. Nav entry (`WorkspaceNav` 控制台 group) + dashboard card +
> `.editorial-round-*` CSS. Verified: typecheck / lint / format / vitest
> 101/101 (5 new) + live workspace pass (real state: 10 undecided, 3 open dup
> groups → candidate step blocked, digest draft → generate done; nav +
> dashboard entries; no 375px overflow; zero console errors). Inline mutations
> were **not** fired in verification — they reuse pre-existing unit-covered
> endpoints, and firing them would be making the owner's editorial decisions.
> Docs updated: README, CHANGELOG, architecture, page-structure, next-task.
> **Next actual step**: none predefined — remaining backlog is 生产化评估,
> dev-server 退出根因, content growth, and the next editorial round (which the
> new console now streamlines).

> Update 2026-07-22 (earlier): **Weekly review page shipped
> (`/digest/weekly`)** — owner-selected from the backlog ("周回顾页"), scope
> locked upfront via `AskUserQuestion` + a mockup + a low_priority-tail
> comparison diagram (route `/digest/weekly`, natural week Mon–Sun + past-week
> archive, priority grouping, **no low_priority** — option B). A public,
> time-boxed sibling of the daily digest and a **pure derived view** (no new
> persisted data, no AI): new `src/lib/weekly-review.ts`
> (`getWeeklyReview(weekKey?)` + `getWeeklyReviewArchive`) buckets published
> signals into natural weeks (UTC math over the plain `YYYY-MM-DD` publish
> dates), classifies each with the same `evaluateTechnologyPriority` the rest
> of the site uses, and groups into 立即关注 / 值得跟踪. Two routes:
> `/digest/weekly` (current week + four-number summary + empty state + folded
> archive) and `/digest/weekly/[week]` (canonical Monday key, `notFound()` for
> non-canonical/empty). Shared `WeeklyReviewContent` component, dossier styling
> (`.weekly-review-*` CSS on `--dossier-*` tokens), cross-links only (本周回顾
> on `/digest` + the digest 订阅简报 block — no nav entry). Verified: typecheck
> / lint / format / vitest 96/96 (6 new tests) + live pass (populated week = 8
> cards + archive; current week empty state; non-canonical key 404; both
> cross-links; dossier tokens resolve; no 375px overflow; zero console errors).
> Data note found live: signals carry their **source** publish dates, so the
> current calendar week is often empty while past weeks are full; also
> `evaluateTechnologyPriority` classifies nearly all complete+important
> published signals as `high_priority`, so 值得跟踪 is usually 0 — both are
> real data characteristics, not bugs. Docs updated: README, CHANGELOG,
> project-spec, page-structure, security-boundary. **Next actual step**: none
> predefined — remaining backlog is 编辑轮控制台, 生产化评估, dev-server 退出
> 根因, content growth, and the next editorial round.

> Update 2026-07-21 (latest): **Editorial round #2 — first pass over the
> expanded source pool** (16 undecided candidates from the 5 new
> sources). Dispositioned all 16: **3 converted + published** — Kimi K3
> (`kimi-k3`, important：Moonshot 2.8T 旗舰、承诺 07-27 开放权重，源为
> Simon Willison 深度分析，锚定 模型与输出评估 + 模型选型), Copilot
> 代码审查复盘 (`copilot-code-review-tool-workflow-lessons`, signal：
> 「更好的工具反而更差，指令才是关键」，与 Shippy 同类的负面结果工程
> 复盘), Gemini API Managed Agents 扩展
> (`gemini-managed-agents-background-mcp`, important：后台任务 + 远程
> MCP 直连，接住 tech-mcp 图谱)；**6 reviewed** (bioresilience 方向
> 声明、Willison GPT-5.6 分析已有一手信号、GitHub 文档案例、
> sqlite-utils rc2 轶事、Nano Banana 2 Lite 与 harness 基准均时效已
> 过)；**7 rejected**（Google 消费级公告 ×3、教育项目、DNS 教程、
> sqlite-utils 4.0 非 AI 信号、A24 合作）。新源信噪比确认：16 条中
> 3 条可发布（19%）——比旧两源池噪声更高，营销类为主，处置从严即可。
> 13 对类型化关系写入；反向 ids 补到 4 技术 + 4 技能 + 4 知识记录，
> 其中 **skill-tool-integration / skill-model-evaluation /
> knowledge-model-sizing / knowledge-tool-use / knowledge-api-contracts
> 五个种子首次 copy-on-write 覆盖**。今日简报（已发布）未回改——三条
> 新信号将进入明早 08:05 自动生成的简报草稿。信号池 15→18。候选池
> 清零。**Next actual step**: 明早自动草稿生成后的编辑轮只需
> edit-and-publish；其余 backlog 见下条。

> Update 2026-07-21 (earlier): **Scheduled digest draft shipped** —
> owner-selected proposal 5 from the backlog. The task runner now
> generates today's digest draft automatically
> (`src/lib/scheduled-digest.ts`, `config/scheduled-digest.json`, a
> structural sibling of scheduled-import: same nextRunAt-advance model,
> default 08:00 Asia/Shanghai, managed from a new 定时简报草稿 panel on
> `/workspace/delivery/schedules` + `PATCH
/api/workspace/scheduled-digest`). Key rules: skips when the day
> already has a digest (never touches editor work), drafts only (publish
> stays editor-gated), failed generation → runner pass `partial` with
> `nextRunAt` still advanced (no watch-mode hot loop). Caveat learned
> during design: the daily time must be ≤ the Windows Task Scheduler
> trigger time (08:05) or generation degrades to every-other-day —
> in-pass ordering (import → digest) is by code, not clock, so both
> default to 08:00. `validate:tasks` pins a disabled config + asserts
> the skip message. Verified: typecheck / lint / format / vitest 90/90 /
> validate:tasks, isolated LOCAL_DATA_DIR pass covering generate /
> not-due / already-exists branches, schedules-page panel live. From
> tomorrow's 08:05 task on, the editorial round starts from an
> already-generated draft. **Next actual step**: none predefined — the
> backlog holds the next editorial round (16 new candidates), content
> growth, weekly review page, round console, production-readiness
> assessment, and the dev-server exit root cause.

> Update 2026-07-21 (earlier): **Topic-level RSS + follow transfer shipped
> (P4 v0.3)** — the zero-unseal outcome of the "追踪能力" gap discussion
> (owner decision: no email subscription, no accounts; deepen tracking
> inside the existing boundary; email is sequenced after production
> deployment if ever). New `/topics/[tagId]/feed.xml` (published signals
> only, 404 for unknown/signal-less topics, `src/lib/topic-feed.ts`),
> 订阅此话题 block on the topic hub, per-followed-topic feed links on the
> 我关注的 view, and 导出关注/导入关注 (comma-separated 关注码 via
> clipboard/prompt, canonical-id validation, merge on import). Docs
> updated: README, CHANGELOG (P4 v0.3 entry), project-spec,
> page-structure, security-boundary. Verified: typecheck / lint / format /
> vitest 90/90, live feed XML (7 items, escaped), 404 case, both entry
> points, zero console errors. Note: the Browser pane's screenshot tool
> times out this session (page itself responsive; DOM checks used
> instead). **Next actual step**: none predefined — the backlog holds the
> next editorial round (16 new candidates), content growth, the three
> product proposals (weekly review page / round console / scheduled digest
> draft), the production-readiness assessment, and the dev-server
> exit root cause.

> Update 2026-07-21 (earlier, same session): **Source pool expanded 5→10**
> (owner-selected direction "补内容宽度", all five reachable candidates
> taken after a 12-feed reachability test — this machine's overseas
> connectivity gates source choice; Anthropic has no public RSS, and
> Meta / Mistral / LangChain / vLLM-blog feeds are unreachable or
> dead). New sources: Google DeepMind Blog, Google AI Blog, Qwen Blog,
> GitHub Blog AI, Simon Willison Blog (the cleaner `/atom/entries/`
> full-post feed). All five imported successfully (default 4 items per
> run; DeepMind's first attempt hit the same transient github-side
> "fetch failed" and succeeded on retry). **Qwen caveat**: the
> `qwenlm.github.io` feed works but is a stale mirror (newest post
> 2025-09) and the new qwen.ai site exposes no feed — source kept
> enabled for auto-recovery, its 4 stale 2025 candidates rejected.
> Editorial candidate pool now holds **16 undecided** items from the
> new sources (Kimi K3, GPT-5.6 family analysis, Nano Banana 2 Lite /
> Gemini Omni Flash, GitHub agentic workflows, DeepMind bioresilience,
> ...). **Next actual step**: a rich next editorial round — expect more
> noise than the old 2-blog pool (marketing posts from Google/GitHub
> feeds), so dispositions will need a firmer hand.

> Update 2026-07-21 (earlier): **Editorial round run**, per
> `docs/editorial-round-playbook.md`. Dispositioned all 7 undecided
> candidates: **2 converted + published** — Hugging Face 安全事件披露
> (`hf-security-incident-agentic-intrusion`, critical, 当日头条：首例
> 公开实证的自主智能体驱动生产入侵，锚定 agent-security /
> agent-observability 技能与对抗性评估知识，关联 GPT-Red 与 Shippy) 和
> NeMo Automodel × Diffusers 规模化微调
> (`nemo-automodel-diffusers-finetuning`, important，锚定新建的
> 模型微调技能与合成数据知识，关联 NVIDIA Nemotron 数据信号)；**2
> reviewed-not-selected** — OpenAI CFO scorecard（观点型无工件，同 IBM
> 路由文先例）、Dharma-AI OCR 复盘（社区自家模型，工件三个月前已发布）；
> **3 rejected** — OpenAI teens 政策文、Cars24 营销案例、Ollama
> v0.32.1（补丁版本，v0.32.0 信号已覆盖主线）。8 对类型化关系 + 附注
> 写入；反向 related-ids 补到 3 技术 / 3 技能 / 2 知识记录（slug 全部
> 保留）。**2026-07-21 简报已发布**：安全事件置顶为头条，GPT-Red 与
> Inkling 作为 07-19 简报已覆盖信号排除，编辑摘要主题「攻与防的
> 智能体化」；发布门槛零阻塞零警告。公开面验证 10 项全绿（详情页、
> digest/today 头条、news 已收录链接、feed.json、search、timeline、
> 反向关联页），无内部字段泄漏，console 零错误，typecheck 干净。
> 发布信号池 13→15。候选池清零。注意：dev server 在轮前又一次自行
> 退出（与 07-19 相同），preview_start 重启后脚本重跑即可，无部分
> 写入。**Next actual step**: none predefined — more content growth,
> the next daily round, or a new owner initiative.

> Update 2026-07-20 (earlier): **Fourth content round — the biggest yet:
> 2 skills + 2 knowledge**, owner-selected from a gap analysis (all four
> proposed options taken). Authored and published through the workspace
> APIs with full typed relations + notes, zero publish-gate warnings:
> 技能「智能体可观测性与评测运维」(`agent-observability-evaluation-ops`,
> operations/hot — the first skill under tag-observability; anchored to
> Shippy / ChatGPT Work / NVIDIA Nemotron / GPT-Red), 技能「模型微调与
> 后训练定制」(`model-finetuning-post-training`, anchored to Inkling /
> Nemotron, requires 合成数据 + MoE knowledge), 知识「推测解码与推理
> 加速技术」(`speculative-decoding-inference-acceleration`, explains
> both vLLM signals + GPT-5.6 + Ollama), 知识「长时程智能体的记忆与
> 上下文管理」(`agent-memory-context-management`, explains ChatGPT
> Work / Shippy / Ollama). 22 typed relation pairs written; reverse
> related-ids added on 9 technology records + 2 skill records (incl. a
> first copy-on-write override of seed `skill-agent-design`) — all
> partial PATCHes preserved slugs. Pools: skills 9→11, knowledge 15→17.
> Also this session: the 2026-07-20 scheduled import ran (partial: 2/5
> sources ok, 3 GitHub-release sources failed — likely transient, worth
> a look next round) and left **6 undecided candidates** (all
> 2026-07-20: HF NeMo Automodel finetuning, HF security incident
> disclosure, HF "Newer Models Same Advantage", OpenAI scorecard /
> teens / Cars24), committed separately as the import-state commit.
> Known pre-existing UI limitation, **fixed in a follow-up commit the
> same session** (owner-chosen): the skill/knowledge detail pages
> hardcoded a generic 附注 on related-item cards instead of rendering
> the stored relation note — now the real note renders with the generic
> copy as fallback (see CHANGELOG → "Detail-page relation notes
> rendered for real"). **Next actual step**: the next daily editorial
> round has material waiting — 6 undecided candidates plus the 3 failed
> sources to check.

> Update 2026-07-19 (earlier): **Third content round** — two
> more knowledge entries authored and published through the workspace
> APIs with full typed relations, zero publish-gate warnings:
> 「对抗性评估与红队方法」(`adversarial-evaluation-red-teaming`, explains
> GPT-Red, supports the new agent-security skill, extends 模型与输出评估)
> and 「副语言信号与语音交互」(`paralinguistics-voice-interaction`,
> explains VoiceEQ and GPT-Live, supports 实时语音交互设计). Reverse
> related-ids added on three technology records and two skill records —
> all partial PATCHes preserved their slugs, confirming the
> slug-preservation fix from the previous round. Knowledge pool 13→15.
> Note: the dev server had died between rounds (ECONNREFUSED) — the
> script failed cleanly on its first request with no partial writes;
> restarted via preview_start and re-ran. **Next actual step**: none
> predefined — more content growth or the next daily editorial round.

> Update 2026-07-19 (earlier, same session): **Second content round + a
> real bug fix.** Two new entries authored and published through the
> workspace APIs with full typed relations, zero publish-gate warnings:
> 技能「智能体安全与提示注入防御」(`agent-security-injection-defense`,
> anchored to GPT-Red / Shippy / ChatGPT Work) and 知识「混合专家模型
> （MoE）架构」(`moe-architecture`, anchored to Inkling / vLLM v0.25.0).
> Reverse related-ids added on five technology records so their detail
> pages surface the new entries. Pools: skills 8→9, knowledge 12→13.
> Adding those reverse ids exposed a real pre-existing bug:
> `updateTechnologyWorkspaceRecord` regenerated the slug from the
> **original English title** on any partial update that omitted `slug`
> (the edit form always sends it, so the UI never hit this) — five
> published signals' slugs were clobbered mid-round, restored, and the
> workflow fixed to keep the existing slug when `slug` is absent (see
> CHANGELOG → "Partial-update slug preservation fix"). Full gate re-run
> green (typecheck / lint / format / vitest 90/90) plus live checks on
> all five slugs, both new entry pages, search, and digest.
> **Next actual step**: none predefined — more content growth or the next
> daily editorial round.

> Update 2026-07-19 (earlier, same session): **All 65 untyped relations
> typed** (`3b89a10`) — the first real content round through LinkRelation
> v1, right after it shipped. Enumerated every content-graph edge still
> falling back to generic 关联 (extracted from `/network`'s RSC payload;
> note the payload double-escapes quotes and renders absent notes as
> `"$undefined"`): 65 of 119 edges — the 12 workspace-published
> technology signals (4 links each), the four 07-16 workspace
> skill/knowledge entries, and two untyped seed skill↔knowledge pairs
> (模型选型↔模型评估, 延迟权衡↔试点范围). Wrote type + note for each via
> `PUT /api/workspace/relations` (18 batches). The whole graph now
> carries explicit semantic types; re-scan shows zero untyped edges, and
> detail pills / skill pages / `/network` edge labels spot-checked.
> **Next actual step**: none predefined — candidates are more content
> growth or the next daily editorial round.

> Update 2026-07-19 (later, same session): **LinkRelation v1 shipped** —
> typed relation editing, the one item Skill/Knowledge workspace editing
> v0 explicitly deferred. Owner confirmed three scope decisions upfront
> (after a form mockup): all three workspace editors including the
> technology draft form, copy-on-write over the 56 seed relations, and
> both relation type + note editable. New
> `src/lib/link-relation-workflow.ts` (store
> `config/link-relation-workspace.json`, **unordered-pair-keyed**
> overlay; pure cores with 13 vitest tests; sync rule: seed-equal values
> and empty generic defaults are never persisted, so reverts clean the
> store), `PUT /api/workspace/relations`, shared `RelationCheckboxItem`
> (relation select + note unfold via CSS `:has`, forms stay uncontrolled;
> new-entry forms keep plain checkboxes until first save), and
> `content.ts` reads converged on the merged `getAllLinkRelations()` view
> (`findRelationBetween`, `buildRelationItems` — previously
> direction-sensitive — and `getContentGraph`, now one merged read per
> graph build). `LinkRelation.note` became optional. Live-verified: the
> Inkling draft's four relations set to 必备/延伸/借助 + notes through the
> real form, public detail pills/notes + `/network` edge types confirmed,
> and a seed-pair override → revert round-trip leaving the store empty.
> Verified with typecheck, lint, format, vitest 90/90, zero console
> errors. Docs updated: README, CHANGELOG, data-model, page-structure,
> project-spec, security-boundary. **Next actual step**: none predefined —
> remaining candidates are more content growth (the new editors now
> support full typed relations) or the next daily editorial round.

> Update 2026-07-19: **Editorial round run** (`2114a6f`), per
> `docs/editorial-round-playbook.md`. Dispositioned all 9 undecided
> candidates (effective status resolved through
> `candidate-review-state.json` — the raw snapshot showed 22 but 13 were
> decided in earlier rounds): **4 converted + published** — Inkling
> (Thinking Machines 开源 1T 参数 / 41B 激活多模态 MoE，critical，当日头条,
> `thinkingmachines-inkling`), GPT-Red (OpenAI 自博弈自动红队, `gpt-red`),
> Real World VoiceEQ (Hume AI 语音「人性质量」基准, `real-world-voiceeq`),
> Shippy 工程复盘 (Ai2，signal 级, `ai2-shippy-agent-lessons`); **1
> reviewed-not-selected** — IBM 模型路由文（观点型，无发布工件）; **4
> rejected** — Ollama v0.32.1-rc0（预发布 RC）、OpenAI 政策文、AI 投资管理与
> 销售案例两篇营销文。All four signals passed the publish gate with zero
> blocking errors and reference the new workspace skill/knowledge entries
> (VoiceEQ ↔ 实时语音交互设计, Inkling ↔ 推理服务容量规划 / 混合推理架构).
> **2026-07-19 digest published**: Inkling pinned as lead, stale GPT-Live
> excluded (covered in earlier digests), Shippy manually added, editorial
> summary themed 「开源追平与安全补课」. Public surfaces verified (4 detail
> pages, digest/today + by-date, news 已收录 links, feed.json, search,
> timeline) — no internal-field leaks, zero console errors, typecheck
> clean. Verification note: a raw-HTML grep for `candidate-` prefixes
> false-positives on every technology page because public technology ids
> legitimately embed their source-candidate id (e.g. the compare widget's
> option values) — scan for truly internal strings (`rawPayload`,
> `importStatus`, `priorityScore`, editorial-note text) instead. Published
> signal pool 9→13. **Next actual step**: none predefined — candidates
> remain LinkRelation v1, more content growth, or the next daily round.

> Update 2026-07-16 (later, same session): **Dark-mode contrast
> completion round shipped**, owner-reported (界面文字与背景颜色相近看不清).
> A both-scheme WCAG contrast scan traced it to the 2026-07-15 dark round
> covering only the seven `--dossier-*` tokens — components on older
> generic tokens or hardcoded light-mode colors were "half dark" (worst
> 1.16:1). CSS-only fix in the dark media block: generic root tokens now
> also redeclared under the dark `.dossier` scope, hardcoded leftovers
> remapped to dossier tokens, three marginal values nudged one step
> (dark `--dossier-stamp`, light `--dossier-muted`,
> `--workspace-nav-active`), and the Internal Workspace gets an opaque
> light board behind `.workspace-shell` in dark mode. Re-scanned to zero
> across 11 public routes + workspace in both schemes. Full writeup:
> `docs/design-system.md` → "Dark-mode contrast completion round";
> CHANGELOG entry added. Verification note for future sessions: the
> scanner's gradient-averaging approximation can report false positives
> on pages whose body gradient has a strong corner tint — confirm via the
> element's real background chain before fixing.

> Update 2026-07-16: **Skill/Knowledge workspace editing v0 shipped**,
> owner-approved after choosing the content-side direction (功能全但内容薄)
> and reviewing a design mockup; three scope decisions were confirmed
> upfront (seed entries editable via copy-on-write runtime overrides,
> draft/published status flow with a minimal publish gate, v0 edits
> related-content ids only — typed `LinkRelation` editing deferred to v1).
> Landed as four commits: store + workflow layer with 16 vitest tests
> (`src/lib/skill-workflow.ts` / `knowledge-workflow.ts`,
> `config/skill-workspace.json` / `knowledge-workspace.json`), API routes
> under `/api/workspace/{skills,knowledge}`, workspace pages
> (`/workspace/skills`, `/workspace/knowledge` + `new` + `[id]`, nav and
> breadcrumb entries), and public wiring (`getAllSkills` /
> `getAllKnowledge` serve the merged view with drafts filtered; the
> previously seed-direct reads in `content.ts` — `getSkillBySlug` /
> `getKnowledgeBySlug`, `resolveTitle` / `resolveSlug`, `getContentGraph`
> — were converged onto them). See `CHANGELOG.md` → "Skill/Knowledge
> workspace editing v0" for the full writeup. Live-verified end to end
> (draft hidden → publish → visible on index/detail/search; seed override
> public; 409 readiness on blocked publish; zero console errors); vitest
> 77/77. Same session, earlier: the 2026-07-15 daily digest quiet-day
> round was published (no candidates needed decisions; vLLM v0.24.0
> excluded as superseded). **Next actual step**: none predefined — natural
> follow-ups to propose to the owner are a v1 for typed `LinkRelation`
> editing, or using the new consoles to grow the real skill/knowledge
> pools (content work, not code). Content growth has since started (same
> day): four real entries authored and published through the new
> consoles — 技能「推理服务容量规划」「实时语音交互设计」, 知识
> 「合成数据与数据配方」「本地与云混合推理架构」— all grounded in the
> nine published signals, zero publish-gate warnings.

> Update 2026-07-15 (later still, same day): **Topic hub shipped —
> `/topics/[tagId]`.** Same session as the nav simplification below,
> owner-directed after reviewing a page mockup and a separate index-page
> mockup — the index page was explicitly declined (no `/topics` listing, no
> global nav entry; the hub is a pure drill-down destination). New
> `getTopicHub(tagId)` in `src/lib/topic-hub.ts` merges a tag's published
> technologies (newest-first), tagged skills, tagged knowledge, and its
> direct `getContentGraph()` neighbors (excluding nodes already in the
> three lists, each carrying its edge's relation-type label) into one page;
> `notFound()` for an unknown tag or one with no content anywhere. The only
> entry point: a new "查看专题" link on every `FollowableTagList` chip
> (technology/skill/knowledge detail pages) — the generic `TagList` used
> everywhere else (index cards, related-item cards, search results, digest
> cards) was deliberately left untouched, per an explicit scope check
> during planning (turning every tag pill site-wide into a link was a much
> bigger, unconfirmed change). See `CHANGELOG.md` → "Topic hub" for the
> full writeup. Verified with typecheck, lint, format, vitest 61/61, and a
> live pass (tag-inference: 6 signals + 10 graph neighbors; tag-ai-agents:
> all four sections including directly-tagged skills/knowledge; unknown tag
> → real 404; zero console errors). **Next actual step**: none predefined —
> both items surfaced in this session's UI-simplification discussion (nav
> merge and topic hub) are now done.

> Update 2026-07-15 (later still, same day): **Nav simplification —
> /news, /timeline, /radar folded into /technologies as view tabs.**
> Owner-directed after reviewing a before/after nav mockup and a live
> comparison of the current `/timeline`/`/network` pages: the public nav had
> grown to 10 items, and three of them (今日快讯, 时间线, 我的雷达) were just
> different filters/groupings over the same published-technology data, not
> independent destinations. `/technologies` now reads a `?view=` query param
> (`news`/全部快讯, `timeline`/按话题, `followed`/我关注的, default 精选) and
> renders a tab strip plus one of `TechnologyBrowser` (unchanged), the new
> `NewsFeedSection`/`TopicTimelineSection` components (extracted verbatim
> from the old pages), or the existing `MyRadarContent` (reused as-is).
> `src/app/{news,timeline,radar}/page.tsx` are now one-line redirects to the
> matching `?view=`. The 搜索 nav link became an inline search icon/box in
> `TopNav` (still GETs to the untouched `/search` page). Nav is now 6 public
> items. Confirmed before starting that every CSS class used by the moved
> JSX was already unscoped, so no selector rewrites were needed. See
> `CHANGELOG.md` → "Nav simplification" for the full file list. Verified
> with typecheck, lint, format, vitest, and a live pass on all four
> `?view=` values, the three redirects, the search toggle, and the four
> repointed cross-page links. **Next actual step**: none predefined — this
> closes out the owner's nav-simplification request. (The `/topics/[tagId]`
> topic-hub proposal discussed the same session has since shipped too — see
> the update above.)

> Update 2026-07-15 (later still, same day): **Deferred `tilt`-prop cleanup
> done.** The `DossierCard`/`DossierTechnologyCard` `tilt` prop and every
> call site's `cardTilts` cycling array (flagged as dead code in the
> `/network` polish update below) are now removed for real:
> `dossier-card.tsx`, `dossier-technology-card.tsx`, `technology-browser.tsx`,
> `my-radar-content.tsx`, `src/app/digest/page.tsx`,
> `src/app/knowledge/page.tsx`, `src/app/skills/page.tsx`, and
> `src/app/page.tsx` — 8 files, net -64 lines, no visual change. Verified
> with typecheck, lint, and format:check (all clean). **With this, the
> tracked code-debt list is empty again** and there is no predefined next
> step — the owner should pick the next initiative.

> Update 2026-07-15 (later still, same day): **`/network` polish round —
> node overlap fixed, edge crossings dimmed, relation-type legend added.**
> Owner reported the graph "felt chaotic" and got worse when zoomed.
> Measured before touching anything: 44 overlapping node-label pairs at
> desktop width (33 labels, avg. ~112px wide, in a 568×568px canvas), 93
> pairs at a narrower simulated-zoom width — the force layout's
> ideal-distance formula never accounted for actual label footprint.
> Fixed by making nodes small kind-colored dots by default (11-15px),
> full title label only on hover/selection/an active search match (not
> general filter-match, to avoid recreating the crowding for a filtered
> category with a dozen-plus nodes). Re-measured: zero overlapping dots.
> Same-day follow-up: measured edge crossing density separately (789
> crossing pairs among 88 edges) and dimmed edges to rest at low opacity,
> with a selected node's own edges popping to full accent-color opacity;
> also added a relation-type legend (必备/关联/渊源/…) to the panel,
> derived live from the real edge data. Also same day, separately:
> `DossierCard`'s resting tilt was removed in favor of a flat rest state
> (three mockup directions compared first) — `tilt` prop and each call
> site's `cardTilts` array were **deliberately left in place, now inert**
> (CSS-only fix); removing that prop plumbing from `technology-browser.tsx`,
> `my-radar-content.tsx`, `digest/page.tsx`, `knowledge/page.tsx`,
> `skills/page.tsx`, `dossier-technology-card.tsx`, and `page.tsx` is the
> one concrete piece of low-risk deferred cleanup left on the books. See
> `CHANGELOG.md` (three separate entries, same day) and
> `docs/design-system.md` → "Dossier direction" for the full writeups of
> each. All verified with typecheck, lint, format, vitest 61/61, and live
> passes; one verification detour worth knowing about for future sessions
> using this browser automation tool: CSS transitions can appear frozen
> mid-value in this environment because the automation tab reports
> `document.hidden === true` (browsers throttle transition timelines in
> backgrounded tabs) — use `Element.getAnimations().forEach(a =>
a.finish())` before reading `getComputedStyle` if a transitioned value
> looks wrong. **Next actual step**: no predefined product task remains.
> The dossier migration (all rounds), dark mode, and this `/network`
> polish pass are all closed out — tree is clean, everything committed.
> Either do the deferred `tilt`-prop cleanup above, or the owner should
> pick the next initiative; nothing here should be assumed or started
> without asking first.

> Update 2026-07-15 (later the same day): **Dark mode shipped for the
> dossier direction**, owner-decided as system-preference-only
> (`prefers-color-scheme: dark`) — no manual toggle, no persisted state.
> Since almost every dossier rule already routes color through the seven
> `--dossier-*` custom properties, the whole scope repaints from one
> `@media (prefers-color-scheme: dark) { .dossier { ... } }` block
> redeclaring those seven values, no changes needed elsewhere. Live
> verification caught a real scoping gap first: `TopNav` (outside
> `.dossier`, shared with the Internal Workspace) and the `body`
> background gradient (visible as gutters beside `.main-content` on wide
> viewports) both used hardcoded light colors — theming only `.dossier`
> would have shipped a dark page under a still-light nav bar. Both got a
> dark variant too; `TopNav`'s applies unconditionally, so Workspace pages
> pick it up as well (harmless next to the already-dark rail). See
> `CHANGELOG.md` → "Dossier direction — dark mode (system preference
> only)" and `docs/design-system.md` → "Dossier direction" → "Dark mode
> (system preference only, 2026-07-15)" for the full writeup. Verified
> with typecheck, lint, format, vitest 61/61, and a live pass forcing both
> color schemes via browser emulation (zero console errors in either,
> light mode unchanged). **With this, the entire open-question list from
> the dossier migration is closed** — both `/network` and dark mode are
> done. **Next actual step**: none predefined; this is a natural point to
> pick a new initiative.

> Update 2026-07-15: **`/network` adopted the dossier direction**,
> owner-authorized as the follow-up scoped after the homepage round below
> (dark/light theming was explicitly deferred — not part of this round).
> `ContentNetworkGraph` was rewritten from its fixed three-lane layout to
> a hand-written force-directed simulation (repulsion + spring edges +
> centering, ~150-frame relaxation), plus search-highlight, a category
> filter, hover-over-edge relation labels, and node dragging — the three
> enhancements confirmed in the original design session, minus zoom/pan
> (stayed out per that same decision). Two real bugs were found and fixed
> during live verification: a `Math.cos`/`Math.sin`-driven hydration
> mismatch (fixed with an SSR-safe integer grid for first paint, trig
> scatter applied client-only post-hydration), and an implicit-AND bug
> where combining node-selection with search dimmed the whole graph to
> nothing when they didn't overlap (fixed to a union). See `CHANGELOG.md`
> → "Dossier direction adoption — /network (force-directed rebuild)" and
> `docs/design-system.md` → "Dossier direction" → "Adopted pages" for the
> full writeup. Verified with typecheck, lint, format, vitest 61/61, and
> a live pass (fresh-tab reload confirmed zero hydration errors, mobile
> width without overflow, console clean). **With this, the whole
> User-facing Product is on the dossier system** — only the Internal
> Workspace remains on the original look, by design. **Next actual
> step**: there is no predefined next step. Dark/light theming is still
> the one open, undecided question for this whole direction — a future
> session should ask before starting it, rather than assume either way.

> Update 2026-07-14 (same night, sixth and final adoption round):
> **Dossier direction migration complete.** The homepage (`/`) is the last
> page in the original adoption order — `HomeTechnologyCard`,
> `SkillPathCard`, `KnowledgePathCard`, and the digest summary card
> (page-specific, unshared) now use `DossierCard` / `DossierStampTag` /
> `DossierCatalogNote`; the news-row list stays CSS-reskinned only since
> `DossierRegisterRow` can't carry `target="_blank"` for its external
> links. See `CHANGELOG.md` → "Dossier direction adoption — homepage
> (migration complete)" and `docs/design-system.md` → "Dossier direction"
> → "Adopted pages" for the full history of all six rounds. Every page in
> the original migration-cost plan now renders the "编辑桌" look:
> `/`, `/technologies` (+ `[slug]`), `/skills` (+ `[slug]`), `/knowledge`
> (+ `[slug]`), `/timeline`, `/digest` (+ `today` + `[date]`), `/search`,
> `/radar`, `/news`. **Not migrated, and not part of that plan**:
> `/network` (needs its own hand-written force-directed graph treatment,
> not a card swap — see design-system.md "Decided specifics") and the
> entire Internal Workspace (by design, keeps its own dark console look).
> Verified with typecheck, lint, format, vitest 61/61, and a live pass on
> every page in the list plus a `/network` regression check. **Next
> actual step**: there is no predefined next step for this initiative —
> dark/light theming is the one open question left, and `/network`'s
> adoption is new scope; both need explicit direction from the owner
> before starting.

> Update 2026-07-14 (same night, fifth adoption round): **Dossier
> direction adopted on `/radar` and `/news`** — closing out the "each need
> one new state" pages from the original plan. `MyRadarContent` swaps
> `TechnologyListCard` for `DossierTechnologyCard`, safe since
> `MyRadarContent` is only rendered by `/radar` (home page's own
> `TechnologyListCard` usage is separate and untouched); `/news`'s
> `NewsCard` swaps to `DossierCard`, the same treatment `/search` already
> got. See `CHANGELOG.md` → "Dossier direction adoption — /radar & /news"
> and `docs/design-system.md` → "Dossier direction" → "Adopted pages" for
> the full description. Verified with typecheck, lint, format, vitest
> 61/61, and a live pass (follow/unfollow filtering still works, no
> console errors, no overflow at 375px, home page confirmed unaffected).
> **Next actual step**: the homepage, last, since it aggregates every
> other component already migrated. Dark/light theming is still
> undecided — don't start it without asking first.

> Update 2026-07-14 (same night, fourth adoption round): **Dossier
> direction adopted on `/digest`, `/digest/today`, `/digest/[date]`, and
> `/search`.** The digest archive uses `DossierCard`/`DossierStampTag`
> directly; the shared `DailyDigestContent` (public digest pages + the
> workspace preview route) gained `DossierCard` for its cards,
> `DossierStampTag` for badges, and `DossierCatalogNote` for the
> "为什么重要" block; `/search` got `DossierCard` results and an inlined
> icon-pill search box (server GET-form, not the controlled
> `DossierSearchInput`). Caught and fixed a real bug this round: the
> workspace digest-preview route rendered borderless/invisible cards at
> first because it's wrapped in `WorkspacePageShell` (no `.dossier`
> ancestor) — fixed by putting `dossier` on `DailyDigestContent`'s own
> root div instead of relying on an ancestor shell, mirroring how
> `TechnologyDetailContent` already does it. See `CHANGELOG.md` →
> "Dossier direction adoption — digest & search" and
> `docs/design-system.md` → "Dossier direction" → "Adopted pages" for the
> full description. Verified with typecheck, lint, format, vitest 61/61,
> and a live pass on all four public routes plus the workspace preview
> route. **Next actual step**: `/radar` + `/news`, then the homepage last.
> Dark/light theming is still undecided — don't start it without asking
> first.

> Update 2026-07-14 (same night, third adoption round): **Dossier
> direction adopted on `/timeline`** — `DossierRegisterRow`'s first real
> use. Each topic's chronological entry list now renders as a ledger of
> register rows (date + title + source-name tag) instead of the
> rail-and-dot connector list; the entry summary renders as a plain
> paragraph underneath since `DossierRegisterRow` only covers the compact
> line. See `CHANGELOG.md` → "Dossier direction adoption — /timeline" and
> `docs/design-system.md` → "Dossier direction" → "Adopted pages" for the
> full description. Verified with typecheck, lint, format, vitest 61/61,
> and a live pass (10 topics, newest-first order per topic, links resolve,
> mobile width without overflow, console clean). **Next actual step**: the
> digest pages and search, then `/radar` + `/news`, homepage last.
> Dark/light theming is still undecided — don't start it without asking
> first.

> Update 2026-07-14 (later that night): **Dossier direction adopted on
> `/skills`, `/skills/[slug]`, `/knowledge`, `/knowledge/[slug]`.** Second
> adoption round, right after the technology pages below. These four routes
> hand-roll their own markup per route (no shared card/section component
> across them), so `DossierCard` / `DossierStampTag` / `DossierCatalogNote`
> were used directly in each `page.tsx` — no new page-specific components
> needed this round. `RelationshipGraph`, `TagList`, `FollowableTagList`,
> and `RelationDensity` needed zero changes: the CSS written for the
> technology round already covers their shared classnames. See
> `CHANGELOG.md` → "Dossier direction adoption — skills & knowledge" and
> `docs/design-system.md` → "Dossier direction" → "Adopted pages" for the
> full description. Verified with typecheck, lint, format, vitest 61/61,
> and a live pass on all four pages plus a regression check on home,
> `/radar`, and the technology pages. **Next actual step**: the topic
> timeline (`/timeline` — `DossierRegisterRow`'s first real use), then
> digest + search, then `/radar` + `/news`, homepage last. Dark/light
> theming is still undecided — don't start it without asking first.

> Update 2026-07-14 (night): **Dossier direction adopted on the technology
> list and detail pages.** Following the migration order from the earlier
> design-session update below, the staged component slice is now wired
> into real pages — see `CHANGELOG.md` → "Dossier direction adoption —
> /technologies" and `docs/design-system.md` → "Dossier direction" →
> "Adopted pages" for the full description. In short: the list page uses
> `DossierSearchInput` + `DossierCategoryChips` + a new
> `DossierTechnologyCard`; the detail page uses a new
> `DossierRelatedItemsSection` (the "附注" cross-reference notes — the
> feature this whole direction was designed to prove) plus `DossierStampTag`
> for the hero pill; the three AI widgets and `RelationshipGraph` got a CSS
> reskin instead of a fork, since they're still shared with not-yet-migrated
> pages. Verified with typecheck, lint, format, vitest 61/61, and a live
> dev-server pass. **Next actual step**, per the design-system.md adoption
> order: skills/knowledge detail + index pages, then the topic timeline
> (`DossierRegisterRow`'s first real use), then digest + search, then
> `/radar` + `/news`, homepage last. Dark/light theming for this direction
> is still undecided — don't start it without asking first.

> Update 2026-07-14 (evening): **UI direction exploration + copy tone
> fixes.** Owner asked for a full visual-identity exploration of the
> User-facing Product; three directions were mocked up in HTML/CSS against
> every public page type and the "编辑桌" (dossier/archival) direction was
> selected and fully specified — see `docs/design-system.md` → "Dossier
> direction (staged)" for the complete spec (palette, type, `/network`'s
> hand-written force-directed graph, search/filter components, adoption
> order). A first slice of six reusable components shipped
> (`src/components/dossier-*.tsx` + a `.dossier`-scoped block in
> `globals.css`), verified but **not wired into any real page yet** — the
> next actual step is assembling them into `/technologies` +
> `/technologies/[slug]` first (see the design-system.md section for the
> full order). Separately, the exploration surfaced a real bug worth
> fixing immediately rather than staging: the `RelationType` label
> vocabulary and a few other public-facing strings read like translated
> English. That got fixed for real this session (not staged) — see
> `CHANGELOG.md` → "Copy tone fixes". Both pieces verified with
> typecheck/lint/format/vitest 61/61 green, plus live browser checks.

> Update 2026-07-14 (later same day): three more discoverability slices
> shipped after search — **digest archive** (`/digest`, month-grouped index
> of published digests), **topic timeline** (`/timeline`, published
> technology signals grouped by tag as chronological lists), and unit test
> coverage for `searchPublicContent` (`src/lib/search.test.ts`, first
> `vi.mock` usage in this repo). Each landed as its own commit per the
> one-page-per-task rule; see `CHANGELOG.md` → "Digest archive" / "Topic
> timeline" for details. Also new: `docs/editorial-round-playbook.md` — a
> step-by-step checklist (with API call equivalents) for the recurring
> "review new candidates → publish signals → publish digest → verify"
> round, distilled from actually running that round twice today. Read it
> before doing another editorial round instead of re-deriving the steps.
> All four changes verified with typecheck/lint/format green and vitest
> 61/61.

> Update 2026-07-14: **Public site-wide search v0 shipped** (owner-authorized
> after the news fast lane; scope aligned upfront: graph three types + news,
> server-rendered `?q=`, title/summary/tags matching only). New public
> `/search` page (「搜索」 in `TopNav`), `src/lib/search.ts`
> (`searchPublicContent`, deterministic case-insensitive AND matching), and a
> `.search-*` CSS block; news results reuse the `src/lib/news.ts` mapping and
> always render the 自动聚合 disclaimer, so no new candidate→public mapping
> point was created. Verified with typecheck, lint, and a live pass (CN/EN
> queries, multi-term AND, disclaimer, mobile width, console clean). See
> `CHANGELOG.md` → "Site-wide search". Also on 2026-07-14: the Windows Task
> Scheduler daily task `ai-tech-radar-tasks` (08:05) was registered and
> test-run on the owner's machine — the deployment.md manual step is done, so
> daily imports now run unattended.

> Update 2026-07-13: **News fast lane + scheduled import v0 shipped**
> (owner-authorized, "content freshness/volume" direction — see
> `CHANGELOG.md` → "News fast lane & scheduled import" for the full entry).
> Two pieces: (1) public `/news` (今日快讯, in `TopNav`, plus a home board)
> renders the last 7 days of imported candidates through the new sanitizing
> map `src/lib/news.ts` — the single candidate→public mapping point, with
> rejected/fallback/non-primary-duplicate exclusion and a fixed
> 自动聚合，未经编辑精选 disclaimer; (2) the task runner now runs a scheduled
> daily source import (`src/lib/scheduled-import.ts`,
> `config/scheduled-import.json`, default 08:00 Asia/Shanghai, no fallback
> placeholders on unattended runs), managed from
> `/workspace/delivery/schedules` (定时导入 panel +
> `PATCH /api/workspace/scheduled-import`), with Windows Task Scheduler
> setup documented in `docs/deployment.md`. `validate:tasks` pins a disabled
> import config during validation so it never triggers live imports. The
> curated signal/digest tier and its editorial gate are unchanged
> (two-tier content model, recorded in `docs/project-spec.md` →
> "Scheduled Import + News Fast Lane v0" and `docs/security-boundary.md` →
> "News Fast Lane Boundary").

> Update 2026-07-10: Workspace UI localization v0 shipped — all Internal
> Workspace UI chrome is now Chinese (see `CHANGELOG.md` → "Navigation, IA &
> design system"). The follow-up diagnostic-string pass shipped the same
> day (owner-chosen): ranking reasons/warnings, publish & digest readiness
> messages, import / delivery / schedule / task-runner messages, and
> operations statusReasons / attention items are now generated in Chinese,
> with the asserting vitest tests and validate scripts updated to match
> (all 22 validators green). Historical English messages already persisted
> in `config/` are intentionally left as-is (audit data); they age out as
> new records are written. The digest _generation_ copy (default digest
> title/summary/editorial-note templates, which feed public content) was
> localized the same day as the final slice, with the two published real
> digests backfilled to the new Chinese titles/summaries. Still English by
> design: workflow event action codes and data content itself.

> See `docs/roadmap.md` for the high-level plan. P1 (visual pass) and P2
> (knowledge relationship network) are both done. P3 (AI-assisted
> understanding) has completed its agreed candidate list: Compare (v0),
> Explain (v1), and the graph-grounded learning path (v2) have all shipped
> (the last two on 2026-07-05, owner-authorized). P4 (personalization) was
> owner-authorized on 2026-07-09 and its v0 — the followed-topics personal
> radar at `/radar`, localStorage-only, deterministic Ranking v0 grouping —
> has shipped (see "Personal radar (done)" below), followed the same day by
> the owner-chosen v0.1 — the detail-page follow entry (see "Detail-page
> follow entry (done)" below) — and v0.2 — the personalized digest view
> (see "Personalized digest view (done)" below). Any further P3 or P4
> capability is new scope to be proposed by the owner per capability. The
> tracked code-debt list is empty: the store-decomposition pattern has been
> applied to every file it was planned for, the ESLint/Prettier config has
> shipped, and the SQLite storage-model decision has been made (document
> store by design — see `docs/decisions.md`). The first real
> content-production rounds have also run: five real external sources are
> configured, and five enriched real signals (gpt-live, vllm, ollama, plus
> gpt-5-6 and chatgpt-work from the 2026-07-10 round) and the 2026-07-09 /
> 2026-07-10 digests are published. The 2026-07-10 round also added the
> canonical tag `tag-frontier-models` (前沿模型), dispositioned all 10 open
> candidates (2 published, 2 reviewed-not-selected, 6 rejected including 4
> fallback placeholders and 2 stale May quality fixtures), and closed the
> last open duplicate group.

> Done since last update: vitest test setup + unit tests (ranking, publish
> readiness, dedup, digest), CI workflow (`.github/workflows/ci.yml` running
> typecheck + test), the first three refactor passes on `candidate-workflow.ts`,
> all three originally-planned store extractions from `candidate-workflow.ts`
> (duplicate-group, technology-workspace, imported-candidate snapshot), a
> Workspace visual-confirmation pass (found and fixed a breadcrumb bug on
> `/workspace/delivery` and `/workspace/operations` sub-pages), the
> `digest-store.ts` extraction from `digest-workflow.ts`, Compare two
> technologies (P3 v0, see `CHANGELOG.md`), a second Workspace
> visual-confirmation pass covering `/workspace` dashboard,
> `/workspace/duplicates` (list + detail), `/workspace/operations` (+ events),
> and `/workspace/technologies` (list + detail) at desktop and mobile widths —
> found and fixed a real CSS specificity bug where `.detail-layout` and
> `.candidate-review-layout` sidebars overlapped the main content on mobile
> (≤900px) instead of stacking below it, affecting `/workspace/duplicates/[id]`,
> `/workspace/candidates/[id]`, `/workspace/sources/[id]`, and
> `/workspace/technologies/[id]` — the `candidate-workflow.ts` →
> `technology-draft-workflow.ts` extraction (resolving the "harder cut" this
> file used to flag as needing fresh analysis), and the `sqlite-store.ts`
> decomposition into twelve per-domain files plus `sqlite-primitives.ts` (see
> below) — every file originally flagged for this decomposition pattern has
> now had it applied. Also found (via a `validate:*` regression sweep, not
> caused by this work) and flagged a pre-existing `npm run validate:delivery`
> failure for separate follow-up. Most recently: a user-facing
> visual-confirmation pass covering `/digest/today`, `/digest/[date]`,
> `/skills` (index + detail), and `/knowledge` (index + detail) at desktop and
> mobile widths — checking layout stacking, horizontal overflow, an
> internal-field leak scan of rendered text, and console errors. No new bugs
> found this round; this empties `docs/page-structure.md`'s "pages left for
> later UI migration" list entirely.

Recommended next task:

Every file originally flagged for the store-decomposition pattern
(`candidate-workflow.ts` → `technology-draft-workflow.ts`, `digest-workflow.ts`
→ `digest-store.ts`, `sqlite-store.ts` → twelve domain files) is now done, and
every page ever flagged for visual confirmation (workspace and user-facing)
has had its desktop+mobile pass — see the sections below for each. The
linting/formatting config (ESLint + Prettier) has also shipped — see "ESLint +
Prettier config (done)" below. The SQLite storage-model decision has also been
made and recorded (2026-07-05): the driver stays a document store by design —
see `docs/decisions.md` → "SQLite Storage Model" and the storage-model note in
`docs/database-migration.md`. With that, the tracked code-debt list is empty.

Most recently (2026-07-05): **Explain at the reader's level (P3 v1)** shipped —
see `CHANGELOG.md` → "AI-assisted understanding" for the full description. It
is a deliberate structural clone of Compare v0: new
`src/lib/technology-explanation.ts` (workflow + `toPublicExplanationResult`
public strip), `technology-explanation-store.ts` (cache keyed
`technologyId::audienceLevel` in `config/technology-explanations.json`),
`llm/prompts/technology-explanation.ts`,
`llm/technology-explanation-output.ts` (validator on the shared
`output-sanitization.ts` helpers), a `technology_explanation` `PromptVersion`
purpose with default, a mock-provider branch, public
`POST /api/technologies/explain`, and the `TechnologyExplainWidget` on
`/technologies/[slug]` (between 技术背景 and 谁该关注, reusing the compare
widget's CSS). Verified with typecheck, lint, format:check, vitest 45/45 (14
new tests), and a live end-to-end pass in the dev server (widget renders, POST
returns the public-safe shape with the disclaimer, provider metadata absent
from the response, cache record written).

That learning-path candidate has now shipped too (2026-07-05, same day,
owner-authorized): **Graph-grounded learning path (P3 v2)** — see
`CHANGELOG.md` → "AI-assisted understanding". New
`src/lib/technology-learning-path.ts` (workflow + `toPublicLearningPathResult`
public strip), `technology-learning-path-store.ts` (cache keyed by
`technologyId` in `config/technology-learning-paths.json`),
`llm/prompts/technology-learning-path.ts` (feeds the technology's related
knowledge/skills — titles + summaries — into the prompt and instructs the
model to build steps on them by name), `llm/technology-learning-path-output.ts`
(overview + steps required, checkpoints optional), a
`technology_learning_path` `PromptVersion` purpose with default, a
mock-provider branch that references real related item titles, public
`POST /api/technologies/learning-path`, and the `TechnologyLearningPathWidget`
on `/technologies/[slug]` (between the editor-curated 学习路径 section and
the relationship graph, reusing the compare widget's CSS). Verified with
typecheck, lint, format:check, vitest 54/54 (9 new tests), and a live
end-to-end pass (steps reference the real related knowledge「API 契约与接口
边界」and skill「智能体工作流设计」for tech-mcp; disclaimer renders first in
the result; provider metadata absent from the response; cache record
written). One bug was found and fixed during live verification: the mock's
title extraction missed because the prompt labels include "(from the content
graph)" — the regex label now escapes it, and the stale ungrounded cache
record was deleted before re-verifying.

With that, **the agreed P3 candidate list (Compare → Explain → learning path)
is complete.** There is no predefined next task: further P3 capabilities are
new scope for the owner to propose, and P4 (personalization) still requires
explicit authorization.

The pre-existing `npm run validate:delivery` fixture mismatch flagged above is
now fixed: the script's fixture digest title (`Delivery validation digest ...`)
and summary contained the word "validation", which `getPublicDigestTitle` /
`getPublicDigestSummary` (`src/lib/public-copy.ts`, added later by the UI
refactor's public-copy sanitization) intentionally rewrite into generic public
digest copy — so the feed-title assertions failed against the sanitized output.
The fixture copy was renamed to public-safe wording (`Public delivery digest
...`); the sanitizer behavior itself was correct and unchanged.

## Progress so far

`candidate-workflow.ts` has gone from 1763 to 744 lines via six pure,
behavior-preserving extractions (each verified with `npm run typecheck` and
`npm run test`):

- `src/lib/candidate-duplicate-rules.ts` — pure duplicate-detection rules and
  identity helpers (URL/title normalization, token similarity, reason rules,
  stable group id, primary-candidate selection).
- `src/lib/workspace-record-normalizers.ts` — text/field/localized-text
  normalization.
- `src/lib/candidate-conversion-mapping.ts` — candidate → draft field mapping
  (type, publisher, tags, draft text, source reference).
- `src/lib/candidate-duplicate-store.ts` — `DuplicateGroupStore`/
  `DuplicateAnalysis` types, `readDuplicateGroupStore`,
  `writeDuplicateGroupStore`, and `analyzeDuplicates`. `candidate-workflow.ts`
  now imports these three functions instead of defining them; the higher-level
  getters (`getDuplicateGroupCandidates`, `updateDuplicateGroup`,
  `getDuplicateComparisonsForCandidate`) stayed put as planned, since they call
  back into candidate getters and would create a circular import otherwise.
- `src/lib/candidate-technology-workspace-store.ts` — `TechnologyWorkspaceStore`
  type, `normalizeTechnologyWorkspaceRecord` (private), `readTechnologyWorkspaceStore`,
  and `writeTechnologyWorkspaceStore`. Deliberately narrower than the original
  plan's wording ("...and the record getters/updaters"): the getters/updaters
  (`getTechnologyWorkspaceRecords`, `updateTechnologyWorkspaceRecord`, publish/
  archive transitions, candidate→draft conversion, etc.) turned out to be
  woven through ~500 lines of cross-cutting logic (workflow events, publish
  readiness, candidate conversion) rather than a self-contained cluster like
  the duplicate-group getters were. Moving all of that in one step risked a much
  larger, higher-risk change than the "one cluster per commit" rule intends, so
  only the clean store layer moved this round.
- `src/lib/candidate-import-snapshot-store.ts` — `sanitizeImportedCandidate`
  (private), `buildFallbackSnapshot` (private), `readImportedCandidateSnapshot`,
  `writeImportedCandidateSnapshot`, `getImportedCandidateSourceId`, and
  `mergeImportedCandidatesForSource`. `getImportedCandidateSourceId` and
  `mergeImportedCandidatesForSource` were previously re-exported through
  `candidate-workflow.ts` for `source-workflow.ts`'s benefit; updated
  `source-workflow.ts` to import them directly from the new module instead of
  keeping a re-export hop.

## Remaining clusters to extract

1. ~~Duplicate-group store.~~ Done — see above.
2. ~~Technology-workspace store (read/write/normalize layer).~~ Done — see
   above.
3. ~~Imported-candidate snapshot store.~~ Done — see above.
4. ~~Technology-draft-workflow (record getters/updaters, publish/archive
   transitions).~~ Done — see "technology-draft-workflow.ts extraction" below.

All four clusters are extracted. `candidate-workflow.ts` no longer has an
obvious further cluster to pull out — see "Recommended next task" above.

## technology-draft-workflow.ts extraction (done)

`candidate-workflow.ts` went from 834 to 549 lines (285 lines moved, plus 4
dead imports removed — `topicTags`, `getImportedCandidateSourceId`,
`mergeImportedCandidatesForSource`, and the `CandidateNormalizedType` /
`ImportedCandidateSourceRecord` types had been left behind by earlier
extractions and were no longer referenced anywhere in the file).

The step 2 entry above previously described this as needing "fresh dependency
analysis" to decide whether "candidate → draft conversion" and "draft
publish/archive transitions" could split into two modules. That framing
turned out to be the wrong cut. Conversion (`convertImportedCandidateToDraft`,
`getCandidateDraftConversionReadiness`) is inherently a _candidate-side_
operation — its primary side effect is mutating candidate review state, which
is private to `candidate-workflow.ts` — so it cannot be separated from
candidate review without exposing that private state. But conversion and
publish/archive turned out **not** to depend on each other in the direction
that matters: publish/archive/CRUD on `TechnologyWorkspaceRecord` never reads
candidate or duplicate-group data, so _that_ half is a clean, self-contained
cut. Conversion keeps one call into it (`getTechnologyWorkspaceRecordById`,
for idempotency) — a one-directional import, not a cycle.

- `src/lib/technology-draft-workflow.ts` — `TechnologyWorkspaceRecordUpdate`,
  `getTechnologyWorkspaceRecords`, `getTechnologyWorkspaceRecordById`,
  `getTechnologyDrafts`, `getTechnologyDraftById`,
  `getPublishedTechnologyWorkspaceRecords`,
  `getTechnologyWorkspacePublishReadiness`, `updateTechnologyWorkspaceStatus`,
  `updateTechnologyWorkspaceRecord`, `publishTechnologyWorkspaceRecord`.
  `candidate-workflow.ts` now imports only `getTechnologyWorkspaceRecordById`
  back from it (used once, in `convertImportedCandidateToDraft`'s idempotency
  check).
- Confirmed via grep before moving anything: every external consumer of these
  functions (`src/lib/content.ts`, `src/lib/editorial-enrichment.ts`, and six
  `src/app/**` page/route files) already imported them independently of any
  candidate/duplicate-group function — none needed a mixed import split
  except `src/app/workspace/page.tsx` and `src/lib/content.ts`, which had one
  function from each module in the same `import` statement and needed
  splitting into two.
- 10 `scripts/validate-*.ts` files also imported these functions directly
  (via relative paths, not the `@/` alias) and needed the same redirect;
  4 of them had a mixed A/B import needing a split.
- Verified with `npm run typecheck`, `npm run test` (31/31), and all 10
  affected `npm run validate:*` scripts (candidates, content-intelligence,
  database, duplicates, editorial-enrichment, llm-enrichment, persistence,
  prompt-quality, ranking, workflow-hardening) — all passed unchanged. Also
  live-checked `/workspace/technologies`, a technology draft detail page, and
  the public `/technologies` list (which reads through `content.ts`) — all
  rendered identical real data with no console errors.

## digest-workflow.ts decomposition (done)

`digest-workflow.ts` has gone from 887 to 787 lines via one extraction,
following the exact same pattern:

- `src/lib/digest-store.ts` — `DailyDigestStore` type, `getTodayDateString`,
  `getDefaultDigestTitle`, `uniqueIds`, `normalizeDigest`,
  `readDailyDigestStore`, and `writeDailyDigestStore`. Unlike the
  candidate-workflow extractions, several of these (`getTodayDateString`,
  `uniqueIds`) are small pure helpers used throughout the _rest_ of
  `digest-workflow.ts`'s business logic too, not just inside the store
  functions — they moved along with the store because they have no
  dependencies of their own, and `digest-workflow.ts` now imports them back
  from `digest-store.ts` rather than duplicating them.
- `getTodayDateString` was previously re-exported through `digest-workflow.ts`
  for three external consumers (`src/app/digest/today/page.tsx`,
  `src/app/workspace/digests/page.tsx`,
  `src/app/api/workspace/digests/generate/route.ts`); updated all three to
  import it directly from `digest-store.ts` instead of keeping the re-export.
- Verified with `npm run typecheck`, `npm run test` (19/19 including
  `digest-workflow.test.ts`'s 6 tests), and live reads of `/digest/today`,
  `/workspace/digests`, a digest detail page, and the home page's digest card
  — all rendered correct real data with no console errors.

`digest-workflow.ts` still has real business logic left (digest generation,
readiness evaluation, item-control mutations, publish transitions) — this was
a single clean cut, not a full decomposition of the file.

## How to do it safely

- One cluster per commit; keep extractions as verbatim code-motion (no logic
  changes).
- Push lower-level (store) modules so they do not import `candidate-workflow.ts`;
  pass data in as parameters to avoid circular dependencies.
- Check for other files importing the symbols being moved (e.g.
  `source-workflow.ts` imported two functions from `candidate-workflow.ts` that
  moved in step 3) — update those imports to point at the new module directly
  rather than leaving a re-export hop.
- After each step run BOTH `npm run typecheck` and `npm run test` locally.
  Vitest runs fine in some working environments (verified for steps 1-3: 19/19
  tests green each time) but CLAUDE.md documents a constrained Cowork sandbox
  where `tsx`/`vitest` cannot run — if that's the environment in use, fall back
  to `npm run typecheck` plus a manual smoke test of the affected workspace
  pages (e.g. `/workspace/duplicates`, `/workspace/technologies`,
  `/workspace/candidates` and `/workspace/sources`' "Import enabled sources"
  action for the three clusters done so far) before committing.

## sqlite-store.ts decomposition (done)

`sqlite-store.ts` went from 1308 to 681 lines via one extraction pass covering
all twelve domains at once (unlike the `candidate-workflow.ts` cut, every
domain here follows the exact same shape — a `read<X>Store`/`write<X>Store`
pair keyed by JSON filename in a central dispatch switch — so there was no
per-domain risk analysis needed, just mechanical, verbatim code motion times
twelve):

- `src/lib/repositories/sqlite-primitives.ts` — `SqliteDatabase` type and the
  generic per-table helpers (`selectPayloads`, `clearTables`, `getTableCount`,
  `runSqliteTransaction`, `getTimestamp`, `parsePayload`) every domain file
  depends on.
- Twelve `src/lib/repositories/sqlite-<domain>-store.ts` files — one per
  `readSqliteJsonStore`/`writeSqliteJsonStore` switch case (external source,
  imported candidate, candidate review state, duplicate group, technology
  workspace, daily digest, delivery, scheduled delivery, task runner,
  workflow event, editorial enrichment, prompt version). See
  `docs/database-migration.md`'s Repository Boundary section for the full
  list and import direction (domain files never import each other or
  `sqlite-store.ts` back).
- `sqlite-store.ts` keeps: driver/path resolution, `openSqliteDatabase`,
  `initializeSqliteDatabase`/`resetSqliteDatabase`, `getSqliteSchemaStats`,
  the `initializeSqliteSchema` DDL block (left untouched — it's one atomic
  `exec()` call defining all tables together, not twelve separable pieces),
  `seedStaticContent`, the dispatch table itself, `migrateJsonStoresToSqlite`,
  and the three `readSqlite*` static-content readers.
- Verified with `npm run typecheck`, `npm run test` (31/31), and — since this
  refactor specifically touches the SQLite driver code path that vitest
  doesn't exercise — `npm run validate:database` (the primary correctness
  gate for this change) plus 16 other `npm run validate:*` scripts, all
  passing unchanged. One unrelated pre-existing failure was found during this
  sweep (`npm run validate:delivery`, confirmed broken identically on the
  commit before this refactor via `git stash`) and flagged separately rather
  than fixed inline — not caused by this change.

## Personal radar (done)

P4 v0, owner-authorized and shipped 2026-07-09 (scope choices confirmed with
the owner: tags-only follows, priority-grouped radar). New public `/radar`
page ("我的雷达" in `TopNav`): `src/lib/followed-tags.ts` (localStorage
helpers + change event), `src/components/my-radar-content.tsx` (tag toggle
chips, deterministic Ranking v0 grouping, per-item 命中关注 line, guided
empty states, reusing `TechnologyListCard`), `src/app/radar/page.tsx`, and a
small `my-radar__*` CSS block on existing tokens. No accounts, no server
profile, no AI ranking — see `docs/project-spec.md` → "Personal Radar
(P4 v0)". A content defect was found and fixed during verification: the
three real published signals used freeform tag strings instead of canonical
`TopicTag` ids, so tag matching (and card tag rendering) missed them; a new
canonical `tag-inference` (推理与部署) was added to `src/data/tags.ts` and
the three records were re-tagged. Verified with typecheck, lint,
format:check, vitest 54/54, and a live end-to-end pass (follow toggles →
grouped matches with explanation lines → persistence across reload → mobile
width without overflow → zero console errors).

## Personalized digest view (done)

P4 v0.2, owner-chosen and shipped 2026-07-09 (scope aligned via upfront
questions: highlight + optional filter, light hint for readers with no
follows, hidden sections + total empty state when the filter matches
nothing). `DailyDigestContent` became a `"use client"` component (same
pattern as `technology-detail-content.tsx`) and now renders: a
personalization bar between 今日概览 and the signal sections (已关注 N /
命中 M + 只看我关注的 toggle, or a one-line `/radar` hint when no follows),
per-item 命中关注 lines reusing `my-radar__match-line`, client-side section
filtering with per-section hiding, and a guided zero-match empty state with
a 查看全部内容 reset. Enabler: `rssFeedPath` / `jsonFeedPath` moved to the
new dependency-free `src/lib/feed-paths.ts` (re-exported from
`digest-delivery.ts`) because the client component must not import the
fs-backed digest workflow. New `.daily-digest-personal-bar` CSS block.
Verified with typecheck, lint, format:check, vitest 54/54, and a live pass
on `/digest/today` covering all four states (highlight, filter with all
matched, zero-match empty state + reset, no-follows hint) plus mobile width
and console checks.

## Detail-page follow entry (done)

P4 v0.1, owner-chosen and shipped 2026-07-09 (scope aligned via upfront
questions: followable chips in the body tags section only, all three detail
pages, chip state + radar link feedback, hero tags stay static). New shared
client component `src/components/followable-tag-list.tsx` renders an item's
tags as the same follow/unfollow toggle chips as `/radar` (reusing
`my-radar__tag-toggle` styles and `src/lib/followed-tags.ts`), plus a hint
line ("点击话题，将它加入我的雷达" / "已加入我的雷达 · 查看" linking to
`/radar`). Adopted in the tags section of `technology-detail-content.tsx`,
`src/app/skills/[slug]/page.tsx`, and `src/app/knowledge/[slug]/page.tsx`;
hero and related-card tags stay on the static `TagList`. Small
`.followable-tag-list` CSS block next to the my-radar styles. Verified with
typecheck, lint, format:check, vitest 54/54, and a live pass on all three
detail pages (toggle both directions with localStorage + hint sync, mobile
width without overflow, no new console errors).

## ESLint + Prettier config (done)

Previously the "Add linting/formatting config" item under "Later"; now shipped
(see `CHANGELOG.md` → "Developer tooling" for the full description). In short:
flat-config ESLint 9 (`eslint.config.mjs`, `next/core-web-vitals` +
`next/typescript` + `eslint-config-prettier`), Prettier calibrated to the
existing house style (`trailingComma: "none"`, `endOfLine: "auto"` for the
CRLF working tree), `lint` / `lint:fix` / `format` / `format:check` scripts,
and four dead-code removals surfaced by the first lint pass. `npm run lint`
is clean; verified with `npm run typecheck`, `npm run test` (31/31),
`validate:database`, and `validate:digest`. Note for future sessions:
`registry.npmjs.org` was unreachable from this machine (TLS reset), so the
dev dependencies were installed via `registry.npmmirror.com` with the
owner's approval and `package-lock.json` `resolved` URLs normalized back to
the official registry (integrity hashes are identical between the two).

## SQLite storage-model decision (done)

Previously the last "Later" item ("decide whether the SQLite driver should
move from JSON-blob storage to real relational tables, or be documented
honestly as a document store"). Decided 2026-07-05 with the owner: **the
driver stays a document store, documented honestly.** Analysis confirmed the
driver's reads/writes move whole domain stores (`SELECT payload` /
clear-and-reinsert) exactly matching the JSON-file contract, and no business
code queries the denormalized key columns. A relational move would require
per-record repository semantics across every workflow module — production
database work `AGENTS.md` keeps out of scope — while the default JSON driver
kept the old semantics. Recorded in `docs/decisions.md` → "SQLite Storage
Model", with aligned wording in `docs/database-migration.md` and
`docs/data-model.md`. Revisit only when a production database migration is
explicitly authorized.

## Later (not this task)

- (empty — the tracked code-debt list is clear; new product work waits on
  explicit P3/P4 direction from the owner)
