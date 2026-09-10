'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ROBINHOOD_CHAIN, ROBINHOOD_CHAIN_ID_HEX } from '@net-vision/chain-config';
import { CloseIcon, SpinnerIcon, WarnIcon } from '@/components/icons';
import { NETWORK_ERROR_COPY, type NetworkErrorCode } from '@/lib/wallet/network-errors';
import {
  friendlyChainName,
  wagmiAddEthereumChainParameter,
  type NetworkGateKind,
} from '@/lib/wallet/network-gate';

export function RobinhoodNetworkGate({
  open,
  kind,
  walletChainId,
  errorCode,
  onPrimary,
  onCancel,
}: {
  open: boolean;
  kind: NetworkGateKind;
  walletChainId: number | undefined;
  errorCode: NetworkErrorCode | null;
  onPrimary: () => void;
  onCancel: () => void;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const busy = kind === 'SWITCHING' || kind === 'ADDING_NETWORK';
  const needsAdd = kind === 'NETWORK_NOT_CONFIGURED' || errorCode === 'CHAIN_NOT_CONFIGURED';
  const current = friendlyChainName(walletChainId);
  const params = wagmiAddEthereumChainParameter();
  const rejected = kind === 'USER_REJECTED';

  const title = needsAdd ? 'Add Robinhood Chain' : 'Switch to Robinhood Chain';
  const body = needsAdd
    ? NETWORK_ERROR_COPY.CHAIN_NOT_CONFIGURED
    : rejected
      ? NETWORK_ERROR_COPY.SWITCH_REJECTED
      : 'Net Vision transactions use Robinhood Chain. Your wallet is currently connected to another network.';
  const primary = busy
    ? kind === 'ADDING_NETWORK'
      ? 'Adding network…'
      : 'Switching…'
    : needsAdd
      ? 'Add & Switch'
      : 'Switch to Robinhood Chain';

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-[rgba(4,9,7,0.72)] p-0 backdrop-blur-sm sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="nv-network-gate-title"
            className="nv-panel flex w-full max-w-md flex-col gap-5 rounded-t-[var(--radius-lg)] p-6 sm:rounded-[var(--radius-md)]"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ type: 'spring', stiffness: 240, damping: 28 }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <WarnIcon size={18} weight="duotone" className="mt-0.5 text-[var(--color-warning)]" />
                <h2 id="nv-network-gate-title" className="text-base font-semibold tracking-tight">
                  {title}
                </h2>
              </div>
              <button type="button" onClick={onCancel} className="nv-icon-btn" aria-label="Cancel">
                <CloseIcon size={14} />
              </button>
            </div>

            <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">{body}</p>

            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[13px]">
              <dt className="text-[var(--color-text-tertiary)]">You're on</dt>
              <dd className="text-numeral text-[var(--color-text-primary)]">{current}</dd>
              <dt className="text-[var(--color-text-tertiary)]">Required</dt>
              <dd className="text-[var(--color-text-primary)]">
                {ROBINHOOD_CHAIN.name} · {ROBINHOOD_CHAIN.id}
              </dd>
            </dl>

            {errorCode === 'UNKNOWN_NETWORK_ERROR' || kind === 'ERROR' ? (
              <p className="text-[12px] text-[var(--color-danger)]">{NETWORK_ERROR_COPY.UNKNOWN_NETWORK_ERROR}</p>
            ) : null}

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={onPrimary}
                disabled={busy}
                className="nv-button w-full"
              >
                {busy ? <SpinnerIcon className="animate-spin" size={14} /> : null}
                {primary}
              </button>
              <button type="button" onClick={onCancel} className="nv-button-ghost w-full">
                Cancel
              </button>
            </div>

            <div>
              <button
                type="button"
                onClick={() => setDetailsOpen((v) => !v)}
                className="text-[12px] text-[var(--color-text-tertiary)] underline-offset-2 hover:text-[var(--color-text-primary)] hover:underline"
              >
                {detailsOpen ? 'Hide network details' : 'View network details'}
              </button>
              {detailsOpen ? (
                <dl className="mt-3 grid grid-cols-[7.5rem_1fr] gap-y-1.5 text-[12px] text-[var(--color-text-secondary)]">
                  <dt>Network</dt>
                  <dd>{params.chainName}</dd>
                  <dt>Chain ID</dt>
                  <dd className="text-numeral">
                    {ROBINHOOD_CHAIN.id} ({ROBINHOOD_CHAIN_ID_HEX})
                  </dd>
                  <dt>Currency</dt>
                  <dd>
                    {params.nativeCurrency.symbol} · {params.nativeCurrency.decimals} decimals
                  </dd>
                  <dt>RPC</dt>
                  <dd className="break-all">{params.rpcUrls[0]?.replace(/^https:\/\//, '')}</dd>
                  <dt>Explorer</dt>
                  <dd className="break-all">
                    {params.blockExplorerUrls[0]?.replace(/^https:\/\//, '')}
                  </dd>
                </dl>
              ) : null}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
