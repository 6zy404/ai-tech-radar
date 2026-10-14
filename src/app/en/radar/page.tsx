import { getRadarPageMetadata, RadarPage } from "@/components/pages/radar-page";

// The English twin of src/app/radar/page.tsx; see it for the render mode.
export const dynamic = "force-dynamic";

export const metadata = getRadarPageMetadata("en");

export default function Page() {
  return <RadarPage locale="en" />;
}
