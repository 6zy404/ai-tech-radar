import { getHomePageMetadata, HomePage } from "@/components/pages/home-page";

export const dynamic = "force-dynamic";

export const metadata = getHomePageMetadata("zh");

export default function Page() {
  return <HomePage locale="zh" />;
}
