/**
 * Coalesce identical in-flight work. 50 buyers asking the same listing
 * share one upstream call. TTL is freshness, not authority.
 */
export function createSingleFlight<T>(ttlMs = 1000): {
  do(key: string, work: () => Promise<T>, now?: number): Promise<T>;
  inflight(): number;
} {
  const inflight = new Map<string, Promise<T>>();
  const cached = new Map<string, { value: T; expiresAt: number }>();

  return {
    inflight: () => inflight.size,
    async do(key, work, now = Date.now()) {
      const hit = cached.get(key);
      if (hit && hit.expiresAt > now) return hit.value;
      const pending = inflight.get(key);
      if (pending) return pending;
      const run = work()
        .then((value) => {
          cached.set(key, { value, expiresAt: Date.now() + ttlMs });
          return value;
        })
        .finally(() => {
          inflight.delete(key);
        });
      inflight.set(key, run);
      return run;
    },
  };
}

export async function mapPool<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const limit = Math.max(1, Math.min(concurrency, items.length || 1));
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next;
      next += 1;
      out[i] = await fn(items[i] as T, i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return out;
}
