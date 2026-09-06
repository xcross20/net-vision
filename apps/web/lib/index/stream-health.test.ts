import { describe, expect, it } from 'vitest';
import {
  STREAM_CONNECTED_MAX_AGE_MS,
  STREAM_DEAD_MAX_AGE_MS,
  deriveStreamHealth,
} from './stream-health';

describe('deriveStreamHealth', () => {
  const now = 1_000_000;

  it('is disconnected before subscribe', () => {
    expect(
      deriveStreamHealth({
        subscribed: false,
        lastEventAt: null,
        lastError: null,
        restEventsLast15m: 0,
        now,
      }),
    ).toBe('disconnected');
  });

  it('is initializing after subscribe until the first event', () => {
    expect(
      deriveStreamHealth({
        subscribed: true,
        lastEventAt: null,
        lastError: null,
        restEventsLast15m: 0,
        now,
      }),
    ).toBe('initializing');
  });

  it('is connected only while the last event is fresh', () => {
    expect(
      deriveStreamHealth({
        subscribed: true,
        lastEventAt: now - 1_000,
        lastError: null,
        restEventsLast15m: 0,
        now,
      }),
    ).toBe('connected');
    expect(
      deriveStreamHealth({
        subscribed: true,
        lastEventAt: now - STREAM_CONNECTED_MAX_AGE_MS - 1,
        lastError: null,
        restEventsLast15m: 4,
        now,
      }),
    ).toBe('degraded');
  });

  it('is disconnected after a long silence', () => {
    expect(
      deriveStreamHealth({
        subscribed: true,
        lastEventAt: now - STREAM_DEAD_MAX_AGE_MS - 1,
        lastError: null,
        restEventsLast15m: 0,
        now,
      }),
    ).toBe('disconnected');
  });
});
