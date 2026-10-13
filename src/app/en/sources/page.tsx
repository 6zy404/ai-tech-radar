import {
  getSourcesPageMetadata,
  SourcesPage
} from "@/components/pages/sources-page";

// The English twin of src/app/sources/page.tsx; see it for the render mode.
export const dynamic = "force-dynamic";

export const metadata = getSourcesPageMetadata("en");

export default function Page() {
  return <SourcesPage locale="en" />;
}
