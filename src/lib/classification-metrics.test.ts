import { describe, expect, it } from "vitest";
import {
  computeClassificationReport,
  percentile
} from "@/lib/classification-metrics";

const labels = ["publish", "review", "reject"] as const;

describe("computeClassificationReport", () => {
  it("fills the confusion matrix and per-class precision / recall", () => {
    const report = computeClassificationReport(labels, [
      { actual: "publish", predicted: "publish" },
      { actual: "publish", predicted: "review" },
      { actual: "review", predicted: "review" },
      { actual: "reject", predicted: "reject" },
      { actual: "reject", predicted: "reject" },
      { actual: "reject", predicted: "publish" }
    ]);

    expect(report.accuracy).toBeCloseTo(4 / 6);
    expect(report.confusion.reject.publish).toBe(1);
    expect(report.perClass.publish.precision).toBeCloseTo(1 / 2);
    expect(report.perClass.publish.recall).toBeCloseTo(1 / 2);
    expect(report.perClass.reject.precision).toBe(1);
    expect(report.perClass.reject.recall).toBeCloseTo(2 / 3);
    expect(report.perClass.review.support).toBe(1);
  });

  it("counts a failed prediction as wrong instead of dropping it", () => {
    const report = computeClassificationReport(labels, [
      { actual: "publish", predicted: "publish" },
      { actual: "publish", predicted: null }
    ]);

    expect(report.failed).toBe(1);
    expect(report.accuracy).toBe(0.5);
    expect(report.perClass.publish.recall).toBe(0.5);
    expect(report.perClass.publish.support).toBe(2);
    expect(report.confusion.publish.none).toBe(1);
  });

  it("reports the majority-class baseline honestly: high accuracy, zero publish recall", () => {
    const report = computeClassificationReport(labels, [
      { actual: "reject", predicted: "reject" },
      { actual: "reject", predicted: "reject" },
      { actual: "reject", predicted: "reject" },
      { actual: "publish", predicted: "reject" }
    ]);

    expect(report.accuracy).toBe(0.75);
    expect(report.perClass.publish.recall).toBe(0);
    expect(report.perClass.publish.f1).toBe(0);
    expect(report.macroF1).toBeLessThan(report.accuracy);
  });
});

describe("percentile", () => {
  it("uses nearest rank", () => {
    expect(percentile([5, 1, 3, 2, 4], 0.5)).toBe(3);
    expect(percentile([5, 1, 3, 2, 4], 0.95)).toBe(5);
    expect(percentile([], 0.5)).toBe(0);
  });
});
