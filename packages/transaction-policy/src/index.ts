/**
 * Net Vision transaction policy engine (Wallet Security Hardening V1).
 *
 * Every executable action MUST pass this engine before the wallet is asked
 * to sign. Trading fails closed when chain, order, price, target, token,
 * recipient, currency, or spend validation is uncertain.
 *
 * Critical rule: openseaAction.tokenIds / recipient / payment fields must be
 * independently extracted from Seaport order/fulfillment data — never copied
 * from user intent. See extractListingSemantics().
 */

import {
  BUTTON_PRESSER_COLLECTION,
  isAllowlistedContract,
  isAllowlistedPaymentToken,
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
  /** Mandatory for buy / sweep / accept_offer. */
  expectedMaximumSpendRaw?: bigint;
  /** Payment token contract (not symbol). Mandatory for buy. */
  expectedPaymentToken?: string;
  openseaAction: {
    chainId: number;
    target: string;
    /** Native msg.value (usually 0 for ERC20 settlement). */
    valueRaw?: bigint;
    /** Independently extracted ERC20/native spend. */
    paymentAmountRaw?: bigint;
    paymentTokenAddress?: string;
    paymentIsNative?: boolean;
    approvals?: ReadonlyArray<{ token: string; spender: string; amountRaw: bigint }>;
    /** Independently extracted from Seaport offer items. */
    tokenIds?: ReadonlyArray<string>;
    /** Independently verified NFT recipient (buyer). */
    recipient?: string;
    /** True when recipient was proven via calldata mention / decoder. */
    recipientVerifiedFromCalldata?: boolean;
    considerationRecipients?: ReadonlyArray<string>;
    orderHash?: string;
    orderExpiry?: number;
    collectionContracts?: ReadonlyArray<string>;
  };
  rpcState?: {
    currentBlockTimestamp: number;
  };
  /** eth_call simulation result — required for buy when provided by route. */
  simulation?: {
    ok: boolean;
    detail?: string;
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

function requiresSpendCap(action: PolicyActionType): boolean {
  return action === 'buy' || action === 'sweep' || action === 'accept_offer';
}

/**
 * Validate a trade action against the Net Vision invariants.
 * Trading fails closed: any check that cannot be evaluated affirmatively blocks.
 */
export function validateTradeAction(input: TradeValidationInput): PolicyDecision {
  const checks: PolicyCheck[] = [];
  const action = input.openseaAction;

  record(
    checks,
    'chain-id',
    action.chainId === input.expectedChainId && input.expectedChainId === ROBINHOOD_CHAIN.id,
    `expected ${ROBINHOOD_CHAIN.id}, got ${action.chainId}`,
  );

  const targetOk = isAllowlistedContract(action.target);
  record(checks, 'allowlisted-target', targetOk, `target=${action.target}`);

  const expectedLower = input.expectedCollectionContract.toLowerCase();
  record(
    checks,
    'collection-contract',
    expectedLower === BUTTON_PRESSER_COLLECTION.contractAddress.toLowerCase(),
    `expected ${BUTTON_PRESSER_COLLECTION.contractAddress}`,
  );

  // Token IDs must be present (independently extracted) and match intent.
  const extractedIds = action.tokenIds ?? [];
  record(
    checks,
    'token-ids-extracted',
    extractedIds.length > 0,
    extractedIds.length === 0 ? 'no independently extracted token ids' : undefined,
  );
  const reviewedTokenIds = new Set(input.expectedTokenIds.map((id) => id.toString()));
  const actionTokenIds = new Set(extractedIds.map((id) => id.toString()));
  const tokenSetsEqual =
    reviewedTokenIds.size > 0 &&
    reviewedTokenIds.size === actionTokenIds.size &&
    [...reviewedTokenIds].every((id) => actionTokenIds.has(id));
  record(
    checks,
    'token-id-set',
    tokenSetsEqual,
    `expected ${[...reviewedTokenIds].sort().join(',')} got ${[...actionTokenIds].sort().join(',')}`,
  );

  if (action.collectionContracts && action.collectionContracts.length > 0) {
    const allButton = action.collectionContracts.every(
      (c) => c.toLowerCase() === BUTTON_PRESSER_COLLECTION.contractAddress.toLowerCase(),
    );
    record(checks, 'offer-collection-button-presser', allButton);
  }

  const walletHex = asHexAddress(input.expectedWallet);
  record(checks, 'wallet-format', walletHex !== null);

  // Spend cap — MANDATORY for purchases.
  if (requiresSpendCap(input.expectedActionType)) {
    const cap = input.expectedMaximumSpendRaw;
    const spend = action.paymentAmountRaw ?? action.valueRaw;
    if (cap === undefined) {
      record(checks, 'max-spend', false, 'expectedMaximumSpendRaw is mandatory for purchases');
    } else if (spend === undefined) {
      record(checks, 'max-spend', false, 'paymentAmountRaw/valueRaw missing from extracted action');
    } else {
      record(
        checks,
        'max-spend',
        spend <= cap,
        `spend=${spend} cap=${cap}`,
      );
    }
  } else if (
    input.expectedMaximumSpendRaw !== undefined &&
    action.valueRaw !== undefined
  ) {
    record(
      checks,
      'max-spend',
      action.valueRaw <= input.expectedMaximumSpendRaw,
      `value=${action.valueRaw} cap=${input.expectedMaximumSpendRaw}`,
    );
  }

  // Payment currency — mandatory for buy.
  if (requiresSpendCap(input.expectedActionType)) {
    const expectedPay = input.expectedPaymentToken
      ? asHexAddress(input.expectedPaymentToken)
      : null;
    const actualPay = action.paymentTokenAddress
      ? asHexAddress(action.paymentTokenAddress)
      : null;
    if (!expectedPay || !actualPay) {
      record(
        checks,
        'payment-currency',
        false,
        `expected=${expectedPay ?? 'missing'} actual=${actualPay ?? 'missing'}`,
      );
    } else {
      const allowlisted = action.paymentIsNative
        ? actualPay === '0x0000000000000000000000000000000000000000'
        : isAllowlistedPaymentToken(actualPay);
      record(
        checks,
        'payment-currency',
        expectedPay === actualPay && allowlisted,
        `expected=${expectedPay} actual=${actualPay} allowlisted=${allowlisted}`,
      );
    }
  }

  if (action.orderExpiry !== undefined && input.rpcState) {
    record(
      checks,
      'order-not-expired',
      action.orderExpiry > input.rpcState.currentBlockTimestamp,
      `expiry=${action.orderExpiry} now=${input.rpcState.currentBlockTimestamp}`,
    );
  } else if (requiresSpendCap(input.expectedActionType) && action.orderExpiry === undefined) {
    record(checks, 'order-not-expired', false, 'buy requires order expiry from Seaport parameters');
  } else {
    record(checks, 'order-not-expired', true, 'no expiry in action');
  }

  if (action.approvals) {
    for (const a of action.approvals) {
      const spenderAllowlisted = isAllowlistedContract(a.spender);
      record(
        checks,
        `approval-spender-allowlisted(${a.spender})`,
        spenderAllowlisted,
        'spender must be an allowlisted protocol',
      );
      record(
        checks,
        `approval-token-format(${a.token})`,
        asHexAddress(a.token) !== null,
        'token must be a valid hex address',
      );
    }
  }

  // Recipient must be present, match wallet, and be calldata-verified for buys.
  if (requiresSpendCap(input.expectedActionType)) {
    if (action.recipient === undefined || !walletHex) {
      record(checks, 'recipient-matches-wallet', false, 'recipient missing for purchase');
    } else {
      record(
        checks,
        'recipient-matches-wallet',
        action.recipient.toLowerCase() === walletHex,
        `recipient=${action.recipient}`,
      );
    }
    record(
      checks,
      'recipient-verified-from-calldata',
      action.recipientVerifiedFromCalldata === true,
      action.recipientVerifiedFromCalldata
        ? 'fulfiller address present in calldata'
        : 'could not prove recipient from fulfillment calldata',
    );
  } else if (action.recipient !== undefined && walletHex) {
    record(
      checks,
      'recipient-matches-wallet',
      action.recipient.toLowerCase() === walletHex,
      `recipient=${action.recipient}`,
    );
  }

  if (action.considerationRecipients && walletHex) {
    for (const r of action.considerationRecipients) {
      // Fee recipients are NOT the buyer — only flag unexpected NFT recipients.
      // Consideration on listings is payment destinations (seller/fees), not NFT recipient.
      record(
        checks,
        `consideration-address-format(${r})`,
        asHexAddress(r) !== null,
      );
    }
  }

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

  if (requiresSpendCap(input.expectedActionType)) {
    if (input.simulation === undefined) {
      record(checks, 'rpc-simulation', false, 'simulation required for purchases');
    } else {
      record(checks, 'rpc-simulation', input.simulation.ok, input.simulation.detail);
    }
  }

  const failed = checks.filter((c) => !c.passed);
  if (failed.length > 0) {
    const reason = failed.map((c) => `${c.name}${c.detail ? `: ${c.detail}` : ''}`).join('; ');
    return { allowed: false, reason: `policy refused: ${reason}`, checks };
  }
  return { allowed: true, checks };
}

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

export function validateOrderDomain(input: {
  expectedChainId: number;
  domainChainId: number;
  expectedContract: string;
  verifyingContract: string;
}): PolicyDecision {
  const checks: PolicyCheck[] = [];
  record(checks, 'domain-chain-id', input.domainChainId === input.expectedChainId);
  record(
    checks,
    'domain-contract',
    input.verifyingContract.toLowerCase() === input.expectedContract.toLowerCase(),
  );
  const failed = checks.filter((c) => !c.passed);
  if (failed.length > 0) {
    return { allowed: false, reason: 'order domain mismatch', checks };
  }
  return { allowed: true, checks };
}

export {
  extractListingSemantics,
  calldataMentionsAddress,
  type ExtractedListingSemantics,
} from './seaport-extract';
