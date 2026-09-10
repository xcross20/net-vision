export type PaymentAssetKind = 'native' | 'erc20' | 'stock-token';

export type PaymentVenue = 'direct' | 'uniswap-v2' | 'uniswap-v4' | '0x-rfq';

export type HexAddress = `0x${string}`;

export type SettlementRoute = {
  venue: PaymentVenue;
  /** Required unless venue=direct. Never guessed from a symbol. */
  router?: HexAddress;
  maxSlippageBps: number;
  maxPriceImpactBps: number;
};

export type PaymentAsset = {
  assetId: string;
  symbol: string;
  chainId: number;
  kind: PaymentAssetKind;
  contractAddress?: HexAddress;
  decimals: number;
  /** Public checkout may use this asset only when true. */
  enabled: boolean;
  settlementRoutes: SettlementRoute[];
};

export type CheckoutPhase =
  | 'quoted'
  | 'swap_pending'
  | 'usdg_confirmed'
  | 'listing_revalidated'
  | 'purchase_pending'
  | 'confirmed'
  | 'failed'
  | 'recovery';

export type PaymentQuote = {
  quoteId: string;
  userAddress: HexAddress;
  inputAssetId: string;
  inputAmountRaw: bigint;
  expectedUsdgOutRaw: bigint;
  minUsdgOutRaw: bigint;
  route: SettlementRoute;
  listingOrderHash: string;
  listingUsdgRaw: bigint;
  expiresAtMs: number;
};

export type SwapProof = {
  txHash: HexAddress;
  inputToken: HexAddress | 'native';
  inputAmountSoldRaw: bigint;
  usdgReceivedRaw: bigint;
  fromAddress: HexAddress;
  occurredAtMs: number;
};

export type PolicyCheck = { name: string; passed: boolean; detail?: string };

export type RouterDecision =
  | { allowed: true; checks: PolicyCheck[] }
  | { allowed: false; reason: string; checks: PolicyCheck[] };
