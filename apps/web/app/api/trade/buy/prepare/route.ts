/**
 * POST /api/trade/buy/prepare
 *
 * Fetches the live best listing, independently extracts Seaport semantics
 * from protocol_data (token IDs, collection, payment token/amount), obtains
 * fulfillment calldata, verifies the buyer address appears in that calldata,
 * simulates via eth_call, then runs the transaction policy firewall.
 *
 * User intent supplies only: which token they reviewed, their wallet, and
 * the maximum spend they accepted. Everything else is derived from the order.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  BUTTON_PRESSER_COLLECTION,
  PAYMENT_TOKENS,
  ROBINHOOD_CHAIN,
} from '@net-vision/chain-config';
import {
  calldataMentionsAddress,
  extractListingSemantics,
  validateTradeAction,
} from '@net-vision/transaction-policy';
import { getMarketSource } from '@/lib/market';
import { createOpenSeaClient } from '@net-vision/opensea-client';
import { isSurfaceEnabled, tradingDisabledResponse } from '@/lib/trade/kill-switch';
import { simulateTradeTransaction } from '@/lib/trade/simulate';

export const dynamic = 'force-dynamic';

const Body = z.object({
  tokenId: z.string().regex(/^\d+$/),
  buyerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  /** Mandatory reviewed spend cap (smallest units). */
  acceptedPriceRaw: z.string().regex(/^\d+$/),
  acceptedOrderHash: z.string().min(1).optional(),
});

export async function POST(request: Request) {
  if (!isSurfaceEnabled('buy')) {
    return NextResponse.json(tradingDisabledResponse('buy'), { status: 503 });
  }

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

    // Independently extract Seaport semantics from the order (not user intent).
    let semantics;
    try {
      semantics = extractListingSemantics(listing);
    } catch (err) {
      return NextResponse.json(
        {
          error: 'unable to decode listing order',
          detail: err instanceof Error ? err.message : String(err),
        },
        { status: 422 },
      );
    }

    if (!semantics.tokenIds.includes(parsed.tokenId)) {
      return NextResponse.json(
        {
          error: 'order token mismatch',
          detail: `reviewed ${parsed.tokenId} but order offers ${semantics.tokenIds.join(',')}`,
        },
        { status: 409 },
      );
    }

    const livePriceRaw = semantics.paymentAmountRaw.toString();
    const liveOrderHash = semantics.orderHash ?? listing.order_hash;
    if (parsed.acceptedPriceRaw !== livePriceRaw) {
      return NextResponse.json(
        {
          error: 'price changed; please review and accept the new price',
          livePriceRaw,
          acceptedPriceRaw: parsed.acceptedPriceRaw,
        },
        { status: 409 },
      );
    }
    if (parsed.acceptedOrderHash !== undefined && parsed.acceptedOrderHash !== liveOrderHash) {
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

    const txTo = String((txCandidate as { to?: string })?.to ?? listing.protocol_address);
    const txData =
      typeof (txCandidate as { data?: unknown })?.data === 'string'
        ? (txCandidate as { data: string }).data
        : undefined;
    const txValueRaw =
      typeof (txCandidate as { value?: unknown })?.value === 'string'
        ? BigInt((txCandidate as { value: string }).value)
        : typeof (txCandidate as { value?: unknown })?.value === 'number'
          ? BigInt(Math.trunc((txCandidate as { value: number }).value))
          : 0n;

    const recipientVerified = calldataMentionsAddress(txData, parsed.buyerAddress);
    if (!recipientVerified) {
      return NextResponse.json(
        {
          error: 'fulfillment calldata does not reference buyer address',
          detail: 'cannot independently verify NFT recipient',
        },
        { status: 422 },
      );
    }

    const simulation = await simulateTradeTransaction({
      from: parsed.buyerAddress,
      to: txTo,
      data: txData,
      value: txValueRaw,
    });

    const paymentToken =
      semantics.paymentTokenAddress ?? PAYMENT_TOKENS.USDG.contractAddress;

    const policyDecision = validateTradeAction({
      expectedChainId: ROBINHOOD_CHAIN.id,
      expectedWallet: parsed.buyerAddress,
      expectedCollectionContract: BUTTON_PRESSER_COLLECTION.contractAddress,
      expectedTokenIds: [parsed.tokenId],
      expectedActionType: 'buy',
      expectedMaximumSpendRaw: BigInt(parsed.acceptedPriceRaw),
      expectedPaymentToken: paymentToken,
      openseaAction: {
        chainId: ROBINHOOD_CHAIN.id,
        target: txTo,
        valueRaw: txValueRaw,
        paymentAmountRaw: semantics.paymentAmountRaw,
        paymentTokenAddress: paymentToken,
        paymentIsNative: semantics.paymentIsNative,
        // Independently extracted — NOT copied from parsed.tokenId alone.
        tokenIds: semantics.tokenIds,
        collectionContracts: semantics.collectionContracts,
        orderHash: liveOrderHash,
        recipient: parsed.buyerAddress,
        recipientVerifiedFromCalldata: recipientVerified,
        orderExpiry: semantics.orderExpiry ?? undefined,
      },
      simulation: {
        ok: simulation.ok,
        detail: simulation.ok ? 'eth_call succeeded' : simulation.detail,
      },
    });

    if (!policyDecision.allowed) {
      return NextResponse.json(
        {
          error: 'transaction rejected by policy',
          reason: policyDecision.reason,
          checks: policyDecision.checks,
        },
        { status: 422 },
      );
    }

    const listingCurrency =
      (listing.price as { current?: { currency?: string } }).current?.currency ?? 'USDG';

    return NextResponse.json({
      listing: {
        orderHash: liveOrderHash,
        chain: listing.chain,
        protocolAddress: listing.protocol_address,
        maker: semantics.seller,
        currency: listingCurrency,
        paymentToken,
        price: listing.price,
        priceRaw: livePriceRaw,
        remainingQuantity: listing.remaining_quantity ?? 1,
        validFrom: listing.protocol_data.parameters.startTime ?? null,
        validUntil: listing.protocol_data.parameters.endTime ?? null,
        extractedTokenIds: semantics.tokenIds,
      },
      transaction: txCandidate,
      policy: { allowed: true, checks: policyDecision.checks },
      simulation: { ok: true },
      review: {
        action: 'BUY',
        tokenId: parsed.tokenId,
        spendRaw: livePriceRaw,
        paymentToken,
        recipient: parsed.buyerAddress.toLowerCase(),
        network: ROBINHOOD_CHAIN.name,
        protocol: 'OpenSea Seaport',
        netVisionFee: 0,
      },
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
