import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { writeFileAtomically } from "@/lib/repositories/local-json-store";
import {
  createModelLoadGate,
  type ModelLoadGate,
  type ModelLoadStatus
} from "@/lib/model-load-gate";

/**
 * Local text embeddings for hybrid search. Server-only.
 *
 * The model runs in-process through transformers.js + onnxruntime — no API
 * key, no per-query cost, nothing leaves the machine. `multilingual-e5-small`
 * because the corpus is Chinese and English mixed and readers query in both;
 * quantized (q8, ~130MB on disk) because this runs on the same box as the site.
 *
 * e5 expects a role prefix: "query: " for what the reader typed, "passage: "
 * for what is being searched. Its cosine scores sit in a narrow band (an
 * unrelated passage still scores ~0.8), so callers must rank, not threshold on
 * an absolute value.
 *
 * Downloads go through hf-mirror.com by default — huggingface.co is not
 * reliably reachable from this deployment. Override with EMBEDDING_REMOTE_HOST.
 */

export const EMBEDDING_MODEL = "Xenova/multilingual-e5-small";

const cacheRoot = path.join(process.cwd(), ".cache");

type Extractor = (
  texts: string[],
  options: { pooling: "mean"; normalize: boolean }
) => Promise<{ tolist(): number[][] }>;

async function loadExtractor(): Promise<Extractor> {
  const { env, pipeline } = await import("@huggingface/transformers");

  env.remoteHost =
    process.env.EMBEDDING_REMOTE_HOST ?? "https://hf-mirror.com/";
  env.cacheDir = path.join(cacheRoot, "models");

  return (await pipeline("feature-extraction", EMBEDDING_MODEL, {
    dtype: "q8"
  })) as unknown as Extractor;
}

// A cold load from the cache takes a few seconds; a first download of the
// ~130MB model a minute or two on a normal connection. Two minutes is long
// enough for both and short enough that a hung download — which is what the
// mirror's redirect to an unreachable host produces here — is reported the
// same day it happens rather than never.
const defaultLoadTimeoutMs = 120_000;

function getLoadTimeoutMs(): number {
  const value = Number(process.env.EMBEDDING_LOAD_TIMEOUT_MS);

  return Number.isFinite(value) && value > 0 ? value : defaultLoadTimeoutMs;
}

let gate: ModelLoadGate<Extractor> | undefined;

function getGate(): ModelLoadGate<Extractor> {
  if (!gate) {
    gate = createModelLoadGate<Extractor>({
      load: loadExtractor,
      timeoutMs: getLoadTimeoutMs(),
      // The one line that was missing on 2026-09-24: until then a load that
      // hung or failed left nothing in the log but each search's "not ready".
      onFailure: (message) =>
        console.warn(
          `[embeddings] model load failed (${EMBEDDING_MODEL}): ${message}`
        )
    });
  }

  return gate;
}

function getExtractor(): Promise<Extractor> {
  return getGate().get();
}

/** For the health endpoint: is the embedding model loaded, loading, or broken? */
export function getEmbeddingModelStatus(): ModelLoadStatus {
  return getGate().status();
}

interface VectorCacheFile {
  model: string;
  vectors: Record<string, number[]>;
}

/** The default cache: search's passage vectors. */
export const SEARCH_VECTOR_CACHE_FILE = "search-embeddings.json";

const vectorCaches = new Map<string, Map<string, number[]>>();

function getVectorCachePath(cacheFile: string): string {
  return path.join(cacheRoot, cacheFile);
}

function readVectorCacheFile(cacheFile: string): Map<string, number[]> {
  const vectors = new Map<string, number[]>();
  const filePath = getVectorCachePath(cacheFile);

  if (existsSync(filePath)) {
    try {
      const file = JSON.parse(
        readFileSync(filePath, "utf8")
      ) as VectorCacheFile;

      if (file.model === EMBEDDING_MODEL) {
        for (const [key, vector] of Object.entries(file.vectors)) {
          vectors.set(key, vector);
        }
      }
    } catch {
      // A corrupt cache is only lost work; it is rebuilt on demand.
    }
  }

  return vectors;
}

function readVectorCache(cacheFile: string): Map<string, number[]> {
  let cache = vectorCaches.get(cacheFile);

  if (!cache) {
    cache = readVectorCacheFile(cacheFile);
    vectorCaches.set(cacheFile, cache);
  }

  return cache;
}

/**
 * Two processes write these files — the server, and the task runner when it
 * embeds freshly imported candidates. So the file is re-read and merged before
 * writing (another process's vectors are kept, not overwritten by this one's
 * older copy), and written temp-then-rename so neither ever reads half a file.
 */
function writeVectorCache(cacheFile: string, cache: Map<string, number[]>) {
  for (const [key, vector] of readVectorCacheFile(cacheFile)) {
    if (!cache.has(key)) {
      cache.set(key, vector);
    }
  }

  const file: VectorCacheFile = {
    model: EMBEDDING_MODEL,
    vectors: Object.fromEntries(cache)
  };
  writeFileAtomically(getVectorCachePath(cacheFile), JSON.stringify(file));
}

function hashText(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 24);
}

const BATCH_SIZE = 16;

/**
 * Passage vectors, cached by content hash so an edited entry is re-embedded
 * and an unchanged one never is. The cache survives restarts on disk.
 *
 * `cacheFile` names the file under `.cache/`; search uses the default, and
 * candidate deduplication keeps its own (`candidate-embeddings.json`) so the
 * two pools neither bloat nor overwrite each other's file.
 */
export async function embedPassages(
  texts: string[],
  options: { cacheFile?: string } = {}
): Promise<number[][]> {
  const cacheFile = options.cacheFile ?? SEARCH_VECTOR_CACHE_FILE;
  const cache = readVectorCache(cacheFile);
  const keys = texts.map((text) => hashText(`passage: ${text}`));
  const missing = texts.filter((_, index) => !cache.has(keys[index]));

  if (missing.length > 0) {
    const extractor = await getExtractor();

    for (let start = 0; start < missing.length; start += BATCH_SIZE) {
      const batch = missing.slice(start, start + BATCH_SIZE);
      const output = await extractor(
        batch.map((text) => `passage: ${text}`),
        { pooling: "mean", normalize: true }
      );

      output.tolist().forEach((vector, offset) => {
        cache.set(hashText(`passage: ${batch[offset]}`), vector);
      });
    }

    writeVectorCache(cacheFile, cache);
  }

  return keys.map((key) => cache.get(key) as number[]);
}

export async function embedQuery(query: string): Promise<number[]> {
  const extractor = await getExtractor();
  const output = await extractor([`query: ${query}`], {
    pooling: "mean",
    normalize: true
  });

  return output.tolist()[0];
}

/** Vectors are normalized, so the dot product is the cosine. */
export function cosine(a: number[], b: number[]): number {
  let sum = 0;

  for (let index = 0; index < a.length; index += 1) {
    sum += a[index] * b[index];
  }

  return sum;
}
