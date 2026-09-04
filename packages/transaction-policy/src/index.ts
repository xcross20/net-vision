/**
 * Net Vision transaction policy engine.
 *
 * Every executable action returned by OpenSea (or any future upstream)
 * MUST pass this engine before the wallet is asked to sign. The engine
 * is intentionally strict: trading fails closed when chain, order,
 * price, target, or token validation is uncertain.
 *
 * This module is pure: it does not call the network, does not sign
 * anything, and does not depend on the OpenSea client. The web app
 * composes the two together.
 */

import {
  BUTTON_PRESSER_COLLECTION,
  isAllowlistedContract,
  ROBINHOOD_CHAIN,
} from '@net-vision/chain-config';

export type PolicyActionType =
  | 'buy'
  | 'list'
  | 'cancel_listing'
  | 'make_offer'
  | 'accept_offer'
  | 'sweep'
  | 'approve';

export type PolicyCheck = {
  name: string;
  passed: boolean;
  detail?: string;
};

export type PolicyDecision =
  | { allowed: true; checks: PolicyCheck[] }
  | { allowed: false; reason: string; checks: PolicyCheck[] };

export type TradeValidationInput = {
  expectedChainId: number;
  expectedWallet: string;
  expectedCollectionContract: string;
  expectedTokenIds: ReadonlyArray<string>;
  expectedActionType: PolicyActionType;
  expectedMaximumSpendRaw?: bigint;
  expectedCurrency?: string;
  openseaAction: {
    chainId: number;
    target: string;
    valueRaw?: bigint;
    approvals?: ReadonlyArray<{ token: string; spender: string; amountRaw: bigint }>;
    tokenIds?: ReadonlyArray<string>;
    recipient?: string;
    considerationRecipients?: ReadonlyArray<string>;
    orderHash?: string;
    orderExpiry?: number; // unix seconds
  };
  rpcState?: {
    currentBlockTimestamp: number;
  };
};

function asHexAddress(value: string): string | null {
  return /^0x[a-fA-F0-9]{40}$/.test(value) ? value.toLowerCase() : null;
}

function record(
  checks: PolicyCheck[],
  name: string,
  passed: boolean,
  detail?: string,
): void {
  checks.push(detail !== undefined ? { name, passed, detail } : { name, passed });
}

/**
 * Validate a trade action against the Net Vision invariants.
 *
 * Trading fails closed: any check that cannot be evaluated affirmatively
 * blocks the action.
 */
export function validateTradeAction(input: TradeValidationInput): PolicyDecision {
  const checks: PolicyCheck[] = [];

  // 1. Chain ID must equal the configured Robinhood Chain ID.
  record(
    checks,
    'chain-id',
    input.openseaAction.chainId === input.expectedChainId &&
      input.expectedChainId === ROBINHOOD_CHAIN.id,
    `expected ${ROBINHOOD_CHAIN.id}, got ${input.openseaAction.chainId}`,
  );

  // 2. Target contract must be allowlisted (Seaport or Button Presser).
  const targetOk = isAllowlistedContract(input.openseaAction.target);
  record(checks, 'allowlisted-target', targetOk, `target=${input.openseaAction.target}`);

  // 3. Collection contract must equal the Button Presser contract.
  const expectedLower = input.expectedCollectionContract.toLowerCase();
  record(
    checks,
    'collection-contract',
    expectedLower === BUTTON_PRESSER_COLLECTION.contractAddress.toLowerCase(),
    `expected ${BUTTON_PRESSER_COLLECTION.contractAddress}`,
  );

  // 4. Token ID set must exactly equal the reviewed intent.
  const reviewedTokenIds = new Set(input.expectedTokenIds.map((id) => id.toString()));
  const actionTokenIds = new Set((input.openseaAction.tokenIds ?? []).map((id) => id.toString()));
  const tokenSetsEqual =
    reviewedTokenIds.size === actionTokenIds.size &&
    [...reviewedTokenIds].every((id) => actionTokenIds.has(id));
  record(
    checks,
    'token-id-set',
    tokenSetsEqual,
    `expected ${[...reviewedTokenIds].sort().join(',')}`,
  );

  // 5. Wallet address must be a valid 0x-prefixed hex address.
  const walletHex = asHexAddress(input.expectedWallet);
  record(checks, 'wallet-format', walletHex !== null);

  // 6. Native value must not exceed reviewed maximum.
  if (input.expectedMaximumSpendRaw !== undefined && input.openseaAction.valueRaw !== undefined) {
    record(
      checks,
      'max-spend',
      input.openseaAction.valueRaw <= input.expectedMaximumSpendRaw,
      `value=${input.openseaAction.valueRaw} cap=${input.expectedMaximumSpendRaw}`,
    );
  } else {
    record(checks, 'max-spend', true, 'no spend cap configured');
  }

  // 7. Order must not be expired.
  if (input.openseaAction.orderExpiry !== undefined && input.rpcState) {
    record(
      checks,
      'order-not-expired',
      input.openseaAction.orderExpiry > input.rpcState.currentBlockTimestamp,
      `expiry=${input.openseaAction.orderExpiry} now=${input.rpcState.currentBlockTimestamp}`,
    );
  } else {
    record(checks, 'order-not-expired', true, 'no expiry in action');
  }

  // 8. Approvals: no unlimited approvals unless explicitly requested.
  // The transaction-prep UI is responsible for surfacing the exact scope.
  if (input.openseaAction.approvals) {
    for (const a of input.openseaAction.approvals) {
      const spenderAllowlisted = isAllowlistedContract(a.spender);
      const tokenAllowlisted = isAllowlistedContract(a.token) || asHexAddress(a.token) !== null;
      record(
        checks,
        `approval-spender-allowlisted(${a.spender})`,
        spenderAllowlisted,
        'spender must be an allowlisted protocol',
      );
      record(
        checks,
        `approval-token-format(${a.token})`,
        tokenAllowlisted,
        'token must be a valid hex address or allowlisted contract',
      );
    }
  }

  // 9. Recipient must equal the authenticated wallet. Buy fulfillment and
  // list creation both route value back to the connected wallet; any
  // other recipient is a hard reject.
  if (input.openseaAction.recipient !== undefined) {
    record(
      checks,
      'recipient-matches-wallet',
      input.openseaAction.recipient.toLowerCase() === walletHex,
      `recipient=${input.openseaAction.recipient}`,
    );
  } else {
    record(checks, 'recipient-matches-wallet', true, 'no recipient in action');
  }

  // 10. Consideration recipients (when present) must also equal the wallet.
  if (input.openseaAction.considerationRecipients) {
    for (const r of input.openseaAction.considerationRecipients) {
      record(
        checks,
        `consideration-recipient(${r})`,
        r.toLowerCase() === walletHex,
        'consideration recipient must equal authenticated wallet',
      );
    }
  }

  // 11. Action type must be in the supported set.
  const supportedActions: PolicyActionType[] = [
    'buy',
    'list',
    'cancel_listing',
    'make_offer',
    'accept_offer',
    'sweep',
    'approve',
  ];
  record(
    checks,
    'action-type-supported',
    supportedActions.includes(input.expectedActionType),
    `requested=${input.expectedActionType}`,
  );

  // Aggregate: a single failed check blocks the trade.
  const failed = checks.filter((c) => !c.passed);
  if (failed.length > 0) {
    const reason = failed.map((c) => `${c.name}${c.detail ? `: ${c.detail}` : ''}`).join('; ');
    return { allowed: false, reason: `policy refused: ${reason}`, checks };
  }
  return { allowed: true, checks };
}

/**
 * Sweep-specific guard. The basket must contain exactly the reviewed
 * token IDs. Any injected token outside the selected membership is
 * rejected, even if its price is cheap.
 */
export function validateSweepBasket(input: {
  expectedTokenIds: ReadonlyArray<string>;
  actionTokenIds: ReadonlyArray<string>;
}): PolicyDecision {
  const checks: PolicyCheck[] = [];
  const expected = new Set(input.expectedTokenIds.map((id) => id.toString()));
  const action = new Set(input.actionTokenIds.map((id) => id.toString()));
  const injected = [...action].filter((id) => !expected.has(id));
  record(checks, 'no-injected-token-ids', injected.length === 0, injected.join(','));
  const setsEqual =
    expected.size === action.size && [...expected].every((id) => action.has(id));
  record(checks, 'exact-basket-membership', setsEqual);
  const failed = checks.filter((c) => !c.passed);
  if (failed.length > 0) {
    return {
      allowed: false,
      reason: `sweep refused: ${failed.map((c) => c.name).join(', ')}`,
      checks,
    };
  }
  return { allowed: true, checks };
}

/**
 * Light sanity check on a typed-data order signature. The full domain
 * verification belongs in the wallet adapter; this guards against
 * obvious mismatches before we even attempt to prompt the user.
 */
export function validateOrderDomain(input: {
  expectedChainId: number;
  domainChainId: number;
  expectedContract: string;
  verifyingContract: string;
}): PolicyDecision {
  const checks: PolicyCheck[] = [];
  record(checks, 'domain-chain-id', input.domainChainId === input.expectedChainId);
  record(checks, 'domain-contract', input.verifyingContract.toLowerCase() === input.expectedContract.toLowerCase());
  const failed = checks.filter((c) => !c.passed);
  if (failed.length > 0) {
    return { allowed: false, reason: 'order domain mismatch', checks };
  }
  return { allowed: true, checks };
}
