/**
 * GET /api/trade/usdg-status?buyer=0x…&requiredRaw=…
 *
 * DEPRECATED: superseded by POST /api/payment/status (commit 2). Retained
 * for one release so any external caller has a migration window. The
 * response now carries `Deprecation: true` and a `Sunset` header so
 * clients and proxies can surface the deprecation. Plan to delete this
 * file in the release after the staging→main PR that ships commit 5.
 *
 * See docs/launch/CHECKOUT_PAYMENT_STATE.md §6.
 */
import { NextResponse } from 'next/server';
import { readUsdgStatus } from '@/lib/trade/usdg-status';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const buyer = url.searchParams.get('buyer') ?? '';
  if (!/^0x[a-fA-F0-9]{40}$/.test(buyer)) {
    return NextResponse.json(
      { error: 'invalid buyer' },
      {
        status: 400,
        headers: { Deprecation: 'true', Sunset: 'next-release' },
      },
    );
  }
  const requiredParam = url.searchParams.get('requiredRaw');
  let requiredRaw: bigint | null = null;
  if (requiredParam != null && requiredParam !== '') {
    if (!/^\d+$/.test(requiredParam)) {
      return NextResponse.json(
        { error: 'invalid requiredRaw' },
        {
          status: 400,
          headers: { Deprecation: 'true', Sunset: 'next-release' },
        },
      );
    }
    requiredRaw = BigInt(requiredParam);
  }
  const conduitKey = url.searchParams.get('conduitKey');
  const status = await readUsdgStatus({
    buyerAddress: buyer as `0x${string}`,
    requiredRaw,
    conduitKey,
  });
  return NextResponse.json(status, {
    headers: { Deprecation: 'true', Sunset: 'next-release' },
  });
}
