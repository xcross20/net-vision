/**
 * POST /api/trade/offer/accept
 *
 * Prepares Seaport fulfillment so the connected owner can accept an
 * incoming offer. Net Vision never signs; the wallet does.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { BUTTON_PRESSER_COLLECTION, ROBINHOOD_CHAIN } from '@net-vision/chain-config';
import { validateTradeAction } from '@net-vision/transaction-policy';
import { getMarketSource } from '@/lib/market';
import { createOpenSeaClient } from '@net-vision/opensea-client';

export const dynamic = 'force-dynamic';

const Body = z.object({
  tokenId: z.string().regex(/^\d+$/),
  sellerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  orderHash: z.string().min(1),
});

export async function POST(request: Request) {
  let parsed: z.infer<typeof Body> | null = null;
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
  if (!parsed) return NextResponse.json({ error: 'unreachable' }, { status: 500 });

  try {
    const market = getMarketSource();
    const freshness = await market.getFreshness();
    if (!freshness.resolvedChainSlug) {
      return NextResponse.json(
        { error: 'chain slug not resolved; OpenSea not configured' },
        { status: 503 },
      );
    }

    const apiKey = process.env.OPENSEA_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OPENSEA_API_KEY is not set; offer accept cannot be prepared' },
        { status: 503 },
      );
    }
    const client = createOpenSeaClient({
      OPENSEA_API_KEY: apiKey,
      OPENSEA_BASE_URL: process.env.OPENSEA_BASE_URL,
      OPENSEA_CHAIN: freshness.resolvedChainSlug,
    });

    const offers = await market.getTokenOffers(parsed.tokenId);
    const offer = offers.find((item) => item.orderHash === parsed.orderHash);
    if (!offer) {
      return NextResponse.json({ error: 'offer is no longer available' }, { status: 404 });
    }

    const fulfillment = await client.getOfferFulfillmentData({
      orderHash: parsed.orderHash,
      fulfillerAddress: parsed.sellerAddress,
      chain: freshness.resolvedChainSlug,
    });

    const raw = fulfillment.raw as Record<string, unknown>;
    const txCandidate =
      (raw?.['fulfillment_data'] as Record<string, unknown> | undefined)?.['transaction'] ??
      (raw?.['transaction'] as Record<string, unknown> | undefined) ??
      raw;

    const txValueRaw =
      typeof (txCandidate as { value?: unknown })?.value === 'string'
        ? BigInt((txCandidate as { value: string }).value)
        : typeof (txCandidate as { value?: unknown })?.value === 'number'
          ? BigInt(Math.trunc((txCandidate as { value: number }).value))
          : BigInt(0);

    const policyDecision = validateTradeAction({
      expectedChainId: ROBINHOOD_CHAIN.id,
      expectedWallet: parsed.sellerAddress,
      expectedCollectionContract: BUTTON_PRESSER_COLLECTION.contractAddress,
      expectedTokenIds: [parsed.tokenId],
      expectedActionType: 'accept_offer',
      expectedCurrency: offer.currency,
      openseaAction: {
        chainId: ROBINHOOD_CHAIN.id,
        target: String(
          (txCandidate as { to?: string })?.to ?? BUTTON_PRESSER_COLLECTION.contractAddress,
        ),
        valueRaw: txValueRaw,
        tokenIds: [parsed.tokenId],
        orderHash: parsed.orderHash,
        recipient: parsed.sellerAddress,
        orderExpiry: offer.expiresAt ?? undefined,
      },
    });

    if (!policyDecision.allowed) {
      return NextResponse.json(
        { error: 'transaction rejected by policy', reason: policyDecision.reason },
        { status: 422 },
      );
    }

    return NextResponse.json({
      offer: {
        orderHash: offer.orderHash,
        tokenId: offer.tokenId,
        maker: offer.maker,
        currency: offer.currency,
        price: offer.price,
        expiresAt: offer.expiresAt,
      },
      transaction: txCandidate,
      policy: { allowed: true },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: 'failed to prepare offer accept',
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }
}
