// Move a component's rules — scattered across the numbered stylesheet layers —
// into one file, without changing which declaration wins anywhere.
//
//   node scripts/css-regroup.mjs plan  --dom <capture.json> <file>=<root>[,<root>…] …
//   node scripts/css-regroup.mjs apply --dom <capture.json> <file>=<root>[,<root>…] …
//
// <file> is a path under src/app/styles without .css, e.g. components/top-nav
// or pages/home. A rule belongs to it when the last class of every selector in
// the rule (the subject) is one of the listed BEM roots; rules shared by
// several components stay where they are. The rules move, in their original
// relative order, into that file, imported at whichever slot between the
// existing files leaves the fewest rules unable to move. Every rule that cannot
// move gets a comment saying why, where it stays.
//
// Always follow an apply with a build and `npm run css:diff` against a capture
// of the build before it (`diff … --css-may-change`): it must read 0.
//
// Moving a rule changes its source order, and source order decides between two
// declarations only when all of these hold. For every pair of rules whose
// relative order the move flips, a pair is a conflict when:
//   - their media conditions can hold at once;
//   - they set the same property, counting shorthands, logical/physical and
//     vendor-prefixed forms (conservatively: `border` overlaps `border-radius`);
//   - a selector from each has the same specificity and the same !important;
//   - those two selectors can match one element — same pseudo-element, no
//     conflicting tag, and the union of their subject classes occurs together
//     on some element: in the captured DOM of every route (css-style-diff
//     capture, --dom) or inside one className expression in src/.
// A rule in conflict stays where it is, and the search repeats until stable.
//
// Within the new file, a declaration is dropped when a later declaration with
// the same selector and media replaces it (same property, or a shorthand that
// resets it — from an explicit table, never by name prefix) with at least its
// importance — it can never apply — unless the later value uses something newer
// the earlier one lacks (a fallback pair such as `width: 100%; width: min(…)`).
// Each drop is then re-proven against the untouched rules by verifyRemoval,
// which has its own, smaller table; if any fails, nothing is written. Later
// rules with the same selector and media are folded into the first one when no
// rule between them conflicts.
import postcss from "postcss";
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const STYLES = "src/app/styles";
const GLOBALS = "src/app/globals.css";

// ---------- loading ----------

function importList() {
  const text = readFileSync(GLOBALS, "utf8");
  return [...text.matchAll(/@import "\.\/styles\/([^"]+)";/g)].map((m) => m[1]);
}

function loadAll(files) {
  const roots = new Map();
  const items = [];
  for (const file of files) {
    const css = readFileSync(path.join(STYLES, file), "utf8");
    const root = postcss.parse(css, { from: file });
    roots.set(file, root);
    const visit = (container, media) => {
      container.each((node) => {
        if (node.type === "rule") {
          items.push(makeItem(node, file, media));
        } else if (node.type === "atrule" && node.name === "media") {
          visit(node, [...media, node.params.trim()]);
        } else if (node.type === "atrule") {
          throw new Error(`unhandled @${node.name} in ${file}`);
        }
      });
    };
    visit(root, []);
  }
  items.forEach((item, index) => (item.order = index));
  return { roots, items };
}

function makeItem(node, file, media) {
  const selectors = splitSelectorList(node.selector).map((s) => s.trim());
  const decls = [];
  node.each((child) => {
    if (child.type === "decl") {
      decls.push({
        prop: child.prop.toLowerCase(),
        value: child.value,
        important: Boolean(child.important),
        node: child
      });
    }
  });
  return {
    node,
    file,
    media,
    mediaKey: media.join(" && "),
    selectors,
    branches: selectors.map(analyseSelector),
    decls
  };
}

function splitSelectorList(text) {
  const out = [];
  let depth = 0;
  let current = "";
  for (const ch of text) {
    if (ch === "(" || ch === "[") depth += 1;
    if (ch === ")" || ch === "]") depth -= 1;
    if (ch === "," && depth === 0) {
      out.push(current);
      current = "";
    } else current += ch;
  }
  out.push(current);
  return out;
}

// ---------- selectors ----------

// Returns specificity [a,b,c], the subject compound's classes / tag / pseudo-element.
function analyseSelector(selector) {
  const compounds = selector
    .replace(/\s*([>+~])\s*/g, " $1 ")
    .split(/\s+/)
    .filter((part) => part && !/^[>+~]$/.test(part));
  let spec = [0, 0, 0];
  for (const compound of compounds)
    spec = addSpec(spec, compoundSpec(compound));
  const subject = compounds[compounds.length - 1] ?? "";
  const withoutFunctions = stripFunctionalPseudos(subject);
  const classes = [...withoutFunctions.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map(
    (m) => m[1]
  );
  const tagMatch = withoutFunctions.match(/^([a-zA-Z][\w-]*)/);
  const pseudoElement = (withoutFunctions.match(/::([\w-]+)/) ?? [])[1] ?? null;
  return {
    text: selector.replace(/\s+/g, " ").trim(),
    spec,
    classes,
    tag: tagMatch ? tagMatch[1].toLowerCase() : null,
    pseudoElement,
    // A bare-tag subject (`.content-network__panel h3`) belongs to its nearest
    // class. Only attribution uses this; co-matching still uses `classes`.
    root: classes.length
      ? bemRoot(classes[classes.length - 1])
      : nearestClass(selector)
  };
}

function nearestClass(selector) {
  const all = [
    ...stripFunctionalPseudos(selector).matchAll(/\.([a-zA-Z_][\w-]*)/g)
  ];
  return all.length ? bemRoot(all[all.length - 1][1]) : null;
}

function bemRoot(className) {
  return className.replace(/__.*$/, "").replace(/--.*$/, "");
}

function stripFunctionalPseudos(compound) {
  let out = "";
  let depth = 0;
  for (let i = 0; i < compound.length; i += 1) {
    const ch = compound[i];
    if (
      depth === 0 &&
      ch === ":" &&
      /^:(not|has|is|where)\(/.test(compound.slice(i))
    ) {
      depth = 0;
      let j = compound.indexOf("(", i);
      let d = 0;
      for (; j < compound.length; j += 1) {
        if (compound[j] === "(") d += 1;
        if (compound[j] === ")") {
          d -= 1;
          if (d === 0) break;
        }
      }
      i = j;
      continue;
    }
    out += ch;
  }
  return out;
}

function compoundSpec(compound) {
  let spec = [0, 0, 0];
  // functional pseudo-classes: :not/:is/:has take their argument's max specificity
  const functional = /:(not|has|is|where)\(/g;
  let rest = compound;
  let match;
  while ((match = functional.exec(compound))) {
    const start = match.index + match[0].length;
    let depth = 1;
    let end = start;
    for (; end < compound.length && depth > 0; end += 1) {
      if (compound[end] === "(") depth += 1;
      if (compound[end] === ")") depth -= 1;
    }
    const inner = compound.slice(start, end - 1);
    if (match[1] !== "where") {
      const best = splitSelectorList(inner)
        .map((s) => analyseSelector(s.trim()).spec)
        .sort(compareSpec)
        .pop();
      if (best) spec = addSpec(spec, best);
    }
    rest = rest.replace(compound.slice(match.index, end), "");
  }
  rest = rest.replace(/\[[^\]]*\]/g, () => {
    spec = addSpec(spec, [0, 1, 0]);
    return "";
  });
  spec = addSpec(spec, [(rest.match(/#[\w-]+/g) ?? []).length, 0, 0]);
  spec = addSpec(spec, [0, (rest.match(/\.[\w-]+/g) ?? []).length, 0]);
  spec = addSpec(spec, [0, 0, (rest.match(/::[\w-]+/g) ?? []).length]);
  spec = addSpec(spec, [
    0,
    (rest.replace(/::[\w-]+/g, "").match(/:[\w-]+/g) ?? []).length,
    0
  ]);
  if (/^[a-zA-Z]/.test(rest)) spec = addSpec(spec, [0, 0, 1]);
  return spec;
}

const addSpec = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const compareSpec = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
const sameSpec = (a, b) => compareSpec(a, b) === 0;

// ---------- properties ----------

const SHORTHANDS = {
  font: [
    "font-style",
    "font-variant",
    "font-weight",
    "font-stretch",
    "font-size",
    "line-height",
    "font-family"
  ],
  inset: ["top", "right", "bottom", "left"],
  "place-items": ["align-items", "justify-items"],
  "place-content": ["align-content", "justify-content"],
  "place-self": ["align-self", "justify-self"],
  gap: ["row-gap", "column-gap"],
  "grid-gap": ["row-gap", "column-gap"],
  flex: ["flex-grow", "flex-shrink", "flex-basis"],
  "flex-flow": ["flex-direction", "flex-wrap"],
  overflow: ["overflow-x", "overflow-y"],
  "grid-area": [
    "grid-row-start",
    "grid-row-end",
    "grid-column-start",
    "grid-column-end"
  ],
  grid: [
    "grid-template-rows",
    "grid-template-columns",
    "grid-template-areas",
    "grid-auto-rows",
    "grid-auto-columns",
    "grid-auto-flow"
  ],
  "text-decoration": [
    "text-decoration-line",
    "text-decoration-color",
    "text-decoration-style",
    "text-decoration-thickness"
  ]
};

// Logical properties resolve to physical ones (horizontal-tb, ltr), so they overlap.
const LOGICAL = [
  [/inline-start/, "left"],
  [/inline-end/, "right"],
  [/block-start/, "top"],
  [/block-end/, "bottom"]
];

function expand(prop) {
  const base = prop.replace(/^-(webkit|moz|ms)-/, "");
  const out = new Set([base, ...(SHORTHANDS[base] ?? [])]);
  for (const name of [...out]) {
    if (name === "inline-size") out.add("width");
    if (name === "block-size") out.add("height");
    if (/^(min|max)-inline-size$/.test(name))
      out.add(name.replace("inline-size", "width"));
    if (/^(min|max)-block-size$/.test(name))
      out.add(name.replace("block-size", "height"));
    for (const [pattern, physical] of LOGICAL)
      if (pattern.test(name)) out.add(name.replace(pattern, physical));
    if (/-inline$/.test(name))
      ["left", "right"].forEach((side) =>
        out.add(name.replace(/inline$/, side))
      );
    if (/-block$/.test(name))
      ["top", "bottom"].forEach((side) =>
        out.add(name.replace(/block$/, side))
      );
    if (name === "inset-inline")
      ["left", "right"].forEach((side) => out.add(side));
    if (name === "inset-block")
      ["top", "bottom"].forEach((side) => out.add(side));
  }
  return out;
}

function propsOverlap(a, b) {
  if (a === "all" || b === "all") return true;
  const ea = expand(a);
  const eb = expand(b);
  for (const x of ea)
    for (const y of eb)
      if (x === y || x.startsWith(`${y}-`) || y.startsWith(`${x}-`))
        return true;
  return false;
}

// What each shorthand resets, spelled out. Prefix matching is wrong here:
// `border` does not reset `border-radius`, `outline` does not reset
// `outline-offset` — trusting the prefix dropped `border-radius: 999px` from
// the /network node dots (caught by the computed-style diff, 2026-09-28).
const SIDES = ["top", "right", "bottom", "left"];
const RESETS = {
  ...SHORTHANDS,
  margin: SIDES.map((s) => `margin-${s}`),
  padding: SIDES.map((s) => `padding-${s}`),
  border: [
    "border-width",
    "border-style",
    "border-color",
    ...SIDES.flatMap((s) => [
      `border-${s}`,
      `border-${s}-width`,
      `border-${s}-style`,
      `border-${s}-color`
    ]),
    "border-image"
  ],
  ...Object.fromEntries(
    SIDES.map((s) => [
      `border-${s}`,
      [`border-${s}-width`, `border-${s}-style`, `border-${s}-color`]
    ])
  ),
  "border-width": SIDES.map((s) => `border-${s}-width`),
  "border-style": SIDES.map((s) => `border-${s}-style`),
  "border-color": SIDES.map((s) => `border-${s}-color`),
  "border-radius": ["top-left", "top-right", "bottom-right", "bottom-left"].map(
    (c) => `border-${c}-radius`
  ),
  background: [
    "background-color",
    "background-image",
    "background-position",
    "background-position-x",
    "background-position-y",
    "background-size",
    "background-repeat",
    "background-origin",
    "background-clip",
    "background-attachment"
  ],
  outline: ["outline-color", "outline-style", "outline-width"],
  "list-style": ["list-style-type", "list-style-position", "list-style-image"],
  transition: [
    "transition-property",
    "transition-duration",
    "transition-timing-function",
    "transition-delay"
  ],
  columns: ["column-width", "column-count"]
};

// does a declaration of `later` fully replace one of `earlier`?
function covers(later, earlier) {
  if (later === earlier) return true;
  if (earlier.startsWith("-") || later.startsWith("-")) return false;
  const resets = RESETS[later];
  return Boolean(resets && resets.includes(earlier));
}

// A later value is a possible fallback target — i.e. the earlier declaration
// may be what a browser uses when it rejects the later one — only if the later
// value uses something newer that the earlier one does not.
const RISKY_TOKENS =
  /\b(?:min|max|clamp|color-mix|env|round)\(|\b\d*d?[svl]v[hw]\b|fit-content|-webkit-[\w-]+|-moz-[\w-]+|\bsubgrid\b|oklch\(|\blh\b/g;
const riskyTokens = (value) =>
  new Set((value.match(RISKY_TOKENS) ?? []).map((t) => t.replace(/^\d+/, "")));
function mayBeFallback(earlierValue, laterValue) {
  const earlier = riskyTokens(earlierValue);
  return [...riskyTokens(laterValue)].some((token) => !earlier.has(token));
}

// ---------- media ----------

function mediaRange(media) {
  let min = 0;
  let max = Infinity;
  for (const query of media) {
    for (const m of query.matchAll(/\((min|max)-width:\s*(\d+)px\)/g)) {
      const value = Number(m[2]);
      if (m[1] === "min") min = Math.max(min, value);
      else max = Math.min(max, value);
    }
  }
  return [min, max];
}

function mediaOverlap(a, b) {
  const [minA, maxA] = mediaRange(a.media);
  const [minB, maxB] = mediaRange(b.media);
  return Math.max(minA, minB) <= Math.min(maxA, maxB);
}

// ---------- co-occurrence ----------

function loadCooccurrence(domCapturePath) {
  const sets = [];
  if (domCapturePath) {
    const capture = JSON.parse(readFileSync(domCapturePath, "utf8"));
    const seen = new Set();
    for (const page of Object.values(capture.pages)) {
      for (const [key] of page.elements) {
        const classPart = key
          .split("::")[0]
          .split(":")
          .slice(1)
          .join(":")
          .split(".")
          .slice(1)
          .filter(Boolean);
        const tag = key.split(":")[1].split(".")[0];
        const id = `${tag}|${classPart.sort().join(" ")}`;
        if (!seen.has(id)) {
          seen.add(id);
          sets.push({ tag, classes: new Set(classPart) });
        }
      }
    }
  }
  // className expressions in the source: every class-like token inside one
  // attribute may end up on the same element.
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx$/.test(entry.name)) {
        const text = readFileSync(full, "utf8");
        for (const m of text.matchAll(/className=(\{|")/g)) {
          const start = m.index + m[0].length;
          let end = start;
          if (m[1] === '"') end = text.indexOf('"', start);
          else {
            let depth = 1;
            for (; end < text.length && depth > 0; end += 1) {
              if (text[end] === "{") depth += 1;
              if (text[end] === "}") depth -= 1;
            }
          }
          const tokens =
            text
              .slice(start, end)
              .match(
                /[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:__[a-z0-9-]+)?(?:--[a-z0-9-]+)?/g
              ) ?? [];
          sets.push({ tag: null, classes: new Set(tokens) });
        }
      }
    }
  };
  walk("src");
  return sets;
}

// Pairs a person has checked cannot match one element, where the checker cannot
// tell because it only sees the subject's own classes, not its ancestors. Each
// entry needs its reason; the computed-style diff still has to read 0.
const REVIEWED_DISJOINT = [
  [
    ".top-nav",
    ".workspace-object-hero > *",
    "TopNav is rendered once by the root layout, never as a child of a page hero"
  ]
];

function canComatch(r, s, cooccurrence) {
  if (
    REVIEWED_DISJOINT.some(
      ([a, b]) =>
        (a === r.text && b === s.text) || (a === s.text && b === r.text)
    )
  ) {
    return false;
  }
  if (r.pseudoElement !== s.pseudoElement) return false;
  if (r.tag && s.tag && r.tag !== s.tag) return false;
  const union = new Set([...r.classes, ...s.classes]);
  if (union.size <= 1) return true;
  const tag = r.tag ?? s.tag;
  return cooccurrence.some(
    (set) =>
      (!tag || !set.tag || set.tag === tag) &&
      [...union].every((name) => set.classes.has(name))
  );
}

// ---------- conflicts ----------

function conflicts(a, b, cooccurrence) {
  if (!mediaOverlap(a, b)) return false;
  for (const da of a.decls) {
    for (const db of b.decls) {
      if (da.important !== db.important) continue;
      if (!propsOverlap(da.prop, db.prop)) continue;
      for (const ra of a.branches) {
        for (const rb of b.branches) {
          if (sameSpec(ra.spec, rb.spec) && canComatch(ra, rb, cooccurrence)) {
            return `${da.prop} in "${ra.text}" vs ${db.prop} in "${rb.text}"`;
          }
        }
      }
    }
  }
  return false;
}

// New order: moved items go, in original order, right after the last item of
// file slot `slot` (or at the start for slot -1).
function newOrder(items, files, movedSet, slot) {
  const fileIndex = new Map(files.map((f, i) => [f, i]));
  const keyOf = (item) =>
    movedSet.has(item)
      ? [slot + 0.5, item.order]
      : [fileIndex.get(item.file), item.order];
  return new Map(items.map((item) => [item, keyOf(item)]));
}

const before = (ka, kb) => ka[0] - kb[0] || ka[1] - kb[1];

function findConflicts(items, files, movedSet, slot, cooccurrence) {
  const order = newOrder(items, files, movedSet, slot);
  const problems = [];
  for (const moved of movedSet) {
    for (const other of items) {
      if (other === moved) continue;
      const originallyBefore = moved.order < other.order;
      const nowBefore = before(order.get(moved), order.get(other)) < 0;
      if (originallyBefore === nowBefore) continue;
      if (movedSet.has(other) && moved.order > other.order) continue; // count each moved pair once
      const reason = conflicts(moved, other, cooccurrence);
      if (reason) problems.push({ moved, other, reason });
    }
  }
  return problems;
}

function planComponent(items, files, roots, cooccurrence, fixedSlot = -2) {
  const candidates = items.filter(
    (item) =>
      item.branches.length &&
      item.branches.every((b) => b.root && roots.includes(b.root))
  );
  let best = null;
  // A file that already exists keeps its place: its rules and the new ones are
  // rebuilt there, in original relative order.
  const slots =
    fixedSlot >= -1
      ? [fixedSlot]
      : Array.from({ length: files.length + 1 }, (_, i) => i - 1);
  for (const slot of slots) {
    const moved = new Set(candidates);
    let problems = [];
    for (let guard = 0; guard < 50; guard += 1) {
      problems = findConflicts(items, files, moved, slot, cooccurrence);
      if (problems.length === 0) break;
      for (const p of problems) moved.delete(p.moved);
    }
    const score = candidates.length - moved.size;
    if (
      !best ||
      score < best.score ||
      (score === best.score && slot > best.slot)
    ) {
      best = { slot, moved, score, candidates };
    }
    if (
      score === 0 &&
      slot >= Math.max(...candidates.map((c) => files.indexOf(c.file)))
    )
      break;
  }
  best.stayed = best.candidates.filter((c) => !best.moved.has(c));
  best.stayReasons = new Map();
  if (best.stayed.length) {
    // explain each stayed rule: what it would cross if moved alone
    for (const item of best.stayed) {
      const trial = new Set([...best.moved, item]);
      const p = findConflicts(
        items,
        files,
        trial,
        best.slot,
        cooccurrence
      ).find((x) => x.moved === item);
      best.stayReasons.set(
        item,
        p ? `${p.reason} (${p.other.file})` : "unknown"
      );
    }
  }
  return best;
}

// ---------- dead declarations & consolidation ----------

const sameSelectorAndMedia = (a, b) =>
  a.mediaKey === b.mediaKey &&
  a.branches.length === b.branches.length &&
  a.branches.every((branch, k) => branch.text === b.branches[k].text);

const describe = (item, decl) =>
  `${item.branches.map((b) => b.text).join(", ")}${item.mediaKey ? ` @ ${item.mediaKey}` : ""} { ${decl.prop}: ${decl.value} }`;

function refresh(entry) {
  Object.assign(entry, makeItem(entry.node, entry.file, entry.media));
}

// A declaration is dead when a later rule with the same selector and media
// (or a later declaration in the same rule) sets a property covering it.
function removeDead(entries) {
  const removed = [];
  entries.forEach((entry, i) => {
    // One removal per pass, always over the current declaration list: removing
    // a node and re-reading the rule invalidates any list taken before it.
    for (;;) {
      const dead = entry.decls.find((decl, index) => {
        const killedBy = (d) =>
          d !== decl &&
          covers(d.prop, decl.prop) &&
          (d.important || !decl.important) &&
          !mayBeFallback(decl.value, d.value);
        return (
          entry.decls.slice(index + 1).some(killedBy) ||
          entries
            .slice(i + 1)
            .some(
              (later) =>
                sameSelectorAndMedia(later, entry) && later.decls.some(killedBy)
            )
        );
      });
      if (!dead) break;
      removed.push({
        text: describe(entry, dead),
        selectors: entry.branches.map((b) => b.text),
        mediaKey: entry.mediaKey,
        prop: dead.prop,
        value: dead.value,
        important: dead.important
      });
      dead.node.remove();
      refresh(entry);
    }
  });
  return removed;
}

// Independent re-check of one removal against the original, unmodified rules:
// the declaration must exist, and some declaration after it (later in its own
// rule, or in a later rule with the same selectors and media) must replace it.
// The verifier's own, deliberately smaller idea of "replaces": the same
// property, or one of these hand-listed pairs. It must not call covers() —
// the first version did, and so shared its border-radius bug.
const VERIFY_SHORTHAND_OF = {
  "margin-top": "margin",
  "margin-right": "margin",
  "margin-bottom": "margin",
  "margin-left": "margin",
  "padding-top": "padding",
  "padding-right": "padding",
  "padding-bottom": "padding",
  "padding-left": "padding",
  "background-color": "background",
  "background-image": "background",
  "border-color": "border",
  "border-width": "border",
  "border-style": "border",
  "row-gap": "gap",
  "column-gap": "gap"
};
const verifyReplaces = (laterProp, earlierProp) =>
  laterProp === earlierProp || VERIFY_SHORTHAND_OF[earlierProp] === laterProp;

function verifyRemoval(record, originalItems) {
  const flat = [];
  for (const item of originalItems) {
    const texts = item.branches.map((b) => b.text);
    if (item.mediaKey !== record.mediaKey) continue;
    if (
      texts.length !== record.selectors.length ||
      texts.some((t, k) => t !== record.selectors[k])
    )
      continue;
    for (const decl of item.decls) flat.push(decl);
  }
  for (let i = 0; i < flat.length; i += 1) {
    const d = flat[i];
    if (
      d.prop !== record.prop ||
      d.value !== record.value ||
      d.important !== record.important
    )
      continue;
    const replaced = flat
      .slice(i + 1)
      .some(
        (later) =>
          verifyReplaces(later.prop, d.prop) &&
          (later.important || !d.important) &&
          !mayBeFallback(d.value, later.value)
      );
    if (replaced) return true;
  }
  return false;
}

// Fold a rule into the first earlier rule with the same selector and media,
// when no rule between them conflicts with it (it would now come before them).
function consolidate(entries, cooccurrence) {
  let merged = 0;
  for (let i = 1; i < entries.length; i += 1) {
    const entry = entries[i];
    const target = entries
      .slice(0, i)
      .findIndex((e) => sameSelectorAndMedia(e, entry));
    if (target < 0) continue;
    const between = entries.slice(target + 1, i);
    if (between.some((other) => conflicts(entry, other, cooccurrence)))
      continue;
    const into = entries[target];
    for (const comment of entry.comments) {
      const c = comment.clone();
      c.raws.before = "\n  ";
      into.node.append(c);
    }
    entry.node.each((child) => {
      const c = child.clone();
      c.raws.before = "\n  ";
      into.node.append(c);
    });
    refresh(into);
    entries.splice(i, 1);
    i -= 1;
    merged += 1;
  }
  return merged;
}

// ---------- apply ----------

function writeComponent(name, plan, cooccurrence) {
  const moved = plan.candidates.filter((c) => plan.moved.has(c));
  const touched = new Set();
  const entries = moved.map((item) => {
    // a comment directly above the rule (no blank line between) travels with it
    const prev = item.node.prev();
    const attached =
      prev &&
      prev.type === "comment" &&
      !/\n\s*\n/.test(item.node.raws.before ?? "")
        ? prev
        : null;
    const node = item.node.clone();
    node.raws.before = "\n\n";
    // a "Stays here" note from an earlier run is dropped once its rule can move
    // Neither a "Stays here" note from an earlier run (dropped once its rule
    // can move) nor a generated file's own header belongs to the rule below it;
    // carrying the header duplicated it on every rebuild.
    const carried =
      attached &&
      !attached.text.startsWith("Stays here") &&
      !/^[\w/-]+: every rule whose subject/.test(attached.text)
        ? attached
        : null;
    const entry = {
      node,
      file: item.file,
      media: item.media,
      comments: carried ? [carried.clone()] : []
    };
    refresh(entry);
    attached?.remove();
    removeWithEmptyParents(item.node, touched, item.file);
    return entry;
  });

  const removed = removeDead(entries);
  const merged = consolidate(entries, cooccurrence);
  removed.push(...removeDead(entries));

  const out = postcss.root();
  let mediaNode = null;
  let currentMedia = null;
  for (const entry of entries) {
    if (entry.node.nodes.length === 0) continue;
    if (entry.media.length > 1) throw new Error("nested @media not supported");
    let target = out;
    if (entry.mediaKey) {
      if (currentMedia !== entry.mediaKey) {
        mediaNode = postcss.atRule({
          name: "media",
          params: entry.media[0],
          raws: { before: "\n\n" }
        });
        out.append(mediaNode);
        currentMedia = entry.mediaKey;
      }
      target = mediaNode;
    } else {
      currentMedia = null;
    }
    for (const comment of entry.comments) {
      const c = comment.clone();
      c.raws.before = "\n\n";
      target.append(c);
      entry.node.raws.before = "\n";
    }
    target.append(entry.node);
  }

  // postcss drops `raws.before` on clone, so spacing is set here: a blank line
  // between sibling blocks, none between a comment and the block it describes.
  const space = (container, indent) => {
    container.nodes.forEach((node, i) => {
      if (i === 0) return;
      const prev = container.nodes[i - 1];
      node.raws.before =
        prev.type === "comment" ? `\n${indent}` : `\n\n${indent}`;
    });
    container.each((node) => {
      if (node.type === "atrule" && node.nodes) space(node, `${indent}  `);
    });
  };
  space(out, "");
  mkdirSync(path.dirname(path.join(STYLES, `${name}.css`)), {
    recursive: true
  });
  // keep the layer files an earlier run gathered from, when rebuilding a file
  const target = path.join(STYLES, `${name}.css`);
  let previous = [];
  try {
    const match = readFileSync(target, "utf8").match(
      /Gathered 2026-09-28 from ([^\n]+)/
    );
    if (match) previous = match[1].split(",").map((s) => s.trim());
  } catch {
    // a new file
  }
  const sources = [
    ...new Set([
      ...previous,
      ...moved.map((m) => m.file).filter((f) => !f.includes("/"))
    ])
  ]
    .sort()
    .join(", ");
  const header = `/* ${name}: every rule whose subject is this component.\n   Gathered 2026-09-28 from ${sources}\n   by scripts/css-regroup.mjs, which checks each move against the cascade. */\n`;
  writeFileSync(
    path.join(STYLES, `${name}.css`),
    `${header}${out.toString()}\n`
  );
  return { removed, merged, touched };
}

function removeWithEmptyParents(node, touched, file) {
  const parent = node.parent;
  node.remove();
  touched.add(file);
  if (parent && parent.type === "atrule" && parent.nodes.length === 0)
    parent.remove();
}

// ---------- main ----------

const [command, ...specs] = process.argv.slice(2);
const domFlag = specs.indexOf("--dom");
const domPath = domFlag >= 0 ? specs.splice(domFlag, 2)[1] : null;
const components = specs.map((spec) => {
  const [name, rootList] = spec.split("=");
  return { name, roots: rootList.split(",") };
});
if (!["plan", "apply"].includes(command) || components.length === 0) {
  console.error(
    "usage: css-regroup.mjs plan|apply [--dom capture.json] <name>=<root>[,<root>] …"
  );
  process.exit(2);
}

const cooccurrence = loadCooccurrence(domPath);
for (const component of components) {
  const files = importList();
  const { roots, items } = loadAll(files);
  const existing = files.indexOf(`${component.name}.css`);
  const plan = planComponent(
    items,
    files,
    component.roots,
    cooccurrence,
    existing >= 0 ? existing : -2
  );
  const fromFiles = [...new Set(plan.candidates.map((c) => c.file))];
  console.log(
    `\n${component.name}: ${plan.candidates.length} rules in ${fromFiles.length} files → slot after ${files[plan.slot] ?? "(start)"}; ${plan.moved.size} move, ${plan.stayed.length} stay`
  );
  for (const [item, reason] of plan.stayReasons) {
    console.log(
      `  stays: ${item.file} "${item.selectors.join(", ").slice(0, 70)}" — ${reason}`
    );
  }
  if (command === "apply" && plan.moved.size > 0) {
    // Rebuilding an existing file writes only the moved rules; a rule of that
    // file judged unable to move would be lost with the old version of it.
    const lost = plan.stayed.filter(
      (item) => item.file === `${component.name}.css`
    );
    if (lost.length) {
      throw new Error(
        `refusing to rebuild ${component.name}.css: ${lost.length} of its own rules could not stay in place`
      );
    }
    const { removed, merged, touched } = writeComponent(
      component.name,
      plan,
      cooccurrence
    );
    const unproven = removed.filter((record) => !verifyRemoval(record, items));
    if (unproven.length) {
      throw new Error(
        `refusing to write: ${unproven.length} removals not confirmed by the independent check:\n` +
          unproven.map((r) => `  ${r.text}`).join("\n") +
          `\n(${component.name}.css was already written; restore with git)`
      );
    }
    // Leave a note on every rule that could not move, where it stays — for rules
    // aimed at the component's own classes. A bare-tag rule (`.x h1`) was only
    // ever attributed by its nearest class, and one that cannot move is simply
    // where it always was; noting all of them added 172 comments.
    for (const [item, reason] of plan.stayReasons) {
      if (!item.branches.every((b) => b.classes.length > 0)) continue;
      const prev = item.node.prev();
      if (prev && prev.type === "comment" && prev.text.startsWith("Stays here"))
        continue;
      const note = postcss.comment({
        text: `Stays here, not in ${component.name}.css: it would move past a rule it can tie with (${reason}).`,
        raws: { before: item.node.raws.before, left: " ", right: " " }
      });
      item.node.raws.before = "\n";
      item.node.before(note);
      touched.add(item.file);
    }
    for (const file of touched) {
      // the target was just rewritten whole; its old tree is only leftovers
      if (file === `${component.name}.css`) continue;
      writeFileSync(path.join(STYLES, file), roots.get(file).toString());
    }
    const importLine = `@import "./styles/${component.name}.css";`;
    const anchor =
      plan.slot >= 0 ? `@import "./styles/${files[plan.slot]}";` : null;
    let globals = readFileSync(GLOBALS, "utf8");
    const eol = globals.includes("\r\n") ? "\r\n" : "\n";
    globals = anchor
      ? globals.replace(anchor, `${anchor}${eol}${importLine}`)
      : globals.replace(/@import/, `${importLine}${eol}@import`);
    if (existing < 0) writeFileSync(GLOBALS, globals);
    console.log(
      `  wrote ${component.name}.css; merged ${merged} rules; dropped ${removed.length} dead declarations`
    );
    for (const record of removed) console.log(`    dead: ${record.text}`);
  }
}
