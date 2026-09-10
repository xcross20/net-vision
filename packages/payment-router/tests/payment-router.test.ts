import { describe, expect, it } from 'vitest';
import { PAYMENT_TOKENS, ROBINHOOD_CHAIN } from '@net-vision/chain-config';
import {
  LISTING_GONE_AFTER_SWAP,
  OFFICIAL_ROBINHOOD_MAINNET_CHAIN_ID,
  canTransition,
  checkConfiguredChainId,
  findAssetByContract,
  getEnabledPaymentAssets,
  getPaymentAsset,
  initialPhaseAfterQuote,
  transition,
  validateDirectUsdgQuote,
  validateSwapProof,
  validateSwapQuote,
  type PaymentQuote,
  type SwapProof,
} from '../src';

const USER = '0x0000000000000000000000000000000000000abc' as const;

function usdgQuote(overrides: Partial<PaymentQuote> = {}): PaymentQuote {
  return {
    quoteId: 'q1',
    userAddress: USER,
    inputAssetId: 'usdg',
    inputAmountRaw: 428_000_000n,
    expectedUsdgOutRaw: 428_000_000n,
    minUsdgOutRaw: 428_000_000n,
    route: { venue: 'direct', maxSlippageBps: 0, maxPriceImpactBps: 0 },
    listingOrderHash: '0xorder',
    listingUsdgRaw: 428_000_000n,
    expiresAtMs: 2_000,
    ...overrides,
  };
}

describe('registry', () => {
  it('enables only USDG for public checkout', () => {
    expect(getEnabledPaymentAssets().map((a) => a.assetId)).toEqual(['usdg']);
  });

  it('does not treat Cloudflare NET and NetNet NET as the same asset', () => {
    const cloudflare = getPaymentAsset('rh-net-cloudflare');
    const netnet = getPaymentAsset('netnet-net');
    expect(cloudflare?.symbol).toBe('NET');
    expect(netnet?.symbol).toBe('NET');
    expect(cloudflare?.contractAddress?.toLowerCase()).not.toBe(netnet?.contractAddress?.toLowerCase());
    expect(cloudflare?.enabled).toBe(false);
    expect(netnet?.enabled).toBe(false);
  });

  it('looks up stock tokens by contract, not ticker', () => {
    const nvda = findAssetByContract(
      PAYMENT_TOKENS.USDG.chainId,
      '0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC',
    );
    expect(nvda?.assetId).toBe('rh-nvda');
    expect(nvda?.enabled).toBe(false);
  });
});

describe('chain id', () => {
  it('flags Net Vision 1311 as not official mainnet 4663', () => {
    const check = checkConfiguredChainId(ROBINHOOD_CHAIN.id);
    expect(ROBINHOOD_CHAIN.id).toBe(1311);
    expect(check.matchesOfficialMainnet).toBe(false);
    expect(check.officialMainnetChainId).toBe(OFFICIAL_ROBINHOOD_MAINNET_CHAIN_ID);
  });
});

describe('direct USDG', () => {
  it('rejects USDG quotes while configured chainId is not official mainnet', () => {
    const decision = validateDirectUsdgQuote({
      configuredChainId: ROBINHOOD_CHAIN.id,
      quote: usdgQuote(),
      nowMs: 1_000,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.allowed === false && decision.reason).toBe('official-chain-id');
  });

  it('allows a USDG-direct quote when chainId is official 4663', () => {
    const decision = validateDirectUsdgQuote({
      configuredChainId: OFFICIAL_ROBINHOOD_MAINNET_CHAIN_ID,
      quote: usdgQuote(),
      nowMs: 1_000,
    });
    expect(decision.allowed).toBe(true);
  });
});

describe('swap quotes', () => {
  it('does not enable NET or stock swaps', () => {
    const decision = validateSwapQuote({
      configuredChainId: OFFICIAL_ROBINHOOD_MAINNET_CHAIN_ID,
      quote: usdgQuote({
        inputAssetId: 'netnet-net',
        route: {
          venue: 'uniswap-v2',
          router: '0x0000000000000000000000000000000000000888',
          maxSlippageBps: 50,
          maxPriceImpactBps: 100,
        },
      }),
      nowMs: 1_000,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.allowed === false && decision.reason).toBe('asset-enabled');
  });

  it('rejects a swap quote with no pinned router', () => {
    const decision = validateSwapQuote({
      configuredChainId: OFFICIAL_ROBINHOOD_MAINNET_CHAIN_ID,
      quote: usdgQuote({
        inputAssetId: 'usdg',
        route: { venue: 'uniswap-v2', maxSlippageBps: 50, maxPriceImpactBps: 100 },
      }),
      nowMs: 1_000,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.allowed === false && decision.reason).toBe('router-pinned');
  });
});

describe('swap proof', () => {
  const quote = usdgQuote({
    inputAssetId: 'usdg',
  });
  const proof: SwapProof = {
    txHash: '0xabc',
    inputToken: PAYMENT_TOKENS.USDG.contractAddress,
    inputAmountSoldRaw: 428_000_000n,
    usdgReceivedRaw: 428_000_000n,
    fromAddress: USER,
    occurredAtMs: 1_000,
  };

  it('rejects replayed swap proofs', () => {
    const decision = validateSwapProof({
      quote,
      proof,
      nowMs: 2_000,
      seenTxHashes: new Set(['0xabc']),
    });
    expect(decision.allowed).toBe(false);
    expect(decision.allowed === false && decision.reason).toBe('proof-unused');
  });

  it('rejects client-underpaid USDG even if the UI claimed enough', () => {
    const decision = validateSwapProof({
      quote,
      proof: { ...proof, usdgReceivedRaw: 1n },
      nowMs: 2_000,
      seenTxHashes: new Set(),
    });
    expect(decision.allowed).toBe(false);
    expect(decision.allowed === false && decision.reason).toBe('proof-usdg-received');
  });
});

describe('state machine', () => {
  it('skips swap for USDG-direct', () => {
    expect(initialPhaseAfterQuote('usdg')).toBe('usdg_confirmed');
    expect(initialPhaseAfterQuote('netnet-net')).toBe('quoted');
  });

  it('sends listing-gone-after-swap into recovery, not a substitute NFT', () => {
    expect(canTransition('usdg_confirmed', LISTING_GONE_AFTER_SWAP)).toBe(true);
    expect(transition('usdg_confirmed', 'recovery')).toBe('recovery');
    expect(canTransition('usdg_confirmed', 'confirmed')).toBe(false);
  });
});
