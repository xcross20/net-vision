import { NextResponse } from 'next/server';
import { buildIndexerHealthReport } from '@/lib/index/health';
import { hydrateIndexFromPostgres } from '@/lib/index/store';

export const dynamic = 'force-dynamic';

let hydrateStarted = false;

export async function GET() {
  if (!hydrateStarted) {
    hydrateStarted = true;
    try {
      await hydrateIndexFromPostgres();
    } catch {
      /* health still reports whatever is local */
    }
  }
  return NextResponse.json(buildIndexerHealthReport());
}
