import {
  getWeeklyReviewPageMetadata,
  WeeklyReviewPage
} from "@/components/pages/weekly-review-page";

export const dynamic = "force-dynamic";

export const metadata = getWeeklyReviewPageMetadata("en");

export default function Page() {
  return <WeeklyReviewPage locale="en" />;
}
