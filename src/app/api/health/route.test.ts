import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

/**
 * The health route is what the external monitor and the deploy script read.
 * Until 2026-10-21 it read the published signals only, so a damaged candidate
 * or digest file left it green while the home page 500ed. These tests pin
 * that every store the home page reads is part of the verdict, and that a
 * failure names the read, not the file.
 */

const reads = vi.hoisted(() => ({
  technologies: vi.fn(),
  skills: vi.fn(),
  knowledge: vi.fn(),
  news: vi.fn(),
  digest: vi.fn()
}));

vi.mock("@/lib/content", () => ({
  getAllTechnologies: reads.technologies,
  getAllSkills: reads.skills,
  getAllKnowledge: reads.knowledge
}));

vi.mock("@/lib/news", () => ({
  getPublicNewsItems: reads.news
}));

vi.mock("@/lib/digest-workflow", () => ({
  getLatestPublishedDailyDigest: reads.digest
}));

vi.mock("@/lib/hybrid-search", () => ({
  getSemanticSearchStatus: () => ({
    model: { state: "idle", since: undefined },
    corpus: "idle"
  })
}));

function healthy() {
  reads.technologies.mockReturnValue(new Array(117));
  reads.skills.mockReturnValue(new Array(22));
  reads.knowledge.mockReturnValue(new Array(27));
  reads.news.mockReturnValue(new Array(33));
  reads.digest.mockReturnValue({ date: "2026-10-20" });
}

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    healthy();
  });

  it("answers ok with the counts the home page would render", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body.status).toBe("ok");
    expect(body.checks.store).toEqual({
      ok: true,
      publishedSignals: 117,
      newsItems: 33,
      latestDigest: "2026-10-20",
      skills: 22,
      knowledge: 27
    });
  });

  it("reports a site with no published digest as ok", async () => {
    reads.digest.mockReturnValue(undefined);

    const body = await (await GET()).json();

    expect(body.status).toBe("ok");
    expect(body.checks.store.latestDigest).toBeNull();
  });

  it("goes degraded when the news lane store does not read", async () => {
    reads.news.mockImplementation(() => {
      throw new Error(
        "本地数据文件无法解析：C:/live/config/imported-candidates.live.json"
      );
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.checks.store).toEqual({ ok: false, failed: ["news"] });
    expect(JSON.stringify(body)).not.toContain("imported-candidates");
  });

  it("goes degraded when the digest store does not read", async () => {
    reads.digest.mockImplementation(() => {
      throw new Error("broken");
    });

    const body = await (await GET()).json();

    expect(body.status).toBe("degraded");
    expect(body.checks.store).toEqual({ ok: false, failed: ["digest"] });
  });

  it("names every failed read when the content pools are down together", async () => {
    const broken = () => {
      throw new Error("broken");
    };

    reads.technologies.mockImplementation(broken);
    reads.skills.mockImplementation(broken);
    reads.knowledge.mockImplementation(broken);

    const body = await (await GET()).json();

    expect(body.checks.store.failed).toEqual([
      "signals",
      "skills",
      "knowledge"
    ]);
  });
});
