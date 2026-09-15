'use client';

import { useCallback, useState } from 'react';
import { ArrowRight } from '@phosphor-icons/react/dist/ssr';
import { cn } from '@/lib/cn';
import { useCart } from '@/lib/cart/CartProvider';
import { cartDraftFromToken } from '@/lib/cart/listing-snapshot';
import type { CartItemDraft } from '@/lib/cart/types';

/**
 * Canonical Buy now entrance. Adds/updates one cart item and opens
 * CartCheckout. Must never call /api/trade/buy/prepare.
 */
export function BuyNowButton({
  draft,
  disabled,
  className,
  label = 'Buy now',
}: {
  draft: CartItemDraft;
  disabled?: boolean;
  className?: string;
  label?: string;
}) {
  const { buyNow } = useCart();
  const [reason, setReason] = useState<string | null>(null);
  const onClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;
      const result = buyNow({ ...cartDraftFromToken(draft.token), ...draft });
      if (!result.ok) {
        setReason(
          result.reason === 'cart-full'
            ? 'Cart full'
            : result.reason === 'wrong-collection'
              ? 'Wrong collection'
              : 'Could not start checkout',
        );
        setTimeout(() => setReason(null), 1800);
      }
    },
    [buyNow, disabled, draft],
  );
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'nv-button w-full',
        disabled && 'nv-button-disabled cursor-not-allowed opacity-50',
        className,
      )}
    >
      <span>{reason ?? label}</span>
      <ArrowRight size={12} weight="bold" />
    </button>
  );
}
