import {
  getDigestPublicUrl,
  getSiteBaseUrl
} from "@/lib/digest-delivery";
import { getDigestTechnologySections } from "@/lib/digest-workflow";
import { getDailyDigestRenderData } from "@/lib/digest-view";
import { evaluateTechnologyPriority } from "@/lib/ranking";
import { getPriorityUserSummary } from "@/lib/ranking-display";
import {
  getLocalizedTechnologyText,
  type TechnologyContentMode
} from "@/lib/technology-localization";
import type {
  DailyDigest,
  PriorityLevel,
  TechnologyItem
} from "@/types/content";

export interface DailyDigestWebhookPayload {
  type: "daily_digest";
  digestDate: string;
  title: string;
  summary: string;
  digestUrl: string;
  highPriorityItems: DailyDigestWebhookTechnology[];
  watchItems: DailyDigestWebhookTechnology[];
  skillNames: string[];
  knowledgeNames: string[];
  sourceNames: string[];
  generatedAt: string;
  deliveredAt: string;
}

export interface DailyDigestWebhookTechnology {
  title: string;
  summary: string;
  url: string;
  priorityLevel: PriorityLevel;
  reason: string;
  sourceName: string;
  publishDate: string;
  tags: string[];
}

function getPublicTechnologyText(
  value: TechnologyItem["title"],
  technology: TechnologyItem,
  mode: TechnologyContentMode = "zh"
): string {
  return getLocalizedTechnologyText(value, mode, technology.sourceLanguage);
}

function toWebhookTechnology(
  technology: TechnologyItem,
  deliveredAt: string,
  baseUrl = getSiteBaseUrl()
): DailyDigestWebhookTechnology {
  const ranking = evaluateTechnologyPriority(technology, {
    now: new Date(deliveredAt)
  });

  return {
    title: getPublicTechnologyText(technology.title, technology),
    summary: getPublicTechnologyText(technology.summary, technology),
    url: `${baseUrl}/technologies/${technology.slug}`,
    priorityLevel: ranking.priorityLevel,
    reason: getPriorityUserSummary(ranking, "zh"),
    sourceName: technology.sourceName,
    publishDate: technology.publishDate,
    tags: technology.tags
  };
}

export function buildDailyDigestWebhookPayload(
  digest: DailyDigest,
  deliveredAt = new Date().toISOString(),
  baseUrl = getSiteBaseUrl()
): DailyDigestWebhookPayload {
  const digestSections = getDigestTechnologySections(digest);
  const highPriorityTechnologies =
    digestSections.highPriorityTechnologies.filter(
      (technology) => technology.status === "published"
    );
  const watchTechnologies = digestSections.watchTechnologies.filter(
    (technology) => technology.status === "published"
  );
  const renderData = getDailyDigestRenderData(digest);

  return {
    type: "daily_digest",
    digestDate: digest.date,
    title: digest.title,
    summary: digest.editorialSummary?.trim() || digest.summary,
    digestUrl: getDigestPublicUrl(digest.date, baseUrl),
    highPriorityItems: highPriorityTechnologies.map((technology) =>
      toWebhookTechnology(technology, deliveredAt, baseUrl)
    ),
    watchItems: watchTechnologies.map((technology) =>
      toWebhookTechnology(technology, deliveredAt, baseUrl)
    ),
    skillNames: renderData.skills.map((skill) => skill.title),
    knowledgeNames: renderData.knowledge.map((knowledge) => knowledge.title),
    sourceNames: digest.sourceNames,
    generatedAt: digest.generatedAt,
    deliveredAt
  };
}
