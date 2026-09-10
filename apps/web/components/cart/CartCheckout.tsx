'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAccount, useChainId, usePublicClient, useSendTransaction, useSwitchChain, useWriteContract } from 'wagmi';
import { erc20Abi } from 'viem';
import { SpinnerIcon, WarnIcon, CheckIcon } from '@/components/icons';
import { cn } from '@/lib/cn';
import { useCart } from '@/lib/cart/CartProvider';
import type { CartItem, CheckoutItem } from '@/lib/cart/types';
import {
  PAYMENT_ASSETS,
  assertCanMarkConfirmed,
  assertCanPreparePurchase,
  assertCanSelectPaymentAsset,
  isExecutablePaymentAsset,
  type PaymentAssetId,
} from '@/lib/cart/checkout-machine';
import { PAYMENT_TOKENS, ROBINHOOD_CHAIN } from '@net-vision/chain-config';
import { payment } from '@/lib/format';
import type { UsdgStatus } from '@/lib/trade/usdg-status';

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
      liveConduitKey?: string | null;
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
  const { items, phase, setPhase, removeConfirmed, consumeReviewRequest } = useCart();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync, isPending: switching } = useSwitchChain();
  const { sendTransactionAsync } = useSendTransaction();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const [acceptedPriceDrift, setAcceptedPriceDrift] = useState(false);
  const [usdgStatus, setUsdgStatus] = useState<UsdgStatus | null>(null);

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

  const onApproveUsdg = useCallback(async () => {
    if (phase.kind !== 'payment_select' || !address) return;
    const spender = usdgStatus?.spender.address;
    if (!spender) {
      setPhase({ kind: 'error', message: 'USDG spender is unresolved; cannot approve.' });
      return;
    }
    const validItems = phase.items.filter(
      (it): it is Extract<CheckoutItem, { state: 'valid' }> => it.state === 'valid',
    );
    const required = validItems.reduce((sum, it) => sum + BigInt(String(it.livePriceRaw)), 0n);
    if (required <= 0n) {
      setPhase({ kind: 'error', message: 'Nothing to approve.' });
      return;
    }
    try {
      const hash = await writeContractAsync({
        address: PAYMENT_TOKENS.USDG.contractAddress,
        abi: erc20Abi,
        functionName: 'approve',
        args: [spender, required],
        chainId: ROBINHOOD_CHAIN.id,
      });
      if (!publicClient) throw new Error('No RPC client — cannot wait for approval.');
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== 'success') {
        throw new Error(`USDG approval reverted (${hash})`);
      }
      const res = await fetch('/api/trade/cart/revalidate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          buyerAddress: address,
          items: validItems.map((it) => ({
            tokenId: it.tokenId,
            contractAddress: it.cartItem.contractAddress,
            displayedOrderHash: it.liveOrderHash,
            displayedPriceRaw: String(it.livePriceRaw),
          })),
        }),
      });
      const json = (await res.json()) as { items?: RevalidateItem[]; error?: string };
      if (!res.ok || !json.items) {
        throw new Error(json.error ?? 'Listing revalidation after approval failed.');
      }
      setPhase({
        kind: 'payment_select',
        items: json.items as CheckoutItem[],
        payment: phase.payment,
      });
    } catch (err) {
      setPhase({
        kind: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, [address, phase, publicClient, setPhase, usdgStatus, writeContractAsync]);

  const onCheckout = useCallback(async () => {
    if (phase.kind !== 'review' && phase.kind !== 'payment_select') return;
    if (!address) {
      setPhase({ kind: 'error', message: 'Connect a wallet to check out.' });
      return;
    }
    const validItems = phase.items.filter((it): it is Extract<CheckoutItem, { state: 'valid' }> => it.state === 'valid');
    if (validItems.length === 0) {
      setPhase({ kind: 'error', message: 'No items are available for purchase.' });
      return;
    }
    try {
      assertCanSelectPaymentAsset('USDG');
    } catch (err) {
      setPhase({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
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
        const finalRes = await fetch('/api/trade/cart/revalidate', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            buyerAddress: address,
            items: [
              {
                tokenId: it.tokenId,
                contractAddress: it.cartItem.contractAddress,
                displayedOrderHash: it.liveOrderHash,
                displayedPriceRaw: String(it.livePriceRaw),
              },
            ],
          }),
        });
        const finalJson = (await finalRes.json()) as { items?: RevalidateItem[]; error?: string };
        const live = finalJson.items?.[0];
        if (!finalRes.ok || !live || live.state !== 'valid') {
          throw new Error(
            live && live.state === 'unavailable'
              ? `Listing gone (${live.reason})`
              : finalJson.error ?? 'Final listing revalidation failed',
          );
        }
        if (live.liveOrderHash !== it.liveOrderHash || live.priceChanged) {
          throw new Error('Listing changed after payment select; review again.');
        }
        const acceptedPriceRaw = String(live.livePriceRaw);
        assertCanPreparePurchase({
          acceptedOrderHash: live.liveOrderHash,
          acceptedPriceRaw,
          listingState: live.state,
        });
        const prepRes = await fetch('/api/trade/buy/prepare', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            tokenId: it.tokenId,
            buyerAddress: address,
            acceptedPriceRaw,
            acceptedOrderHash: live.liveOrderHash,
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
        if (!publicClient) {
          throw new Error('No RPC client — cannot wait for confirmation.');
        }
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        assertCanMarkConfirmed(receipt.status === 'success' ? 'success' : 'reverted');
        if (receipt.status !== 'success') {
          throw new Error(`Transaction reverted (${hash})`);
        }
        confirmed.push(it.tokenId);
        setPhase({
          kind: 'executing',
          items: phase.items,
          currentIndex: i + 1,
          confirmedTokenIds: confirmed,
        });
      } catch (err) {
        const confirmedItems = validItems.filter((row) => confirmed.includes(row.tokenId));
        const failedItems = validItems.filter((row) => !confirmed.includes(row.tokenId));
        const message = err instanceof Error ? err.message : String(err);
        if (confirmedItems.length > 0) {
          removeConfirmed(confirmed);
          setPhase({
            kind: 'recovery',
            confirmed: confirmedItems,
            failed: failedItems,
            message,
          });
        } else {
          setPhase({ kind: 'error', message });
        }
        return;
      }
    }
    removeConfirmed(confirmed);
    setPhase({
      kind: 'complete',
      confirmed: validItems,
      failed: [],
    });
  }, [address, phase, publicClient, removeConfirmed, sendTransactionAsync, setPhase]);

  useEffect(() => {
    if (phase.kind === 'browsing') return;
    if (items.length === 0 && phase.kind !== 'complete') {
      setPhase({ kind: 'browsing' });
    }
  }, [items.length, phase, setPhase]);

  useEffect(() => {
    if (phase.kind !== 'payment_select' || !address) {
      setUsdgStatus(null);
      return;
    }
    const valid = phase.items.filter(
      (it): it is Extract<CheckoutItem, { state: 'valid' }> => it.state === 'valid',
    );
    const required = valid.reduce((sum, it) => sum + BigInt(String(it.livePriceRaw)), 0n);
    const conduitKey = valid[0]?.liveConduitKey ?? '';
    let cancelled = false;
    const qs = new URLSearchParams({
      buyer: address,
      requiredRaw: required.toString(),
    });
    if (conduitKey) qs.set('conduitKey', conduitKey);
    void fetch(`/api/trade/usdg-status?${qs.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json: UsdgStatus | null) => {
        if (!cancelled) setUsdgStatus(json);
      })
      .catch(() => {
        if (!cancelled) setUsdgStatus(null);
      });
    return () => {
      cancelled = true;
    };
  }, [address, phase]);

  useEffect(() => {
    if (phase.kind !== 'browsing') return;
    if (!consumeReviewRequest()) return;
    if (items.length === 0) return;
    void onReview();
  }, [consumeReviewRequest, items.length, onReview, phase.kind]);

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
    const validItems = phase.items.filter(
      (it): it is Extract<CheckoutItem, { state: 'valid' }> => it.state === 'valid',
    );
    const validCount = validItems.length;
    const unavailable = phase.items.filter((it) => it.state !== 'valid');
    const drifted = validItems.filter((it) => it.priceChanged);
    const originalTotal = validItems.reduce((sum, it) => {
      const snap = Number(it.cartItem.displayedPriceDecimal ?? it.livePriceDecimal);
      return sum + (Number.isFinite(snap) ? snap : it.livePriceDecimal);
    }, 0);
    const currentTotal = validItems.reduce((sum, it) => sum + it.livePriceDecimal, 0);
    const currency = validItems[0]?.liveCurrency ?? 'USDG';
    const canBuy = validCount > 0 && (drifted.length === 0 || acceptedPriceDrift);
    return (
      <div className="flex flex-col gap-3">
        <ul className="flex max-h-56 flex-col gap-2 overflow-y-auto text-[12px]">
          {phase.items.map((it) => {
            if (it.state !== 'valid') {
              return (
                <li key={it.tokenId} className="flex items-center justify-between text-[var(--color-danger)]">
                  <span>#{it.tokenId}</span>
                  <span>✕ {it.state === 'unavailable' ? it.reason.replace('_', ' ') : 'error'}</span>
                </li>
              );
            }
            const was = it.cartItem.displayedPriceDecimal;
            return (
              <li key={it.tokenId} className="flex items-center justify-between gap-2">
                <span>#{it.tokenId}</span>
                <span className={it.priceChanged ? 'text-[var(--color-warning)]' : 'text-[var(--color-net-green)]'}>
                  {it.priceChanged && was
                    ? `${was} → ${payment(it.livePriceDecimal, it.liveCurrency)}`
                    : payment(it.livePriceDecimal, it.liveCurrency)}
                  {it.priceChanged ? ' ⚠' : ' ✓'}
                </span>
              </li>
            );
          })}
        </ul>
        <div className="flex flex-col gap-1 border-t border-[var(--color-border-subtle)] pt-2 text-[12px] text-[var(--color-text-secondary)]">
          <div className="flex justify-between">
            <span>Original total</span>
            <span className="text-numeral">{payment(originalTotal, currency)}</span>
          </div>
          <div className="flex justify-between">
            <span>Current total</span>
            <span className="text-numeral text-[var(--color-text-primary)]">{payment(currentTotal, currency)}</span>
          </div>
          {unavailable.length > 0 ? (
            <div className="flex justify-between text-[var(--color-danger)]">
              <span>Removed</span>
              <span className="text-numeral">{unavailable.length}</span>
            </div>
          ) : null}
        </div>
        {drifted.length > 0 ? (
          <label className="flex items-start gap-2 text-[12px] text-[var(--color-text-primary)]">
            <input
              type="checkbox"
              checked={acceptedPriceDrift}
              onChange={(e) => setAcceptedPriceDrift(e.target.checked)}
            />
            I accept updated prices ({drifted.length} changed)
          </label>
        ) : null}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={!canBuy}
            onClick={() =>
              setPhase({
                kind: 'payment_select',
                items: phase.items,
                payment: { assetId: 'USDG' },
              })
            }
            className={cn('nv-button w-full', !canBuy && 'cursor-not-allowed opacity-50')}
          >
            {validCount === 0 ? 'Nothing to buy' : 'Choose payment'}
          </button>
          <button
            type="button"
            onClick={() => {
              setAcceptedPriceDrift(false);
              setPhase({ kind: 'browsing' });
            }}
            className="text-[12px] text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)]"
          >
            Back to cart
          </button>
        </div>
      </div>
    );
  }

  if (phase.kind === 'payment_select') {
    const validItems = phase.items.filter(
      (it): it is Extract<CheckoutItem, { state: 'valid' }> => it.state === 'valid',
    );
    const currentTotal = validItems.reduce((sum, it) => sum + it.livePriceDecimal, 0);
    const currency = validItems[0]?.liveCurrency ?? 'USDG';
    return (
      <div className="flex flex-col gap-3">
        <div className="flex justify-between text-[12px] text-[var(--color-text-secondary)]">
          <span>Current total</span>
          <span className="text-numeral text-[var(--color-text-primary)]">
            {payment(currentTotal, currency)}
          </span>
        </div>
        <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">
          Pay with
        </p>
        <ul className="flex flex-col gap-2">
          {PAYMENT_ASSETS.map((asset) => {
            const selected = phase.payment.assetId === asset.id;
            const executable = isExecutablePaymentAsset(asset.id);
            return (
              <li key={asset.id}>
                <button
                  type="button"
                  disabled={!executable}
                  onClick={() =>
                    setPhase({
                      kind: 'payment_select',
                      items: phase.items,
                      payment: { assetId: asset.id as PaymentAssetId },
                    })
                  }
                  className={cn(
                    'flex w-full items-start justify-between rounded-[var(--radius-sm)] border px-3 py-2 text-left text-[12px]',
                    selected && executable
                      ? 'border-[var(--color-net-green)] bg-[rgba(72,235,145,0.08)]'
                      : 'border-[var(--color-border-subtle)]',
                    !executable && 'cursor-not-allowed opacity-50',
                  )}
                >
                  <span className="flex flex-col gap-0.5">
                    <span className="font-semibold text-[var(--color-text-primary)]">
                      {selected ? '● ' : '○ '}
                      {asset.symbol}
                    </span>
                    <span className="text-[var(--color-text-tertiary)]">{asset.routeLabel}</span>
                  </span>
                  <span className="text-[var(--color-text-tertiary)]">
                    {executable ? (asset.recommended ? 'Recommended' : 'Available') : 'Coming soon'}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="text-[11px] text-[var(--color-text-tertiary)]">
          <p>USDG balance: {formatKnowledge(usdgStatus?.balance)}</p>
          <p>USDG allowance: {formatKnowledge(usdgStatus?.allowance)}</p>
          <p>
            Spender:{' '}
            {usdgStatus?.spender.address
              ? `${usdgStatus.spender.source} ${usdgStatus.spender.address.slice(0, 10)}…`
              : 'unresolved'}
          </p>
          <p>{usdgStatus?.spender.note ?? 'Unknown is never shown as 0.'}</p>
        </div>
        {usdgStatus?.allowance.state === 'KNOWN_INSUFFICIENT' ? (
          <button type="button" onClick={() => void onApproveUsdg()} className="nv-button w-full">
            Approve USDG (bounded)
          </button>
        ) : (
          <button
            type="button"
            onClick={onCheckout}
            disabled={
              usdgStatus?.balance.state === 'KNOWN_INSUFFICIENT' ||
              usdgStatus?.spender.address == null
            }
            className={cn(
              'nv-button w-full',
              (usdgStatus?.balance.state === 'KNOWN_INSUFFICIENT' ||
                usdgStatus?.spender.address == null) &&
                'cursor-not-allowed opacity-50',
            )}
          >
            {usdgStatus?.balance.state === 'KNOWN_INSUFFICIENT'
              ? 'Insufficient USDG'
              : 'Review purchase'}
          </button>
        )}
        <button
          type="button"
          onClick={() => setPhase({ kind: 'review', items: phase.items })}
          className="text-[12px] text-[var(--color-text-tertiary)]"
        >
          Back to listings
        </button>
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
            {phase.confirmed.length} purchase{phase.confirmed.length === 1 ? '' : 's'} confirmed
            on-chain.
          </span>
        </p>
        {phase.failed.length > 0 ? (
          <p className="text-[12px] text-[var(--color-danger)]">
            {phase.failed.length} item{phase.failed.length === 1 ? '' : 's'} not confirmed — cart
            kept those listings.
          </p>
        ) : null}
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

  if (phase.kind === 'recovery') {
    return (
      <div className="flex flex-col gap-2">
        <p className="flex items-start gap-2 text-[12px] text-[var(--color-warning)]">
          <WarnIcon size={14} weight="duotone" />
          <span>
            {phase.confirmed.length} confirmed. {phase.failed.length} still need action. {phase.message}
          </span>
        </p>
        <p className="text-[11px] text-[var(--color-text-tertiary)]">
          Confirmed NFTs stay yours. Failed items remain in the cart for retry. We never substitute
          another token.
        </p>
        <button
          type="button"
          onClick={() => setPhase({ kind: 'browsing' })}
          className="nv-button-ghost text-sm"
        >
          Back to cart
        </button>
      </div>
    );
  }

  return null;
}

function formatKnowledge(
  row: { state: string; raw: string | null } | null | undefined,
): string {
  if (!row || row.state === 'UNKNOWN') {
    return row?.raw ? `${row.raw} (status unknown vs required)` : 'unknown';
  }
  if (row.state === 'KNOWN_SUFFICIENT') return 'sufficient';
  if (row.state === 'KNOWN_INSUFFICIENT') return 'insufficient';
  return 'unknown';
}
