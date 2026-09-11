'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { Drawer } from '@/components/ui/Drawer';
import type { Token } from '@/lib/market';

export function ListDrawer({
  open,
  onClose,
  token,
}: {
  open: boolean;
  onClose: () => void;
  token: Token | null;
}) {
  const { address, isConnected } = useAccount();
  const [price, setPrice] = useState('500');
  const [durationDays, setDurationDays] = useState(7);
  const [review, setReview] = useState<{
    price: string;
    marketplaceFee: string;
    openseaComparison: string;
    sellerReceives: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const prepare = async () => {
    if (!token || !address) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/trade/list/prepare', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          offerer: address,
          tokenId: token.tokenId,
          priceUsdg: price,
          durationSeconds: durationDays * 24 * 60 * 60,
        }),
      });
      const body = (await res.json()) as { review?: typeof review; message?: string };
      if (!res.ok || !body.review) throw new Error(body.message ?? 'Could not prepare listing');
      setReview(body.review);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not prepare listing');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer open={open} onClose={onClose} title={token ? `List #${token.tokenId}` : 'List NFT'} width="md">
      {!token ? (
        <p className="text-sm text-[var(--color-text-secondary)]">Select a Button Presser you own.</p>
      ) : !isConnected ? (
        <p className="text-sm text-[var(--color-text-secondary)]">Connect a wallet to list natively on Net Vision.</p>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-[var(--color-text-secondary)]">
            Native Net Vision listing. Settlement is Seaport. Marketplace fee is 0.5% versus OpenSea’s typical 1%.
          </p>
          <label className="flex flex-col gap-1 text-sm">
            Price (USDG)
            <input
              value={price}
              onChange={(e) => {
                setPrice(e.target.value);
                setReview(null);
              }}
              className="h-10 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-2)] px-3"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Duration (days)
            <input
              type="number"
              min={1}
              max={90}
              value={durationDays}
              onChange={(e) => {
                setDurationDays(Number(e.target.value));
                setReview(null);
              }}
              className="h-10 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-2)] px-3"
            />
          </label>
          {review ? (
            <dl className="flex flex-col gap-2 rounded-[14px] border border-[var(--color-border-subtle)] p-3 text-sm">
              <div className="flex justify-between"><dt>Price</dt><dd className="text-numeral">{review.price}</dd></div>
              <div className="flex justify-between"><dt>Net Vision fee</dt><dd className="text-numeral">{review.marketplaceFee}</dd></div>
              <div className="flex justify-between"><dt>You receive</dt><dd className="text-numeral">{review.sellerReceives}</dd></div>
              <p className="text-[11px] text-[var(--color-text-tertiary)]">{review.openseaComparison}</p>
            </dl>
          ) : null}
          {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
          <button type="button" className="nv-button" disabled={loading} onClick={() => void prepare()}>
            {loading ? 'Preparing…' : review ? 'Refresh review' : 'Review listing'}
          </button>
          {review ? (
            <p className="text-[11px] text-[var(--color-text-tertiary)]">
              Signing and persistence land next: the server already owns recipients and the 0.5% split. Wallet typed-data
              signing is not live in this slice.
            </p>
          ) : null}
        </div>
      )}
    </Drawer>
  );
}
