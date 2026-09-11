'use client';

import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { payment } from '@/lib/format';

type OfferRow = {
  id: string;
  identity: { collectionId: string; tokenId: string };
  buyerAddress: string;
  offerUsdg: string;
  status: string;
  expiresAt: number;
};

export function OffersPanel({ tokenId, isOwner }: { tokenId?: string; isOwner?: boolean }) {
  const { address } = useAccount();
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const qs = tokenId
      ? `tokenId=${encodeURIComponent(tokenId)}`
      : address
        ? `buyer=${encodeURIComponent(address)}`
        : null;
    if (!qs) return;
    void fetch(`/api/offers?${qs}`)
      .then(async (res) => {
        const body = (await res.json()) as { offers?: OfferRow[] };
        setOffers(body.offers ?? []);
      })
      .catch(() => setError('Offers unavailable'));
  }, [address, tokenId]);

  const accept = async (id: string) => {
    if (!address) return;
    setError(null);
    const res = await fetch(`/api/offers/${id}/accept/prepare`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sellerAddress: address, sellerOwnsToken: true, buyerBalanceUsdgRaw: '0' }),
    });
    const body = (await res.json()) as { message?: string };
    setError(body.message ?? (res.ok ? null : 'Accept is not executable until buyer balance is proven.'));
  };

  if (offers.length === 0) {
    return (
      <p className="text-sm text-[var(--color-text-tertiary)]">
        {error ?? 'No native Net Vision offers yet.'}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {offers.map((offer) => (
        <li
          key={offer.id}
          className="flex items-center justify-between gap-3 rounded-[14px] border border-[var(--color-border-subtle)] px-3 py-2 text-sm"
        >
          <span>
            #{offer.identity.tokenId} · {offer.offerUsdg} USDG · {offer.status}
          </span>
          {isOwner && offer.status === 'ACTIVE' ? (
            <button type="button" className="nv-button nv-button-ghost" onClick={() => void accept(offer.id)}>
              Accept
            </button>
          ) : null}
        </li>
      ))}
      {error ? <li className="text-[12px] text-[var(--color-text-tertiary)]">{error}</li> : null}
    </ul>
  );
}

export function OfferAmount({ raw }: { raw: number }) {
  return <span className="text-numeral">{payment(raw, 'USDG')}</span>;
}
