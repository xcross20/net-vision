import { NextResponse } from 'next/server';
import { parseUsdgDecimalToRaw } from '@/lib/native-market/fees';
import { configuredFeeRecipient, prepareNativeOffer } from '@/lib/offers/service';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!configuredFeeRecipient()) {
    return NextResponse.json(
      { error: 'fee_recipient_unconfigured', message: 'NET_VISION_MARKETPLACE_FEE_RECIPIENT is required.' },
      { status: 503 },
    );
  }
  const body = (await request.json().catch(() => null)) as {
    buyerAddress?: string;
    tokenId?: string;
    ecosystemId?: string;
    collectionId?: string;
    offerUsdgRaw?: string;
    expirationSeconds?: number;
    balanceUsdgRaw?: string;
  } | null;
  if (!body?.buyerAddress || !body.tokenId || !body.offerUsdgRaw) {
    return NextResponse.json({ error: 'invalid_offer' }, { status: 400 });
  }
  try {
    const prepared = await prepareNativeOffer({
      buyer: body.buyerAddress,
      tokenId: body.tokenId,
      ecosystemId: body.ecosystemId,
      collectionId: body.collectionId,
      offerUsdgRaw: BigInt(body.offerUsdgRaw),
      durationSeconds: body.expirationSeconds ?? 86400,
      balanceUsdgRaw: BigInt(body.balanceUsdgRaw ?? body.offerUsdgRaw),
    });
    return NextResponse.json({
      offerId: prepared.id,
      parameters: prepared.parameters,
      typedData: prepared.typedData,
      review: prepared.review,
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'offer_prepare_failed', message: err instanceof Error ? err.message : 'prepare failed' },
      { status: 400 },
    );
  }
}

export { parseUsdgDecimalToRaw };
