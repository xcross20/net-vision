import { NextResponse } from 'next/server';
import { prepareAcceptNativeOffer } from '@/lib/offers/service';
import { isSurfaceEnabled, tradingDisabledResponse } from '@/lib/trade/kill-switch';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  ctx: { params: Promise<{ offerId: string }> },
) {
  if (!isSurfaceEnabled('accept_offer')) {
    return NextResponse.json(tradingDisabledResponse('accept_offer'), { status: 503 });
  }
  const { offerId } = await ctx.params;
  const body = (await request.json().catch(() => null)) as {
    sellerAddress?: string;
    sellerOwnsToken?: boolean;
    buyerBalanceUsdgRaw?: string;
  } | null;
  if (!body?.sellerAddress) {
    return NextResponse.json({ error: 'invalid_accept' }, { status: 400 });
  }
  try {
    const result = await prepareAcceptNativeOffer({
      offerId,
      seller: body.sellerAddress,
      sellerOwnsToken: body.sellerOwnsToken === true,
      buyerBalanceUsdgRaw: BigInt(body.buyerBalanceUsdgRaw ?? '0'),
    });
    return NextResponse.json({
      offerId: result.offer.id,
      status: result.offer.status,
      identity: result.offer.parameters.identity,
      offerUsdgRaw: result.offer.parameters.offerUsdgRaw,
      message: result.message,
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'accept_prepare_failed', message: err instanceof Error ? err.message : 'failed' },
      { status: 400 },
    );
  }
}
