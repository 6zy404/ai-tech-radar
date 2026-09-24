# 问雷达 evaluation

Measures whether `/ask` answers from the site and only from the site: that its
citations point at things it actually retrieved, that it cites the items a
good answer would use, and that it declines when the site has nothing.

## Files

| File             | What it is                                                      | Tracked        |
| ---------------- | --------------------------------------------------------------- | -------------- |
| `questions.json` | 20 questions: 14 the site can answer, 6 it cannot               | yes            |
| `results/*.json` | one report per prompt version × model, with every answer's text | yes, real runs |

## What is checked, and how

No second model grades anything. Every check is a string or set comparison:

- **Citation validity.** Reference numbers are handed out by the code the
  first time a tool returns an item, not chosen by the model, so a `[n]` that
  no tool returned is invalid by definition.
- **Grounded.** An answerable question counts as grounded if the answer cites
  at least one of the items listed for it.
- **Refusal.** The model is told to open with exactly 「站内没有直接相关的内容」
  when it cannot answer from the site. An unanswerable question must start
  that way; an answerable one must not.

## Running it

```bash
npm run eval:ask
```

It uses whatever `LLM_*` variables are set, reading `.env.local` (or the file
named by `EVAL_ENV_FILE`). With the mock it prints numbers but writes no
result file.

## Results: `ask-radar-v1` × `deepseek-chat` (2026-09-23)

> 2026-09-24: two expected items (`T:model-context-protocol` on a09 and
> `T:on-device-small-language-models` on a01) were removed from
> `questions.json` when the eight April placeholder signals were archived.
> Both questions keep other expected items, so the grounding rule still has
> something to check. The run below predates that edit and was not repeated;
> it is a real-cost call, and the change cannot make a grounded answer
> ungrounded.

|                                       | Search only (mock) |    DeepSeek |
| ------------------------------------- | -----------------: | ----------: |
| Answerable questions grounded         |              11/14 |       14/14 |
| Answerable questions wrongly declined |               0/14 |        0/14 |
| Unanswerable questions declined       |                0/6 |     **6/6** |
| Invalid citations                     |               0/56 |        0/40 |
| Tool calls per question               |                1.0 |         3.3 |
| Latency p50 / p95                     |                  — | 2.5s / 2.9s |

The mock row is what search alone does: it lists the top three hits for the
reader's words. It never declines, because hybrid search always returns
something (see `eval/search/README.md`). The difference in that row is the
reason the model is there — telling "the site has nothing on this" apart from
"here are the nearest items" is the part retrieval cannot do.

Tokens for the 20 questions: 79,836 prompt + 6,292 completion, about 4,000
prompt tokens per question, most of it retrieved text re-sent on each round.

The two hardest negatives were written to tempt the model into using what it
already knows: "Rust 和 Go 哪个更适合写 Web 后端？" (the site has a Rust port
story) and "Transformer 论文是哪一年发表的？" (every model knows the answer).
Both were declined, each followed by one sentence naming the nearest item and
saying why it does not answer the question.

## Spot check of the answers themselves

A valid citation number does not prove the sentence next to it is true. Four
answers were checked and 17 specific claims in them — Inkling's 256 experts and
2TB/600GB weights, the Hadamard result being the 4th FrontierMath problem, the
73.7 trillion tokens and 26% cost-visibility figures, and so on — were looked
up in the text the model can read. All 17 were there. That is a manual check
on a sample, not a measurement.

## What these numbers do not show

- **Everything passed, so this set does not separate good from bad.** It was
  written by the agent that built the feature, with the corpus in view. It
  shows the pipeline works and the refusal rule holds on obvious cases. A
  version that discriminates needs questions from readers who have not seen
  the corpus, including ones the site half answers.
- **Grounded means at least one expected item was cited.** It says nothing
  about whether every sentence is supported. The spot check above is the only
  evidence for that.
- **No partial answers.** Every question is either clearly covered or clearly
  not. The case most likely to go wrong in real use is a question the site
  covers in part, where the model has to say which part.
