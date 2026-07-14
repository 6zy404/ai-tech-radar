import { MyRadarContent } from "@/components/my-radar-content";
import { UserPageShell } from "@/components/user-page-shell";
import { getAllTags, getAllTechnologies } from "@/lib/content";

export const dynamic = "force-dynamic";

export default function MyRadarPage() {
  return (
    <UserPageShell
      title="我的雷达"
      description="关注你在意的话题，按优先级聚合命中的已发布技术信号。关注状态只保存在你的浏览器里。"
      sectionLabel="个人雷达"
      className="my-radar-page dossier"
    >
      <MyRadarContent technologies={getAllTechnologies()} tags={getAllTags()} />
    </UserPageShell>
  );
}
