import { randomBytes } from 'node:crypto';
import { OFFICIAL_ROBINHOOD_MAINNET_CHAIN_ID, checkConfiguredChainId } from './chain';
import { feeAmountUsdg, requiredUsdgOut } from './fees';
import { PAYMENT_POLICY_VERSION } from './jurisdiction';
import { evaluateAssetPolicy } from './policy';
import { getPaymentAsset } from './registry';
import type { HexAddress, LiveListingBind, PaymentQuote } from './types';

/** Routed quotes live 15–30s. Direct USDG uses the same bind so policy cannot drift. */
export const QUOTE_TTL_MS = 20_000;

export type CreateQuoteInput = {
  configuredChainId: number;
  buyer: HexAddress;
  assetId: string;
  listingOrderHash: string;
  listingUsdgRaw: bigint;
  country: string | null;
  nowMs: number;
  quoteId?: string;
  /** Required for every non-USDG rail. Client-supplied amounts are not authority. */
  liveListing?: LiveListingBind;
};

export type CreateQuoteResult =
  | { ok: true; quote: PaymentQuote }
  | { ok: false; reasonCode: string };

function newQuoteId(nowMs: number): string {
  return `q_${nowMs}_${randomBytes(8).toString('hex')}`;
}

export function createPaymentQuote(input: CreateQuoteInput): CreateQuoteResult {
  const chain = checkConfiguredChainId(input.configuredChainId);
  if (!chain.matchesOfficialMainnet) return { ok: false, reasonCode: 'WRONG_CHAIN' };

  if (!/^0x[a-fA-F0-9]{40}$/.test(input.buyer)) {
    return { ok: false, reasonCode: 'INVALID_BUYER' };
  }
  if (input.listingUsdgRaw <= 0n) return { ok: false, reasonCode: 'INVALID_LISTING_AMOUNT' };
  if (!input.listingOrderHash) return { ok: false, reasonCode: 'MISSING_LISTING_HASH' };

  const asset = getPaymentAsset(input.assetId);
  if (!asset) return { ok: false, reasonCode: 'ASSET_UNKNOWN' };
  if (asset.chainId !== OFFICIAL_ROBINHOOD_MAINNET_CHAIN_ID) {
    return { ok: false, reasonCode: 'WRONG_CHAIN' };
  }

  const policy = evaluateAssetPolicy(asset, input.country);
  if (policy.jurisdiction === 'BLOCKED') {
    return { ok: false, reasonCode: policy.reasonCode ?? 'REGION_RESTRICTED' };
  }
  if (policy.jurisdiction === 'UNKNOWN' && asset.kind === 'stock-token') {
    return { ok: false, reasonCode: policy.reasonCode ?? 'REGION_UNKNOWN' };
  }
  if (asset.status !== 'ENABLED') {
    return { ok: false, reasonCode: 'ASSET_DISABLED' };
  }
  if (!policy.available) {
    return { ok: false, reasonCode: policy.reasonCode ?? 'POLICY_UNAVAILABLE' };
  }

  if (asset.assetId !== 'usdg') {
    if (!input.liveListing) return { ok: false, reasonCode: 'LIVE_LISTING_REQUIRED' };
    if (input.liveListing.orderHash !== input.listingOrderHash) {
      return { ok: false, reasonCode: 'LISTING_HASH_MISMATCH' };
    }
    if (input.liveListing.usdgRaw !== input.listingUsdgRaw) {
      return { ok: false, reasonCode: 'LISTING_AMOUNT_MISMATCH' };
    }
  }

  const feeBps = asset.feeBps;
  const serviceFeeUsdgRaw = feeAmountUsdg(input.listingUsdgRaw, BigInt(feeBps));
  const required = requiredUsdgOut(input.listingUsdgRaw, BigInt(feeBps));
  const route = asset.settlementRoutes[0];
  if (!route) return { ok: false, reasonCode: 'ROUTE_UNAVAILABLE' };

  if (asset.assetId === 'usdg') {
    if (route.venue !== 'direct') return { ok: false, reasonCode: 'DIRECT_USDG_ONLY' };
    return {
      ok: true,
      quote: {
        quoteId: input.quoteId ?? newQuoteId(input.nowMs),
        userAddress: input.buyer.toLowerCase() as HexAddress,
        inputAssetId: 'usdg',
        inputAmountRaw: required,
        expectedUsdgOutRaw: required,
        minUsdgOutRaw: required,
        route,
        listingOrderHash: input.listingOrderHash,
        listingUsdgRaw: input.listingUsdgRaw,
        serviceFeeBps: feeBps,
        serviceFeeUsdgRaw,
        requiredUsdgRaw: required,
        expiresAtMs: input.nowMs + QUOTE_TTL_MS,
        policyVersion: PAYMENT_POLICY_VERSION,
        jurisdiction: policy.jurisdiction,
      },
    };
  }

  return { ok: false, reasonCode: 'ROUTE_UNAVAILABLE' };
}

export function quoteToJson(quote: PaymentQuote) {
  return {
    quoteId: quote.quoteId,
    buyer: quote.userAddress,
    assetId: quote.inputAssetId,
    chainId: OFFICIAL_ROBINHOOD_MAINNET_CHAIN_ID,
    listingOrderHash: quote.listingOrderHash,
    listingUsdgRaw: quote.listingUsdgRaw.toString(),
    serviceFeeBps: quote.serviceFeeBps,
    serviceFeeUsdgRaw: quote.serviceFeeUsdgRaw.toString(),
    requiredUsdgRaw: quote.requiredUsdgRaw.toString(),
    inputAmountRaw: quote.inputAmountRaw.toString(),
    maxInputRaw: quote.inputAmountRaw.toString(),
    expectedUsdgOutRaw: quote.expectedUsdgOutRaw.toString(),
    minUsdgOutRaw: quote.minUsdgOutRaw.toString(),
    priceImpactBps: 0,
    slippageBps: quote.route.maxSlippageBps,
    route: {
      venueId: quote.route.venue,
      routerAddress: quote.route.router ?? null,
    },
    expiresAt: new Date(quote.expiresAtMs).toISOString(),
    policyVersion: quote.policyVersion,
  };
}
