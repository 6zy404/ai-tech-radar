import { SearchGlyph } from "@/components/search-glyph";

/**
 * The site-search box: a plain GET form to `/search`, so it works without
 * JavaScript. Rendered by the search page and the 404 page, which offers it
 * as the way to find whatever the dead link pointed at.
 */
export function SiteSearchForm({
  defaultValue = ""
}: {
  defaultValue?: string;
}) {
  return (
    <form className="search-form" action="/search" method="get">
      <div className="dossier-search">
        <SearchGlyph />
        <input
          type="search"
          name="q"
          defaultValue={defaultValue}
          placeholder="输入关键词，如：推理、Agent、上下文"
          aria-label="搜索关键词"
        />
      </div>
      <button type="submit" className="action-button action-button--primary">
        搜索
      </button>
    </form>
  );
}
