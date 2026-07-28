import Link from "next/link";

import { MyRadarContent } from "@/components/my-radar-content";
import { NewsFeedSection } from "@/components/news-feed-section";
import { SavedSignalsContent } from "@/components/saved-signals-content";
import { TechnologyBrowser } from "@/components/technology-browser";
import { TopicTimelineSection } from "@/components/topic-timeline-section";
import { UserPageShell } from "@/components/user-page-shell";
import { getAllTags, getAllTechnologies } from "@/lib/content";

export const dynamic = "force-dynamic";

type TechnologyView = "curated" | "news" | "timeline" | "followed" | "saved";

interface TechnologiesPageProps {
  searchParams: Promise<{ view?: string }>;
}

function parseView(raw: string | undefined): TechnologyView {
  if (
    raw === "news" ||
    raw === "timeline" ||
    raw === "followed" ||
    raw === "saved"
  ) {
    return raw;
  }

  return "curated";
}

const viewTabs: { value: TechnologyView; label: string; href: string }[] = [
  { value: "curated", label: "精选", href: "/technologies" },
  { value: "news", label: "全部快讯", href: "/technologies?view=news" },
  { value: "timeline", label: "按话题", href: "/technologies?view=timeline" },
  {
    value: "followed",
    label: "我关注的",
    href: "/technologies?view=followed"
  },
  { value: "saved", label: "稍后读", href: "/technologies?view=saved" }
];

const viewDescriptions: Record<TechnologyView, string> = {
  curated: "浏览已发布的 AI 技术信号，决定先读哪一条。",
  news: "最近 7 天从外部来源自动聚合的 AI 资讯，按日期分组。想看有编辑判断的内容，请切换到「精选」或阅读每日简报。",
  timeline:
    "按话题查看已发布技术信号的时间演进：同一主题下先后发生了什么，一眼看清脉络。",
  followed:
    "关注你在意的话题，按优先级聚合命中的已发布技术信号。关注状态只保存在你的浏览器里。",
  saved:
    "你标记为「稍后读」的技术信号，最近保存的排在前面。已读与稍后读的标记只保存在你的浏览器里。"
};

export default async function TechnologiesPage({
  searchParams
}: TechnologiesPageProps) {
  const view = parseView((await searchParams).view);
  const technologies = getAllTechnologies();
  const tags = getAllTags();

  return (
    <UserPageShell
      title="技术信号"
      description={viewDescriptions[view]}
      sectionLabel="已发布信号"
      className="technology-list-page dossier"
    >
      <div
        className="technology-view-tabs"
        role="tablist"
        aria-label="技术信号视图切换"
      >
        {viewTabs.map((tab) => (
          <Link
            key={tab.value}
            href={tab.href}
            role="tab"
            aria-selected={view === tab.value}
            className={`technology-view-tab${
              view === tab.value ? " technology-view-tab--active" : ""
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {view === "news" ? (
        <NewsFeedSection />
      ) : view === "timeline" ? (
        <TopicTimelineSection technologies={technologies} tags={tags} />
      ) : view === "followed" ? (
        <MyRadarContent technologies={technologies} tags={tags} />
      ) : view === "saved" ? (
        <SavedSignalsContent technologies={technologies} tags={tags} />
      ) : (
        <TechnologyBrowser technologies={technologies} tags={tags} />
      )}
    </UserPageShell>
  );
}
