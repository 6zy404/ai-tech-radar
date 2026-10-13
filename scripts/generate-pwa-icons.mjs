/**
 * Regenerates the PWA icons under public/ from the same "印章" geometry as
 * src/app/icon.svg and scripts/generate-favicon.mjs (stamp-red square, paper
 * ring, paper centre dot, on a 32-unit grid). Run `node scripts/generate-pwa-icons.mjs`
 * after changing the mark; the PNGs are committed.
 *
 *   public/icons/icon-192.png, icon-512.png   rounded square, clear corners ("any")
 *   public/icons/icon-maskable-512.png        full bleed, for launchers that crop
 *                                             (the ring's outer edge sits at 31% of
 *                                             the size from the centre, inside the
 *                                             40% safe zone)
 *   public/apple-touch-icon.png (180)         full bleed; iOS rounds it itself and
 *                                             fetches this path without a <link>
 *   public/icons/badge-96.png                 ring and dot only, white on clear —
 *                                             Android draws notification badges as
 *                                             an alpha mask
 */

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const GRID = 32;
const CORNER_RADIUS = 7;
const RING_INNER = 7;
const RING_OUTER = 10;
const DOT_RADIUS = 3.2;
const STAMP = [0x8a, 0x3b, 0x2a];
const PAPER = [0xf8, 0xf6, 0xee];
const WHITE = [0xff, 0xff, 0xff];
const SAMPLES = 4;

function isMark(x, y) {
  const d = Math.hypot(x - 16, y - 16);
  return d <= DOT_RADIUS || (d >= RING_INNER && d <= RING_OUTER);
}

const variants = {
  rounded(x, y) {
    const dx = Math.max(Math.abs(x - 16) - (16 - CORNER_RADIUS), 0);
    const dy = Math.max(Math.abs(y - 16) - (16 - CORNER_RADIUS), 0);
    if (Math.hypot(dx, dy) > CORNER_RADIUS) return null;
    return isMark(x, y) ? PAPER : STAMP;
  },
  fullBleed(x, y) {
    return isMark(x, y) ? PAPER : STAMP;
  },
  badge(x, y) {
    return isMark(x, y) ? WHITE : null;
  }
};

function renderScanlines(size, colorAt) {
  const scale = size / GRID;
  const rows = [];
  for (let py = 0; py < size; py += 1) {
    const row = Buffer.alloc(size * 4 + 1);
    for (let px = 0; px < size; px += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let covered = 0;
      for (let sy = 0; sy < SAMPLES; sy += 1) {
        for (let sx = 0; sx < SAMPLES; sx += 1) {
          const color = colorAt(
            (px + (sx + 0.5) / SAMPLES) / scale,
            (py + (sy + 0.5) / SAMPLES) / scale
          );
          if (color) {
            r += color[0];
            g += color[1];
            b += color[2];
            covered += 1;
          }
        }
      }
      const offset = 1 + px * 4;
      row[offset] = covered ? Math.round(r / covered) : 0;
      row[offset + 1] = covered ? Math.round(g / covered) : 0;
      row[offset + 2] = covered ? Math.round(b / covered) : 0;
      row[offset + 3] = Math.round((covered / (SAMPLES * SAMPLES)) * 255);
    }
    rows.push(row);
  }
  return Buffer.concat(rows);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function renderPng(size, colorAt) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(renderScanlines(size, colorAt), { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

const publicDir = resolve(dirname(fileURLToPath(import.meta.url)), "../public");
const outputs = [
  ["icons/icon-192.png", 192, variants.rounded],
  ["icons/icon-512.png", 512, variants.rounded],
  ["icons/icon-maskable-512.png", 512, variants.fullBleed],
  ["apple-touch-icon.png", 180, variants.fullBleed],
  ["icons/badge-96.png", 96, variants.badge]
];

mkdirSync(resolve(publicDir, "icons"), { recursive: true });

for (const [name, size, colorAt] of outputs) {
  const png = renderPng(size, colorAt);
  writeFileSync(resolve(publicDir, name), png);
  console.log(`wrote public/${name} (${size}px, ${png.length} bytes)`);
}
