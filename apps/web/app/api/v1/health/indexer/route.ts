import { NextResponse } from 'next/server';
import { buildIndexerHealthReport } from '@/lib/index/health';
import { refreshIndexFromPostgres } from '@/lib/index/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Always re-read Postgres so web can see the market-worker heartbeat
  // (separate process / memory). Must not saveIndex — that would race the worker.
  try {
    await refreshIndexFromPostgres();
  } catch {
    /* health still reports whatever is local */
  }
  return NextResponse.json(buildIndexerHealthReport());
}
