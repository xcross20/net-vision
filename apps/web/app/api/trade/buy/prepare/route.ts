/**
 * POST /api/trade/buy/prepare
 *
 * Fetches the current best OpenSea listing for a single token, asks
 * OpenSea for fulfillment data, validates the executable envelope
 * against the transaction policy engine (chain id, target, recipient,
 * token-id set, native value, expiry), and returns the prepared
 * transaction for the wallet to sign.
 *
 * The wallet signs; Net Vision never signs on the user's behalf.
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
  buyerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  acceptedPriceRaw: z.string().regex(/^\d+$/).optional(),
  acceptedOrderHash: z.string().min(1).optional(),
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
        { error: 'OPENSEA_API_KEY is not set; buy cannot be prepared' },
        { status: 503 },
      );
    }
    const client = createOpenSeaClient({
      OPENSEA_API_KEY: apiKey,
      OPENSEA_BASE_URL: process.env.OPENSEA_BASE_URL,
      OPENSEA_CHAIN: freshness.resolvedChainSlug,
    });

    const listing = await client.getBestListing({
      slug: BUTTON_PRESSER_COLLECTION.openseaSlug,
      tokenId: parsed.tokenId,
    });
    if (!listing) {
      return NextResponse.json({ error: 'no active listing for this token' }, { status: 404 });
    }

    // Price-drift / order-drift protection: the order the user reviewed
    // must still be the order being prepared. Accept the buyer's
    // accepted price + order hash when supplied.
    const livePriceRaw = String(
      (listing.price as { current?: { value?: string | number } }).current?.value ?? '0',
    );
    const liveOrderHash = listing.order_hash;
    if (
      parsed.acceptedPriceRaw !== undefined &&
      parsed.acceptedPriceRaw !== livePriceRaw
    ) {
      return NextResponse.json(
        { error: 'price changed; please review and accept the new price', livePriceRaw },
        { status: 409 },
      );
    }
    if (
      parsed.acceptedOrderHash !== undefined &&
      parsed.acceptedOrderHash !== liveOrderHash
    ) {
      return NextResponse.json(
        { error: 'order changed; please review and accept the new order', liveOrderHash },
        { status: 409 },
      );
    }

    const fulfillment = await client.getListingFulfillmentData({
      orderHash: listing.order_hash,
      fulfillerAddress: parsed.buyerAddress,
      chain: freshness.resolvedChainSlug,
    });

    const raw = fulfillment.raw as Record<string, unknown>;
    const txCandidate =
      (raw?.['fulfillment_data'] as Record<string, unknown> | undefined)?.['transaction'] ??
      (raw?.['transaction'] as Record<string, unknown> | undefined) ??
      raw;

    const listingCurrency =
      (listing.price as { current?: { currency?: string } }).current?.currency ?? 'ETH';

    // Derive valueRaw from the executable transaction envelope. This
    // guards against silent overpayment by surfacing the on-chain
    // native value the wallet will be asked to attach.
    const txValueRaw =
      typeof (txCandidate as { value?: unknown })?.value === 'string'
        ? BigInt((txCandidate as { value: string }).value)
        : typeof (txCandidate as { value?: unknown })?.value === 'number'
          ? BigInt(Math.trunc((txCandidate as { value: number }).value))
          : BigInt(0);

    const policyDecision = validateTradeAction({
      expectedChainId: ROBINHOOD_CHAIN.id,
      expectedWallet: parsed.buyerAddress,
      expectedCollectionContract: BUTTON_PRESSER_COLLECTION.contractAddress,
      expectedTokenIds: [parsed.tokenId],
      expectedActionType: 'buy',
      expectedCurrency: listingCurrency,
      openseaAction: {
        chainId: ROBINHOOD_CHAIN.id,
        target: String(
          (txCandidate as { to?: string })?.to ?? listing.protocol_address,
        ),
        valueRaw: txValueRaw,
        tokenIds: [parsed.tokenId],
        orderHash: listing.order_hash,
        recipient: parsed.buyerAddress,
        orderExpiry: parseEpoch(listing.protocol_data.parameters.endTime) ?? undefined,
      },
    });

    if (!policyDecision.allowed) {
      return NextResponse.json(
        { error: 'transaction rejected by policy', reason: policyDecision.reason },
        { status: 422 },
      );
    }

    return NextResponse.json({
      listing: {
        orderHash: listing.order_hash,
        chain: listing.chain,
        protocolAddress: listing.protocol_address,
        maker: listing.protocol_data.parameters.offerer ?? null,
        currency: listingCurrency,
        price: listing.price,
        priceRaw: livePriceRaw,
        remainingQuantity: listing.remaining_quantity ?? 1,
        validFrom: listing.protocol_data.parameters.startTime ?? null,
        validUntil: listing.protocol_data.parameters.endTime ?? null,
      },
      transaction: txCandidate,
      policy: { allowed: true },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: 'failed to prepare buy',
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }
}

function parseEpoch(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : value;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}
