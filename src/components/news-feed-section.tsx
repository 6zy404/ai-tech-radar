import { NewsCardSignalLink, NewsCardTags } from "@/components/news-card-parts";
import { DossierCard } from "@/components/dossier-card";
import { getTodayDateString } from "@/lib/digest-store";
import {
  getPublicNewsDays,
  newsDisclaimer,
  newsWindowDays,
  type PublicNewsItem
} from "@/lib/news";

function getNewsDayLabel(date: string, today: string): string {
  if (date === today) {
    return "今天";
  }

  const yesterday = new Date(`${today}T00:00:00`);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date === getTodayDateString(yesterday)) {
    return "昨天";
  }

  return date;
}

function NewsCard({ item }: { item: PublicNewsItem }) {
  return (
    <DossierCard className="news-card">
      <div className="news-card__meta">
        <span className="news-card__source">{item.sourceName}</span>
        <span>{item.publishDate}</span>
      </div>
      <h3>
        <a href={item.sourceUrl} target="_blank" rel="noreferrer noopener">
          {item.title}
        </a>
      </h3>
      {item.summary ? <p>{item.summary}</p> : null}
      <NewsCardTags tags={item.tags} />
      <NewsCardSignalLink technology={item.publishedTechnology} />
    </DossierCard>
  );
}

export function NewsFeedSection() {
  const today = getTodayDateString();
  const newsDays = getPublicNewsDays();
  const totalItems = newsDays.reduce(
    (count, day) => count + day.items.length,
    0
  );

  return (
    <div className="news-feed-section">
      <p className="news-page__notice">
        {newsDisclaimer}
        {totalItems > 0 ? ` 当前共 ${totalItems} 条。` : ""}
      </p>

      {newsDays.length > 0 ? (
        newsDays.map((day) => (
          <section key={day.date} className="news-day">
            <div className="news-day__heading">
              <h2>{getNewsDayLabel(day.date, today)}</h2>
              <span>
                {day.date} · {day.items.length} 条
              </span>
            </div>
            <div className="news-day__list">
              {day.items.map((item) => (
                <NewsCard key={item.key} item={item} />
              ))}
            </div>
          </section>
        ))
      ) : (
        <div className="empty-state empty-state--actionable">
          <strong>最近 {newsWindowDays} 天还没有新的快讯。</strong>
          <p>
            外部来源会定时自动导入，导入后这里会按天展示最新资讯。你可以先阅读经过编辑精选的技术信号。
          </p>
        </div>
      )}
    </div>
  );
}
