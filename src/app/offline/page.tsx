import type { Metadata } from "next";

import { PwaOfflineSavedList } from "@/components/pwa-offline-saved-list";
import { UserPageShell } from "@/components/user-page-shell";

// The page the service worker shows when the reader is offline and the page
// they asked for is not one of their saved signals. Precached on install, so
// it is the build's own copy; the list of saved pages is read from the
// worker's cache in the browser.

// Fixed copy, but every page declares its render mode (validate:deployment).
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "现在离线",
  robots: { index: false, follow: false }
};

export default function OfflinePage() {
  return (
    <UserPageShell
      title="现在离线"
      description="网络恢复后刷新即可；存进「稍后读」的信号可以离线打开。"
      sectionLabel="离线"
      className="dossier"
    >
      <PwaOfflineSavedList />
    </UserPageShell>
  );
}
