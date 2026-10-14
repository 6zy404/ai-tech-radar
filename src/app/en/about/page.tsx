import { getAboutPageMetadata, AboutPage } from "@/components/pages/about-page";

// The English twin of src/app/about/page.tsx; see it for the render mode.
export const dynamic = "force-dynamic";

export const metadata = getAboutPageMetadata("en");

export default function Page() {
  return <AboutPage locale="en" />;
}
