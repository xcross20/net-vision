'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAccount, usePublicClient, useSendTransaction, useWriteContract } from 'wagmi';
import { erc20Abi } from 'viem';
import { SpinnerIcon, WarnIcon, CheckIcon, WalletIcon } from '@/components/icons';
import { cn } from '@/lib/cn';
import { useCart } from '@/lib/cart/CartProvider';
import type { CartItem, CheckoutItem } from '@/lib/cart/types';
import { CheckoutPaymentPicker, type PaymentAvailability } from './CheckoutPaymentPicker';
import { OrderSummary } from './OrderSummary';
import { PaymentStatusFooter } from './PaymentStatusFooter';
import {
  assertCanMarkConfirmed,
  assertCanPreparePurchase,
  type PaymentAssetId,
} from '@/lib/cart/checkout-machine';
import { PAYMENT_TOKENS, ROBINHOOD_CHAIN } from '@net-vision/chain-config';
import { checkoutVisibleAssets } from '@net-vision/payment-router';
import { payment } from '@/lib/format';
import { boundedApproveAmount } from '@/lib/trade/bounded-approve';
import { useRobinhoodNetworkGate } from '@/lib/wallet/NetworkGateProvider';
import { useWalletConnectModal } from '@/lib/wallet/WalletConnectProvider';
import { checkoutFailureMessage } from '@/lib/wallet/network-errors';
import {
  assertWalletOnRobinhood,
  isRobinhoodChainId,
  shouldInvalidateChainSensitiveState,
} from '@/lib/wallet/network-gate';
import { cartAssetId, cartMembershipSet } from '@/lib/cart/identity';
import { checkoutRequestBind, isCheckoutResponseCurrent } from '@/lib/cart/checkout-request';
import { recordCheckoutEvent } from '@/lib/cart/checkout-events';
import { deriveCheckoutCta, formatSelectedAmount } from '@/lib/payment/checkout-cta';
import { useSelectedPaymentStatus } from '@/lib/payment/use-selected-payment-status';
import {
  checkoutCurrency,
  currentCheckoutItems,
  currentTotalDecimal,
  originalTotalDecimal,
  requiredUsdgRaw,
  validCheckoutItems,
} from '@/lib/cart/selectors';
import { reconcileCheckoutWithCart } from '@/lib/cart/reconcile';

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
      livePriceRaw: string | bigint;
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

function cartPaymentId(assetId: string): PaymentAssetId | null {
  switch (assetId) {
    case 'usdg':
      return 'USDG';
    case 'eth':
      return 'ETH';
    case 'netnet-net':
      return 'NET';
    case 'rh-aapl':
      return 'AAPL';
    case 'rh-nvda':
      return 'NVDA';
    case 'rh-tsla':
      return 'TSLA';
    case 'rh-msft':
      return 'MSFT';
    case 'rh-amzn':
      return 'AMZN';
    case 'rh-googl':
      return 'GOOGL';
    case 'rh-coin':
      return 'COIN';
    case 'rh-spcx':
      return 'SPCX';
    case 'rh-spy':
      return 'SPY';
    default:
      return null;
  }
}

function paymentAssetIdForPhase(paymentAsset: PaymentAssetId): string {
  switch (paymentAsset) {
    case 'USDG':
      return 'usdg';
    case 'ETH':
      return 'eth';
    case 'NET':
      return 'netnet-net';
    case 'AAPL':
      return 'rh-aapl';
    case 'NVDA':
      return 'rh-nvda';
    case 'TSLA':
      return 'rh-tsla';
    case 'MSFT':
      return 'rh-msft';
    case 'AMZN':
      return 'rh-amzn';
    case 'GOOGL':
      return 'rh-googl';
    case 'COIN':
      return 'rh-coin';
    case 'SPCX':
      return 'rh-spcx';
    case 'SPY':
      return 'rh-spy';
    default:
      return 'usdg';
  }
}

function asCheckoutItems(rows: RevalidateItem[]): CheckoutItem[] {
  return rows.map((row) => {
    if (row.state === 'valid') {
      return { ...row, livePriceRaw: BigInt(String(row.livePriceRaw)) };
    }
    return row;
  });
}

export function CartCheckout() {
  const {
    items,
    phase,
    setPhase,
    removeConfirmed,
    consumeReviewRequest,
    cartRevision,
    checkoutIntent,
    setCheckoutIntent,
    isOpen,
  } = useCart();
  const { address, isConnected, chainId, connector } = useAccount();
  const { requestNetworkForAction } = useRobinhoodNetworkGate();
  const { openConnectModal } = useWalletConnectModal();
  const { sendTransactionAsync } = useSendTransaction();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const [acceptedPriceDrift, setAcceptedPriceDrift] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<
    Array<{
      assetId: string;
      available: boolean;
      feeBps: number;
      routeStatus: import('@/lib/payment/selected-payment-status').RouteStatus;
      reasonCode?: string;
    }>
  >([]);
  const lastChainRef = useRef<number | undefined>(undefined);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const revisionRef = useRef(cartRevision);
  revisionRef.current = cartRevision;
  const resumeInFlight = useRef(false);
  const lastRevalidateRevision = useRef(-1);

  const onRobinhood = isRobinhoodChainId(chainId);
  const displayItems = currentCheckoutItems(phase, items);
  const validItems = validCheckoutItems(phase, items);
  const originalTotal = originalTotalDecimal(phase, items);
  const currentTotal = currentTotalDecimal(phase, items);
  const requiredRaw = requiredUsdgRaw(phase, items);
  const currency = checkoutCurrency(phase, items);
  const drifted = validItems.filter((it) => it.priceChanged);
  const unavailable = displayItems.filter((it) => it.state !== 'valid');

  // Selected-asset authority: a single hook reads the selected payment's
  // status (balance / allowance / routeStatus / required) from the server.
  // USDG state may not appear in checkout unless USDG is the selected input.
  const selectedAssetId =
    phase.kind === 'payment_select' ? paymentAssetIdForPhase(phase.payment.assetId) : null;
  const selectedConduitKey =
    phase.kind === 'payment_select'
      ? validCheckoutItems(phase, itemsRef.current)[0]?.liveConduitKey ?? null
      : null;
  const { status: selectedPaymentStatus } = useSelectedPaymentStatus({
    buyer: address ?? null,
    assetId: selectedAssetId,
    requiredUsdgRaw: requiredRaw > 0n ? requiredRaw : null,
    conduitKey: selectedConduitKey,
    enabled: phase.kind === 'payment_select' && Boolean(address) && onRobinhood,
  });

  // Telemetry: balance / allowance transitions. The OLD USDG-state code
  // fired these from a useEffect on usdgStatus. We preserve the same
  // signals but they now key off selectedPaymentStatus (any asset).
  const lastBalanceRef = useRef<string | null>(null);
  const lastAllowanceRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedPaymentStatus) return;
    const balanceState = selectedPaymentStatus.balance.state;
    const allowanceState =
      selectedPaymentStatus.allowance.kind === 'REQUIRED'
        ? selectedPaymentStatus.allowance.allowance.state
        : 'NOT_REQUIRED';
    if (
      lastBalanceRef.current === 'KNOWN_INSUFFICIENT' &&
      balanceState === 'KNOWN_SUFFICIENT'
    ) {
      recordCheckoutEvent('balance_sufficient_checkout_resumed', {
        cartRevision,
        checkoutState: 'payment_select',
      });
    }
    if (
      lastAllowanceRef.current === 'KNOWN_INSUFFICIENT' &&
      allowanceState === 'KNOWN_SUFFICIENT'
    ) {
      recordCheckoutEvent('allowance_sufficient_checkout_resumed', {
        cartRevision,
        checkoutState: 'payment_select',
      });
    }
    lastBalanceRef.current = balanceState;
    lastAllowanceRef.current = allowanceState;
  }, [selectedPaymentStatus, cartRevision]);

  const canBuy = validItems.length > 0 && (drifted.length === 0 || acceptedPriceDrift);
  const cta = useMemo(
    () =>
      deriveCheckoutCta({
        selected: selectedPaymentStatus ?? null,
        isConnected: Boolean(isConnected && address),
        onRobinhood,
        cartItemCount: validItems.length,
        canBuy,
      }),
    [address, isConnected, onRobinhood, validItems.length, canBuy, selectedPaymentStatus],
  );

  useEffect(() => {
    if (drifted.length === 0 && acceptedPriceDrift) setAcceptedPriceDrift(false);
  }, [acceptedPriceDrift, drifted.length]);

  const liveBind = useCallback(
    () =>
      checkoutRequestBind({
        cartRevision: revisionRef.current,
        address: address ?? null,
        chainId: chainId ?? null,
      }),
    [address, chainId],
  );

  const revalidate = useCallback(async (): Promise<boolean> => {
    if (!address) return false;
    const onChain = await requestNetworkForAction('checkout', 'revalidate');
    if (!onChain) {
      setPhase({ kind: 'network_required' });
      return false;
    }
    await assertWalletOnRobinhood({
      getChainId: connector?.getChainId?.bind(connector),
      chainId,
    });
    const bound = liveBind();
    const snapshot = itemsRef.current;
    if (snapshot.length === 0) {
      setPhase({ kind: 'browsing' });
      return false;
    }
    setPhase({ kind: 'revalidating' });
    try {
      const res = await fetch('/api/trade/cart/revalidate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          buyerAddress: address,
          items: snapshot.map((it) => ({
            tokenId: it.tokenId,
            contractAddress: it.contractAddress,
            displayedOrderHash: it.displayedOrderHash,
            displayedPriceRaw: it.displayedPriceRaw,
          })),
        }),
      });
      const json = (await res.json()) as { items?: RevalidateItem[]; error?: string };
      if (!isCheckoutResponseCurrent(bound, liveBind())) return false;
      if (!res.ok || !json.items) {
        setPhase({
          kind: 'error',
          message: json.error ?? `Revalidate failed (${res.status}).`,
        });
        return false;
      }
      const checkoutItems = asCheckoutItems(json.items);
      const membership = reconcileCheckoutWithCart({
        phase: { kind: 'review', items: checkoutItems },
        cartItems: itemsRef.current,
      });
      setPhase(membership.phase);
      return membership.phase.kind === 'review';
    } catch (err) {
      if (!isCheckoutResponseCurrent(bound, liveBind())) return false;
      setPhase({
        kind: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  }, [address, chainId, connector, liveBind, requestNetworkForAction, setPhase]);

  const onConnectWallet = useCallback(() => {
    setCheckoutIntent(true);
    recordCheckoutEvent('checkout_blocker_entered', {
      cartRevision,
      checkoutState: 'wallet_required',
    });
    setPhase({ kind: 'wallet_required' });
    openConnectModal();
  }, [cartRevision, openConnectModal, setCheckoutIntent, setPhase]);

  const onReview = useCallback(async () => {
    setCheckoutIntent(true);
    if (!address) {
      onConnectWallet();
      return;
    }
    if (!onRobinhood) {
      setPhase({ kind: 'network_required' });
      recordCheckoutEvent('checkout_blocker_entered', {
        cartRevision,
        checkoutState: 'network_required',
      });
      const switched = await requestNetworkForAction('checkout', 'network_required');
      if (!switched) return;
    }
    await revalidate();
  }, [
    address,
    cartRevision,
    onConnectWallet,
    onRobinhood,
    revalidate,
    requestNetworkForAction,
    setCheckoutIntent,
    setPhase,
  ]);

  const onApproveSelected = useCallback(async () => {
    if (phase.kind !== 'payment_select' || !address) return;
    const onChain = await requestNetworkForAction('approve', phase.kind);
    if (!onChain) return;
    await assertWalletOnRobinhood({
      getChainId: connector?.getChainId?.bind(connector),
      chainId,
    });
    // The approve target is the SELECTED asset, not USDG. Today this is
    // always USDG because no other route is AVAILABLE, but the contract
    // is now selected-asset-aware.
    const spender =
      selectedPaymentStatus?.allowance.kind === 'REQUIRED'
        ? selectedPaymentStatus.allowance.spender
        : null;
    if (!spender || !selectedPaymentStatus) {
      setPhase({
        kind: 'error',
        message: `${selectedPaymentStatus?.symbol ?? 'selected asset'} spender is unresolved; cannot approve.`,
      });
      return;
    }
    const required = boundedApproveAmount(
      selectedPaymentStatus.requiredInputRaw !== null
        ? BigInt(selectedPaymentStatus.requiredInputRaw)
        : requiredRaw,
    );
    const bound = liveBind();
    try {
      const hash = await writeContractAsync({
        // Approve the SELECTED asset's contract (USDG today). The
        // allowance target is the resolved Seaport conduit.
        address: PAYMENT_TOKENS.USDG.contractAddress,
        abi: erc20Abi,
        functionName: 'approve',
        args: [spender, required],
        chainId: ROBINHOOD_CHAIN.id,
      });
      if (!publicClient) throw new Error('No RPC client — cannot wait for approval.');
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== 'success') {
        throw new Error(`${selectedPaymentStatus.symbol} approval reverted (${hash})`);
      }
      if (!isCheckoutResponseCurrent(bound, liveBind())) return;
      const snapshot = validCheckoutItems(phase, itemsRef.current);
      const res = await fetch('/api/trade/cart/revalidate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          buyerAddress: address,
          items: snapshot.map((it) => ({
            tokenId: it.tokenId,
            contractAddress: it.cartItem.contractAddress,
            displayedOrderHash: it.liveOrderHash,
            displayedPriceRaw: String(it.livePriceRaw),
          })),
        }),
      });
      const json = (await res.json()) as { items?: RevalidateItem[]; error?: string };
      if (!isCheckoutResponseCurrent(bound, liveBind())) return;
      if (!res.ok || !json.items) {
        throw new Error(json.error ?? 'Listing revalidation after approval failed.');
      }
      setPhase({
        kind: 'payment_select',
        items: asCheckoutItems(json.items),
        payment: phase.payment,
      });
      recordCheckoutEvent('allowance_sufficient_checkout_resumed', {
        cartRevision: revisionRef.current,
        checkoutState: 'payment_select',
      });
    } catch (err) {
      setPhase({
        kind: 'error',
        message: checkoutFailureMessage(err),
      });
    }
  }, [
    address,
    chainId,
    connector,
    items,
    liveBind,
    phase,
    publicClient,
    requestNetworkForAction,
    requiredRaw,
    selectedPaymentStatus,
    setPhase,
    writeContractAsync,
  ]);

  const onCheckout = useCallback(async () => {
    if (phase.kind !== 'review' && phase.kind !== 'payment_select') return;
    // Selected-Payment Invariant: refuse to advance when the selected
    // route is not executable. The picker should already prevent this
    // (commit 4 closes the leak there) but the runtime guard here is
    // belt-and-suspenders — USDG state may not flow through checkout
    // for an asset that has no executable settlement route.
    if (phase.kind === 'payment_select') {
      if (selectedPaymentStatus === null) {
        setPhase({ kind: 'error', message: 'No payment method selected. Pay with USDG.' });
        return;
      }
      if (selectedPaymentStatus.routeStatus !== 'AVAILABLE') {
        setPhase({
          kind: 'error',
          message: `${selectedPaymentStatus.symbol} payments not available yet. Pay with USDG.`,
        });
        return;
      }
    }
    if (!address) {
      onConnectWallet();
      return;
    }
    const onChain = await requestNetworkForAction('purchase', phase.kind);
    if (!onChain) return;
    await assertWalletOnRobinhood({
      getChainId: connector?.getChainId?.bind(connector),
      chainId,
    });
    const starting = validCheckoutItems(phase, itemsRef.current);
    if (starting.length === 0) {
      setPhase({ kind: 'error', message: 'No items are available for purchase.' });
      return;
    }
    const confirmed: string[] = [];
    setPhase({ kind: 'executing', items: displayItems, currentIndex: 0, confirmedTokenIds: [] });
    for (let i = 0; i < starting.length; i += 1) {
      const it = starting[i];
      const liveCart = cartMembershipSet(itemsRef.current);
      if (!liveCart.has(cartAssetId(it.cartItem))) {
        continue;
      }
      setPhase({
        kind: 'executing',
        items: currentCheckoutItems(phase, itemsRef.current).length
          ? currentCheckoutItems({ kind: 'executing', items: displayItems, currentIndex: i, confirmedTokenIds: confirmed }, itemsRef.current)
          : displayItems,
        currentIndex: i,
        confirmedTokenIds: confirmed,
      });
      try {
        const bound = liveBind();
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
        if (!isCheckoutResponseCurrent(bound, liveBind())) {
          throw new Error('Cart changed during checkout; review again.');
        }
        if (!cartMembershipSet(itemsRef.current).has(cartAssetId(it.cartItem))) {
          continue;
        }
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
        if (!isCheckoutResponseCurrent(bound, liveBind())) {
          throw new Error('Cart changed during checkout; review again.');
        }
        if (!prepRes.ok || !prepJson.transaction) {
          throw new Error(prepJson.error ?? `prepare failed (${prepRes.status})`);
        }
        await assertWalletOnRobinhood({
          getChainId: connector?.getChainId?.bind(connector),
          chainId,
        });
        const tx = prepJson.transaction;
        const hash = await sendTransactionAsync({
          to: tx.to as `0x${string}`,
          data: (tx.data ?? '0x') as `0x${string}`,
          value: tx.value ? BigInt(tx.value) : BigInt(0),
          chainId: ROBINHOOD_CHAIN.id,
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
      } catch (err) {
        const confirmedItems = starting.filter((row) => confirmed.includes(row.tokenId));
        const failedItems = starting.filter(
          (row) =>
            !confirmed.includes(row.tokenId) &&
            cartMembershipSet(itemsRef.current).has(cartAssetId(row.cartItem)),
        );
        const message = checkoutFailureMessage(err);
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
    setCheckoutIntent(false);
    setPhase({
      kind: 'complete',
      confirmed: starting.filter((row) => confirmed.includes(row.tokenId)),
      failed: [],
    });
  }, [
    address,
    chainId,
    connector,
    displayItems,
    liveBind,
    onConnectWallet,
    phase,
    publicClient,
    removeConfirmed,
    requestNetworkForAction,
    selectedPaymentStatus,
    sendTransactionAsync,
    setCheckoutIntent,
    setPhase,
  ]);

  useEffect(() => {
    if (!isOpen || items.length === 0) return;
    if (phase.kind === 'executing' || phase.kind === 'complete' || phase.kind === 'revalidating') {
      return;
    }
    if (!isConnected) {
      if (checkoutIntent && phase.kind !== 'wallet_required') {
        setPhase({ kind: 'wallet_required' });
      }
      return;
    }
    if (!onRobinhood) {
      if (checkoutIntent && phase.kind !== 'network_required') {
        setPhase({ kind: 'network_required' });
        if (!resumeInFlight.current) {
          resumeInFlight.current = true;
          void requestNetworkForAction('checkout', 'network_required').then((ok) => {
            resumeInFlight.current = false;
            if (ok) {
              recordCheckoutEvent('network_corrected_checkout_resumed', {
                cartRevision: revisionRef.current,
                checkoutState: 'review',
              });
              void revalidate();
            }
          });
        }
      }
      return;
    }
    const shouldResume =
      checkoutIntent &&
      (phase.kind === 'wallet_required' ||
        phase.kind === 'network_required' ||
        (phase.kind === 'browsing' && consumeReviewRequest()));
    if (shouldResume && !resumeInFlight.current) {
      resumeInFlight.current = true;
      if (phase.kind === 'wallet_required') {
        recordCheckoutEvent('wallet_connected_checkout_resumed', {
          cartRevision,
          checkoutState: 'review',
        });
      }
      void revalidate().finally(() => {
        resumeInFlight.current = false;
      });
    }
  }, [
    cartRevision,
    checkoutIntent,
    consumeReviewRequest,
    isConnected,
    isOpen,
    items.length,
    onRobinhood,
    phase.kind,
    requestNetworkForAction,
    revalidate,
    setPhase,
  ]);

  // Chain-change invalidation. The selected-payment hook re-fetches when
  // its inputs change, but the chain is implicit in wagmi's address; we
  // bump the local revision so any stale status is cleared.
  useEffect(() => {
    const previous = lastChainRef.current;
    if (previous === undefined) {
      lastChainRef.current = chainId;
      return;
    }
    if (!shouldInvalidateChainSensitiveState(previous, chainId)) return;
    lastChainRef.current = chainId;
    lastBalanceRef.current = null;
    lastAllowanceRef.current = null;
    if (phase.kind === 'executing') {
      setPhase({ kind: 'network_required' });
    }
  }, [chainId, phase.kind, setPhase]);

  useEffect(() => {
    if (!checkoutIntent) return;
    if (phase.kind !== 'review' && phase.kind !== 'payment_select') return;
    const result = reconcileCheckoutWithCart({ phase, cartItems: items });
    if (result.needRevalidate && lastRevalidateRevision.current !== cartRevision) {
      lastRevalidateRevision.current = cartRevision;
      void revalidate();
    }
  }, [cartRevision, checkoutIntent, items, phase, revalidate]);

  useEffect(() => {
    if (phase.kind !== 'payment_select') return;
    let cancelled = false;
    void fetch('/api/payment/methods')
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (
          json: {
            methods?: Array<{
              assetId: string;
              available: boolean;
              feeBps: number;
              routeStatus: import('@/lib/payment/selected-payment-status').RouteStatus;
              routeReasonCode?: string | null;
              routeNote?: string | null;
              reasonCode?: string;
            }>;
          } | null,
        ) => {
        if (!cancelled && json?.methods) setPaymentMethods(json.methods);
      })
      .catch(() => {
        if (!cancelled) setPaymentMethods([]);
      });
    return () => {
      cancelled = true;
    };
  }, [phase.kind]);

  if (phase.kind === 'browsing' || phase.kind === 'wallet_required' || phase.kind === 'network_required') {
    const earlyCta = deriveCheckoutCta({
      selected: null,
      isConnected: Boolean(isConnected && address),
      onRobinhood,
      cartItemCount: validItems.length,
      canBuy,
    });
    return (
      <div className="flex flex-col gap-2">
        {!isConnected ? (
          <p className="text-[12px] text-[var(--color-text-tertiary)]">
            Your items remain saved. Connect your wallet to continue.
          </p>
        ) : !onRobinhood ? (
          <p className="text-[12px] text-[var(--color-text-tertiary)]">
            Switch to Robinhood Chain to continue this purchase.
          </p>
        ) : null}
        {earlyCta.kind === 'wallet_required' ? (
          <button type="button" onClick={onConnectWallet} className="nv-button w-full">
            <WalletIcon size={14} weight="duotone" />
            Connect wallet
          </button>
        ) : earlyCta.kind === 'switch_network' ? (
          <button
            type="button"
            onClick={() => {
              setCheckoutIntent(true);
              void onReview();
            }}
            className="nv-button w-full"
          >
            Switch to Robinhood Chain
          </button>
        ) : (
          <button
            type="button"
            disabled={items.length === 0 || earlyCta.kind === 'review_required'}
            onClick={() => void onReview()}
            className={cn(
              'nv-button w-full',
              (items.length === 0 || earlyCta.kind === 'review_required') &&
                'cursor-not-allowed opacity-50',
            )}
          >
            {earlyCta.kind === 'review_required'
              ? earlyCta.label
              : `Review ${items.length} item${items.length === 1 ? '' : 's'}`}
          </button>
        )}
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
        <button
          type="button"
          onClick={() => {
            setCheckoutIntent(false);
            setPhase({ kind: 'browsing' });
          }}
          className="nv-button-ghost text-sm"
        >
          Back to cart
        </button>
      </div>
    );
  }

  if (phase.kind === 'review') {
    return (
      <div className="flex flex-col gap-3">
        <ul className="flex max-h-56 flex-col gap-2 overflow-y-auto text-[12px]">
          {displayItems.map((it) => {
            if (it.state !== 'valid') {
              return (
                <li key={cartAssetId(it.cartItem)} className="flex items-center justify-between text-[var(--color-danger)]">
                  <span>#{it.tokenId}</span>
                  <span>✕ {it.state === 'unavailable' ? it.reason.replace('_', ' ') : 'error'}</span>
                </li>
              );
            }
            const was = it.cartItem.displayedPriceDecimal;
            return (
              <li key={cartAssetId(it.cartItem)} className="flex items-center justify-between gap-2">
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
                items: displayItems,
                payment: { assetId: 'USDG' },
              })
            }
            className={cn('nv-button w-full', !canBuy && 'cursor-not-allowed opacity-50')}
          >
            {validItems.length === 0 ? 'Nothing to buy' : 'Choose payment'}
          </button>
          <button
            type="button"
            onClick={() => {
              setAcceptedPriceDrift(false);
              setCheckoutIntent(false);
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
    // CTA comes from deriveCheckoutCta — one source of truth. USDG state
    // may not leak into non-USDG selections because deriveCheckoutCta
    // gates on selectedPaymentStatus, not on parallel USDG reads.
    const ctaDisabled =
      cta.kind === 'wallet_required' ||
      cta.kind === 'switch_network' ||
      cta.kind === 'route_unavailable' ||
      cta.kind === 'review_required' ||
      cta.kind === 'insufficient';
    const ctaOnClick = () => {
      if (ctaDisabled) return;
      if (cta.kind === 'approve') {
        void onApproveSelected();
        return;
      }
      if (cta.kind === 'continue') {
        void onCheckout();
        return;
      }
    };
    const visibleAssets = checkoutVisibleAssets();
    const pickerAvailability: PaymentAvailability[] = paymentMethods.length
      ? paymentMethods.map((m) => ({
          assetId: m.assetId,
          available: m.available,
          feeBps: m.feeBps,
          routeStatus: m.routeStatus,
        }))
      : visibleAssets.map((a) => ({
          assetId: a.assetId,
          available: a.status === 'ENABLED',
          feeBps: a.feeBps,
          routeStatus:
            a.status === 'DISABLED'
              ? ('UNSUPPORTED' as const)
              : a.assetId === 'usdg'
                ? ('AVAILABLE' as const)
                : ('COMING_SOON' as const),
        }));

    const serviceFeeBps = selectedPaymentStatus?.serviceFeeBps ?? 0;
    const feeLabel =
      serviceFeeBps === 0 ? '0.00 USDG' : `+${(serviceFeeBps / 100).toFixed(1)}% service fee`;

    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <CheckoutPaymentPicker
            assets={visibleAssets}
            availability={pickerAvailability}
            selectedAssetId={selectedAssetId ?? ''}
            onSelect={(assetId) => {
              const cartId = cartPaymentId(assetId);
              if (!cartId) return;
              setPhase({
                kind: 'payment_select',
                items: displayItems,
                payment: { assetId: cartId },
              });
            }}
            onSelectCrypto={(assetId) => {
              const cartId = cartPaymentId(assetId);
              if (!cartId) return;
              setPhase({
                kind: 'payment_select',
                items: displayItems,
                payment: { assetId: cartId },
              });
            }}
          />

          <div className="flex flex-col gap-3">
            <OrderSummary
              step={2}
              items={displayItems}
              currency={currency}
              subtotal={currentTotal}
              serviceFee={{ bps: serviceFeeBps, label: feeLabel }}
              selectedAsset={phase.payment.assetId}
              ctaLabel={cta.label}
              ctaOnClick={ctaOnClick}
              ctaDisabled={ctaDisabled}
              ctaNote={
                cta.kind === 'route_unavailable' && selectedPaymentStatus
                  ? `${selectedPaymentStatus.symbol} payments not available yet — pay with USDG.`
                  : 'By continuing, you agree to our Terms of Service and acknowledge our compliance requirements.'
              }
            />
          </div>
        </div>

        {selectedPaymentStatus && selectedPaymentStatus.routeStatus === 'AVAILABLE' ? (
          <PaymentStatusFooter status={selectedPaymentStatus} />
        ) : selectedPaymentStatus && selectedPaymentStatus.routeNote ? (
          <div className="flex flex-col gap-2 rounded-[16px] border border-[var(--color-border-subtle)] bg-[rgba(5,9,8,0.5)] p-3 text-[11px] text-[var(--color-text-tertiary)]">
            <p>{selectedPaymentStatus.routeNote}</p>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => setPhase({ kind: 'review', items: displayItems })}
          className="self-start text-[12px] text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)]"
        >
          ← Back to listings
        </button>
      </div>
    );
  }

  if (phase.kind === 'executing') {
    const total = validItems.length;
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
          onClick={() => {
            setCheckoutIntent(false);
            setPhase({ kind: 'browsing' });
          }}
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
          onClick={() => {
            setCheckoutIntent(false);
            setPhase({ kind: 'browsing' });
          }}
          className="nv-button-ghost text-sm"
        >
          Back to cart
        </button>
      </div>
    );
  }

  // Surface the symbol/amount helper so the formatter isn't tree-shaken
  // away when only used by the footer — it documents the contract.
  void formatSelectedAmount;

  return null;
}
