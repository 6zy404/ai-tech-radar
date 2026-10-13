import { createHash } from "node:crypto";

import { compactText } from "@/lib/compact-text";
import { getAllTechnologies } from "@/lib/content";
import { EMBEDDING_MODEL } from "@/lib/embeddings";
import {
  getIndexedCorpusWithinTimeout,
  type IndexedCorpus
} from "@/lib/hybrid-search";
import {
  SIGNAL_VECTOR_FORMAT,
  computePairStats,
  decodeSignalVectorFile,
  quantizeVector,
  type SignalCardFields,
  type SignalVectorEntry,
  type SignalVectorFile
} from "@/lib/local-recommend";
import { evaluateTechnologyPriority } from "@/lib/ranking";
import { getPriorityLevelLabel } from "@/lib/ranking-display";
import { centerVectors } from "@/lib/similar-signals";
import {
  getEffectiveTechnologyMode,
  getLocalizedTechnologyText
} from "@/lib/technology-localization";
import { toVisitKey } from "@/lib/visit-state";
import type { TechnologyItem } from "@/types/content";

/**
 * Builds `/signal-vectors.json`, the recommendation data file for the
 * browser-side 「和你读过的相近」 (`src/lib/local-recommend.ts`): for each
 * published signal, its search vector and the public card fields the list
 * page already shows.
 *
 * The vectors are the ones search already keeps; nothing new is embedded or
 * stored. Each is centered on the pool mean (as 内容相近的信号 does) and
 * quantized to int8, which shrinks a 384-dimension vector from ~8 KB of JSON
 * floats to 512 base64 characters.
 *
 * The card fields travel here rather than in the page because only the
 * browser knows which cards it will show: shipped in the home page they cost
 * every visitor 57 KB (17 KB gzipped) for 110 signals; here they cost only a
 * reader with marks, in one request (measured 2026-10-13).
 *
 * What an entry may contain is fixed by `signalVectorEntryKeys`, and each is
 * written field by field. A corpus document is included only when its id
 * belongs to a published signal, so a document that outlived its publication
 * (or any skill / knowledge document) never reaches the file.
 */

// The same gist length as 内容相近的信号's cards.
const summaryLength = 80;

export interface PublishedSignalCard extends SignalCardFields {
  id: string;
}

export function toPublishedSignalCard(
  technology: TechnologyItem
): PublishedSignalCard {
  const mode = getEffectiveTechnologyMode(technology, "zh", "preview");

  return {
    id: technology.id,
    slug: technology.slug,
    title: getLocalizedTechnologyText(
      technology.title,
      mode,
      technology.sourceLanguage
    ),
    summary: compactText(
      getLocalizedTechnologyText(
        technology.summary,
        mode,
        technology.sourceLanguage
      ),
      summaryLength
    ),
    publishDate: technology.publishDate,
    priorityLabel: getPriorityLevelLabel(
      evaluateTechnologyPriority(technology).priorityLevel,
      "zh"
    ),
    tagIds: [...technology.tags]
  };
}

export function buildSignalVectorFile(
  corpus: Pick<IndexedCorpus, "documents" | "vectors">,
  publishedSignals: PublishedSignalCard[],
  model: string = EMBEDDING_MODEL
): SignalVectorFile {
  const cardById = new Map(
    publishedSignals.map((signal) => [signal.id, signal])
  );
  const included = corpus.documents.flatMap((document, index) => {
    const card =
      document.group === "technologies"
        ? cardById.get(document.link.key)
        : undefined;

    return card ? [{ card, vector: corpus.vectors[index] }] : [];
  });
  const centered = centerVectors(included.map((signal) => signal.vector));
  const signals: SignalVectorEntry[] = included.map(({ card }, index) => {
    const { scale, vector } = quantizeVector(centered[index]);

    return {
      key: toVisitKey(card.id),
      slug: card.slug,
      title: card.title,
      summary: card.summary,
      publishDate: card.publishDate,
      priorityLabel: card.priorityLabel,
      tagIds: card.tagIds,
      scale,
      vector
    };
  });
  const draft: SignalVectorFile = {
    format: SIGNAL_VECTOR_FORMAT,
    model,
    dimensions: centered[0]?.length ?? 0,
    pairMean: 0,
    pairDeviation: 0,
    signals
  };

  // The floor is computed from the vectors the browser will decode, not the
  // float originals, so the browser's scores and this floor agree exactly.
  const decoded = decodeSignalVectorFile(draft);
  const stats = computePairStats(decoded?.vectors ?? []);

  return {
    ...draft,
    pairMean: Number(stats.mean.toPrecision(6)),
    pairDeviation: Number(stats.deviation.toPrecision(6))
  };
}

export interface SignalVectorResponse {
  file: SignalVectorFile;
  etag: string;
}

// Keyed on the corpus and the card fields both: a band label can change with
// time alone (an 重要 signal drops to 值得跟踪 after 30 days) while the
// embedded text, and so the corpus, stays the same.
const responseByCorpus = new WeakMap<
  IndexedCorpus,
  { cardsSignature: string; response: SignalVectorResponse }
>();

/**
 * The file for the current corpus. Rejects when the model or vectors are not
 * ready within search's timeout; the route answers 503 and the browser hides
 * the block.
 */
export async function getSignalVectorResponse(
  loadCorpus: () => Promise<IndexedCorpus> = getIndexedCorpusWithinTimeout
): Promise<SignalVectorResponse> {
  const corpus = await loadCorpus();
  const cards = getAllTechnologies().map(toPublishedSignalCard);
  const cardsSignature = JSON.stringify(cards);
  const cached = responseByCorpus.get(corpus);

  if (cached?.cardsSignature === cardsSignature) {
    return cached.response;
  }

  const file = buildSignalVectorFile(corpus, cards);
  const etag = `"${createHash("sha256")
    .update(JSON.stringify(file))
    .digest("hex")
    .slice(0, 24)}"`;
  const response = { file, etag };

  responseByCorpus.set(corpus, { cardsSignature, response });

  return response;
}
