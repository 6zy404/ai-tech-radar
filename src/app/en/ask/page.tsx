import {
  getAskPageMetadata,
  AskPage,
  type AskPageProps
} from "@/components/pages/ask-page";

// The English twin of src/app/ask/page.tsx; see it for the render mode.
export const dynamic = "force-dynamic";

export const metadata = getAskPageMetadata("en");

export default function Page(props: AskPageProps) {
  return <AskPage {...props} locale="en" />;
}
