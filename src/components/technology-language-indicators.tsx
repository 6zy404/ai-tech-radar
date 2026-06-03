import {
  getTechnologyDisplayLabel,
  getTechnologySourceLanguageLabel,
  getTechnologyTranslationCoverage,
  getTechnologyTranslationCoverageLabel,
  type TechnologyContentContext,
  type TechnologyContentMode
} from "@/lib/technology-localization";
import type { TechnologyItem } from "@/types/content";

interface TechnologyLanguageIndicatorsProps {
  technology: TechnologyItem;
  mode?: TechnologyContentMode;
  context?: TechnologyContentContext;
}

export function TechnologyLanguageIndicators({
  technology,
  mode,
  context = "preview"
}: TechnologyLanguageIndicatorsProps) {
  const labels = [
    mode ? getTechnologyDisplayLabel(mode, context) : null,
    getTechnologySourceLanguageLabel(technology, context, mode ?? "zh"),
    getTechnologyTranslationCoverageLabel(
      getTechnologyTranslationCoverage(technology, context),
      mode ?? "zh"
    )
  ].filter((label): label is string => Boolean(label));

  return (
    <>
      {labels.map((label) => (
        <span key={label} className="info-pill">
          {label}
        </span>
      ))}
    </>
  );
}
