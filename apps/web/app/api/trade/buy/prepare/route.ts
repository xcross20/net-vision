/**
 * POST /api/trade/buy/prepare
 *
 * Given a token id, fetches the best OpenSea listing, asks OpenSea for
 * fulfillment data, validates it with the transaction policy engine,
 * and returns the executable transaction envelope for the wallet to
 * sign. The wallet signs; Net Vision never signs on the user's behalf.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { BUTTON_PRESSER_COLLECTION } from '@net-vision/chain-config';
import { validateTradeAction } from '@net-vision/transaction-policy';
import { getMarketSource } from '@/lib/market';
import { createOpenSeaClient } from '@net-vision/opensea-client';

const Body = z.object({
  tokenId: z.string().min(1),
  buyerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let parsed;
  try {
    const json = (await request.json()) as unknown;
    parsed = Body.safeParse(json);
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid body', issues: parsed.error.issues },
      { status: 400 },
    );
  }

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
      tokenId: parsed.data.tokenId,
    });
    if (!listing) {
      return NextResponse.json({ error: 'no active listing for this token' }, { status: 404 });
    }

    const fulfillment = await client.getListingFulfillmentData({
      orderHash: listing.order_hash,
      fulfillerAddress: parsed.data.buyerAddress,
      chain: freshness.resolvedChainSlug,
    });

    // The OpenSea fulfillment envelope varies by protocol version. Pull
    // the transaction body out, then forward the whole envelope to the
    // transaction policy engine, which is the authoritative validator.
    const raw = fulfillment.raw as Record<string, unknown>;
    const txCandidate =
      (raw?.['fulfillment_data'] as Record<string, unknown> | undefined)?.['transaction'] ??
      (raw?.['transaction'] as Record<string, unknown> | undefined) ??
      raw;

    const valueRaw = BigInt(0);
    const policyDecision = validateTradeAction({
      expectedChainId: 1311,
      expectedWallet: parsed.data.buyerAddress,
      expectedCollectionContract: BUTTON_PRESSER_COLLECTION.contractAddress,
      expectedTokenIds: [parsed.data.tokenId],
      expectedActionType: 'buy',
      expectedCurrency: listing.currency,
      openseaAction: {
        chainId: 1311,
        target: String(
          (txCandidate as { to?: string })?.to ?? listing.protocol_address,
        ),
        valueRaw,
        orderHash: listing.order_hash,
        recipient: parsed.data.buyerAddress,
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
        protocol: listing.protocol,
        protocolAddress: listing.protocol_address,
        maker: listing.maker,
        currency: listing.currency,
        price: listing.price,
        quantity: listing.quantity,
        validFrom: listing.valid_from ?? null,
        validUntil: listing.valid_until ?? null,
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
