import { notFound } from "next/navigation";

import { DailyDigestContent } from "@/components/daily-digest-content";
import { UserPageShell } from "@/components/user-page-shell";
import { getPublishedDailyDigestByDate } from "@/lib/digest-workflow";
import { getDailyDigestRenderData } from "@/lib/digest-view";

interface DigestDatePageProps {
  params: Promise<{ date: string }>;
}

export const dynamic = "force-dynamic";

export default async function DigestDatePage({ params }: DigestDatePageProps) {
  const { date } = await params;
  const digest = getPublishedDailyDigestByDate(date);

  if (!digest) {
    notFound();
  }

  return (
    <UserPageShell
      title={digest.title}
      description={digest.editorialSummary?.trim() || digest.summary}
      sectionLabel="Daily Digest"
      showHeader={false}
    >
      <DailyDigestContent
        digest={digest}
        showDeliveryLinks
        {...getDailyDigestRenderData(digest)}
      />
    </UserPageShell>
  );
}
