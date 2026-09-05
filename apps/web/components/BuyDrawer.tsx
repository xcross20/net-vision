'use client';

import { useState } from 'react';
import { useAccount, useSendTransaction } from 'wagmi';
import { motion, AnimatePresence } from 'framer-motion';
import { formatPrice } from '@net-vision/ui';
import { CloseIcon, SpinnerIcon, WarnIcon } from '@/components/icons';

type PrepareResponse = {
  listing?: {
    orderHash: string;
    protocolAddress: string;
    maker: string;
    currency: string;
    price: { current: string | number; decimals: number; currency?: string };
    validUntil: string | number | null;
  };
  transaction?: { to: string; data?: string; value?: string };
  error?: string;
  reason?: string;
};

type Phase =
  | { phase: 'idle' }
  | { phase: 'preparing' }
  | { phase: 'ready'; data: PrepareResponse }
  | { phase: 'signing' }
  | { phase: 'sent'; hash: string }
  | { phase: 'error'; message: string };

export function BuyDrawer({
  tokenId,
  imageUrl,
  fallbackPrice,
  onClose,
}: {
  tokenId: string;
  imageUrl: string;
  fallbackPrice: string | null;
  onClose: () => void;
}) {
  const { address, isConnected } = useAccount();
  const { sendTransactionAsync, isPending } = useSendTransaction();
  const [state, setState] = useState<Phase>({ phase: 'idle' });

  const prepare = async () => {
    if (!address) return;
    setState({ phase: 'preparing' });
    try {
      const res = await fetch('/api/trade/buy/prepare', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tokenId, buyerAddress: address }),
      });
      const data = (await res.json()) as PrepareResponse;
      if (!res.ok) {
        setState({
          phase: 'error',
          message: data.error ?? `request failed: ${res.status}`,
        });
        return;
      }
      setState({ phase: 'ready', data });
    } catch (err) {
      setState({
        phase: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const sign = async () => {
    if (state.phase !== 'ready' || !state.data.transaction) return;
    const tx = state.data.transaction;
    setState({ phase: 'signing' });
    try {
      const hash = await sendTransactionAsync({
        to: tx.to as `0x${string}`,
        data: (tx.data ?? '0x') as `0x${string}`,
        value: tx.value ? BigInt(tx.value) : BigInt(0),
      });
      setState({ phase: 'sent', hash });
    } catch (err) {
      setState({
        phase: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(4,9,7,0.7)] backdrop-blur-sm p-0 md:items-center md:p-4"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        role="dialog"
        aria-modal="true"
        aria-label={`Buy token ${tokenId}`}
      >
        <motion.div
          className="nv-panel w-full max-w-lg flex flex-col gap-5 rounded-t-2xl p-6 md:rounded-md"
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ type: 'spring', stiffness: 200, damping: 26 }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-2">
              <span className="nv-eyebrow">Buy</span>
              <h2 className="text-base font-semibold tracking-tight">Button Presser</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="nv-icon-btn"
              aria-label="Close"
            >
              <CloseIcon size={14} />
            </button>
          </div>

          <div className="flex items-center gap-4">
            <div className="aspect-square w-20 overflow-hidden rounded-md bg-[var(--nv-panel-elevated)]">
              <img src={imageUrl} alt={`#${tokenId}`} className="h-full w-full object-cover" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="nv-label">Token</span>
              <span className="nv-numeral text-2xl font-semibold">#{tokenId}</span>
              <span className="text-xs text-[var(--nv-muted)]">
                Fallback price:{' '}
                <span className="nv-mono">
                  {formatPrice(fallbackPrice ? Number.parseFloat(fallbackPrice) : null)}
                </span>
              </span>
            </div>
          </div>

          {!isConnected ? (
            <div className="nv-panel-soft p-4 text-sm text-[var(--nv-muted)]">
              Connect your wallet to continue.
            </div>
          ) : state.phase === 'idle' ? (
            <motion.button
              type="button"
              onClick={prepare}
              className="nv-button w-full"
              whileTap={{ scale: 0.98 }}
            >
              Look up best ask
            </motion.button>
          ) : state.phase === 'preparing' ? (
            <PhaseRow icon={<SpinnerIcon className="animate-spin" size={14} />}>
              Looking up best ask on OpenSea…
            </PhaseRow>
          ) : state.phase === 'ready' ? (
            <ReviewPanel data={state.data} onSign={sign} isPending={isPending} />
          ) : state.phase === 'signing' ? (
            <PhaseRow icon={<SpinnerIcon className="animate-spin" size={14} />}>
              Confirm the transaction in your wallet…
            </PhaseRow>
          ) : state.phase === 'sent' ? (
            <div className="nv-panel-soft border border-[rgba(116,240,167,0.4)] p-4 text-sm">
              <div className="nv-label">Submitted</div>
              <div className="nv-mono mt-1 break-all text-[var(--nv-green)]">{state.hash}</div>
            </div>
          ) : (
            <div className="nv-danger-banner flex items-start gap-2 text-sm">
              <WarnIcon size={16} weight="duotone" />
              <span>{state.message}</span>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function PhaseRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-sm text-[var(--nv-muted)]">
      {icon}
      <span>{children}</span>
    </div>
  );
}

function ReviewPanel({
  data,
  onSign,
  isPending,
}: {
  data: PrepareResponse;
  onSign: () => void;
  isPending: boolean;
}) {
  const price =
    data.listing?.price?.current !== undefined
      ? Number.parseFloat(String(data.listing.price.current)) /
        10 ** (data.listing.price.decimals ?? 0)
      : null;
  return (
    <div className="flex flex-col gap-4">
      <dl className="nv-panel-soft divide-y divide-[var(--nv-border)] p-4 text-sm">
        <Field label="Price" value={formatPrice(price)} strong />
        <Field
          label="Seller"
          value={
            <span className="nv-mono text-xs">
              {data.listing?.maker ? `${data.listing.maker.slice(0, 6)}…${data.listing.maker.slice(-4)}` : '—'}
            </span>
          }
        />
        <Field
          label="Protocol"
          value={
            <span className="nv-mono text-xs">
              {data.listing?.protocolAddress ? `${data.listing.protocolAddress.slice(0, 10)}…` : '—'}
            </span>
          }
        />
        <Field
          label="Order hash"
          value={
            <span className="nv-mono text-xs">
              {data.listing?.orderHash ? `${data.listing.orderHash.slice(0, 10)}…` : '—'}
            </span>
          }
        />
      </dl>
      <p className="text-xs leading-relaxed text-[var(--nv-muted)]">
        Net Vision validates every executable transaction against the policy engine before your
        wallet sees it. You sign with your own wallet; we never sign on your behalf.
      </p>
      <motion.button
        type="button"
        onClick={onSign}
        disabled={isPending}
        className="nv-button w-full"
        whileTap={{ scale: 0.98 }}
      >
        {isPending ? 'Awaiting wallet…' : 'Sign and submit'}
      </motion.button>
    </div>
  );
}

function Field({
  label,
  value,
  strong,
}: {
  label: string;
  value: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
      <dt className="text-[var(--nv-muted)]">{label}</dt>
      <dd className={strong ? 'font-semibold nv-mono' : 'text-[var(--nv-text)]'}>{value}</dd>
    </div>
  );
}