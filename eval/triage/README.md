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
