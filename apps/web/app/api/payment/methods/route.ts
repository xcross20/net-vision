/**
 * GET /api/payment/methods
 * Geography from CF-IPCountry. Client cannot choose the country.
 */
import { NextResponse } from 'next/server';
import { countryFromHeaders, listPaymentMethods } from '@net-vision/payment-router';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const country = countryFromHeaders(request.headers);
  const methods = listPaymentMethods(country);
  return NextResponse.json({
    country: country ?? null,
    policyVersion: methods[0]?.policyVersion ?? null,
    methods,
  });
}
