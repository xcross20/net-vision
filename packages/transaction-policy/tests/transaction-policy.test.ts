import { describe, expect, it } from 'vitest';
import {
  validateOrderDomain,
  validateSweepBasket,
  validateTradeAction,
} from '../src/index';
import {
  BUTTON_PRESSER_COLLECTION,
  PAYMENT_TOKENS,
  ROBINHOOD_CHAIN,
} from '@net-vision/chain-config';

const ALLOW = '0x0000000000000068F116a894984e2DB1123eB395';
const WALLET = '0x0000000000000000000000000000000000000abc';
const USDG = PAYMENT_TOKENS.USDG.contractAddress;

function baseAction(
  overrides: Partial<Parameters<typeof validateTradeAction>[0]['openseaAction']> = {},
) {
  return {
    chainId: ROBINHOOD_CHAIN.id,
    target: ALLOW,
    valueRaw: 0n,
    paymentAmountRaw: 1_000_000n,
    paymentTokenAddress: USDG,
    paymentIsNative: false,
    tokenIds: ['123'],
    collectionContracts: [BUTTON_PRESSER_COLLECTION.contractAddress],
    recipient: WALLET,
    recipientVerifiedFromCalldata: true,
    orderHash: '0xorder',
    orderExpiry: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
  };
}

function baseBuy(
  overrides: Partial<Parameters<typeof validateTradeAction>[0]> = {},
) {
  return validateTradeAction({
    expectedChainId: ROBINHOOD_CHAIN.id,
    expectedWallet: WALLET,
    expectedCollectionContract: BUTTON_PRESSER_COLLECTION.contractAddress,
    expectedTokenIds: ['123'],
    expectedActionType: 'buy',
    expectedMaximumSpendRaw: 1_000_000n,
    expectedPaymentToken: USDG,
    openseaAction: baseAction(),
    simulation: { ok: true, detail: 'eth_call succeeded' },
    ...overrides,
  });
}

describe('validateTradeAction', () => {
  it('approves a clean buy action with independent extraction fields', () => {
    expect(baseBuy().allowed).toBe(true);
  });

  it('rejects buy without mandatory spend cap', () => {
    const decision = baseBuy({ expectedMaximumSpendRaw: undefined });
    expect(decision.allowed).toBe(false);
    expect(decision.allowed === false && decision.reason).toMatch(/max-spend/);
  });

  it('rejects buy when payment exceeds cap', () => {
    const decision = baseBuy({
      openseaAction: baseAction({ paymentAmountRaw: 2_000_000n }),
    });
    expect(decision.allowed).toBe(false);
  });

  it('rejects buy when token ids were not independently extracted', () => {
    const decision = baseBuy({
      openseaAction: baseAction({ tokenIds: [] }),
    });
    expect(decision.allowed).toBe(false);
  });

  it('rejects unexpected token ID in extracted action', () => {
    const decision = baseBuy({
      openseaAction: baseAction({ tokenIds: ['123', '999'] }),
    });
    expect(decision.allowed).toBe(false);
  });

  it('rejects wrong chain ID', () => {
    const decision = baseBuy({
      openseaAction: baseAction({ chainId: 1 }),
    });
    expect(decision.allowed).toBe(false);
  });

  it('rejects wrong NFT contract expectation', () => {
    const decision = baseBuy({
      expectedCollectionContract: '0x0000000000000000000000000000000000000099',
    });
    expect(decision.allowed).toBe(false);
  });

  it('rejects unknown recipient', () => {
    const decision = baseBuy({
      openseaAction: baseAction({
        recipient: '0x0000000000000000000000000000000000000bad',
      }),
    });
    expect(decision.allowed).toBe(false);
  });

  it('rejects when recipient not proven from calldata', () => {
    const decision = baseBuy({
      openseaAction: baseAction({ recipientVerifiedFromCalldata: false }),
    });
    expect(decision.allowed).toBe(false);
  });

  it('rejects unknown target contract', () => {
    const decision = baseBuy({
      openseaAction: baseAction({ target: '0x0000000000000000000000000000000000000099' }),
    });
    expect(decision.allowed).toBe(false);
  });

  it('rejects expired order', () => {
    const decision = baseBuy({
      openseaAction: baseAction({ orderExpiry: 1 }),
      rpcState: { currentBlockTimestamp: 9_999_999 },
    });
    expect(decision.allowed).toBe(false);
  });

  it('rejects failed simulation', () => {
    const decision = baseBuy({
      simulation: { ok: false, detail: 'execution reverted' },
    });
    expect(decision.allowed).toBe(false);
  });

  it('rejects missing simulation on buy', () => {
    const decision = baseBuy({ simulation: undefined });
    expect(decision.allowed).toBe(false);
  });

  it('rejects non-allowlisted payment token', () => {
    const decision = baseBuy({
      expectedPaymentToken: '0x00000000000000000000000000000000000000aa',
      openseaAction: baseAction({
        paymentTokenAddress: '0x00000000000000000000000000000000000000aa',
      }),
    });
    expect(decision.allowed).toBe(false);
  });
});

describe('validateSweepBasket', () => {
  it('rejects injected token ids', () => {
    const decision = validateSweepBasket({
      expectedTokenIds: ['1', '2'],
      actionTokenIds: ['1', '2', '99'],
    });
    expect(decision.allowed).toBe(false);
  });

  it('approves exact basket', () => {
    const decision = validateSweepBasket({
      expectedTokenIds: ['1', '2'],
      actionTokenIds: ['2', '1'],
    });
    expect(decision.allowed).toBe(true);
  });
});

describe('validateOrderDomain', () => {
  it('rejects domain chain mismatch', () => {
    const decision = validateOrderDomain({
      expectedChainId: ROBINHOOD_CHAIN.id,
      domainChainId: 1,
      expectedContract: ALLOW,
      verifyingContract: ALLOW,
    });
    expect(decision.allowed).toBe(false);
  });
});
