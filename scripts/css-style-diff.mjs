// Site-wide computed-style diff for structural CSS changes.
//
//   node scripts/css-style-diff.mjs capture <out.json> [--routes-from <capture.json>] [--probe "<css>"]
//   node scripts/css-style-diff.mjs diff <before.json> <after.json>
//
// `capture` visits every route at 1440 light, 1440 dark and 390 light, and
// records, for every element and every rendered ::before / ::after, the full
// computed style (every longhand Chromium enumerates) plus its bounding box.
// It also records the exact CSS text each page received, so a change that no
// captured state exercises (hover, focus, an open panel) still shows up as a
// stylesheet difference.
//
// `diff` compares two captures element by element. The method, and the ways
// it has lied before, are in docs/design-system.md → "The diff harness was
// wrong twice…" and "Splitting globals.css". Before trusting a clean result:
// capture the same build twice (the noise floor must be 0), and capture once
// with --probe (it must report differences). Run captures one at a time —
// in parallel, /network read differently between two captures of one build.
//
// Run it against a server of its own — never the live one on port 3000:
//   BASE_URL=http://127.0.0.1:3100 (the default). LOCAL_DATA_DIR is not read
//   here; point the server at a copy of the data, because some workspace pages
//   write on first render, and set EMBEDDING_REMOTE_HOST to an unreachable
//   address so /search answers from keywords instead of downloading a model.
//   Uses the installed Chrome (BROWSER_CHANNEL to change). From Git Bash, set
//   MSYS_NO_PATHCONV=1 or `--only /skills` arrives as a Windows path.
import { chromium } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const baseUrl = (process.env.BASE_URL ?? "http://127.0.0.1:3100").replace(
  /\/$/,
  ""
);
const workspaceToken = process.env.WORKSPACE_ACCESS_TOKEN?.trim();

// Never rendered. Next streams them into <body> when a render is slow, so
// whether they appear there depends on timing, not on the code.
const METADATA_TAGS = new Set(["title", "meta", "link", "base"]);
const withoutIndex = (key) => key.replace(/^\d+:/, "");
const renderable = (elements) =>
  elements.filter(
    ([key]) => !METADATA_TAGS.has(withoutIndex(key).split(/[.:]/)[0])
  );

if (new URL(baseUrl).port === "3000") {
  console.error("Refusing to run against port 3000: that is the live site.");
  process.exit(2);
}

const modes = [
  { id: "1440-light", width: 1440, height: 1000, colorScheme: "light" },
  { id: "1440-dark", width: 1440, height: 1000, colorScheme: "dark" },
  { id: "390-light", width: 390, height: 844, colorScheme: "light" }
];

// Fixed routes, then "take the first N links under this prefix from that page"
// for every dynamic segment, so the route list follows the data instead of
// hardcoding slugs. The resolved list is stored in the capture; pass
// --routes-from to make a second capture visit exactly the same pages.
const fixedRoutes = [
  "/",
  "/technologies",
  "/technologies?view=news",
  "/technologies?view=timeline",
  "/technologies?view=followed",
  "/technologies?view=saved",
  "/digest",
  "/digest/today",
  "/digest/weekly",
  "/skills",
  "/knowledge",
  "/network",
  "/search",
  "/search?q=agent",
  "/ask",
  "/workspace",
  "/workspace/editorial-round",
  "/workspace/candidates",
  "/workspace/duplicates",
  "/workspace/technologies",
  "/workspace/skills",
  "/workspace/skills/new",
  "/workspace/knowledge",
  "/workspace/knowledge/new",
  "/workspace/sources",
  "/workspace/sources/new",
  "/workspace/digests",
  "/workspace/delivery",
  "/workspace/delivery/schedules",
  "/workspace/operations",
  "/workspace/operations/events"
];

const discovery = [
  { from: "/technologies", pattern: /^\/technologies\/[^/?#]+$/, take: 6 },
  { from: "/skills", pattern: /^\/skills\/[^/?#]+$/, take: 4 },
  { from: "/knowledge", pattern: /^\/knowledge\/[^/?#]+$/, take: 4 },
  { from: "/network", pattern: /^\/topics\/[^/?#]+$/, take: 0 },
  { from: "/digest", pattern: /^\/digest\/\d{4}-\d{2}-\d{2}$/, take: 2 },
  { from: "/digest/weekly", pattern: /^\/digest\/weekly\/[^/?#]+$/, take: 2 },
  {
    from: "/workspace/candidates",
    pattern: /^\/workspace\/candidates\/[^/?#]+$/,
    take: 2
  },
  {
    from: "/workspace/duplicates",
    pattern: /^\/workspace\/duplicates\/[^/?#]+$/,
    take: 1
  },
  {
    from: "/workspace/technologies",
    pattern: /^\/workspace\/technologies\/[^/?#]+$/,
    take: 2
  },
  {
    from: "/workspace/technologies",
    pattern: /^\/workspace\/technologies\/[^/?#]+\/preview$/,
    take: 1
  },
  {
    from: "/workspace/skills",
    pattern: /^\/workspace\/skills\/(?!new$)[^/?#]+$/,
    take: 1
  },
  {
    from: "/workspace/knowledge",
    pattern: /^\/workspace\/knowledge\/(?!new$)[^/?#]+$/,
    take: 1
  },
  {
    from: "/workspace/sources",
    pattern: /^\/workspace\/sources\/(?!new$)[^/?#]+$/,
    take: 1
  },
  {
    from: "/workspace/digests",
    pattern: /^\/workspace\/digests\/[^/?#]+$/,
    take: 1
  },
  {
    from: "/workspace/digests",
    pattern: /^\/workspace\/digests\/[^/?#]+\/preview$/,
    take: 1
  }
];

// Topic hubs are linked from detail pages' tag chips, not from an index.
const topicDiscovery = { pattern: /^\/topics\/[^/?#]+$/, take: 3 };

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value.startsWith("--")) {
      flags[value.slice(2)] = argv[index + 1];
      index += 1;
    } else {
      positional.push(value);
    }
  }
  return { positional, flags };
}

// Some workspace pages never go network-idle (link prefetches keep arriving),
// so wait for `load` and then give the network a bounded chance to go quiet.
async function load(page, route) {
  const response = await page.goto(`${baseUrl}${route}`, {
    waitUntil: "load",
    timeout: 60000
  });
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  return response;
}

async function linksOn(page, route) {
  await load(page, route);
  return page.evaluate(() =>
    Array.from(document.querySelectorAll("a[href]")).map((anchor) =>
      anchor.getAttribute("href")
    )
  );
}

async function discoverRoutes(context) {
  const page = await context.newPage();
  const routes = [...fixedRoutes];
  const pick = (hrefs, pattern, take) =>
    [...new Set(hrefs.filter((href) => href && pattern.test(href)))].slice(
      0,
      take
    );

  for (const rule of discovery) {
    if (rule.take === 0) continue;
    const found = pick(await linksOn(page, rule.from), rule.pattern, rule.take);
    if (found.length === 0)
      console.warn(`  no ${rule.pattern} links on ${rule.from}`);
    routes.push(...found);
  }

  const topicHrefs = [];
  for (const route of routes.filter((r) =>
    /^\/(technologies|skills|knowledge)\/[^/?]+$/.test(r)
  )) {
    topicHrefs.push(...(await linksOn(page, route)));
  }
  routes.push(...pick(topicHrefs, topicDiscovery.pattern, topicDiscovery.take));

  await page.close();
  return [...new Set(routes)];
}

// Runs in the page. Returns every element (document order) and every rendered
// pseudo-element, each with its computed style as an array aligned to `props`.
function snapshotPage() {
  // Chrome also enumerates the custom properties in scope, and which ones are
  // in scope changes with the viewport (tokens redefined under @media). They
  // are left out; a token change still shows through every property using it.
  const props = Array.from(getComputedStyle(document.documentElement)).filter(
    (name) => !name.startsWith("--")
  );
  const read = (style) => props.map((name) => style.getPropertyValue(name));
  const round = (value) => Math.round(value * 100) / 100;
  const elements = [];
  // <head> is left out: nothing in it renders, and Next inserts a varying
  // number of <link> tags there, which shifted every index after it.
  const all = [
    document.documentElement,
    ...document.body.querySelectorAll("*")
  ];
  all.splice(1, 0, document.body);

  for (let index = 0; index < all.length; index += 1) {
    const element = all[index];
    const tag = element.tagName.toLowerCase();
    if (
      tag === "script" ||
      tag === "noscript" ||
      tag === "template" ||
      tag === "style" ||
      // METADATA_TAGS, repeated: this function runs in the page
      ["title", "meta", "link", "base"].includes(tag)
    )
      continue;
    const rect = element.getBoundingClientRect();
    const key = `${index}:${tag}.${String(element.getAttribute("class") ?? "")
      .trim()
      .replace(/\s+/g, ".")}`;
    elements.push({
      key,
      box: [
        round(rect.x),
        round(rect.y + window.scrollY),
        round(rect.width),
        round(rect.height)
      ],
      style: read(getComputedStyle(element))
    });
    for (const pseudo of ["::before", "::after"]) {
      const style = getComputedStyle(element, pseudo);
      const content = style.getPropertyValue("content");
      if (content && content !== "none" && content !== "normal") {
        elements.push({
          key: `${key}${pseudo}`,
          box: null,
          style: read(style)
        });
      }
    }
  }

  return {
    props,
    elements,
    scroll: [
      document.documentElement.scrollWidth,
      document.documentElement.scrollHeight
    ],
    stylesheets: Array.from(
      document.querySelectorAll('link[rel="stylesheet"]')
    ).map((link) => link.href),
    inlineStyles: Array.from(document.querySelectorAll("style")).map(
      (style) => style.textContent ?? ""
    )
  };
}

async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    for (const animation of document.getAnimations()) {
      try {
        animation.finish();
      } catch {
        // infinite animations cannot finish; they are left where they are
      }
    }
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    );
  });
}

async function capture(outPath, flags) {
  // The installed Chrome, not a Playwright download; override with
  // BROWSER_CHANNEL (e.g. "msedge", or "" for Playwright's own Chromium).
  const channel = process.env.BROWSER_CHANNEL ?? "chrome";
  const browser = await chromium.launch({
    headless: true,
    ...(channel ? { channel } : {})
  });
  const headers = workspaceToken
    ? { Authorization: `Bearer ${workspaceToken}` }
    : {};
  const discoveryContext = await browser.newContext({
    extraHTTPHeaders: headers
  });

  let routes = flags["routes-from"]
    ? JSON.parse(await readFile(flags["routes-from"], "utf8")).routes
    : await discoverRoutes(discoveryContext);
  // --only <substring>: capture just the matching routes (for re-checking one)
  if (flags.only) routes = routes.filter((route) => route.includes(flags.only));
  await discoveryContext.close();
  console.log(`${routes.length} routes × ${modes.length} modes`);

  const styleIndex = new Map();
  const styleTable = [];
  const cssTexts = {};
  const pages = {};
  let props;

  for (const mode of modes) {
    const context = await browser.newContext({
      viewport: { width: mode.width, height: mode.height },
      deviceScaleFactor: 1,
      colorScheme: mode.colorScheme,
      reducedMotion: "reduce",
      extraHTTPHeaders: headers
    });
    const page = await context.newPage();

    for (const route of routes) {
      const response = await load(page, route);
      await settle(page);
      if (flags.probe) await page.addStyleTag({ content: flags.probe });
      if (flags.probe) await settle(page);
      const snapshot = await page.evaluate(snapshotPage);

      if (props && props.join() !== snapshot.props.join()) {
        throw new Error(
          `Computed-style property list changed on ${mode.id} ${route}`
        );
      }
      props = snapshot.props;

      const cssHashes = [];
      for (const href of snapshot.stylesheets) {
        const text = await (await fetch(href)).text();
        const hash = createHash("sha256")
          .update(text)
          .digest("hex")
          .slice(0, 16);
        cssTexts[hash] = text;
        cssHashes.push(hash);
      }
      for (const text of snapshot.inlineStyles) {
        const hash = createHash("sha256")
          .update(text)
          .digest("hex")
          .slice(0, 16);
        cssTexts[hash] = text;
        cssHashes.push(`inline:${hash}`);
      }

      pages[`${mode.id} ${route}`] = {
        status: response?.status() ?? 0,
        scroll: snapshot.scroll,
        css: cssHashes,
        elements: snapshot.elements.map((element) => {
          const joined = element.style.join("\u0001");
          let styleId = styleIndex.get(joined);
          if (styleId === undefined) {
            styleId = styleTable.length;
            styleIndex.set(joined, styleId);
            styleTable.push(element.style);
          }
          return [element.key, element.box, styleId];
        })
      };
      const status = response?.status() ?? 0;
      console.log(
        `  ${mode.id} ${status} ${route} (${snapshot.elements.length})`
      );
    }
    await context.close();
  }

  await browser.close();
  await writeFile(
    outPath,
    JSON.stringify({
      baseUrl,
      capturedAt: new Date().toISOString(),
      routes,
      props,
      styleTable,
      cssTexts,
      pages
    })
  );
  console.log(
    `Saved ${outPath} (${styleTable.length} distinct computed styles)`
  );
}

async function diff(beforePath, afterPath, flags = {}) {
  // --css-may-change: for refactors that edit the stylesheet on purpose; the
  // computed styles still have to match, the CSS text no longer does.
  const cssMayChange = "css-may-change" in flags;
  const before = JSON.parse(await readFile(beforePath, "utf8"));
  const after = JSON.parse(await readFile(afterPath, "utf8"));

  if (before.props.join() !== after.props.join()) {
    console.log(
      "Property lists differ; were the captures made with different browsers?"
    );
    process.exit(1);
  }

  const cssText = (capture, hash) =>
    capture.cssTexts[hash.replace(/^inline:/, "")];
  const joinedCache = new Map([
    [before, []],
    [after, []]
  ]);
  const joinedStyle = (capture, id) => {
    const cache = joinedCache.get(capture);
    cache[id] ??= capture.styleTable[id].join("\u0001");
    return cache[id];
  };
  let elementCount = 0;
  let pseudoCount = 0;
  let differingElements = 0;
  const findings = [];
  const byProperty = new Map();
  const cssFindings = new Set();

  for (const [pageKey, left] of Object.entries(before.pages)) {
    const right = after.pages[pageKey];
    if (!right) {
      findings.push(`${pageKey}: missing from the second capture`);
      continue;
    }
    if (left.status !== right.status)
      findings.push(`${pageKey}: status ${left.status} → ${right.status}`);
    if (left.scroll.join() !== right.scroll.join()) {
      findings.push(
        `${pageKey}: document size ${left.scroll.join("×")} → ${right.scroll.join("×")}`
      );
    }

    const leftCss = left.css.map((hash) => cssText(before, hash)).join("\n");
    const rightCss = right.css.map((hash) => cssText(after, hash)).join("\n");
    if (leftCss !== rightCss) cssFindings.add(pageKey);

    const leftElements = renderable(left.elements);
    const rightElements = renderable(right.elements);
    if (leftElements.length !== rightElements.length) {
      findings.push(
        `${pageKey}: ${leftElements.length} → ${rightElements.length} elements (DOM differs)`
      );
    }
    const count = Math.min(leftElements.length, rightElements.length);
    for (let index = 0; index < count; index += 1) {
      const [leftKey, leftBox, leftStyle] = leftElements[index];
      const [rightKey, rightBox, rightStyle] = rightElements[index];
      if (leftKey.includes("::")) pseudoCount += 1;
      else elementCount += 1;
      if (withoutIndex(leftKey) !== withoutIndex(rightKey)) {
        findings.push(
          `${pageKey}: element ${index} is ${leftKey} → ${rightKey} (DOM differs)`
        );
        differingElements += 1;
        break;
      }
      const changes = [];
      if (JSON.stringify(leftBox) !== JSON.stringify(rightBox)) {
        changes.push(
          `box ${JSON.stringify(leftBox)} → ${JSON.stringify(rightBox)}`
        );
        byProperty.set("(box)", (byProperty.get("(box)") ?? 0) + 1);
      }
      const a = before.styleTable[leftStyle];
      const b = after.styleTable[rightStyle];
      if (joinedStyle(before, leftStyle) !== joinedStyle(after, rightStyle)) {
        for (let p = 0; p < a.length; p += 1) {
          if (a[p] !== b[p]) {
            changes.push(`${before.props[p]}: ${a[p]} → ${b[p]}`);
            byProperty.set(
              before.props[p],
              (byProperty.get(before.props[p]) ?? 0) + 1
            );
          }
        }
      }
      if (changes.length > 0) {
        differingElements += 1;
        if (findings.length < 60)
          findings.push(
            `${pageKey} ${leftKey}\n      ${changes.slice(0, 6).join("\n      ")}`
          );
      }
    }
  }

  const pageCount = Object.keys(before.pages).length;
  console.log(
    `${pageCount} page captures, ${elementCount} elements + ${pseudoCount} pseudo-elements compared, ${before.props.length} properties each`
  );
  console.log(`differing elements: ${differingElements}`);
  console.log(`pages whose stylesheet text differs: ${cssFindings.size}`);
  if (byProperty.size > 0) {
    const top = [...byProperty.entries()]
      .sort((l, r) => r[1] - l[1])
      .slice(0, 15);
    console.log(
      `most-changed properties: ${top.map(([name, n]) => `${name} ×${n}`).join(", ")}`
    );
  }
  for (const finding of findings) console.log(`  ${finding}`);
  if (cssFindings.size > 0)
    console.log(
      `  stylesheet differs on e.g. ${[...cssFindings].slice(0, 5).join(", ")}`
    );

  process.exit(
    differingElements === 0 &&
      (cssMayChange || cssFindings.size === 0) &&
      findings.length === 0
      ? 0
      : 1
  );
}

const { positional, flags } = parseArgs(process.argv.slice(2));
const [command, first, second] = positional;

if (command === "capture" && first) {
  await capture(first, flags);
} else if (command === "diff" && first && second) {
  await diff(first, second, flags);
} else {
  console.error(
    "usage: css-style-diff.mjs capture <out.json> [--routes-from <capture.json>] [--probe <css>]\n" +
      "       css-style-diff.mjs diff <before.json> <after.json>"
  );
  process.exit(2);
}
