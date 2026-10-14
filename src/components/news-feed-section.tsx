import { NewsCardSignalLink, NewsCardTags } from "@/components/news-card-parts";
import { DossierCard } from "@/components/dossier-card";
import { getTodayDateString } from "@/lib/digest-store";
import { signalsCopy } from "@/lib/i18n/copy/signals";
import type { Locale } from "@/lib/i18n/locale";
import { nameLangAttr } from "@/lib/i18n/text-lang";
import {
  getPublicNewsDays,
  newsWindowDays,
  type PublicNewsItem
} from "@/lib/news";

function getNewsDayLabel(date: string, today: string, locale: Locale): string {
  const copy = signalsCopy[locale].news;

  if (date === today) {
    return copy.today;
  }

  const yesterday = new Date(`${today}T00:00:00`);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date === getTodayDateString(yesterday)) {
    return copy.yesterday;
  }

  return date;
}

function NewsCard({ item, locale }: { item: PublicNewsItem; locale: Locale }) {
  // News items are raw feed text in whatever language the source wrote.
  return (
    <DossierCard className="news-card">
      <div className="news-card__meta">
        <span
          className="news-card__source"
          lang={nameLangAttr(locale, item.sourceName)}
        >
          {item.sourceName}
        </span>
        <span>{item.publishDate}</span>
      </div>
      <h3 lang={nameLangAttr(locale, item.title)}>
        <a href={item.sourceUrl} target="_blank" rel="noreferrer noopener">
          {item.title}
        </a>
      </h3>
      {item.summary ? (
        <p lang={nameLangAttr(locale, item.summary)}>{item.summary}</p>
      ) : null}
      <NewsCardTags tags={item.tags} locale={locale} />
      <NewsCardSignalLink
        technology={item.publishedTechnology}
        locale={locale}
      />
    </DossierCard>
  );
}

export function NewsFeedSection({ locale = "zh" }: { locale?: Locale }) {
  const copy = signalsCopy[locale].news;
  const today = getTodayDateString();
  const newsDays = getPublicNewsDays(undefined, locale);
  const totalItems = newsDays.reduce(
    (count, day) => count + day.items.length,
    0
  );

  return (
    <div className="news-feed-section">
      <p className="news-page__notice">
        {copy.disclaimer}
        {totalItems > 0 ? copy.total(totalItems) : ""}
      </p>

      {newsDays.length > 0 ? (
        newsDays.map((day) => (
          <section key={day.date} className="news-day">
            <div className="news-day__heading">
              <h2>{getNewsDayLabel(day.date, today, locale)}</h2>
              <span>{copy.dayCount(day.date, day.items.length)}</span>
            </div>
            <div className="news-day__list">
              {day.items.map((item) => (
                <NewsCard key={item.key} item={item} locale={locale} />
              ))}
            </div>
          </section>
        ))
      ) : (
        <div className="empty-state empty-state--actionable">
          <strong>{copy.emptyTitle(newsWindowDays)}</strong>
          <p>{copy.emptyBody}</p>
        </div>
      )}
    </div>
  );
}
