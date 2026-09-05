import { NextResponse } from 'next/server';
import { getMarketSource } from '@/lib/market';

export const dynamic = 'force-dynamic';

export async function GET() {
  const source = getMarketSource();
  const [snapshot, listingsResult, tokensResult] = await Promise.allSettled([
    source.getCollectionSnapshot(),
    (source as unknown as { client?: unknown }).client,
    source.listTokens({ listedOnly: true, limit: 5 }),
  ]);
  const tokens =
    tokensResult.status === 'fulfilled'
      ? tokensResult.value.tokens.map((t) => ({
          tokenId: t.tokenId,
          listingPrice: t.listingPrice,
          currency: t.currency,
          ownerAddress: t.ownerAddress,
          traits: t.traits.map((tr) => tr.slug),
        }))
      : null;
  return NextResponse.json({
    snapshot: snapshot.status === 'fulfilled' ? snapshot.value : String(snapshot.reason),
    tokens,
    tokensError: tokensResult.status === 'rejected' ? String(tokensResult.reason) : null,
    freshness: await source.getFreshness(),
  });
}
