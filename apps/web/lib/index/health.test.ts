import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, beforeEach } from 'vitest';
import { buildIndexerHealthReport, WORKER_HEARTBEAT_STALE_MS } from './health';
import { persistNftMetadata, resetIndexForTests, writeWorkerCheckpoint } from './store';

describe('indexer health report', () => {
  beforeEach(() => {
    process.env.INDEX_DB_PATH = join(mkdtempSync(join(tmpdir(), 'nv-health-')), 'index.json');
    delete process.env.DATABASE_URL;
    resetIndexForTests();
  });

  it('reports workerOnline false when heartbeat is missing', () => {
    const report = buildIndexerHealthReport();
    expect(report.workerOnline).toBe(false);
    expect(report.brassExpected).toBe(999);
    expect(report.brassMetadataVerified).toBe(0);
  });

  it('reports workerOnline true only while heartbeat is fresh', () => {
    const now = Date.now();
    writeWorkerCheckpoint({
      workerStartedAt: now - 1_000,
      workerHeartbeatAt: now - 1_000,
    });
    expect(buildIndexerHealthReport(now).workerOnline).toBe(true);

    writeWorkerCheckpoint({
      workerHeartbeatAt: now - WORKER_HEARTBEAT_STALE_MS - 1,
    });
    expect(buildIndexerHealthReport(now).workerOnline).toBe(false);
  });

  it('counts Brass verified metadata independently of listing cursor', () => {
    for (let n = 1; n <= 3; n += 1) {
      persistNftMetadata(String(n), {
        name: `Button #${n}`,
        traits: [{ trait_type: 'Plate', value: 'Brass' }],
      });
    }
    writeWorkerCheckpoint({ cursor: 0, processedTotal: 0 });
    const report = buildIndexerHealthReport();
    expect(report.brassMetadataVerified).toBe(3);
    expect(report.brassComplete).toBe(false);
    expect(report.listingCursor).toBe(0);
  });

  it('reports official existing supply separately from discovery max', () => {
    const report = buildIndexerHealthReport();
    expect(report.officialExistingSupply).toBe(62093);
    expect(report.discoveryMaxTokenId).toBe(62095);
  });

  it('exposes maintenance counters defaulting to rest-only', () => {
    const report = buildIndexerHealthReport();
    expect(report.maintenance.mode).toBe('rest');
    expect(report.maintenance.streamHealth).toBe('disconnected');
    expect(report.maintenance.streamConnected).toBe(false);
    expect(report.maintenance.eventsLast15m).toBe(0);
  });

  it('reports walker throughput and coverage rise rate from the persisted checkpoint', () => {
    // Walker metrics are computed in the worker process and persisted
    // into WorkerCheckpoint, so the web's health report surfaces them
    // through workerCheckpoint(), not via the walker-metrics ring buffer.
    expect(buildIndexerHealthReport().walkerTokensPerMinute).toBeNull();
    expect(buildIndexerHealthReport().coverageRisePercentPerHour).toBeNull();

    writeWorkerCheckpoint({ walkerTokensPerMinute: 30, coverageRisePercentPerHour: 1.2 });
    const report = buildIndexerHealthReport();
    expect(report.walkerTokensPerMinute).toBe(30);
    expect(report.coverageRisePercentPerHour).toBe(1.2);
  });
});
