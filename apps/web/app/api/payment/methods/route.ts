/**
 * GET /api/payment/methods
 * Geography from CF-IPCountry. Client cannot choose the country.
 *
 * Each method is enriched with the UI-level routeStatus
 * ('AVAILABLE' | 'COMING_SOON' | 'REGION_RESTRICTED' | 'UNSUPPORTED')
 * via routeStatusFromPolicy so the checkout picker can render the
 * disabled tiles required by the Selected-Payment Invariant. The
 * payment-router's own 'AVAILABLE' | 'UNAVAILABLE' | 'UNKNOWN' is
 * preserved as `policyRouteStatus` for any caller that needs the
 * raw signal.
 */
import { NextResponse } from 'next/server';
import { countryFromHeaders, listPaymentMethods } from '@net-vision/payment-router';

import { routeStatusFromPolicy } from '@/lib/payment/read-selected-payment-status';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const country = countryFromHeaders(request.headers);
  const policies = listPaymentMethods(country);
  const methods = policies.map((policy) => ({
    ...policy,
    routeStatus: routeStatusFromPolicy(policy),
    routeReasonCode: policy.reasonCode ?? null,
    routeNote: null as string | null,
  }));
  return NextResponse.json({
    country: country ?? null,
    policyVersion: policies[0]?.policyVersion ?? null,
    methods,
  });
}
