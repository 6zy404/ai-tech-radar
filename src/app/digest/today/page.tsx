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
      title="Daily Technology Digest"
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
        <section className="daily-digest-hero">
          <div>
            <p className="eyebrow user-eyebrow">Daily Digest</p>
            <h1>No published digest yet</h1>
            <p>
              A daily brief will appear here after the first digest is published.
              Check the technology list for published signals in the meantime.
            </p>
          </div>
        </section>
      )}
    </UserPageShell>
  );
}
