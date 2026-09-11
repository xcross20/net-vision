import { NextResponse } from 'next/server';
import { formatUsdgRaw } from '@/lib/native-market/fees';
import { buildNativeListingParameters } from '@/lib/native-market/listing-order';

export const dynamic = 'force-dynamic';

function feeRecipient(): string | null {
  const value = process.env.NET_VISION_MARKETPLACE_FEE_RECIPIENT?.trim();
  return value && /^0x[a-fA-F0-9]{40}$/.test(value) ? value : null;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    offerer?: string;
    tokenId?: string;
    priceUsdg?: string;
    durationSeconds?: number;
  } | null;
  if (!body?.offerer || !body.tokenId || !body.priceUsdg) {
    return NextResponse.json({ error: 'invalid_listing', message: 'offerer, tokenId, and priceUsdg are required' }, { status: 400 });
  }
  const recipient = feeRecipient();
  if (!recipient) {
    return NextResponse.json(
      { error: 'fee_recipient_unconfigured', message: 'NET_VISION_MARKETPLACE_FEE_RECIPIENT is required to list natively.' },
      { status: 503 },
    );
  }
  try {
    const params = buildNativeListingParameters({
      offerer: body.offerer,
      tokenId: body.tokenId,
      priceUsdg: body.priceUsdg,
      durationSeconds: body.durationSeconds ?? 7 * 24 * 60 * 60,
      feeRecipient: recipient,
    });
    return NextResponse.json({
      parameters: params,
      review: {
        tokenId: params.tokenId,
        price: `${formatUsdgRaw(params.split.listingUsdgRaw)} USDG`,
        marketplaceFee: `${formatUsdgRaw(params.split.marketplaceFeeUsdgRaw)} USDG (0.5%)`,
        openseaComparison: 'OpenSea marketplace fee is typically 1%',
        sellerReceives: `${formatUsdgRaw(params.split.sellerProceedsUsdgRaw)} USDG`,
        expiresAt: params.endTime,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'listing_prepare_failed', message: err instanceof Error ? err.message : 'prepare failed' },
      { status: 400 },
    );
  }
}
