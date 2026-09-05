import { NextResponse } from 'next/server';
import { BUTTON_PRESSER_COLLECTION, ROBINHOOD_CHAIN } from '@net-vision/chain-config';
import { describeMarketSourceFailure } from '@/lib/market';
import { loadIndex } from '@/lib/index/store';

export const dynamic = 'force-dynamic';

/**
 * Liveness for Railway healthchecks. Must not call OpenSea — a 429 storm
 * previously hung getFreshness() and failed deploys that enabled this path.
 */
export async function GET() {
  const chainId = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID ?? '', 10) || ROBINHOOD_CHAIN.id;
  const contract =
    process.env.NEXT_PUBLIC_COLLECTION_CONTRACT ?? BUTTON_PRESSER_COLLECTION.contractAddress;

  let refreshedAt: number | null = null;
  try {
    const snap = loadIndex();
    refreshedAt =
      snap.worker.lastSuccessAt ??
      snap.worker.workerHeartbeatAt ??
      snap.worker.lastTickAt ??
      snap.metadataWorker.lastSuccessAt ??
      null;
  } catch {
    refreshedAt = null;
  }

  const fresh =
    refreshedAt !== null && Number.isFinite(refreshedAt) && Date.now() - refreshedAt < 10 * 60_000;

  return NextResponse.json({
    status: 'ok',
    tradingEnabled: process.env.NEXT_PUBLIC_TRADING_ENABLED === 'true',
    chain: {
      id: chainId,
      contract,
      resolvedSlug: null,
    },
    data: {
      fresh,
      refreshedAt,
      source: 'index' as const,
      failure: describeMarketSourceFailure() ?? null,
    },
    time: new Date().toISOString(),
  });
}
