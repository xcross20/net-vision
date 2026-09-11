/**
 * POST /api/payment/quote
 *
 * Geography from CF-IPCountry. Client cannot choose country, fee, router,
 * or fee recipient. Only USDG quotes succeed until a rail earns ROUTE PASS
 * and a live listing bind exists.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ROBINHOOD_CHAIN } from '@net-vision/chain-config';
import { countryFromHeaders } from '@net-vision/payment-router';
import {
  authorizationFromQuote,
  createPaymentQuote,
  quoteToJson,
  signAuthorization,
} from '@net-vision/payment-router/server';

export const dynamic = 'force-dynamic';

const Body = z.object({
  buyer: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  assetId: z.string().min(1).max(64),
  listingOrderHash: z.string().min(1).max(200),
  listingUsdgRaw: z.string().regex(/^\d+$/),
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
  const created = createPaymentQuote({
    configuredChainId: ROBINHOOD_CHAIN.id,
    buyer: parsed.buyer as `0x${string}`,
    assetId: parsed.assetId,
    listingOrderHash: parsed.listingOrderHash,
    listingUsdgRaw: BigInt(parsed.listingUsdgRaw),
    country,
    nowMs: Date.now(),
  });

  if (!created.ok) {
    return NextResponse.json(
      { error: created.reasonCode, country: country ?? null, executable: false },
      { status: created.reasonCode === 'REGION_RESTRICTED' || created.reasonCode === 'REGION_UNKNOWN' ? 403 : 422 },
    );
  }

  const secret = process.env.PAYMENT_QUOTE_SIGNING_SECRET;
  let authorization: string | null = null;
  if (secret) {
    authorization = signAuthorization(authorizationFromQuote(created.quote), secret);
  }

  return NextResponse.json({
    country: country ?? null,
    executable: true,
    quote: quoteToJson(created.quote),
    authorization,
  });
}
