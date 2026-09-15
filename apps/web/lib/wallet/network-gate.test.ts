import { describe, expect, it } from 'vitest';
import { ROBINHOOD_CHAIN, ROBINHOOD_CHAIN_ID_HEX } from '@net-vision/chain-config';
import {
  checkoutFailureMessage,
  classifyWalletError,
  NetworkGateError,
  userMessageForWalletError,
} from './network-errors';
import { recordNetworkGateEvent, subscribeNetworkGateEvents } from './network-events';
import {
  assertExecutableRobinhoodChain,
  checkoutPhaseAfterChainChange,
  classifyConnectedChain,
  friendlyChainName,
  shouldInvalidateChainSensitiveState,
  wagmiAddEthereumChainParameter,
} from './network-gate';

describe('classifyConnectedChain', () => {
  it('disconnected', () => {
    expect(classifyConnectedChain({ connected: false, chainId: 369 })).toBe('DISCONNECTED');
    expect(classifyConnectedChain({ connected: false, chainId: undefined })).toBe('DISCONNECTED');
  });

  it('already on 4663', () => {
    expect(classifyConnectedChain({ connected: true, chainId: 4663 })).toBe('CORRECT_NETWORK');
  });

  it('wallet on PulseChain 369', () => {
    expect(classifyConnectedChain({ connected: true, chainId: 369 })).toBe('WRONG_NETWORK');
  });

  it('wallet on Ethereum', () => {
    expect(classifyConnectedChain({ connected: true, chainId: 1 })).toBe('WRONG_NETWORK');
  });
});

describe('friendlyChainName', () => {
  it('names Robinhood, PulseChain, and unknown ids', () => {
    expect(friendlyChainName(4663)).toBe('Robinhood Chain');
    expect(friendlyChainName(369)).toBe('PulseChain');
    expect(friendlyChainName(1)).toBe('Ethereum');
    expect(friendlyChainName(999999)).toBe('Network 999999');
  });
});

describe('assertCurrentExecutableChain', () => {
  it('passes when the wallet reports 4663', async () => {
    const { assertCurrentExecutableChain } = await import('./network-gate');
    await expect(assertCurrentExecutableChain(async () => 4663)).resolves.toBeUndefined();
  });

  it('fails when the wallet still reports 369', async () => {
    const { assertCurrentExecutableChain } = await import('./network-gate');
    await expect(assertCurrentExecutableChain(async () => 369)).rejects.toBeInstanceOf(NetworkGateError);
  });
});

describe('assertExecutableRobinhoodChain', () => {
  it('allows 4663', () => {
    expect(() => assertExecutableRobinhoodChain(4663)).not.toThrow();
  });

  it('blocks 369, Ethereum, and missing chain before any tx is built', () => {
    for (const chainId of [369, 1, undefined, null] as const) {
      expect(() => assertExecutableRobinhoodChain(chainId)).toThrow(NetworkGateError);
      try {
        assertExecutableRobinhoodChain(chainId);
      } catch (err) {
        expect(err).toBeInstanceOf(NetworkGateError);
        expect((err as NetworkGateError).code).toBe('WRONG_NETWORK');
        expect((err as NetworkGateError).message).toBe('Switch to Robinhood Chain to continue.');
        expect((err as Error).message).not.toMatch(/Request Arguments|calldata|id: 369/i);
      }
    }
  });
});

describe('classifyWalletError', () => {
  it('maps the live wagmi mismatch dump to WRONG_NETWORK copy', () => {
    const err = new Error(
      'The current chain of the wallet (id: 369) does not match the target chain for the transaction (id: 4663 / Robinhood Chain). Request Arguments: from: 0xabc data: 0xdead',
    );
    err.name = 'ChainMismatchError';
    expect(classifyWalletError(err)).toBe('WRONG_NETWORK');
    expect(userMessageForWalletError(err)).toBe('Switch to Robinhood Chain to continue.');
    expect(userMessageForWalletError(err)).not.toMatch(/Request Arguments/);
  });

  it('does not rewrite listing or prepare failures as network copy', () => {
    expect(checkoutFailureMessage(new Error('Listing gone (sold)'))).toBe('Listing gone (sold)');
    expect(checkoutFailureMessage(new NetworkGateError('WRONG_NETWORK'))).toBe(
      'Switch to Robinhood Chain to continue.',
    );
  });

  it('maps user reject and unknown chain', () => {
    expect(classifyWalletError({ code: 4001, message: 'User rejected the request.' })).toBe(
      'SWITCH_REJECTED',
    );
    expect(classifyWalletError({ code: 4902, message: 'Unrecognized chain ID' })).toBe(
      'CHAIN_NOT_CONFIGURED',
    );
    const unsupported = new Error('wallet does not support programmatic chain switching');
    unsupported.name = 'SwitchChainNotSupportedError';
    expect(classifyWalletError(unsupported)).toBe('WALLET_SWITCH_UNSUPPORTED');
  });
});

describe('chain change invalidation', () => {
  it('invalidates when leaving or joining 4663', () => {
    expect(shouldInvalidateChainSensitiveState(369, 4663)).toBe(true);
    expect(shouldInvalidateChainSensitiveState(4663, 369)).toBe(true);
    expect(shouldInvalidateChainSensitiveState(4663, 4663)).toBe(false);
  });

  it('returns checkout to browsing except complete/browsing', () => {
    expect(checkoutPhaseAfterChainChange('payment_select')).toBe('unchanged');
    expect(checkoutPhaseAfterChainChange('executing')).toBe('network_required');
    expect(checkoutPhaseAfterChainChange('review')).toBe('unchanged');
    expect(checkoutPhaseAfterChainChange('complete')).toBe('unchanged');
    expect(checkoutPhaseAfterChainChange('browsing')).toBe('unchanged');
  });
});

describe('canonical add-chain payload', () => {
  it('does not invent RPC or explorer URLs', () => {
    const params = wagmiAddEthereumChainParameter();
    expect(ROBINHOOD_CHAIN_ID_HEX).toBe('0x1237');
    expect(params.chainName).toBe(ROBINHOOD_CHAIN.name);
    expect(params.rpcUrls).toEqual(['https://rpc.mainnet.chain.robinhood.com']);
    expect(params.blockExplorerUrls).toEqual(['https://robinhoodchain.blockscout.com']);
    expect(params.nativeCurrency.symbol).toBe('ETH');
    expect(params.nativeCurrency.decimals).toBe(18);
  });
});

describe('observability', () => {
  it('records sanitized events without calldata', () => {
    const seen: string[] = [];
    const stop = subscribeNetworkGateEvents((event) => {
      seen.push(event.name);
      expect(event).not.toHaveProperty('data');
      expect(JSON.stringify(event)).not.toMatch(/0xdead|calldata/i);
    });
    recordNetworkGateEvent('wrong_network_detected', {
      fromChainId: 369,
      connectorType: 'injected',
      checkoutState: 'payment_select',
    });
    stop();
    expect(seen).toEqual(['wrong_network_detected']);
  });
});
