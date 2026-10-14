import {
  getDigestArchivePageMetadata,
  DigestArchivePage
} from "@/components/pages/digest-archive-page";

export const dynamic = "force-dynamic";

export const metadata = getDigestArchivePageMetadata("en");

export default function Page() {
  return <DigestArchivePage locale="en" />;
}
