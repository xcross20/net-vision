/**
 * Latest-wins scheduler for the ~1GB index_blob dual-write.
 *
 * Walker saveIndex() used to fire a full JSONB rewrite every 10 tokens.
 * That generated ~540MB WAL every ~30s and checkpoint-stalled reads.
 * Coalesce to the newest revision; never let an in-flight older payload
 * queue behind a newer one.
 */

export type LatestWinJob<T> = {
  payload: T;
  revision: number;
};

export type LatestWinScheduler<T> = {
  schedule(payload: T, revision: number): void;
  flushForTests(): Promise<void>;
  reset(): void;
};

const DEFAULT_BLOB_SAVE_MIN_MS = 30_000;

export function blobSaveMinIntervalMs(
  env: Record<string, string | undefined> = process.env,
): number {
  if (env.VITEST && env.INDEX_BLOB_SAVE_MIN_MS === undefined) return 0;
  const raw = env.INDEX_BLOB_SAVE_MIN_MS;
  if (raw === undefined || raw === '') return DEFAULT_BLOB_SAVE_MIN_MS;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_BLOB_SAVE_MIN_MS;
  return n;
}

export function createLatestWinScheduler<T>(options: {
  minIntervalMs: () => number;
  save: (job: LatestWinJob<T>) => Promise<void>;
  now?: () => number;
  onError?: (err: unknown) => void;
}): LatestWinScheduler<T> {
  let pending: LatestWinJob<T> | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight = false;
  let lastSaveAt = 0;
  const now = options.now ?? Date.now;

  function arm(): void {
    if (timer || inFlight || !pending) return;
    const waitMs = Math.max(0, options.minIntervalMs() - (now() - lastSaveAt));
    timer = setTimeout(() => {
      timer = null;
      void flush();
    }, waitMs);
    if (typeof timer === 'object' && timer && 'unref' in timer) {
      timer.unref();
    }
  }

  async function flush(): Promise<void> {
    if (inFlight) return;
    const job = pending;
    if (!job) return;
    pending = null;
    inFlight = true;
    try {
      await options.save(job);
      lastSaveAt = now();
    } catch (err) {
      options.onError?.(err);
    } finally {
      inFlight = false;
      if (pending) arm();
    }
  }

  return {
    schedule(payload, revision) {
      if (pending == null || revision >= pending.revision) {
        pending = { payload, revision };
      }
      arm();
    },
    async flushForTests() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      await flush();
    },
    reset() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      pending = null;
      inFlight = false;
      lastSaveAt = 0;
    },
  };
}
