import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { OperationsAttentionItem } from "@/lib/operations-metrics";
import {
  buildPipelineToast,
  getNotificationDay,
  pipelineToastScript,
  planPipelineNotifications,
  readPipelineAlertState,
  writePipelineAlertState
} from "@/lib/pipeline-alert";

function alert(id: string, title = id): OperationsAttentionItem {
  return {
    id,
    severity: "critical",
    title,
    description: `${title} 的说明。`,
    href: "/workspace/operations",
    source: "测试"
  };
}

describe("getNotificationDay", () => {
  it("uses the Shanghai calendar day, not the UTC one", () => {
    expect(getNotificationDay(new Date("2026-09-28T15:59:00.000Z"))).toBe(
      "2026-09-28"
    );
    expect(getNotificationDay(new Date("2026-09-28T16:00:00.000Z"))).toBe(
      "2026-09-29"
    );
  });
});

describe("planPipelineNotifications", () => {
  const day = "2026-09-29";

  it("notifies every alert on a fresh day", () => {
    const plan = planPipelineNotifications({
      alerts: [alert("a"), alert("b")],
      state: { notified: { a: "2026-09-28" } },
      day
    });

    expect(plan.toNotify.map((item) => item.id)).toEqual(["a", "b"]);
    expect(plan.nextState).toEqual({ notified: { a: day, b: day } });
  });

  it("does not repeat an alert already shown today", () => {
    const plan = planPipelineNotifications({
      alerts: [alert("a"), alert("b")],
      state: { notified: { a: day } },
      day
    });

    expect(plan.toNotify.map((item) => item.id)).toEqual(["b"]);
  });

  it("forgets alerts that cleared, so a relapse the same day is shown", () => {
    const cleared = planPipelineNotifications({
      alerts: [],
      state: { notified: { a: day } },
      day
    });

    expect(cleared.nextState).toEqual({ notified: {} });
    expect(
      planPipelineNotifications({
        alerts: [alert("a")],
        state: cleared.nextState,
        day
      }).toNotify
    ).toHaveLength(1);
  });
});

describe("buildPipelineToast", () => {
  it("names every alert in the title and points at the dashboard", () => {
    const toast = buildPipelineToast([
      alert("a", "定时导入已停摆"),
      alert("b", "该跑一轮编辑轮了")
    ]);

    expect(toast.title).toBe("AI Tech Radar：定时导入已停摆；该跑一轮编辑轮了");
    expect(toast.body).toContain("定时导入已停摆 的说明。");
    expect(toast.body.endsWith("打开工作台 → 运维查看。")).toBe(true);
  });

  it("caps the body so a toast stays readable", () => {
    const long = { ...alert("a"), description: "长".repeat(1000) };

    expect(buildPipelineToast([long]).body.length).toBeLessThanOrEqual(240);
  });
});

describe("pipelineToastScript", () => {
  it("takes its text from the environment, not from interpolation", () => {
    expect(pipelineToastScript).toContain("$env:RADAR_TOAST_TITLE");
    expect(pipelineToastScript).toContain("$env:RADAR_TOAST_BODY");
    expect(pipelineToastScript).not.toMatch(/AI Tech Radar/);
  });
});

describe("alert state file", () => {
  let dir: string | undefined;

  afterEach(() => {
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("round-trips, and reads a missing or damaged file as empty", () => {
    dir = mkdtempSync(path.join(tmpdir(), "pipeline-alert-"));
    const statePath = path.join(dir, "state.json");

    expect(readPipelineAlertState(statePath)).toEqual({ notified: {} });

    writePipelineAlertState({ notified: { a: "2026-09-29" } }, statePath);
    expect(readPipelineAlertState(statePath)).toEqual({
      notified: { a: "2026-09-29" }
    });

    writeFileSync(statePath, "{ not json", "utf8");
    expect(readPipelineAlertState(statePath)).toEqual({ notified: {} });
  });
});
