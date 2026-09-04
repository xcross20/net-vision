import { NextResponse } from 'next/server';
import { BUTTON_PRESSER_COLLECTION, ROBINHOOD_CHAIN } from '@net-vision/chain-config';
import { describeMarketSourceFailure, getMarketSource } from '@/lib/market';

export const dynamic = 'force-dynamic';

export async function GET() {
  const chainId = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID ?? '', 10) || ROBINHOOD_CHAIN.id;
  const contract =
    process.env.NEXT_PUBLIC_COLLECTION_CONTRACT ?? BUTTON_PRESSER_COLLECTION.contractAddress;

  let freshness = null;
  let sourceFailure = null;
  try {
    freshness = await getMarketSource().getFreshness();
  } catch (err) {
    sourceFailure = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json({
    status: 'ok',
    tradingEnabled: process.env.NEXT_PUBLIC_TRADING_ENABLED === 'true',
    chain: {
      id: chainId,
      contract,
      resolvedSlug: freshness?.resolvedChainSlug ?? null,
    },
    data: {
      fresh: freshness?.fresh ?? false,
      refreshedAt: freshness?.refreshedAt ?? null,
      source: freshness?.source ?? 'fixture',
      failure: sourceFailure ?? describeMarketSourceFailure() ?? null,
    },
    time: new Date().toISOString(),
  });
}

