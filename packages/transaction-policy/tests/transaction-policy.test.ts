import { describe, expect, it } from 'vitest';
import {
  validateOrderDomain,
  validateSweepBasket,
  validateTradeAction,
} from '../src/index';
import { BUTTON_PRESSER_COLLECTION, ROBINHOOD_CHAIN } from '@net-vision/chain-config';

const ALLOW = '0x0000000000000068F116a894984e2DB1123eB395';
const WALLET = '0x0000000000000000000000000000000000000abc';
const CURRENCY = '0x0000000000000000000000000000000000000000';

function baseAction(overrides: Partial<Parameters<typeof validateTradeAction>[0]['openseaAction']> = {}) {
  return {
    chainId: ROBINHOOD_CHAIN.id,
    target: ALLOW,
    valueRaw: 0n,
    tokenIds: ['123'],
    recipient: WALLET,
    orderHash: '0xorder',
    orderExpiry: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
  };
}

describe('validateTradeAction', () => {
  it('approves a clean buy action', () => {
    const decision = validateTradeAction({
      expectedChainId: ROBINHOOD_CHAIN.id,
      expectedWallet: WALLET,
      expectedCollectionContract: BUTTON_PRESSER_COLLECTION.contractAddress,
      expectedTokenIds: ['123'],
      expectedActionType: 'buy',
      openseaAction: baseAction(),
    });
    expect(decision.allowed).toBe(true);
  });

  it('rejects wrong chain ID', () => {
    const decision = validateTradeAction({
      expectedChainId: ROBINHOOD_CHAIN.id,
      expectedWallet: WALLET,
      expectedCollectionContract: BUTTON_PRESSER_COLLECTION.contractAddress,
      expectedTokenIds: ['123'],
      expectedActionType: 'buy',
      openseaAction: baseAction({ chainId: 1 }),
    });
    expect(decision.allowed).toBe(false);
  });

  it('rejects wrong NFT contract', () => {
    const decision = validateTradeAction({
      expectedChainId: ROBINHOOD_CHAIN.id,
      expectedWallet: WALLET,
      expectedCollectionContract: '0x0000000000000000000000000000000000000099',
      expectedTokenIds: ['123'],
      expectedActionType: 'buy',
      openseaAction: baseAction(),
    });
    expect(decision.allowed).toBe(false);
  });

  it('rejects unexpected token ID in action', () => {
    const decision = validateTradeAction({
      expectedChainId: ROBINHOOD_CHAIN.id,
      expectedWallet: WALLET,
      expectedCollectionContract: BUTTON_PRESSER_COLLECTION.contractAddress,
      expectedTokenIds: ['123'],
      expectedActionType: 'buy',
      openseaAction: baseAction({ tokenIds: ['123', '999'] }),
    });
    expect(decision.allowed).toBe(false);
  });

  it('rejects value above the approved maximum', () => {
    const decision = validateTradeAction({
      expectedChainId: ROBINHOOD_CHAIN.id,
      expectedWallet: WALLET,
      expectedCollectionContract: BUTTON_PRESSER_COLLECTION.contractAddress,
      expectedTokenIds: ['123'],
      expectedActionType: 'buy',
      expectedMaximumSpendRaw: 1_000_000_000n,
      openseaAction: baseAction({ valueRaw: 2_000_000_000n }),
    });
    expect(decision.allowed).toBe(false);
  });

  it('rejects unknown recipient', () => {
    const decision = validateTradeAction({
      expectedChainId: ROBINHOOD_CHAIN.id,
      expectedWallet: WALLET,
      expectedCollectionContract: BUTTON_PRESSER_COLLECTION.contractAddress,
      expectedTokenIds: ['123'],
      expectedActionType: 'buy',
      openseaAction: baseAction({ recipient: '0x0000000000000000000000000000000000000bad' }),
    });
    expect(decision.allowed).toBe(false);
  });

  it('rejects unknown target contract', () => {
    const decision = validateTradeAction({
      expectedChainId: ROBINHOOD_CHAIN.id,
      expectedWallet: WALLET,
      expectedCollectionContract: BUTTON_PRESSER_COLLECTION.contractAddress,
      expectedTokenIds: ['123'],
      expectedActionType: 'buy',
      openseaAction: baseAction({ target: '0x0000000000000000000000000000000000000099' }),
    });
    expect(decision.allowed).toBe(false);
  });

  it('rejects expired order', () => {
    const decision = validateTradeAction({
      expectedChainId: ROBINHOOD_CHAIN.id,
      expectedWallet: WALLET,
      expectedCollectionContract: BUTTON_PRESSER_COLLECTION.contractAddress,
      expectedTokenIds: ['123'],
      expectedActionType: 'buy',
      openseaAction: baseAction({ orderExpiry: 1 }),
      rpcState: { currentBlockTimestamp: 9_999_999 },
    });
    expect(decision.allowed).toBe(false);
  });

  it('rejects unsupported action type', () => {
    const decision = validateTradeAction({
      expectedChainId: ROBINHOOD_CHAIN.id,
      expectedWallet: WALLET,
      expectedCollectionContract: BUTTON_PRESSER_COLLECTION.contractAddress,
      expectedTokenIds: ['123'],
      // Cast to bypass the union type to exercise the runtime guard.
      expectedActionType: 'malicious_action' as unknown as 'buy',
      openseaAction: baseAction(),
    });
    expect(decision.allowed).toBe(false);
  });

  it('rejects approval to a non-allowlisted spender', () => {
    const decision = validateTradeAction({
      expectedChainId: ROBINHOOD_CHAIN.id,
      expectedWallet: WALLET,
      expectedCollectionContract: BUTTON_PRESSER_COLLECTION.contractAddress,
      expectedTokenIds: ['123'],
      expectedActionType: 'approve',
      openseaAction: baseAction({
        approvals: [{ token: CURRENCY, spender: '0x0000000000000000000000000000000000000bad', amountRaw: 1n }],
      }),
    });
    expect(decision.allowed).toBe(false);
  });
});

describe('validateSweepBasket', () => {
  it('approves an exact basket', () => {
    const decision = validateSweepBasket({
      expectedTokenIds: ['1', '2', '3'],
      actionTokenIds: ['1', '2', '3'],
    });
    expect(decision.allowed).toBe(true);
  });

  it('rejects injected token IDs', () => {
    const decision = validateSweepBasket({
      expectedTokenIds: ['1', '2', '3'],
      actionTokenIds: ['1', '2', '3', '4'],
    });
    expect(decision.allowed).toBe(false);
  });

  it('rejects missing expected tokens', () => {
    const decision = validateSweepBasket({
      expectedTokenIds: ['1', '2', '3'],
      actionTokenIds: ['1', '2'],
    });
    expect(decision.allowed).toBe(false);
  });
});

describe('validateOrderDomain', () => {
  it('approves matching domain', () => {
    const decision = validateOrderDomain({
      expectedChainId: ROBINHOOD_CHAIN.id,
      domainChainId: ROBINHOOD_CHAIN.id,
      expectedContract: ALLOW,
      verifyingContract: ALLOW,
    });
    expect(decision.allowed).toBe(true);
  });

  it('rejects mismatched chain', () => {
    const decision = validateOrderDomain({
      expectedChainId: ROBINHOOD_CHAIN.id,
      domainChainId: 1,
      expectedContract: ALLOW,
      verifyingContract: ALLOW,
    });
    expect(decision.allowed).toBe(false);
  });
});
