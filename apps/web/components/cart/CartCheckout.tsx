'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAccount, useChainId, useSendTransaction, useSwitchChain } from 'wagmi';
import { SpinnerIcon, WarnIcon, CheckIcon } from '@/components/icons';
import { cn } from '@/lib/cn';
import { useCart } from '@/lib/cart/CartProvider';
import type { CartItem, CheckoutItem } from '@/lib/cart/types';
import { ROBINHOOD_CHAIN } from '@net-vision/chain-config';

type PrepareSuccess = {
  listing: {
    orderHash: string;
    protocolAddress: string;
    currency: string;
    price: { current: string | number; decimals: number };
    validUntil: string | number | null;
  };
  transaction: { to: string; data?: string; value?: string };
};

type RevalidateItem =
  | {
      tokenId: string;
      state: 'valid';
      cartItem: CartItem;
      liveOrderHash: string;
      livePriceRaw: string;
      livePriceDecimal: number;
      livePriceDisplay: string;
      liveCurrency: string;
      liveProtocolAddress: string;
      liveValidUntil: number | null;
      priceChanged: boolean;
    }
  | {
      tokenId: string;
      state: 'unavailable';
      cartItem: CartItem;
      reason: 'sold' | 'expired' | 'no_listing' | 'unsupported_order';
    }
  | { tokenId: string; state: 'error'; cartItem: CartItem; message: string };

export function CartCheckout() {
  const { items, phase, setPhase, removeConfirmed } = useCart();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync, isPending: switching } = useSwitchChain();
  const { sendTransactionAsync } = useSendTransaction();

  const onReview = useCallback(async () => {
    if (!address) {
      setPhase({ kind: 'error', message: 'Connect a wallet to check out.' });
      return;
    }
    if (chainId !== ROBINHOOD_CHAIN.id) {
      try {
        await switchChainAsync?.({ chainId: ROBINHOOD_CHAIN.id });
      } catch (err) {
        setPhase({
          kind: 'error',
          message:
            err instanceof Error
              ? `Switch to Robinhood Chain before checkout: ${err.message}`
              : 'Switch to Robinhood Chain before checkout.',
        });
        return;
      }
    }
    setPhase({ kind: 'revalidating' });
    try {
      const res = await fetch('/api/trade/cart/revalidate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          buyerAddress: address,
          items: items.map((it) => ({
            tokenId: it.tokenId,
            contractAddress: it.contractAddress,
            displayedOrderHash: it.displayedOrderHash,
            displayedPriceRaw: it.displayedPriceRaw,
          })),
        }),
      });
      const json = (await res.json()) as { items?: RevalidateItem[]; error?: string };
      if (!res.ok || !json.items) {
        setPhase({
          kind: 'error',
          message: json.error ?? `Revalidate failed (${res.status}).`,
        });
        return;
      }
      setPhase({ kind: 'review', items: json.items as CheckoutItem[] });
    } catch (err) {
      setPhase({
        kind: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, [address, chainId, items, setPhase, switchChainAsync]);

  const onCheckout = useCallback(async () => {
    if (phase.kind !== 'review') return;
    if (!address) {
      setPhase({ kind: 'error', message: 'Connect a wallet to check out.' });
      return;
    }
    const validItems = phase.items.filter((it): it is Extract<CheckoutItem, { state: 'valid' }> => it.state === 'valid');
    if (validItems.length === 0) {
      setPhase({ kind: 'error', message: 'No items are available for purchase.' });
      return;
    }
    const confirmed: string[] = [];
    setPhase({ kind: 'executing', items: phase.items, currentIndex: 0, confirmedTokenIds: [] });
    for (let i = 0; i < validItems.length; i += 1) {
      const it = validItems[i];
      setPhase({
        kind: 'executing',
        items: phase.items,
        currentIndex: i,
        confirmedTokenIds: confirmed,
      });
      try {
        const prepRes = await fetch('/api/trade/buy/prepare', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            tokenId: it.tokenId,
            buyerAddress: address,
            acceptedPriceRaw: it.livePriceRaw,
            acceptedOrderHash: it.liveOrderHash,
          }),
        });
        const prepJson = (await prepRes.json()) as PrepareSuccess & { error?: string };
        if (!prepRes.ok || !prepJson.transaction) {
          throw new Error(prepJson.error ?? `prepare failed (${prepRes.status})`);
        }
        const tx = prepJson.transaction;
        const hash = await sendTransactionAsync({
          to: tx.to as `0x${string}`,
          data: (tx.data ?? '0x') as `0x${string}`,
          value: tx.value ? BigInt(tx.value) : BigInt(0),
        });
        confirmed.push(it.tokenId);
        setPhase({
          kind: 'executing',
          items: phase.items,
          currentIndex: i + 1,
          confirmedTokenIds: confirmed,
        });
        if (hash) {
          // Receipt confirmation is handled by the wallet adapter; the
          // hash is the canonical "submitted" signal. We remove the
          // item from the cart optimistically so the user can keep
          // browsing while the chain finalizes.
        }
      } catch (err) {
        setPhase({
          kind: 'complete',
          confirmed: phase.items.filter((it): it is Extract<CheckoutItem, { state: 'valid' }> =>
            confirmed.includes(it.tokenId),
          ),
          failed: [
            ...phase.items.filter((it): it is Extract<CheckoutItem, { state: 'valid' }> =>
              confirmed.includes(it.tokenId) === false && it.tokenId === it.cartItem.tokenId,
            ),
          ].filter(
            (it): it is Extract<CheckoutItem, { state: 'valid' }> =>
              it.state === 'valid' && it.tokenId === it.cartItem.tokenId,
          ),
        });
        return;
      }
    }
    removeConfirmed(confirmed);
    setPhase({
      kind: 'complete',
      confirmed: validItems,
      failed: [],
    });
  }, [address, phase, removeConfirmed, sendTransactionAsync, setPhase]);

  // Reset to browsing when items change meaningfully.
  useEffect(() => {
    if (phase.kind === 'browsing') return;
    if (items.length === 0 && phase.kind !== 'complete') {
      setPhase({ kind: 'browsing' });
    }
  }, [items.length, phase, setPhase]);

  if (phase.kind === 'browsing') {
    return (
      <div className="flex flex-col gap-2">
        {!isConnected ? (
          <p className="text-[12px] text-[var(--color-text-tertiary)]">
            Connect a wallet to check out. Your cart is saved on this device.
          </p>
        ) : null}
        <button
          type="button"
          disabled={items.length === 0}
          onClick={onReview}
          className={cn(
            'nv-button w-full',
            items.length === 0 && 'cursor-not-allowed opacity-50',
          )}
        >
          Review {items.length} item{items.length === 1 ? '' : 's'}
        </button>
      </div>
    );
  }

  if (phase.kind === 'revalidating') {
    return (
      <div className="flex items-center justify-center gap-2 py-3 text-sm text-[var(--color-text-secondary)]">
        <SpinnerIcon className="animate-spin" size={14} />
        Revalidating live listings…
      </div>
    );
  }

  if (phase.kind === 'error') {
    return (
      <div className="flex flex-col gap-2">
        <p className="flex items-start gap-2 text-[12px] text-[var(--color-danger)]">
          <WarnIcon size={14} weight="duotone" />
          <span>{phase.message}</span>
        </p>
        <button type="button" onClick={() => setPhase({ kind: 'browsing' })} className="nv-button-ghost text-sm">
          Back to cart
        </button>
      </div>
    );
  }

  if (phase.kind === 'review') {
    const validCount = phase.items.filter((it) => it.state === 'valid').length;
    const unavailableCount = phase.items.length - validCount;
    const priceChanged = phase.items.filter(
      (it): it is Extract<CheckoutItem, { state: 'valid' }> =>
        it.state === 'valid' && it.priceChanged,
    ).length;
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1 text-[12px] text-[var(--color-text-secondary)]">
          <div className="flex items-center justify-between">
            <span>Available to buy</span>
            <span className="text-numeral text-[var(--color-text-primary)]">{validCount}</span>
          </div>
          {unavailableCount > 0 ? (
            <div className="flex items-center justify-between text-[var(--color-danger)]">
              <span>No longer listed</span>
              <span className="text-numeral">{unavailableCount}</span>
            </div>
          ) : null}
          {priceChanged > 0 ? (
            <div className="flex items-center justify-between text-[var(--color-warning)]">
              <span>Price changed</span>
              <span className="text-numeral">{priceChanged}</span>
            </div>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={validCount === 0}
            onClick={onCheckout}
            className={cn('nv-button w-full', validCount === 0 && 'cursor-not-allowed opacity-50')}
          >
            {validCount === 0 ? 'Nothing to buy' : `Buy ${validCount} item${validCount === 1 ? '' : 's'}`}
          </button>
          <button
            type="button"
            onClick={() => setPhase({ kind: 'browsing' })}
            className="text-[12px] text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)]"
          >
            Back to cart
          </button>
        </div>
      </div>
    );
  }

  if (phase.kind === 'executing') {
    const total = phase.items.filter((it) => it.state === 'valid').length;
    return (
      <div className="flex items-center justify-center gap-2 py-3 text-sm text-[var(--color-text-secondary)]">
        <SpinnerIcon className="animate-spin" size={14} />
        Submitting {phase.currentIndex + 1} of {total}. Confirm each prompt in your wallet.
      </div>
    );
  }

  if (phase.kind === 'complete') {
    return (
      <div className="flex flex-col gap-2">
        <p className="flex items-start gap-2 text-[12px] text-[var(--color-net-green)]">
          <CheckIcon size={14} weight="duotone" />
          <span>
            {phase.confirmed.length} purchase{phase.confirmed.length === 1 ? '' : 's'} submitted.
            Confirmations stream in as the chain finalizes.
          </span>
        </p>
        <button
          type="button"
          onClick={() => setPhase({ kind: 'browsing' })}
          className="nv-button-ghost text-sm"
        >
          Close
        </button>
      </div>
    );
  }

  return null;
}
