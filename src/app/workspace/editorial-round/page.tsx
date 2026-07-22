import Link from "next/link";

import {
  CandidateRoundActions,
  DigestRoundActions,
  DraftPublishAction
} from "@/components/editorial-round-actions";
import { WorkspacePageShell } from "@/components/workspace-page-shell";
import {
  getDigestStatusLabel,
  getEditorialRoundState
} from "@/lib/editorial-round";

export const dynamic = "force-dynamic";

const verifyLinks = [
  { href: "/technologies", label: "/technologies" },
  { href: "/digest/today", label: "/digest/today" },
  { href: "/digest/weekly", label: "/digest/weekly" },
  { href: "/technologies?view=news", label: "/news" },
  { href: "/feed.json", label: "/feed.json" },
  { href: "/search", label: "/search" }
];

export default function EditorialRoundPage() {
  const state = getEditorialRoundState();
  const {
    today,
    undecidedCandidates,
    openDuplicateGroupCount,
    draftsAwaitingPublish,
    todayDigest,
    steps,
    undecidedCount,
    draftCount
  } = state;

  const digestSummary = todayDigest
    ? `${getDigestStatusLabel(todayDigest.status)} · 立即关注 ${todayDigest.highPriorityCount} · 值得跟踪 ${todayDigest.watchCount}`
    : "未生成";

  const showGenerateHint =
    !todayDigest && (undecidedCount > 0 || draftCount > 0);

  return (
    <WorkspacePageShell
      title="编辑轮"
      description="把每日编辑轮的重复流程收拢到一页：处置候选、发布草稿、生成并发布简报、核对公开呈现。重活仍链接到对应编辑器。"
      sectionLabel="审核 / 编辑"
    >
      <section className="editorial-round">
        <div className="editorial-round__summary">
          <div>
            <p className="eyebrow workspace-eyebrow">今日编辑轮</p>
            <h2>{today}</h2>
          </div>
          <p className="editorial-round__summary-meta">
            待决 {undecidedCount} · 待发布草稿 {draftCount} · 简报{" "}
            {digestSummary}
          </p>
        </div>

        <ol className="editorial-round-tracker" aria-label="编辑轮进度">
          {steps.map((step) => (
            <li
              key={step.key}
              className={`editorial-round-tracker__step editorial-round-tracker__step--${step.status}`}
            >
              <span className="editorial-round-tracker__label">
                {step.label}
              </span>
              <span className="editorial-round-tracker__detail">
                {step.detail}
              </span>
            </li>
          ))}
        </ol>

        <section className="editorial-round-block">
          <div className="editorial-round-block__heading">
            <h3>待决候选 · {undecidedCount}</h3>
            <Link className="action-link" href="/workspace/candidates">
              在候选页打开
            </Link>
          </div>

          {openDuplicateGroupCount > 0 ? (
            <p className="editorial-round-notice editorial-round-notice--blocked">
              有 {openDuplicateGroupCount}{" "}
              组未解决的重复组。组内候选不能单独转为草稿， 请先{" "}
              <Link href="/workspace/duplicates">解决重复组</Link>。
            </p>
          ) : null}

          {undecidedCandidates.length > 0 ? (
            <ul className="editorial-round-list">
              {undecidedCandidates.map((candidate) => (
                <li key={candidate.id} className="editorial-round-row">
                  <div className="editorial-round-row__main">
                    <span className="editorial-round-row__title">
                      {candidate.title}
                    </span>
                    <span className="editorial-round-row__meta">
                      {candidate.sourceName} · {candidate.publishDate}
                    </span>
                  </div>
                  <div className="editorial-round-row__actions">
                    <CandidateRoundActions candidateId={candidate.id} />
                    <Link
                      className="action-link"
                      href={`/workspace/candidates/${candidate.id}`}
                    >
                      详情
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-state">本轮没有待决候选。</p>
          )}
        </section>

        <section className="editorial-round-block">
          <div className="editorial-round-block__heading">
            <h3>草稿待发布 · {draftCount}</h3>
            <span className="editorial-round-block__hint">
              发布前需通过发布质量门
            </span>
          </div>

          {draftsAwaitingPublish.length > 0 ? (
            <ul className="editorial-round-list">
              {draftsAwaitingPublish.map((draft) => (
                <li key={draft.id} className="editorial-round-row">
                  <div className="editorial-round-row__main">
                    <span className="editorial-round-row__title">
                      {draft.title}
                    </span>
                    <span
                      className={`editorial-round-row__meta${
                        draft.blockingCount > 0
                          ? " editorial-round-row__meta--blocked"
                          : draft.warningCount > 0
                            ? " editorial-round-row__meta--warning"
                            : ""
                      }`}
                    >
                      {draft.blockingCount > 0
                        ? `阻断 ${draft.blockingCount}`
                        : draft.isReady
                          ? "可发布"
                          : ""}
                      {draft.warningCount > 0
                        ? `${draft.blockingCount > 0 ? " · " : ""}警告 ${draft.warningCount}`
                        : ""}
                      {draft.topIssue ? ` · ${draft.topIssue}` : ""}
                    </span>
                  </div>
                  <div className="editorial-round-row__actions">
                    <Link
                      className="action-link"
                      href={`/workspace/technologies/${draft.id}`}
                    >
                      编辑
                    </Link>
                    <DraftPublishAction draftId={draft.id} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-state">没有待发布的草稿。</p>
          )}
        </section>

        <section className="editorial-round-block">
          <div className="editorial-round-block__heading">
            <h3>今日简报</h3>
            {todayDigest ? (
              <Link
                className="action-link"
                href={`/workspace/digests/${todayDigest.date}`}
              >
                编辑判断
              </Link>
            ) : null}
          </div>

          <p className="editorial-round-digest-state">{digestSummary}</p>

          {showGenerateHint ? (
            <p className="editorial-round-notice editorial-round-notice--warning">
              还有待处理的候选或草稿。建议发完今天所有技术后再生成简报， 让
              Ranking v0 看到完整内容。
            </p>
          ) : null}

          <DigestRoundActions
            date={today}
            hasDigest={Boolean(todayDigest)}
            isPublished={todayDigest?.status === "published"}
          />
        </section>

        <section className="editorial-round-block">
          <div className="editorial-round-block__heading">
            <h3>公开面核对</h3>
            <span className="editorial-round-block__hint">
              发布后确认公开呈现正确、无内部字段泄漏
            </span>
          </div>
          <div className="editorial-round-verify">
            {verifyLinks.map((link) => (
              <Link
                key={link.href}
                className="editorial-round-verify__link"
                href={link.href}
                target="_blank"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </section>
      </section>
    </WorkspacePageShell>
  );
}
