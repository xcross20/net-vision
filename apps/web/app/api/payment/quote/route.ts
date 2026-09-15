/**
 * POST /api/payment/quote
 *
 * Geography from CF-IPCountry. Client cannot choose country, fee, router,
 * or fee recipient. USDG is direct. ETH / NET / stocks exact-out via Uniswap.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ROBINHOOD_CHAIN } from '@net-vision/chain-config';
import {
  countryFromHeaders,
  getPaymentAsset,
  requiredUsdgOut,
} from '@net-vision/payment-router';
import {
  authorizationFromQuote,
  createPaymentQuote,
  quoteToJson,
  signAuthorization,
} from '@net-vision/payment-router/server';
import { robinhoodPublicClient } from '@/lib/payment/read-routed-wallet';
import { quoteExactOutToUsdg, tokenInForAsset } from '@/lib/payment/uniswap-exact-out';

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
  const listingUsdgRaw = BigInt(parsed.listingUsdgRaw);
  const asset = getPaymentAsset(parsed.assetId);
  let swapQuote: {
    inputAmountRaw: bigint;
    expectedUsdgOutRaw: bigint;
    minUsdgOutRaw: bigint;
    router: `0x${string}`;
    maxSlippageBps: number;
  } | undefined;
  if (asset && parsed.assetId !== 'usdg') {
    const route = asset.settlementRoutes[0];
    if (!route?.router) {
      return NextResponse.json(
        { error: 'ROUTE_UNAVAILABLE', country: country ?? null, executable: false },
        { status: 422 },
      );
    }
    try {
      const required = requiredUsdgOut(listingUsdgRaw, BigInt(asset.feeBps));
      const dex = await quoteExactOutToUsdg({
        publicClient: robinhoodPublicClient(),
        tokenIn: tokenInForAsset(asset),
        amountOutUsdg: required,
        slippageBps: route.maxSlippageBps,
      });
      swapQuote = {
        inputAmountRaw: dex.amountInMaximum,
        expectedUsdgOutRaw: required,
        minUsdgOutRaw: required,
        router: route.router,
        maxSlippageBps: route.maxSlippageBps,
      };
    } catch (err) {
      return NextResponse.json(
        {
          error: 'NO_UNISWAP_ROUTE',
          detail: err instanceof Error ? err.message : String(err),
          country: country ?? null,
          executable: false,
        },
        { status: 422 },
      );
    }
  }
  const created = createPaymentQuote({
    configuredChainId: ROBINHOOD_CHAIN.id,
    buyer: parsed.buyer as `0x${string}`,
    assetId: parsed.assetId,
    listingOrderHash: parsed.listingOrderHash,
    listingUsdgRaw,
    country,
    nowMs: Date.now(),
    liveListing: { orderHash: parsed.listingOrderHash, usdgRaw: listingUsdgRaw },
    swapQuote,
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
