import {
  getCandidateIdsWithReviewDecision,
  getImportedCandidates,
  updateImportedCandidateStatus
} from "@/lib/candidate-workflow";
import {
  buildPublishedSignalFingerprints,
  evaluateCandidateQuality,
  type PublishedSignalFingerprint
} from "@/lib/quality-signals";
import { getPublishedTechnologyWorkspaceRecords } from "@/lib/technology-draft-workflow";
import type { CandidateQualityFlag, ImportedCandidate } from "@/types/content";

/**
 * The only flags that reject a candidate without a person looking at it.
 *
 * Both are facts about the item rather than judgments about its worth, and
 * every editorial round since 2026-07-27 has rejected them by hand without
 * exception — pre-release tags are superseded by their stable tag within days,
 * and an already-published announcement has nothing left to add.
 *
 * Deliberately NOT here: `missing_summary` / `missing_content`. The Hugging
 * Face and DeepMind feeds ship no description at all, and several published
 * signals came from exactly those items after reading the article page
 * (2026-07-30, 2026-08-04). `possible_duplicate` is not here either — the
 * duplicate group decides which member is primary, and rejecting both sides
 * would lose the item.
 */
export const AUTO_REJECT_FLAGS: readonly CandidateQualityFlag[] = [
  "prerelease_version",
  "already_published"
];

export interface AutoRejection {
  candidateId: string;
  title: string;
  flag: CandidateQualityFlag;
}

/**
 * Pure core: which untouched candidates the rule would reject, and why.
 *
 * Status alone is not enough: an editor who reopens an auto-rejected item sets
 * it back to `new`, which looks exactly like a fresh import, and the next run
 * would reject it again. So only candidates nobody has ever set a status on
 * are considered — `decidedIds` is every id in the review-state file.
 */
export function selectAutoRejections(
  candidates: ImportedCandidate[],
  publishedSignals: PublishedSignalFingerprint[],
  decidedIds: ReadonlySet<string> = new Set()
): AutoRejection[] {
  const rejections: AutoRejection[] = [];

  for (const candidate of candidates) {
    if (candidate.importStatus !== "new" || decidedIds.has(candidate.id)) {
      continue;
    }

    const { flags } = evaluateCandidateQuality(candidate, {
      publishedSignals
    });
    const flag = AUTO_REJECT_FLAGS.find((item) => flags.includes(item));

    if (flag) {
      rejections.push({
        candidateId: candidate.id,
        title: candidate.originalTitle,
        flag
      });
    }
  }

  return rejections;
}

const flagLabels: Partial<Record<CandidateQualityFlag, string>> = {
  prerelease_version: "预发布版本",
  already_published: "已发布过"
};

export function buildAutoTriageMessage(rejections: AutoRejection[]): string {
  if (rejections.length === 0) {
    return "自动分诊：没有符合自动拒绝规则的候选。";
  }

  const counts = new Map<string, number>();

  for (const rejection of rejections) {
    const label = flagLabels[rejection.flag] ?? rejection.flag;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  const breakdown = [...counts.entries()]
    .map(([label, count]) => `${label} ${count}`)
    .join("，");

  return `自动分诊：拒绝 ${rejections.length} 条（${breakdown}）。`;
}

/**
 * Applies the rule to the live pool. Runs after the scheduled import so the
 * public news lane never shows these items in the hours before a round.
 */
export function runCandidateAutoTriage(): {
  rejections: AutoRejection[];
  message: string;
} {
  const publishedSignals = buildPublishedSignalFingerprints(
    getPublishedTechnologyWorkspaceRecords()
  );
  const rejections = selectAutoRejections(
    getImportedCandidates(),
    publishedSignals,
    getCandidateIdsWithReviewDecision()
  );

  for (const rejection of rejections) {
    updateImportedCandidateStatus(rejection.candidateId, "rejected", {
      actorType: "task_runner",
      metadata: { autoTriage: true, reason: rejection.flag }
    });
  }

  return { rejections, message: buildAutoTriageMessage(rejections) };
}
