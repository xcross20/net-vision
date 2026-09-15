/**
 * Per-wallet mutation throttle for prepare. Fail closed with 429, never skip checks.
 */
export function createWalletRateLimit(opts: { windowMs: number; max: number }): {
  allow(buyer: string, now?: number): boolean;
} {
  const hits = new Map<string, number[]>();
  return {
    allow(buyer, now = Date.now()) {
      const key = buyer.toLowerCase();
      const windowStart = now - opts.windowMs;
      const prev = (hits.get(key) ?? []).filter((t) => t > windowStart);
      if (prev.length >= opts.max) {
        hits.set(key, prev);
        return false;
      }
      prev.push(now);
      hits.set(key, prev);
      return true;
    },
  };
}
