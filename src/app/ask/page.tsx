import {
  getAskPageMetadata,
  AskPage,
  type AskPageProps
} from "@/components/pages/ask-page";

// Answers are generated per request through POST /api/ask; the page itself
// holds no content, but every page declares its render mode (see
// validate:deployment).
export const dynamic = "force-dynamic";

export const metadata = getAskPageMetadata("zh");

export default function Page(props: AskPageProps) {
  return <AskPage {...props} locale="zh" />;
}
