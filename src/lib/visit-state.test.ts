import { describe, expect, it } from "vitest";

import {
  advanceVisitState,
  countNewSinceLastVisit,
  isNewSinceLastVisit,
  maxKnownKeys,
  parseVisitState,
  toVisitKey,
  toVisitKeys,
  visitGapMs,
  type VisitState
} from "./visit-state";

const minute = 60 * 1000;
const hours = (count: number) => count * 60 * minute;
const t0 = Date.UTC(2026, 8, 30, 1, 0, 0);
const keys = (...ids: string[]) => toVisitKeys(ids);

describe("toVisitKey", () => {
  it("is short and stable for a long workspace id", () => {
    const id =
      "draft-candidate-rss-https-www-infoq-cn-article-sqv4eomjpp0j3hm3lyf9-utm-source-rss-amp-utm-medium-article";

    expect(toVisitKey(id)).toBe(toVisitKey(id));
    expect(toVisitKey(id).length).toBeLessThanOrEqual(7);
    expect(toVisitKey(id)).not.toBe(toVisitKey(`${id}-2`));
  });

  it("deduplicates keys", () => {
    expect(toVisitKeys(["a", "a", "b"])).toHaveLength(2);
  });
});

describe("advanceVisitState", () => {
  it("marks nothing on a first visit and remembers the list", () => {
    const state = advanceVisitState(null, keys("a", "b"), t0);

    expect(state).toEqual({
      baselineKeys: null,
      knownKeys: keys("a", "b"),
      lastActiveAt: t0
    });
    expect(isNewSinceLastVisit(state.baselineKeys, "a")).toBe(false);
  });

  it("keeps a first visit markless across reloads in the same visit", () => {
    const first = advanceVisitState(null, keys("a", "b"), t0);
    const reload = advanceVisitState(
      first,
      keys("a", "b", "c"),
      t0 + 5 * minute
    );

    expect(reload.baselineKeys).toBeNull();
    expect(isNewSinceLastVisit(reload.baselineKeys, "c")).toBe(false);
  });

  it("uses what the last visit knew as the baseline of a new visit", () => {
    const first = advanceVisitState(null, keys("a", "b"), t0);
    const next = advanceVisitState(first, keys("a", "b", "c"), t0 + hours(2));

    expect(next.baselineKeys).toEqual(keys("a", "b"));
    expect(next.knownKeys).toEqual(keys("a", "b", "c"));
    expect(isNewSinceLastVisit(next.baselineKeys, "c")).toBe(true);
    expect(isNewSinceLastVisit(next.baselineKeys, "a")).toBe(false);
  });

  it("keeps the marks when the reader reloads within the same visit", () => {
    const first = advanceVisitState(null, keys("a", "b"), t0);
    const visit = advanceVisitState(first, keys("a", "b", "c"), t0 + hours(3));
    const reload = advanceVisitState(
      visit,
      keys("a", "b", "c"),
      visit.lastActiveAt + 10 * minute
    );

    expect(reload.baselineKeys).toEqual(keys("a", "b"));
    expect(isNewSinceLastVisit(reload.baselineKeys, "c")).toBe(true);
  });

  it("extends a visit with each recording, so an active reader keeps it", () => {
    const first = advanceVisitState(null, keys("a"), t0);
    let state = advanceVisitState(first, keys("a", "b"), t0 + hours(2));

    // Four loads 20 minutes apart: 80 minutes in total, no single gap over 30.
    for (let step = 1; step <= 4; step += 1) {
      state = advanceVisitState(
        state,
        keys("a", "b"),
        state.lastActiveAt + 20 * minute
      );
    }

    expect(state.baselineKeys).toEqual(keys("a"));
  });

  it("starts a new visit only past the gap, not at it", () => {
    const first = advanceVisitState(null, keys("a"), t0);
    const atGap = advanceVisitState(first, keys("a", "b"), t0 + visitGapMs);
    const pastGap = advanceVisitState(
      first,
      keys("a", "b"),
      t0 + visitGapMs + 1
    );

    expect(atGap.baselineKeys).toBeNull();
    expect(pastGap.baselineKeys).toEqual(keys("a"));
  });

  it("clears the marks of the last visit in the visit after it", () => {
    const first = advanceVisitState(null, keys("a"), t0);
    const second = advanceVisitState(first, keys("a", "b"), t0 + hours(2));
    const third = advanceVisitState(
      second,
      keys("a", "b"),
      second.lastActiveAt + hours(2)
    );

    expect(isNewSinceLastVisit(second.baselineKeys, "b")).toBe(true);
    expect(isNewSinceLastVisit(third.baselineKeys, "b")).toBe(false);
  });

  it("drops archived signals by replacing the known list", () => {
    const first = advanceVisitState(null, keys("a", "archived"), t0);
    const next = advanceVisitState(first, keys("a"), t0 + minute);

    expect(next.knownKeys).toEqual(keys("a"));
  });

  it("does not start a new visit when the clock goes backwards", () => {
    const first = advanceVisitState(null, keys("a"), t0);
    const visit = advanceVisitState(first, keys("a", "b"), t0 + hours(2));
    const skewed = advanceVisitState(visit, keys("a", "b"), t0);

    expect(skewed.baselineKeys).toEqual(keys("a"));
  });

  it("treats an empty remembered list as a first visit, not as all new", () => {
    const broken: VisitState = {
      baselineKeys: null,
      knownKeys: [],
      lastActiveAt: t0
    };
    const next = advanceVisitState(broken, keys("a"), t0 + hours(2));

    expect(next.baselineKeys).toBeNull();
  });
});

describe("isNewSinceLastVisit / countNewSinceLastVisit", () => {
  it("never marks a signal the reader has read", () => {
    expect(isNewSinceLastVisit(keys("a"), "b", ["b"])).toBe(false);
    expect(isNewSinceLastVisit(keys("a"), "c", ["b"])).toBe(true);
  });

  it("counts new, unread signals only", () => {
    const signals = [{ id: "a" }, { id: "b" }, { id: "c" }];

    expect(countNewSinceLastVisit(signals, keys("a"), ["c"])).toBe(1);
    expect(countNewSinceLastVisit(signals, null)).toBe(0);
  });
});

describe("parseVisitState", () => {
  it("round-trips a stored state", () => {
    const state: VisitState = {
      baselineKeys: keys("a"),
      knownKeys: keys("a", "b"),
      lastActiveAt: t0
    };

    expect(parseVisitState(JSON.stringify(state))).toEqual(state);
  });

  it("reads anything malformed as no state", () => {
    for (const raw of [
      null,
      "",
      "not json",
      "[]",
      "null",
      JSON.stringify({ baselineKeys: "a", knownKeys: [], lastActiveAt: t0 }),
      JSON.stringify({ baselineKeys: null, knownKeys: [1], lastActiveAt: t0 }),
      JSON.stringify({ baselineKeys: null, knownKeys: [], lastActiveAt: "x" })
    ]) {
      expect(parseVisitState(raw)).toBeNull();
    }
  });

  it("caps an oversized stored list", () => {
    const many = Array.from({ length: maxKnownKeys + 10 }, (_, i) => `k${i}`);
    const parsed = parseVisitState(
      JSON.stringify({ baselineKeys: many, knownKeys: many, lastActiveAt: t0 })
    );

    expect(parsed?.knownKeys).toHaveLength(maxKnownKeys);
    expect(parsed?.baselineKeys).toHaveLength(maxKnownKeys);
  });
});
