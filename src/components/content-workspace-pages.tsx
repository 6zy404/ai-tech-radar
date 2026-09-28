import Link from "next/link";
import { notFound } from "next/navigation";

import { ContentWorkspaceEntryCard } from "@/components/content-workspace-entry-card";
import { ContentWorkspaceForm } from "@/components/content-workspace-form";
import { ContentWorkspaceStatusActions } from "@/components/content-workspace-status-actions";
import { PublishReadinessPanel } from "@/components/publish-readiness-panel";
import { WorkspaceListToolbar } from "@/components/workspace-list-toolbar";
import { WorkspacePageShell } from "@/components/workspace-page-shell";
import { getAllTags, getAllTechnologies } from "@/lib/content";
import type { ContentWorkspaceKindView } from "@/lib/content-workspace-kinds";
import type { ContentWorkspaceEntryOf } from "@/lib/content-workspace-workflow";
import { buildRelationDefaults } from "@/lib/link-relation-workflow";
import { getPreferredTechnologyTitle } from "@/lib/technology-localization";
import type { KnowledgeItem, SkillItem } from "@/types/content";

// The three workspace pages of the skill and knowledge consoles — list,
// edit, new — shared by both kinds; each route file only picks its kind.

type AnyKind = ContentWorkspaceKindView;
type Entry = ContentWorkspaceEntryOf<SkillItem | KnowledgeItem>;

function getTechnologyGroup() {
  return {
    name: "relatedTechnologyIds",
    legend: "相关技术信号",
    targetType: "technology" as const,
    options: getAllTechnologies().map((technology) => ({
      id: technology.id,
      title: getPreferredTechnologyTitle(technology)
    }))
  };
}

function buildMeta(kind: AnyKind, entry: Entry) {
  const item = entry.item as unknown as Record<string, string>;

  return [
    ...kind.form.attributes.map((attribute, index) => ({
      label: kind.metaLabels[index],
      value:
        attribute.options.find((option) => option.value === item[attribute.key])
          ?.label ?? ""
    })),
    { label: "更新于", value: entry.updatedAt?.slice(0, 10) ?? "—" }
  ];
}

export function ContentWorkspaceListPage({ kind }: { kind: AnyKind }) {
  const { noun, entryNoun, entityType, workspacePath, publicPath } = kind.form;
  const entries = kind.getEntries();
  const workspaceEntries = entries.filter((entry) => entry.origin !== "seed");
  const seedEntries = entries.filter((entry) => entry.origin === "seed");
  const draftCount = entries.filter((entry) => entry.status === "draft").length;
  const publishedCount = entries.filter(
    (entry) => entry.status === "published"
  ).length;
  const overrideCount = entries.filter(
    (entry) => entry.origin === "seed_override"
  ).length;
  const renderCard = (entry: Entry) => (
    <ContentWorkspaceEntryCard
      key={entry.item.id}
      typeLabel={`${noun}工作台`}
      title={entry.item.title}
      summary={entry.item.summary}
      status={entry.status}
      origin={entry.origin}
      meta={buildMeta(kind, entry)}
      editHref={`${workspacePath}/${entry.item.id}`}
      publicHref={`${publicPath}/${entry.item.slug}`}
    />
  );

  return (
    <WorkspacePageShell
      title={`${noun}工作台`}
      description={kind.listDescription}
      sectionLabel="内容管理"
      securityNote={
        <>
          <strong>{`内部${noun}控制台。`}</strong>
          编辑落在本地工作台存储；内置种子条目首次编辑时会复制为工作台版本，种子代码文件不会被改写。
        </>
      }
      actions={
        <Link
          href={`${workspacePath}/new`}
          className="action-button action-button--accent"
        >
          {`新建${entryNoun}`}
        </Link>
      }
    >
      <section
        className="workspace-status-overview"
        aria-label={`${entryNoun}状态总览`}
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
        label={`${entries.length} 条${noun}条目`}
        detail="工作台条目在前（含种子覆盖），未编辑过的内置种子在后。"
      />

      <section
        className="workspace-technology-section"
        aria-labelledby={`${entityType}-workspace-entries`}
      >
        <div className="workspace-technology-section__header">
          <div>
            <p className="workspace-technology-section__eyebrow">工作台条目</p>
            <h2 id={`${entityType}-workspace-entries`}>新建与覆盖条目</h2>
          </div>
          <span>{workspaceEntries.length} 条</span>
        </div>

        <div className="workspace-compact-list technology-workspace-list">
          {workspaceEntries.map(renderCard)}
        </div>

        {workspaceEntries.length === 0 ? (
          <section className="empty-state empty-state--actionable">
            <div>
              <strong>{`还没有工作台${noun}条目。`}</strong>
              <p>{`新建一条${noun}，或直接编辑下方的内置种子条目。`}</p>
            </div>
            <Link href={`${workspacePath}/new`} className="action-link">
              {`新建${entryNoun}`}
            </Link>
          </section>
        ) : null}
      </section>

      <section
        className="workspace-technology-section"
        aria-labelledby={`${entityType}-seed-entries`}
      >
        <div className="workspace-technology-section__header">
          <div>
            <p className="workspace-technology-section__eyebrow">内置种子</p>
            <h2 id={`${entityType}-seed-entries`}>未编辑过的种子条目</h2>
          </div>
          <span>{seedEntries.length} 条</span>
        </div>

        <div className="workspace-compact-list technology-workspace-list">
          {seedEntries.map(renderCard)}
        </div>
      </section>
    </WorkspacePageShell>
  );
}

const originNotes = {
  workspace: "工作台新建条目。",
  seed: "内置种子条目。保存编辑后会复制为工作台版本，种子代码文件不受影响。",
  seed_override: "种子条目已被工作台版本覆盖，以此处的内容为准。"
} as const;

export function ContentWorkspaceDetailPage({
  kind,
  id
}: {
  kind: AnyKind;
  id: string;
}) {
  const { noun, entryNoun, entityType, apiBasePath, workspacePath } = kind.form;
  const entry = kind.getEntryById(id);

  if (!entry) {
    notFound();
  }

  const readiness = kind.getPublishReadiness(id);
  const relatedGroups = [getTechnologyGroup(), kind.getRelatedGroup()];
  const relationDefaults = buildRelationDefaults(
    { id: entry.item.id, type: entityType },
    relatedGroups.flatMap((group) =>
      group.options.map((option) => ({
        id: option.id,
        type: group.targetType
      }))
    )
  );

  return (
    <WorkspacePageShell
      title={entry.item.title || `未命名${entryNoun}`}
      description={originNotes[entry.origin]}
      sectionLabel={`${noun}编辑`}
      actions={
        <>
          {entry.status === "published" ? (
            <Link
              href={`${kind.form.publicPath}/${entry.item.slug}`}
              className="action-link"
            >
              打开公开页面
            </Link>
          ) : null}
          <Link href={workspacePath} className="action-link">
            {`返回${noun}列表`}
          </Link>
        </>
      }
    >
      <section className="section-panel">
        <div className="workspace-technology-section__header">
          <div>
            <p className="workspace-technology-section__eyebrow">状态</p>
            <h2>{entry.status === "published" ? "已发布" : "草稿"}</h2>
          </div>
          <ContentWorkspaceStatusActions
            apiBasePath={apiBasePath}
            entryId={entry.item.id}
            status={entry.status}
            entityLabel={entryNoun}
          />
        </div>
      </section>

      <PublishReadinessPanel readiness={readiness} />

      <section className="section-panel">
        <ContentWorkspaceForm
          kind={kind.form}
          item={entry.item}
          tagOptions={getAllTags()}
          relatedGroups={relatedGroups}
          relationDefaults={relationDefaults}
        />
      </section>
    </WorkspacePageShell>
  );
}

export function ContentWorkspaceNewPage({ kind }: { kind: AnyKind }) {
  const { noun, entryNoun, workspacePath } = kind.form;

  return (
    <WorkspacePageShell
      title={`新建${entryNoun}`}
      description={`创建一条新的${noun}条目。保存后为草稿，通过发布检查后才会出现在公开页面。`}
      sectionLabel="内容管理"
      actions={
        <Link href={workspacePath} className="action-link">
          {`返回${noun}列表`}
        </Link>
      }
    >
      <section className="section-panel">
        <ContentWorkspaceForm
          kind={kind.form}
          tagOptions={getAllTags()}
          relatedGroups={[getTechnologyGroup(), kind.getRelatedGroup()]}
        />
      </section>
    </WorkspacePageShell>
  );
}
