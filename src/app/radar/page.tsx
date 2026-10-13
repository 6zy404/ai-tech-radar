import { radarPageMetadata, RadarPage } from "@/components/pages/radar-page";

// Reads runtime content (the radar overlay and the published pools), so it
// must never be prerendered: a build-time copy would freeze the radar on the
// day the build ran. See CHANGELOG - "Five public pages would have shipped
// frozen at build time".
export const dynamic = "force-dynamic";

export const metadata = radarPageMetadata;

export default RadarPage;
