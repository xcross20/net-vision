import type { Jurisdiction, PaymentAsset } from './types';

export const PAYMENT_POLICY_VERSION = 'payment-policy-v3';

export function countryFromHeaders(headers: {
  get(name: string): string | null;
}): string | null {
  const cf = headers.get('cf-ipcountry') ?? headers.get('CF-IPCountry');
  if (!cf || cf === 'XX' || cf === 'T1') return null;
  return cf.toUpperCase();
}

export function jurisdictionForAsset(
  asset: PaymentAsset,
  country: string | null,
): { jurisdiction: Jurisdiction; reasonCode?: string } {
  if (asset.kind !== 'stock-token') {
    return { jurisdiction: 'ALLOWED' };
  }
  if (country == null || country === '') {
    return { jurisdiction: 'UNKNOWN', reasonCode: 'REGION_UNKNOWN' };
  }
  if (country === 'US') {
    return { jurisdiction: 'BLOCKED', reasonCode: 'REGION_RESTRICTED' };
  }
  return { jurisdiction: 'ALLOWED' };
}
