import { highlightSearchTerms } from "@/lib/search-highlight";

/**
 * Render text with every literal hit of the query wrapped in `<mark>`.
 * Plain React children — the text is never parsed as HTML.
 */
export function HighlightedText({
  text,
  terms
}: {
  text: string;
  terms: string[];
}) {
  return (
    <>
      {highlightSearchTerms(text, terms).map((segment, index) =>
        segment.match ? (
          <mark key={index} className="search-hit">
            {segment.text}
          </mark>
        ) : (
          segment.text
        )
      )}
    </>
  );
}
