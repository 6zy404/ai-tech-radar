# Share-card font

`NotoSerifSC-Bold.share-card.otf` is the only font the signal share card
(`src/app/technologies/[slug]/opengraph-image.tsx`) uses. `next/og` ships a
Latin-only font, so without it every Chinese character renders as a box.

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
  Recut when titles start using rarer characters:

```bash
python assets/fonts/subset-share-card-font.py . NotoSerifSC-Bold.otf assets/fonts/NotoSerifSC-Bold.share-card.otf
```
