import { describe, expect, it } from 'vitest';
import { boundedApproveAmount, isUnlimitedApprove } from './bounded-approve';

describe('boundedApproveAmount', () => {
  it('equals the accepted purchase requirement', () => {
    expect(boundedApproveAmount(1_390_000n)).toBe(1_390_000n);
  });

  it('refuses zero and unlimited', () => {
    expect(() => boundedApproveAmount(0n)).toThrow(/positive/);
    const max = (1n << 256n) - 1n;
    expect(isUnlimitedApprove(max)).toBe(true);
    expect(() => boundedApproveAmount(max)).toThrow(/unlimited/);
  });
});
