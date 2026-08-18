import { ContentNetworkGraph } from "@/components/content-network-graph";
import { UserPageShell } from "@/components/user-page-shell";
import { getContentGraph } from "@/lib/content";

// Reads runtime content through @/lib/content, so it must never be
// prerendered: a build-time copy freezes whatever the workspace had
// published when the build ran and never regenerates
// (initialRevalidateSeconds is false). See CHANGELOG - "Five public pages
// would have shipped frozen at build time".
export const dynamic = "force-dynamic";

export default function NetworkPage() {
  const { nodes, edges } = getContentGraph();

  return (
    <UserPageShell
      title="关系网络总览"
      description="一次看清全部已发布技术、技能和背景知识之间的连接。"
      sectionLabel="关系网络"
      className="network-page dossier"
    >
      <ContentNetworkGraph nodes={nodes} edges={edges} />
    </UserPageShell>
  );
}
