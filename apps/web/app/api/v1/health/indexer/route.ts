import { NextResponse } from 'next/server';
import { buildIndexerHealthReport } from '@/lib/index/health';
import { refreshIndexFromPostgres } from '@/lib/index/store';
import { readCanonicalCoverage } from '@/lib/index/canonical-metadata-store';
import { serializeCacheCoverage } from '@/lib/index/canonical-metadata';

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
      const serialized = serializeCacheCoverage(coverage);
      canonicalMetadata = {
        officialSupply: serialized.officialSupply,
        metadataVerified: serialized.metadataVerified,
        metadataMissing: serialized.missing,
        metadataInvalid: serialized.invalid,
        metadataRetry: serialized.retry,
        metadataIdentityBlock: serialized.identityBlock,
        metadataUnknown: serialized.unknown,
        metadataCoveragePct: serialized.metadataCoveragePct,
        imagesCached: serialized.imagesCached,
        imageCoveragePct: serialized.imageCoveragePct,
        lastSuccessfulFetch: serialized.lastSuccessAt,
        lastTokenId: serialized.lastTokenId,
        processed: serialized.processed,
        complete: serialized.complete,
        heartbeatFresh: serialized.heartbeatFresh,
        remaining: serialized.remaining,
      };
    }
  } catch {
    canonicalMetadata = null;
  }
  return NextResponse.json({ ...report, canonicalMetadata });
}
