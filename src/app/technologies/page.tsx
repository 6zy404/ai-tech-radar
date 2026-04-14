import { PageShell } from "@/components/page-shell";
import { TechnologyBrowser } from "@/components/technology-browser";
import { getAllTags, getAllTechnologies } from "@/lib/content";

export default function TechnologiesPage() {
  return (
    <PageShell
      title="Technology Feed"
      description="Browse the demo technology records, search by text, and filter by type or tag."
    >
      <TechnologyBrowser
        technologies={getAllTechnologies()}
        tags={getAllTags()}
      />
    </PageShell>
  );
}
