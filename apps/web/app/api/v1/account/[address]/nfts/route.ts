import { NextResponse } from 'next/server';
import { getMarketSource } from '@/lib/market';
import { OwnerIndexIncompleteError } from '@/lib/index/market-read-repository';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ address: string }> },
) {
  const { address } = await ctx.params;
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: 'invalid address' }, { status: 400 });
  }
  try {
    const tokens = await getMarketSource().listAccountTokens(address);
    return NextResponse.json({ address: address.toLowerCase(), tokens });
  } catch (error) {
    if (error instanceof OwnerIndexIncompleteError) {
      return NextResponse.json(
        { error: 'unavailable', address: address.toLowerCase(), tokens: null },
        { status: 503 },
      );
    }
    throw error;
  }
}
