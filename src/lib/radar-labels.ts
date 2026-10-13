import type { Locale } from "@/lib/i18n/locale";
import type { RadarQuadrant, RadarRing } from "@/types/radar";

// Labels and order for the radar's two axes. No node imports: the client
// radar view and the workspace form read these too.

/** Clockwise from the top-right quadrant: the order the list is grouped in. */
export const radarQuadrants: readonly RadarQuadrant[] = [
  "models-training",
  "agents-applications",
  "inference-deployment",
  "tools-methods"
];

/** Innermost first. */
export const radarRings: readonly RadarRing[] = [
  "adopt",
  "trial",
  "assess",
  "hold"
];

const quadrantLabels: Record<RadarQuadrant, string> = {
  "models-training": "模型与训练",
  "agents-applications": "智能体与应用",
  "inference-deployment": "推理与部署",
  "tools-methods": "工具与方法"
};

const ringLabels: Record<RadarRing, string> = {
  adopt: "采用",
  trial: "试用",
  assess: "评估",
  hold: "暂缓"
};

/** What each ring asks of a reader, for the page's ring key. */
const ringDescriptions: Record<RadarRing, string> = {
  adopt: "多条信号印证，默认可以用。",
  trial: "值得在真实项目里小范围用起来。",
  assess: "值得了解、做原型，先别押上生产。",
  hold: "别这样做：先别投入，已在用的也别再照这个做法新开项目。"
};

// English interface (2026-10-13). Adopt / Trial / Assess / Hold are the
// ring names technology radars have used in English since Thoughtworks'.
const englishQuadrantLabels: Record<RadarQuadrant, string> = {
  "models-training": "Models & training",
  "agents-applications": "Agents & applications",
  "inference-deployment": "Inference & deployment",
  "tools-methods": "Tools & methods"
};

const englishRingLabels: Record<RadarRing, string> = {
  adopt: "Adopt",
  trial: "Trial",
  assess: "Assess",
  hold: "Hold"
};

const englishRingDescriptions: Record<RadarRing, string> = {
  adopt: "Backed by several signals; use it by default.",
  trial: "Worth using on a real project, in a limited way.",
  assess: "Worth understanding and prototyping; not yet for production.",
  hold: "Don't do this: hold off on new investment, and don't start new projects this way even if you already use it."
};

export function getRadarQuadrantLabel(
  quadrant: RadarQuadrant,
  locale: Locale = "zh"
): string {
  return (locale === "en" ? englishQuadrantLabels : quadrantLabels)[quadrant];
}

export function getRadarRingLabel(
  ring: RadarRing,
  locale: Locale = "zh"
): string {
  return (locale === "en" ? englishRingLabels : ringLabels)[ring];
}

export function getRadarRingDescription(
  ring: RadarRing,
  locale: Locale = "zh"
): string {
  return (locale === "en" ? englishRingDescriptions : ringDescriptions)[ring];
}

/**
 * Shown over the reason of an entry in the hold ring: most of them are
 * practices, and for a practice 暂缓 means "don't do this", not "wait".
 */
export const radarHoldNote = "暂缓，就是别这样做。";

export const radarHoldNotes: Record<Locale, string> = {
  zh: radarHoldNote,
  en: "Hold means: don't do this."
};

export function isRadarQuadrant(value: unknown): value is RadarQuadrant {
  return radarQuadrants.includes(value as RadarQuadrant);
}

export function isRadarRing(value: unknown): value is RadarRing {
  return radarRings.includes(value as RadarRing);
}

/** 「从试用移到采用」 — inward is a promotion, outward a demotion. */
export function describeRadarMove(
  from: RadarRing,
  to: RadarRing,
  locale: Locale = "zh"
): string {
  if (locale === "en") {
    return `Moved from ${englishRingLabels[from]} to ${englishRingLabels[to]}`;
  }

  return `从${ringLabels[from]}移到${ringLabels[to]}`;
}
