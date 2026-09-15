import { NextResponse } from 'next/server';
import { configuredFeeRecipient, submitNativeOffer } from '@/lib/offers/service';
import { getOfferStore } from '@/lib/offers/service';
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
    groupId?: string;
    buyerAddress?: string;
    signatures?: Array<{ offerId: string; signature: string }>;
  } | null;
  if (!body?.groupId || !body.buyerAddress || !Array.isArray(body.signatures)) {
    return NextResponse.json({ error: 'invalid_bulk_submit' }, { status: 400 });
  }
  const store = getOfferStore();
  const group = await store.getGroup(body.groupId);
  if (!group) return NextResponse.json({ error: 'unknown_group' }, { status: 404 });
  try {
    const saved = [];
    for (const row of body.signatures) {
      saved.push(
        await submitNativeOffer({
          offerId: row.offerId,
          buyer: body.buyerAddress,
          signature: row.signature as Hex,
        }),
      );
    }
    const status = await store.refreshGroupStatus(body.groupId);
    return NextResponse.json({
      groupId: body.groupId,
      groupStatus: status,
      offers: saved.map((row) => ({
        offerId: row.id,
        status: row.status,
        identity: row.parameters.identity,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'bulk_submit_failed', message: err instanceof Error ? err.message : 'failed' },
      { status: 400 },
    );
  }
}
