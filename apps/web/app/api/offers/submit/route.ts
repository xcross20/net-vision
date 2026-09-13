import { NextResponse } from 'next/server';
import { configuredFeeRecipient, submitNativeOffer } from '@/lib/offers/service';
import type { Hex } from 'viem';
import { isSurfaceEnabled, tradingDisabledResponse } from '@/lib/trade/kill-switch';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!isSurfaceEnabled('offer')) {
    return NextResponse.json(tradingDisabledResponse('offer'), { status: 503 });
  }
  if (!configuredFeeRecipient()) {
    return NextResponse.json({ error: 'fee_recipient_unconfigured' }, { status: 503 });
  }
  const body = (await request.json().catch(() => null)) as {
    offerId?: string;
    buyerAddress?: string;
    signature?: string;
  } | null;
  if (!body?.offerId || !body.buyerAddress || !body.signature) {
    return NextResponse.json({ error: 'invalid_submit' }, { status: 400 });
  }
  try {
    const saved = await submitNativeOffer({
      offerId: body.offerId,
      buyer: body.buyerAddress,
      signature: body.signature as Hex,
    });
    return NextResponse.json({
      offerId: saved.id,
      status: saved.status,
      seaportOrderHash: saved.seaportOrderHash,
      identity: saved.parameters.identity,
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'offer_submit_failed', message: err instanceof Error ? err.message : 'submit failed' },
      { status: 400 },
    );
  }
}
