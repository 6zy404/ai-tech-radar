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

export function getRadarQuadrantLabel(quadrant: RadarQuadrant): string {
  return quadrantLabels[quadrant];
}

export function getRadarRingLabel(ring: RadarRing): string {
  return ringLabels[ring];
}

export function getRadarRingDescription(ring: RadarRing): string {
  return ringDescriptions[ring];
}

/**
 * Shown over the reason of an entry in the hold ring: most of them are
 * practices, and for a practice 暂缓 means "don't do this", not "wait".
 */
export const radarHoldNote = "暂缓，就是别这样做。";

export function isRadarQuadrant(value: unknown): value is RadarQuadrant {
  return radarQuadrants.includes(value as RadarQuadrant);
}

export function isRadarRing(value: unknown): value is RadarRing {
  return radarRings.includes(value as RadarRing);
}

/** 「从试用移到采用」 — inward is a promotion, outward a demotion. */
export function describeRadarMove(from: RadarRing, to: RadarRing): string {
  return `从${ringLabels[from]}移到${ringLabels[to]}`;
}
