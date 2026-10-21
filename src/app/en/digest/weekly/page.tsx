import {
  getWeeklyReviewPageMetadata,
  WeeklyReviewPage
} from "@/components/pages/weekly-review-page";

export const dynamic = "force-dynamic";

// A function, not a constant: the canonical names this week's page.
export function generateMetadata() {
  return getWeeklyReviewPageMetadata("en");
}

export default function Page() {
  return <WeeklyReviewPage locale="en" />;
}
