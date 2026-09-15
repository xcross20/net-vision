import { NextResponse } from 'next/server';
import { getMarketSource } from '@/lib/market';
import {
  metadataCheckpoint,
  refreshIndexFromPostgres,
  workerCheckpoint,
} from '@/lib/index/store';
import { isIndexerRunning, isMetadataBootstrapRunning } from '@/lib/index/worker';
import { buildIndexerHealthReport } from '@/lib/index/health';
import { readCanonicalCoverage } from '@/lib/index/canonical-metadata-store';
import { serializeCacheCoverage } from '@/lib/index/canonical-metadata';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await refreshIndexFromPostgres();
  } catch {
    /* fall through to in-memory / local JSON */
  }
  const categories = await getMarketSource().listCategories();
  const worker = workerCheckpoint();
  const metadataWorker = metadataCheckpoint();
  const indexer = buildIndexerHealthReport();
  let cacheCoverage: ReturnType<typeof serializeCacheCoverage> | null = null;
  try {
    const coverage = await readCanonicalCoverage();
    if (coverage) cacheCoverage = serializeCacheCoverage(coverage);
  } catch {
    cacheCoverage = null;
  }
  return NextResponse.json({
    indexerRunning: isIndexerRunning(),
    metadataBootstrapRunning: isMetadataBootstrapRunning(),
    workerOnline: indexer.workerOnline,
    worker,
    metadataWorker,
    brassMetadataVerified: indexer.brassMetadataVerified,
    brassExpected: indexer.brassExpected,
    retriesQueued: indexer.retriesQueued,
    /** How much of the whole collection is cached. Null until Postgres is wired. */
    cacheCoverage,
    /** Prefer /api/v1/health/indexer for the full operator surface. */
    indexerHealthPath: '/api/v1/health/indexer',
    categories: categories.map((c) => ({
      slug: c.slug,
      memberCount: c.memberSupply,
      listedCount: c.listedCount,
      verifiedCount: c.verifiedCount,
      unknownCount: c.unknownCount,
      coveragePercent: c.coveragePercent,
      marketStatus: c.marketStatus,
      floor: c.marketStatus === 'live' ? c.floorPrice : null,
    })),
  });
}
