# Search evaluation

Measures whether `/search` finds what a reader meant, comparing three modes on
the same queries and the same corpus: **keyword** (the original substring
match), **semantic** (local embeddings alone) and **hybrid** (both, merged — what
the page ships).

## Files

| File                         | What it is                                                        | Tracked |
| ---------------------------- | ----------------------------------------------------------------- | ------- |
| `queries.json`               | 43 queries with the items that count as relevant, split tune/test | yes     |
| `results/hybrid-search.json` | the last run: settings, per-split summary, every query's results  | yes     |

The embedding model and the passage-vector cache live in `.cache/`
(git-ignored, regenerable).

## How the queries were made, and what that biases

**Written by the same agent that built the search, with the corpus in view**,
then spot-checked by the owner. That is the cheap option and it has a known
lean: an author who has read every title writes queries that the titles
answer. Two things push back against it — most queries are phrased the way a
reader would ask rather than with the words in the title ("显存不够怎么办",
not "模型量化与数值精度"), and six queries are about things the site does not
cover at all, so returning nothing is the right answer for them. A query set
written by someone who had not seen the corpus would score lower; how much
lower is not known.

Relevant items are labelled `T:` / `S:` / `K:` plus the public slug. The eval
refuses to run if a label names an item that no longer exists.

## Split

**12 tune queries** (2 negatives) were the only ones looked at while choosing
the cutoff. **31 test queries** (4 negatives) were scored once, with the
setting already fixed. Same rule as the triage eval: nothing is tuned on the
numbers it is reported with.

## Running it

```bash
npm run eval:search              # both splits, current setting; writes results/
npm run eval:search -- --grid    # sweep the cutoff on the tune split only
npm run eval:search -- --verbose # also print every test query's misses
```

No API is called. The first run downloads the model (~130MB, through
`hf-mirror.com` unless `EMBEDDING_REMOTE_HOST` says otherwise).

## How ranking works

- **Keyword**: every term must appear in the title, summary or tag names;
  items with more terms in the title rank first.
- **Semantic**: `Xenova/multilingual-e5-small` (q8, run in-process by
  transformers.js) embeds the query and every item's title, summary and tags.
  An item is kept if its score is at least **1.75 standard deviations above the
  mean for that query**, at most 5 per group.
- **Hybrid**: the two lists for each group are merged by reciprocal rank
  fusion (k = 60), and each result is labelled 关键词, 语义相近 or both.
- The news lane stays keyword-only. It is the unedited tier, and widening it by
  meaning would widen exactly the part nobody has checked.

## Why the cutoff is relative, not an absolute score

This was measured first, on the tune split. The model's cosines sit in a narrow
band that moves with the query's language: the best-matching item for the
English query "how to evaluate model output" scored **0.788**, while the best
item for the off-topic Chinese query "今天天气怎么样" scored **0.854**. No single
floor keeps the first and drops the second. The z-score is taken over the
query's own score distribution, so it moves with it.

On the tune split, cutoffs from 1.5 to 3.0 were tried; 1.75 with a limit of 5
had the best balance of recall and precision (59.0% / 47.0%). 2.0 had a better
MRR (0.617) and lower recall (47.5%).

## Results (`multilingual-e5-small`, z ≥ 1.75, 2026-09-23)

Test split, 27 queries with answers plus 4 with none:

|                                           | Keyword | Semantic |    Hybrid |
| ----------------------------------------- | ------: | -------: | --------: |
| Queries where anything relevant was found |   33.3% |    92.6% | **92.6%** |
| Recall                                    |   21.9% |    62.0% | **64.4%** |
| Precision                                 |   93.5% |    39.0% |     39.5% |
| MRR                                       |   0.333 |    0.698 | **0.725** |
| Results per query                         |     0.6 |      4.1 |       4.2 |
| Off-topic queries that return something   |  0 of 4 |   4 of 4 |    4 of 4 |

**What it fixes.** Keyword search found something relevant for a third of the
queries, because a Chinese query with no spaces only matches if that exact
string is in a title. It found something for 9 of 27 queries, and all 9 are
short terms or product names ("MCP", "Kimi", "机器人"). Every longer, descriptive
query scored 0. Hybrid finds something relevant for 25 of 27.

**What it costs.** Precision falls from 93.5% to 39.5%: of the four or so
results a query now returns, more than half are not what was asked for. The first
relevant item is usually near the top (MRR 0.725), so the page reads better
than the precision number suggests, but a reader will scroll past noise.

**What it cannot do: say "nothing here".** All six negative queries, tune and
test, returned results — "how to bake bread" returns AlphaGenome, "股票推荐"
returns Qwen3.8. A cutoff relative to the query always admits the query's best
items, and the model does not separate "less related" from "unrelated". The
page handles this in words instead: when every result came from meaning alone,
it says there was no literal match and the results may be off-topic.

**Where the small model is weak:**

- **Short English acronyms.** "RAG" returns GPT-Red, the wiki-collusion story
  and two other unrelated signals as semantic matches, and "red teaming" missed the red-teaming knowledge
  entry. Keyword search still catches the exact term in both, which is the case
  for keeping it in the mix.
- **Questions phrased far from the items’ own words.** "两个模型之间怎么传信息"
  (Mostik's hidden-state bridge) and "AI 做数学证明" (Gowers, the Hadamard
  construction, Navier–Stokes) scored 0: the right items exist, and their
  summaries do not use the words a reader would.

## Known limits

- 43 queries, written by one author. Numbers this small move by several points
  when one query changes.
- Relevance is yes/no. An item that is related but not what was asked counts
  the same as one that is unrelated.
- Only titles, summaries and tag names are embedded, not bodies — the same
  fields keyword search reads, so the comparison is like for like.
