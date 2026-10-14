import { SearchGlyph } from "@/components/search-glyph";
import { shellCopy } from "@/lib/i18n/copy/shell";
import { localePath, type Locale } from "@/lib/i18n/locale";

/**
 * The site-search box: a plain GET form to `/search`, so it works without
 * JavaScript. Rendered by the search page and the 404 page, which offers it
 * as the way to find whatever the dead link pointed at.
 */
export function SiteSearchForm({
  defaultValue = "",
  locale = "zh"
}: {
  defaultValue?: string;
  locale?: Locale;
}) {
  const copy = shellCopy[locale].searchForm;

  return (
    <form
      className="search-form"
      action={localePath(locale, "/search")}
      method="get"
    >
      <div className="dossier-search">
        <SearchGlyph />
        <input
          type="search"
          name="q"
          defaultValue={defaultValue}
          placeholder={copy.placeholder}
          aria-label={copy.inputLabel}
        />
      </div>
      <button type="submit" className="action-button action-button--primary">
        {copy.submit}
      </button>
    </form>
  );
}
