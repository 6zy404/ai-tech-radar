import Link from "next/link";

import { TechnologyDraftCard } from "@/components/technology-draft-card";
import { WorkspaceListToolbar } from "@/components/workspace-list-toolbar";
import { WorkspacePageShell } from "@/components/workspace-page-shell";
import { getTechnologyWorkspaceRecords } from "@/lib/content";

export const dynamic = "force-dynamic";

export default function WorkspaceTechnologiesPage() {
  const records = getTechnologyWorkspaceRecords();
  const draftRecords = records.filter((record) => record.status === "draft");
  const managedRecords = records.filter((record) => record.status !== "draft");
  const draftCount = records.filter(
    (record) => record.status === "draft"
  ).length;
  const publishedCount = records.filter(
    (record) => record.status === "published"
  ).length;
  const archivedCount = records.filter(
    (record) => record.status === "archived"
  ).length;

  return (
    <WorkspacePageShell
      title="技术工作台"
      description="由导入候选生成的内部技术记录。审核草稿质量、保留来源链接并控制发布状态。"
      sectionLabel="草稿管理"
      className="workspace-technologies-console"
      securityNote={
        <>
          <strong>内部技术控制台。</strong>
          草稿编辑、状态变更、来源溯源与预览检查都留在工作台内，之后才会开放任何公开阅读页面。
        </>
      }
      actions={
        <Link
          href="/workspace/candidates"
          className="action-button action-button--accent"
        >
          审核候选
        </Link>
      }
    >
      <section
        className="workspace-status-overview"
        aria-label="技术记录状态总览"
      >
        <div className="workspace-status-overview__card">
          <span>草稿队列</span>
          <strong>{draftCount}</strong>
          <small>等待工作台审核</small>
        </div>
        <div className="workspace-status-overview__card">
          <span>已发布记录</span>
          <strong>{publishedCount}</strong>
          <small>在用户产品中可见</small>
        </div>
        <div className="workspace-status-overview__card">
          <span>已归档记录</span>
          <strong>{archivedCount}</strong>
          <small>保留用于溯源</small>
        </div>
      </section>

      <WorkspaceListToolbar
        label={`${records.length} 条技术工作台记录`}
        detail="草稿在这里编辑；已发布和已归档的记录保留可见，用于内部溯源。"
      />

      <section
        className="workspace-technology-section"
        aria-labelledby="technology-draft-queue"
      >
        <div className="workspace-technology-section__header">
          <div>
            <p className="workspace-technology-section__eyebrow">草稿管理</p>
            <h2 id="technology-draft-queue">技术草稿记录</h2>
          </div>
          <span>{draftRecords.length} 条草稿</span>
        </div>

        <div className="workspace-compact-list technology-workspace-list">
          {draftRecords.map((record) => (
            <TechnologyDraftCard key={record.id} draft={record} />
          ))}
        </div>

        {draftRecords.length === 0 ? (
          <section className="empty-state empty-state--actionable">
            <div>
              <strong>暂无技术草稿。</strong>
              <p>
                先把导入候选转换为技术草稿，再编辑来源背景、关联关系和发布就绪状态。
              </p>
            </div>
            <Link href="/workspace/candidates" className="action-link">
              去候选列表创建草稿
            </Link>
          </section>
        ) : null}
      </section>

      <section
        className="workspace-technology-section"
        aria-labelledby="technology-published-archive"
      >
        <div className="workspace-technology-section__header">
          <div>
            <p className="workspace-technology-section__eyebrow">发布与归档</p>
            <h2 id="technology-published-archive">已发布与已归档记录</h2>
          </div>
          <span>{managedRecords.length} 条记录</span>
        </div>

        <div className="workspace-compact-list technology-workspace-list">
          {managedRecords.map((record) => (
            <TechnologyDraftCard key={record.id} draft={record} />
          ))}
        </div>

        {managedRecords.length === 0 ? (
          <p className="empty-state">
            还没有已发布或已归档的技术记录。草稿审核完成后，发布的记录会出现在这里。
          </p>
        ) : null}
      </section>

      {records.length === 0 ? (
        <p className="workspace-technology-empty-note">
          技术工作台记录只能通过候选转换创建；此页面不负责导入来源或技术排序。
        </p>
      ) : null}
    </WorkspacePageShell>
  );
}
