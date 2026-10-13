// The technology radar (/radar): one entry per technology itself — vLLM,
// MCP, LoRA — not per release. The published signals are its evidence.

/** 模型与训练 / 智能体与应用 / 推理与部署 / 工具与方法. */
export type RadarQuadrant =
  | "models-training"
  | "agents-applications"
  | "inference-deployment"
  | "tools-methods";

/** 采用 / 试用 / 评估 / 暂缓, innermost first. */
export type RadarRing = "adopt" | "trial" | "assess" | "hold";

/**
 * One line of an entry's ring history. `fromRing` is absent on the line
 * that put the entry on the radar. Written by the workflow on create and on
 * every ring change; never edited by hand.
 */
export interface RadarRingChange {
  /** YYYY-MM-DD, Asia/Shanghai. */
  date: string;
  fromRing?: RadarRing;
  toRing: RadarRing;
  reason: string;
}

export interface RadarEntry {
  id: string;
  name: string;
  slug: string;
  quadrant: RadarQuadrant;
  ring: RadarRing;
  /** One sentence: why it sits in this ring. */
  ringReason: string;
  /** Published technology signals this placement rests on. */
  evidenceTechnologyIds: string[];
  relatedKnowledgeIds: string[];
  relatedSkillIds: string[];
  /** Oldest first. The last line's `toRing` equals `ring`. */
  history: RadarRingChange[];
}

export type RadarWorkspaceStatus = "draft" | "published";

/** Workspace-only: the copy-on-write record over a seed entry, or a new one. */
export type RadarWorkspaceRecord = RadarEntry & {
  status: RadarWorkspaceStatus;
  createdAt: string;
  updatedAt: string;
};

export interface RadarWorkspaceStore {
  updatedAt: string;
  records: RadarWorkspaceRecord[];
}

/** 本期新进 / 本期移动 / 未变 — derived from history, never stored. */
export type RadarChangeKind = "new" | "moved" | "unchanged";

export interface RadarPublicLink {
  slug: string;
  title: string;
}

export interface RadarPublicSignal extends RadarPublicLink {
  publishDate: string;
  /** English site only: `zh-CN` when the title is Chinese. */
  titleLang?: string;
}

/**
 * The one shape a radar entry takes on a public surface. Built only by
 * `toPublicRadarEntries` in src/lib/radar.ts; it carries no workspace
 * status, timestamps or ids of unpublished content.
 */
export interface RadarPublicEntry {
  /** 1-based, in list order: quadrant, then ring, then name. */
  number: number;
  name: string;
  slug: string;
  quadrant: RadarQuadrant;
  ring: RadarRing;
  ringReason: string;
  change: RadarChangeKind;
  /** The ring it moved from, when `change` is "moved". */
  movedFrom?: RadarRing;
  evidence: RadarPublicSignal[];
  knowledge: RadarPublicLink[];
  skills: RadarPublicLink[];
  history: RadarRingChange[];
}
