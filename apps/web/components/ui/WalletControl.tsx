'use client';

import { useState } from 'react';
import { useAccount, useDisconnect } from 'wagmi';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, CaretDown, CheckCircle } from '@phosphor-icons/react/dist/ssr';
import { address } from '@/lib/format';
import { LiveIndicator } from './LiveIndicator';
import { useWalletConnectModal } from '@/lib/wallet/WalletConnectProvider';

export function WalletControl() {
  const { address: addr, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { openConnectModal } = useWalletConnectModal();
  const [openMenu, setOpenMenu] = useState(false);

  if (!isConnected) {
    return (
      <>
        <button
          type="button"
          onClick={() => openConnectModal()}
          className="nv-button ml-1 hidden md:inline-flex"
        >
          <Wallet size={14} weight="bold" />
          Connect Wallet
        </button>
        <button
          type="button"
          onClick={() => openConnectModal()}
          aria-label="Connect wallet"
          className="nv-icon-btn md:hidden"
        >
          <Wallet size={16} weight="bold" />
        </button>
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
            <a
              href="/portfolio"
              className="flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-left text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
            >
              Portfolio
            </a>
            <a
              href="/profile"
              className="flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-left text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
            >
              Profile & settings
            </a>
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