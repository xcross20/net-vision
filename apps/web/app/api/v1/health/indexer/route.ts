import { NextResponse } from 'next/server';
import { buildIndexerHealthReport } from '@/lib/index/health';
import { refreshIndexFromPostgres } from '@/lib/index/store';
import { readCanonicalCoverage } from '@/lib/index/canonical-metadata-store';
import { officialSupply } from '@/lib/index/canonical-metadata';

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
      const denom = officialSupply() || 1;
      canonicalMetadata = {
        officialSupply: coverage.officialSupply,
        metadataVerified: coverage.verified,
        metadataMissing: coverage.missing,
        metadataInvalid: coverage.invalid,
        metadataRetry: coverage.retry,
        metadataIdentityBlock: coverage.identityBlock,
        metadataUnknown: coverage.unknown,
        metadataCoveragePct: Math.round((coverage.verified / denom) * 10000) / 100,
        imagesCached: coverage.imagesCached,
        imageCoveragePct: Math.round((coverage.imagesCached / denom) * 10000) / 100,
        lastSuccessfulFetch: coverage.lastSuccessAt,
      };
    }
  } catch {
    canonicalMetadata = null;
  }
  return NextResponse.json({ ...report, canonicalMetadata });
}
