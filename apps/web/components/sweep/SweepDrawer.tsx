'use client';

import { useEffect, useState } from 'react';
import { Drawer } from '@/components/ui/Drawer';
import { useCart } from '@/lib/cart/CartProvider';
import type { Token } from '@/lib/market';
import type { SweepPreview } from '@/lib/market/engine';
import { payment } from '@/lib/format';

export function SweepDrawer({
  open,
  onClose,
  slug,
  name,
  tokens,
  enabled,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  name: string;
  tokens: Token[];
  enabled: boolean;
}) {
  const { addMany, open: openCart } = useCart();
  const [quantity, setQuantity] = useState(5);
  const [maxSpend, setMaxSpend] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [preview, setPreview] = useState<SweepPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !enabled) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    void fetch(`/api/categories/${encodeURIComponent(slug)}/sweep-preview`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        quantity,
        maxSpend: maxSpend ? Number(maxSpend) : undefined,
        maxPricePerItem: maxPrice ? Number(maxPrice) : undefined,
      }),
      signal: controller.signal,
    })
      .then(async (res) => {
        const body = (await res.json()) as SweepPreview & { message?: string };
        if (!res.ok) throw new Error(body.message ?? 'Sweep preview failed');
        setPreview(body);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Sweep preview failed');
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [open, enabled, slug, quantity, maxSpend, maxPrice]);

  const addBasket = () => {
    if (!preview) return;
    const byId = new Map(tokens.map((token) => [token.tokenId, token]));
    addMany(
      preview.items
        .map((item) => {
          const token = byId.get(item.tokenId);
          if (!token) return null;
          return {
            token,
            displayedPriceDecimal: item.price.toString(),
            displayedOrderHash: item.orderHash,
            currencySymbol: item.currency,
          };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null),
    );
    onClose();
    openCart();
  };

  return (
    <Drawer open={open} onClose={onClose} title={`Sweep ${name}`} width="md">
      <div className="flex flex-col gap-5">
        {!enabled ? (
          <p className="text-sm text-[var(--color-text-secondary)]">
            Sweep waits until this category’s market coverage is live.
          </p>
        ) : (
          <>
            <fieldset className="flex flex-col gap-2">
              <legend className="text-eyebrow-muted">Strategy</legend>
              <label className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--color-net-green)] bg-[rgba(72,235,145,0.08)] p-3">
                <input type="radio" checked readOnly className="mt-1" />
                <span>
                  <span className="block text-sm text-[var(--color-text-primary)]">Floor</span>
                  <span className="text-xs text-[var(--color-text-tertiary)]">
                    Cheapest listings first
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] p-3 opacity-50">
                <input type="radio" disabled className="mt-1" />
                <span>
                  <span className="block text-sm">Quality</span>
                  <span className="text-xs text-[var(--color-text-tertiary)]">Coming later</span>
                </span>
              </label>
              <label className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] p-3 opacity-50">
                <input type="radio" disabled className="mt-1" />
                <span>
                  <span className="block text-sm">Value</span>
                  <span className="text-xs text-[var(--color-text-tertiary)]">Coming later</span>
                </span>
              </label>
            </fieldset>
            <label className="flex flex-col gap-1 text-sm">
              Quantity
              <input
                type="number"
                min={1}
                max={20}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="h-10 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-2)] px-3"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Spend up to
              <input
                type="number"
                min={0}
                value={maxSpend}
                onChange={(e) => setMaxSpend(e.target.value)}
                placeholder="Optional USDG"
                className="h-10 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-2)] px-3"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Max price per Button
              <input
                type="number"
                min={0}
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="Optional USDG"
                className="h-10 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-2)] px-3"
              />
            </label>
            <div className="flex flex-col gap-2">
              <span className="text-eyebrow-muted">Preview</span>
              {loading ? <p className="text-sm text-[var(--color-text-tertiary)]">Building basket…</p> : null}
              {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
              {preview?.items.map((item) => (
                <div key={item.tokenId} className="flex items-center justify-between text-sm">
                  <span>#{item.tokenId}</span>
                  <span className="text-numeral">{payment(item.price, item.currency)}</span>
                </div>
              ))}
              {preview ? (
                <p className="text-numeral text-sm text-[var(--color-text-secondary)]">
                  {preview.count} Buttons · {payment(preview.total, preview.currency)}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={addBasket}
              disabled={!preview || preview.count === 0}
              className="nv-button"
            >
              Add Sweep to Cart
            </button>
          </>
        )}
      </div>
    </Drawer>
  );
}
