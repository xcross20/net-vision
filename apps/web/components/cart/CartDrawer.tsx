'use client';

import { useEffect } from 'react';
import { X, Trash, ArrowRight } from '@phosphor-icons/react/dist/ssr';
import Link from 'next/link';
import { cn } from '@/lib/cn';
import { useCart } from '@/lib/cart/CartProvider';
import type { CartItem } from '@/lib/cart/types';
import { canRemoveCartAsset } from '@/lib/cart/reconcile';
import { CartCheckout } from './CartCheckout';

export function CartDrawer() {
  const { isOpen, close, items, remove, clear, itemCount, phase } = useCart();
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
          'absolute inset-3 flex flex-col overflow-hidden rounded-[24px] border border-[var(--color-border-subtle)] bg-[color-mix(in_srgb,var(--color-bg)_88%,transparent)] shadow-2xl backdrop-blur-xl md:inset-6',
          isOpen ? 'translate-y-0' : 'translate-y-4',
        )}
      >
        <header className="flex items-center justify-between gap-3 border-b border-[var(--color-border-subtle)] px-5 py-4 md:px-8">
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={close}
              className="text-left text-[12px] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
            >
              ← Continue shopping
            </button>
            <h2 className="text-display text-[clamp(1.8rem,4vw,2.6rem)]">
              {phase.kind === 'payment_select' ? (
                <>
                  Select <span className="text-[var(--color-net-green)]">Payment Method</span>
                </>
              ) : (
                <>
                  Your <span className="text-[var(--color-net-green)]">Cart</span>
                </>
              )}
            </h2>
            <p className="text-sm text-[var(--color-text-secondary)]">
              {phase.kind === 'payment_select'
                ? 'Choose how you would like to pay for your Net Vision purchase.'
                : 'Review your items, confirm availability, and complete your purchase.'}
            </p>
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

        {phase.kind === 'payment_select' && items.length > 0 ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 md:px-8">
            <CartCheckout />
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[minmax(0,1.4fr)_24rem]">
            <div className="px-5 py-5 md:px-8">
              {items.length === 0 ? (
                <EmptyCart onBrowse={close} />
              ) : (
                <ul className="flex flex-col gap-3">
                  {items.map((item) => (
                    <CartItemRow
                      key={`${item.contractAddress}-${item.tokenId}`}
                      item={item}
                      executionLocked={!canRemoveCartAsset(phase, item).ok}
                      onRemove={() => remove(item.tokenId, item.contractAddress)}
                    />
                  ))}
                </ul>
              )}
              {items.length > 0 ? (
                <div className="mt-4 flex items-center justify-between text-[12px]">
                  <span className="text-[var(--color-text-tertiary)]">
                    {itemCount} item{itemCount === 1 ? '' : 's'} selected
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Clear all items from the cart?')) clear();
                    }}
                    className="inline-flex items-center gap-1 text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-danger)]"
                  >
                    <Trash size={11} weight="bold" />
                    Remove selected
                  </button>
                </div>
              ) : null}
            </div>
            {items.length > 0 ? (
              <div className="flex flex-col gap-3 border-t border-[var(--color-border-subtle)] bg-[rgba(5,9,8,0.45)] px-5 py-5 md:px-6 lg:border-l lg:border-t-0">
                <p className="text-[11px] leading-relaxed text-[var(--color-text-tertiary)]">
                  Listings are rechecked against OpenSea before checkout. Prices and availability
                  may have changed since you added items.
                </p>
                <CartCheckout />
              </div>
            ) : null}
          </div>
        )}
      </aside>
    </div>
  );
}

function CartItemRow({
  item,
  onRemove,
  executionLocked,
}: {
  item: CartItem;
  onRemove: () => { ok: boolean; reason?: string };
  executionLocked: boolean;
}) {
  const priceLabel =
    item.displayedPriceDecimal && item.currencySymbol
      ? `${item.displayedPriceDecimal} ${item.currencySymbol}`
      : item.displayedPriceDecimal ?? null;
  const categoryLine = item.categories.map((c) => c.label).join(' / ');
  return (
    <li className="nv-glass-2 flex items-center gap-4 rounded-[18px] p-4">
      <Link
        href={`/tokens/${item.tokenId}`}
        className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[14px] bg-[var(--color-surface-3)]"
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
        onClick={() => onRemove()}
        disabled={executionLocked}
        title={executionLocked ? 'Purchase in progress — this item is locked' : `Remove #${item.tokenId}`}
        aria-label={`Remove #${item.tokenId}`}
        className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-surface-3)] hover:text-[var(--color-danger)] disabled:cursor-not-allowed disabled:opacity-40"
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
