import { describe, expect, it } from 'vitest';
import {
  calculateNativeMarketplaceFee,
  formatUsdgRaw,
  NATIVE_MARKETPLACE_FEE_BPS,
  OPENSEA_MARKETPLACE_FEE_BPS,
  parseUsdgDecimalToRaw,
} from './fees';

describe('native marketplace fee (0.5%)', () => {
  it('is half of OpenSea 1%', () => {
    expect(NATIVE_MARKETPLACE_FEE_BPS).toBe(50n);
    expect(OPENSEA_MARKETPLACE_FEE_BPS).toBe(100n);
  });

  it('splits 500 USDG into 2.50 fee and 497.50 seller proceeds', () => {
    const split = calculateNativeMarketplaceFee(parseUsdgDecimalToRaw('500'));
    expect(split.marketplaceFeeUsdgRaw).toBe(2_500_000n);
    expect(split.sellerProceedsUsdgRaw).toBe(497_500_000n);
    expect(formatUsdgRaw(split.marketplaceFeeUsdgRaw)).toBe('2.5');
    expect(formatUsdgRaw(split.sellerProceedsUsdgRaw)).toBe('497.5');
  });

  it('ceils fractional subunits so the marketplace is never shorted', () => {
    const split = calculateNativeMarketplaceFee(100n);
    expect(split.marketplaceFeeUsdgRaw).toBe(1n);
    expect(split.sellerProceedsUsdgRaw).toBe(99n);
  });

  it('rejects a listing too small to pay a 0.5% fee', () => {
    expect(() => calculateNativeMarketplaceFee(1n)).toThrow(/consume/);
  });

  it('rejects non-positive listings', () => {
    expect(() => calculateNativeMarketplaceFee(0n)).toThrow(/positive/);
  });

  it('parses decimal USDG without floats', () => {
    expect(parseUsdgDecimalToRaw('1.52')).toBe(1_520_000n);
    expect(parseUsdgDecimalToRaw('100.01')).toBe(100_010_000n);
    expect(() => parseUsdgDecimalToRaw('1.5200001')).toThrow();
    expect(() => parseUsdgDecimalToRaw('-1')).toThrow();
  });
});
