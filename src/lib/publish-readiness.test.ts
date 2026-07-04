import { describe, expect, it } from "vitest";

import { evaluateTechnologyPublishReadiness } from "@/lib/publish-readiness";
import { makeWorkspaceRecord } from "@/lib/test-factories";

// Isolate from bundled data by passing empty published/workspace sets, so the
// duplicate-slug check only sees what each test sets up explicitly.
function evaluate(
  record = makeWorkspaceRecord(),
  others: ReturnType<typeof makeWorkspaceRecord>[] = []
) {
  return evaluateTechnologyPublishReadiness(record, others, []);
}

function codes(issues: { code: string }[]): string[] {
  return issues.map((issue) => issue.code);
}

describe("evaluateTechnologyPublishReadiness", () => {
  it("treats a complete record as ready with no blocking errors", () => {
    const result = evaluate();

    expect(result.isReady).toBe(true);
    expect(result.blockingErrors).toHaveLength(0);
  });

  it("blocks publication when required fields are missing", () => {
    const record = makeWorkspaceRecord({
      title: { original: "" },
      summary: { original: "" },
      slug: ""
    });

    const result = evaluate(record);

    expect(result.isReady).toBe(false);
    expect(codes(result.blockingErrors)).toEqual(
      expect.arrayContaining([
        "missing-title",
        "missing-summary",
        "missing-slug"
      ])
    );
  });

  it("blocks an invalid source URL and an invalid publish date", () => {
    const record = makeWorkspaceRecord({
      sourceUrl: "not-a-url",
      publishDate: "05/20/2026"
    });

    const result = evaluate(record);

    expect(result.isReady).toBe(false);
    const blockingCodes = codes(result.blockingErrors);
    expect(blockingCodes).toContain("invalid-source-url");
    expect(blockingCodes).toContain("invalid-publish-date");
  });

  it("flags a duplicate slug against another existing record", () => {
    const record = makeWorkspaceRecord({ id: "tech-a", slug: "shared-slug" });
    const other = makeWorkspaceRecord({ id: "tech-b", slug: "shared-slug" });

    const result = evaluate(record, [other]);

    expect(result.isReady).toBe(false);
    expect(codes(result.blockingErrors)).toContain("duplicate-slug");
  });
});
