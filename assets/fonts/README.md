# Share-card font

`NotoSerifSC-Bold.share-card.otf` is the only font the share cards use —
every `opengraph-image` route, painted by `src/lib/share-card-image.tsx`
(signals, digests, weekly reviews, skills, knowledge, topics). `next/og`
ships a Latin-only font, so without it every Chinese character renders as a
box.

- **Font**: Noto Serif SC Bold (思源宋体), static OTF from
  `github.com/notofonts/noto-cjk` → `Serif/SubsetOTF/SC/NotoSerifSC-Bold.otf`
  (12.1 MB), fetched 2026-09-29. Serif, because the dossier headings are
  宋体 / Georgia (`docs/design-system.md` → "Dossier direction").
- **License**: SIL Open Font License 1.1, full text in `OFL.txt`. The OFL
  allows bundling and subsetting; a subset must not be sold on its own.
- **Subset**: GB2312 level 1 (3,755 characters) + every character at or above
  U+2E80 in `config/technology-workspace.json`, `src/data/*.ts`,
  `src/lib/technology-localization.ts` and `src/lib/share-card.ts` at the time
  it was cut + printable ASCII + CJK punctuation — 3,896 characters, 1.16 MB.
  Hinting dropped, `kern` and `palt` kept.
- **A character outside the subset** falls back to `next/og`'s own on-demand
  fetch from Google Fonts; only if that also fails does it render as a box.
  Tested 2026-09-29 with 龘靐齉 in a digest card: two came back in a light
  sans among the bold serif, 齉 as a box, and the first render took 16 s
  (0.14 s once cached) — long enough for a link-preview crawler to give up.
  Titles rarely hit this (GB2312 level 1 covers everyday text), but a
  digest's editorial summary is new free text every issue, so the digest
  card checks its sentence against the subset (`src/lib/font-cmap.ts`) and
  falls back to the digest title when a character is missing. Recut when
  titles start using rarer characters:

```bash
python assets/fonts/subset-share-card-font.py . NotoSerifSC-Bold.otf assets/fonts/NotoSerifSC-Bold.share-card.otf
```

- **Checking whether a recut is needed** takes no fontTools: the checker
  reads the subset's cmap and lists what is missing, both from the text a
  card can paint (titles, tag names, labels, digest editorial summaries)
  and from everything a recut would scan. Point the second argument at the live data directory to
  check what is published:

```bash
node assets/fonts/check-share-card-font.cjs . C:/Users/Administrator/ai-tech-radar/config
```

Measured 2026-09-29 when the cards spread beyond signals (the script's
source list gained the skill, knowledge and digest stores,
`content-labels.ts` and `weekly-review.ts`): card text 0 missing, all
source text 1 missing (阈, in two skill / knowledge bodies, never on a
card). No recut; the subset is unchanged at 1,159,344 bytes.
