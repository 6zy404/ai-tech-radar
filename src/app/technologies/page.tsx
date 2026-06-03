import { TechnologyBrowser } from "@/components/technology-browser";
import { UserPageShell } from "@/components/user-page-shell";
import { getAllTags, getAllTechnologies } from "@/lib/content";

export const dynamic = "force-dynamic";

export default function TechnologiesPage() {
  return (
    <UserPageShell
      title="Technology Signals"
      description="已发布 AI 技术信号，按优先级、适合人群、来源和学习路径整理，帮助你判断先看什么。中文内容优先展示，原始来源保留入口。"
      sectionLabel="已发布技术信号"
      className="technology-list-page"
    >
      <TechnologyBrowser
        technologies={getAllTechnologies()}
        tags={getAllTags()}
      />
    </UserPageShell>
  );
}
