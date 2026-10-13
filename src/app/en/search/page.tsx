import {
  generateSearchPageMetadata,
  SearchPage,
  type SearchPageProps
} from "@/components/pages/search-page";

export const dynamic = "force-dynamic";

export function generateMetadata(props: SearchPageProps) {
  return generateSearchPageMetadata("en", props);
}

export default function Page(props: SearchPageProps) {
  return <SearchPage {...props} locale="en" />;
}
