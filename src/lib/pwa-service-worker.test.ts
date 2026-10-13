import { describe, expect, it } from "vitest";

import {
  buildServiceWorkerScript,
  pwaRequestKind
} from "@/lib/pwa-service-worker";

const page = (pathname: string, search = "") =>
  pwaRequestKind(pathname, search, true, false, false);

describe("pwaRequestKind", () => {
  it("never touches the workspace, any API, or the legacy internal routes", () => {
    for (const pathname of [
      "/workspace",
      "/workspace/delivery",
      "/workspace/technologies/abc/preview",
      "/api/workspace/push",
      "/api/push/subscribe",
      "/api/ask",
      "/api/health",
      "/candidates/x",
      "/technologies/drafts",
      "/technologies/drafts/x",
      "/sw.js"
    ]) {
      expect(page(pathname)).toBe("bypass");
      expect(pwaRequestKind(pathname, "", false, false, false)).toBe("bypass");
    }
  });

  it("matches whole path segments, not prefixes of names", () => {
    expect(page("/workspaces-of-ai")).toBe("page");
    expect(page("/technologies/drafting-agents")).toBe("page");
    expect(page("/apis")).toBe("page");
  });

  it("serves public pages network-first and leaves RSC fetches alone", () => {
    expect(page("/")).toBe("page");
    expect(page("/technologies/agent-sdk")).toBe("page");
    expect(page("/offline")).toBe("page");
    expect(
      pwaRequestKind("/technologies/agent-sdk", "", true, true, false)
    ).toBe("bypass");
    expect(page("/technologies/agent-sdk", "?_rsc=abc")).toBe("bypass");
    // A non-navigation fetch of a page path (prefetch, feed) is not cached.
    expect(pwaRequestKind("/feed.xml", "", false, false, false)).toBe("bypass");
  });

  it("caches hashed static files in production only", () => {
    expect(
      pwaRequestKind("/_next/static/chunks/app.js", "", false, false, false)
    ).toBe("static");
    expect(
      pwaRequestKind("/_next/static/chunks/app.js", "", false, false, true)
    ).toBe("bypass");
    expect(pwaRequestKind("/icons/icon-192.png", "", false, false, false)).toBe(
      "asset"
    );
    expect(
      pwaRequestKind("/manifest.webmanifest", "", false, false, false)
    ).toBe("asset");
  });
});

describe("buildServiceWorkerScript", () => {
  it("is valid JavaScript carrying the cache version", () => {
    const script = buildServiceWorkerScript("build-abc123", false);

    expect(() => new Function(script)).not.toThrow();
    expect(script).toContain('const VERSION = "build-abc123";');
    expect(script).toContain(
      'const STATIC_CACHE = "radar-static-build-abc123";'
    );
    expect(script).toContain('const SAVED_CACHE = "radar-saved-build-abc123";');
  });

  it("deletes every radar cache but the current build's on activate", () => {
    const script = buildServiceWorkerScript("v2", false);

    expect(script).toMatch(
      /name\.indexOf\("radar-"\) === 0 && CURRENT_CACHES\.indexOf\(name\) === -1/
    );
  });

  it("embeds the same request rule the tests pin", () => {
    const script = buildServiceWorkerScript("v1", true);
    const embedded = new Function("self", `${script}\nreturn pwaRequestKind;`);

    // Run the embedded copy with a stub for the one worker global it touches
    // at the top level.
    const kind = embedded({ addEventListener() {} }) as typeof pwaRequestKind;

    expect(kind("/workspace/x", "", true, false, true)).toBe("bypass");
    expect(kind("/technologies/x", "", true, false, true)).toBe("page");
  });
});
