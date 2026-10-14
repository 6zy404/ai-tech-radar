import { signalsCopy } from "@/lib/i18n/copy/signals";
import type { Locale } from "@/lib/i18n/locale";

/**
 * The heading both 和你读过的相近 blocks share. The second line is the
 * block's only claim about privacy, and it has to stay true: the marks are
 * read from localStorage and matched in the browser (`src/lib/local-recommend.ts`).
 */
export function LocalRecommendHeading({ locale = "zh" }: { locale?: Locale }) {
  const copy = signalsCopy[locale].recommend;

  return (
    <div className="section-heading">
      <div>
        <p className="eyebrow user-eyebrow">{copy.eyebrow}</p>
        <h2>{copy.heading}</h2>
        {/* Two runs, so a narrow screen breaks at the comma instead of
            leaving 「器。」 alone on a line (measured at 390). */}
        <p>
          <span className="nowrap-run">{copy.privacyFirst}</span>
          <span className="nowrap-run">{copy.privacySecond}</span>
        </p>
      </div>
    </div>
  );
}
