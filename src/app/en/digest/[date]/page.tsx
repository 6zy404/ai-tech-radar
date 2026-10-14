import {
  generateDigestDatePageMetadata,
  DigestDatePage,
  type DigestDatePageProps
} from "@/components/pages/digest-date-page";

export const dynamic = "force-dynamic";

export function generateMetadata(props: DigestDatePageProps) {
  return generateDigestDatePageMetadata("en", props);
}

export default function Page(props: DigestDatePageProps) {
  return <DigestDatePage {...props} locale="en" />;
}
