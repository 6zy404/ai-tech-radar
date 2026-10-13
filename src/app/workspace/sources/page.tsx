import Link from "next/link";

import { ExternalSourceBrowser } from "@/components/external-source-browser";
import { WorkspacePageShell } from "@/components/workspace-page-shell";
import { getCandidateWorkflowData } from "@/lib/candidate-workflow";
import { evaluateSourcesQuality } from "@/lib/quality-signals";
import { getRecentImportSuccess } from "@/lib/source-health-history";
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
  const now = new Date();
  const recentSuccessById = Object.fromEntries(
    sources.map((source) => [
      source.id,
      getRecentImportSuccess(source.importHistory, now)
    ])
  );
  // The list needs the rate, not 30 history entries per source in its
  // client payload.
  const listSources = sources.map(
    ({ importHistory: _history, ...source }) => source
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
        sources={listSources}
        latestImportRun={latestImportRun}
        sourceQualityById={sourceQualityById}
        recentSuccessById={recentSuccessById}
      />
    </WorkspacePageShell>
  );
}
