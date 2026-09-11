import { describe, expect, it } from 'vitest';
import { PAYMENT_TOKENS, ROBINHOOD_CHAIN } from '@net-vision/chain-config';
import {
  LISTING_GONE_AFTER_SWAP,
  OFFICIAL_ROBINHOOD_MAINNET_CHAIN_ID,
  PAYMENT_POLICY_VERSION,
  canTransition,
  checkConfiguredChainId,
  feeAmountUsdg,
  findAssetByContract,
  getEnabledPaymentAssets,
  getPaymentAsset,
  initialPhaseAfterQuote,
  listPaymentMethods,
  requiredUsdgOut,
  transition,
  validateDirectUsdgQuote,
  validateSwapProof,
  validateSwapQuote,
  type PaymentQuote,
  type SwapProof,
} from '../src';

const USER = '0x0000000000000000000000000000000000000abc' as const;

function usdgQuote(overrides: Partial<PaymentQuote> = {}): PaymentQuote {
  const listingUsdgRaw = 1_360_000n;
  return {
    quoteId: 'q1',
    userAddress: USER,
    inputAssetId: 'usdg',
    inputAmountRaw: listingUsdgRaw,
    expectedUsdgOutRaw: listingUsdgRaw,
    minUsdgOutRaw: listingUsdgRaw,
    route: { venue: 'direct', maxSlippageBps: 0, maxPriceImpactBps: 0 },
    listingOrderHash: '0xorder',
    listingUsdgRaw,
    serviceFeeBps: 0,
    serviceFeeUsdgRaw: 0n,
    requiredUsdgRaw: listingUsdgRaw,
    expiresAtMs: 2_000,
    policyVersion: PAYMENT_POLICY_VERSION,
    jurisdiction: 'ALLOWED',
    ...overrides,
  };
}

describe('registry', () => {
  it('enables USDG, ETH, NetNet NET, and launch Stock Tokens; Cloudflare NET stays off', () => {
    expect(getEnabledPaymentAssets().map((a) => a.assetId).sort()).toEqual([
      'eth',
      'netnet-net',
      'rh-aapl',
      'rh-amzn',
      'rh-coin',
      'rh-googl',
      'rh-msft',
      'rh-nvda',
      'rh-spcx',
      'rh-spy',
      'rh-tsla',
      'usdg',
    ]);
    expect(getPaymentAsset('eth')?.status).toBe('ENABLED');
    expect(getPaymentAsset('netnet-net')?.status).toBe('ENABLED');
    expect(getPaymentAsset('rh-net-cloudflare')?.status).toBe('DISABLED');
  });

  it('does not treat Cloudflare NET and NetNet NET as the same asset', () => {
    const cloudflare = getPaymentAsset('rh-net-cloudflare');
    const netnet = getPaymentAsset('netnet-net');
    expect(cloudflare?.symbol).toBe('NET');
    expect(netnet?.symbol).toBe('NET');
    expect(cloudflare?.decimals).toBe(18);
    expect(netnet?.decimals).toBe(9);
    expect(cloudflare?.contractAddress?.toLowerCase()).not.toBe(netnet?.contractAddress?.toLowerCase());
    expect(cloudflare?.kind).toBe('stock-token');
    expect(netnet?.kind).toBe('protocol-token');
  });

  it('looks up stock tokens by contract, not ticker', () => {
    const aapl = findAssetByContract(
      PAYMENT_TOKENS.USDG.chainId,
      '0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9',
    );
    expect(aapl?.assetId).toBe('rh-aapl');
    expect(aapl?.status).toBe('ENABLED');
    expect(aapl?.feeBps).toBe(200);
  });

  it('fee is attached to assetId, not kind', () => {
    expect(getPaymentAsset('eth')?.feeBps).toBe(0);
    expect(getPaymentAsset('netnet-net')?.feeBps).toBe(0);
    expect(getPaymentAsset('rh-nvda')?.feeBps).toBe(200);
    expect(getPaymentAsset('rh-spcx')?.feeBps).toBe(200);
  });
});

describe('fees', () => {
  it('rounds 2% up in USDG raw units', () => {
    expect(feeAmountUsdg(100_000_000n, 200n)).toBe(2_000_000n);
    expect(requiredUsdgOut(100_000_000n, 200n)).toBe(102_000_000n);
    expect(feeAmountUsdg(1_360_000n, 200n)).toBe(27_200n);
    expect(feeAmountUsdg(1n, 200n)).toBe(1n);
    expect(feeAmountUsdg(1_360_000n, 0n)).toBe(0n);
  });
});

describe('jurisdiction', () => {
  it('US cannot get an executable Stock Token method', () => {
    const methods = listPaymentMethods('US');
    expect(methods.find((m) => m.assetId === 'usdg')?.available).toBe(true);
    expect(methods.find((m) => m.assetId === 'eth')?.available).toBe(true);
    expect(methods.find((m) => m.assetId === 'netnet-net')?.available).toBe(true);
    expect(methods.find((m) => m.assetId === 'rh-net-cloudflare')).toBeUndefined();
    const nvda = methods.find((m) => m.assetId === 'rh-nvda');
    expect(nvda?.available).toBe(false);
    expect(nvda?.jurisdiction).toBe('BLOCKED');
    expect(nvda?.reasonCode).toBe('REGION_RESTRICTED');
  });

  it('ETH and NetNet NET are available in every jurisdiction', () => {
    for (const country of ['US', 'FR', null] as const) {
      const methods = listPaymentMethods(country);
      expect(methods.find((m) => m.assetId === 'eth')?.available).toBe(true);
      expect(methods.find((m) => m.assetId === 'netnet-net')?.available).toBe(true);
      expect(methods.find((m) => m.assetId === 'eth')?.feeBps).toBe(0);
      expect(methods.find((m) => m.assetId === 'netnet-net')?.feeBps).toBe(0);
    }
  });

  it('UNKNOWN jurisdiction cannot generate an executable Stock Token method', () => {
    const nvda = listPaymentMethods(null).find((m) => m.assetId === 'rh-nvda');
    expect(nvda?.available).toBe(false);
    expect(nvda?.jurisdiction).toBe('UNKNOWN');
  });

  it('non-US may use launch Stock Tokens; conversion route stays unavailable', () => {
    const nvda = listPaymentMethods('FR').find((m) => m.assetId === 'rh-nvda');
    expect(nvda?.jurisdiction).toBe('ALLOWED');
    expect(nvda?.available).toBe(true);
    expect(nvda?.feeBps).toBe(200);
    expect(nvda?.routeStatus).toBe('UNAVAILABLE');
  });
});

describe('chain id', () => {
  it('SoT chain id matches official mainnet; 1311 is rejected', () => {
    expect(ROBINHOOD_CHAIN.id).toBe(OFFICIAL_ROBINHOOD_MAINNET_CHAIN_ID);
    expect(checkConfiguredChainId(ROBINHOOD_CHAIN.id).matchesOfficialMainnet).toBe(true);
    expect(checkConfiguredChainId(1311).matchesOfficialMainnet).toBe(false);
  });
});

describe('direct USDG', () => {
  it('allows a USDG quote on official 4663', () => {
    const decision = validateDirectUsdgQuote({
      configuredChainId: ROBINHOOD_CHAIN.id,
      quote: usdgQuote(),
      nowMs: 1_000,
      country: 'US',
    });
    expect(decision.allowed).toBe(true);
  });

  it('rejects expired quotes and fee tampering', () => {
    expect(
      validateDirectUsdgQuote({
        configuredChainId: ROBINHOOD_CHAIN.id,
        quote: usdgQuote({ expiresAtMs: 500 }),
        nowMs: 1_000,
        country: 'US',
      }).allowed,
    ).toBe(false);
    expect(
      validateDirectUsdgQuote({
        configuredChainId: ROBINHOOD_CHAIN.id,
        quote: usdgQuote({ serviceFeeBps: 200, serviceFeeUsdgRaw: 27_200n }),
        nowMs: 1_000,
        country: 'US',
      }).allowed,
    ).toBe(false);
  });
});

describe('swap quotes stay fail-closed', () => {
  it('US policy cannot generate an executable NVDA quote', () => {
    const listing = 1_360_000n;
    const fee = feeAmountUsdg(listing, 200n);
    const decision = validateSwapQuote({
      configuredChainId: ROBINHOOD_CHAIN.id,
      country: 'US',
      nowMs: 1_000,
      quote: {
        quoteId: 'nvda',
        userAddress: USER,
        inputAssetId: 'rh-nvda',
        inputAmountRaw: 1n,
        expectedUsdgOutRaw: listing + fee,
        minUsdgOutRaw: listing + fee,
        route: {
          venue: 'uniswap-v4',
          router: '0x1111111111111111111111111111111111111111',
          maxSlippageBps: 50,
          maxPriceImpactBps: 100,
        },
        listingOrderHash: '0xorder',
        listingUsdgRaw: listing,
        serviceFeeBps: 200,
        serviceFeeUsdgRaw: fee,
        requiredUsdgRaw: listing + fee,
        expiresAtMs: 2_000,
        policyVersion: PAYMENT_POLICY_VERSION,
        jurisdiction: 'ALLOWED',
      },
    });
    expect(decision.allowed).toBe(false);
  });

  it('client cannot alter fee on a swap quote', () => {
    const listing = 1_360_000n;
    const decision = validateSwapQuote({
      configuredChainId: ROBINHOOD_CHAIN.id,
      country: 'FR',
      nowMs: 1_000,
      quote: {
        quoteId: 'nvda',
        userAddress: USER,
        inputAssetId: 'rh-nvda',
        inputAmountRaw: 1n,
        expectedUsdgOutRaw: listing,
        minUsdgOutRaw: listing,
        route: {
          venue: 'uniswap-v4',
          router: '0x1111111111111111111111111111111111111111',
          maxSlippageBps: 50,
          maxPriceImpactBps: 100,
        },
        listingOrderHash: '0xorder',
        listingUsdgRaw: listing,
        serviceFeeBps: 0,
        serviceFeeUsdgRaw: 0n,
        requiredUsdgRaw: listing,
        expiresAtMs: 2_000,
        policyVersion: PAYMENT_POLICY_VERSION,
        jurisdiction: 'ALLOWED',
      },
    });
    expect(decision.allowed).toBe(false);
    expect(decision.allowed === false && decision.reason).toMatch(/asset-enabled|fee-from-asset-id|policy-available/);
  });

  it('Cloudflare NET is not enabled with the launch Stock Token set', () => {
    expect(getPaymentAsset('rh-net-cloudflare')?.status).toBe('DISABLED');
    expect(getEnabledPaymentAssets().some((a) => a.assetId === 'rh-net-cloudflare')).toBe(false);
  });
});

describe('machine', () => {
  it('USDG skips swap; listing-gone after conversion is recovery', () => {
    expect(initialPhaseAfterQuote('usdg')).toBe('usdg_confirmed');
    expect(initialPhaseAfterQuote('rh-nvda')).toBe('quoted');
    expect(canTransition('usdg_confirmed', LISTING_GONE_AFTER_SWAP)).toBe(true);
    expect(() => transition('confirmed', 'purchase_pending')).toThrow(/illegal/);
  });
});

describe('swap proof', () => {
  it('rejects reuse and wrong input token', () => {
    const quote = usdgQuote({ inputAssetId: 'eth' });
    const proof: SwapProof = {
      txHash: '0xabc',
      inputToken: 'native',
      outputToken: PAYMENT_TOKENS.USDG.contractAddress,
      inputAmountSoldRaw: 1n,
      usdgReceivedRaw: 1_360_000n,
      fromAddress: USER,
      occurredAtMs: 1_000,
    };
    expect(
      validateSwapProof({
        quote,
        proof,
        nowMs: 1_000,
        seenTxHashes: new Set(['0xabc']),
      }).allowed,
    ).toBe(false);
  });
});
