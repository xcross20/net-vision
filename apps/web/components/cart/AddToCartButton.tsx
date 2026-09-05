'use client';

import { useCallback, useEffect, useState } from 'react';
import { ShoppingBag, Check, Warning } from '@phosphor-icons/react/dist/ssr';
import { cn } from '@/lib/cn';
import { useCart } from '@/lib/cart/CartProvider';
import type { CartItemDraft } from '@/lib/cart/types';

type Variant = 'primary' | 'ghost' | 'compact';

const labels: Record<Variant, { idle: string; success: string }> = {
  primary: { idle: 'Add to cart', success: 'In cart' },
  ghost: { idle: 'Add to cart', success: 'In cart' },
  compact: { idle: 'Add', success: 'Added' },
};

export function AddToCartButton({
  draft,
  variant = 'primary',
  className,
}: {
  draft: CartItemDraft;
  variant?: Variant;
  className?: string;
}) {
  const { add, items } = useCart();
  const [feedback, setFeedback] = useState<'idle' | 'success' | 'error'>('idle');
  const [reason, setReason] = useState<string | null>(null);
  const alreadyInCart = items.some((it) => it.tokenId === draft.token.tokenId);

  useEffect(() => {
    if (feedback === 'success') {
      const t = setTimeout(() => setFeedback('idle'), 1600);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [feedback]);

  const onClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const result = add(draft);
      if (result.ok) {
        setFeedback('success');
        setReason(null);
      } else {
        setFeedback('error');
        setReason(
          result.reason === 'already-in-cart'
            ? 'Already in cart'
            : result.reason === 'cart-full'
              ? 'Cart full'
              : result.reason === 'wrong-collection'
                ? 'Wrong collection'
                : 'Could not add',
        );
        setTimeout(() => setFeedback('idle'), 1800);
      }
    },
    [add, draft],
  );

  const label = feedback === 'success' ? labels[variant].success : labels[variant].idle;
  const Icon =
    feedback === 'success' ? Check : feedback === 'error' ? Warning : ShoppingBag;

  const base =
    variant === 'primary'
      ? 'nv-button w-full'
      : variant === 'ghost'
        ? 'nv-button nv-button-ghost w-full'
        : 'inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-default)] hover:text-[var(--color-text-primary)]';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={alreadyInCart}
      className={cn(
        base,
        alreadyInCart && 'border-[var(--color-net-green)] text-[var(--color-net-green)]',
        feedback === 'error' && 'border-[var(--color-danger)] text-[var(--color-danger)]',
        className,
      )}
    >
      <Icon size={variant === 'compact' ? 13 : 14} weight={feedback === 'success' ? 'fill' : 'bold'} />
      {variant !== 'compact' ? <span>{reason ?? label}</span> : null}
    </button>
  );
}
