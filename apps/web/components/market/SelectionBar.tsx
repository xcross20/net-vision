'use client';

import { useCart } from '@/lib/cart/CartProvider';
import type { Token } from '@/lib/market';
import { payment } from '@/lib/format';

export function SelectionBar({
  tokens,
  onClear,
}: {
  tokens: Token[];
  onClear: () => void;
}) {
  const { addMany, open } = useCart();
  if (tokens.length === 0) return null;
  const total = tokens.reduce((sum, token) => sum + (token.listingPrice ?? 0), 0);
  const currency = tokens[0]?.currency ?? 'USDG';

  const addSelected = () => {
    addMany(
      tokens.map((token) => ({
        token,
        displayedPriceDecimal: token.listingPrice?.toString() ?? null,
        currencySymbol: token.currency,
      })),
    );
    open();
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-border-subtle)] bg-[color-mix(in_srgb,var(--color-bg)_92%,transparent)] backdrop-blur-md md:bottom-0">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 md:px-8">
        <div className="flex min-w-0 flex-col">
          <span className="text-sm text-[var(--color-text-primary)]">
            {tokens.length} selected
            <span className="md:hidden text-[var(--color-text-tertiary)]">
              {' '}
              · {payment(total, currency)}
            </span>
          </span>
          <span className="hidden text-numeral text-lg font-semibold text-[var(--color-net-green)] md:inline">
            {payment(total, currency)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onClear} className="nv-button nv-button-ghost hidden md:inline-flex">
            Clear
          </button>
          <button type="button" onClick={addSelected} className="nv-button nv-button-ghost">
            {typeof window !== 'undefined' && window.innerWidth < 768 ? 'Cart' : 'Add to Cart'}
          </button>
          <button type="button" onClick={addSelected} className="nv-button">
            Buy {tokens.length}
          </button>
        </div>
      </div>
    </div>
  );
}
