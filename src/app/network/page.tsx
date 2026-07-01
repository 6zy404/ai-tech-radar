import { ContentNetworkGraph } from "@/components/content-network-graph";
import { UserPageShell } from "@/components/user-page-shell";
import { getContentGraph } from "@/lib/content";

export default function NetworkPage() {
  const { nodes, edges } = getContentGraph();

  return (
    <UserPageShell
      title="关系网络总览"
      description="一次看清全部已发布技术、技能和背景知识之间的连接，点击任意节点探索它的邻域。"
      sectionLabel="关系网络"
      className="network-page"
    >
      <ContentNetworkGraph nodes={nodes} edges={edges} />
    </UserPageShell>
  );
}
