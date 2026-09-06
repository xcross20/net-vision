'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Offer } from '@/lib/market/source';
import { payment, relative } from '@/lib/format';

export function CategoryOffers({ slug }: { slug: string }) {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [aggregate, setAggregate] = useState<number | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    void fetch(`/api/categories/${encodeURIComponent(slug)}/offers`)
      .then((res) => {
        if (!res.ok) throw new Error(`offers ${res.status}`);
        return res.json();
      })
      .then((body: { offers?: Offer[]; aggregateOfferValue?: number }) => {
        setUnavailable(false);
        setOffers(body.offers ?? []);
        setAggregate(
          typeof body.aggregateOfferValue === 'number' ? body.aggregateOfferValue : null,
        );
      })
      .catch(() => {
        setUnavailable(true);
        setOffers([]);
        setAggregate(null);
      });
  }, [slug]);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-[var(--color-text-secondary)]">
        Top item offers on members of this category. Category-wide bids are not enabled yet.
      </p>
      <div className="grid grid-cols-2 gap-6">
        <div>
          <span className="text-eyebrow-muted">Offers</span>
          <div className="text-numeral text-xl">
            {unavailable ? '—' : offers.length.toLocaleString()}
          </div>
        </div>
        <div>
          <span className="text-eyebrow-muted">Aggregate</span>
          <div className="text-numeral text-xl">{payment(aggregate, 'USDG')}</div>
        </div>
      </div>
      {unavailable ? (
        <p className="text-sm text-[var(--color-text-tertiary)]">
          Offers unavailable — not the same as zero bids.
        </p>
      ) : offers.length === 0 ? (
        <p className="text-sm text-[var(--color-text-tertiary)]">No item offers indexed yet.</p>
      ) : (
        <div className="flex flex-col divide-y divide-[var(--color-border-subtle)]">
          {offers.map((offer) => (
            <Link
              key={offer.orderHash}
              href={`/tokens/${offer.tokenId}`}
              className="flex items-center justify-between py-3 text-sm"
            >
              <span>#{offer.tokenId}</span>
              <span className="text-numeral">{payment(offer.price, offer.currency)}</span>
              <span className="text-[var(--color-text-tertiary)]">{relative(offer.expiresAt)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
