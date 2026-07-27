import Link from "next/link";

import type { TechnologyEvolutionChain } from "@/lib/technology-evolution";

interface TechnologyEvolutionLineProps {
  chain: TechnologyEvolutionChain;
}

export function TechnologyEvolutionLine({
  chain
}: TechnologyEvolutionLineProps) {
  const { steps, currentIndex, laterCount } = chain;
  const latest = steps[steps.length - 1];
  const hasLater = laterCount > 0;
  const currentStep = steps[currentIndex];

  return (
    <section className="user-article-section technology-detail-section technology-evolution">
      <p className="technology-detail-section__eyebrow">版本脉络</p>
      <h2>{hasLater ? "这条信号已有后续" : "这条信号的版本脉络"}</h2>
      <p className="technology-detail-section__lede">
        {hasLater
          ? `你正在读的是这条线上较早的一条，之后还有 ${laterCount} 条，最新的是「${latest.title}」。`
          : "这是这条线上最新的一条，下面是它承接的早前信号。"}
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
              <span className="technology-evolution__title">{step.title}</span>
            ) : (
              <Link
                className="technology-evolution__title"
                href={`/technologies/${step.slug}`}
              >
                {step.title}
              </Link>
            )}
            <span className="technology-evolution__marks">
              {step.isCurrent ? (
                <span className="technology-evolution__mark">当前</span>
              ) : null}
              {step.id === latest.id && steps.length > 1 ? (
                <span className="technology-evolution__mark technology-evolution__mark--latest">
                  最新
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ol>

      {currentStep.note ? (
        <p className="technology-evolution__note">{currentStep.note}</p>
      ) : null}
    </section>
  );
}
