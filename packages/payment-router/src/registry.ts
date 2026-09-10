import { PAYMENT_TOKENS } from '@net-vision/chain-config';
import type { PaymentAsset } from './types';

/**
 * USDG is the only enabled checkout input. Other rows are *candidates*
 * sourced from the official Robinhood registry or public pool pages —
 * they stay enabled:false until a route is independently verified on
 * the live Button Presser chain (see chain.ts).
 *
 * Cloudflare Stock Token symbol NET ≠ NetNet $NET.
 */
export const PAYMENT_ASSETS: readonly PaymentAsset[] = [
  {
    assetId: 'usdg',
    symbol: 'USDG',
    chainId: PAYMENT_TOKENS.USDG.chainId,
    kind: 'erc20',
    contractAddress: PAYMENT_TOKENS.USDG.contractAddress,
    decimals: PAYMENT_TOKENS.USDG.decimals,
    enabled: true,
    settlementRoutes: [
      { venue: 'direct', maxSlippageBps: 0, maxPriceImpactBps: 0 },
    ],
  },
  {
    assetId: 'eth',
    symbol: 'ETH',
    chainId: PAYMENT_TOKENS.USDG.chainId,
    kind: 'native',
    decimals: 18,
    enabled: false,
    settlementRoutes: [],
  },
  {
    assetId: 'weth',
    symbol: 'WETH',
    chainId: PAYMENT_TOKENS.USDG.chainId,
    kind: 'erc20',
    contractAddress: '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73',
    decimals: 18,
    enabled: false,
    settlementRoutes: [],
  },
  {
    assetId: 'netnet-net',
    symbol: 'NET',
    chainId: PAYMENT_TOKENS.USDG.chainId,
    kind: 'erc20',
    contractAddress: '0xca9c78dd337a67f6e0077f65f5e9218719d30edf',
    decimals: 18,
    enabled: false,
    settlementRoutes: [],
  },
  {
    assetId: 'rh-net-cloudflare',
    symbol: 'NET',
    chainId: PAYMENT_TOKENS.USDG.chainId,
    kind: 'stock-token',
    contractAddress: '0x116F00968269B7bfbaD4109cE591d6E74c0601d4',
    decimals: 18,
    enabled: false,
    settlementRoutes: [],
  },
  {
    assetId: 'rh-nvda',
    symbol: 'NVDA',
    chainId: PAYMENT_TOKENS.USDG.chainId,
    kind: 'stock-token',
    contractAddress: '0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC',
    decimals: 18,
    enabled: false,
    settlementRoutes: [],
  },
  {
    assetId: 'rh-aapl',
    symbol: 'AAPL',
    chainId: PAYMENT_TOKENS.USDG.chainId,
    kind: 'stock-token',
    contractAddress: '0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9',
    decimals: 18,
    enabled: false,
    settlementRoutes: [],
  },
  {
    assetId: 'rh-tsla',
    symbol: 'TSLA',
    chainId: PAYMENT_TOKENS.USDG.chainId,
    kind: 'stock-token',
    contractAddress: '0x322F0929c4625eD5bAd873c95208D54E1c003b2d',
    decimals: 18,
    enabled: false,
    settlementRoutes: [],
  },
  {
    assetId: 'rh-msft',
    symbol: 'MSFT',
    chainId: PAYMENT_TOKENS.USDG.chainId,
    kind: 'stock-token',
    contractAddress: '0xe93237C50D904957Cf27E7B1133b510C669c2e74',
    decimals: 18,
    enabled: false,
    settlementRoutes: [],
  },
  {
    assetId: 'rh-amzn',
    symbol: 'AMZN',
    chainId: PAYMENT_TOKENS.USDG.chainId,
    kind: 'stock-token',
    contractAddress: '0x12f190a9F9d7D37a250758b26824B97CE941bF54',
    decimals: 18,
    enabled: false,
    settlementRoutes: [],
  },
  {
    assetId: 'rh-spy',
    symbol: 'SPY',
    chainId: PAYMENT_TOKENS.USDG.chainId,
    kind: 'stock-token',
    contractAddress: '0x117cc2133c37B721F49dE2A7a74833232B3B4C0C',
    decimals: 18,
    enabled: false,
    settlementRoutes: [],
  },
  {
    assetId: 'rh-spcx',
    symbol: 'SPCX',
    chainId: PAYMENT_TOKENS.USDG.chainId,
    kind: 'stock-token',
    contractAddress: '0x4a0E65A3EcceC6dBe60AE065F2e7bb85Fae35eEa',
    decimals: 18,
    enabled: false,
    settlementRoutes: [],
  },
];

export function getPaymentAsset(assetId: string): PaymentAsset | undefined {
  return PAYMENT_ASSETS.find((asset) => asset.assetId === assetId);
}

export function getEnabledPaymentAssets(): PaymentAsset[] {
  return PAYMENT_ASSETS.filter((asset) => asset.enabled);
}

export function findAssetByContract(chainId: number, address: string): PaymentAsset | undefined {
  const needle = address.toLowerCase();
  return PAYMENT_ASSETS.find(
    (asset) =>
      asset.chainId === chainId &&
      asset.contractAddress !== undefined &&
      asset.contractAddress.toLowerCase() === needle,
  );
}
