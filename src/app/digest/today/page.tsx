import Link from "next/link";

import { DailyDigestContent } from "@/components/daily-digest-content";
import { UserPageShell } from "@/components/user-page-shell";
import {
  getLatestPublishedDailyDigest,
  getPublishedDailyDigestByDate,
  getTodayDateString
} from "@/lib/digest-workflow";
import { getDailyDigestRenderData } from "@/lib/digest-view";

export const dynamic = "force-dynamic";

export default function TodayDigestPage() {
  const today = getTodayDateString();
  const todayDigest = getPublishedDailyDigestByDate(today);
  const latestDigest = todayDigest ?? getLatestPublishedDailyDigest();
  const previewNotice = todayDigest
    ? undefined
    : latestDigest
      ? `Showing the latest published digest from ${latestDigest.date}.`
      : undefined;

  return (
    <UserPageShell
      title="AI Tech Digest"
      description="A reading-first brief of the technology signals worth checking today."
      sectionLabel="Daily Digest"
      showHeader={false}
    >
      {latestDigest ? (
        <DailyDigestContent
          digest={latestDigest}
          previewNotice={previewNotice}
          showDeliveryLinks
          {...getDailyDigestRenderData(latestDigest)}
        />
      ) : (
        <section className="daily-digest-empty">
          <div>
            <p className="eyebrow user-eyebrow">Daily Digest</p>
            <h1>No published digest for today.</h1>
            <p>
              A published daily brief will appear here after the first digest is
              published. Browse the technology signal stream in the meantime.
            </p>
            <Link className="action-link" href="/technologies">
              Browse technology signals
            </Link>
          </div>
        </section>
      )}
    </UserPageShell>
  );
}
