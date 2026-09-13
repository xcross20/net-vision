import { PAYMENT_TOKENS } from '@net-vision/chain-config';
import { checkConfiguredChainId } from './chain';
import { feeAmountUsdg, requiredUsdgOut } from './fees';
import { PAYMENT_POLICY_VERSION, jurisdictionForAsset } from './jurisdiction';
import { CHECKOUT_HIDDEN_ASSET_IDS, PAYMENT_ASSETS, getPaymentAsset } from './registry';
import type {
  PaymentAsset,
  PaymentPolicyDecision,
  PaymentQuote,
  PolicyCheck,
  RouterDecision,
  RouteStatus,
  SwapProof,
} from './types';

function record(checks: PolicyCheck[], name: string, passed: boolean, detail?: string) {
  checks.push({ name, passed, detail });
}

function fail(checks: PolicyCheck[], reason: string): RouterDecision {
  return { allowed: false, reason, checks };
}

export function evaluateAssetPolicy(
  asset: PaymentAsset,
  country: string | null,
): PaymentPolicyDecision {
  const { jurisdiction, reasonCode } = jurisdictionForAsset(asset, country);
  const hasExecutableRoute = asset.settlementRoutes.some(
    (route) => route.venue === 'direct' || Boolean(route.router),
  );
  const routeStatus: RouteStatus = hasExecutableRoute ? 'AVAILABLE' : 'UNAVAILABLE';
  const available = asset.status === 'ENABLED' && jurisdiction === 'ALLOWED';
  let code = reasonCode;
  if (!available && !code) {
    if (asset.status !== 'ENABLED') code = 'ASSET_DISABLED';
  }
  return {
    assetId: asset.assetId,
    available,
    feeBps: asset.feeBps,
    jurisdiction,
    routeStatus,
    reasonCode: available ? undefined : code,
    policyVersion: PAYMENT_POLICY_VERSION,
  };
}

export function listPaymentMethods(country: string | null): PaymentPolicyDecision[] {
  return PAYMENT_ASSETS.filter((asset) => !CHECKOUT_HIDDEN_ASSET_IDS.has(asset.assetId)).map(
    (asset) => evaluateAssetPolicy(asset, country),
  );
}

export function validateDirectUsdgQuote(input: {
  configuredChainId: number;
  quote: PaymentQuote;
  nowMs: number;
  country: string | null;
}): RouterDecision {
  const checks: PolicyCheck[] = [];
  const chain = checkConfiguredChainId(input.configuredChainId);
  record(checks, 'official-chain-id', chain.matchesOfficialMainnet, chain.detail);

  const asset = getPaymentAsset(input.quote.inputAssetId);
  const policy = asset ? evaluateAssetPolicy(asset, input.country) : undefined;
  record(checks, 'asset-known', asset !== undefined, input.quote.inputAssetId);
  record(checks, 'asset-enabled', asset?.status === 'ENABLED');
  record(checks, 'direct-usdg-only', input.quote.inputAssetId === 'usdg');
  record(checks, 'direct-venue', input.quote.route.venue === 'direct');
  record(checks, 'jurisdiction-allowed', policy?.jurisdiction === 'ALLOWED', policy?.reasonCode);
  record(checks, 'policy-version', input.quote.policyVersion === PAYMENT_POLICY_VERSION);
  record(
    checks,
    'usdg-contract',
    (asset?.contractAddress ?? '').toLowerCase() === PAYMENT_TOKENS.USDG.contractAddress.toLowerCase(),
  );
  record(checks, 'quote-unexpired', input.nowMs <= input.quote.expiresAtMs);
  record(checks, 'fee-from-asset-id', input.quote.serviceFeeBps === (asset?.feeBps ?? -1));
  const expectedFee = asset ? feeAmountUsdg(input.quote.listingUsdgRaw, BigInt(asset.feeBps)) : -1n;
  record(checks, 'fee-amount', input.quote.serviceFeeUsdgRaw === expectedFee);
  const required = asset ? requiredUsdgOut(input.quote.listingUsdgRaw, BigInt(asset.feeBps)) : -1n;
  record(checks, 'required-usdg', input.quote.requiredUsdgRaw === required);
  record(
    checks,
    'output-covers-required',
    input.quote.minUsdgOutRaw >= input.quote.requiredUsdgRaw,
  );

  const missed = checks.find((c) => !c.passed);
  if (missed) return fail(checks, missed.name);
  return { allowed: true, checks };
}

export function validateSwapQuote(input: {
  configuredChainId: number;
  quote: PaymentQuote;
  nowMs: number;
  country: string | null;
}): RouterDecision {
  const checks: PolicyCheck[] = [];
  const chain = checkConfiguredChainId(input.configuredChainId);
  record(checks, 'official-chain-id', chain.matchesOfficialMainnet, chain.detail);

  const asset = getPaymentAsset(input.quote.inputAssetId);
  const policy = asset ? evaluateAssetPolicy(asset, input.country) : undefined;
  record(checks, 'asset-known', asset !== undefined);
  record(checks, 'asset-enabled', asset?.status === 'ENABLED');
  record(checks, 'policy-available', policy?.available === true, policy?.reasonCode);
  record(checks, 'fee-from-asset-id', input.quote.serviceFeeBps === (asset?.feeBps ?? -1));
  const expectedFee = asset ? feeAmountUsdg(input.quote.listingUsdgRaw, BigInt(asset.feeBps)) : -1n;
  record(checks, 'fee-amount', input.quote.serviceFeeUsdgRaw === expectedFee, 'client cannot alter fee');
  record(checks, 'route-available', policy?.routeStatus === 'AVAILABLE');
  record(checks, 'not-direct', input.quote.route.venue !== 'direct');
  record(
    checks,
    'router-pinned',
    typeof input.quote.route.router === 'string' && input.quote.route.router.startsWith('0x'),
  );
  record(
    checks,
    'router-on-asset',
    (asset?.settlementRoutes ?? []).some(
      (route) => route.router?.toLowerCase() === (input.quote.route.router ?? '').toLowerCase(),
    ),
  );
  record(checks, 'quote-unexpired', input.nowMs <= input.quote.expiresAtMs);
  record(checks, 'policy-version', input.quote.policyVersion === PAYMENT_POLICY_VERSION);
  const required = asset ? requiredUsdgOut(input.quote.listingUsdgRaw, BigInt(asset.feeBps)) : -1n;
  record(checks, 'required-usdg', input.quote.requiredUsdgRaw === required);
  record(checks, 'max-input-positive', input.quote.inputAmountRaw > 0n);
  record(checks, 'min-out-positive', input.quote.minUsdgOutRaw > 0n);
  record(checks, 'min-out-lte-expected', input.quote.minUsdgOutRaw <= input.quote.expectedUsdgOutRaw);
  record(checks, 'covers-required', input.quote.minUsdgOutRaw >= input.quote.requiredUsdgRaw);

  const missed = checks.find((c) => !c.passed);
  if (missed) return fail(checks, missed.name);
  return { allowed: true, checks };
}

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

  record(checks, 'asset-enabled', asset?.status === 'ENABLED');
  record(checks, 'proof-input-token', proofInput === expectedInput, `${proofInput} vs ${expectedInput}`);
  record(checks, 'proof-input-amount', input.proof.inputAmountSoldRaw >= input.quote.inputAmountRaw);
  record(
    checks,
    'proof-usdg-received',
    input.proof.usdgReceivedRaw >= input.quote.minUsdgOutRaw,
  );
  record(
    checks,
    'proof-from-user',
    input.proof.fromAddress.toLowerCase() === input.quote.userAddress.toLowerCase(),
  );
  record(checks, 'proof-fresh', input.nowMs - input.proof.occurredAtMs <= maxAge);
  record(checks, 'proof-unused', !input.seenTxHashes.has(input.proof.txHash.toLowerCase()));
  record(
    checks,
    'output-token-is-usdg',
    input.proof.outputToken.toLowerCase() === PAYMENT_TOKENS.USDG.contractAddress.toLowerCase(),
  );

  const missed = checks.find((c) => !c.passed);
  if (missed) return fail(checks, missed.name);
  return { allowed: true, checks };
}
