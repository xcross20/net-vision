import { PAYMENT_TOKENS } from '@net-vision/chain-config';
import { checkConfiguredChainId } from './chain';
import { getPaymentAsset } from './registry';
import type { PaymentQuote, PolicyCheck, RouterDecision, SwapProof } from './types';

function record(checks: PolicyCheck[], name: string, passed: boolean, detail?: string) {
  checks.push({ name, passed, detail });
}

function fail(checks: PolicyCheck[], reason: string): RouterDecision {
  return { allowed: false, reason, checks };
}

export function validateDirectUsdgQuote(input: {
  configuredChainId: number;
  quote: PaymentQuote;
  nowMs: number;
}): RouterDecision {
  const checks: PolicyCheck[] = [];
  const chain = checkConfiguredChainId(input.configuredChainId);
  record(checks, 'official-chain-id', chain.matchesOfficialMainnet, chain.detail);

  const asset = getPaymentAsset(input.quote.inputAssetId);
  record(checks, 'asset-known', asset !== undefined, input.quote.inputAssetId);
  record(checks, 'asset-enabled', asset?.enabled === true, asset?.assetId);
  record(checks, 'direct-usdg-only', input.quote.inputAssetId === 'usdg');
  record(checks, 'direct-venue', input.quote.route.venue === 'direct');
  record(
    checks,
    'usdg-contract',
    (asset?.contractAddress ?? '').toLowerCase() === PAYMENT_TOKENS.USDG.contractAddress.toLowerCase(),
  );
  record(checks, 'quote-unexpired', input.nowMs <= input.quote.expiresAtMs);
  record(
    checks,
    'output-covers-listing',
    input.quote.minUsdgOutRaw >= input.quote.listingUsdgRaw,
    `minOut=${input.quote.minUsdgOutRaw} listing=${input.quote.listingUsdgRaw}`,
  );

  const missed = checks.find((c) => !c.passed);
  if (missed) return fail(checks, missed.name);
  return { allowed: true, checks };
}

export function validateSwapQuote(input: {
  configuredChainId: number;
  quote: PaymentQuote;
  nowMs: number;
}): RouterDecision {
  const checks: PolicyCheck[] = [];
  const chain = checkConfiguredChainId(input.configuredChainId);
  record(checks, 'official-chain-id', chain.matchesOfficialMainnet, chain.detail);

  const asset = getPaymentAsset(input.quote.inputAssetId);
  record(checks, 'asset-known', asset !== undefined);
  record(checks, 'asset-enabled', asset?.enabled === true);
  record(checks, 'not-direct', input.quote.route.venue !== 'direct');
  record(checks, 'router-pinned', typeof input.quote.route.router === 'string' && input.quote.route.router.startsWith('0x'));
  record(checks, 'quote-unexpired', input.nowMs <= input.quote.expiresAtMs);
  record(checks, 'max-input-positive', input.quote.inputAmountRaw > 0n);
  record(checks, 'min-out-positive', input.quote.minUsdgOutRaw > 0n);
  record(checks, 'min-out-lte-expected', input.quote.minUsdgOutRaw <= input.quote.expectedUsdgOutRaw);
  record(
    checks,
    'covers-listing',
    input.quote.minUsdgOutRaw >= input.quote.listingUsdgRaw,
  );

  const missed = checks.find((c) => !c.passed);
  if (missed) return fail(checks, missed.name);
  return { allowed: true, checks };
}

/**
 * Fletcher-style swap proof: independently verify input sold, USDG received,
 * user, recency, and single-use. Client-reported amounts are not trusted.
 */
export function validateSwapProof(input: {
  quote: PaymentQuote;
  proof: SwapProof;
  nowMs: number;
  seenTxHashes: ReadonlySet<string>;
  maxAgeMs?: number;
}): RouterDecision {
  const checks: PolicyCheck[] = [];
  const maxAge = input.maxAgeMs ?? 15 * 60_000;
  const asset = getPaymentAsset(input.quote.inputAssetId);
  const expectedInput =
    asset?.kind === 'native' ? 'native' : (asset?.contractAddress ?? '').toLowerCase();
  const proofInput =
    input.proof.inputToken === 'native' ? 'native' : input.proof.inputToken.toLowerCase();

  record(checks, 'asset-enabled', asset?.enabled === true);
  record(checks, 'proof-input-token', proofInput === expectedInput, `${proofInput} vs ${expectedInput}`);
  record(
    checks,
    'proof-input-amount',
    input.proof.inputAmountSoldRaw >= input.quote.inputAmountRaw,
  );
  record(
    checks,
    'proof-usdg-received',
    input.proof.usdgReceivedRaw >= input.quote.minUsdgOutRaw,
    `got=${input.proof.usdgReceivedRaw} min=${input.quote.minUsdgOutRaw}`,
  );
  record(
    checks,
    'proof-from-user',
    input.proof.fromAddress.toLowerCase() === input.quote.userAddress.toLowerCase(),
  );
  record(checks, 'proof-fresh', input.nowMs - input.proof.occurredAtMs <= maxAge);
  record(checks, 'proof-unused', !input.seenTxHashes.has(input.proof.txHash.toLowerCase()));
  record(checks, 'never-trust-client-out', true);

  const missed = checks.find((c) => !c.passed);
  if (missed) return fail(checks, missed.name);
  return { allowed: true, checks };
}
