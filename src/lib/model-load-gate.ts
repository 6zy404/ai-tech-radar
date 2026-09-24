/**
 * A single-flight loader with a timeout and a readable status.
 *
 * Why this exists: on 2026-09-24 the embedding model never finished
 * downloading on the live server (the mirror redirects the file to a host this
 * machine cannot reach), and nothing said so — the load promise neither
 * resolved nor rejected, every search logged only "not ready within 3000ms",
 * and the process kept the hung load forever, so even seeding the cache did
 * not help until a restart. This gate gives a load three things it lacked: a
 * deadline, a logged reason when it fails, and a status the health endpoint
 * can report.
 *
 * Framework-free and generic so it can be tested with a fake loader.
 */

export type ModelLoadState = "idle" | "loading" | "ready" | "failed";

export interface ModelLoadStatus {
  state: ModelLoadState;
  /** ISO time the current state was entered. */
  since: string;
  /** Present when `state` is `failed`. */
  lastError?: string;
  /** How many loads have been attempted since the process started. */
  attempts: number;
}

export interface ModelLoadGateOptions<T> {
  load: () => Promise<T>;
  timeoutMs: number;
  /** Receives one line per failure; defaults to nothing. */
  onFailure?: (message: string) => void;
  now?: () => Date;
}

export interface ModelLoadGate<T> {
  get(): Promise<T>;
  status(): ModelLoadStatus;
}

export function createModelLoadGate<T>(
  options: ModelLoadGateOptions<T>
): ModelLoadGate<T> {
  const now = options.now ?? (() => new Date());
  let pending: Promise<T> | undefined;
  let status: ModelLoadStatus = {
    state: "idle",
    since: now().toISOString(),
    attempts: 0
  };

  function enter(
    state: ModelLoadState,
    extra: Partial<ModelLoadStatus> = {}
  ): void {
    status = {
      state,
      since: now().toISOString(),
      attempts: status.attempts,
      ...extra
    };
  }

  function start(): Promise<T> {
    status.attempts += 1;
    enter("loading");

    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () =>
          reject(
            new Error(`model load did not finish within ${options.timeoutMs}ms`)
          ),
        options.timeoutMs
      );
    });

    const underlying = options.load();
    // A load that times out may still settle later; its failure must never
    // surface as an unhandled rejection, and its success is simply discarded
    // (the next call starts a fresh load, which then finds the cache warm).
    underlying.catch(() => undefined);

    const attempt = Promise.race([underlying, deadline])
      .then((value) => {
        enter("ready");
        return value;
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        enter("failed", { lastError: message });
        pending = undefined;
        options.onFailure?.(message);
        throw error;
      })
      .finally(() => clearTimeout(timer));

    pending = attempt;
    return attempt;
  }

  return {
    get(): Promise<T> {
      if (!pending) {
        return start();
      }

      return pending;
    },
    status(): ModelLoadStatus {
      return { ...status };
    }
  };
}
