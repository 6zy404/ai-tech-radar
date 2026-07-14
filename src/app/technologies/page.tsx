import { TechnologyBrowser } from "@/components/technology-browser";
import { UserPageShell } from "@/components/user-page-shell";
import { getAllTags, getAllTechnologies } from "@/lib/content";

export const dynamic = "force-dynamic";

export default function TechnologiesPage() {
  return (
    <UserPageShell
      title="技术信号"
      description="浏览已发布的 AI 技术信号，决定先读哪一条。"
      sectionLabel="已发布信号"
      className="technology-list-page dossier"
    >
      <TechnologyBrowser
        technologies={getAllTechnologies()}
        tags={getAllTags()}
      />
    </UserPageShell>
  );
}
