/**
 * USDG approve amount for checkout. Always the accepted purchase
 * requirement. Never MaxUint256 / unlimited.
 */
const MAX_UINT256 = (1n << 256n) - 1n;

export function boundedApproveAmount(requiredRaw: bigint): bigint {
  if (requiredRaw <= 0n) {
    throw new Error('bounded approve requires a positive accepted purchase amount');
  }
  if (requiredRaw >= MAX_UINT256) {
    throw new Error('bounded approve refuses unlimited / max-uint amounts');
  }
  return requiredRaw;
}

export function isUnlimitedApprove(amount: bigint): boolean {
  return amount === MAX_UINT256;
}
