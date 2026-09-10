import { describe, expect, it } from 'vitest';
import { PAYMENT_TOKENS, ROBINHOOD_CHAIN } from '@net-vision/chain-config';
import {
  EXECUTOR_DEPLOYED,
  PAYMENT_ASSETS,
  QUOTE_TTL_MS,
  authorizationFromQuote,
  createPaymentQuote,
  feeAmountUsdg,
  findAssetByContract,
  getPaymentAsset,
  signAuthorization,
  validateDirectUsdgQuote,
  validateExecutorCall,
  verifyAuthorization,
} from '../src';

const BUYER = '0x0000000000000000000000000000000000000abc' as const;
const SECRET = 'test-quote-secret';
const LISTING = 100_000_000n;

const PINNED: Array<{ assetId: string; address: `0x${string}`; symbol: string; decimals: number }> = [
  { assetId: 'rh-aapl', address: '0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9', symbol: 'AAPL', decimals: 18 },
  { assetId: 'rh-spy', address: '0x117cc2133c37B721F49dE2A7a74833232B3B4C0C', symbol: 'SPY', decimals: 18 },
  { assetId: 'rh-amzn', address: '0x12f190a9F9d7D37a250758b26824B97CE941bF54', symbol: 'AMZN', decimals: 18 },
  { assetId: 'rh-tsla', address: '0x322F0929c4625eD5bAd873c95208D54E1c003b2d', symbol: 'TSLA', decimals: 18 },
  { assetId: 'rh-coin', address: '0x6330D8C3178a418788dF01a47479c0ce7CCF450b', symbol: 'COIN', decimals: 18 },
  { assetId: 'rh-spcx', address: '0x4a0E65A3EcceC6dBe60AE065F2e7bb85Fae35eEa', symbol: 'SPCX', decimals: 18 },
  { assetId: 'rh-msft', address: '0xe93237C50D904957Cf27E7B1133b510C669c2e74', symbol: 'MSFT', decimals: 18 },
  { assetId: 'rh-nvda', address: '0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC', symbol: 'NVDA', decimals: 18 },
];

describe('on-chain identity pins', () => {
  it('binds Stock Tokens by contract, not ticker', () => {
    for (const row of PINNED) {
      const byId = getPaymentAsset(row.assetId);
      const byContract = findAssetByContract(ROBINHOOD_CHAIN.id, row.address);
      expect(byId?.assetId).toBe(row.assetId);
      expect(byContract?.assetId).toBe(row.assetId);
      expect(byId?.symbol).toBe(row.symbol);
      expect(byId?.decimals).toBe(row.decimals);
      expect(byId?.status).toBe('DISABLED');
      expect(byId?.feeBps).toBe(200);
      expect(byId?.kind).toBe('stock-token');
    }
  });

  it('does not infer support from ticker NET', () => {
    const netAssets = PAYMENT_ASSETS.filter((a) => a.symbol === 'NET');
    expect(netAssets).toHaveLength(2);
    expect(getPaymentAsset('netnet-net')?.contractAddress?.toLowerCase()).toBe(
      '0xca9c78dd337a67f6e0077f65f5e9218719d30edf',
    );
    expect(getPaymentAsset('rh-net-cloudflare')?.contractAddress?.toLowerCase()).toBe(
      '0x116f00968269b7bfbad4109ce591d6e74c0601d4',
    );
    expect(getPaymentAsset('netnet-net')?.decimals).toBe(9);
    expect(getPaymentAsset('rh-net-cloudflare')?.decimals).toBe(18);
    expect(findAssetByContract(ROBINHOOD_CHAIN.id, '0xca9c78dd337a67f6e0077f65f5e9218719d30edf')?.assetId).toBe(
      'netnet-net',
    );
  });

  it('GOOGL stays RESEARCH without a pinned contract', () => {
    const googl = getPaymentAsset('rh-googl');
    expect(googl?.status).toBe('RESEARCH');
    expect(googl?.contractAddress).toBeUndefined();
  });

  it('one Stock Token pin never enables siblings', () => {
    expect(PINNED.every((row) => getPaymentAsset(row.assetId)?.status === 'DISABLED')).toBe(true);
  });
});

describe('createPaymentQuote', () => {
  it('issues a 20s USDG quote with fee from assetId', () => {
    const created = createPaymentQuote({
      configuredChainId: ROBINHOOD_CHAIN.id,
      buyer: BUYER,
      assetId: 'usdg',
      listingOrderHash: '0xorder',
      listingUsdgRaw: LISTING,
      country: 'US',
      nowMs: 1_000,
      quoteId: 'q-usdg',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.quote.serviceFeeBps).toBe(0);
    expect(created.quote.serviceFeeUsdgRaw).toBe(0n);
    expect(created.quote.requiredUsdgRaw).toBe(LISTING);
    expect(created.quote.expiresAtMs).toBe(1_000 + QUOTE_TTL_MS);
    expect(
      validateDirectUsdgQuote({
        configuredChainId: ROBINHOOD_CHAIN.id,
        quote: created.quote,
        nowMs: 1_000,
        country: 'US',
      }).allowed,
    ).toBe(true);
  });

  it('US policy cannot generate an executable Stock Token quote', () => {
    const created = createPaymentQuote({
      configuredChainId: ROBINHOOD_CHAIN.id,
      buyer: BUYER,
      assetId: 'rh-nvda',
      listingOrderHash: '0xorder',
      listingUsdgRaw: LISTING,
      country: 'US',
      nowMs: 1_000,
      liveListing: { orderHash: '0xorder', usdgRaw: LISTING },
    });
    expect(created.ok).toBe(false);
    if (created.ok) return;
    expect(created.reasonCode).toBe('REGION_RESTRICTED');
  });

  it('UNKNOWN jurisdiction cannot generate an executable Stock Token quote', () => {
    const created = createPaymentQuote({
      configuredChainId: ROBINHOOD_CHAIN.id,
      buyer: BUYER,
      assetId: 'rh-aapl',
      listingOrderHash: '0xorder',
      listingUsdgRaw: LISTING,
      country: null,
      nowMs: 1_000,
      liveListing: { orderHash: '0xorder', usdgRaw: LISTING },
    });
    expect(created.ok).toBe(false);
    if (created.ok) return;
    expect(created.reasonCode).toBe('REGION_UNKNOWN');
  });

  it('non-US still cannot quote NVDA without enablement, live listing, and route', () => {
    const created = createPaymentQuote({
      configuredChainId: ROBINHOOD_CHAIN.id,
      buyer: BUYER,
      assetId: 'rh-nvda',
      listingOrderHash: '0xorder',
      listingUsdgRaw: LISTING,
      country: 'FR',
      nowMs: 1_000,
    });
    expect(created.ok).toBe(false);
    if (created.ok) return;
    expect(created.reasonCode).toBe('ASSET_DISABLED');
  });

  it('wrong chain cannot execute', () => {
    const created = createPaymentQuote({
      configuredChainId: 1311,
      buyer: BUYER,
      assetId: 'usdg',
      listingOrderHash: '0xorder',
      listingUsdgRaw: LISTING,
      country: 'US',
      nowMs: 1_000,
    });
    expect(created.ok).toBe(false);
    if (created.ok) return;
    expect(created.reasonCode).toBe('WRONG_CHAIN');
  });

  it('fee is never taken from the client', () => {
    const created = createPaymentQuote({
      configuredChainId: ROBINHOOD_CHAIN.id,
      buyer: BUYER,
      assetId: 'usdg',
      listingOrderHash: '0xorder',
      listingUsdgRaw: LISTING,
      country: 'US',
      nowMs: 1_000,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.quote.serviceFeeBps).toBe(getPaymentAsset('usdg')?.feeBps);
    expect(created.quote.serviceFeeUsdgRaw).toBe(feeAmountUsdg(LISTING, 0n));
  });
});

describe('authorization', () => {
  it('client cannot alter fee, router, or amounts without breaking the signature', () => {
    const created = createPaymentQuote({
      configuredChainId: ROBINHOOD_CHAIN.id,
      buyer: BUYER,
      assetId: 'usdg',
      listingOrderHash: '0xorder',
      listingUsdgRaw: LISTING,
      country: 'FR',
      nowMs: 1_000,
      quoteId: 'q-auth',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const auth = authorizationFromQuote(created.quote);
    const sig = signAuthorization(auth, SECRET);
    expect(verifyAuthorization(auth, sig, SECRET)).toBe(true);
    expect(verifyAuthorization({ ...auth, feeUsdgRaw: 2_000_000n }, sig, SECRET)).toBe(false);
    expect(
      verifyAuthorization(
        { ...auth, router: '0x1111111111111111111111111111111111111111' },
        sig,
        SECRET,
      ),
    ).toBe(false);
    expect(verifyAuthorization(auth, sig, 'other-secret')).toBe(false);
  });
});

describe('executor constraints', () => {
  it('is not deployed and rejects unallowlisted router / wrong output / reused quote', () => {
    expect(EXECUTOR_DEPLOYED).toBe(false);
    const created = createPaymentQuote({
      configuredChainId: ROBINHOOD_CHAIN.id,
      buyer: BUYER,
      assetId: 'usdg',
      listingOrderHash: '0xorder',
      listingUsdgRaw: LISTING,
      country: 'US',
      nowMs: 1_000,
      quoteId: 'q-exec',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const quote = {
      ...created.quote,
      route: {
        venue: 'direct' as const,
        router: '0x1111111111111111111111111111111111111111' as const,
        maxSlippageBps: 0,
        maxPriceImpactBps: 0,
      },
    };
    const auth = authorizationFromQuote(quote);
    const sig = signAuthorization(auth, SECRET);
    const base = {
      configuredChainId: ROBINHOOD_CHAIN.id,
      quote,
      authorization: auth,
      signature: sig,
      secret: SECRET,
      usedQuoteIds: new Set<string>(),
      nowMs: 1_000,
      inputToken: PAYMENT_TOKENS.USDG.contractAddress,
      router: '0x1111111111111111111111111111111111111111' as const,
      feeUsdg: 0n,
      feeRecipient: '0x0000000000000000000000000000000000000fee' as const,
      configuredFeeRecipient: '0x0000000000000000000000000000000000000fee' as const,
      allowlistedRouters: new Set(['0x1111111111111111111111111111111111111111']),
      outputToken: PAYMENT_TOKENS.USDG.contractAddress,
    };
    expect(validateExecutorCall(base).allowed).toBe(true);
    expect(
      validateExecutorCall({
        ...base,
        allowlistedRouters: new Set(),
      }).allowed,
    ).toBe(false);
    expect(
      validateExecutorCall({
        ...base,
        outputToken: '0x322F0929c4625eD5bAd873c95208D54E1c003b2d',
      }).allowed,
    ).toBe(false);
    expect(
      validateExecutorCall({
        ...base,
        feeUsdg: 1n,
      }).allowed,
    ).toBe(false);
    expect(
      validateExecutorCall({
        ...base,
        usedQuoteIds: new Set(['q-exec']),
      }).allowed,
    ).toBe(false);
    expect(
      validateExecutorCall({
        ...base,
        nowMs: created.quote.expiresAtMs + 1,
      }).allowed,
    ).toBe(false);
  });
});
