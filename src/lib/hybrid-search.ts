import { cosine, embedPassages, embedQuery } from "@/lib/embeddings";
import {
  defaultSemanticCutoff,
  fuseRankings,
  rankKeywordMatches,
  selectSemanticMatches,
  type MatchReason,
  type SemanticCutoff
} from "@/lib/hybrid-search-ranking";
import type { PublicNewsItem } from "@/lib/news";
import {
  getSearchDocuments,
  parseQueryTerms,
  searchGroups,
  searchPublicNews,
  type SearchDocument,
  type SearchGroup,
  type SearchResultLink
} from "@/lib/search";

/**
 * Public hybrid search: keyword matching plus local-embedding similarity,
 * merged per group. Only the three graph groups (signals, skills, knowledge)
 * get the semantic half; the news lane stays keyword-only, because it is the
 * unedited tier and widening what it returns by meaning would widen exactly
 * the part of the site nobody has checked.
 *
 * If the model cannot load (first download blocked, native binding missing),
 * the page degrades to keyword search and says so rather than failing.
 */

export interface HybridSearchResultLink extends SearchResultLink {
  matchedBy: MatchReason;
}

export interface HybridSearchResults {
  query: string;
  terms: string[];
  technologies: HybridSearchResultLink[];
  skills: HybridSearchResultLink[];
  knowledge: HybridSearchResultLink[];
  news: PublicNewsItem[];
  totalCount: number;
  semanticAvailable: boolean;
}

interface IndexedCorpus {
  signature: string;
  documents: SearchDocument[];
  vectors: number[][];
}

let corpusPromise: Promise<IndexedCorpus> | undefined;
let corpusSignature: string | undefined;

async function buildCorpus(
  documents: SearchDocument[],
  signature: string
): Promise<IndexedCorpus> {
  const vectors = await embedPassages(
    documents.map((document) => document.embedText)
  );

  return { signature, documents, vectors };
}

/**
 * The embedded corpus, rebuilt when any document's text changes. Passage
 * vectors are cached on disk by content hash, so a rebuild after one edit
 * embeds one document, not all of them.
 */
async function getIndexedCorpus(): Promise<IndexedCorpus> {
  const documents = getSearchDocuments();
  const signature = documents
    .map((document) => `${document.evalKey}\u0000${document.embedText}`)
    .join("\u0001");

  if (!corpusPromise || corpusSignature !== signature) {
    corpusSignature = signature;
    corpusPromise = buildCorpus(documents, signature).catch((error) => {
      corpusPromise = undefined;
      corpusSignature = undefined;
      throw error;
    });
  }

  return corpusPromise;
}

const defaultSemanticTimeoutMs = 3000;

function getSemanticTimeoutMs(): number {
  const value = Number(process.env.SEARCH_SEMANTIC_TIMEOUT_MS);

  return Number.isFinite(value) && value > 0 ? value : defaultSemanticTimeoutMs;
}

/**
 * The first search on a fresh deployment downloads the model (~130MB) and
 * embeds the whole corpus. That request must not wait for it: past the
 * timeout it answers from keywords, while the load keeps going in the
 * background and later requests find it ready.
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`not ready within ${timeoutMs}ms`)),
      timeoutMs
    );
  });

  // The abandoned load may still fail later; that failure is already handled
  // by the retry-on-next-call logic, so it must not surface as unhandled.
  promise.catch(() => undefined);

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function emptyResults(query: string, terms: string[]): HybridSearchResults {
  return {
    query,
    terms,
    technologies: [],
    skills: [],
    knowledge: [],
    news: [],
    totalCount: 0,
    semanticAvailable: true
  };
}

export function rankDocumentsHybrid(
  documents: SearchDocument[],
  terms: string[],
  semanticScores: number[] | undefined,
  cutoff: SemanticCutoff = defaultSemanticCutoff
): Record<SearchGroup, HybridSearchResultLink[]> {
  const byKey = new Map(
    documents.map((document) => [document.link.key, document])
  );
  const semantic = semanticScores
    ? selectSemanticMatches(
        documents.map((document, index) => ({
          key: document.link.key,
          group: document.group,
          score: semanticScores[index]
        })),
        cutoff
      )
    : new Map<string, string[]>();

  const grouped = {} as Record<SearchGroup, HybridSearchResultLink[]>;

  for (const group of searchGroups) {
    const groupDocuments = documents
      .filter((document) => document.group === group)
      .map((document) => ({
        key: document.link.key,
        group,
        titleText: document.titleText,
        haystack: document.haystack
      }));
    const fused = fuseRankings(
      rankKeywordMatches(groupDocuments, terms),
      semantic.get(group) ?? []
    );

    grouped[group] = fused.map((entry) => ({
      ...(byKey.get(entry.key) as SearchDocument).link,
      matchedBy: entry.matchedBy
    }));
  }

  return grouped;
}

export async function searchPublicContentHybrid(
  rawQuery: string | undefined,
  now = new Date()
): Promise<HybridSearchResults> {
  const { query, terms } = parseQueryTerms(rawQuery);

  if (terms.length === 0) {
    return emptyResults(query, terms);
  }

  let documents: SearchDocument[];
  let semanticScores: number[] | undefined;
  let semanticAvailable = true;

  try {
    const [corpus, queryVector] = await withTimeout(
      Promise.all([getIndexedCorpus(), embedQuery(query)]),
      getSemanticTimeoutMs()
    );
    documents = corpus.documents;
    semanticScores = corpus.vectors.map((vector) =>
      cosine(queryVector, vector)
    );
  } catch (error) {
    console.warn(
      "[search] semantic search unavailable, falling back to keywords:",
      error instanceof Error ? error.message : error
    );
    documents = getSearchDocuments();
    semanticAvailable = false;
  }

  const grouped = rankDocumentsHybrid(documents, terms, semanticScores);
  const news = searchPublicNews(terms, now);

  return {
    query,
    terms,
    ...grouped,
    news,
    semanticAvailable,
    totalCount:
      grouped.technologies.length +
      grouped.skills.length +
      grouped.knowledge.length +
      news.length
  };
}
