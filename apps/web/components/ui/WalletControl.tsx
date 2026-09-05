'use client';

import { useState } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, X, CaretDown, CheckCircle } from '@phosphor-icons/react/dist/ssr';
import { cn } from '@/lib/cn';
import { address } from '@/lib/format';
import { LiveIndicator } from './LiveIndicator';

export function WalletControl() {
  const { address: addr, isConnected } = useAccount();
  const { connectors, connect, status, error } = useConnect();
  const { disconnect } = useDisconnect();
  const [openModal, setOpenModal] = useState(false);
  const [openMenu, setOpenMenu] = useState(false);

  if (!isConnected) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpenModal(true)}
          className="nv-button ml-1 hidden md:inline-flex"
        >
          <Wallet size={14} weight="bold" />
          Connect Wallet
        </button>
        <button
          type="button"
          onClick={() => setOpenModal(true)}
          aria-label="Connect wallet"
          className="nv-icon-btn md:hidden"
        >
          <Wallet size={16} weight="bold" />
        </button>
        <ConnectModal
          open={openModal}
          onClose={() => setOpenModal(false)}
          connectors={connectors}
          onConnect={(c) => {
            connect({ connector: c });
            setOpenModal(false);
          }}
          status={status}
          error={error?.message ?? null}
        />
      </>
    );
  }

  return (
    <div className="relative ml-1">
      <button
        type="button"
        onClick={() => setOpenMenu((v) => !v)}
        className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] px-3 text-sm transition-colors hover:border-[var(--color-border-default)]"
      >
        <LiveIndicator tone="green" size={6} />
        <span className="text-numeral text-[13px] text-[var(--color-text-primary)]">
          {address(addr ?? '')}
        </span>
        <CaretDown size={11} weight="bold" className="text-[var(--color-text-secondary)]" />
      </button>
      <AnimatePresence>
        {openMenu ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 top-[calc(100%+8px)] z-40 w-64 overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] p-1 shadow-[0_18px_48px_-24px_rgba(0,0,0,0.65)]"
          >
            <div className="px-3 py-2 text-label">Account</div>
            <div className="flex items-center gap-2 px-3 py-2 text-numeral text-xs text-[var(--color-text-secondary)]">
              <CheckCircle size={12} weight="duotone" className="text-[var(--color-net-green)]" />
              {address(addr ?? '')}
            </div>
            <div className="my-1 h-px bg-[var(--color-border-subtle)]" />
            <button
              type="button"
              onClick={() => {
                disconnect();
                setOpenMenu(false);
              }}
              className="flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-left text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
            >
              Disconnect
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function ConnectModal({
  open,
  onClose,
  connectors,
  onConnect,
  status,
  error,
}: {
  open: boolean;
  onClose: () => void;
  connectors: ReturnType<typeof useConnect>['connectors'];
  onConnect: (c: ReturnType<typeof useConnect>['connectors'][number]) => void;
  status: ReturnType<typeof useConnect>['status'];
  error: string | null;
}) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(5,9,8,0.72)] backdrop-blur-sm md:items-center"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          role="dialog"
          aria-modal="true"
          aria-label="Connect wallet"
        >
          <motion.div
            className={cn(
              'w-full max-w-md overflow-hidden rounded-t-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] md:rounded-[var(--radius-lg)]',
            )}
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ type: 'spring', stiffness: 220, damping: 26 }}
          >
            <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] px-5 py-4">
              <div className="flex items-center gap-2">
                <Wallet size={16} weight="duotone" className="text-[var(--color-net-green)]" />
                <h2 className="text-base font-semibold tracking-tight">Connect a wallet</h2>
              </div>
              <button type="button" onClick={onClose} className="nv-icon-btn" aria-label="Close">
                <X size={14} weight="bold" />
              </button>
            </div>
            <div className="px-5 py-5">
              <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
                Net Vision is non-custodial. You sign every transaction with your own wallet;
                we never see your seed phrase or private key.
              </p>
              <div className="mt-4 flex flex-col gap-2">
                {connectors.map((c) => (
                  <button
                    key={c.uid}
                    type="button"
                    onClick={() => onConnect(c)}
                    disabled={status === 'pending'}
                    className="nv-button nv-button-ghost justify-between"
                  >
                    <span>{c.name}</span>
                    <span className="text-numeral text-[11px] text-[var(--color-text-tertiary)]">
                      {status === 'pending' ? 'Connecting...' : 'Continue'}
                    </span>
                  </button>
                ))}
              </div>
              {error ? <div className="nv-danger-banner mt-4 text-sm">{error}</div> : null}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}