/**
 * POST /api/payment/status
 *
 * Server-side authority for the checkout SelectedPaymentStatus shape.
 * See apps/web/lib/payment/read-selected-payment-status.ts and
 * docs/launch/CHECKOUT_PAYMENT_STATE.md for the full contract.
 *
 * Behavior:
 *   - USDG + AVAILABLE → reads live balance/allowance via readUsdgStatus
 *   - any other asset → short-circuits to COMING_SOON / REGION_RESTRICTED /
 *     UNSUPPORTED with no wallet reads (the Selected-Payment Invariant
 *     forbids reporting authoritative balance state for a route the user
 *     cannot execute).
 *
 * Input: { buyer, assetId, requiredUsdgRaw, conduitKey?, cartItems? }
 * Output: SelectedPaymentStatus shape (or 400 / 422 on validation failure).
 *
 * Kill switch: not gated — this is a read endpoint, not a mutating action.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { countryFromHeaders } from '@net-vision/payment-router';

import {
  readSelectedPaymentStatus,
} from '@/lib/payment/read-selected-payment-status';

export const dynamic = 'force-dynamic';

const Body = z.object({
  buyer: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  assetId: z.string().min(1).max(64),
  requiredUsdgRaw: z
    .string()
    .regex(/^\d+$/)
    .nullable()
    .optional(),
  conduitKey: z.string().min(1).max(200).nullable().optional(),
  cartItems: z
    .array(
      z.object({
        tokenId: z.string(),
        contractAddress: z.string(),
        displayedOrderHash: z.string(),
        displayedPriceRaw: z.string(),
      }),
    )
    .optional(),
});

export async function POST(request: Request) {
  let parsed: z.infer<typeof Body>;
  try {
    const json = await request.json();
    const result = Body.safeParse(json);
    if (!result.success) {
      return NextResponse.json(
        { error: 'invalid body', issues: result.error.issues },
        { status: 400 },
      );
    }
    parsed = result.data;
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  const country = countryFromHeaders(request.headers);
  const requiredUsdgRaw =
    parsed.requiredUsdgRaw === undefined || parsed.requiredUsdgRaw === null
      ? null
      : BigInt(parsed.requiredUsdgRaw);

  const result = await readSelectedPaymentStatus({
    buyerAddress: parsed.buyer as `0x${string}`,
    assetId: parsed.assetId,
    requiredUsdgRaw,
    conduitKey: parsed.conduitKey ?? null,
    country,
  });

  if (!result.ok) {
    if (result.error === 'unknown_asset') {
      return NextResponse.json({ error: 'unknown_asset', assetId: parsed.assetId }, { status: 400 });
    }
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  return NextResponse.json(result.status);
}