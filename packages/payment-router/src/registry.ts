import { PAYMENT_TOKENS, ROBINHOOD_CHAIN } from '@net-vision/chain-config';
import type { PaymentAsset } from './types';

const CHAIN = ROBINHOOD_CHAIN.id;

/**
 * Identity is assetId + contract, never ticker.
 * Cloudflare Stock Token NET ≠ NetNet $NET (9 decimals).
 *
 * Only USDG is ENABLED until each rail earns its own E2E PASS.
 */
export const PAYMENT_ASSETS: readonly PaymentAsset[] = [
  {
    assetId: 'usdg',
    displayName: 'USDG',
    symbol: 'USDG',
    chainId: CHAIN,
    kind: 'stablecoin',
    contractAddress: PAYMENT_TOKENS.USDG.contractAddress,
    decimals: PAYMENT_TOKENS.USDG.decimals,
    issuer: 'Paxos',
    status: 'ENABLED',
    feeBps: 0,
    settlementRoutes: [{ venue: 'direct', maxSlippageBps: 0, maxPriceImpactBps: 0 }],
  },
  {
    assetId: 'eth',
    displayName: 'Ether',
    symbol: 'ETH',
    chainId: CHAIN,
    kind: 'native',
    decimals: 18,
    status: 'DISABLED',
    feeBps: 0,
    settlementRoutes: [],
  },
  {
    assetId: 'netnet-net',
    displayName: 'NetNet',
    symbol: 'NET',
    chainId: CHAIN,
    kind: 'protocol-token',
    contractAddress: '0xca9c78dd337a67f6e0077f65f5e9218719d30edf',
    decimals: 9,
    issuer: 'NetNet',
    status: 'DISABLED',
    feeBps: 0,
    settlementRoutes: [],
  },
  {
    assetId: 'rh-net-cloudflare',
    displayName: 'Cloudflare • Robinhood Token',
    symbol: 'NET',
    chainId: CHAIN,
    kind: 'stock-token',
    contractAddress: '0x116F00968269B7bfbaD4109cE591d6E74c0601d4',
    decimals: 18,
    issuer: 'Robinhood',
    status: 'DISABLED',
    feeBps: 200,
    settlementRoutes: [],
  },
  {
    assetId: 'rh-nvda',
    displayName: 'NVIDIA • Robinhood Token',
    symbol: 'NVDA',
    chainId: CHAIN,
    kind: 'stock-token',
    contractAddress: '0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC',
    decimals: 18,
    issuer: 'Robinhood',
    status: 'DISABLED',
    feeBps: 200,
    settlementRoutes: [],
  },
  {
    assetId: 'rh-aapl',
    displayName: 'Apple • Robinhood Token',
    symbol: 'AAPL',
    chainId: CHAIN,
    kind: 'stock-token',
    contractAddress: '0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9',
    decimals: 18,
    issuer: 'Robinhood',
    status: 'DISABLED',
    feeBps: 200,
    settlementRoutes: [],
  },
  {
    assetId: 'rh-tsla',
    displayName: 'Tesla • Robinhood Token',
    symbol: 'TSLA',
    chainId: CHAIN,
    kind: 'stock-token',
    contractAddress: '0x322F0929c4625eD5bAd873c95208D54E1c003b2d',
    decimals: 18,
    issuer: 'Robinhood',
    status: 'DISABLED',
    feeBps: 200,
    settlementRoutes: [],
  },
  {
    assetId: 'rh-msft',
    displayName: 'Microsoft • Robinhood Token',
    symbol: 'MSFT',
    chainId: CHAIN,
    kind: 'stock-token',
    contractAddress: '0xe93237C50D904957Cf27E7B1133b510C669c2e74',
    decimals: 18,
    issuer: 'Robinhood',
    status: 'DISABLED',
    feeBps: 200,
    settlementRoutes: [],
  },
  {
    assetId: 'rh-amzn',
    displayName: 'Amazon • Robinhood Token',
    symbol: 'AMZN',
    chainId: CHAIN,
    kind: 'stock-token',
    contractAddress: '0x12f190a9F9d7D37a250758b26824B97CE941bF54',
    decimals: 18,
    issuer: 'Robinhood',
    status: 'DISABLED',
    feeBps: 200,
    settlementRoutes: [],
  },
  {
    assetId: 'rh-coin',
    displayName: 'Coinbase • Robinhood Token',
    symbol: 'COIN',
    chainId: CHAIN,
    kind: 'stock-token',
    contractAddress: '0x6330D8C3178a418788dF01a47479c0ce7CCF450b',
    decimals: 18,
    issuer: 'Robinhood',
    status: 'DISABLED',
    feeBps: 200,
    settlementRoutes: [],
  },
  {
    assetId: 'rh-spy',
    displayName: 'SPDR S&P 500 ETF Trust • Robinhood Token',
    symbol: 'SPY',
    chainId: CHAIN,
    kind: 'stock-token',
    contractAddress: '0x117cc2133c37B721F49dE2A7a74833232B3B4C0C',
    decimals: 18,
    issuer: 'Robinhood',
    status: 'DISABLED',
    feeBps: 200,
    settlementRoutes: [],
  },
  {
    assetId: 'rh-spcx',
    displayName: 'Space Exploration Technologies Corp. Class A • Robinhood Token',
    symbol: 'SPCX',
    chainId: CHAIN,
    kind: 'stock-token',
    contractAddress: '0x4a0E65A3EcceC6dBe60AE065F2e7bb85Fae35eEa',
    decimals: 18,
    issuer: 'Robinhood',
    status: 'DISABLED',
    feeBps: 200,
    settlementRoutes: [],
  },
  {
    assetId: 'rh-googl',
    displayName: 'Alphabet • Robinhood Token',
    symbol: 'GOOGL',
    chainId: CHAIN,
    kind: 'stock-token',
    decimals: 18,
    issuer: 'Robinhood',
    status: 'RESEARCH',
    feeBps: 200,
    settlementRoutes: [],
  },
];

export function getPaymentAsset(assetId: string): PaymentAsset | undefined {
  return PAYMENT_ASSETS.find((asset) => asset.assetId === assetId);
}

export function getEnabledPaymentAssets(): PaymentAsset[] {
  return PAYMENT_ASSETS.filter((asset) => asset.status === 'ENABLED');
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
