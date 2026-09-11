import { NextResponse } from 'next/server';
import { buildIndexerHealthReport } from '@/lib/index/health';
import { refreshIndexFromPostgres } from '@/lib/index/store';
import { readCanonicalCoverage } from '@/lib/index/canonical-metadata-store';
import { cacheCoveragePercent, officialSupply } from '@/lib/index/canonical-metadata';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Always re-read Postgres so web can see the market-worker heartbeat
  // (separate process / memory). Must not saveIndex — that would race the worker.
  try {
    await refreshIndexFromPostgres();
  } catch {
    /* health still reports whatever is local */
  }
  const report = buildIndexerHealthReport();
  let canonicalMetadata = null;
  try {
    const coverage = await readCanonicalCoverage();
    if (coverage) {
      canonicalMetadata = {
        officialSupply: coverage.officialSupply,
        metadataVerified: coverage.verified,
        metadataMissing: coverage.missing,
        metadataInvalid: coverage.invalid,
        metadataRetry: coverage.retry,
        metadataIdentityBlock: coverage.identityBlock,
        metadataUnknown: coverage.unknown,
        metadataCoveragePct: cacheCoveragePercent(coverage.verified),
        imagesCached: coverage.imagesCached,
        imageCoveragePct: cacheCoveragePercent(coverage.imagesCached),
        lastSuccessfulFetch: coverage.lastSuccessAt,
      };
    }
  } catch {
    canonicalMetadata = null;
  }
  return NextResponse.json({ ...report, canonicalMetadata });
}
