/**
 * POST /api/trade/offer/accept
 *
 * Disabled until Seaport *offer* extraction matches buy-path hardening
 * (independent token/payment/recipient verification + simulation).
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isSurfaceEnabled, tradingDisabledResponse } from '@/lib/trade/kill-switch';

export const dynamic = 'force-dynamic';

const Body = z.object({
  tokenId: z.string().regex(/^\d+$/),
  sellerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  orderHash: z.string().min(1),
});

export async function POST(request: Request) {
  if (!isSurfaceEnabled('accept_offer')) {
    return NextResponse.json(tradingDisabledResponse('accept_offer'), { status: 503 });
  }

  try {
    const json = await request.json();
    const result = Body.safeParse(json);
    if (!result.success) {
      return NextResponse.json(
        { error: 'invalid body', issues: result.error.issues },
        { status: 400 },
      );
    }
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  return NextResponse.json(
    {
      error: 'accept_offer_not_hardened',
      message:
        'Accept-offer preparation is disabled until Seaport offer semantics are independently verified.',
    },
    { status: 501 },
  );
}
