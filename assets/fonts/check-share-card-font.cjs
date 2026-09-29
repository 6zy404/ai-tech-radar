// Lists the characters the share cards may need that the font subset lacks,
// without fontTools: reads the subset's own cmap table directly. Checks the
// same sources `subset-share-card-font.py` cuts from, so "0 missing" means a
// recut would add nothing.
//
//   node assets/fonts/check-share-card-font.cjs [repo root] [data dir]
//
// The data dir defaults to `<repo root>/config`; point it at the live
// LOCAL_DATA_DIR to check what is actually published. Read-only.

const fs = require("node:fs");
const path = require("node:path");

function readCmap(file) {
  const font = fs.readFileSync(file);
  const tableCount = font.readUInt16BE(4);
  let cmapOffset;

  for (let index = 0; index < tableCount; index += 1) {
    const record = 12 + index * 16;
    if (font.toString("latin1", record, record + 4) === "cmap") {
      cmapOffset = font.readUInt32BE(record + 8);
    }
  }

  const codepoints = new Set();
  const subtableCount = font.readUInt16BE(cmapOffset + 2);

  for (let index = 0; index < subtableCount; index += 1) {
    const offset =
      cmapOffset + font.readUInt32BE(cmapOffset + 4 + index * 8 + 4);
    const format = font.readUInt16BE(offset);

    if (format === 12) {
      const groups = font.readUInt32BE(offset + 12);
      for (let group = 0; group < groups; group += 1) {
        const start = font.readUInt32BE(offset + 16 + group * 12);
        const end = font.readUInt32BE(offset + 20 + group * 12);
        for (let code = start; code <= end; code += 1) codepoints.add(code);
      }
    } else if (format === 4) {
      const segmentsX2 = font.readUInt16BE(offset + 6);
      const ends = offset + 14;
      const starts = ends + segmentsX2 + 2;
      for (let segment = 0; segment < segmentsX2 / 2; segment += 1) {
        const end = font.readUInt16BE(ends + segment * 2);
        const start = font.readUInt16BE(starts + segment * 2);
        for (let code = start; code <= end && code !== 0xffff; code += 1) {
          codepoints.add(code);
        }
      }
    }
  }

  return codepoints;
}

const repo = path.resolve(process.argv[2] ?? ".");
const dataDir = path.resolve(process.argv[3] ?? path.join(repo, "config"));
const font = path.join(repo, "assets/fonts/NotoSerifSC-Bold.share-card.otf");
const sources = [
  ...[
    "technology-workspace.json",
    "skill-workspace.json",
    "knowledge-workspace.json",
    "daily-digests.json"
  ].map((name) => path.join(dataDir, name)),
  ...fs
    .readdirSync(path.join(repo, "src/data"))
    .filter((name) => name.endsWith(".ts"))
    .map((name) => path.join(repo, "src/data", name)),
  ...[
    "technology-localization.ts",
    "content-labels.ts",
    "weekly-review.ts",
    "share-card.ts"
  ].map((name) => path.join(repo, "src/lib", name))
].filter((file) => fs.existsSync(file));

// The text a card can actually paint: the `title` / `name` fields of the
// JSON stores and a digest's `editorialSummary` (its first sentence heads
// the digest card), plus the code files whole (labels and seed data).
// Skill, knowledge and signal bodies are in the sources above but never on
// a card.
function cardText(file) {
  const text = fs.readFileSync(file, "utf8");
  if (!file.endsWith(".json")) return text;

  const parts = [];
  (function walk(value) {
    if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === "object") {
      for (const [key, child] of Object.entries(value)) {
        if (
          (key === "title" || key === "name" || key === "editorialSummary") &&
          typeof child === "string"
        ) {
          parts.push(child);
        } else if (key === "title" && child && typeof child === "object") {
          parts.push(
            ...Object.values(child).filter((v) => typeof v === "string")
          );
        } else {
          walk(child);
        }
      }
    }
  })(JSON.parse(text));
  return parts.join("\n");
}

function missingIn(texts, cmap) {
  const missing = new Set();
  for (const text of texts) {
    for (const char of text) {
      const code = char.codePointAt(0);
      if (code >= 0x2e80 && !cmap.has(code)) missing.add(char);
    }
  }
  return [...missing];
}

function report(label, missing) {
  console.log(
    `${label}: ${missing.length === 0 ? "0 missing" : `${missing.length} missing: ${missing.join("")}`}`
  );
}

const cmap = readCmap(font);

console.log(
  `${cmap.size} characters in the subset, ${sources.length} sources checked`
);
report("card text", missingIn(sources.map(cardText), cmap));
report(
  "all source text (what a recut would add)",
  missingIn(
    sources.map((file) => fs.readFileSync(file, "utf8")),
    cmap
  )
);
