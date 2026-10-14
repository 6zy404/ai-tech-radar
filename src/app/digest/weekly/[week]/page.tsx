import {
  generateWeeklyReviewWeekPageMetadata,
  WeeklyReviewWeekPage,
  type WeeklyReviewWeekPageProps
} from "@/components/pages/weekly-review-week-page";

export const dynamic = "force-dynamic";

export function generateMetadata(props: WeeklyReviewWeekPageProps) {
  return generateWeeklyReviewWeekPageMetadata("zh", props);
}

export default function Page(props: WeeklyReviewWeekPageProps) {
  return <WeeklyReviewWeekPage {...props} locale="zh" />;
}
