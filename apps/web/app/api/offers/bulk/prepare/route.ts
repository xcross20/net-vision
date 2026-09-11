import { NextResponse } from 'next/server';
import { configuredFeeRecipient } from '@/lib/offers/service';
import { prepareBulkSamePrice } from '@/lib/offers/bulk';
import { formatUsdgRaw } from '@/lib/native-market/fees';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!configuredFeeRecipient()) {
    return NextResponse.json({ error: 'fee_recipient_unconfigured' }, { status: 503 });
  }
  const body = (await request.json().catch(() => null)) as {
    buyerAddress?: string;
    assets?: Array<{ ecosystemId?: string; collectionId?: string; tokenId: string }>;
    strategy?: { type?: string; offerUsdgRaw?: string };
    expirationSeconds?: number;
    balanceUsdgRaw?: string;
  } | null;
  if (!body?.buyerAddress || !Array.isArray(body.assets) || !body.strategy?.offerUsdgRaw) {
    return NextResponse.json({ error: 'invalid_bulk_prepare' }, { status: 400 });
  }
  if (body.strategy.type && body.strategy.type !== 'SAME_PRICE') {
    return NextResponse.json(
      { error: 'strategy_not_enabled', message: 'V1 bulk offers only support SAME_PRICE until single-offer settlement PASSes.' },
      { status: 400 },
    );
  }
  try {
    const result = await prepareBulkSamePrice({
      buyer: body.buyerAddress,
      assets: body.assets,
      offerUsdgRaw: BigInt(body.strategy.offerUsdgRaw),
      durationSeconds: body.expirationSeconds ?? 86400,
      balanceUsdgRaw: BigInt(body.balanceUsdgRaw ?? body.strategy.offerUsdgRaw),
    });
    return NextResponse.json({
      groupId: result.groupId,
      maximumLiabilityUsdg: formatUsdgRaw(result.maximumLiabilityUsdgRaw),
      offers: result.prepared.map((row) => ({
        offerId: row.id,
        identity: row.parameters.identity,
        review: row.review,
        typedData: row.typedData,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'bulk_prepare_failed', message: err instanceof Error ? err.message : 'failed' },
      { status: 400 },
    );
  }
}
