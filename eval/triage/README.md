# Candidate triage evaluation

Measures how well a model predicts what an editor does with an imported
candidate — **publish**, **review** (looked at, not selected) or **reject** —
against the project's own recorded editorial decisions.

## Files

| File             | What it is                                                                | Tracked          |
| ---------------- | ------------------------------------------------------------------------- | ---------------- |
| `dataset.jsonl`  | one decided candidate per line: text, label, decision time, split, flags  | no, local only   |
| `fewshot.json`   | the 9 examples shown to the model (3 per label, one per source per label) | yes              |
| `results/*.json` | one report per prompt version × model, with every prediction              | yes, real runs   |
| `cache/*.jsonl`  | successful answers, so a run resumes and a re-run costs nothing           | no (git-ignored) |

## Where the labels come from

**Since 2026-10-15 neither the dataset nor the snapshot it is built from is in
the repository.** Both hold the text of third-party articles, and the
repository is public, so they were removed from every commit of the history
and are git-ignored. They stay on the owner's machine, and the history they
came from is kept in a private bundle there
(`Desktop/ai-tech-radar-full-history-2026-10-15.bundle`). To rebuild the
dataset here, point the script at a clone of that bundle for the history:

```bash
git clone --bare <the bundle> .cache/full-history.git      # once; .cache/ is git-ignored
npm run build:triage-dataset -- --history .cache/full-history.git
```

Since 2026-10-20 the script reads the data directory's live snapshot first —
after 10-15 the snapshot is never committed, so the candidates of every later
round exist only there, until the rolling window drops them — and then walks
the snapshot's commits in the `--history` repository (or `TRIAGE_HISTORY_REPO`,
default: this one). Without either it stops when neither has anything, and
warns when only the live file does. Each row also carries `blind`: decided in
the console's blind mode, as the review state records it.

`config/candidate-review-state.json` records each decision (`converted` →
publish, `reviewed` → review, `rejected` → reject) but **not the candidate
text**, and the candidate snapshot is a rolling window — on 2026-09-23 it held
146 candidates against 629 decisions. Every editorial round committed the
snapshot, though, so `npm run build:triage-dataset` walks the snapshot's git
history (41 commits), keeps the newest copy of each candidate, and joins it to
the decisions at `HEAD`: **625 of 629 recovered**, the other 4 being fallback
placeholders that were never real items.

## Split

By decision time, not at random. Decisions before **2026-08-10** form the
example pool (146); decisions from that date on are the test set (479 —
publish 43 / review 148 / reject 288). A random split would let an example come
from the same editorial round as the item under test.

## Running it

```bash
npm run build:triage-dataset          # only needed after new rounds are committed
npm run eval:triage -- --limit 40     # a sample spread across the whole period
npm run eval:triage                   # the full test split
npm run eval:triage -- --prompt v3 --fresh   # a given prompt on the blind rows
npm run eval:triage -- --prompt v3 --fresh --since 2026-10-13
                                             # … only those decided from a day on
```

`--since YYYY-MM-DD` keeps the rows decided on or after that day; with
`--fresh` that is how a prompt is scored on the blind rounds it was not written
against. The result file carries the date (`…__fresh__since2026-10-13.json`),
and the answer cache is shared with the full runs, so a later full `--fresh`
run re-asks nothing for these rows.

It uses whatever `LLM_*` variables are set (it reads `.env.local`). With the
mock provider it prints numbers but writes no result file — the mock is a
keyword rule, and a committed mock score would read like a model result.

## Baselines, and what the numbers mean

- **Always "reject"** scores **60.1% accuracy with 0% publish recall** on the
  test split. Accuracy alone is therefore close to meaningless here; the
  numbers to read are per-class recall and **publish vs not**.
- **The pre-release rule** (the check the task runner auto-rejects on) fires on
  39 test items; editors rejected 30 of them.

## Results: `candidate-triage-v1` × `deepseek-chat` (2026-09-23)

Full test split, 479 items, 0 failed answers, p50 754ms / p95 1003ms,
730,529 input + 16,674 output tokens.

|                            |       Always "reject" |             Model |
| -------------------------- | --------------------: | ----------------: |
| Accuracy (3-class)         |                 60.1% |         **68.3%** |
| Macro-F1                   |                 0.250 |         **0.524** |
| Reject precision / recall  |          60.1% / 100% |     82.5% / 78.8% |
| Review precision / recall  |                     — |     57.1% / 62.8% |
| Publish precision / recall |                — / 0% | **17.1% / 16.3%** |
| Publish vs not, accuracy   | 91.0% (never publish) |         **85.4%** |

**What it is good for: confident rejections.** 129 items got "reject" at
confidence ≥ 0.9; editors rejected 119 of them (92%) and **published none**.
At ≥ 0.8 it is 212 items, 186 rejected (88%), 1 published. That is 27–44% of
the pool the model can mark as noise with almost no risk of burying a signal.

**What it is bad at: finding what to publish**, and the binary figure says so
plainly — on publish-vs-not it is **worse than never suggesting publish**
(85.4% against 91.0%). It found 7 of 43 publishes. Three things show in the
confusion matrix, all about what the model can see rather than how it reasons:

- **Missed publishes are mostly title-only.** 29 of the 43 published items
  carry no text beyond the title; the model found 1 of them, against 6 of the
  14 that have text. Its reasons say exactly this: "摘要仅一句，无法核对". The
  editor read the article; the model read the feed. The rubric told it to lean
  to review when information is thin, and it did.
- **The Chinese sources score 0 of 20.** Both feeds ship a title and one
  sentence, so this is the same cause concentrated in two sources — and none of
  their decisions were in the example pool.
- **False publishes lean on engine releases.** 10 of the 21 "publish" calls
  the editor rejected are SGLang / ms-swift releases (the rest: 4 InfoQ, 3
  Willison, 3 Ollama, 1 OpenAI). 7 of the 21 were published more than 30 days
  before the editor saw them — the back-catalog that surfaced when the
  per-source cap went from 4 to 12 on 2026-08-10. Each is a real release; what
  made the editor reject it was context the model sees only as a date.

**Not done, deliberately:** tuning the prompt against these findings. Every
change made while looking at this test split would be fitted to it; a v2
prompt needs either a fresh split (decisions after 2026-09-23) or to be judged
on the example pool only.

## First live round (2026-09-24)

The suggestions were used on a real round for the first time: 50 undecided
candidates, 48 with a suggestion (2 requests failed twice with `fetch failed`).
Rows are the round's decisions, columns the model's:

| decision \ model | publish | review | reject | none |
| ---------------- | ------: | -----: | -----: | ---: |
| publish (7)      |       1 |      6 |      0 |    0 |
| review (19)      |       3 |     14 |      1 |    1 |
| reject (24)      |       0 |      4 |     19 |    1 |

34 of 48 agree. **The same two findings as the test split, on new items**:

- **Confident rejections held.** All 18 "reject" suggestions at confidence
  ≥ 0.85 were rejected; they were customer case studies, appointments,
  funding and event PR, the same classes the editor rejects by precedent.
- **Finding what to publish did not.** 1 of 7 publishes was suggested — the
  vLLM release. The other 6 were "review" at 0.55–0.6, and five of the six
  reasons say the summary was too short to check. Every one of them was
  decided on the primary source: two Simon Willison posts, an arXiv paper, a
  Hugging Face post, and two InfoQ articles whose feed entries carry only a
  link. The model read the feed; the round read the articles.
- The 3 "publish" suggestions not taken: a GitHub post on rendering large
  diffs (front-end engineering, not an AI signal), an Ollama patch release
  (one feature), and an OpenAI benchmark announcement whose page returns 403
  here, so it could not be checked.

**This is not a clean second measurement, and it should not be read as one.**
The suggestions were on screen before the decisions were made, so agreement is
inflated by anchoring in an unknown amount; and the round was run by the
agent, not by the editor whose decisions make up the dataset. It shows the
suggestions behave the same way on unseen items. It does not replace a fresh
held-out split.

## Prompt v2: the article, not the feed (2026-09-29)

Both measurements above point at one cause: the model sees the feed, the
editor read the article. `candidate-triage-v2` fetches the primary source
(`src/lib/candidate-article.ts` — `<article>`, else `<main>`, else `<body>`,
chrome stripped, first 1,500 characters) and tells the model to judge on it;
when a page refuses, the prompt says so and why. The v1 prompt text is
unchanged byte for byte, so the numbers above still describe it.

**Scored on a set neither prompt was fitted to.** `build-triage-dataset` now
marks a row `fresh` when it was decided on or after 2026-09-24, was not
auto-rejected by the task runner, and no suggestion was on screen at the time
(no stored suggestion older than the decision, or the decision was made in
the console's blind mode). That is 33 rows — 31 from the 2026-09-28 round,
which ran without suggestions, and 2 from 09-24; the other 51 of that round
were made with suggestions showing and are excluded. Articles were readable
for 29 of 33 (two OpenAI pages answer 403, two GitHub Blog pages render in
JavaScript).

```bash
npm run eval:triage -- --prompt v1 --fresh
npm run eval:triage -- --prompt v2 --fresh
```

| fresh set, 33 items (10 / 6 / 17) | v1 (feed) | v2 (article) |
| --------------------------------- | --------: | -----------: |
| accuracy                          |     57.6% |    **66.7%** |
| macro-F1                          |     0.421 |    **0.566** |
| publish recall                    |  **0/10** |     **8/10** |
| publish precision                 |         — |         8/12 |
| publish vs not, accuracy          |     66.7% |    **81.8%** |
| reject at confidence ≥ 0.85       |     14/14 |        12/13 |
| input tokens per item             |    ~1,520 |       ~2,190 |

v1 found none of the ten publishes, the same failure as both earlier
measurements. v2 found eight. Its errors are boundary calls: two front-end
releases (htmx 4.0, Shopify leaving React Native) suggested for publish on a
site that covers AI engineering, a patch release and an enterprise product
suggested for publish, and several review ↔ reject swaps — the boundary the
labels already disagree on. The two publishes it missed were the GitHub page
it could not read and Gemini 3.8 Live, which it took for a consumer launch.

**How much to trust this.** 33 items from essentially one round, decided by
the agent that later built v2 (reading articles, as v2 now does). It shows the
direction and the size of the effect; it is not a stable number. The console
switched to v2 on the same day because suggestions stay advisory, and every
blind round now adds clean rows to re-check it with.

## Re-check on six blind rounds (2026-10-12)

After the 2026-10-11 round the fresh split holds **254 rows** (publish 33 /
review 63 / reject 158): the 09-24 / 09-28 rows above plus every blind round
from 09-30 to 10-11. 169 of them were decided on or after 2026-09-29, after v2
was written, so they are the part neither prompt was shaped on. 0 failed
answers; v1 used 389k prompt tokens, v2 523k.

| fresh set, 254 items (33 / 63 / 158) | v1 (feed) | v2 (article) |
| ------------------------------------ | --------: | -----------: |
| accuracy                             | **67.7%** |        64.2% |
| macro-F1                             |     0.529 |    **0.564** |
| publish recall                       |      5/33 |    **24/33** |
| publish precision                    |      5/18 |        24/69 |
| publish vs not, accuracy             | **83.9%** |        78.7% |
| reject at confidence ≥ 0.85          |    99/101 |      106/112 |
| — of which actually published        |         0 |            1 |
| only rows decided ≥ 09-29: publish   |      3/16 |    **12/16** |

**The 09-29 finding holds on rows v2 never saw**: reading the article finds
publishes (12 of 16 against 3 of 16). **The cost is precision**: about one
"publish" in three is right, and v2 suggests publish for 45 items the editor
did not. Accuracy and publish-vs-not fall because of those.

Where v2's wrong "publish" calls come from, read from its 17 publish-on-reject
errors: front-end and language releases (htmx 4.0, Swift 6.4, Bun, Changesets,
SolidStart, Linear's StyleX migration) — the prompt never says the site covers
AI only; and second reports of a story the round had already published from
another outlet (DeepSeek DSec, the Ascend kernels, Gemini 4), which the model
cannot know without the published list. Its 9 missed publishes are mostly
pages it could not read (two OpenAI pages answer 403) and one staged launch
(Gemini 4 Argon) it held back.

Confident rejections stay the safe use: at ≥ 0.85, 106 of 112 were rejected
and one was later published (智谱 ZCode's open-sourcing, framed by its source
as an incident). **No prompt change made from this run** — the two error
groups suggest a v3 (state the AI scope; pass recently published titles), to
be judged on blind rounds after it is written, not on these rows.

## Prompt v3: the scope, and what is already on the site (2026-10-12)

`candidate-triage-v3` keeps v2's article reading and changes two things, both
taken from v2's errors in the section above:

- **Scope.** A note that the site covers AI technology only — models, agents,
  inference and deployment, AI engineering tooling, AI research — and that
  front-end frameworks, programming languages and general developer tools are
  `reject` even when the release is substantial.
- **What was already published.** The end of the system prompt lists the
  signals the site published in the 30 days before the decision (Chinese
  title, plus the original when it differs), and a second report of one of
  them is `reject`. The next release of the same line is not. v3's rubric head
  drops 「与已发布内容讲同一件事」 from its `review` examples so the two rules do
  not contradict each other; v1 and v2 keep it, and a test pins both of their
  prompts by hash.

`TRIAGE_PROMPT_VERSION` is still v2: the console does not use v3 yet, and its
call site does not pass titles yet (`runCandidateTriage`'s `publishedTitles`,
filled by `selectRecentPublishedTitles`).

**No future leakage in the eval.** Each row's list is built from the
technology workspace store as of that row's `decidedAt`. A published record
counts from its `createdAt`, the moment its candidate was converted — on all
107 published records that equals the decision time to within 7ms. The row's
own signal is excluded (it would otherwise sit 3ms before its own decision),
and so is the one archived record. Each row saw 15–40 titles, median 32.

```bash
npm run eval:triage -- --prompt v3 --fresh
```

| fresh set, 254 items (33 / 63 / 158)     | v1 (feed) | v2 (article) | v3 (scope + published) |
| ---------------------------------------- | --------: | -----------: | ---------------------: |
| accuracy                                 |     67.7% |        64.2% |              **72.8%** |
| macro-F1                                 |     0.529 |        0.564 |              **0.636** |
| publish recall                           |      5/33 |        24/33 |              **27/33** |
| publish precision                        |      5/18 |        24/69 |              **27/57** |
| publish vs not, accuracy                 |     83.9% |        78.7% |              **85.8%** |
| "publish" on an item the editor rejected |         6 |           17 |                  **5** |
| reject at confidence ≥ 0.85              |    99/101 |      106/112 |                124/135 |
| — of which actually published            |         0 |            1 |                      2 |
| only rows decided ≥ 09-29: publish       |      3/16 |        12/16 |              **15/16** |
| prompt tokens, whole set                 |      389k |         523k |               **890k** |

**This is not a held-out number, and it must not be quoted as one.** v3 was
written after reading v2's errors on exactly these 254 rows; the scope note
names the categories those errors fell into. The run was made once, after the
prompt was committed, and nothing was changed after it. v3 has to be judged on
blind rounds decided after commit `67dc03c`.

What the run shows, read with that in mind:

- **The scope note does what it says.** Of v2's 17 publish-on-reject errors,
  v3 rejects 11 — all six front-end / language releases among them — and still
  suggests publish for 5 (three Ollama releases, the Ascend kernels, RL
  environments on the Hub). Its 30 wrong "publish" calls are now mostly items
  the editor marked _reviewed_ (25), the boundary the labels are loosest on.
- **The published list cuts both ways.** 12 rejections cite an
  already-published signal: 6 were rejected by the editor, 3 reviewed, and **3
  were published** — follow-up reporting on the OpenAI agent incident and a
  roundup that included GPT-6 Sol, judged "the same story" as earlier signals.
  Two of those three were at confidence 0.85, so the confident-reject band is
  no longer clean: 124 of 135 at ≥ 0.85, two of them published.
- **Half of that effect would not exist in the console.** 6 of the 12
  "already published" rejections leaned on a title converted earlier the same
  day, i.e. in the same round. The eval gives each row the list as of its own
  decision; the console generates suggestions before a round starts, so it
  would not have those titles.
- **Cost.** About 3,500 prompt tokens per item against v2's 2,060, almost all
  of it the title list. It sits at the end of the system prompt so the rubric
  and examples stay a cacheable prefix.

## v2 against v3 on rows neither was written against (2026-10-20)

Two blind rounds were decided after v3 was committed: 2026-10-13 (34
candidates) and 2026-10-20 (71). They are the first rows v3 was not shaped on,
and the numbers below are the held-out ones the section above asked for.

**The set.** `--fresh --since 2026-10-13` gives **105 rows: publish 11 / review
61 / reject 33**. 104 are the two rounds' blind decisions; the 105th is the
DeepMind copy of the Gemini 4 Argon launch post, converted as the non-primary
of a duplicate group together with the Google AI Blog copy — one signal, two
rows labelled publish, the second without the blind flag because the group
resolution converted it, but with no suggestion stored, so `fresh` by the
dataset's rule. 35 rows carry no text beyond the title. Articles were readable
for 91 of 105 (12 pages answer 403 — the OpenAI customer stories among them —
and 2 have no readable body). The pre-release rule fires on none: the task
runner's auto-rejections are not fresh rows. **Always "reject" scores 31.4%
here and always "review" 58.1%**: these two rounds marked most of what they saw
_reviewed_ (58%, against 25% of the earlier fresh rows), which moves every
number below and is the first thing to read them against.

**Rebuilding the set.** The dataset grew from 880 to 997 rows, built from the
live snapshot plus the full-history bundle (`--history`): all 34 rows of the
10-13 round came back, 24 of them only from the bundle's 10-13 commit, because
seven later imports had already rolled them out of the snapshot; the 10-20
round's 71 came from the live snapshot. 89 earlier rows changed `publishDate`
by a day (the 2026-10-14 time-zone fix) or their text (the 10-12 entity
repair) because the live copy is the newest; `fewshot.json` was left as
committed, so each prompt is byte for byte the one measured on 10-12. Still
unrecoverable: 11 rows of the 10-11 round, whose snapshot was committed after
the next import had replaced them, and 4 auto-rejected rc tags.

**Cost, estimated before the run and then measured.** Estimate: one call per
row per prompt, 105 × ~2,100 (v2) and 105 × ~3,500 (v3) prompt tokens from
the 10-12 per-row averages, ~600k in all, about ¥1. Measured: v2 213,762 in /
4,120 out, v3 401,968 in / 4,059 out, 106 calls each (one retry), 28 seconds
each at concurrency 4, p50 1.0 s / 0.95 s. v3 ran 9% over its estimate: each
row now sees 36–42 published titles (10-12: 15–40, median 32), the 30-day
window holding more.

```bash
npm run eval:triage -- --prompt v2 --fresh --since 2026-10-13
npm run eval:triage -- --prompt v3 --fresh --since 2026-10-13
```

| rows neither prompt saw                  | held-out, 105 (11 / 61 / 33) |           | 10-12 run, 254 (33 / 63 / 158) |           |
| ---------------------------------------- | ---------------------------: | --------: | -----------------------------: | --------: |
|                                          |                           v2 |        v3 |                             v2 |        v3 |
| accuracy                                 |                        40.0% | **48.6%** |                          64.2% | **72.8%** |
| macro-F1                                 |                        0.404 | **0.455** |                          0.564 | **0.636** |
| publish recall                           |                    **11/11** |      8/11 |                          24/33 | **27/33** |
| publish precision                        |                        11/55 |      8/42 |                          24/69 |     27/57 |
| publish vs not, accuracy                 |                        58.1% | **64.8%** |                          78.7% | **85.8%** |
| "publish" on an item the editor rejected |                            6 |     **0** |                             17 |     **5** |
| "publish" on an item the editor reviewed |                           38 |        34 |                             28 |        25 |
| reject at confidence ≥ 0.85              |                        20/29 |     30/46 |                        106/112 |   124/135 |
| — of which actually published            |                            0 |         2 |                              1 |         2 |
| prompt tokens per row                    |                        2,036 |     3,828 |                          2,060 |     3,500 |

By round: on the 10-13 rows
(34: 3 / 20 / 11) v2 scores 29.4% and v3 52.9%, both find all 3 publishes,
publish-vs-not 61.8% against 79.4%; on the 10-20 rows (71: 8 / 41 / 22) v2
45.1% and v3 46.5%, publish recall 8/8 against 5/8, publish-vs-not 56.3%
against 57.7%.

**What held.** The direction and roughly the size of v3's gain over v2 on
accuracy: +8.6 points here, +8.6 on 10-12; publish-vs-not +6.7 against +7.1.
The scope note still does what it says: v3 suggests publish for **none** of
the 33 rejected items, v2 for 6 — Meta's ZGateway, the Radicle vulnerability,
Python 3.15, Uber's Kubernetes controller, OpenTelemetry's processor going
stable, Google Ads' false positive: engineering, not AI, every one. v3's
reject recall is 32/33.

**What did not.** The publish-recall gain reversed: v2 found all 11, v3 8.
Of the 3 it rejected, 2 are the Gemini 4 Argon launch post, each citing an
already-published signal: the Google AI Blog copy was judged the same release
as the 10-02 signal on Argon's staged launch to security teams (a genuine
miss — the general-availability post was the round's headline), and the
DeepMind copy saw, in its list, the signal the pair had become 18 ms earlier
(the same-round artifact the 10-12 section describes; the console generates
suggestions before a round and would not have it). The third is 量子位's
report of DeepSeek V4.1 Flash 1017, rejected at 0.7 as a second-hand piece
without checkable detail; the editor published it from that report. So the
confident-reject band is not clean here either: 30 of 46 at ≥ 0.85 were
rejected, 2 were published (the Argon pair), 14 were reviewed.

**What neither prompt can do** is the error that dominates this set: 34–38 of
the 61 _reviewed_ items get "publish". Who they are: Transformers releases
(v3: 8 of 13, every one marked reviewed since the source was added on 10-12),
Microsoft Research posts (6 of 9), Hugging Face model posts (5 of 6), InfoQ
(4), 量子位 (3), and the Ollama / MCP / SGLang / ms-swift releases (6). Each
is a real release or a real paper; what made the editor mark it reviewed was
the round's own selectivity — 7–8 published per round — and, for the two new
sources, a back catalogue reaching to July that the round marked reviewed in
bulk. Publish precision is 1 in 5 for both prompts, so on these rounds a
"publish" suggestion is a shortlist to read, not a decision.

**Is v3 worth switching the console to?** On rows it never saw it is better
than v2 on every aggregate — accuracy, macro-F1, publish-vs-not, and above all
zero publishes suggested on rejected items — at 1.9× the prompt tokens
(about ¥0.3 more for a 70-candidate round). It is worse on one thing that
matters, publish recall, by 3 of 11: one artifact that cannot occur in the
console, one debatable call, one real miss on the round's headline. The
case for switching is the scope rule and the already-published rule working
as designed on new rows; the case against is that the headline-size miss comes
from the rule that is v3's whole addition, and that neither prompt moves the
precision that decides how useful a "publish" suggestion is. **This report
does not change `TRIAGE_PROMPT_VERSION`**; that is the owner's call. If the
console switches, `runCandidateTriage`'s call site must pass
`selectRecentPublishedTitles` as of the round's start, and the 「发布」
suggestion should be read as the 1-in-5 shortlist it measured as.

## Known limits, stated up front

- **Label noise on review vs reject.** The 9 pre-release items above that were
  not rejected were marked _reviewed_ — mostly in the 2026-09-06 round — while
  30 of the same kind were rejected. The labels were left as recorded: changing
  them to suit the model would be editing the answer key. Publish vs not is the
  boundary the labels agree on, so it is reported separately.
- **The model sees less than the editor did.** Editors read the article; the
  model sees the feed's title and summary. 74 of the 625 items carry no text at
  all beyond the title.
- **No Chinese-source examples.** The two Chinese-language sources were added
  on 2026-08-10, so all their decisions fall in the test split.
- **The rubric was written with hindsight.** The criteria in the prompt were
  distilled from the playbook and changelog, which were written by the same
  editor across the test period. The time split protects the examples, not the
  rubric.
