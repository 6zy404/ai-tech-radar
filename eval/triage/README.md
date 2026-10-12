# Candidate triage evaluation

Measures how well a model predicts what an editor does with an imported
candidate — **publish**, **review** (looked at, not selected) or **reject** —
against the project's own recorded editorial decisions.

## Files

| File             | What it is                                                                | Tracked          |
| ---------------- | ------------------------------------------------------------------------- | ---------------- |
| `dataset.jsonl`  | one decided candidate per line: text, label, decision time, split         | yes              |
| `fewshot.json`   | the 9 examples shown to the model (3 per label, one per source per label) | yes              |
| `results/*.json` | one report per prompt version × model, with every prediction              | yes, real runs   |
| `cache/*.jsonl`  | successful answers, so a run resumes and a re-run costs nothing           | no (git-ignored) |

## Where the labels come from

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
```

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
