import { ContentCard } from "@/components/content-card";
import { PageShell } from "@/components/page-shell";
import { getAllKnowledge } from "@/lib/content";

export default function KnowledgePage() {
  const knowledgeItems = getAllKnowledge();

  return (
    <PageShell
      title="Classic Knowledge"
      description="A static library of older concepts that help users make sense of fast-moving technology updates."
    >
      <div className="content-grid">
        {knowledgeItems.map((item) => (
          <ContentCard
            key={item.id}
            title={item.title}
            summary={item.summary}
            href={`/knowledge/${item.slug}`}
            meta={[item.category, item.difficulty]}
          />
        ))}
      </div>
    </PageShell>
  );
}
