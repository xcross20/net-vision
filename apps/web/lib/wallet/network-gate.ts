/**
 * Pure Robinhood network-gate authority. No React, no wagmi.
 * UI and hooks must classify through these functions.
 */
import {
  ROBINHOOD_CHAIN,
  ROBINHOOD_CHAIN_ID_HEX,
  robinhoodAddEthereumChainParameter,
} from '@net-vision/chain-config';
import { NetworkGateError } from './network-errors';

export type NetworkGateKind =
  | 'DISCONNECTED'
  | 'CORRECT_NETWORK'
  | 'WRONG_NETWORK'
  | 'SWITCHING'
  | 'NETWORK_NOT_CONFIGURED'
  | 'ADDING_NETWORK'
  | 'USER_REJECTED'
  | 'UNSUPPORTED_WALLET'
  | 'ERROR';

/** Display names for a few well-known non-Robinhood chains. Not executable. */
const KNOWN_CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  10: 'Optimism',
  56: 'BNB Smart Chain',
  137: 'Polygon',
  369: 'PulseChain',
  8453: 'Base',
  42161: 'Arbitrum One',
  11155111: 'Sepolia',
};

export const CHAIN_SENSITIVE_CHECKOUT_FIELDS = [
  'usdgBalance',
  'usdgAllowance',
  'paymentQuote',
  'swapQuote',
  'swapSimulation',
  'purchasePrepare',
  'purchaseSimulation',
  'approvalStatus',
] as const;

export type ChainSensitiveCheckoutField = (typeof CHAIN_SENSITIVE_CHECKOUT_FIELDS)[number];

export function classifyConnectedChain(input: {
  connected: boolean;
  chainId: number | undefined | null;
}): NetworkGateKind {
  if (!input.connected) return 'DISCONNECTED';
  if (input.chainId === ROBINHOOD_CHAIN.id) return 'CORRECT_NETWORK';
  return 'WRONG_NETWORK';
}

export function isRobinhoodChainId(chainId: number | undefined | null): chainId is typeof ROBINHOOD_CHAIN.id {
  return chainId === ROBINHOOD_CHAIN.id;
}

export function friendlyChainName(chainId: number | undefined | null): string {
  if (chainId == null) return 'Unknown network';
  if (chainId === ROBINHOOD_CHAIN.id) return ROBINHOOD_CHAIN.name;
  return KNOWN_CHAIN_NAMES[chainId] ?? `Network ${chainId}`;
}

export function wagmiAddEthereumChainParameter(): {
  chainName: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  rpcUrls: string[];
  blockExplorerUrls: string[];
} {
  const canonical = robinhoodAddEthereumChainParameter();
  return {
    chainName: canonical.chainName,
    nativeCurrency: {
      name: canonical.nativeCurrency.name,
      symbol: canonical.nativeCurrency.symbol,
      decimals: canonical.nativeCurrency.decimals,
    },
    rpcUrls: [...canonical.rpcUrls],
    blockExplorerUrls: [...canonical.blockExplorerUrls],
  };
}

export function assertExecutableRobinhoodChain(
  chainId: number | undefined | null,
): asserts chainId is typeof ROBINHOOD_CHAIN.id {
  if (!isRobinhoodChainId(chainId)) {
    throw new NetworkGateError('WRONG_NETWORK', {
      fromChainId: chainId ?? null,
      targetChainId: ROBINHOOD_CHAIN.id,
    });
  }
}

/** Read the wallet's live chain. Do not trust a stale React `chainId` after switch. */
export async function assertCurrentExecutableChain(
  getChainId: () => Promise<number>,
): Promise<void> {
  const id = await getChainId();
  assertExecutableRobinhoodChain(id);
}

export async function assertWalletOnRobinhood(input: {
  getChainId?: () => Promise<number>;
  chainId?: number | null;
}): Promise<void> {
  if (input.getChainId) {
    await assertCurrentExecutableChain(input.getChainId);
    return;
  }
  assertExecutableRobinhoodChain(input.chainId);
}

export function shouldInvalidateChainSensitiveState(
  previousChainId: number | undefined | null,
  nextChainId: number | undefined | null,
): boolean {
  if (previousChainId == null && nextChainId == null) return false;
  return previousChainId !== nextChainId;
}

/**
 * Executable checkout phases must not keep a prepared tx / allowance
 * after the wallet leaves 4663. Cart item identity is preserved.
 */
export function checkoutPhaseAfterChainChange(phaseKind: string): 'browsing' | 'unchanged' | 'network_required' {
  if (phaseKind === 'browsing' || phaseKind === 'complete') return 'unchanged';
  if (phaseKind === 'executing') return 'network_required';
  return 'unchanged';
}

export const ROBINHOOD_SWITCH_CHAIN_ID = ROBINHOOD_CHAIN.id;
export const ROBINHOOD_SWITCH_CHAIN_ID_HEX = ROBINHOOD_CHAIN_ID_HEX;
