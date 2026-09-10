/**
 * Shared Robinhood network-switch authority. Every transaction-capable
 * surface must go through requestNetworkForAction before constructing
 * a wallet mutation.
 */
'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAccount, useSwitchChain } from 'wagmi';
import { ROBINHOOD_CHAIN } from '@net-vision/chain-config';
import { classifyWalletError, type NetworkErrorCode } from './network-errors';
import { recordNetworkGateEvent } from './network-events';
import {
  classifyConnectedChain,
  isRobinhoodChainId,
  wagmiAddEthereumChainParameter,
  type NetworkGateKind,
} from './network-gate';
import { RobinhoodNetworkGate } from '@/components/wallet/RobinhoodNetworkGate';

type Pending = {
  action: string;
  resolve: (ok: boolean) => void;
};

type NetworkGateContextValue = {
  kind: NetworkGateKind;
  connected: boolean;
  walletChainId: number | undefined;
  isRobinhood: boolean;
  connectorType: string | null;
  requestNetworkForAction: (action: string, checkoutState?: string) => Promise<boolean>;
  ensureRobinhoodChain: () => Promise<boolean>;
};

const NetworkGateContext = createContext<NetworkGateContextValue | null>(null);

async function confirmWalletChain(
  getChainId: (() => Promise<number>) | undefined,
  expected: number,
): Promise<boolean> {
  if (!getChainId) return false;
  for (let i = 0; i < 20; i += 1) {
    try {
      const id = await getChainId();
      if (id === expected) return true;
    } catch {
      // Connector may briefly throw during chainChanged; retry.
    }
    await new Promise((r) => setTimeout(r, 75));
  }
  return false;
}

export function NetworkGateProvider({ children }: { children: ReactNode }) {
  const { address, isConnected, chainId, connector } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const [busyKind, setBusyKind] = useState<NetworkGateKind | null>(null);
  const [errorCode, setErrorCode] = useState<NetworkErrorCode | null>(null);
  const [open, setOpen] = useState(false);
  const pendingRef = useRef<Pending | null>(null);

  const snapshot = classifyConnectedChain({ connected: Boolean(isConnected && address), chainId });
  const kind: NetworkGateKind = busyKind ?? (errorCode === 'SWITCH_REJECTED' || errorCode === 'CHAIN_ADD_REJECTED'
    ? 'USER_REJECTED'
    : errorCode === 'CHAIN_NOT_CONFIGURED'
      ? 'NETWORK_NOT_CONFIGURED'
      : errorCode === 'WALLET_SWITCH_UNSUPPORTED'
        ? 'UNSUPPORTED_WALLET'
        : errorCode && snapshot !== 'CORRECT_NETWORK'
          ? 'ERROR'
          : snapshot);

  const connectorType = connector?.type ?? connector?.name ?? null;

  useEffect(() => {
    if (open && isRobinhoodChainId(chainId)) {
      pendingRef.current?.resolve(true);
      pendingRef.current = null;
      setOpen(false);
      setErrorCode(null);
      setBusyKind(null);
    }
  }, [chainId, open]);

  const settle = useCallback((ok: boolean) => {
    pendingRef.current?.resolve(ok);
    pendingRef.current = null;
    if (ok) {
      setOpen(false);
      setErrorCode(null);
      setBusyKind(null);
    }
  }, []);

  const ensureRobinhoodChain = useCallback(async (): Promise<boolean> => {
    if (!isConnected) return false;
    if (isRobinhoodChainId(chainId)) {
      recordNetworkGateEvent('network_switch_succeeded', {
        fromChainId: chainId,
        connectorType,
      });
      return true;
    }
    const fromChainId = chainId ?? null;
    setErrorCode(null);
    setBusyKind('SWITCHING');
    recordNetworkGateEvent('network_switch_requested', { fromChainId, connectorType });
    const addParams = wagmiAddEthereumChainParameter();
    try {
      if (!switchChainAsync) {
        setBusyKind(null);
        setErrorCode('WALLET_SWITCH_UNSUPPORTED');
        recordNetworkGateEvent('network_verification_failed', { fromChainId, connectorType });
        return false;
      }
      try {
        await switchChainAsync({
          chainId: ROBINHOOD_CHAIN.id,
          addEthereumChainParameter: addParams,
        });
      } catch (err) {
        const classified = classifyWalletError(err);
        if (classified !== 'CHAIN_NOT_CONFIGURED') throw err;
        setBusyKind('ADDING_NETWORK');
        recordNetworkGateEvent('network_add_requested', { fromChainId, connectorType });
        await switchChainAsync({
          chainId: ROBINHOOD_CHAIN.id,
          addEthereumChainParameter: addParams,
        });
        recordNetworkGateEvent('network_add_succeeded', { fromChainId, connectorType });
      }
      const confirmed = await confirmWalletChain(
        connector?.getChainId?.bind(connector),
        ROBINHOOD_CHAIN.id,
      );
      if (!confirmed) {
        setBusyKind(null);
        setErrorCode('UNKNOWN_NETWORK_ERROR');
        recordNetworkGateEvent('network_verification_failed', { fromChainId, connectorType });
        return false;
      }
      recordNetworkGateEvent('network_switch_succeeded', { fromChainId, connectorType });
      setBusyKind(null);
      setErrorCode(null);
      return true;
    } catch (err) {
      const classified = classifyWalletError(err);
      setBusyKind(null);
      setErrorCode(classified);
      if (classified === 'SWITCH_REJECTED') {
        recordNetworkGateEvent('network_switch_rejected', { fromChainId, connectorType });
      } else if (classified === 'CHAIN_ADD_REJECTED') {
        recordNetworkGateEvent('network_add_rejected', { fromChainId, connectorType });
      } else if (classified === 'CHAIN_NOT_CONFIGURED') {
        recordNetworkGateEvent('network_add_requested', { fromChainId, connectorType });
      } else {
        recordNetworkGateEvent('network_verification_failed', { fromChainId, connectorType });
      }
      return false;
    }
  }, [chainId, connector, connectorType, isConnected, switchChainAsync]);

  const requestNetworkForAction = useCallback(
    (action: string, checkoutState?: string): Promise<boolean> => {
      if (!isConnected || !address) return Promise.resolve(false);
      if (isRobinhoodChainId(chainId)) return Promise.resolve(true);
      recordNetworkGateEvent('wrong_network_detected', {
        fromChainId: chainId ?? null,
        connectorType,
        checkoutState: checkoutState ?? action,
      });
      setOpen(true);
      setErrorCode(null);
      return new Promise<boolean>((resolve) => {
        pendingRef.current?.resolve(false);
        pendingRef.current = { action, resolve };
      });
    },
    [address, chainId, connectorType, isConnected],
  );

  const onPrimary = useCallback(async () => {
    const ok = await ensureRobinhoodChain();
    if (ok) settle(true);
  }, [ensureRobinhoodChain, settle]);

  const onCancel = useCallback(() => {
    settle(false);
    setOpen(false);
  }, [settle]);

  const value = useMemo<NetworkGateContextValue>(
    () => ({
      kind,
      connected: Boolean(isConnected && address),
      walletChainId: chainId,
      isRobinhood: isRobinhoodChainId(chainId),
      connectorType,
      requestNetworkForAction,
      ensureRobinhoodChain,
    }),
    [address, chainId, connectorType, ensureRobinhoodChain, isConnected, kind, requestNetworkForAction],
  );

  return (
    <NetworkGateContext.Provider value={value}>
      {children}
      <RobinhoodNetworkGate
        open={open}
        kind={kind}
        walletChainId={chainId}
        errorCode={errorCode}
        onPrimary={() => void onPrimary()}
        onCancel={onCancel}
      />
    </NetworkGateContext.Provider>
  );
}

export function useRobinhoodNetworkGate(): NetworkGateContextValue {
  const ctx = useContext(NetworkGateContext);
  if (!ctx) {
    throw new Error('useRobinhoodNetworkGate must be used within NetworkGateProvider');
  }
  return ctx;
}

export function useOptionalRobinhoodNetworkGate(): NetworkGateContextValue | null {
  return useContext(NetworkGateContext);
}


