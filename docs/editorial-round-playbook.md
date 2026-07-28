# Editorial Round Playbook

A repeatable checklist for the recurring "check what came in, decide what's a
signal, publish today's digest" loop. This is the practical, step-by-step
companion to the high-level lifecycle already described in
[`docs/project-spec.md`](project-spec.md) → "Data lifecycle" and
[`docs/architecture.md`](architecture.md) → "Lifecycle" — those documents say
_what stages exist_; this document says _what to actually do, in order,
every round_.

The `/workspace/editorial-round` console (shipped 2026-07-22) surfaces this
whole loop on one page — a step tracker plus the undecided candidates, drafts
awaiting publish, and today's digest, each with the inline action described
below — so a round can be driven from there without hopping between
`/workspace/candidates`, `/duplicates`, `/technologies`, and `/digests`. The
heavy editing (writing a draft's zh content, the digest's editorial summary)
still links out to the existing editors. This playbook remains the detailed
reference for _what each step actually does_.

Every step here can be done through the `/workspace/*` UI. This playbook also
gives the equivalent API call for each step, because that is the faster path
when running the round from a terminal/automation context rather than
clicking through pages. Both paths mutate the same local JSON store, so they
are interchangeable — pick whichever is convenient for a given round.

## When to run a round

- After the scheduled daily import runs (`config/scheduled-import.json`,
  default 08:00 Asia/Shanghai; see [`docs/deployment.md`](deployment.md) for
  the Windows Task Scheduler setup that triggers it unattended), there will
  usually be a handful of new candidates worth a look.
- Running it more than once a day is fine — same-day duplicate protection on
  the import side means re-running `tasks:run-once` won't double-import, and
  candidate review state persists between rounds so nothing gets processed
  twice.

## Step 0 — Make sure the local dev server is running (preflight)

Rounds are driven against the running app (the workspace UI and the API
routes), so the dev server must be up first. A recurring gotcha (seen
2026-07-19 and 2026-07-21): the first request of a round fails with
`ECONNREFUSED` even though nothing is wrong with the app.

Root cause (investigated 2026-07-22): the preview `next dev` process is
**session/lifecycle-scoped and does not persist** across sessions or long idle
gaps — so at the start of a new session there is simply **no server running
yet**, not a crash. (Confirmed: no repo script or harness hook kills the server;
restarts always come up clean with no partial writes.) A secondary amplifier is
`autoPort: true` in `.claude/launch.json`: if port 3000 is already held when the
server starts, it silently binds 3001+, so anything assuming 3000 sees a
"dead" server that is really a port mismatch.

Do this at the start of every round:

- Start the server with `preview_start` (config name `dev`) and **use the port
  it returns** — never hard-code `3000`.
- If a request returns `ECONNREFUSED`, the server just isn't running: restart it
  with `preview_start` and re-run. State is safe to re-run — candidate review
  state persists and the stores are only written on completed actions, so there
  are no partial writes to clean up.
- Optional, removes the file-watcher failure vector and aligns with the
  production data-externalization recommendation
  (`docs/production-readiness.md` → B2): point `LOCAL_DATA_DIR` at a directory
  **outside the project tree** for local runs, so the round's rapid
  `config/*.json` writes are not seen by the dev file watcher.

## Step 1 — Find candidates that still need a decision

A candidate needs a decision when its **effective** `importStatus` is `new`.
"Effective" matters: the review-state store
(`config/candidate-review-state.json`) can override the status baked into the
`imported-candidates.live.json` snapshot at import time, so always resolve
through the review state, not the raw snapshot.

- UI: `/workspace/candidates`, filter by import status `new`.
- Script equivalent (read-only, useful for a quick terminal scan):

  ```js
  const snap = require("./config/imported-candidates.live.json");
  const review = require("./config/candidate-review-state.json");
  const cands = snap.candidates ?? snap;

  const undecided = cands.filter((c) => {
    const state = review.items[c.id];
    const effective = state
      ? (state.importStatus ?? state.status)
      : c.importStatus;
    return effective === "new";
  });
  ```

  `review.items` is keyed by candidate id — not an array — so index into it
  directly rather than searching an array.

Also check `/workspace/duplicates` for any open duplicate group before
converting anything; a candidate inside an unresolved group cannot be
converted standalone (see [`docs/architecture.md`](architecture.md) →
"Duplicate Review v1").

## Step 2 — Disposition every undecided candidate

For each one, decide: is this an actual technology signal (a release, a
product launch, a meaningful technical writeup) or noise (a tutorial page, a
marketing landing page, a release-candidate/pre-release tag that's
superseded by its own stable release)?

**Reject** non-signal candidates:

- UI: candidate detail page → `Reject candidate`.
- API: `POST /api/candidates/{id}/status` with body `{"status":"rejected"}`.

**Convert** signal-worthy candidates to a technology draft:

- UI: candidate detail page → `Convert to technology draft`.
- API: `POST /api/candidates/{id}/convert` → returns `{ draftId }`.

Rejecting near-duplicate pre-release tags (e.g. an `-rc0`/`-rc1` candidate
once the corresponding stable tag exists) keeps the technology list from
filling up with redundant version-bump entries — this project does not have
AI/semantic duplicate detection, so use editorial judgment here rather than
converting every tagged release.

## Step 3 — Write the draft's editorial content

A converted draft only has the raw imported title/summary/content in the
source language. Before publishing, fill in the fields that make it a real
signal rather than a re-post:

- localized `title.zh` / `summary.zh` / `content.zh` (Chinese-first per the
  house style — see `CHANGELOG.md` → "Digest generation copy localization")
- `tags`: prefer canonical `TopicTag` ids from `src/data/tags.ts` over
  freeform strings — freeform tags don't resolve to a display name on
  `/radar`, `/search`, or `/timeline`'s topic grouping
- `relatedKnowledgeIds` / `relatedSkillIds`: pick real ids from
  `src/data/knowledge.ts` / `src/data/skills.ts` that the signal actually
  connects to
- `whyItMatters`, `whoShouldCare`, `technicalContext`, `impactAreas`,
  `learningPath`, `relatedKnowledgeExplanations`, `relatedSkillExplanations`,
  `followUpQuestions`, `readingDifficulty` — the Content Intelligence fields
  that make the public technology page useful (see
  [`docs/content-intelligence.md`](content-intelligence.md))
- `importanceLevel`: `signal` / `important` / `critical`, used by
  Ranking v0 alongside recency and completeness

API: `PATCH /api/workspace/technologies/{draftId}` with a JSON body
containing whichever of the above fields you're setting (see
`TechnologyWorkspaceRecordUpdate` in `src/lib/technology-draft-workflow.ts`
for the full field list). UI equivalent: the draft edit form at
`/workspace/technologies/{id}`.

Optionally use Editorial Enrichment (`/workspace/technologies/{id}` →
generate suggestion) to draft these fields instead of writing them by hand;
still requires an explicit Apply before anything lands on the draft (see
[`docs/editorial-enrichment.md`](editorial-enrichment.md)).

## Step 4 — Publish the technology

- UI: draft page → `Publish technology` (runs the Publish Quality Gate;
  blocking errors must be fixed first, warnings are visible but non-blocking
  — see [`docs/project-spec.md`](project-spec.md) → "Publish Quality Gate
  v0").
- API: `POST /api/workspace/technologies/{draftId}/status` with
  `{"status":"published"}`. The response's `readiness.blockingErrors` /
  `readiness.warnings` mirror the UI's gate output.

Repeat steps 2–4 for every candidate worth publishing before moving on —
generate the digest after all of today's signals are already published, not
before, so Ranking v0 sees the full picture.

## Step 5 — Generate the digest draft

- UI: `/workspace/digests` → `Generate digest draft`.
- API: `POST /api/workspace/digests/generate`.

This runs Ranking v0 over all published technologies and buckets today's
qualifying ones into `highPriorityTechnologyIds` / `watchTechnologyIds`. If a
digest for today already exists, regeneration refreshes the generated
sections while preserving any manual pins/exclusions/ordering already made
(see [`docs/data-model.md`](data-model.md) → "DailyDigest").

**Generation is not "today's new signals."** `buildDailyDigestFromTechnologies`
selects the **top 4 high-priority items inside a 90-day lookback window**,
ranked by priority level → priority score → publish date. With ~20 published
signals in the pool, the same few high-scoring items win every day, so a
freshly generated digest usually repeats the previous one and does **not**
contain the signals published minutes earlier in this round. That is expected,
not a bug: Step 6 is where the round's editorial judgment actually happens —
exclude what the last digest already carried, `include` today's new signals,
and `pin` the lead. Every round since 2026-07-19 has done exactly this.

## Step 6 — Apply editorial judgment to the digest

Optional but recommended for the day's clear headline item:

- **Pin** the lead story so it renders first regardless of Ranking v0's
  internal ordering: UI → digest item control `Pin`; API →
  `POST /api/workspace/digests/{date}/items` with
  `{"action":"pin","technologyId":"<id>"}`.
- **Exclude** anything Ranking v0 included that doesn't deserve digest space
  today: same endpoint, `{"action":"exclude", ...}`.
- Write `editorialSummary`: a short paragraph tying the day's items together
  around a theme, not just a list restatement. UI → digest edit form; API →
  `PATCH /api/workspace/digests/{date}` with
  `{"editorialSummary": "...", "editorialNotes": "one internal note per line"}`
  (`editorialNotes` is a single newline-delimited string in the request body,
  even though it's stored as a string array — the route splits it for you).

## Step 7 — Publish the digest

- UI: digest detail page → `Publish digest` (also gated by digest publish
  readiness checks).
- API: `POST /api/workspace/digests/{date}/status` with
  `{"status":"published"}`.

## Step 8 — Verify on the public surfaces

Spot-check that the new content actually renders correctly and nothing
internal leaked through:

- `/technologies/{slug}` — the new signal's detail page
- `/digest/today` — the new item appears, pinned item leads if pinned
- `/news` — the source candidate now shows a "已收录为精选技术信号" link to
  the published technology
- `/feed.json` — today's digest appears in the public feed
- `/search?q=<keyword>` and `/timeline` — the new signal is discoverable
  through both, grouped under the right topic tag on `/timeline` (which
  means the tag ids chosen in Step 3 actually matter for discoverability,
  not just cosmetics)

A quick text scan of the rendered page for internal-only strings
(`rawPayload`, `importStatus`, `priorityScore`, `candidate-` id prefixes) is
a cheap extra check — see [`docs/security-boundary.md`](security-boundary.md)
for the full forbidden-field list.

## Common mistakes this playbook exists to prevent

- Deciding a candidate twice because the check in Step 1 only looked at
  `ImportedCandidate.importStatus` instead of resolving through
  `candidate-review-state.json`.
- Converting a duplicate release-candidate tag alongside its stable release.
- Publishing a technology with freeform tags that never resolve to a display
  name anywhere public.
- Generating the digest before all of the day's technologies are published,
  so a late publish never makes it into the digest without a manual add.
- Skipping Step 8 and finding out via a user report that a leftover raw
  English title or an internal field made it onto a public page.

## API gotchas (hit for real during rounds)

- `PATCH /api/workspace/digests/{date}` expects `editorialNotes` as a **single
  newline-delimited string**, not an array — passing an array returns
  `500 value.split is not a function` (2026-07-27).
- The skill/knowledge PATCH route segments are asymmetric:
  `/api/workspace/skills/{id}` but `/api/workspace/knowledge/{id}` (**no
  trailing `s`**). Guessing `knowledges` returns Next's HTML 404 page, which
  looks like a JSON parse error rather than a routing mistake (2026-07-27).
- `relatedTechnologyIds` **is** editable through
  `PATCH /api/workspace/technologies/{id}` since 2026-07-27 (it was added to
  `TechnologyWorkspaceRecordUpdate` that day — this entry used to say the
  opposite, and was stale from 2026-07-22). Self-references are dropped and
  the picker offers published technologies only. Use `supersedes` (续作) for
  an actual version succession and `extends` (延伸) for "read this next" —
  mixing them mislabels the 版本脉络 section.
- Seed **technologies** (`src/data/technologies.ts`) have no copy-on-write
  overlay the way seed skills and knowledge do, so they cannot carry a
  reverse id back to a workspace-created skill/knowledge entry. The graph
  edge still exists (edges dedupe from either side), only that seed page's
  own 相关技能 / 相关知识 list omits it. Don't "fix" this by editing the seed
  file — bundled seed code referencing a runtime-generated `*-ws-*` id is the
  coupling that produced the 2026-07-28 sqlite parity failure.

## Duplicate detection blind spot (found 2026-07-28)

Duplicate detection only compares against candidates **currently in the
snapshot** (`imported-candidates.live.json`), which is a rolling window — on
2026-07-28 it held 40 candidates while the review state held 97. So a source
that re-publishes an item under a changed URL slug can re-enter the pool with
no duplicate group at all, once its earlier twin has aged out of the snapshot.

That is exactly what happened with the Gemini 3.6 Flash announcement: it was
imported on 2026-07-21 as `…gemini-36-flash…`, converted, and published as
`gemini-flash-cyber`; on 2026-07-28 the same announcement came back as
`…gemini-3-6-flash…` (hyphenated differently) and looked brand new. Neither
the URL rule nor the title rule could fire, because there was nothing left to
compare against.

Practical guard for a round: before converting a candidate that looks like a
major vendor announcement, check whether a **published** signal already
carries the same source URL modulo slug formatting — the review state and the
technology workspace both outlive the snapshot window.
