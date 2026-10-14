import {
  getSourcesPageMetadata,
  SourcesPage
} from "@/components/pages/sources-page";

// Reads runtime content through @/lib/content, so it must never be
// prerendered: a build-time copy freezes whatever the workspace had
// published when the build ran. See CHANGELOG - "Five public pages would
// have shipped frozen at build time".
export const dynamic = "force-dynamic";

export const metadata = getSourcesPageMetadata("zh");

export default function Page() {
  return <SourcesPage locale="zh" />;
}
