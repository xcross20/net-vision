import { NextResponse } from 'next/server';
import { readCanonicalCoverage } from '@/lib/index/canonical-metadata-store';
import { serializeCacheCoverage } from '@/lib/index/canonical-metadata';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const coverage = await readCanonicalCoverage();
    if (!coverage) {
      return NextResponse.json({ cacheCoverage: null, error: 'DATABASE_URL not configured' });
    }
    return NextResponse.json({ cacheCoverage: serializeCacheCoverage(coverage) });
  } catch (err) {
    return NextResponse.json(
      { cacheCoverage: null, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
