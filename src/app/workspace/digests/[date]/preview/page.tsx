import Link from "next/link";
import { notFound } from "next/navigation";

import { DailyDigestContent } from "@/components/daily-digest-content";
import { WorkspacePageShell } from "@/components/workspace-page-shell";
import { getDailyDigestByDate } from "@/lib/digest-workflow";
import {
  getDailyDigestRenderData,
  toPublicDigestView
} from "@/lib/digest-view";

interface WorkspaceDigestPreviewPageProps {
  params: Promise<{ date: string }>;
}

export const dynamic = "force-dynamic";

export default async function WorkspaceDigestPreviewPage({
  params
}: WorkspaceDigestPreviewPageProps) {
  const { date } = await params;
  const digest = getDailyDigestByDate(date);

  if (!digest) {
    notFound();
  }

  return (
    <WorkspacePageShell
      title="Daily Digest Preview"
      description="Preview the digest with the user-facing renderer before publishing."
      sectionLabel="Digest Preview"
      actions={
        <Link
          href={`/workspace/digests/${digest.date}`}
          className="action-link"
        >
          Back to digest review
        </Link>
      }
    >
      <DailyDigestContent
        digest={toPublicDigestView(digest)}
        previewNotice="Workspace preview only. Draft or archived digests are not available through the public /digest/[date] route."
        {...getDailyDigestRenderData(digest)}
      />
    </WorkspacePageShell>
  );
}
