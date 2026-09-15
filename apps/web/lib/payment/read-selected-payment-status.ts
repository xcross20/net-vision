/**
 * Server-side authority for /api/payment/status.
 *
 * Resolves the SelectedPaymentStatus shape for a given (buyer, asset, cart)
 * tuple by combining:
 *   - the payment-router policy decision (routeStatus / jurisdiction),
 *   - the chain-config asset registry (decimals, contractAddress),
 *   - a live USDG balance + allowance read (only when the route is
 *     AVAILABLE — otherwise the wallet reads would fabricate false
 *     confidence against a route the user cannot execute).
 *
 * The Selected-Payment Invariant is enforced here: USDG state never
 * leaks into a non-USDG status, and an asset with no executable route
 * never reports a balance/allowance comparison the user could act on.
 *
 * See docs/launch/CHECKOUT_PAYMENT_STATE.md for the invariant and the
 * full request/response contract.
 */
import type { Address } from 'viem';

import {
  evaluateAssetPolicy,
  getPaymentAsset,
  type PaymentAsset,
  type PaymentPolicyDecision,
} from '@net-vision/payment-router';

import {
  comingSoonStatus,
  regionRestrictedStatus,
  unsupportedStatus,
  type RouteStatus,
  type SelectedPaymentStatus,
  symbolForAssetId,
} from './selected-payment-status';
import { readUsdgStatus } from '@/lib/trade/usdg-status';
import { UNISWAP_ROBINHOOD } from '@net-vision/chain-config';
import { requiredUsdgOut } from '@net-vision/payment-router';
import {
  readErc20Allowance,
  readErc20Balance,
  readNativeBalance,
  robinhoodPublicClient,
} from './read-routed-wallet';
import { quoteExactOutToUsdg, tokenInForAsset } from './uniswap-exact-out';

export type ReadSelectedPaymentStatusInput = {
  buyerAddress: Address;
  assetId: string;
  requiredUsdgRaw: bigint | null;
  conduitKey: string | null;
  country: string | null;
};

export type ReadSelectedPaymentStatusResult =
  | { ok: true; status: SelectedPaymentStatus }
  | { ok: false; error: 'unknown_asset' | 'chain_mismatch' };

/**
 * Translate a payment-router policy decision into our 4-state RouteStatus.
 *
 * The payment-router returns routeStatus ∈ { AVAILABLE, UNAVAILABLE } and a
 * separate available boolean for jurisdiction. We add the two missing
 * states the UI needs:
 *   - REGION_RESTRICTED when jurisdiction is BLOCKED/UNKNOWN for stocks
 *   - UNSUPPORTED when the asset is explicitly DISABLED
 *   - COMING_SOON when an ENABLED asset has no executable route yet
 */
export function routeStatusFromPolicy(policy: PaymentPolicyDecision): RouteStatus {
  // Jurisdiction blocks first — that's the user's most actionable signal.
  if (policy.jurisdiction !== 'ALLOWED') {
    return 'REGION_RESTRICTED';
  }
  // Asset explicitly disabled by ops.
  if (policy.reasonCode === 'ASSET_DISABLED') {
    return 'UNSUPPORTED';
  }
  // Has an executable settlement route (USDG today).
  if (policy.routeStatus === 'AVAILABLE') {
    return 'AVAILABLE';
  }
  // Enabled but no router pinned yet — ship-disabled per the invariant.
  return 'COMING_SOON';
}

async function readRoutedAvailableStatus(
  input: ReadSelectedPaymentStatusInput,
  asset: PaymentAsset,
  policy: PaymentPolicyDecision,
): Promise<SelectedPaymentStatus> {
  const client = robinhoodPublicClient();
  const requiredUsdg =
    input.requiredUsdgRaw === null
      ? null
      : requiredUsdgOut(input.requiredUsdgRaw, BigInt(policy.feeBps));
  let requiredInputRaw: string | null = null;
  try {
    if (requiredUsdg !== null) {
      const dex = await quoteExactOutToUsdg({
        publicClient: client,
        tokenIn: tokenInForAsset(asset),
        amountOutUsdg: requiredUsdg,
        slippageBps: asset.settlementRoutes[0]?.maxSlippageBps ?? 100,
      });
      requiredInputRaw = dex.amountInMaximum.toString();
    }
  } catch {
    requiredInputRaw = null;
  }
  const requiredIn =
    requiredInputRaw === null ? null : BigInt(requiredInputRaw);
  const balance =
    asset.kind === 'native'
      ? await readNativeBalance(input.buyerAddress, requiredIn, client)
      : asset.contractAddress
        ? await readErc20Balance(
            asset.contractAddress as Address,
            input.buyerAddress,
            requiredIn,
            client,
          )
        : { state: 'UNKNOWN' as const, raw: null };
  const allowance =
    asset.kind === 'native'
      ? ({ kind: 'NOT_REQUIRED' } as const)
      : {
          kind: 'REQUIRED' as const,
          spender: UNISWAP_ROBINHOOD.swapRouter02,
          allowance: asset.contractAddress
            ? await readErc20Allowance(
                asset.contractAddress as Address,
                input.buyerAddress,
                requiredIn,
                client,
              )
            : { state: 'UNKNOWN' as const, raw: null },
        };
  return {
    assetId: asset.assetId,
    symbol: asset.symbol,
    decimals: asset.decimals,
    routeStatus: 'AVAILABLE',
    routeReasonCode: null,
    routeNote: null,
    quoteId: requiredInputRaw ? `swap-${asset.assetId}-${requiredInputRaw}` : null,
    requiredInputRaw,
    balance,
    allowance,
    purchaseValueUsdgRaw: input.requiredUsdgRaw?.toString() ?? null,
    serviceFeeBps: policy.feeBps,
    serviceFeeRaw:
      policy.feeBps === 0
        ? '0'
        : input.requiredUsdgRaw === null
          ? null
          : ((input.requiredUsdgRaw * BigInt(policy.feeBps)) / 10_000n).toString(),
  };
}

/**
 * Build a SELECTED-PAYMENT status for a non-AVAILABLE route. Skips the
 * RPC read entirely — there's nothing to compare against a quote that
 * doesn't exist.
 */
function unavailableStatus(input: {
  asset: PaymentAsset;
  routeStatus: 'COMING_SOON' | 'REGION_RESTRICTED' | 'UNSUPPORTED';
  requiredUsdgRaw: bigint | null;
  reasonCode: string | null;
  note: string;
  policy: PaymentPolicyDecision;
}): SelectedPaymentStatus {
  const purchaseValueUsdgRaw = input.requiredUsdgRaw?.toString() ?? null;
  const serviceFeeBps = input.policy.feeBps;
  const symbol = symbolForAssetId(input.asset.assetId) || input.asset.symbol;
  const common = {
    assetId: input.asset.assetId,
    symbol,
    decimals: input.asset.decimals,
    reasonCode: input.reasonCode,
    note: input.note,
    purchaseValueUsdgRaw,
    serviceFeeBps,
  };
  if (input.routeStatus === 'REGION_RESTRICTED') {
    return regionRestrictedStatus(common);
  }
  if (input.routeStatus === 'UNSUPPORTED') {
    return unsupportedStatus(common);
  }
  return comingSoonStatus(common);
}

const ROUTE_NOTE_BY_ROUTE_STATUS: Record<
  'COMING_SOON' | 'REGION_RESTRICTED' | 'UNSUPPORTED',
  string
> = {
  COMING_SOON:
    'Settlement to USDG for this asset is not yet live. Flip the corresponding route flag once the router earns ROUTE PASS.',
  REGION_RESTRICTED:
    'Stock-token payments are not yet enabled in your region.',
  UNSUPPORTED: 'This payment method is currently disabled.',
};

/**
 * Read the SelectedPaymentStatus for a (buyer, asset, cart) tuple.
 */
export async function readSelectedPaymentStatus(
  input: ReadSelectedPaymentStatusInput,
): Promise<ReadSelectedPaymentStatusResult> {
  const asset = getPaymentAsset(input.assetId);
  if (!asset) {
    return { ok: false, error: 'unknown_asset' };
  }

  const policy = evaluateAssetPolicy(asset, input.country);
  const routeStatus = routeStatusFromPolicy(policy);

  if (routeStatus === 'AVAILABLE' && asset.assetId !== 'usdg') {
    return { ok: true, status: await readRoutedAvailableStatus(input, asset, policy) };
  }

  // USDG path: AVAILABLE + ENABLED.
  if (
    routeStatus === 'AVAILABLE' &&
    asset.assetId === 'usdg' &&
    asset.contractAddress
  ) {
    const usdg = await readUsdgStatus({
      buyerAddress: input.buyerAddress,
      requiredRaw: input.requiredUsdgRaw,
      conduitKey: input.conduitKey,
    });
    const status: SelectedPaymentStatus = {
      assetId: asset.assetId,
      symbol: asset.symbol,
      decimals: asset.decimals,
      routeStatus: 'AVAILABLE',
      routeReasonCode: null,
      routeNote: null,
      quoteId: input.conduitKey ?? `usdg-${input.buyerAddress}-${input.requiredUsdgRaw?.toString() ?? '0'}`,
      requiredInputRaw: input.requiredUsdgRaw?.toString() ?? null,
      balance: usdg.balance,
      allowance:
        usdg.spender.address === null
          ? {
              kind: 'REQUIRED',
              spender: null,
              allowance: usdg.allowance,
            }
          : {
              kind: 'REQUIRED',
              spender: usdg.spender.address,
              allowance: usdg.allowance,
            },
      purchaseValueUsdgRaw: input.requiredUsdgRaw?.toString() ?? null,
      serviceFeeBps: policy.feeBps,
      serviceFeeRaw:
        policy.feeBps === 0
          ? '0'
          : input.requiredUsdgRaw === null
            ? null
            : ((input.requiredUsdgRaw * BigInt(policy.feeBps)) / 10_000n).toString(),
    };
    return { ok: true, status };
  }

  // Every other path: short-circuit with a stand-in status. No RPC reads.
  const unavailableRoute = routeStatus as 'COMING_SOON' | 'REGION_RESTRICTED' | 'UNSUPPORTED';
  return {
    ok: true,
    status: unavailableStatus({
      asset,
      routeStatus: unavailableRoute,
      requiredUsdgRaw: input.requiredUsdgRaw,
      reasonCode: policy.reasonCode ?? null,
      note: ROUTE_NOTE_BY_ROUTE_STATUS[unavailableRoute],
      policy,
    }),
  };
}