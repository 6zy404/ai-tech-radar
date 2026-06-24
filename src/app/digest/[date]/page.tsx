import { notFound } from "next/navigation";

import { DailyDigestContent } from "@/components/daily-digest-content";
import { UserPageShell } from "@/components/user-page-shell";
import { getPublishedDailyDigestByDate } from "@/lib/digest-workflow";
import { getDailyDigestRenderData } from "@/lib/digest-view";
import {
  getPublicDigestSummary,
  getPublicDigestTitle
} from "@/lib/public-copy";

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

  const publicTitle = getPublicDigestTitle(digest);
  const publicSummary = getPublicDigestSummary(digest);

  return (
    <UserPageShell
      title={publicTitle}
      description={publicSummary}
      sectionLabel="每日简报"
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
