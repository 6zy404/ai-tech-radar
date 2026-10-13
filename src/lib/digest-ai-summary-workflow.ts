import {
  DIGEST_SUMMARY_PROMPT_VERSION,
  draftOverview,
  type OverviewDraftResult,
  type OverviewSection,
  type OverviewSignal
} from "@/lib/digest-ai-summary";
import {
  getDailyDigestByDate,
  getDigestTechnologySections
} from "@/lib/digest-workflow";
import type { LlmProvider } from "@/lib/llm/provider";
import { createConfiguredLlmProvider } from "@/lib/llm/providers";
import {
  getPreferredTechnologySummary,
  getPreferredTechnologyTitle
} from "@/lib/technology-localization";
import {
  tryRecordWorkflowError,
  tryRecordWorkflowEvent
} from "@/lib/workflow-events";
import type { TechnologyItem } from "@/types/content";

/**
 * 「AI 起草导语」 for one digest issue: the signals the issue currently
 * selects, in the order and sections the public page shows them, go to the
 * model; the draft comes back to the editor's form. Nothing is saved — the
 * editor saves through the ordinary PATCH. The run is recorded as a
 * workspace-only workflow event with the model and prompt version.
 */

export function toOverviewSignal(
  technology: TechnologyItem,
  section: OverviewSection
): OverviewSignal {
  return {
    section,
    title: getPreferredTechnologyTitle(technology),
    summary: getPreferredTechnologySummary(technology),
    ...(technology.whyItMatters
      ? { whyItMatters: technology.whyItMatters }
      : {}),
    ...(technology.publisherName
      ? { publisherName: technology.publisherName }
      : {}),
    publishDate: technology.publishDate
  };
}

export async function draftDigestEditorialSummary(
  date: string,
  options: { provider?: LlmProvider } = {}
): Promise<OverviewDraftResult> {
  const digest = getDailyDigestByDate(date);

  if (!digest) {
    return { ok: false, status: 404, error: "找不到这一期简报。" };
  }

  const { highPriorityTechnologies, watchTechnologies } =
    getDigestTechnologySections(digest);
  const signals = [
    ...highPriorityTechnologies.map((item) =>
      toOverviewSignal(item, "立即关注")
    ),
    ...watchTechnologies.map((item) => toOverviewSignal(item, "值得跟踪"))
  ];
  const provider = options.provider ?? createConfiguredLlmProvider();
  const result = await draftOverview(
    "digest",
    { label: `${digest.date} 这一期`, signals },
    provider
  );

  if (result.ok) {
    tryRecordWorkflowEvent({
      entityType: "daily_digest",
      entityId: digest.id,
      action: "digest.ai_summary_drafted",
      actorType: "workspace_user",
      metadata: {
        date: digest.date,
        signalCount: signals.length,
        modelName: result.metadata.modelName,
        promptVersion: result.metadata.promptVersion,
        latencyMs: result.metadata.latencyMs,
        totalTokens: result.metadata.tokenUsage?.totalTokens,
        warningCount: result.warnings.length
      }
    });
  } else if (result.status !== 409) {
    tryRecordWorkflowError({
      entityType: "daily_digest",
      entityId: digest.id,
      action: "digest.ai_summary_failed",
      actorType: "workspace_user",
      error: new Error(result.error),
      metadata: {
        date: digest.date,
        promptVersion: DIGEST_SUMMARY_PROMPT_VERSION,
        ...result.metadata
      }
    });
  }

  return result;
}
