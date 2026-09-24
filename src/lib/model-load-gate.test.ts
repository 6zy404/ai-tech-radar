import { describe, expect, it, vi } from "vitest";

import { createModelLoadGate } from "@/lib/model-load-gate";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("createModelLoadGate", () => {
  it("loads once, shares the promise, and reports ready", async () => {
    const load = vi.fn(async () => "model");
    const gate = createModelLoadGate({ load, timeoutMs: 1_000 });

    expect(gate.status().state).toBe("idle");

    const [a, b] = await Promise.all([gate.get(), gate.get()]);

    expect(a).toBe("model");
    expect(b).toBe("model");
    expect(load).toHaveBeenCalledTimes(1);
    expect(gate.status()).toMatchObject({ state: "ready", attempts: 1 });
  });

  it("gives up at the deadline, says so, and retries on the next call", async () => {
    vi.useFakeTimers();
    try {
      let calls = 0;
      const failures: string[] = [];
      const gate = createModelLoadGate<string>({
        load: () => {
          calls += 1;
          // First load hangs forever (the 2026-09-24 case); second succeeds.
          return calls === 1
            ? new Promise(() => undefined)
            : Promise.resolve("model");
        },
        timeoutMs: 5_000,
        onFailure: (message) => failures.push(message)
      });

      const first = gate.get();
      first.catch(() => undefined);
      expect(gate.status().state).toBe("loading");

      await vi.advanceTimersByTimeAsync(5_000);

      await expect(first).rejects.toThrow(/did not finish within 5000ms/);
      expect(gate.status()).toMatchObject({ state: "failed", attempts: 1 });
      expect(gate.status().lastError).toMatch(/5000ms/);
      expect(failures).toHaveLength(1);

      await expect(gate.get()).resolves.toBe("model");
      expect(gate.status()).toMatchObject({ state: "ready", attempts: 2 });
      expect(calls).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("records a load error with its reason and does not cache the failure", async () => {
    let calls = 0;
    const failures: string[] = [];
    const gate = createModelLoadGate<string>({
      load: async () => {
        calls += 1;
        if (calls === 1) {
          throw new Error("ENOTFOUND cas-bridge.xethub.hf.co");
        }
        return "model";
      },
      timeoutMs: 1_000,
      onFailure: (message) => failures.push(message)
    });

    await expect(gate.get()).rejects.toThrow(/ENOTFOUND/);
    expect(gate.status()).toMatchObject({
      state: "failed",
      lastError: "ENOTFOUND cas-bridge.xethub.hf.co"
    });
    expect(failures).toEqual(["ENOTFOUND cas-bridge.xethub.hf.co"]);

    await expect(gate.get()).resolves.toBe("model");
    await tick();
    expect(gate.status().state).toBe("ready");
  });

  it("does not surface a late failure of a timed-out load as unhandled", async () => {
    vi.useFakeTimers();
    const unhandled: unknown[] = [];
    const listener = (reason: unknown) => unhandled.push(reason);
    process.on("unhandledRejection", listener);
    try {
      let rejectLate: (error: Error) => void = () => undefined;
      const gate = createModelLoadGate<string>({
        load: () =>
          new Promise((_, reject) => {
            rejectLate = reject;
          }),
        timeoutMs: 100
      });

      const attempt = gate.get();
      attempt.catch(() => undefined);
      await vi.advanceTimersByTimeAsync(100);
      await expect(attempt).rejects.toThrow(/100ms/);

      rejectLate(new Error("late failure"));
      await vi.advanceTimersByTimeAsync(0);

      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", listener);
      vi.useRealTimers();
    }
  });
});
