import Link from "next/link";

import { ExternalSourceBrowser } from "@/components/external-source-browser";
import { WorkspacePageShell } from "@/components/workspace-page-shell";
import { getCandidateWorkflowData } from "@/lib/candidate-workflow";
import { evaluateSourcesQuality } from "@/lib/quality-signals";
import {
  getExternalSourceImportRuns,
  getExternalSources,
  getLatestExternalSourceImportRun
} from "@/lib/source-workflow";

export const dynamic = "force-dynamic";

export default function WorkspaceSourcesPage() {
  const sources = getExternalSources();
  const latestImportRun = getLatestExternalSourceImportRun();
  const importRuns = getExternalSourceImportRuns();
  const { candidates } = getCandidateWorkflowData();
  const sourceQualityById = evaluateSourcesQuality(
    sources,
    candidates,
    importRuns
  );

  return (
    <WorkspacePageShell
      title="来源"
      description="管理外部来源并监控导入健康状态。"
      sectionLabel="来源管理"
      className="workspace-delivery-console workspace-sources-console"
      securityNote={
        <>
          <strong>内部工作台。</strong>
          来源导入会生成候选，发布前请先审核导入内容。
        </>
      }
      actions={
        <Link
          href="/workspace/sources/new"
          className="action-button action-button--accent"
        >
          新增来源
        </Link>
      }
    >
      <ExternalSourceBrowser
        sources={sources}
        latestImportRun={latestImportRun}
        sourceQualityById={sourceQualityById}
      />
    </WorkspacePageShell>
  );
}
