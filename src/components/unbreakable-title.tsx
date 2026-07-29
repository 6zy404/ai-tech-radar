import { splitIntoUnbreakableRuns } from "@/lib/cjk-line-break";

/**
 * Renders a heading whose words are not split across lines.
 *
 * The text is unchanged — only its line-breaking. See
 * `src/lib/cjk-line-break.ts` for why this cannot be done in CSS.
 */
export function UnbreakableTitle({ text }: { text: string }) {
  return (
    <>
      {splitIntoUnbreakableRuns(text).map((run, index) =>
        run.keepTogether ? (
          <span key={index} className="nowrap-run">
            {run.text}
          </span>
        ) : (
          <span key={index}>{run.text}</span>
        )
      )}
    </>
  );
}
