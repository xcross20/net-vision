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
import { BuyPrepareBody } from '@/lib/trade/prepare-body';
import {
  ALLOWLISTED_PROTOCOLS,
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
import { encodeSeaportFulfillment } from '@/lib/trade/encode-seaport-fulfillment';
import { resolveApprovalSpender } from '@/lib/trade/resolve-conduit';
import {
  listingFlight,
  listingLeases,
  nativeFillLock,
  prepareRateLimit,
  purchaseIntents,
} from '@/lib/commerce/runtime';
import {
  defaultIntentExpiry,
  newPurchaseIntentId,
  normalizeBuyer,
} from '@/lib/commerce/purchase-intent';
import {
  PREPARING_ELSEWHERE,
  PREPARING_ELSEWHERE_COPY,
  SOLD_DURING_CHECKOUT,
  SOLD_DURING_CHECKOUT_COPY,
} from '@/lib/commerce/sold-during-checkout';
import { BUTTON_PRESSER_COLLECTION_ID } from '@/lib/index/schema-v2';

export const dynamic = 'force-dynamic';

const Body = BuyPrepareBody;

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

  if (!prepareRateLimit.allow(parsed.buyerAddress)) {
    return NextResponse.json({ error: 'rate_limited', surface: 'buy' }, { status: 429 });
  }

  const purchaseIntentId = parsed.purchaseIntentId ?? newPurchaseIntentId();
  const cartRevision = parsed.cartRevision ?? 0;
  const source = parsed.source ?? 'opensea';
  const intentKey = {
    purchaseIntentId,
    buyer: parsed.buyerAddress,
    orderHash: parsed.acceptedOrderHash,
    cartRevision,
  };
  const existing = purchaseIntents.replay(intentKey);
  const intent =
    existing ??
    purchaseIntents.create({
      id: purchaseIntentId,
      buyer: parsed.buyerAddress,
      orderHash: parsed.acceptedOrderHash,
      collectionId: BUTTON_PRESSER_COLLECTION_ID,
      tokenId: Number(parsed.tokenId),
      cartRevision,
      source,
    });

  const lease = listingLeases.acquire({
    orderHash: parsed.acceptedOrderHash,
    buyer: parsed.buyerAddress,
    intentId: intent.id,
  });
  if (!lease.ok) {
    return NextResponse.json(
      {
        error: PREPARING_ELSEWHERE,
        message: PREPARING_ELSEWHERE_COPY,
        expiresAt: lease.expiresAt,
        purchaseIntentId: intent.id,
      },
      { status: 409 },
    );
  }

  if (source === 'native') {
    const claim = nativeFillLock.claim({
      orderHash: parsed.acceptedOrderHash,
      buyer: normalizeBuyer(parsed.buyerAddress),
      intentId: intent.id,
      expiresAt: defaultIntentExpiry(),
    });
    if (!claim.ok && claim.reason !== 'NOT_FOUND') {
      listingLeases.release(parsed.acceptedOrderHash, intent.id);
      return NextResponse.json(
        {
          error: claim.reason === 'FILLED' ? SOLD_DURING_CHECKOUT : PREPARING_ELSEWHERE,
          message:
            claim.reason === 'FILLED' ? SOLD_DURING_CHECKOUT_COPY : PREPARING_ELSEWHERE_COPY,
          purchaseIntentId: intent.id,
        },
        { status: 409 },
      );
    }
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

    const listing = (await listingFlight.do(`best:${parsed.tokenId}`, () =>
      client.getBestListing({
        slug: BUTTON_PRESSER_COLLECTION.openseaSlug,
        tokenId: parsed.tokenId,
      }),
    )) as Awaited<ReturnType<typeof client.getBestListing>>;
    if (!listing) {
      purchaseIntents.transition(intent.id, 'SOLD');
      listingLeases.release(parsed.acceptedOrderHash, intent.id);
      nativeFillLock.release(parsed.acceptedOrderHash, intent.id);
      return NextResponse.json(
        {
          error: SOLD_DURING_CHECKOUT,
          message: SOLD_DURING_CHECKOUT_COPY,
          purchaseIntentId: intent.id,
        },
        { status: 409 },
      );
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
    if (parsed.acceptedOrderHash !== liveOrderHash) {
      return NextResponse.json(
        { error: 'order changed; please review and accept the new order', liveOrderHash },
        { status: 409 },
      );
    }

    const protocolAddress = listing.protocol_address ?? ALLOWLISTED_PROTOCOLS.seaport16;
    const fulfillment = await client.getListingFulfillmentData({
      orderHash: listing.order_hash,
      fulfillerAddress: parsed.buyerAddress,
      chain: freshness.resolvedChainSlug,
      protocolAddress,
    });

    const raw = fulfillment.raw as Record<string, unknown>;
    const txCandidate =
      (raw?.['fulfillment_data'] as Record<string, unknown> | undefined)?.['transaction'] ??
      (raw?.['transaction'] as Record<string, unknown> | undefined) ??
      raw;

    let encoded;
    try {
      encoded = encodeSeaportFulfillment(txCandidate as Record<string, unknown>);
    } catch (err) {
      return NextResponse.json(
        {
          error: 'unable to encode fulfillment transaction',
          detail: err instanceof Error ? err.message : String(err),
        },
        { status: 422 },
      );
    }
    const txTo = encoded.to;
    const txData = encoded.data;
    const txValueRaw = encoded.value;

    // Efficient basic orders send the NFT to msg.sender; buyer is not in calldata.
    const recipientVerified = encoded.recipientIsMsgSender
      ? true
      : calldataMentionsAddress(txData, parsed.buyerAddress);
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

    const listingConduitKey =
      typeof listing.protocol_data.parameters.conduitKey === 'string'
        ? listing.protocol_data.parameters.conduitKey
        : null;
    let resolvedSpender: Awaited<ReturnType<typeof resolveApprovalSpender>> | null = null;
    try {
      resolvedSpender = await resolveApprovalSpender(listingConduitKey);
    } catch (err) {
      if (!semantics.paymentIsNative) {
        return NextResponse.json(
          {
            error: 'unable to resolve USDG approval spender',
            detail: err instanceof Error ? err.message : String(err),
          },
          { status: 422 },
        );
      }
    }

    const policyDecision = validateTradeAction({
      expectedChainId: ROBINHOOD_CHAIN.id,
      expectedWallet: parsed.buyerAddress,
      expectedCollectionContract: BUTTON_PRESSER_COLLECTION.contractAddress,
      expectedTokenIds: [parsed.tokenId],
      expectedActionType: 'buy',
      expectedMaximumSpendRaw: BigInt(parsed.acceptedPriceRaw),
      expectedPaymentToken: paymentToken,
      extraAllowlistedSpenders: resolvedSpender ? [resolvedSpender.spender] : [],
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
        approvals: resolvedSpender
          ? [
              {
                token: paymentToken,
                spender: resolvedSpender.spender,
                amountRaw: semantics.paymentAmountRaw,
              },
            ]
          : undefined,
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

    purchaseIntents.transition(intent.id, 'PREPARED');

    return NextResponse.json({
      purchaseIntentId: intent.id,
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
      transaction: {
        to: encoded.to,
        data: encoded.data,
        value: encoded.value.toString(),
      },
      approval: resolvedSpender
        ? {
            token: paymentToken,
            spender: resolvedSpender.spender,
            amountRaw: livePriceRaw,
            source: resolvedSpender.source,
            conduitKey: resolvedSpender.conduitKey,
          }
        : null,
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
    listingLeases.release(parsed.acceptedOrderHash, intent.id);
    nativeFillLock.release(parsed.acceptedOrderHash, intent.id);
    purchaseIntents.transition(intent.id, 'FAILED');
    return NextResponse.json(
      {
        error: 'failed to prepare buy',
        detail: err instanceof Error ? err.message : String(err),
        purchaseIntentId: intent.id,
      },
      { status: 502 },
    );
  }
}
