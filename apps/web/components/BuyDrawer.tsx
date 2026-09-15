'use client';

/**
 * Retired as an independent purchase executor.
 *
 * BuyDrawer used to call /api/trade/buy/prepare with only tokenId +
 * buyerAddress and treated wallet submission as success. That is a
 * sibling-risk duplicate of CartCheckout (no acceptedPriceRaw,
 * no acceptedOrderHash, no receipt wait).
 *
 * All Buy now surfaces now enter CartCheckout via BuyNowButton.
 * This module re-exports that entrance so leftover imports cannot
 * resurrect the weak path.
 */
export { BuyNowButton as BuyDrawer } from '@/components/cart/BuyNowButton';
