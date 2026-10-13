import { ContentNetworkGraph } from "@/components/content-network-graph";
import { UserPageShell } from "@/components/user-page-shell";
import { getContentGraph } from "@/lib/content";
import { resolveNetworkFocus } from "@/lib/network-focus";
import { buildPageMetadata } from "@/lib/site-metadata";

export const networkPageMetadata = buildPageMetadata({
  title: "关系网络总览",
  description: "一次看清全部已发布技术、技能和背景知识之间的连接。",
  path: "/network"
});

interface NetworkPageProps {
  searchParams: Promise<{ focus?: string | string[] }>;
}

export async function NetworkPage({ searchParams }: NetworkPageProps) {
  const { focus } = await searchParams;
  const { nodes, edges } = getContentGraph();
  // `?focus=<node id>` opens the page with that node selected. An unknown or
  // unpublished id is dropped here, so the page renders exactly as it would
  // without the parameter.
  const initialFocusId = resolveNetworkFocus(focus, nodes);

  return (
    <UserPageShell
      title="关系网络总览"
      description="一次看清全部已发布技术、技能和背景知识之间的连接。"
      sectionLabel="关系网络"
      className="network-page dossier"
    >
      <ContentNetworkGraph
        nodes={nodes}
        edges={edges}
        initialFocusId={initialFocusId}
      />
    </UserPageShell>
  );
}
