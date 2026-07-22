import { beforeEach, describe, expect, it, vi } from "vitest";

import { getEditorialRoundState } from "@/lib/editorial-round";
import {
  makeImportedCandidate,
  makeWorkspaceRecord
} from "@/lib/test-factories";
import type { PublishReadinessResult } from "@/lib/publish-readiness";
import type {
  DailyDigest,
  DuplicateGroup,
  ImportedCandidate,
  TechnologyWorkspaceRecord
} from "@/types/content";

const { getImportedCandidatesMock, getDuplicateGroupsMock } = vi.hoisted(
  () => ({
    getImportedCandidatesMock: vi.fn<() => ImportedCandidate[]>(),
    getDuplicateGroupsMock: vi.fn<() => DuplicateGroup[]>()
  })
);

const { getTodayDateStringMock } = vi.hoisted(() => ({
  getTodayDateStringMock: vi.fn<() => string>()
}));

const { getDailyDigestByDateMock } = vi.hoisted(() => ({
  getDailyDigestByDateMock: vi.fn<(date: string) => DailyDigest | undefined>()
}));

const { getTechnologyDraftsMock, getReadinessMock } = vi.hoisted(() => ({
  getTechnologyDraftsMock: vi.fn<() => TechnologyWorkspaceRecord[]>(),
  getReadinessMock: vi.fn<(id: string) => PublishReadinessResult>()
}));

vi.mock("@/lib/candidate-workflow", () => ({
  getImportedCandidates: getImportedCandidatesMock,
  getDuplicateGroups: getDuplicateGroupsMock
}));

vi.mock("@/lib/digest-store", () => ({
  getTodayDateString: getTodayDateStringMock
}));

vi.mock("@/lib/digest-workflow", () => ({
  getDailyDigestByDate: getDailyDigestByDateMock
}));

vi.mock("@/lib/technology-draft-workflow", () => ({
  getTechnologyDrafts: getTechnologyDraftsMock,
  getTechnologyWorkspacePublishReadiness: getReadinessMock
}));

function readiness(blocking: number, warning: number): PublishReadinessResult {
  return {
    isReady: blocking === 0,
    blockingErrors: Array.from({ length: blocking }, (_, index) => ({
      code: `block-${index}`,
      field: "title",
      message: `阻断 ${index}`,
      severity: "blocking" as const
    })),
    warnings: Array.from({ length: warning }, (_, index) => ({
      code: `warn-${index}`,
      field: "tags",
      message: `警告 ${index}`,
      severity: "warning" as const
    }))
  };
}

function digest(overrides: Partial<DailyDigest>): DailyDigest {
  return {
    date: "2026-07-22",
    status: "draft",
    highPriorityTechnologyIds: [],
    watchTechnologyIds: [],
    ...overrides
  } as unknown as DailyDigest;
}

function duplicateGroup(status: DuplicateGroup["status"]): DuplicateGroup {
  return {
    id: `group-${status}`,
    candidateIds: ["x", "y"],
    primaryCandidateId: "x",
    status,
    reasons: [],
    createdAt: "2026-07-22T00:00:00.000Z",
    updatedAt: "2026-07-22T00:00:00.000Z"
  } as unknown as DuplicateGroup;
}

beforeEach(() => {
  vi.clearAllMocks();
  getTodayDateStringMock.mockReturnValue("2026-07-22");
  getImportedCandidatesMock.mockReturnValue([]);
  getDuplicateGroupsMock.mockReturnValue([]);
  getTechnologyDraftsMock.mockReturnValue([]);
  getDailyDigestByDateMock.mockReturnValue(undefined);
  getReadinessMock.mockReturnValue(readiness(0, 0));
});

describe("getEditorialRoundState — candidates", () => {
  it("keeps only effective-new candidates, newest-first", () => {
    getImportedCandidatesMock.mockReturnValue([
      makeImportedCandidate({
        id: "old",
        originalTitle: "Old",
        publishDate: "2026-07-18",
        importStatus: "new"
      }),
      makeImportedCandidate({
        id: "done",
        importStatus: "converted",
        publishDate: "2026-07-21"
      }),
      makeImportedCandidate({
        id: "new",
        originalTitle: "New",
        publishDate: "2026-07-21",
        importStatus: "new"
      })
    ]);

    const state = getEditorialRoundState();

    expect(state.undecidedCount).toBe(2);
    expect(state.undecidedCandidates.map((c) => c.id)).toEqual(["new", "old"]);
  });

  it("marks the candidate step blocked when an open duplicate group exists", () => {
    getImportedCandidatesMock.mockReturnValue([
      makeImportedCandidate({ id: "a", importStatus: "new" })
    ]);
    getDuplicateGroupsMock.mockReturnValue([
      duplicateGroup("open"),
      duplicateGroup("resolved")
    ]);

    const state = getEditorialRoundState();
    const candidateStep = state.steps.find((s) => s.key === "candidates");

    expect(state.openDuplicateGroupCount).toBe(1);
    expect(candidateStep?.status).toBe("blocked");
  });
});

describe("getEditorialRoundState — drafts", () => {
  it("lists only drafts, blocking-first, with readiness counts", () => {
    getTechnologyDraftsMock.mockReturnValue([
      makeWorkspaceRecord({ id: "ready", status: "draft" }),
      makeWorkspaceRecord({ id: "published", status: "published" }),
      makeWorkspaceRecord({ id: "blocked", status: "draft" })
    ]);
    getReadinessMock.mockImplementation((id) =>
      id === "blocked" ? readiness(2, 1) : readiness(0, 0)
    );

    const state = getEditorialRoundState();

    expect(state.draftCount).toBe(2);
    expect(state.draftsAwaitingPublish.map((d) => d.id)).toEqual([
      "blocked",
      "ready"
    ]);
    expect(state.draftsAwaitingPublish[0].blockingCount).toBe(2);
    expect(state.draftsAwaitingPublish[0].topIssue).toBe("阻断 0");
    expect(state.draftsAwaitingPublish[1].isReady).toBe(true);
  });
});

describe("getEditorialRoundState — digest and steps", () => {
  it("has no digest and todo publish/verify steps by default", () => {
    const state = getEditorialRoundState();

    expect(state.todayDigest).toBeUndefined();
    expect(state.steps.find((s) => s.key === "digest-generate")?.status).toBe(
      "todo"
    );
    expect(state.steps.find((s) => s.key === "verify")?.status).toBe("todo");
  });

  it("maps a published digest and completes the digest steps", () => {
    getDailyDigestByDateMock.mockReturnValue(
      digest({
        status: "published",
        highPriorityTechnologyIds: ["t1", "t2"],
        watchTechnologyIds: ["t3"]
      })
    );

    const state = getEditorialRoundState();

    expect(state.todayDigest).toEqual({
      date: "2026-07-22",
      status: "published",
      highPriorityCount: 2,
      watchCount: 1
    });
    expect(state.steps.find((s) => s.key === "digest-generate")?.status).toBe(
      "done"
    );
    expect(state.steps.find((s) => s.key === "digest-publish")?.status).toBe(
      "done"
    );
    expect(state.steps.find((s) => s.key === "verify")?.status).toBe("current");
  });
});
