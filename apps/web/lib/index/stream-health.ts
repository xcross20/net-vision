/**
 * Stream "connected" means we have evidence of a live socket, not that
 * we merely registered SDK callbacks.
 */
import type { StreamHealth } from './store';

/** Fresh events → CONNECTED. */
export const STREAM_CONNECTED_MAX_AGE_MS = 10 * 60_000;
/** Older than this with no events → DISCONNECTED. */
export const STREAM_DEAD_MAX_AGE_MS = 30 * 60_000;

export function deriveStreamHealth(input: {
  subscribed: boolean;
  lastEventAt: number | null;
  lastError: string | null;
  restEventsLast15m: number;
  now?: number;
}): StreamHealth {
  const now = input.now ?? Date.now();
  if (!input.subscribed && input.lastEventAt == null) return 'disconnected';
  if (input.subscribed && input.lastEventAt == null) {
    return input.lastError ? 'disconnected' : 'initializing';
  }
  const age = now - (input.lastEventAt ?? 0);
  if (age <= STREAM_CONNECTED_MAX_AGE_MS) return 'connected';
  if (input.lastError && age > STREAM_CONNECTED_MAX_AGE_MS) return 'disconnected';
  if (age > STREAM_DEAD_MAX_AGE_MS) return 'disconnected';
  // REST saw activity while Stream went quiet — socket is likely stale.
  if (input.restEventsLast15m > 0) return 'degraded';
  return 'degraded';
}
