/**
 * GET /api/trade/usdg-status?buyer=0x…&requiredRaw=…
 *
 * Balance/allowance knowledge for USDG checkout. Kill switch does not
 * apply — this is a read. Unknown is never coerced to 0.
 */
import { NextResponse } from 'next/server';
import { readUsdgStatus } from '@/lib/trade/usdg-status';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const buyer = url.searchParams.get('buyer') ?? '';
  if (!/^0x[a-fA-F0-9]{40}$/.test(buyer)) {
    return NextResponse.json({ error: 'invalid buyer' }, { status: 400 });
  }
  const requiredParam = url.searchParams.get('requiredRaw');
  let requiredRaw: bigint | null = null;
  if (requiredParam != null && requiredParam !== '') {
    if (!/^\d+$/.test(requiredParam)) {
      return NextResponse.json({ error: 'invalid requiredRaw' }, { status: 400 });
    }
    requiredRaw = BigInt(requiredParam);
  }
  const conduitKey = url.searchParams.get('conduitKey');
  const status = await readUsdgStatus({
    buyerAddress: buyer as `0x${string}`,
    requiredRaw,
    conduitKey,
  });
  return NextResponse.json(status);
}
