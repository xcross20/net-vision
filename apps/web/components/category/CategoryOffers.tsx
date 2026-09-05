'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Offer } from '@/lib/market/source';
import { payment, relative } from '@/lib/format';

export function CategoryOffers({ slug }: { slug: string }) {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [aggregate, setAggregate] = useState(0);

  useEffect(() => {
    void fetch(`/api/categories/${encodeURIComponent(slug)}/offers`)
      .then((res) => res.json())
      .then((body: { offers?: Offer[]; aggregateOfferValue?: number }) => {
        setOffers(body.offers ?? []);
        setAggregate(body.aggregateOfferValue ?? 0);
      })
      .catch(() => setOffers([]));
  }, [slug]);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-[var(--color-text-secondary)]">
        Top item offers on members of this category. Category-wide bids are not enabled yet.
      </p>
      <div className="grid grid-cols-2 gap-6">
        <div>
          <span className="text-eyebrow-muted">Offers</span>
          <div className="text-numeral text-xl">{offers.length.toLocaleString()}</div>
        </div>
        <div>
          <span className="text-eyebrow-muted">Aggregate</span>
          <div className="text-numeral text-xl">{payment(aggregate, 'USDG')}</div>
        </div>
      </div>
      {offers.length === 0 ? (
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
