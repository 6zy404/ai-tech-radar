import Link from "next/link";

import { ContentWorkspaceEntryCard } from "@/components/content-workspace-entry-card";
import { WorkspaceListToolbar } from "@/components/workspace-list-toolbar";
import { WorkspacePageShell } from "@/components/workspace-page-shell";
import { getSkillWorkspaceEntries } from "@/lib/skill-workflow";
import type { SkillWorkspaceEntry } from "@/lib/skill-workflow";
import type { HeatLevel, LearningCost, SkillType } from "@/types/content";

export const dynamic = "force-dynamic";

const skillTypeLabels: Record<SkillType, string> = {
  engineering: "工程落地",
  analysis: "评估与分析",
  product: "产品决策",
  operations: "运维",
  communication: "沟通协作"
};
const heatLabels: Record<HeatLevel, string> = {
  emerging: "新兴",
  active: "活跃",
  hot: "当前热门"
};
const learningCostLabels: Record<LearningCost, string> = {
  low: "低",
  medium: "中",
  high: "高"
};

function buildMeta(entry: SkillWorkspaceEntry) {
  return [
    { label: "类型", value: skillTypeLabels[entry.item.skillType] },
    { label: "热度", value: heatLabels[entry.item.heatLevel] },
    { label: "学习成本", value: learningCostLabels[entry.item.learningCost] },
    { label: "更新于", value: entry.updatedAt?.slice(0, 10) ?? "—" }
  ];
}

export default function WorkspaceSkillsPage() {
  const entries = getSkillWorkspaceEntries();
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
      title="技能工作台"
      description="面向读者的实践技能条目。种子条目与工作台条目在这里统一管理，草稿不会出现在公开页面。"
      sectionLabel="内容管理"
      securityNote={
        <>
          <strong>内部技能控制台。</strong>
          编辑落在本地工作台存储；内置种子条目首次编辑时会复制为工作台版本，种子代码文件不会被改写。
        </>
      }
      actions={
        <Link
          href="/workspace/skills/new"
          className="action-button action-button--accent"
        >
          新建技能
        </Link>
      }
    >
      <section className="workspace-status-overview" aria-label="技能状态总览">
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
        label={`${entries.length} 条技能条目`}
        detail="工作台条目在前（含种子覆盖），未编辑过的内置种子在后。"
      />

      <section
        className="workspace-technology-section"
        aria-labelledby="skill-workspace-entries"
      >
        <div className="workspace-technology-section__header">
          <div>
            <p className="workspace-technology-section__eyebrow">工作台条目</p>
            <h2 id="skill-workspace-entries">新建与覆盖条目</h2>
          </div>
          <span>{workspaceEntries.length} 条</span>
        </div>

        <div className="workspace-compact-list technology-workspace-list">
          {workspaceEntries.map((entry) => (
            <ContentWorkspaceEntryCard
              key={entry.item.id}
              typeLabel="技能工作台"
              title={entry.item.title}
              summary={entry.item.summary}
              status={entry.status}
              origin={entry.origin}
              meta={buildMeta(entry)}
              editHref={`/workspace/skills/${entry.item.id}`}
              publicHref={`/skills/${entry.item.slug}`}
            />
          ))}
        </div>

        {workspaceEntries.length === 0 ? (
          <section className="empty-state empty-state--actionable">
            <div>
              <strong>还没有工作台技能条目。</strong>
              <p>新建一条技能，或直接编辑下方的内置种子条目。</p>
            </div>
            <Link href="/workspace/skills/new" className="action-link">
              新建技能
            </Link>
          </section>
        ) : null}
      </section>

      <section
        className="workspace-technology-section"
        aria-labelledby="skill-seed-entries"
      >
        <div className="workspace-technology-section__header">
          <div>
            <p className="workspace-technology-section__eyebrow">内置种子</p>
            <h2 id="skill-seed-entries">未编辑过的种子条目</h2>
          </div>
          <span>{seedEntries.length} 条</span>
        </div>

        <div className="workspace-compact-list technology-workspace-list">
          {seedEntries.map((entry) => (
            <ContentWorkspaceEntryCard
              key={entry.item.id}
              typeLabel="技能工作台"
              title={entry.item.title}
              summary={entry.item.summary}
              status={entry.status}
              origin={entry.origin}
              meta={buildMeta(entry)}
              editHref={`/workspace/skills/${entry.item.id}`}
              publicHref={`/skills/${entry.item.slug}`}
            />
          ))}
        </div>
      </section>
    </WorkspacePageShell>
  );
}
