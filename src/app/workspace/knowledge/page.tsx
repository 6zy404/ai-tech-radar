import Link from "next/link";

import { ContentWorkspaceEntryCard } from "@/components/content-workspace-entry-card";
import { WorkspaceListToolbar } from "@/components/workspace-list-toolbar";
import { WorkspacePageShell } from "@/components/workspace-page-shell";
import { getKnowledgeWorkspaceEntries } from "@/lib/knowledge-workflow";
import type { KnowledgeWorkspaceEntry } from "@/lib/knowledge-workflow";
import type { DifficultyLevel, KnowledgeCategory } from "@/types/content";

export const dynamic = "force-dynamic";

const categoryLabels: Record<KnowledgeCategory, string> = {
  "machine-learning": "机器学习",
  "software-architecture": "软件架构",
  data: "数据",
  "product-thinking": "产品思维",
  operations: "运维"
};
const difficultyLabels: Record<DifficultyLevel, string> = {
  foundation: "基础",
  intermediate: "进阶",
  advanced: "高级"
};

function buildMeta(entry: KnowledgeWorkspaceEntry) {
  return [
    { label: "分类", value: categoryLabels[entry.item.category] },
    { label: "难度", value: difficultyLabels[entry.item.difficulty] },
    { label: "更新于", value: entry.updatedAt?.slice(0, 10) ?? "—" }
  ];
}

export default function WorkspaceKnowledgePage() {
  const entries = getKnowledgeWorkspaceEntries();
  const workspaceEntries = entries.filter((entry) => entry.origin !== "seed");
  const seedEntries = entries.filter((entry) => entry.origin === "seed");
  const draftCount = entries.filter((entry) => entry.status === "draft").length;
  const publishedCount = entries.filter(
    (entry) => entry.status === "published"
  ).length;
  const overrideCount = entries.filter(
    (entry) => entry.origin === "seed_override"
  ).length;

  return (
    <WorkspacePageShell
      title="知识工作台"
      description="解释技术信号的经典概念条目。种子条目与工作台条目在这里统一管理，草稿不会出现在公开页面。"
      sectionLabel="内容管理"
      securityNote={
        <>
          <strong>内部知识控制台。</strong>
          编辑落在本地工作台存储；内置种子条目首次编辑时会复制为工作台版本，种子代码文件不会被改写。
        </>
      }
      actions={
        <Link
          href="/workspace/knowledge/new"
          className="action-button action-button--accent"
        >
          新建知识条目
        </Link>
      }
    >
      <section
        className="workspace-status-overview"
        aria-label="知识条目状态总览"
      >
        <div className="workspace-status-overview__card">
          <span>草稿</span>
          <strong>{draftCount}</strong>
          <small>不出现在公开页面</small>
        </div>
        <div className="workspace-status-overview__card">
          <span>已发布</span>
          <strong>{publishedCount}</strong>
          <small>在用户产品中可见</small>
        </div>
        <div className="workspace-status-overview__card">
          <span>内置种子（未覆盖）</span>
          <strong>{seedEntries.length}</strong>
          <small>来自代码内置数据</small>
        </div>
        <div className="workspace-status-overview__card">
          <span>工作台覆盖</span>
          <strong>{overrideCount}</strong>
          <small>以工作台版本为准</small>
        </div>
      </section>

      <WorkspaceListToolbar
        label={`${entries.length} 条知识条目`}
        detail="工作台条目在前（含种子覆盖），未编辑过的内置种子在后。"
      />

      <section
        className="workspace-technology-section"
        aria-labelledby="knowledge-workspace-entries"
      >
        <div className="workspace-technology-section__header">
          <div>
            <p className="workspace-technology-section__eyebrow">工作台条目</p>
            <h2 id="knowledge-workspace-entries">新建与覆盖条目</h2>
          </div>
          <span>{workspaceEntries.length} 条</span>
        </div>

        <div className="workspace-compact-list technology-workspace-list">
          {workspaceEntries.map((entry) => (
            <ContentWorkspaceEntryCard
              key={entry.item.id}
              typeLabel="知识工作台"
              title={entry.item.title}
              summary={entry.item.summary}
              status={entry.status}
              origin={entry.origin}
              meta={buildMeta(entry)}
              editHref={`/workspace/knowledge/${entry.item.id}`}
              publicHref={`/knowledge/${entry.item.slug}`}
            />
          ))}
        </div>

        {workspaceEntries.length === 0 ? (
          <section className="empty-state empty-state--actionable">
            <div>
              <strong>还没有工作台知识条目。</strong>
              <p>新建一条知识，或直接编辑下方的内置种子条目。</p>
            </div>
            <Link href="/workspace/knowledge/new" className="action-link">
              新建知识条目
            </Link>
          </section>
        ) : null}
      </section>

      <section
        className="workspace-technology-section"
        aria-labelledby="knowledge-seed-entries"
      >
        <div className="workspace-technology-section__header">
          <div>
            <p className="workspace-technology-section__eyebrow">内置种子</p>
            <h2 id="knowledge-seed-entries">未编辑过的种子条目</h2>
          </div>
          <span>{seedEntries.length} 条</span>
        </div>

        <div className="workspace-compact-list technology-workspace-list">
          {seedEntries.map((entry) => (
            <ContentWorkspaceEntryCard
              key={entry.item.id}
              typeLabel="知识工作台"
              title={entry.item.title}
              summary={entry.item.summary}
              status={entry.status}
              origin={entry.origin}
              meta={buildMeta(entry)}
              editHref={`/workspace/knowledge/${entry.item.id}`}
              publicHref={`/knowledge/${entry.item.slug}`}
            />
          ))}
        </div>
      </section>
    </WorkspacePageShell>
  );
}
