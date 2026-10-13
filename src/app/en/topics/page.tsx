import {
  getTopicIndexPageMetadata,
  TopicIndexPage
} from "@/components/pages/topic-index-page";

// The English twin of src/app/topics/page.tsx; see it for the render mode.
export const dynamic = "force-dynamic";

export const metadata = getTopicIndexPageMetadata("en");

export default function Page() {
  return <TopicIndexPage locale="en" />;
}
