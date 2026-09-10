import { describe, expect, it } from 'vitest';
import { classifyAmount } from './usdg-status';

describe('USDG amount knowledge', () => {
  it('never treats a missing read as zero', () => {
    expect(classifyAmount(null, 1_850_000n)).toEqual({ state: 'UNKNOWN', raw: null });
    expect(classifyAmount(null, 1_850_000n).raw).toBeNull();
  });

  it('is insufficient when known raw is below required', () => {
    expect(classifyAmount(100n, 1_850_000n)).toEqual({
      state: 'KNOWN_INSUFFICIENT',
      raw: '100',
    });
  });

  it('is sufficient when known raw meets required', () => {
    expect(classifyAmount(1_850_000n, 1_850_000n).state).toBe('KNOWN_SUFFICIENT');
  });

  it('stays UNKNOWN when required is not yet known even if balance is', () => {
    expect(classifyAmount(1_850_000n, null)).toEqual({
      state: 'UNKNOWN',
      raw: '1850000',
    });
  });
});
