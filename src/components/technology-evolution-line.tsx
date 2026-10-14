import Link from "next/link";

import { SectionHeading } from "@/components/section-link";
import { technologyDetailCopy } from "@/lib/i18n/copy/technology-detail";
import { localePath, type Locale } from "@/lib/i18n/locale";
import type { TechnologyEvolutionChain } from "@/lib/technology-evolution";

interface TechnologyEvolutionLineProps {
  chain: TechnologyEvolutionChain;
  /** Anchor for the page's table of contents. */
  id?: string;
  /**
   * The host page's public path. Given (with `id`), the heading gets a 「#」
   * that copies the section's address; omitted, the heading is a bare h2.
   */
  sharePath?: string;
  /** `lang` per step slug whose title is not in the page's language. */
  titleLangs?: Record<string, string>;
  /** `lang` of the succession note (always Chinese) on the English site. */
  noteLang?: string;
  locale?: Locale;
}

export function TechnologyEvolutionLine({
  chain,
  id,
  sharePath,
  titleLangs = {},
  noteLang,
  locale = "zh"
}: TechnologyEvolutionLineProps) {
  const copy = technologyDetailCopy[locale].evolution;
  const { steps, currentIndex, laterCount } = chain;
  const latest = steps[steps.length - 1];
  const hasLater = laterCount > 0;
  const currentStep = steps[currentIndex];

  return (
    <section
      id={id}
      className="user-article-section technology-detail-section technology-evolution"
    >
      <p className="technology-detail-section__eyebrow">{copy.eyebrow}</p>
      <SectionHeading sectionId={id} sharePath={sharePath}>
        {hasLater ? copy.headingLater : copy.heading}
      </SectionHeading>
      <p className="technology-detail-section__lede">
        {hasLater ? copy.leadLater(laterCount, latest.title) : copy.lead}
      </p>

      <ol className="technology-evolution__list">
        {steps.map((step) => (
          <li
            key={step.id}
            className={
              step.isCurrent
                ? "technology-evolution__step technology-evolution__step--current"
                : "technology-evolution__step"
            }
          >
            <span className="technology-evolution__date">
              {step.publishDate}
            </span>
            {step.isCurrent ? (
              <span
                className="technology-evolution__title"
                lang={titleLangs[step.slug]}
              >
                {step.title}
              </span>
            ) : (
              <Link
                className="technology-evolution__title"
                href={localePath(locale, `/technologies/${step.slug}`)}
                lang={titleLangs[step.slug]}
              >
                {step.title}
              </Link>
            )}
            <span className="technology-evolution__marks">
              {step.isCurrent ? (
                <span className="technology-evolution__mark">
                  {copy.current}
                </span>
              ) : null}
              {step.id === latest.id && steps.length > 1 ? (
                <span className="technology-evolution__mark technology-evolution__mark--latest">
                  {copy.latest}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ol>

      {currentStep.note ? (
        <p className="technology-evolution__note" lang={noteLang}>
          {currentStep.note}
        </p>
      ) : null}
    </section>
  );
}
