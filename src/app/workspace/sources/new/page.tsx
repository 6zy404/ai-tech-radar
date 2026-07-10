import Link from "next/link";

import { ExternalSourceForm } from "@/components/external-source-form";
import { WorkspacePageShell } from "@/components/workspace-page-shell";

export const dynamic = "force-dynamic";

export default function NewWorkspaceSourcePage() {
  return (
    <WorkspacePageShell
      title="新增外部来源"
      description="创建本地来源配置，把外部技术更新导入内部候选池。"
      sectionLabel="来源管理"
      actions={
        <Link href="/workspace/sources" className="action-link">
          返回来源列表
        </Link>
      }
    >
      <section className="section-panel">
        <ExternalSourceForm />
      </section>
    </WorkspacePageShell>
  );
}
