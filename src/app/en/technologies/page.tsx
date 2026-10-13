import {
  generateTechnologiesPageMetadata,
  TechnologiesPage,
  type TechnologiesPageProps
} from "@/components/pages/technologies-page";

export const dynamic = "force-dynamic";

export function generateMetadata(props: TechnologiesPageProps) {
  return generateTechnologiesPageMetadata("en", props);
}

export default function Page(props: TechnologiesPageProps) {
  return <TechnologiesPage {...props} locale="en" />;
}
