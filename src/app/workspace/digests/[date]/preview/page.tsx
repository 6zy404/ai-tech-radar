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
      title="每日简报预览"
      description="发布前用用户端渲染器预览这期简报。"
      sectionLabel="简报预览"
      actions={
        <Link
          href={`/workspace/digests/${digest.date}`}
          className="action-link"
        >
          返回简报审核
        </Link>
      }
    >
      <DailyDigestContent
        digest={toPublicDigestView(digest)}
        previewNotice="仅工作台预览。草稿和已归档简报不会通过公开的 /digest/[date] 路由提供。"
        {...getDailyDigestRenderData(digest)}
      />
    </WorkspacePageShell>
  );
}
