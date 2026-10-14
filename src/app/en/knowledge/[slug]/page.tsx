import {
  generateKnowledgeDetailPageMetadata,
  KnowledgeDetailPage,
  type KnowledgeDetailPageProps
} from "@/components/pages/knowledge-detail-page";

// The English twin of src/app/knowledge/[slug]/page.tsx; see it for the render mode.
export const dynamic = "force-dynamic";

export function generateMetadata(props: KnowledgeDetailPageProps) {
  return generateKnowledgeDetailPageMetadata("en", props);
}

export default function Page(props: KnowledgeDetailPageProps) {
  return <KnowledgeDetailPage {...props} locale="en" />;
}
