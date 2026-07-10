import { notFound } from "next/navigation";

import { DailyDigestWorkspaceDetail } from "@/components/daily-digest-workspace-detail";
import { WorkspacePageShell } from "@/components/workspace-page-shell";
import { getAllTechnologies } from "@/lib/content";
import {
  getEnabledDeliveryChannels,
  getDeliveryRunsForDigest
} from "@/lib/delivery-workflow";
import {
  evaluateDailyDigestPublishReadiness,
  getDailyDigestByDate,
  getSelectedDigestTechnologyIds
} from "@/lib/digest-workflow";
import { getDailyDigestRenderData } from "@/lib/digest-view";
import { getWorkflowEventsForEntity } from "@/lib/workflow-events";

interface WorkspaceDigestDetailPageProps {
  params: Promise<{ date: string }>;
}

export const dynamic = "force-dynamic";

export default async function WorkspaceDigestDetailPage({
  params
}: WorkspaceDigestDetailPageProps) {
  const { date } = await params;
  const digest = getDailyDigestByDate(date);

  if (!digest) {
    notFound();
  }

  const selectedTechnologyIds = new Set(getSelectedDigestTechnologyIds(digest));
  const availableTechnologies = getAllTechnologies().filter(
    (technology) => !selectedTechnologyIds.has(technology.id)
  );
  const readiness = evaluateDailyDigestPublishReadiness(digest);

  return (
    <WorkspacePageShell
      title="每日简报详情"
      description="查看生成的简报、审核选入的技术与排序理由，就绪后发布。"
      sectionLabel="简报审核"
    >
      <DailyDigestWorkspaceDetail
        digest={digest}
        readiness={readiness}
        availableTechnologies={availableTechnologies}
        deliveryChannels={getEnabledDeliveryChannels()}
        deliveryRuns={getDeliveryRunsForDigest(digest.date)}
        workflowEvents={getWorkflowEventsForEntity("daily_digest", digest.id)}
        {...getDailyDigestRenderData(digest)}
      />
    </WorkspacePageShell>
  );
}
