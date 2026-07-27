import {
  getDuplicateGroups,
  getImportedCandidates
} from "@/lib/candidate-workflow";
import { getTodayDateString } from "@/lib/digest-store";
import { getDailyDigestByDate } from "@/lib/digest-workflow";
import {
  getTechnologyDrafts,
  getTechnologyWorkspacePublishReadiness
} from "@/lib/technology-draft-workflow";
import { evaluateCandidateQuality } from "@/lib/quality-signals";
import type { CandidateQualityFlag, DailyDigestStatus } from "@/types/content";

const reviewOnlyQualityFlags = new Set<CandidateQualityFlag>([
  "ready_for_review",
  "not_convertible"
]);

/**
 * Editorial-round orchestration state — the read side of the "编辑轮控制台"
 * (`/workspace/editorial-round`). This is a pure aggregation over the existing
 * workflow getters (candidates, duplicate groups, technology drafts + publish
 * readiness, today's digest); it owns no new persisted data and performs no
 * mutations. The console page surfaces this state and the inline actions call
 * the existing workspace/candidate API routes, so the playbook's recurring
 * "决 → 发 → 简报 → 核对" loop lives on one page without duplicating any editor.
 */

export interface EditorialRoundCandidate {
  id: string;
  title: string;
  sourceName: string;
  publishDate: string;
  /**
   * Review-blocking quality flags, so a round can triage the batch from this
   * one list instead of opening every candidate detail page to discover that
   * (say) a feed item carries no body text. Flags that only describe review
   * readiness (`ready_for_review` / `not_convertible`) are left out — they say
   * nothing about whether the item is worth publishing.
   */
  qualityFlags: CandidateQualityFlag[];
}

export interface EditorialRoundDraft {
  id: string;
  title: string;
  blockingCount: number;
  warningCount: number;
  isReady: boolean;
  topIssue?: string;
}

export interface EditorialRoundDigest {
  date: string;
  status: DailyDigestStatus;
  highPriorityCount: number;
  watchCount: number;
}

export type EditorialRoundStepStatus = "done" | "current" | "todo" | "blocked";

export interface EditorialRoundStep {
  key: string;
  label: string;
  status: EditorialRoundStepStatus;
  detail: string;
}

export interface EditorialRoundState {
  today: string;
  undecidedCandidates: EditorialRoundCandidate[];
  openDuplicateGroupCount: number;
  draftsAwaitingPublish: EditorialRoundDraft[];
  todayDigest?: EditorialRoundDigest;
  steps: EditorialRoundStep[];
  undecidedCount: number;
  draftCount: number;
}

const digestStatusLabels: Record<DailyDigestStatus, string> = {
  draft: "草稿",
  published: "已发布",
  archived: "已归档"
};

export function getDigestStatusLabel(status: DailyDigestStatus): string {
  return digestStatusLabels[status];
}

function buildSteps(input: {
  undecidedCount: number;
  openDuplicateGroupCount: number;
  draftCount: number;
  todayDigest?: EditorialRoundDigest;
}): EditorialRoundStep[] {
  const { undecidedCount, openDuplicateGroupCount, draftCount, todayDigest } =
    input;

  const candidateStatus: EditorialRoundStepStatus =
    openDuplicateGroupCount > 0
      ? "blocked"
      : undecidedCount > 0
        ? "current"
        : "done";

  const draftStatus: EditorialRoundStepStatus =
    draftCount > 0 ? "current" : "done";

  const digestGenerateStatus: EditorialRoundStepStatus = todayDigest
    ? "done"
    : "todo";

  const digestPublishStatus: EditorialRoundStepStatus =
    todayDigest?.status === "published"
      ? "done"
      : todayDigest
        ? "current"
        : "todo";

  const verifyStatus: EditorialRoundStepStatus =
    todayDigest?.status === "published" ? "current" : "todo";

  return [
    {
      key: "candidates",
      label: "处置候选",
      status: candidateStatus,
      detail:
        openDuplicateGroupCount > 0
          ? `${openDuplicateGroupCount} 组重复待解决`
          : `${undecidedCount} 条待决`
    },
    {
      key: "drafts",
      label: "补内容 / 发布",
      status: draftStatus,
      detail: `${draftCount} 条草稿待发布`
    },
    {
      key: "digest-generate",
      label: "生成简报",
      status: digestGenerateStatus,
      detail: todayDigest ? "今日简报已生成" : "今日简报未生成"
    },
    {
      key: "digest-publish",
      label: "发布简报",
      status: digestPublishStatus,
      detail: todayDigest
        ? getDigestStatusLabel(todayDigest.status)
        : "待生成后发布"
    },
    {
      key: "verify",
      label: "公开面核对",
      status: verifyStatus,
      detail:
        todayDigest?.status === "published" ? "核对公开呈现" : "发布后核对"
    }
  ];
}

export function getEditorialRoundState(): EditorialRoundState {
  const today = getTodayDateString();

  const undecidedCandidates: EditorialRoundCandidate[] = getImportedCandidates()
    .filter((candidate) => candidate.importStatus === "new")
    .map((candidate) => ({
      id: candidate.id,
      title: candidate.originalTitle,
      sourceName: candidate.sourceName,
      publishDate: candidate.publishDate,
      qualityFlags: evaluateCandidateQuality(candidate).flags.filter(
        (flag) => !reviewOnlyQualityFlags.has(flag)
      )
    }))
    .sort((left, right) => right.publishDate.localeCompare(left.publishDate));

  const openDuplicateGroupCount = getDuplicateGroups().filter(
    (group) => group.status === "open"
  ).length;

  const draftsAwaitingPublish: EditorialRoundDraft[] = getTechnologyDrafts()
    .filter((record) => record.status === "draft")
    .map((record) => {
      const readiness = getTechnologyWorkspacePublishReadiness(record.id);
      const topIssue =
        readiness.blockingErrors[0]?.message ?? readiness.warnings[0]?.message;

      return {
        id: record.id,
        title: record.title.zh?.trim() || record.title.original,
        blockingCount: readiness.blockingErrors.length,
        warningCount: readiness.warnings.length,
        isReady: readiness.isReady,
        topIssue
      };
    })
    .sort((left, right) => right.blockingCount - left.blockingCount);

  const digestRecord = getDailyDigestByDate(today);
  const todayDigest: EditorialRoundDigest | undefined = digestRecord
    ? {
        date: digestRecord.date,
        status: digestRecord.status,
        highPriorityCount: digestRecord.highPriorityTechnologyIds.length,
        watchCount: digestRecord.watchTechnologyIds.length
      }
    : undefined;

  const undecidedCount = undecidedCandidates.length;
  const draftCount = draftsAwaitingPublish.length;

  return {
    today,
    undecidedCandidates,
    openDuplicateGroupCount,
    draftsAwaitingPublish,
    todayDigest,
    steps: buildSteps({
      undecidedCount,
      openDuplicateGroupCount,
      draftCount,
      todayDigest
    }),
    undecidedCount,
    draftCount
  };
}
