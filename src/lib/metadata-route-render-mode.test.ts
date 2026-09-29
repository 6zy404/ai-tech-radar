import { describe, expect, it } from "vitest";

import {
  declaresRenderMode,
  findUndeclaredMetadataRoutes,
  hasDynamicSegment,
  isGeneratedMetadataRoute,
  mustDeclareRenderMode
} from "./metadata-route-render-mode";

const imageSource = `export default async function Image() { return null; }`;
const declared = `export const dynamic = "force-dynamic";\n${imageSource}`;

describe("isGeneratedMetadataRoute", () => {
  it("recognises generated share images, icons, sitemap and manifest", () => {
    for (const filePath of [
      "src/app/digest/today/opengraph-image.tsx",
      "src/app/twitter-image.ts",
      "src/app/icon.tsx",
      "src/app/icon2.tsx",
      "src/app/apple-icon.jsx",
      "src/app/sitemap.ts",
      "src/app/manifest.ts"
    ]) {
      expect(isGeneratedMetadataRoute(filePath), filePath).toBe(true);
    }
  });

  it("ignores static files, robots, pages and look-alike names", () => {
    for (const filePath of [
      "src/app/icon.svg",
      "src/app/opengraph-image.png",
      "src/app/robots.ts",
      "src/app/page.tsx",
      "src/app/opengraph-image-helper.tsx",
      "src/lib/opengraph.ts"
    ]) {
      expect(isGeneratedMetadataRoute(filePath), filePath).toBe(false);
    }
  });
});

describe("hasDynamicSegment", () => {
  it("sees [x], [...x] and [[...x]] in the directories", () => {
    expect(hasDynamicSegment("src/app/skills/[slug]/opengraph-image.tsx")).toBe(
      true
    );
    expect(hasDynamicSegment("src/app/docs/[...path]/icon.tsx")).toBe(true);
    expect(hasDynamicSegment("src/app/docs/[[...path]]/icon.tsx")).toBe(true);
  });

  it("does not count route groups or parallel slots", () => {
    expect(hasDynamicSegment("src/app/(public)/opengraph-image.tsx")).toBe(
      false
    );
    expect(hasDynamicSegment("src/app/@modal/opengraph-image.tsx")).toBe(false);
  });
});

describe("declaresRenderMode", () => {
  it("accepts any dynamic declaration", () => {
    expect(declaresRenderMode(declared)).toBe(true);
    expect(declaresRenderMode(`export const dynamic = "force-static";`)).toBe(
      true
    );
  });

  it("does not mistake dynamicParams for a render-mode declaration", () => {
    expect(declaresRenderMode(`export const dynamicParams = false;`)).toBe(
      false
    );
  });
});

describe("mustDeclareRenderMode", () => {
  it("requires it for a route with no dynamic segment", () => {
    expect(
      mustDeclareRenderMode({
        path: "src/app/digest/weekly/opengraph-image.tsx",
        source: imageSource
      })
    ).toBe(true);
  });

  it("exempts a dynamic-segment route with nothing to prerender", () => {
    expect(
      mustDeclareRenderMode({
        path: "src/app/technologies/[slug]/opengraph-image.tsx",
        source: imageSource
      })
    ).toBe(false);
  });

  it("requires it again once the route lists its params for the build", () => {
    expect(
      mustDeclareRenderMode({
        path: "src/app/technologies/[slug]/opengraph-image.tsx",
        source: `export async function generateStaticParams() { return []; }\n${imageSource}`
      })
    ).toBe(true);
  });
});

describe("findUndeclaredMetadataRoutes", () => {
  it("reports exactly the routes a build could freeze, sorted", () => {
    const result = findUndeclaredMetadataRoutes([
      { path: "src/app/digest/today/opengraph-image.tsx", source: imageSource },
      { path: "src/app/digest/weekly/opengraph-image.tsx", source: declared },
      {
        path: "src/app/skills/[slug]/opengraph-image.tsx",
        source: imageSource
      },
      { path: "src/app/apple-icon.tsx", source: imageSource },
      { path: "src/app/robots.ts", source: "export default function r() {}" },
      { path: "src/app/page.tsx", source: imageSource }
    ]);

    expect(result).toEqual([
      "src/app/apple-icon.tsx",
      "src/app/digest/today/opengraph-image.tsx"
    ]);
  });
});
