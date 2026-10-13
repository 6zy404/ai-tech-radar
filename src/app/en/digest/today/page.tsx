import {
  generateTodayDigestPageMetadata,
  TodayDigestPage
} from "@/components/pages/digest-today-page";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return generateTodayDigestPageMetadata("en");
}

export default function Page() {
  return <TodayDigestPage locale="en" />;
}
