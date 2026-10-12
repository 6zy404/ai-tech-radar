import Link from "next/link";
import { notFound } from "next/navigation";

import { ContentWorkspaceEntryCard } from "@/components/content-workspace-entry-card";
import { ContentWorkspaceStatusActions } from "@/components/content-workspace-status-actions";
import { PublishReadinessPanel } from "@/components/publish-readiness-panel";
import {
  RadarWorkspaceForm,
  type RadarFormGroup
} from "@/components/radar-workspace-form";
import { WorkspaceListToolbar } from "@/components/workspace-list-toolbar";
import { WorkspacePageShell } from "@/components/workspace-page-shell";
import {
  getAllKnowledge,
  getAllSkills,
  getAllTechnologies
} from "@/lib/content";
import {
  describeRadarMove,
  getRadarQuadrantLabel,
  getRadarRingLabel,
  radarQuadrants
} from "@/lib/radar-labels";
import {
  getRadarPublishReadiness,
  getRadarWorkspaceEntries,
  getRadarWorkspaceEntryById,
  type RadarWorkspaceEntry
} from "@/lib/radar-workflow";
import { getPreferredTechnologyTitle } from "@/lib/technology-localization";

// The three pages of the workspace radar console — list, edit, new — built
// from the same workspace primitives as the skill and knowledge consoles.

const workspacePath = "/workspace/radar";
const apiBasePath = "/api/workspace/radar";

function getFormGroups(): RadarFormGroup[] {
  return [
    {
      name: "evidenceTechnologyIds",
      legend: "依据信号（已发布，建议 2–4 条）",
      options: [...getAllTechnologies()]
        .sort((left, right) =>
          right.publishDate.localeCompare(left.publishDate)
        )
        .map((item) => ({
          id: item.id,
          title: getPreferredTechnologyTitle(item),
          detail: item.publishDate
        }))
    },
    {
      name: "relatedKnowledgeIds",
      legend: "相关知识",
      options: getAllKnowledge().map((item) => ({
        id: item.id,
        title: item.title
      }))
    },
    {
      name: "relatedSkillIds",
      legend: "相关技能",
      options: getAllSkills().map((item) => ({
        id: item.id,
        title: item.title
      }))
    }
  ];
}

function renderCard(item: RadarWorkspaceEntry) {
  const { entry } = item;

  return (
    <ContentWorkspaceEntryCard
      key={entry.id}
      typeLabel="雷达条目"
      title={entry.name || "未命名条目"}
      summary={entry.ringReason}
      status={item.status}
      origin={item.origin}
      meta={[
        { label: "象限", value: getRadarQuadrantLabel(entry.quadrant) },
        { label: "环位", value: getRadarRingLabel(entry.ring) },
        { label: "依据", value: `${entry.evidenceTechnologyIds.length} 条` },
        { label: "更新于", value: item.updatedAt?.slice(0, 10) ?? "—" }
      ]}
      editHref={`${workspacePath}/${entry.id}`}
      publicHref={`/radar#radar-${entry.slug}`}
    />
  );
}

export function RadarWorkspaceListPage() {
  const entries = getRadarWorkspaceEntries();
  const workspaceEntries = entries.filter((item) => item.origin !== "seed");
  const seedEntries = entries.filter((item) => item.origin === "seed");
  const count = (predicate: (item: RadarWorkspaceEntry) => boolean) =>
    entries.filter(predicate).length;

  return (
    <WorkspacePageShell
      title="雷达工作台"
      description="管理 /radar 上的技术条目：象限、环位、环位理由与依据信号。改环位会自动写进环位历史。"
      sectionLabel="内容管理"
      securityNote={
        <>
          <strong>内部雷达控制台。</strong>
          编辑落在本地工作台存储（radar-workspace.json）；内置种子条目首次编辑时会复制为工作台版本，种子代码文件不会被改写。
        </>
      }
      actions={
        <Link
          href={`${workspacePath}/new`}
          className="action-button action-button--accent"
        >
          新建雷达条目
        </Link>
      }
    >
      <section
        className="workspace-status-overview"
        aria-label="雷达条目状态总览"
      >
        <div className="workspace-status-overview__card">
          <span>草稿</span>
          <strong>{count((item) => item.status === "draft")}</strong>
          <small>不出现在公开页面</small>
        </div>
        <div className="workspace-status-overview__card">
          <span>已发布</span>
          <strong>{count((item) => item.status === "published")}</strong>
          <small>在 /radar 上可见</small>
        </div>
        <div className="workspace-status-overview__card">
          <span>内置种子（未覆盖）</span>
          <strong>{seedEntries.length}</strong>
          <small>来自代码内置数据</small>
        </div>
        <div className="workspace-status-overview__card">
          <span>工作台覆盖</span>
          <strong>{count((item) => item.origin === "seed_override")}</strong>
          <small>以工作台版本为准</small>
        </div>
      </section>

      <WorkspaceListToolbar
        label={`${entries.length} 条雷达条目`}
        detail="工作台条目在前（含种子覆盖），未编辑过的内置种子按象限在后。"
      />

      <section
        className="workspace-technology-section"
        aria-labelledby="radar-workspace-entries"
      >
        <div className="workspace-technology-section__header">
          <div>
            <p className="workspace-technology-section__eyebrow">工作台条目</p>
            <h2 id="radar-workspace-entries">新建与覆盖条目</h2>
          </div>
          <span>{workspaceEntries.length} 条</span>
        </div>

        <div className="workspace-compact-list technology-workspace-list">
          {workspaceEntries.map(renderCard)}
        </div>

        {workspaceEntries.length === 0 ? (
          <section className="empty-state empty-state--actionable">
            <div>
              <strong>还没有工作台雷达条目。</strong>
              <p>新建一条，或直接编辑下方的内置种子条目。</p>
            </div>
            <Link href={`${workspacePath}/new`} className="action-link">
              新建雷达条目
            </Link>
          </section>
        ) : null}
      </section>

      {radarQuadrants.map((quadrant) => {
        const items = seedEntries.filter(
          (item) => item.entry.quadrant === quadrant
        );

        if (items.length === 0) {
          return null;
        }

        return (
          <section
            key={quadrant}
            className="workspace-technology-section"
            aria-labelledby={`radar-seed-${quadrant}`}
          >
            <div className="workspace-technology-section__header">
              <div>
                <p className="workspace-technology-section__eyebrow">
                  内置种子
                </p>
                <h2 id={`radar-seed-${quadrant}`}>
                  {getRadarQuadrantLabel(quadrant)}
                </h2>
              </div>
              <span>{items.length} 条</span>
            </div>

            <div className="workspace-compact-list technology-workspace-list">
              {items.map(renderCard)}
            </div>
          </section>
        );
      })}
    </WorkspacePageShell>
  );
}

const originNotes = {
  workspace: "工作台新建条目。",
  seed: "内置种子条目。保存编辑后会复制为工作台版本，种子代码文件不受影响。",
  seed_override: "种子条目已被工作台版本覆盖，以此处的内容为准。"
} as const;

export function RadarWorkspaceDetailPage({ id }: { id: string }) {
  const item = getRadarWorkspaceEntryById(id);

  if (!item) {
    notFound();
  }

  const { entry } = item;
  const readiness = getRadarPublishReadiness(id);

  return (
    <WorkspacePageShell
      title={entry.name || "未命名雷达条目"}
      description={originNotes[item.origin]}
      sectionLabel="雷达编辑"
      actions={
        <>
          {item.status === "published" ? (
            <Link href={`/radar#radar-${entry.slug}`} className="action-link">
              打开公开页面
            </Link>
          ) : null}
          <Link href={workspacePath} className="action-link">
            返回雷达列表
          </Link>
        </>
      }
    >
      <section className="section-panel">
        <div className="workspace-technology-section__header">
          <div>
            <p className="workspace-technology-section__eyebrow">状态</p>
            <h2>{item.status === "published" ? "已发布" : "草稿"}</h2>
          </div>
          <ContentWorkspaceStatusActions
            apiBasePath={apiBasePath}
            entryId={entry.id}
            status={item.status}
            entityLabel="雷达条目"
          />
        </div>
      </section>

      <PublishReadinessPanel readiness={readiness} />

      <section className="section-panel" aria-labelledby="radar-history">
        <div className="workspace-technology-section__header">
          <div>
            <p className="workspace-technology-section__eyebrow">
              自动记录，不可编辑
            </p>
            <h2 id="radar-history">环位历史</h2>
          </div>
          <span>{entry.history.length} 条</span>
        </div>
        <ol className="radar-workspace-history">
          {[...entry.history].reverse().map((line, index) => (
            <li key={`${line.date}-${index}`}>
              <time dateTime={line.date}>{line.date}</time>{" "}
              {line.fromRing
                ? describeRadarMove(line.fromRing, line.toRing)
                : `收录进${getRadarRingLabel(line.toRing)}`}
              {line.reason ? `：${line.reason}` : ""}
            </li>
          ))}
        </ol>
      </section>

      <section className="section-panel">
        <RadarWorkspaceForm entry={entry} groups={getFormGroups()} />
      </section>
    </WorkspacePageShell>
  );
}

export function RadarWorkspaceNewPage() {
  return (
    <WorkspacePageShell
      title="新建雷达条目"
      description="创建一条新的雷达条目。保存后为草稿，通过发布检查（至少一条已发布的依据信号）后才会出现在 /radar。"
      sectionLabel="内容管理"
      actions={
        <Link href={workspacePath} className="action-link">
          返回雷达列表
        </Link>
      }
    >
      <section className="section-panel">
        <RadarWorkspaceForm groups={getFormGroups()} />
      </section>
    </WorkspacePageShell>
  );
}
