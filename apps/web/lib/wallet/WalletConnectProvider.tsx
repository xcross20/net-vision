/**
 * Single wallet-connect modal authority. Header, token page, and cart
 * checkout all open this — never a second connector implementation.
 */
'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useConnect } from 'wagmi';
import { WalletConnectModal } from '@/components/wallet/WalletConnectModal';

type WalletConnectContextValue = {
  openConnectModal: () => void;
  closeConnectModal: () => void;
  isConnectModalOpen: boolean;
};

const WalletConnectContext = createContext<WalletConnectContextValue | null>(null);

export function WalletConnectProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { connectors, connect, status, error } = useConnect();

  const openConnectModal = useCallback(() => setOpen(true), []);
  const closeConnectModal = useCallback(() => setOpen(false), []);

  const value = useMemo(
    () => ({
      openConnectModal,
      closeConnectModal,
      isConnectModalOpen: open,
    }),
    [closeConnectModal, open, openConnectModal],
  );

  return (
    <WalletConnectContext.Provider value={value}>
      {children}
      <WalletConnectModal
        open={open}
        onClose={closeConnectModal}
        connectors={connectors}
        status={status}
        error={error?.message ?? null}
        onConnect={(connector) => {
          connect({ connector });
          closeConnectModal();
        }}
      />
    </WalletConnectContext.Provider>
  );
}

export function useWalletConnectModal(): WalletConnectContextValue {
  const ctx = useContext(WalletConnectContext);
  if (!ctx) {
    throw new Error('useWalletConnectModal must be used within WalletConnectProvider');
  }
  return ctx;
}
