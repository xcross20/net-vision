import { NextResponse } from 'next/server';
import { confirmCancelNativeOffers, prepareCancelNativeOffers } from '@/lib/offers/service';
import { isSurfaceEnabled, tradingDisabledResponse } from '@/lib/trade/kill-switch';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  ctx: { params: Promise<{ offerId: string }> },
) {
  if (!isSurfaceEnabled('offer')) {
    return NextResponse.json(tradingDisabledResponse('offer'), { status: 503 });
  }
  const { offerId } = await ctx.params;
  const body = (await request.json().catch(() => null)) as {
    buyerAddress?: string;
    phase?: 'prepare' | 'confirm';
    receiptStatus?: 'success' | 'reverted' | 'unknown';
    offerIds?: string[];
  } | null;
  if (!body?.buyerAddress) {
    return NextResponse.json({ error: 'invalid_cancel' }, { status: 400 });
  }
  const ids = body.offerIds && body.offerIds.length > 0 ? body.offerIds : [offerId];
  try {
    if (body.phase === 'confirm') {
      await confirmCancelNativeOffers({
        offerIds: ids,
        receiptStatus: body.receiptStatus ?? 'unknown',
      });
      return NextResponse.json({ ok: true, status: 'CANCELLED', offerIds: ids });
    }
    const tx = await prepareCancelNativeOffers({
      offerIds: ids,
      buyer: body.buyerAddress,
    });
    return NextResponse.json({
      transaction: { to: tx.to, data: tx.data, value: tx.value },
      offerIds: tx.offerIds,
      note: 'Postgres CANCELLED is applied only after a successful Seaport cancel receipt.',
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'cancel_failed', message: err instanceof Error ? err.message : 'failed' },
      { status: 400 },
    );
  }
}
