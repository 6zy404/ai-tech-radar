import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Pins the shared once-a-day config behind 定时导入 and 定时简报草稿
// (`src/lib/daily-schedule-config.ts`) against a throwaway data directory.

let dataDir: string;
let previousDataDir: string | undefined;

beforeEach(() => {
  previousDataDir = process.env.LOCAL_DATA_DIR;
  dataDir = mkdtempSync(path.join(tmpdir(), "daily-schedule-"));
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

async function makeStore() {
  const scheduleConfig = await import("@/lib/daily-schedule-config");
  const store = scheduleConfig.createDailyScheduleConfigStore<
    "never_run" | "success" | "failed"
  >("test-schedule.json", ["success", "failed"]);

  return { ...scheduleConfig, store };
}

const storeFile = () => path.join(dataDir, "test-schedule.json");

describe("createDailyScheduleConfigStore", () => {
  it("starts enabled at 08:00 with no next run, which counts as due", async () => {
    const { store, isDailyScheduleDue } = await makeStore();
    const config = store.get();

    expect(config).toMatchObject({
      enabled: true,
      scheduleTime: "08:00",
      timezone: "Asia/Shanghai",
      lastRunStatus: "never_run"
    });
    expect(config.nextRunAt).toBeUndefined();
    expect(isDailyScheduleDue(config)).toBe(true);
  });

  it("reads an unknown status and a malformed time back as the defaults", async () => {
    writeFileSync(
      storeFile(),
      JSON.stringify({
        enabled: false,
        scheduleTime: "25:99",
        lastRunStatus: "partial"
      })
    );
    const { store } = await makeStore();

    expect(store.get()).toMatchObject({
      enabled: false,
      scheduleTime: "08:00",
      lastRunStatus: "never_run"
    });
  });

  it("rejects a malformed time and moves the next run when the time changes", async () => {
    const { store } = await makeStore();

    expect(() => store.update({ scheduleTime: "8am" })).toThrow("HH:mm");

    const updated = store.update({ scheduleTime: "07:30" });

    expect(updated.scheduleTime).toBe("07:30");
    expect(new Date(updated.nextRunAt ?? 0).getTime()).toBeGreaterThan(
      Date.now()
    );
  });

  it("is never due while disabled", async () => {
    const { store, isDailyScheduleDue } = await makeStore();

    expect(isDailyScheduleDue(store.update({ enabled: false }))).toBe(false);
  });

  it("records a run and is not due again until the next scheduled time", async () => {
    const { store, isDailyScheduleDue } = await makeStore();
    const now = new Date();
    const after = store.recordRun({ status: "success", message: "ok" }, now);

    expect(after).toMatchObject({
      lastRunStatus: "success",
      lastRunMessage: "ok",
      lastRunAt: now.toISOString()
    });
    expect(isDailyScheduleDue(after, now)).toBe(false);
    expect(
      isDailyScheduleDue(after, new Date(Date.now() + 2 * 86_400_000))
    ).toBe(true);
    expect(JSON.parse(readFileSync(storeFile(), "utf8")).lastRunStatus).toBe(
      "success"
    );
  });

  it("keeps a change saved while the run was in progress", async () => {
    const { store } = await makeStore();

    // The run starts from this config, then the workspace (another process)
    // disables it and moves the time before the run records its result.
    store.get();
    writeFileSync(
      storeFile(),
      JSON.stringify({
        ...store.get(),
        enabled: false,
        scheduleTime: "07:15"
      })
    );

    const after = store.recordRun(
      { status: "failed", message: "boom" },
      new Date("2026-10-14T00:07:00.000Z")
    );

    expect(after).toMatchObject({
      enabled: false,
      scheduleTime: "07:15",
      lastRunStatus: "failed",
      lastRunMessage: "boom"
    });
    // The next run follows the new time: 07:15 Asia/Shanghai is 23:15 UTC.
    expect(after.nextRunAt).toBe("2026-10-14T23:15:00.000Z");
  });
});
