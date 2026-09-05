'use client';

import { ShoppingBag } from '@phosphor-icons/react/dist/ssr';
import { cn } from '@/lib/cn';
import { useCart } from '@/lib/cart/CartProvider';

export function CartButton({ className }: { className?: string }) {
  const { itemCount, open, hydrated } = useCart();
  const visible = hydrated && itemCount > 0;
  return (
    <button
      type="button"
      aria-label={visible ? `Open cart, ${itemCount} items` : 'Open cart'}
      onClick={open}
      className={cn(
        'relative inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-default)] hover:text-[var(--color-text-primary)]',
        className,
      )}
    >
      <ShoppingBag size={16} weight="regular" />
      {visible ? (
        <span
          aria-hidden="true"
          className="absolute -right-1.5 -top-1.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[var(--color-net-green)] px-1 text-[10px] font-semibold leading-none tracking-tight text-[var(--color-bg)]"
        >
          {itemCount > 99 ? '99+' : itemCount}
        </span>
      ) : null}
    </button>
  );
}
