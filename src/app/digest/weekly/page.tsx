import {
  getWeeklyReviewPageMetadata,
  WeeklyReviewPage
} from "@/components/pages/weekly-review-page";

export const dynamic = "force-dynamic";

export const metadata = getWeeklyReviewPageMetadata("zh");

export default function Page() {
  return <WeeklyReviewPage locale="zh" />;
}
