import { NextResponse } from 'next/server';
import { getMarketSource } from '@/lib/market';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ address: string }> },
) {
  const { address } = await ctx.params;
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: 'invalid address' }, { status: 400 });
  }
  const tokens = await getMarketSource().listAccountTokens(address);
  return NextResponse.json({ address: address.toLowerCase(), tokens });
}
