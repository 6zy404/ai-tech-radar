/**
 * The code points an OpenType font maps to a glyph, read from its `cmap`
 * table (formats 4 and 12, which is what the share-card subset carries).
 * Enough to answer "can this font draw this text?" without a font library.
 *
 * `assets/fonts/check-share-card-font.cjs` carries a copy of this parser,
 * because it runs as plain Node outside the TypeScript build.
 */
export function readFontCodePoints(font: Uint8Array): Set<number> {
  const view = new DataView(font.buffer, font.byteOffset, font.byteLength);
  const tableCount = view.getUint16(4);
  let cmapOffset: number | undefined;

  for (let index = 0; index < tableCount; index += 1) {
    const record = 12 + index * 16;
    const tag = String.fromCharCode(...font.subarray(record, record + 4));

    if (tag === "cmap") {
      cmapOffset = view.getUint32(record + 8);
    }
  }

  const codePoints = new Set<number>();

  if (cmapOffset === undefined) {
    return codePoints;
  }

  const subtableCount = view.getUint16(cmapOffset + 2);

  for (let index = 0; index < subtableCount; index += 1) {
    const offset = cmapOffset + view.getUint32(cmapOffset + 4 + index * 8 + 4);
    const format = view.getUint16(offset);

    if (format === 12) {
      const groups = view.getUint32(offset + 12);

      for (let group = 0; group < groups; group += 1) {
        const start = view.getUint32(offset + 16 + group * 12);
        const end = view.getUint32(offset + 20 + group * 12);

        for (let code = start; code <= end; code += 1) {
          codePoints.add(code);
        }
      }
    } else if (format === 4) {
      const segmentsX2 = view.getUint16(offset + 6);
      const ends = offset + 14;
      const starts = ends + segmentsX2 + 2;

      for (let segment = 0; segment < segmentsX2 / 2; segment += 1) {
        const end = view.getUint16(ends + segment * 2);
        const start = view.getUint16(starts + segment * 2);

        for (let code = start; code <= end && code !== 0xffff; code += 1) {
          codePoints.add(code);
        }
      }
    }
  }

  return codePoints;
}

/** True when every non-space character of `text` is in `codePoints`. */
export function canDrawText(codePoints: Set<number>, text: string): boolean {
  for (const char of text) {
    if (/\s/.test(char)) {
      continue;
    }

    if (!codePoints.has(char.codePointAt(0) ?? 0)) {
      return false;
    }
  }

  return true;
}
