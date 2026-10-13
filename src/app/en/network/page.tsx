import {
  getNetworkPageMetadata,
  NetworkPage,
  type NetworkPageProps
} from "@/components/pages/network-page";

// The English twin of src/app/network/page.tsx; see it for the render mode.
export const dynamic = "force-dynamic";

export const metadata = getNetworkPageMetadata("en");

export default function Page(props: NetworkPageProps) {
  return <NetworkPage {...props} locale="en" />;
}
