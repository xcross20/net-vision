import { describe, expect, it } from 'vitest';

import {
  ASSET_ID_TO_SYMBOL,
  comingSoonStatus,
  regionRestrictedStatus,
  symbolForAssetId,
} from './selected-payment-status';

describe('symbolForAssetId', () => {
  it('returns the canonical symbol for every supported asset', () => {
    expect(symbolForAssetId('usdg')).toBe('USDG');
    expect(symbolForAssetId('eth')).toBe('ETH');
    expect(symbolForAssetId('netnet-net')).toBe('NET');
    expect(symbolForAssetId('rh-aapl')).toBe('AAPL');
    expect(symbolForAssetId('rh-nvda')).toBe('NVDA');
    expect(symbolForAssetId('rh-tsla')).toBe('TSLA');
    expect(symbolForAssetId('rh-coin')).toBe('COIN');
    expect(symbolForAssetId('rh-msft')).toBe('MSFT');
    expect(symbolForAssetId('rh-spy')).toBe('SPY');
    expect(symbolForAssetId('rh-googl')).toBe('GOOGL');
    expect(symbolForAssetId('rh-amzn')).toBe('AMZN');
    expect(symbolForAssetId('rh-spcx')).toBe('SPCX');
  });

  it('uppercases unknown assetIds as a fallback', () => {
    expect(symbolForAssetId('rh-foo')).toBe('RH-FOO');
  });
});

describe('ASSET_ID_TO_SYMBOL', () => {
  it('covers every payment asset shipped in the picker', () => {
    expect(Object.keys(ASSET_ID_TO_SYMBOL).sort()).toEqual([
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
  });
});

describe('comingSoonStatus', () => {
  it('returns a COMING_SOON status with no quote and UNKNOWN balance', () => {
    const status = comingSoonStatus({
      assetId: 'eth',
      symbol: 'ETH',
      decimals: 18,
      purchaseValueUsdgRaw: '1430000000',
      serviceFeeBps: 0,
    });
    expect(status.routeStatus).toBe('COMING_SOON');
    expect(status.quoteId).toBeNull();
    expect(status.requiredInputRaw).toBeNull();
    expect(status.balance).toEqual({ state: 'UNKNOWN', raw: null });
    expect(status.allowance).toEqual({ kind: 'NOT_REQUIRED' });
    expect(status.serviceFeeRaw).toBeNull();
    expect(status.purchaseValueUsdgRaw).toBe('1430000000');
  });

  it('preserves the reasonCode and note when provided', () => {
    const status = comingSoonStatus({
      assetId: 'eth',
      symbol: 'ETH',
      decimals: 18,
      reasonCode: 'ROUTE_NOT_DEPLOYED',
      note: 'ETH settlement ships in a follow-up release.',
      purchaseValueUsdgRaw: null,
      serviceFeeBps: 0,
    });
    expect(status.routeReasonCode).toBe('ROUTE_NOT_DEPLOYED');
    expect(status.routeNote).toBe('ETH settlement ships in a follow-up release.');
  });

  it('defaults reasonCode and note to null when omitted', () => {
    const status = comingSoonStatus({
      assetId: 'netnet-net',
      symbol: 'NET',
      decimals: 18,
      purchaseValueUsdgRaw: null,
      serviceFeeBps: 0,
    });
    expect(status.routeReasonCode).toBeNull();
    expect(status.routeNote).toBeNull();
  });
});

describe('regionRestrictedStatus', () => {
  it('returns a REGION_RESTRICTED status with REQUIRED allowance but null spender', () => {
    const status = regionRestrictedStatus({
      assetId: 'rh-aapl',
      symbol: 'AAPL',
      decimals: 8,
      purchaseValueUsdgRaw: '1430000000',
      serviceFeeBps: 200,
    });
    expect(status.routeStatus).toBe('REGION_RESTRICTED');
    expect(status.routeReasonCode).toBe('REGION_BLOCKED');
    expect(status.quoteId).toBeNull();
    expect(status.requiredInputRaw).toBeNull();
    expect(status.balance).toEqual({ state: 'UNKNOWN', raw: null });
    expect(status.allowance.kind).toBe('REQUIRED');
    if (status.allowance.kind === 'REQUIRED') {
      expect(status.allowance.spender).toBeNull();
      expect(status.allowance.allowance).toEqual({ state: 'UNKNOWN', raw: null });
    }
    expect(status.serviceFeeBps).toBe(200);
  });

  it('uses a sensible default region-restricted note', () => {
    const status = regionRestrictedStatus({
      assetId: 'rh-nvda',
      symbol: 'NVDA',
      decimals: 8,
      purchaseValueUsdgRaw: '1430000000',
      serviceFeeBps: 200,
    });
    expect(status.routeNote).toBe(
      'Stock-token payments are not yet enabled in your region.',
    );
  });
});