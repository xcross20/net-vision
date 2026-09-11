'use client';

import { useState } from 'react';
import { useAccount, useSignTypedData } from 'wagmi';
import { Drawer } from '@/components/ui/Drawer';
import { parseUsdgDecimalToRaw } from '@/lib/native-market/fees';

export function MakeOfferDrawer({
  open,
  onClose,
  tokenId,
}: {
  open: boolean;
  onClose: () => void;
  tokenId: string;
}) {
  const { address, isConnected } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  const [amount, setAmount] = useState('10');
  const [hours, setHours] = useState(24);
  const [review, setReview] = useState<Record<string, string> | null>(null);
  const [offerId, setOfferId] = useState<string | null>(null);
  const [typedData, setTypedData] = useState<null | Parameters<typeof signTypedDataAsync>[0]>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const prepare = async () => {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/offers/prepare', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          buyerAddress: address,
          tokenId,
          collectionId: 'button-presser',
          ecosystemId: 'helix',
          offerUsdgRaw: parseUsdgDecimalToRaw(amount).toString(),
          expirationSeconds: hours * 3600,
          balanceUsdgRaw: parseUsdgDecimalToRaw(amount).toString(),
        }),
      });
      const body = (await res.json()) as {
        offerId?: string;
        review?: Record<string, string>;
        typedData?: Parameters<typeof signTypedDataAsync>[0];
        message?: string;
      };
      if (!res.ok || !body.offerId || !body.typedData) {
        throw new Error(body.message ?? 'Could not prepare offer');
      }
      setOfferId(body.offerId);
      setReview(body.review ?? null);
      setTypedData(body.typedData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'prepare failed');
    } finally {
      setLoading(false);
    }
  };

  const signAndSubmit = async () => {
    if (!address || !offerId || !typedData) return;
    setLoading(true);
    setError(null);
    try {
      const signature = await signTypedDataAsync(typedData);
      const res = await fetch('/api/offers/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ offerId, buyerAddress: address, signature }),
      });
      const body = (await res.json()) as { status?: string; message?: string };
      if (!res.ok) throw new Error(body.message ?? 'submit failed');
      setStatus(body.status ?? 'ACTIVE');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'sign failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer open={open} onClose={onClose} title={`Offer on #${tokenId}`} width="md">
      {!isConnected ? (
        <p className="text-sm text-[var(--color-text-secondary)]">Connect a wallet to make a native USDG offer.</p>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-[var(--color-text-secondary)]">
            Native Net Vision bid. Buyer signs a Seaport offer. Seller acceptance still requires a successful
            on-chain receipt before the offer is marked filled.
          </p>
          <label className="flex flex-col gap-1 text-sm">
            Offer (USDG)
            <input
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setReview(null);
                setOfferId(null);
              }}
              className="h-10 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-2)] px-3"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Expiration (hours)
            <input
              type="number"
              min={1}
              max={2160}
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
              className="h-10 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-2)] px-3"
            />
          </label>
          {review ? (
            <dl className="flex flex-col gap-2 rounded-[14px] border border-[var(--color-border-subtle)] p-3 text-sm">
              <div className="flex justify-between"><dt>Offer</dt><dd className="text-numeral">{review.offer}</dd></div>
              <div className="flex justify-between"><dt>Net Vision fee</dt><dd className="text-numeral">{review.marketplaceFee}</dd></div>
              <div className="flex justify-between"><dt>Seller receives</dt><dd className="text-numeral">{review.sellerReceives}</dd></div>
            </dl>
          ) : null}
          {status ? <p className="text-sm text-[var(--color-net-green)]">Offer {status}.</p> : null}
          {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
          {!offerId ? (
            <button type="button" className="nv-button" disabled={loading} onClick={() => void prepare()}>
              {loading ? 'Preparing…' : 'Review offer'}
            </button>
          ) : (
            <button type="button" className="nv-button" disabled={loading || Boolean(status)} onClick={() => void signAndSubmit()}>
              {loading ? 'Signing…' : 'Sign offer'}
            </button>
          )}
        </div>
      )}
    </Drawer>
  );
}
