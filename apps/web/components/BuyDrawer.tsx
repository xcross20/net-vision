'use client';

import { useState } from 'react';
import { useAccount, useSendTransaction } from 'wagmi';
import { formatPrice } from '@net-vision/ui';

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
  const [state, setState] = useState<
    | { phase: 'idle' }
    | { phase: 'preparing' }
    | { phase: 'ready'; data: PrepareResponse }
    | { phase: 'signing' }
    | { phase: 'sent'; hash: string }
    | { phase: 'error'; message: string }
  >({ phase: 'idle' });

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
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="nv-panel w-full max-w-lg flex flex-col gap-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Buy #{tokenId}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--nv-muted)] hover:text-[var(--nv-text)]"
          >
            ✕
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="aspect-square w-20 bg-[var(--nv-panel-elevated)] overflow-hidden">
            <img src={imageUrl} alt={`#${tokenId}`} className="w-full h-full object-cover" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wider text-[var(--nv-muted)]">
              Button Presser
            </span>
            <span className="text-2xl font-semibold nv-mono">#{tokenId}</span>
            <span className="text-xs text-[var(--nv-muted)]">
              Fallback price: {formatPrice(fallbackPrice ? Number.parseFloat(fallbackPrice) : null)}
            </span>
          </div>
        </div>

        {!isConnected ? (
          <div className="border border-[var(--nv-border)] rounded-md p-3 text-sm text-[var(--nv-muted)]">
            Connect your wallet to continue.
          </div>
        ) : state.phase === 'idle' ? (
          <button type="button" onClick={prepare} className="nv-button">
            Look up best ask
          </button>
        ) : state.phase === 'preparing' ? (
          <div className="text-sm text-[var(--nv-muted)]">Looking up best ask on OpenSea…</div>
        ) : state.phase === 'ready' ? (
          <ReviewPanel data={state.data} onSign={sign} isPending={isPending} />
        ) : state.phase === 'signing' ? (
          <div className="text-sm text-[var(--nv-muted)]">
            Confirm the transaction in your wallet…
          </div>
        ) : state.phase === 'sent' ? (
          <div className="border border-[var(--nv-green)] rounded-md p-3 text-sm">
            Submitted. Tx hash:{' '}
            <span className="nv-mono text-[var(--nv-green)]">{state.hash}</span>
          </div>
        ) : (
          <div className="border border-[var(--nv-danger)] rounded-md p-3 text-sm text-[var(--nv-danger)]">
            {state.message}
          </div>
        )}
      </div>
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
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 border border-[var(--nv-border)] rounded-md p-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-[var(--nv-muted)]">Price</span>
          <span className="font-semibold">{formatPrice(price)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[var(--nv-muted)]">Seller</span>
          <span className="nv-mono text-xs">
            {data.listing?.maker?.slice(0, 6)}…{data.listing?.maker?.slice(-4)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[var(--nv-muted)]">Protocol</span>
          <span className="nv-mono text-xs">{data.listing?.protocolAddress?.slice(0, 10)}…</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[var(--nv-muted)]">Order hash</span>
          <span className="nv-mono text-xs">{data.listing?.orderHash?.slice(0, 10)}…</span>
        </div>
      </div>
      <div className="text-xs text-[var(--nv-muted)]">
        Net Vision validates every executable transaction against the policy engine before your
        wallet sees it. You sign with your own wallet; we never sign on your behalf.
      </div>
      <button
        type="button"
        onClick={onSign}
        disabled={isPending}
        className="nv-button"
      >
        {isPending ? 'Awaiting wallet…' : 'Sign and submit'}
      </button>
    </div>
  );
}
