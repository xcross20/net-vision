'use client';

import { AnimatePresence, motion } from 'framer-motion';
import type { Connector } from 'wagmi';
import { CloseIcon, WalletIcon } from '@/components/icons';

export function WalletConnectModal({
  open,
  onClose,
  connectors,
  onConnect,
  status,
  error,
}: {
  open: boolean;
  onClose: () => void;
  connectors: readonly Connector[];
  onConnect: (connector: Connector) => void;
  status: 'idle' | 'pending' | 'success' | 'error';
  error: string | null;
}) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-[rgba(4,9,7,0.72)] p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Connect wallet"
            className="nv-panel flex w-full max-w-md flex-col gap-5 rounded-t-[var(--radius-lg)] p-6 sm:rounded-[var(--radius-md)]"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 220, damping: 26 }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <WalletIcon size={18} weight="duotone" />
                <h2 className="text-base font-semibold tracking-tight">Connect a wallet</h2>
              </div>
              <button type="button" onClick={onClose} className="nv-icon-btn" aria-label="Close">
                <CloseIcon size={14} />
              </button>
            </div>
            <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
              Net Vision is non-custodial. You sign every transaction with your own wallet;
              we never see your seed phrase or private key. Your cart stays on this device.
            </p>
            <div className="flex flex-col gap-2">
              {connectors.map((c) => (
                <button
                  key={c.uid}
                  type="button"
                  onClick={() => onConnect(c)}
                  disabled={status === 'pending'}
                  className="nv-button nv-button-ghost justify-between"
                >
                  <span>{c.name}</span>
                  <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]">
                    Connect
                  </span>
                </button>
              ))}
            </div>
            {error ? <div className="nv-danger-banner text-sm">{error}</div> : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
