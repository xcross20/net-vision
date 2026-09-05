'use client';

import { useState } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { motion, AnimatePresence } from 'framer-motion';
import { CloseIcon, WalletIcon } from '@/components/icons';

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connectors, connect, status, error } = useConnect();
  const { disconnect } = useDisconnect();
  const [open, setOpen] = useState(false);

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        <span className="nv-chip nv-chip-strong">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--nv-green)]" />
          {shortenAddress(address)}
        </span>
        <button
          type="button"
          onClick={() => disconnect()}
          className="nv-icon-btn"
          aria-label="Disconnect wallet"
          title="Disconnect"
        >
          <CloseIcon size={14} />
        </button>
      </div>
    );
  }

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        className="nv-button nv-button-ghost"
        whileTap={{ scale: 0.97 }}
      >
        <WalletIcon size={14} weight="duotone" />
        Connect
      </motion.button>
      <AnimatePresence>
        {open ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(4,9,7,0.7)] backdrop-blur-sm p-4"
            onClick={() => setOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Connect wallet"
              className="nv-panel w-full max-w-md flex flex-col gap-5 p-6"
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
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="nv-icon-btn"
                  aria-label="Close"
                >
                  <CloseIcon size={14} />
                </button>
              </div>
              <p className="text-sm leading-relaxed text-[var(--nv-muted)]">
                Net Vision is non-custodial. You sign every transaction with your own wallet;
                we never see your seed phrase or private key.
              </p>
              <div className="flex flex-col gap-2">
                {connectors.map((c) => (
                  <motion.button
                    key={c.uid}
                    type="button"
                    onClick={() => {
                      connect({ connector: c });
                      setOpen(false);
                    }}
                    disabled={status === 'pending'}
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    className="nv-button nv-button-ghost justify-between"
                  >
                    <span>{c.name}</span>
                    <span className="text-[10px] uppercase tracking-wider text-[var(--nv-muted)]">
                      Connect
                    </span>
                  </motion.button>
                ))}
              </div>
              {error ? (
                <div className="nv-danger-banner text-sm">{error.message}</div>
              ) : null}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

function shortenAddress(addr: string): string {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}