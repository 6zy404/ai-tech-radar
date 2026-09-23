/**
 * Plain classification metrics for the triage eval. No dependency, because the
 * whole thing is a confusion matrix and three divisions.
 *
 * A prediction of `null` means the model gave no usable answer (timeout,
 * unparseable output). It is counted as wrong for accuracy and recall, and
 * reported separately, rather than silently dropped — dropping failures is the
 * easiest way to make a model look better than it is.
 */

export interface LabelledPrediction<L extends string> {
  actual: L;
  predicted: L | null;
}

export interface ClassMetrics {
  precision: number;
  recall: number;
  f1: number;
  support: number;
  predicted: number;
}

export interface ClassificationReport<L extends string> {
  total: number;
  failed: number;
  accuracy: number;
  macroF1: number;
  perClass: Record<L, ClassMetrics>;
  /** confusion[actual][predicted]; the `none` column counts failures. */
  confusion: Record<L, Record<L | "none", number>>;
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

export function computeClassificationReport<L extends string>(
  labels: readonly L[],
  predictions: LabelledPrediction<L>[]
): ClassificationReport<L> {
  const confusion = {} as Record<L, Record<L | "none", number>>;

  for (const actual of labels) {
    const row = { none: 0 } as Record<L | "none", number>;

    for (const predicted of labels) {
      row[predicted] = 0;
    }

    confusion[actual] = row;
  }

  let correct = 0;
  let failed = 0;

  for (const { actual, predicted } of predictions) {
    if (predicted === null) {
      failed += 1;
      confusion[actual].none += 1;
      continue;
    }

    confusion[actual][predicted] += 1;

    if (actual === predicted) {
      correct += 1;
    }
  }

  const perClass = {} as Record<L, ClassMetrics>;

  for (const label of labels) {
    const truePositive = confusion[label][label];
    const support = labels.reduce(
      (sum, predicted) => sum + confusion[label][predicted],
      confusion[label].none
    );
    const predictedCount = labels.reduce(
      (sum, actual) => sum + confusion[actual][label],
      0
    );
    const precision = ratio(truePositive, predictedCount);
    const recall = ratio(truePositive, support);

    perClass[label] = {
      precision,
      recall,
      f1: ratio(2 * precision * recall, precision + recall),
      support,
      predicted: predictedCount
    };
  }

  return {
    total: predictions.length,
    failed,
    accuracy: ratio(correct, predictions.length),
    macroF1: ratio(
      labels.reduce((sum, label) => sum + perClass[label].f1, 0),
      labels.length
    ),
    perClass,
    confusion
  };
}

/** Nearest-rank percentile; `values` need not be sorted. */
export function percentile(values: number[], fraction: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil(fraction * sorted.length) - 1;

  return sorted[Math.min(sorted.length - 1, Math.max(0, rank))];
}
