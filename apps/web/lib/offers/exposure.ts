/**
 * Offer capacity: balance minus live ACTIVE exposure.
 * Not a guarantee (buyer can move USDG later). Blocks obviously unfunded offers.
 */
export function availableOfferCapacity(input: {
  balanceUsdgRaw: bigint;
  existingActiveExposureUsdgRaw: bigint;
}): bigint {
  const available = input.balanceUsdgRaw - input.existingActiveExposureUsdgRaw;
  return available > 0n ? available : 0n;
}

export function assertOfferCapacity(input: {
  balanceUsdgRaw: bigint;
  existingActiveExposureUsdgRaw: bigint;
  newLiabilityUsdgRaw: bigint;
}): void {
  if (input.newLiabilityUsdgRaw <= 0n) {
    throw new Error('offer: liability must be positive');
  }
  const available = availableOfferCapacity(input);
  const potential = input.existingActiveExposureUsdgRaw + input.newLiabilityUsdgRaw;
  if (input.newLiabilityUsdgRaw > available) {
    throw new Error(
      `offer: insufficient offer capacity (potential ${potential.toString()} USDG raw, balance ${input.balanceUsdgRaw.toString()})`,
    );
  }
}
