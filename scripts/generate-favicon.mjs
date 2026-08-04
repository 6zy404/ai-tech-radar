/**
 * Regenerates src/app/favicon.ico from the same geometry as src/app/icon.svg.
 *
 * The .ico is a binary, so without this script it would be an unreproducible
 * blob: nobody could change the mark without hand-editing bytes. Keep the two
 * files in sync by construction — edit the constants below and the SVG
 * together, then run `npm run gen:favicon`.
 *
 * Design A "印章" (2026-08-04): stamp-red rounded square, paper ring and
 * centre dot, using the --dossier-stamp / --dossier-surface token values.
 * The ring is 3 units wide rather than 2 because that is the threshold at
 * which the 16px entry — the size a browser tab actually renders — keeps a
 * fully opaque paper pixel instead of dissolving into antialiasing.
 */

import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const SIZE = 32;
const CORNER_RADIUS = 7;
const RING_INNER = 7;
const RING_OUTER = 10;
const DOT_RADIUS = 3.2;
const STAMP = [0x8a, 0x3b, 0x2a];
const PAPER = [0xf8, 0xf6, 0xee];
const SAMPLES = 4;
const ICO_SIZES = [16, 32, 48];

function colorAt(x, y) {
  const dx = Math.max(Math.abs(x - 16) - (16 - CORNER_RADIUS), 0);
  const dy = Math.max(Math.abs(y - 16) - (16 - CORNER_RADIUS), 0);
  if (Math.hypot(dx, dy) > CORNER_RADIUS) return null;
  const d = Math.hypot(x - 16, y - 16);
  if (d <= DOT_RADIUS) return PAPER;
  if (d >= RING_INNER && d <= RING_OUTER) return PAPER;
  return STAMP;
}

function renderScanlines(size) {
  const scale = size / SIZE;
  const rows = [];
  for (let py = 0; py < size; py += 1) {
    const row = Buffer.alloc(size * 4 + 1);
    row[0] = 0;
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
      // Average the covered samples only and carry coverage in alpha —
      // averaging across uncovered samples would darken every edge pixel.
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

function renderPng(size) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(renderScanlines(size), { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

function buildIco(sizes) {
  const images = sizes.map((size) => renderPng(size));
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  let offset = 6 + images.length * 16;
  const entries = images.map((image, index) => {
    const entry = Buffer.alloc(16);
    entry[0] = sizes[index];
    entry[1] = sizes[index];
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(image.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += image.length;
    return entry;
  });

  return Buffer.concat([header, ...entries, ...images]);
}

/**
 * Self-check: name every colour band down the centre column of each entry.
 * A correct mark reads stamp / paper(ring) / stamp / paper(dot) and back,
 * symmetrically. Printing the bands rather than asserting one sampled pixel
 * means a geometry change is visible in the output instead of silently
 * passing a probe that happens to sit in the wrong place.
 */
function describeBands(size) {
  const raw = renderScanlines(size);
  const stride = size * 4 + 1;
  const bands = [];
  for (let y = 0; y < size; y += 1) {
    const offset = y * stride + 1 + (size >> 1) * 4;
    const [r, g, , a] = raw.subarray(offset, offset + 4);
    let label = "blend";
    if (a < 128) label = "clear";
    else if (r > 200 && g > 200) label = "paper";
    else if (r > 100 && g < 100) label = "stamp";
    const last = bands[bands.length - 1];
    if (last && last[0] === label) last[1] += 1;
    else bands.push([label, 1]);
  }
  return bands.map(([label, count]) => `${label}x${count}`).join(" | ");
}

const target =
  process.argv[2] ??
  resolve(dirname(fileURLToPath(import.meta.url)), "../src/app/favicon.ico");
const ico = buildIco(ICO_SIZES);
writeFileSync(target, ico);

console.log(`wrote ${target} (${ICO_SIZES.join("/")}px, ${ico.length} bytes)`);
for (const size of ICO_SIZES) {
  console.log(`  ${size}px centre column: ${describeBands(size)}`);
}
