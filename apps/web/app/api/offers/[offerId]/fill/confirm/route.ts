import { NextResponse } from 'next/server';
import { confirmFillNativeOffer } from '@/lib/offers/service';
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
    receiptStatus?: 'success' | 'reverted' | 'unknown';
  } | null;
  try {
    await confirmFillNativeOffer({
      offerId,
      receiptStatus: body?.receiptStatus ?? 'unknown',
    });
    return NextResponse.json({ ok: true, status: 'FILLED' });
  } catch (err) {
    return NextResponse.json(
      { error: 'fill_confirm_failed', message: err instanceof Error ? err.message : 'failed' },
      { status: 400 },
    );
  }
}
