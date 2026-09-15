import { NextResponse } from 'next/server';
import { getOfferStore } from '@/lib/offers/service';
import { formatUsdgRaw } from '@/lib/native-market/fees';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenId = url.searchParams.get('tokenId');
  const buyer = url.searchParams.get('buyer');
  const collectionId = url.searchParams.get('collectionId') ?? 'button-presser';
  const store = getOfferStore();
  const rows = tokenId
    ? await store.listForToken(collectionId, tokenId)
    : buyer
      ? await store.listForBuyer(buyer)
      : [];
  return NextResponse.json({
    offers: rows.map((row) => ({
      id: row.id,
      offerGroupId: row.offerGroupId,
      identity: row.parameters.identity,
      buyerAddress: row.parameters.offerer,
      offerUsdg: formatUsdgRaw(BigInt(row.parameters.offerUsdgRaw)),
      offerUsdgRaw: row.parameters.offerUsdgRaw,
      status: row.status,
      expiresAt: row.parameters.endTime,
      seaportOrderHash: row.seaportOrderHash,
    })),
  });
}
