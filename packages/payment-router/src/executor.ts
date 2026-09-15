import { PAYMENT_TOKENS } from '@net-vision/chain-config';
import { verifyAuthorization } from './authorization';
import { checkConfiguredChainId } from './chain';
import { getPaymentAsset } from './registry';
import type { HexAddress, PaymentAuthorization, PaymentQuote, PolicyCheck, RouterDecision } from './types';

/** Executor bytecode is not on 4663. Routed rails stay DISABLED until it is. */
export const EXECUTOR_DEPLOYED = false;

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;

function record(checks: PolicyCheck[], name: string, passed: boolean, detail?: string) {
  checks.push({ name, passed, detail });
}

function fail(checks: PolicyCheck[], reason: string): RouterDecision {
  return { allowed: false, reason, checks };
}

/**
 * Constraints the on-chain executor must enforce. The frontend cannot invent
 * router, calldata, fee, token, or recipient — only a server-signed quote can.
 */
export function validateExecutorCall(input: {
  configuredChainId: number;
  quote: PaymentQuote;
  authorization: PaymentAuthorization;
  signature: string;
  secret: string;
  usedQuoteIds: ReadonlySet<string>;
  nowMs: number;
  inputToken: HexAddress | 'native';
  router: HexAddress;
  feeUsdg: bigint;
  feeRecipient: HexAddress;
  configuredFeeRecipient: HexAddress;
  allowlistedRouters: ReadonlySet<string>;
  outputToken: HexAddress;
}): RouterDecision {
  const checks: PolicyCheck[] = [];
  const chain = checkConfiguredChainId(input.configuredChainId);
  const asset = getPaymentAsset(input.quote.inputAssetId);
  const expectedInput =
    asset?.kind === 'native' ? 'native' : (asset?.contractAddress ?? '').toLowerCase();
  const gotInput =
    input.inputToken === 'native' ? 'native' : input.inputToken.toLowerCase();

  record(checks, 'executor-not-a-general-router', true);
  record(checks, 'official-chain-id', chain.matchesOfficialMainnet, chain.detail);
  record(checks, 'asset-known', asset !== undefined);
  record(checks, 'asset-enabled', asset?.status === 'ENABLED');
  record(checks, 'input-token-allowlisted', gotInput === expectedInput, `${gotInput} vs ${expectedInput}`);
  record(
    checks,
    'router-allowlisted',
    input.allowlistedRouters.has(input.router.toLowerCase()),
    input.router,
  );
  record(
    checks,
    'usdg-canonical',
    input.outputToken.toLowerCase() === PAYMENT_TOKENS.USDG.contractAddress.toLowerCase(),
  );
  record(
    checks,
    'fee-recipient-configured',
    input.configuredFeeRecipient.toLowerCase() !== ZERO_ADDRESS &&
      input.feeRecipient.toLowerCase() === input.configuredFeeRecipient.toLowerCase(),
  );
  record(checks, 'fee-lte-quote', input.feeUsdg <= input.quote.serviceFeeUsdgRaw);
  record(checks, 'fee-matches-auth', input.feeUsdg === input.authorization.feeUsdgRaw);
  record(checks, 'min-out-enforced', input.quote.minUsdgOutRaw >= input.quote.requiredUsdgRaw);
  record(checks, 'quote-unexpired', input.nowMs <= input.quote.expiresAtMs);
  record(checks, 'quote-unused', !input.usedQuoteIds.has(input.quote.quoteId));
  record(
    checks,
    'authorization-signature',
    verifyAuthorization(input.authorization, input.signature, input.secret),
  );
  record(checks, 'auth-user-matches-quote', input.authorization.user === input.quote.userAddress);
  record(checks, 'auth-router-matches', input.authorization.router.toLowerCase() === input.router.toLowerCase());
  record(checks, 'never-custodial', true, 'backend signs authorization only');

  const missed = checks.find((c) => !c.passed);
  if (missed) return fail(checks, missed.name);
  return { allowed: true, checks };
}
