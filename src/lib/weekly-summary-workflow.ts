import { revalidatePath } from "next/cache";

import { getAllTechnologies } from "@/lib/content";
import {
  WEEKLY_SUMMARY_PROMPT_VERSION,
  draftOverview,
  type OverviewDraftResult
} from "@/lib/digest-ai-summary";
import { toOverviewSignal } from "@/lib/digest-ai-summary-workflow";
import type { LlmProvider } from "@/lib/llm/provider";
import { createConfiguredLlmProvider } from "@/lib/llm/providers";
import { getWeeklyReview } from "@/lib/weekly-review";
import {
  tryRecordWorkflowError,
  tryRecordWorkflowEvent
} from "@/lib/workflow-events";

/** Everything that shows a week's summary, after a save or a status change. */
export function revalidateWeeklySummaryPaths(weekKey: string): void {
  revalidatePath("/workspace/weekly-summaries");
  revalidatePath(`/workspace/weekly-summaries/${weekKey}`);
  revalidatePath("/digest/weekly");
  revalidatePath(`/digest/weekly/${weekKey}`);
  revalidatePath("/digest/weekly/feed.xml");
}

/**
 * 「AI 起草」 for a week's 本周总结: the week's shown signals, in the review's
 * own groups and order, go to the model; the draft comes back to the editor's
 * box and is saved only when the editor saves it (as a draft — publishing is
 * a separate click). Model and prompt version are recorded in a
 * workspace-only workflow event, never on the record readers see.
 */
export async function draftWeeklySummary(
  weekKey: string,
  options: { provider?: LlmProvider } = {}
): Promise<OverviewDraftResult> {
  const week = getWeeklyReview(weekKey);

  if (!week) {
    return {
      ok: false,
      status: 400,
      error: "周的 key 必须是那一周周一的日期。"
    };
  }

  const bySlug = new Map(getAllTechnologies().map((item) => [item.slug, item]));
  const signals = week.groups.flatMap((group) =>
    group.signals.flatMap((signal) => {
      const item = bySlug.get(signal.slug);

      return item
        ? [
            toOverviewSignal(
              item,
              group.level === "high_priority" ? "立即关注" : "值得跟踪"
            )
          ]
        : [];
    })
  );
  const provider = options.provider ?? createConfiguredLlmProvider();
  const result = await draftOverview(
    "weekly",
    { label: `${week.rangeLabel}（周一到周日）这一周`, signals },
    provider
  );

  if (result.ok) {
    tryRecordWorkflowEvent({
      entityType: "weekly_summary",
      entityId: weekKey,
      action: "weekly_summary.ai_drafted",
      actorType: "workspace_user",
      metadata: {
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
      entityType: "weekly_summary",
      entityId: weekKey,
      action: "weekly_summary.ai_draft_failed",
      actorType: "workspace_user",
      error: new Error(result.error),
      metadata: {
        promptVersion: WEEKLY_SUMMARY_PROMPT_VERSION,
        ...result.metadata
      }
    });
  }

  return result;
}
