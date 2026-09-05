import { NextResponse } from 'next/server';
import { getMarketSource } from '@/lib/market';
import { workerCheckpoint, metadataCheckpoint } from '@/lib/index/store';
import { isIndexerRunning, isMetadataBootstrapRunning } from '@/lib/index/worker';
import { buildIndexerHealthReport } from '@/lib/index/health';

export const dynamic = 'force-dynamic';

export async function GET() {
  const categories = await getMarketSource().listCategories();
  const worker = workerCheckpoint();
  const metadataWorker = metadataCheckpoint();
  const indexer = buildIndexerHealthReport();
  return NextResponse.json({
    indexerRunning: isIndexerRunning(),
    metadataBootstrapRunning: isMetadataBootstrapRunning(),
    workerOnline: indexer.workerOnline,
    worker,
    metadataWorker,
    brassMetadataVerified: indexer.brassMetadataVerified,
    brassExpected: indexer.brassExpected,
    retriesQueued: indexer.retriesQueued,
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
