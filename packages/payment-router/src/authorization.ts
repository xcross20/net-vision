import { createHmac, timingSafeEqual } from 'node:crypto';
import { OFFICIAL_ROBINHOOD_MAINNET_CHAIN_ID } from './chain';
import { getPaymentAsset } from './registry';
import type { HexAddress, PaymentAuthorization, PaymentQuote } from './types';

/**
 * Backend signs authorization, never user keys / never custodial.
 * HMAC binds quote fields so the client cannot alter fee, router, or amounts.
 * On-chain executor (not deployed) will verify an ECDSA sibling of this payload.
 */
export function authorizationFromQuote(quote: PaymentQuote): PaymentAuthorization {
  const asset = getPaymentAsset(quote.inputAssetId);
  const inputAsset: HexAddress | 'native' =
    asset?.kind === 'native'
      ? 'native'
      : ((asset?.contractAddress ?? '0x0000000000000000000000000000000000000000') as HexAddress);
  return {
    quoteId: quote.quoteId,
    user: quote.userAddress,
    inputAsset,
    router: quote.route.router ?? 'direct',
    maxInputRaw: quote.inputAmountRaw,
    minUsdgOutRaw: quote.minUsdgOutRaw,
    listingUsdgRaw: quote.listingUsdgRaw,
    feeUsdgRaw: quote.serviceFeeUsdgRaw,
    expiresAt: quote.expiresAtMs,
    nonce: BigInt(`0x${Buffer.from(quote.quoteId).toString('hex').slice(0, 16) || '1'}`),
    chainId: OFFICIAL_ROBINHOOD_MAINNET_CHAIN_ID,
    policyVersion: quote.policyVersion,
  };
}

export function canonicalAuthorization(auth: PaymentAuthorization): string {
  return JSON.stringify({
    chainId: auth.chainId,
    expiresAt: auth.expiresAt,
    feeUsdgRaw: auth.feeUsdgRaw.toString(),
    inputAsset: auth.inputAsset.toLowerCase(),
    listingUsdgRaw: auth.listingUsdgRaw.toString(),
    maxInputRaw: auth.maxInputRaw.toString(),
    minUsdgOutRaw: auth.minUsdgOutRaw.toString(),
    nonce: auth.nonce.toString(),
    policyVersion: auth.policyVersion,
    quoteId: auth.quoteId,
    router: auth.router.toLowerCase(),
    user: auth.user.toLowerCase(),
  });
}

export function signAuthorization(auth: PaymentAuthorization, secret: string): string {
  if (!secret) throw new Error('PAYMENT_QUOTE_SIGNING_SECRET missing');
  return createHmac('sha256', secret).update(canonicalAuthorization(auth)).digest('hex');
}

export function verifyAuthorization(
  auth: PaymentAuthorization,
  signature: string,
  secret: string,
): boolean {
  if (!secret || !signature) return false;
  const expected = signAuthorization(auth, secret);
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(signature, 'hex');
  if (a.length === 0 || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
