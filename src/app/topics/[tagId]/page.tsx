import {
  generateTopicHubPageMetadata,
  TopicHubPage,
  type TopicHubPageProps
} from "@/components/pages/topic-hub-page";

export const dynamic = "force-dynamic";

export function generateMetadata(props: TopicHubPageProps) {
  return generateTopicHubPageMetadata("zh", props);
}

export default function Page(props: TopicHubPageProps) {
  return <TopicHubPage {...props} locale="zh" />;
}
