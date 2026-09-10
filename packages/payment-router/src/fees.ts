/**
 * Service fee is a USDG line item, never inputAmount * 1.02.
 * Rounds up to the smallest USDG unit.
 */
export function feeAmountUsdg(listingUsdgRaw: bigint, feeBps: bigint): bigint {
  if (listingUsdgRaw < 0n) throw new Error('listingUsdgRaw must be >= 0');
  if (feeBps < 0n) throw new Error('feeBps must be >= 0');
  if (feeBps === 0n || listingUsdgRaw === 0n) return 0n;
  return (listingUsdgRaw * feeBps + 9_999n) / 10_000n;
}

export function requiredUsdgOut(listingUsdgRaw: bigint, feeBps: bigint): bigint {
  return listingUsdgRaw + feeAmountUsdg(listingUsdgRaw, feeBps);
}
