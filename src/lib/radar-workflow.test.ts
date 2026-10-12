import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyRadarUpdate,
  applyRadarWorkspaceOverlay,
  buildRadarWorkspaceEntries,
  evaluateRadarPublishReadiness,
  getRadarToday
} from "@/lib/radar-workflow";
import type { RadarEntry, RadarWorkspaceRecord } from "@/types/radar";

function makeEntry(overrides: Partial<RadarEntry> = {}): RadarEntry {
  return {
    id: "radar-a",
    name: "条目 A",
    slug: "entry-a",
    quadrant: "inference-deployment",
    ring: "trial",
    ringReason: "两条信号都说明它能用了。",
    evidenceTechnologyIds: ["tech-1", "tech-2"],
    relatedKnowledgeIds: ["knowledge-a"],
    relatedSkillIds: [],
    history: [{ date: "2026-10-13", toRing: "trial", reason: "首期收录。" }],
    ...overrides
  };
}

function makeRecord(
  overrides: Partial<RadarWorkspaceRecord> = {}
): RadarWorkspaceRecord {
  return {
    ...makeEntry(),
    status: "draft",
    createdAt: "2026-10-13T00:00:00.000Z",
    updatedAt: "2026-10-13T00:00:00.000Z",
    ...overrides
  };
}

const pools = {
  technologyIds: new Set(["tech-1", "tech-2", "tech-3"]),
  knowledgeIds: new Set(["knowledge-a"]),
  skillIds: new Set(["skill-a"])
};

describe("applyRadarUpdate", () => {
  it("appends one history line when the ring changes", () => {
    const next = applyRadarUpdate(
      makeEntry(),
      { ring: "adopt", changeReason: "第三条信号到了。" },
      "2026-11-02"
    );

    expect(next.ring).toBe("adopt");
    expect(next.history).toHaveLength(2);
    expect(next.history[1]).toEqual({
      date: "2026-11-02",
      fromRing: "trial",
      toRing: "adopt",
      reason: "第三条信号到了。"
    });
  });

  it("falls back to the ring reason when no change reason is given", () => {
    const next = applyRadarUpdate(
      makeEntry(),
      { ring: "assess", ringReason: "实测没有宣称的快。" },
      "2026-11-02"
    );

    expect(next.history[1].reason).toBe("实测没有宣称的快。");
  });

  it("leaves history alone when the ring does not change", () => {
    const base = makeEntry();
    const next = applyRadarUpdate(
      base,
      { ring: "trial", name: "改名", changeReason: "不该写进去" },
      "2026-11-02"
    );

    expect(next.name).toBe("改名");
    expect(next.history).toEqual(base.history);
  });

  it("never takes history from the update and ignores an unknown ring", () => {
    const next = applyRadarUpdate(
      makeEntry(),
      { ring: "nowhere" as never, history: [] } as never,
      "2026-11-02"
    );

    expect(next.ring).toBe("trial");
    expect(next.history).toHaveLength(1);
  });

  it("drops blank and duplicate ids", () => {
    const next = applyRadarUpdate(
      makeEntry(),
      { evidenceTechnologyIds: ["tech-1", " ", "tech-1", "tech-3"] },
      "2026-11-02"
    );

    expect(next.evidenceTechnologyIds).toEqual(["tech-1", "tech-3"]);
  });
});

describe("evaluateRadarPublishReadiness", () => {
  it("passes a complete entry", () => {
    const result = evaluateRadarPublishReadiness(makeEntry(), [], pools);

    expect(result.isReady).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it("blocks an entry with no published evidence", () => {
    const result = evaluateRadarPublishReadiness(
      makeEntry({ evidenceTechnologyIds: ["draft-signal"] }),
      [],
      pools
    );

    expect(result.isReady).toBe(false);
    expect(result.blockingErrors.map((issue) => issue.code)).toContain(
      "missing-evidence"
    );
    expect(result.warnings.map((issue) => issue.code)).toContain(
      "unpublished-evidence"
    );
  });

  it("blocks a missing reason, a bad slug and a duplicate slug", () => {
    const codes = (entry: RadarEntry, others: string[] = []) =>
      evaluateRadarPublishReadiness(entry, others, pools).blockingErrors.map(
        (issue) => issue.code
      );

    expect(codes(makeEntry({ ringReason: " " }))).toContain(
      "missing-ring-reason"
    );
    expect(codes(makeEntry({ slug: "Entry A" }))).toContain("invalid-slug");
    expect(codes(makeEntry(), ["entry-a"])).toContain("duplicate-slug");
  });

  it("warns on thin evidence and on no related content", () => {
    const result = evaluateRadarPublishReadiness(
      makeEntry({
        evidenceTechnologyIds: ["tech-1"],
        relatedKnowledgeIds: []
      }),
      [],
      pools
    );

    expect(result.isReady).toBe(true);
    expect(result.warnings.map((issue) => issue.code)).toEqual([
      "thin-evidence",
      "missing-related"
    ]);
  });
});

describe("applyRadarWorkspaceOverlay", () => {
  it("replaces a seed with its published copy and hides it behind a draft", () => {
    const seed = makeEntry();

    expect(
      applyRadarWorkspaceOverlay(
        [seed],
        [makeRecord({ status: "published", ring: "adopt" })]
      )[0].ring
    ).toBe("adopt");
    expect(
      applyRadarWorkspaceOverlay([seed], [makeRecord({ status: "draft" })])
    ).toEqual([]);
  });

  it("shows a workspace-new entry only once published, without workspace fields", () => {
    const fresh = makeRecord({ id: "radar-ws-1", slug: "fresh" });

    expect(applyRadarWorkspaceOverlay([], [fresh])).toEqual([]);

    const [published] = applyRadarWorkspaceOverlay(
      [],
      [{ ...fresh, status: "published" }]
    );

    expect(published.slug).toBe("fresh");
    expect(published).not.toHaveProperty("status");
    expect(published).not.toHaveProperty("createdAt");
    expect(published).not.toHaveProperty("updatedAt");
  });
});

describe("buildRadarWorkspaceEntries", () => {
  it("lists workspace records first and marks overrides", () => {
    const entries = buildRadarWorkspaceEntries(
      [makeEntry(), makeEntry({ id: "radar-b", slug: "entry-b" })],
      [makeRecord({ id: "radar-b", slug: "entry-b", status: "published" })]
    );

    expect(entries.map((item) => [item.entry.id, item.origin])).toEqual([
      ["radar-b", "seed_override"],
      ["radar-a", "seed"]
    ]);
  });
});

describe("getRadarToday", () => {
  it("is the date in Asia/Shanghai", () => {
    expect(getRadarToday(new Date("2026-10-12T17:30:00Z"))).toBe("2026-10-13");
  });
});

describe("radar workspace store", () => {
  let dataDir: string;
  let previousDataDir: string | undefined;

  beforeEach(() => {
    previousDataDir = process.env.LOCAL_DATA_DIR;
    dataDir = mkdtempSync(path.join(tmpdir(), "radar-workflow-"));
    process.env.LOCAL_DATA_DIR = dataDir;
    vi.resetModules();
  });

  afterEach(() => {
    if (previousDataDir === undefined) {
      delete process.env.LOCAL_DATA_DIR;
    } else {
      process.env.LOCAL_DATA_DIR = previousDataDir;
    }

    rmSync(dataDir, { recursive: true, force: true });
  });

  it("copies a seed on first edit and writes the ring change into history", async () => {
    const workflow = await import("@/lib/radar-workflow");
    const { radarEntries } = await import("@/data/radar");
    const seed = radarEntries[0];
    const nextRing = seed.ring === "adopt" ? "trial" : "adopt";

    const record = workflow.updateRadarWorkspaceRecord(seed.id, {
      ring: nextRing,
      changeReason: "测试用的调整。"
    });

    expect(record.status).toBe("published");
    expect(record.history).toHaveLength(seed.history.length + 1);
    expect(record.history.at(-1)).toMatchObject({
      fromRing: seed.ring,
      toRing: nextRing,
      reason: "测试用的调整。"
    });

    const stored = JSON.parse(
      readFileSync(path.join(dataDir, "radar-workspace.json"), "utf8")
    );

    expect(stored.records).toHaveLength(1);
    expect(
      workflow
        .getMergedPublicRadarEntries()
        .find((entry) => entry.id === seed.id)?.ring
    ).toBe(nextRing);

    const events = JSON.parse(
      readFileSync(path.join(dataDir, "workflow-events.json"), "utf8")
    ).events.map((event: { action: string }) => event.action);

    expect(events).toContain("radar_entry.ring_changed");
  });

  it("creates new entries as drafts that the public read skips", async () => {
    const workflow = await import("@/lib/radar-workflow");

    const record = workflow.createRadarWorkspaceRecord({
      name: "新条目",
      slug: "new-entry",
      ring: "hold",
      ringReason: "先别投入。"
    });

    expect(record.status).toBe("draft");
    expect(record.history).toEqual([
      { date: workflow.getRadarToday(), toRing: "hold", reason: "先别投入。" }
    ]);
    expect(
      workflow
        .getMergedPublicRadarEntries()
        .some((entry) => entry.slug === "new-entry")
    ).toBe(false);
  });
});
