import { NextResponse } from 'next/server';
import { getCollectionSnapshot } from '@/lib/data/tokens';
import { getMarketSource } from '@/lib/market';

export const dynamic = 'force-dynamic';

export async function GET() {
  const [snapshot, freshness] = await Promise.all([
    getCollectionSnapshot(),
    getMarketSource().getFreshness(),
  ]);
  return NextResponse.json({ snapshot, freshness });
}
