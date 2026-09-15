export type PaymentAssetKind = 'stablecoin' | 'native' | 'protocol-token' | 'stock-token';

export type PaymentAssetStatus = 'ENABLED' | 'DISABLED' | 'RESEARCH';

export type PaymentVenue = 'direct' | 'uniswap-v2' | 'uniswap-v4' | '0x-rfq' | 'net-vision-executor';

export type HexAddress = `0x${string}`;

export type SettlementRoute = {
  venue: PaymentVenue;
  router?: HexAddress;
  maxSlippageBps: number;
  maxPriceImpactBps: number;
};

export type PaymentAsset = {
  assetId: string;
  displayName: string;
  symbol: string;
  chainId: number;
  kind: PaymentAssetKind;
  contractAddress?: HexAddress;
  decimals: number;
  issuer?: string;
  status: PaymentAssetStatus;
  /** Fee is per assetId, never inferred from kind. */
  feeBps: number;
  settlementRoutes: SettlementRoute[];
};

export type Jurisdiction = 'ALLOWED' | 'BLOCKED' | 'UNKNOWN';
export type RouteStatus = 'AVAILABLE' | 'UNAVAILABLE' | 'UNKNOWN';

export type PaymentPolicyDecision = {
  assetId: string;
  available: boolean;
  feeBps: number;
  jurisdiction: Jurisdiction;
  routeStatus: RouteStatus;
  reasonCode?: string;
  policyVersion: string;
};

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
  serviceFeeBps: number;
  serviceFeeUsdgRaw: bigint;
  requiredUsdgRaw: bigint;
  expiresAtMs: number;
  policyVersion: string;
  jurisdiction: Jurisdiction;
};

export type SwapProof = {
  txHash: HexAddress;
  inputToken: HexAddress | 'native';
  outputToken: HexAddress;
  inputAmountSoldRaw: bigint;
  usdgReceivedRaw: bigint;
  fromAddress: HexAddress;
  occurredAtMs: number;
};

export type PaymentAuthorization = {
  quoteId: string;
  user: HexAddress;
  inputAsset: HexAddress | 'native';
  router: HexAddress | 'direct';
  maxInputRaw: bigint;
  minUsdgOutRaw: bigint;
  listingUsdgRaw: bigint;
  feeUsdgRaw: bigint;
  expiresAt: number;
  nonce: bigint;
  chainId: number;
  policyVersion: string;
};

export type LiveListingBind = {
  orderHash: string;
  usdgRaw: bigint;
};

export type PolicyCheck = { name: string; passed: boolean; detail?: string };

export type RouterDecision =
  | { allowed: true; checks: PolicyCheck[] }
  | { allowed: false; reason: string; checks: PolicyCheck[] };

export type CheckoutPhase =
  | 'quoted'
  | 'swap_pending'
  | 'usdg_confirmed'
  | 'listing_revalidated'
  | 'purchase_pending'
  | 'confirmed'
  | 'failed'
  | 'recovery';
