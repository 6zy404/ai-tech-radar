import {
  generateTechnologyDetailPageMetadata,
  TechnologyDetailPage,
  type TechnologyDetailPageProps
} from "@/components/pages/technology-detail-page";

export const dynamic = "force-dynamic";

export function generateMetadata(props: TechnologyDetailPageProps) {
  return generateTechnologyDetailPageMetadata("zh", props);
}

export default function Page(props: TechnologyDetailPageProps) {
  return <TechnologyDetailPage {...props} locale="zh" />;
}
