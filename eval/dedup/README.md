# Semantic candidate deduplication — how the thresholds were measured

The deterministic duplicate rules (`src/lib/candidate-duplicate-rules.ts`)
compare URLs and **latin** title tokens, so they cannot see two Chinese
headlines about one announcement, nor a 量子位 and an InfoQ piece filing the
same press release in different words. `src/lib/semantic-dedup.ts` adds a
comparison of "title + summary" vectors from the local embedding model
(`Xenova/multilingual-e5-small`, the one search uses). This folder holds what
its thresholds rest on.

## Files

| File               | What it is                                                                                  | Tracked |
| ------------------ | ------------------------------------------------------------------------------------------- | ------- |
| `labels.jsonl`     | 3,531 hand-labelled pairs: `{kind, a, b, label}`, plus `batch` on every pair labelled later | no¹     |
| `unlabelled.jsonl` | pairs some grid threshold flags that have no label (`--unlabelled`)                         | no      |

¹ Local only since 2026-10-15: each pair carries two candidates' titles and
summaries, third-party text the public repository should not carry. It was
removed from every commit and is git-ignored; the owner's machine keeps it.

```bash
node scripts/run-ts.cjs scripts/measure-semantic-dedup.ts               # the tables below
node scripts/run-ts.cjs scripts/measure-semantic-dedup.ts --unlabelled  # also list what needs a label
node scripts/run-ts.cjs scripts/measure-semantic-dedup.ts --batch 2026-10-20 --new-since 2026-10-13
    # held-out mode: only the pairs a later batch could label (see "Held-out batch")
```

The script reads `eval/triage/dataset.jsonl` (the text of every decided
candidate, rebuilt from git history), the current candidate snapshot and the
published signals in `config/technology-workspace.json`. It calls no API; the
only write is the vector cache `.cache/candidate-embeddings.json`.

## The corpus and the labels

893 candidates (2026-06-22 → 2026-10-12) and 107 published signals.

- **Kinds.** `candidate` pairs (should these two be one duplicate group?) and
  `published` pairs (is this candidate an announcement the site already
  carries?). A candidate is never paired with the signal it became.
- **Labels.** `same` — the same announcement, release, paper or incident, from
  any outlet. `event` — the same event but a distinct piece: a system card
  beside a launch post, a commentary the same day, a follow-up within days.
  `different` — everything else, including posts in one series. Precision is
  reported both ways; the thresholds were chosen on `same`.
- **What was reviewed.** Every pair the three scoring schemes ranked highly
  within 14 days (892 pairs), a probe below that floor — cross-source pairs
  within 3 days and candidate→signal pairs within 7 days down to a centred
  score of 0.30 (2,192 pairs: the top 350 read one by one, plus every pair
  whose titles share a distinctive token, 125 more; the remaining ~1,700 were
  not read and count as `different`) — and every cross-language candidate pair
  within 7 days whose titles share a latin word (198 pairs). Unreviewed pairs
  count as `different`. **One person labelled everything, and that person also
  chose the thresholds** — there is no held-out split. Treat the numbers as an
  upper bound until a second labeller or a later month confirms them.
- **The deterministic rules are the baseline.** Every number below counts only
  what they do **not** already catch.

Of 27 `same` candidate pairs, the deterministic rules already catch 17 (and
also link 15 pairs labelled `different` — `sqlite-utils 4.0` against
`4.0rc2`, for one). Of 15 `same` candidate→signal pairs, `already_published`
already catches 5.

## Results (raw cosine, pairs at most 3 days apart, release feeds excluded)

Candidate ↔ candidate, beyond the deterministic rules:

| threshold | flagged |  same | same event | different | precision | with event | recall (total) |
| --------: | ------: | ----: | ---------: | --------: | --------: | ---------: | -------------: |
|      0.93 |      43 |     1 |          5 |        34 |        3% |        15% |            67% |
|      0.94 |      11 |     1 |          2 |         8 |        9% |        27% |            67% |
|      0.95 |       3 |     1 |          1 |         1 |       33% |        67% |            67% |
|  **0.96** |   **1** | **1** |          0 |         0 |  **100%** |       100% |            67% |

Candidate ↔ published signal, beyond `already_published`:

| threshold | flagged |  same | same event | different | precision | with event | recall (total) |
| --------: | ------: | ----: | ---------: | --------: | --------: | ---------: | -------------: |
|      0.91 |      39 |     6 |          8 |        25 |       15% |        36% |            73% |
|  **0.92** |  **11** | **5** |          3 |         3 |   **45%** |        73% |            67% |
|      0.93 |       2 |     1 |          1 |         0 |       50% |       100% |            40% |

By language: every hit above is a Chinese–Chinese pair. Of the 10 `same`
candidate pairs the rules miss, 7 cross languages (an English announcement and
its Chinese report) and score **0.82–0.85** raw — below the 0.93 that unrelated
same-topic Chinese pairs already reach. This model does not bridge the
language gap well enough to find them; the published side gets around it by
also embedding each signal's Chinese title and summary.

## What shipped, and why

- **Candidate pairs: 0.96, ≤ 3 days → `semantic_similar` duplicate group.** A
  group hides the non-primary items on the 全部快讯 lane and blocks converting
  them, so this needs to be right when it fires. In three and a half months it
  fires once beyond the existing rules (DeepSeek's Ascend components, 量子位 and
  InfoQ on 2026-09-30). That is the honest size of the gain.
- **Published matches: 0.92, ≤ 3 days → `similar_to_published` flag.** About
  half are the same announcement, the rest the same event or only the same
  topic — fine for a hint on the editorial round, not for an action. So it is a
  **separate flag the task runner never rejects on**, rather than a third way
  to raise `already_published`, which does reject automatically.
- **Release feeds never take part.** Their bodies are release notes, so
  `v0.31.0` and `v0.30.0` of one project read alike; a re-import is caught by
  its URL. A release is recognized by a `/releases/tag/` URL as well as by
  source type (`isReleaseFeedItem`). **Until 2026-10-13 the runtime checked
  the source type only**, while this measurement used the URL — and every
  GitHub release source in the pool is imported as Atom (`rss-feed`), so in
  practice no release was excluded on either side. The 2026-10-13 run showed
  it: Transformers `v5.15.0` and `v5.14.0` were flagged as similar to the
  Muse Glimmer and Inkling signals (0.956 and 0.935), because their notes
  announce support for those models. The rule version went to
  `semantic-dedup-v2` with the fix, which sets aside every match stored
  under v1 until the next import recomputes them.
- **Raw cosine, not centred.** Subtracting the corpus mean (or each language's
  mean) did no better on same-language pairs, and the per-language variant —
  the only one that lifts cross-language pairs off the floor (to 0.30–0.41) —
  does it at a precision of 4%. Centring also makes a score depend on whatever
  else is in the pool. Both stay in the script as comparison rows.

The 2026-10-12 pool, the first run in place: no candidate pairs, one published
match — Google's "Gemini 3.8 text-to-speech says hello" against the published
"Gemini 3.8 Live" signal (0.928), a pair labelled `different`. The flag says
「疑似」 for that reason.

## Held-out batch: the rounds of 2026-10-13 and 10-20

The first labels made after the thresholds were chosen, by a second labeller
(the agent of the 2026-10-20 evaluation session, not the one who labelled the
3,285 pairs above and set the thresholds), without seeing a score. The batch
is every pair the earlier labelling could not have seen: at least one side is
one of the 117 candidates decided from 2026-10-13 on (the two blind rounds
plus 12 task-runner rejections) or one of the 10 signals published since,
within 14 days — **11,775 candidate pairs and 2,862 candidate → signal
pairs**. `--unlabelled` in held-out mode listed the 246 of them that some grid
threshold flags within 7 days; they were labelled from a shuffled sheet
carrying titles, summaries, sources and dates and no score (file order follows
the score grid, so it was shuffled too), then appended to `labels.jsonl` with
`"batch": "2026-10-20"`. Labels: **3 same, 9 event, 234 different**; the
unlisted pairs count as different, as in the first batch. The deterministic
rules catch none of the batch's `same` pairs and nothing wrongly.

```bash
node scripts/run-ts.cjs scripts/measure-semantic-dedup.ts --batch 2026-10-20 --new-since 2026-10-13
```

Held-out mode keeps a pair only when a new side is involved and its label, if
any, carries that batch — pairs labelled before are left out, so the tables
score the batch alone. Raw cosine, at most 3 days apart, release feeds
excluded, beyond the deterministic rules:

Candidate ↔ candidate (2 `same`, 7 `event` in the batch):

| threshold | flagged |  same | same event | different | precision | with event |
| --------: | ------: | ----: | ---------: | --------: | --------: | ---------: |
|      0.90 |     104 |     0 |          3 |       101 |        0% |         3% |
|      0.91 |      26 |     0 |          3 |        23 |        0% |        12% |
|      0.92 |       7 |     0 |          3 |         4 |        0% |        43% |
|      0.93 |       0 |     0 |          0 |         0 |         — |          — |
|  **0.96** |   **0** | **0** |          0 |         0 |         — |          — |

Candidate ↔ published signal (1 `same`, 2 `event` in the batch):

| threshold | flagged |  same | same event | different | precision |
| --------: | ------: | ----: | ---------: | --------: | --------: |
|      0.90 |      24 |     0 |          0 |        24 |        0% |
|      0.91 |       5 |     0 |          0 |         5 |        0% |
|  **0.92** |   **0** | **0** |          0 |         0 |         — |

Where the batch's `same` pairs are: all three are InfoQ's Chinese translation
of Google's Gemini 4 Argon launch post (2026-10-19) — against the English post
on the DeepMind and Google AI feeds (10-14) and against the published signal
it became. Five days apart, so outside the 3-day window, and cross-language:
raw **0.902, 0.849 and 0.885**, the same band the first batch's cross-language
pairs sat in (0.82–0.85). The 9 `event` pairs are the Argon launch day's three
posts (launch, safety, robotics) against each other and against the
translation. Per-language centring at 0.45–0.50 within 7 days would catch both
candidate `same` pairs at 25–29% precision (2 of 7–8 flagged) — the trade the
first batch declined at 4%, on a sample too small to change the answer.

**What this says about the thresholds.** On 14,637 pairs the first labelling
never saw, the shipped rules fire **zero** times, and there is nothing at the
shipped thresholds for them to miss: the batch's only same-announcement pairs
are cross-language and five days apart, out of reach of any raw threshold and
of the window. Lowering the candidate threshold to 0.92 would add 7 flags — 3
of them the Argon launch-day posts, distinct pieces a duplicate group would
hide from the 全部快讯 lane, and 4 unrelated; to 0.90, 104 flags with 101
unrelated. Lowering the published threshold to 0.91 or 0.90 adds unrelated
pairs only. **Recommendation: keep 0.96 / 0.92 / 3 days and
`semantic-dedup-v2`.** The batch adds no evidence about precision _at_ the
shipped thresholds either way (nothing fired, so nothing was measured); what
it shows is that a month of new candidates produced no new true positive for
them to find, and that the one recurring same-announcement pattern — a Chinese
outlet translating an English post days later — is the one this model cannot
bridge.

## Re-measuring

After a few more editorial rounds, add the new candidates' pairs: run with
`--unlabelled` (in held-out mode, so only the new pairs are listed), label the
listed pairs **before looking at any score**, append them to `labels.jsonl`
with a `batch` naming the day, rerun in held-out mode for the batch's own
numbers and without it for the whole corpus. A threshold change must bump
`SEMANTIC_DEDUP_RULE_VERSION` — stored matches record the version, model and
threshold that produced them, and anything else is ignored.
