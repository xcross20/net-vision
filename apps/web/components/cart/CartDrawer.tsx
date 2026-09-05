'use client';

import { useEffect } from 'react';
import { X, ShoppingBag, Trash, ArrowRight } from '@phosphor-icons/react/dist/ssr';
import Link from 'next/link';
import { cn } from '@/lib/cn';
import { useCart } from '@/lib/cart/CartProvider';
import type { CartItem } from '@/lib/cart/types';
import { CartCheckout } from './CartCheckout';

export function CartDrawer() {
  const { isOpen, close, items, remove, clear, itemCount } = useCart();
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, close]);

  return (
    <div
      aria-hidden={!isOpen}
      className={cn(
        'fixed inset-0 z-50 transition-opacity duration-200',
        isOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
      )}
    >
      <button
        type="button"
        aria-label="Close cart"
        tabIndex={isOpen ? 0 : -1}
        onClick={close}
        className="absolute inset-0 bg-[rgba(4,9,7,0.72)] backdrop-blur-sm"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Your cart"
        className={cn(
          'absolute right-0 top-0 flex h-full w-full max-w-md flex-col gap-0 border-l border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] shadow-2xl transition-transform duration-200 md:max-w-lg',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <header className="flex items-center justify-between gap-3 border-b border-[var(--color-border-subtle)] px-5 py-4">
          <div className="flex items-center gap-2">
            <ShoppingBag size={16} weight="duotone" className="text-[var(--color-net-green)]" />
            <span className="text-eyebrow">Your cart</span>
            <span className="text-numeral text-[12px] text-[var(--color-text-tertiary)]">
              {itemCount === 0 ? 'empty' : `${itemCount} item${itemCount === 1 ? '' : 's'}`}
            </span>
          </div>
          <button
            type="button"
            aria-label="Close cart"
            onClick={close}
            className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)]"
          >
            <X size={14} weight="bold" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <EmptyCart onBrowse={close} />
          ) : (
            <ul className="flex flex-col gap-3">
              {items.map((item) => (
                <CartItemRow
                  key={`${item.contractAddress}-${item.tokenId}`}
                  item={item}
                  onRemove={() => remove(item.tokenId)}
                />
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 ? (
          <footer className="flex flex-col gap-3 border-t border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-5 py-4">
            <p className="text-[11px] leading-relaxed text-[var(--color-text-tertiary)]">
              Listings are rechecked against OpenSea before checkout. Prices and availability
              may have changed since you added items.
            </p>
            <CartCheckout />
            <div className="flex items-center justify-between text-[12px]">
              <button
                type="button"
                onClick={close}
                className="text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)]"
              >
                Continue shopping
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm('Clear all items from the cart?')) clear();
                }}
                className="inline-flex items-center gap-1 text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-danger)]"
              >
                <Trash size={11} weight="bold" />
                Clear cart
              </button>
            </div>
          </footer>
        ) : null}
      </aside>
    </div>
  );
}

function CartItemRow({ item, onRemove }: { item: CartItem; onRemove: () => void }) {
  const priceLabel =
    item.displayedPriceDecimal && item.currencySymbol
      ? `${item.displayedPriceDecimal} ${item.currencySymbol}`
      : item.displayedPriceDecimal ?? null;
  const categoryLine = item.categories.map((c) => c.label).join(' / ');
  return (
    <li className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-2)] p-3">
      <Link
        href={`/tokens/${item.tokenId}`}
        className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-[var(--color-surface-3)]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.imageUrl} alt={`#${item.tokenId}`} className="h-full w-full object-cover" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Link
          href={`/tokens/${item.tokenId}`}
          className="text-numeral text-sm font-semibold tracking-tight text-[var(--color-text-primary)] transition-colors hover:text-[var(--color-net-green)]"
        >
          #{item.tokenId}
        </Link>
        <span className="truncate text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">
          {categoryLine || 'Button Presser'}
        </span>
        <div className="flex items-center gap-2 text-[11px] text-[var(--color-text-secondary)]">
          <span className="text-numeral">{priceLabel ?? 'No live ask'}</span>
          <span className="text-[var(--color-text-tertiary)]">·</span>
          <span>{item.sourceMarketplace === 'opensea' ? 'OpenSea' : 'Net Vision'}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove #${item.tokenId}`}
        className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-surface-3)] hover:text-[var(--color-danger)]"
      >
        <X size={12} weight="bold" />
      </button>
    </li>
  );
}

function EmptyCart({ onBrowse }: { onBrowse: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-10 text-center">
      <span className="text-eyebrow-muted">Cart</span>
      <h3 className="text-display text-lg text-[var(--color-text-primary)]">No items yet</h3>
      <p className="max-w-[34ch] text-sm text-[var(--color-text-secondary)]">
        Add Button Pressers from the market or a category. Your selection is saved on this
        device until you check it out.
      </p>
      <Link
        href="/market"
        onClick={onBrowse}
        className="mt-2 inline-flex items-center gap-1 text-sm text-[var(--color-net-green)] transition-colors hover:text-[var(--color-net-green-bright)]"
      >
        Browse the market
        <ArrowRight size={12} weight="bold" />
      </Link>
    </div>
  );
}
