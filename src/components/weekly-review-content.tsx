import Link from "next/link";

import { DossierCard } from "@/components/dossier-card";
import { DossierStampTag } from "@/components/dossier-stamp-tag";
import { getPriorityLevelLabel } from "@/lib/ranking-display";
import type {
  WeeklyReviewArchiveEntry,
  WeeklyReviewData,
  WeeklyReviewGroup
} from "@/lib/weekly-review";

interface WeeklyReviewContentProps {
  data: WeeklyReviewData;
  archive: WeeklyReviewArchiveEntry[];
}

const groupLede: Record<WeeklyReviewGroup["level"], string> = {
  high_priority: "本周多项信号显示值得尽早评估的内容。",
  watch: "本周值得持续留意、等待更多验证的变化。"
};

export function WeeklyReviewContent({
  data,
  archive
}: WeeklyReviewContentProps) {
  return (
    <div className="weekly-review">
      <div className="weekly-review__stats">
        <div className="weekly-review-stat">
          <span className="weekly-review-stat__label">本周信号</span>
          <span className="weekly-review-stat__value">{data.totalCount}</span>
        </div>
        <div className="weekly-review-stat">
          <span className="weekly-review-stat__label">立即关注</span>
          <span className="weekly-review-stat__value">
            {data.highPriorityCount}
          </span>
        </div>
        <div className="weekly-review-stat">
          <span className="weekly-review-stat__label">值得跟踪</span>
          <span className="weekly-review-stat__value">{data.watchCount}</span>
        </div>
        <div className="weekly-review-stat">
          <span className="weekly-review-stat__label">覆盖主题</span>
          <span className="weekly-review-stat__value">{data.topicCount}</span>
        </div>
      </div>

      {data.totalCount > 0 ? (
        data.groups.map((group) => (
          <section key={group.level} className="weekly-review-group">
            <div className="weekly-review-group__heading">
              <h2>{getPriorityLevelLabel(group.level, "zh")}</h2>
              <span>{group.signals.length} 条</span>
            </div>
            <p className="weekly-review-group__lede">
              {groupLede[group.level]}
            </p>
            <div className="weekly-review-group__list">
              {group.signals.map((signal) => (
                <DossierCard key={signal.slug} className="weekly-review-card">
                  <div className="weekly-review-card__meta">
                    <span className="weekly-review-card__date">
                      {signal.publishDate}
                    </span>
                    <span>· {signal.sourceName}</span>
                    <DossierStampTag>
                      {getPriorityLevelLabel(signal.level, "zh")}
                    </DossierStampTag>
                  </div>
                  <h3>
                    <Link href={`/technologies/${signal.slug}`}>
                      {signal.title}
                    </Link>
                  </h3>
                  <p>{signal.summary}</p>
                </DossierCard>
              ))}
            </div>
          </section>
        ))
      ) : (
        <div className="empty-state empty-state--actionable">
          <strong>本周还没有已发布的技术信号。</strong>
          <p>
            这一周的信号发布后会在这里按优先级汇总。你可以先浏览全部技术信号或往期周回顾。
          </p>
          <Link href="/technologies" className="action-link">
            浏览技术信号
          </Link>
        </div>
      )}

      {archive.length > 0 ? (
        <section className="weekly-review-archive">
          <div className="weekly-review-archive__heading">
            <h2>往期周回顾</h2>
            <span>{archive.length} 周</span>
          </div>
          <div className="weekly-review-archive__list">
            {archive.map((entry) => (
              <Link
                key={entry.weekKey}
                href={`/digest/weekly/${entry.weekKey}`}
                className="weekly-review-archive__row"
              >
                <span className="weekly-review-archive__range">
                  {entry.rangeLabel}
                </span>
                <span className="weekly-review-archive__counts">
                  立即关注 {entry.highPriorityCount} · 值得跟踪{" "}
                  {entry.watchCount} · {entry.totalCount} 条信号
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
