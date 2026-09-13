/**
 * Native marketplace fee authority.
 *
 * Native Net Vision listings: 0.5% (50 bps) of the USDG ask.
 * OpenSea listings remain OpenSea's fee (typically 1%) — we never invent
 * OpenSea consideration; we only display the comparison.
 *
 * Integer arithmetic only. Never JS floats.
 */
export const NATIVE_MARKETPLACE_FEE_BPS = 50n;
export const OPENSEA_MARKETPLACE_FEE_BPS = 100n;
export const BPS_DENOMINATOR = 10_000n;
export const USDG_DECIMALS = 6;
export const USDG_UNIT = 1_000_000n;

export type MarketplaceFeeSplit = {
  listingUsdgRaw: bigint;
  feeBps: bigint;
  marketplaceFeeUsdgRaw: bigint;
  sellerProceedsUsdgRaw: bigint;
};

export function calculateNativeMarketplaceFee(listingUsdgRaw: bigint): MarketplaceFeeSplit {
  if (listingUsdgRaw <= 0n) {
    throw new Error('native-fee: listing price must be positive');
  }
  const marketplaceFeeUsdgRaw =
    (listingUsdgRaw * NATIVE_MARKETPLACE_FEE_BPS + BPS_DENOMINATOR - 1n) / BPS_DENOMINATOR;
  if (marketplaceFeeUsdgRaw >= listingUsdgRaw) {
    throw new Error('native-fee: fee would consume the entire listing');
  }
  return {
    listingUsdgRaw,
    feeBps: NATIVE_MARKETPLACE_FEE_BPS,
    marketplaceFeeUsdgRaw,
    sellerProceedsUsdgRaw: listingUsdgRaw - marketplaceFeeUsdgRaw,
  };
}

export function parseUsdgDecimalToRaw(input: string): bigint {
  const trimmed = input.trim();
  if (!/^\d+(\.\d{1,6})?$/.test(trimmed)) {
    throw new Error('native-fee: invalid USDG amount');
  }
  const [whole, frac = ''] = trimmed.split('.');
  const fracPadded = (frac + '000000').slice(0, 6);
  return BigInt(whole) * USDG_UNIT + BigInt(fracPadded);
}

export function formatUsdgRaw(raw: bigint): string {
  const negative = raw < 0n;
  const abs = negative ? -raw : raw;
  const whole = abs / USDG_UNIT;
  const frac = (abs % USDG_UNIT).toString().padStart(6, '0').replace(/0+$/, '');
  const body = frac.length === 0 ? whole.toString() : `${whole.toString()}.${frac}`;
  return negative ? `-${body}` : body;
}
