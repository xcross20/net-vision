import { describe, expect, it } from 'vitest';
import {
  blobSaveMinIntervalMs,
  createLatestWinScheduler,
} from './blob-save-coalesce';

describe('blobSaveMinIntervalMs', () => {
  it('defaults to 30s outside tests', () => {
    expect(blobSaveMinIntervalMs({})).toBe(30_000);
  });

  it('is zero under VITEST unless overridden', () => {
    expect(blobSaveMinIntervalMs({ VITEST: 'true' })).toBe(0);
  });

  it('honors INDEX_BLOB_SAVE_MIN_MS', () => {
    expect(blobSaveMinIntervalMs({ INDEX_BLOB_SAVE_MIN_MS: '15000' })).toBe(15_000);
  });
});

describe('createLatestWinScheduler', () => {
  it('keeps only the newest revision and waits out the min interval', async () => {
    const saved: number[] = [];
    let now = 1_000;
    const scheduler = createLatestWinScheduler<string>({
      minIntervalMs: () => 30_000,
      now: () => now,
      save: async (job) => {
        saved.push(job.revision);
      },
    });
    scheduler.schedule('a', 1);
    scheduler.schedule('b', 2);
    scheduler.schedule('c', 3);
    await scheduler.flushForTests();
    expect(saved).toEqual([3]);

    now = 10_000;
    scheduler.schedule('d', 4);
    await scheduler.flushForTests();
    expect(saved).toEqual([3, 4]);
  });

  it('does not let an older revision replace a newer pending payload', async () => {
    const saved: Array<{ payload: string; revision: number }> = [];
    const scheduler = createLatestWinScheduler<string>({
      minIntervalMs: () => 0,
      save: async (job) => {
        saved.push(job);
      },
    });
    scheduler.schedule('new', 9);
    scheduler.schedule('old', 2);
    await scheduler.flushForTests();
    expect(saved).toEqual([{ payload: 'new', revision: 9 }]);
  });
});
