/**
 * Selected-payment authority for the checkout flow.
 *
 * The checkout CTA, balance display, fee display, and order-summary rows all
 * derive from this shape. USDG state may not appear in checkout unless USDG
 * itself is the selected input asset.
 *
 * See docs/launch/CHECKOUT_PAYMENT_STATE.md for the Selected-Payment Invariant.
 */
import type { Address } from 'viem';

export type RouteStatus =
  | 'AVAILABLE'
  | 'COMING_SOON'
  | 'REGION_RESTRICTED'
  | 'UNSUPPORTED';

export type AmountKnowledge =
  | { state: 'UNKNOWN'; raw: string | null }
  | { state: 'KNOWN_SUFFICIENT'; raw: string }
  | { state: 'KNOWN_INSUFFICIENT'; raw: string };

export type AllowanceState =
  | { kind: 'NOT_REQUIRED' }
  | {
      kind: 'REQUIRED';
      spender: Address | null;
      allowance: AmountKnowledge;
    };

export type SelectedPaymentStatus = {
  // Identity
  assetId: string;
  symbol: string;
  decimals: number;

  // Settlement availability (gates selection AND UI badge)
  routeStatus: RouteStatus;
  routeReasonCode: string | null;
  routeNote: string | null;

  // Quote (required input in the SELECTED asset, not USDG)
  quoteId: string | null;
  requiredInputRaw: string | null;

  // Wallet state for the SELECTED asset only
  balance: AmountKnowledge;
  allowance: AllowanceState;

  // USDG-equivalent view for the order-summary secondary line
  purchaseValueUsdgRaw: string | null;

  // Fees expressed in the SELECTED asset
  serviceFeeBps: number;
  serviceFeeRaw: string | null;
};

/**
 * The default "Coming soon" status for a policy-allowed asset with no
 * executable settlement route. Use as a stand-in when the backend has not
 * yet produced a real status (e.g. on the first paint before the
 * /api/payment/status fetch resolves).
 */
export function comingSoonStatus(input: {
  assetId: string;
  symbol: string;
  decimals: number;
  reasonCode?: string | null;
  note?: string | null;
  purchaseValueUsdgRaw: string | null;
  serviceFeeBps: number;
}): SelectedPaymentStatus {
  return {
    assetId: input.assetId,
    symbol: input.symbol,
    decimals: input.decimals,
    routeStatus: 'COMING_SOON',
    routeReasonCode: input.reasonCode ?? null,
    routeNote: input.note ?? null,
    quoteId: null,
    requiredInputRaw: null,
    balance: { state: 'UNKNOWN', raw: null },
    allowance: { kind: 'NOT_REQUIRED' },
    purchaseValueUsdgRaw: input.purchaseValueUsdgRaw,
    serviceFeeBps: input.serviceFeeBps,
    serviceFeeRaw: null,
  };
}

/**
 * Region-blocked status for stock-token payments that are policy-allowed but
 * blocked by buyer region / KYC for the current session.
 */
export function regionRestrictedStatus(input: {
  assetId: string;
  symbol: string;
  decimals: number;
  reasonCode?: string | null;
  note?: string | null;
  purchaseValueUsdgRaw: string | null;
  serviceFeeBps: number;
}): SelectedPaymentStatus {
  return {
    assetId: input.assetId,
    symbol: input.symbol,
    decimals: input.decimals,
    routeStatus: 'REGION_RESTRICTED',
    routeReasonCode: input.reasonCode ?? 'REGION_BLOCKED',
    routeNote:
      input.note ??
      'Stock-token payments are not yet enabled in your region.',
    quoteId: null,
    requiredInputRaw: null,
    balance: { state: 'UNKNOWN', raw: null },
    allowance: {
      kind: 'REQUIRED',
      spender: null,
      allowance: { state: 'UNKNOWN', raw: null },
    },
    purchaseValueUsdgRaw: input.purchaseValueUsdgRaw,
    serviceFeeBps: input.serviceFeeBps,
    serviceFeeRaw: null,
  };
}

/**
 * Map an assetId to a default human-readable display symbol.
 * Used when the backend returns a status without a populated symbol field
 * (e.g. after migration from the old payment/methods endpoint).
 */
export const ASSET_ID_TO_SYMBOL: Record<string, string> = {
  usdg: 'USDG',
  eth: 'ETH',
  'netnet-net': 'NET',
  'rh-aapl': 'AAPL',
  'rh-nvda': 'NVDA',
  'rh-tsla': 'TSLA',
  'rh-coin': 'COIN',
  'rh-msft': 'MSFT',
  'rh-spy': 'SPY',
  'rh-googl': 'GOOGL',
  'rh-amzn': 'AMZN',
  'rh-spcx': 'SPCX',
};

export function symbolForAssetId(assetId: string): string {
  return ASSET_ID_TO_SYMBOL[assetId] ?? assetId.toUpperCase();
}