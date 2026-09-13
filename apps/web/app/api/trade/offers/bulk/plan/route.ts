import { NextResponse } from 'next/server';
import { formatUsdgRaw, parseUsdgDecimalToRaw } from '@/lib/native-market/fees';
import { planBulkOffers, type BulkOfferStrategy } from '@/lib/native-market/offers';
import { isSurfaceEnabled, tradingDisabledResponse } from '@/lib/trade/kill-switch';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!isSurfaceEnabled('offer')) {
    return NextResponse.json(tradingDisabledResponse('offer'), { status: 503 });
  }
  const body = (await request.json().catch(() => null)) as {
    strategy?: BulkOfferStrategy;
    samePriceUsdg?: string;
    percentBelowAskBps?: number;
    percentBelowFloorBps?: number;
    floorUsdg?: string;
    buyerBalanceUsdg?: string;
    selections?: Array<{ tokenId: string; askUsdg?: string | null }>;
    customUsdgByTokenId?: Record<string, string>;
  } | null;
  if (!body?.strategy || !Array.isArray(body.selections)) {
    return NextResponse.json({ error: 'invalid_bulk_offer' }, { status: 400 });
  }
  try {
    const plan = planBulkOffers({
      strategy: body.strategy,
      samePriceUsdg: body.samePriceUsdg,
      percentBelowAskBps: body.percentBelowAskBps != null ? BigInt(body.percentBelowAskBps) : undefined,
      percentBelowFloorBps: body.percentBelowFloorBps != null ? BigInt(body.percentBelowFloorBps) : undefined,
      floorUsdgRaw: body.floorUsdg ? parseUsdgDecimalToRaw(body.floorUsdg) : undefined,
      buyerBalanceUsdgRaw: parseUsdgDecimalToRaw(body.buyerBalanceUsdg ?? '0'),
      customUsdgByTokenId: body.customUsdgByTokenId,
      selections: body.selections.map((row) => ({
        tokenId: row.tokenId,
        askUsdgRaw: row.askUsdg ? parseUsdgDecimalToRaw(row.askUsdg) : null,
      })),
    });
    return NextResponse.json({
      strategy: plan.strategy,
      maximumLiability: formatUsdgRaw(plan.maximumLiabilityUsdgRaw),
      offers: plan.offers.map((offer) => ({
        tokenId: offer.tokenId,
        collectionId: offer.collectionId,
        offerUsdg: formatUsdgRaw(offer.offerUsdgRaw),
        offerUsdgRaw: offer.offerUsdgRaw.toString(),
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'bulk_offer_plan_failed', message: err instanceof Error ? err.message : 'plan failed' },
      { status: 400 },
    );
  }
}
