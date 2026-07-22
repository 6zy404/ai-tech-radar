import Link from "next/link";

import { DossierCard } from "@/components/dossier-card";
import { DossierStampTag } from "@/components/dossier-stamp-tag";
import { UserPageShell } from "@/components/user-page-shell";
import { getDailyDigests } from "@/lib/digest-workflow";
import {
  getPublicDigestSummary,
  getPublicDigestTitle
} from "@/lib/public-copy";

export const dynamic = "force-dynamic";

interface ArchiveEntry {
  date: string;
  title: string;
  summary: string;
  highCount: number;
  watchCount: number;
}

interface ArchiveMonth {
  month: string;
  entries: ArchiveEntry[];
}

function getMonthLabel(month: string): string {
  const [year, monthPart] = month.split("-");

  return `${year} 年 ${Number(monthPart)} 月`;
}

function getPublishedArchiveMonths(): ArchiveMonth[] {
  const months = new Map<string, ArchiveEntry[]>();
  const published = getDailyDigests()
    .filter((digest) => digest.status === "published")
    .sort((left, right) => right.date.localeCompare(left.date));

  for (const digest of published) {
    const month = digest.date.slice(0, 7);
    const entries = months.get(month) ?? [];

    entries.push({
      date: digest.date,
      title: getPublicDigestTitle(digest),
      summary: getPublicDigestSummary(digest),
      highCount: digest.highPriorityTechnologyIds.length,
      watchCount: digest.watchTechnologyIds.length
    });
    months.set(month, entries);
  }

  return [...months.entries()]
    .sort((left, right) => right[0].localeCompare(left[0]))
    .map(([month, entries]) => ({ month, entries }));
}

export default function DigestArchivePage() {
  const archiveMonths = getPublishedArchiveMonths();
  const totalCount = archiveMonths.reduce(
    (count, month) => count + month.entries.length,
    0
  );

  return (
    <UserPageShell
      title="往期简报"
      description="按月归档的已发布每日简报。每期汇总当天值得关注的技术信号与编辑判断。"
      sectionLabel="简报归档"
      className="digest-archive-page dossier"
      actions={
        <>
          <Link href="/digest/weekly" className="action-link">
            本周回顾
          </Link>
          <Link href="/digest/today" className="action-link">
            阅读最新一期
          </Link>
        </>
      }
    >
      {archiveMonths.length > 0 ? (
        <>
          <p className="digest-archive__count">
            共 {totalCount} 期已发布简报。
          </p>
          {archiveMonths.map((month) => (
            <section key={month.month} className="digest-archive-month">
              <h2>{getMonthLabel(month.month)}</h2>
              <div className="digest-archive-month__list">
                {month.entries.map((entry) => (
                  <DossierCard key={entry.date} className="digest-archive-card">
                    <div className="digest-archive-card__meta">
                      <span className="digest-archive-card__date">
                        {entry.date}
                      </span>
                      <DossierStampTag>
                        立即关注 {entry.highCount} 条
                        {entry.watchCount > 0
                          ? ` · 值得跟踪 ${entry.watchCount} 条`
                          : ""}
                      </DossierStampTag>
                    </div>
                    <h3>
                      <Link href={`/digest/${entry.date}`}>{entry.title}</Link>
                    </h3>
                    <p>{entry.summary}</p>
                    <Link
                      className="digest-archive-card__open"
                      href={`/digest/${entry.date}`}
                    >
                      阅读这一期
                    </Link>
                  </DossierCard>
                ))}
              </div>
            </section>
          ))}
        </>
      ) : (
        <div className="empty-state empty-state--actionable">
          <strong>还没有已发布的简报。</strong>
          <p>首期简报发布后会在这里按月归档。你可以先浏览技术信号流。</p>
          <Link href="/technologies" className="action-link">
            浏览技术信号
          </Link>
        </div>
      )}
    </UserPageShell>
  );
}
