import { describe, expect, it } from "vitest";

import {
  buildNetworkFocusHref,
  parseNetworkFocusParam,
  resolveNetworkFocus,
  withNetworkFocus
} from "@/lib/network-focus";

const nodes = [
  { id: "tech-mcp" },
  { id: "skill-agent-design" },
  {
    id: "draft-candidate-rss-https-hf-mirror-com-blog-liquidai-lfm2-5-vl-dspark"
  }
];

describe("parseNetworkFocusParam", () => {
  it("returns a trimmed value", () => {
    expect(parseNetworkFocusParam("  tech-mcp ")).toBe("tech-mcp");
  });

  it("takes the first value when the parameter repeats", () => {
    expect(parseNetworkFocusParam(["tech-mcp", "skill-agent-design"])).toBe(
      "tech-mcp"
    );
  });

  it("treats missing, empty and oversized values as absent", () => {
    expect(parseNetworkFocusParam(undefined)).toBeUndefined();
    expect(parseNetworkFocusParam([])).toBeUndefined();
    expect(parseNetworkFocusParam("   ")).toBeUndefined();
    expect(parseNetworkFocusParam("x".repeat(301))).toBeUndefined();
  });
});

describe("resolveNetworkFocus", () => {
  it("accepts an id the graph renders", () => {
    expect(resolveNetworkFocus("skill-agent-design", nodes)).toBe(
      "skill-agent-design"
    );
    expect(resolveNetworkFocus(nodes[2].id, nodes)).toBe(nodes[2].id);
  });

  it("ignores an unknown or unpublished id", () => {
    expect(resolveNetworkFocus("tech-draft-only", nodes)).toBeNull();
  });

  it("does not match on case or partial ids", () => {
    expect(resolveNetworkFocus("TECH-MCP", nodes)).toBeNull();
    expect(resolveNetworkFocus("tech", nodes)).toBeNull();
  });

  it("returns null without a parameter", () => {
    expect(resolveNetworkFocus(undefined, nodes)).toBeNull();
  });
});

describe("buildNetworkFocusHref", () => {
  it("encodes the id as the focus parameter", () => {
    expect(buildNetworkFocusHref("tech-mcp")).toBe("/network?focus=tech-mcp");
    expect(buildNetworkFocusHref("a b&c")).toBe("/network?focus=a+b%26c");
  });

  it("round-trips through the parser", () => {
    const id = nodes[2].id;
    const href = buildNetworkFocusHref(id);
    const value = new URL(href, "http://localhost").searchParams.get("focus");

    expect(resolveNetworkFocus(value ?? undefined, nodes)).toBe(id);
  });
});

describe("withNetworkFocus", () => {
  it("sets, replaces and removes the parameter", () => {
    expect(withNetworkFocus("http://x.test/network", "tech-mcp")).toBe(
      "/network?focus=tech-mcp"
    );
    expect(
      withNetworkFocus("http://x.test/network?focus=tech-mcp", "skill-a")
    ).toBe("/network?focus=skill-a");
    expect(withNetworkFocus("http://x.test/network?focus=tech-mcp", null)).toBe(
      "/network"
    );
  });

  it("keeps other parameters and the hash", () => {
    expect(
      withNetworkFocus("http://x.test/network?utm=a&focus=old#graph", "new")
    ).toBe("/network?utm=a&focus=new#graph");
    expect(withNetworkFocus("/network?utm=a&focus=old", null)).toBe(
      "/network?utm=a"
    );
  });
});
