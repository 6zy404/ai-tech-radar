import { TechnologyBrowser } from "@/components/technology-browser";
import { UserPageShell } from "@/components/user-page-shell";
import { getAllTags, getAllTechnologies } from "@/lib/content";

export const dynamic = "force-dynamic";

export default function TechnologiesPage() {
  return (
    <UserPageShell
      title="Technology Signals"
      description="Discover published AI technology signals and decide what to read first."
      sectionLabel="Published signals"
      className="technology-list-page"
    >
      <TechnologyBrowser
        technologies={getAllTechnologies()}
        tags={getAllTags()}
      />
    </UserPageShell>
  );
}
