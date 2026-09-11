'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAccount, usePublicClient, useSendTransaction, useWriteContract } from 'wagmi';
import { erc20Abi } from 'viem';
import { SpinnerIcon, WarnIcon, CheckIcon, WalletIcon } from '@/components/icons';
import { cn } from '@/lib/cn';
import { useCart } from '@/lib/cart/CartProvider';
import type { CartItem, CheckoutItem } from '@/lib/cart/types';
import {
  assertCanMarkConfirmed,
  assertCanPreparePurchase,
  assertCanSelectPaymentAsset,
  isExecutablePaymentAsset,
  type PaymentAssetId,
} from '@/lib/cart/checkout-machine';
import { PAYMENT_TOKENS, ROBINHOOD_CHAIN } from '@net-vision/chain-config';
import { checkoutVisibleAssets } from '@net-vision/payment-router';
import { payment } from '@/lib/format';
import type { UsdgStatus } from '@/lib/trade/usdg-status';
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
import { primaryCheckoutAction } from '@/lib/cart/primary-action';
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
  const [usdgStatus, setUsdgStatus] = useState<UsdgStatus | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<
    Array<{
      assetId: string;
      available: boolean;
      feeBps: number;
      routeStatus?: string;
      reasonCode?: string;
    }>
  >([]);
  const [usdgQuote, setUsdgQuote] = useState<{
    listingUsdgRaw: string;
    serviceFeeBps: number;
    serviceFeeUsdgRaw: string;
    requiredUsdgRaw: string;
  } | null>(null);
  const lastChainRef = useRef<number | undefined>(undefined);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const revisionRef = useRef(cartRevision);
  revisionRef.current = cartRevision;
  const lastBalanceState = useRef<string | null>(null);
  const lastAllowanceState = useRef<string | null>(null);
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

  const onApproveUsdg = useCallback(async () => {
    if (phase.kind !== 'payment_select' || !address) return;
    const onChain = await requestNetworkForAction('approve', phase.kind);
    if (!onChain) return;
    await assertWalletOnRobinhood({
      getChainId: connector?.getChainId?.bind(connector),
      chainId,
    });
    const spender = usdgStatus?.spender.address;
    if (!spender) {
      setPhase({ kind: 'error', message: 'USDG spender is unresolved; cannot approve.' });
      return;
    }
    const required = boundedApproveAmount(requiredRaw);
    const bound = liveBind();
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
      setUsdgStatus(null);
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
    setPhase,
    usdgStatus,
    writeContractAsync,
  ]);

  const onCheckout = useCallback(async () => {
    if (phase.kind !== 'review' && phase.kind !== 'payment_select') return;
    if (phase.kind === 'payment_select' && phase.payment.assetId !== 'USDG') {
      setPhase({
        kind: 'error',
        message: 'Stock Token conversion to USDG is not live. Pay with USDG.',
      });
      return;
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
    try {
      assertCanSelectPaymentAsset('USDG');
    } catch (err) {
      setPhase({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
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

  useEffect(() => {
    const previous = lastChainRef.current;
    if (previous === undefined) {
      lastChainRef.current = chainId;
      return;
    }
    if (!shouldInvalidateChainSensitiveState(previous, chainId)) return;
    lastChainRef.current = chainId;
    setUsdgStatus(null);
    if (phase.kind === 'executing') {
      setPhase({ kind: 'network_required' });
    }
  }, [chainId, phase.kind, setPhase]);

  useEffect(() => {
    if (phase.kind !== 'payment_select' || !address || !onRobinhood) {
      setUsdgStatus(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      const bound = liveBind();
      const required = requiredUsdgRaw(phase, itemsRef.current);
      const valid = validCheckoutItems(phase, itemsRef.current);
      const conduitKey = valid[0]?.liveConduitKey ?? '';
      const qs = new URLSearchParams({
        buyer: address,
        requiredRaw: required.toString(),
      });
      if (conduitKey) qs.set('conduitKey', conduitKey);
      try {
        const res = await fetch(`/api/trade/usdg-status?${qs.toString()}`);
        const json = (await res.json()) as UsdgStatus | null;
        if (cancelled || !isCheckoutResponseCurrent(bound, liveBind())) return;
        if (res.ok && json) {
          if (
            lastBalanceState.current === 'KNOWN_INSUFFICIENT' &&
            json.balance.state === 'KNOWN_SUFFICIENT'
          ) {
            recordCheckoutEvent('balance_sufficient_checkout_resumed', {
              cartRevision: revisionRef.current,
              checkoutState: 'payment_select',
            });
          }
          if (
            lastAllowanceState.current === 'KNOWN_INSUFFICIENT' &&
            json.allowance.state === 'KNOWN_SUFFICIENT'
          ) {
            recordCheckoutEvent('allowance_sufficient_checkout_resumed', {
              cartRevision: revisionRef.current,
              checkoutState: 'payment_select',
            });
          }
          lastBalanceState.current = json.balance.state;
          lastAllowanceState.current = json.allowance.state;
          setUsdgStatus(json);
        }
      } catch {
        if (!cancelled) setUsdgStatus(null);
      }
    };
    void load();
    const interval = window.setInterval(() => void load(), 8000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [address, liveBind, onRobinhood, phase, cartRevision]);

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
              routeStatus?: string;
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

  useEffect(() => {
    if (phase.kind !== 'payment_select' || !address || requiredRaw <= 0n) {
      setUsdgQuote(null);
      return;
    }
    const listingOrderHash =
      validCheckoutItems(phase, itemsRef.current)
        .map((item) => item.liveOrderHash)
        .join(',') || 'cart';
    let cancelled = false;
    void fetch('/api/payment/quote', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        buyer: address,
        assetId: 'usdg',
        listingOrderHash,
        listingUsdgRaw: requiredRaw.toString(),
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (json: {
          quote?: {
            listingUsdgRaw: string;
            serviceFeeBps: number;
            serviceFeeUsdgRaw: string;
            requiredUsdgRaw: string;
          };
        } | null) => {
          if (!cancelled && json?.quote) {
            setUsdgQuote({
              listingUsdgRaw: json.quote.listingUsdgRaw,
              serviceFeeBps: json.quote.serviceFeeBps,
              serviceFeeUsdgRaw: json.quote.serviceFeeUsdgRaw,
              requiredUsdgRaw: json.quote.requiredUsdgRaw,
            });
          }
        },
      )
      .catch(() => {
        if (!cancelled) setUsdgQuote(null);
      });
    return () => {
      cancelled = true;
    };
  }, [address, cartRevision, phase.kind, requiredRaw]);

  const cta = useMemo(
    () =>
      primaryCheckoutAction({
        itemCount: items.length,
        connected: Boolean(isConnected && address),
        onRobinhood,
        phase,
        allowanceInsufficient: usdgStatus?.allowance.state === 'KNOWN_INSUFFICIENT',
        balanceInsufficient: usdgStatus?.balance.state === 'KNOWN_INSUFFICIENT',
        approveAmountLabel: payment(currentTotal, currency),
      }),
    [address, currency, currentTotal, isConnected, items.length, onRobinhood, phase, usdgStatus],
  );

  if (phase.kind === 'browsing' || phase.kind === 'wallet_required' || phase.kind === 'network_required') {
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
        {cta?.kind === 'connect_wallet' ? (
          <button type="button" onClick={onConnectWallet} className="nv-button w-full">
            <WalletIcon size={14} weight="duotone" />
            Connect wallet
          </button>
        ) : cta?.kind === 'switch_network' ? (
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
            disabled={items.length === 0}
            onClick={() => void onReview()}
            className={cn('nv-button w-full', items.length === 0 && 'cursor-not-allowed opacity-50')}
          >
            {cta?.label ?? `Review ${items.length} item${items.length === 1 ? '' : 's'}`}
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
    const canBuy = validItems.length > 0 && (drifted.length === 0 || acceptedPriceDrift);
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
    const stockSelected = phase.payment.assetId !== 'USDG';
    const insufficient = usdgStatus?.balance.state === 'KNOWN_INSUFFICIENT';
    const needsApprove = usdgStatus?.allowance.state === 'KNOWN_INSUFFICIENT';
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
        {usdgQuote ? (
          <div className="flex flex-col gap-1 text-[12px] text-[var(--color-text-secondary)]">
            <div className="flex justify-between">
              <span>NFT price</span>
              <span className="text-numeral text-[var(--color-text-primary)]">
                {payment(currentTotal, currency)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Service fee</span>
              <span>
                {usdgQuote.serviceFeeBps === 0
                  ? 'FREE'
                  : `+${(usdgQuote.serviceFeeBps / 100).toFixed(1)}%`}
              </span>
            </div>
          </div>
        ) : null}
        <ul className="flex flex-col gap-2">
          {checkoutVisibleAssets()
            .filter((asset) => asset.kind !== 'stock-token')
            .map((asset) => {
              const cartId = cartPaymentId(asset.assetId);
              const selected = cartId !== null && phase.payment.assetId === cartId;
              const executable = cartId !== null && isExecutablePaymentAsset(cartId);
              const method = paymentMethods.find((m) => m.assetId === asset.assetId);
              const feeLabel =
                method?.feeBps === 0
                  ? 'FREE'
                  : method?.feeBps
                    ? `+${(method.feeBps / 100).toFixed(1)}%`
                    : null;
              return (
                <li key={asset.assetId}>
                  <button
                    type="button"
                    disabled={!executable}
                    onClick={() => {
                      if (!cartId || !executable) return;
                      assertCanSelectPaymentAsset(cartId);
                      setPhase({
                        kind: 'payment_select',
                        items: displayItems,
                        payment: { assetId: cartId },
                      });
                    }}
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
                        {asset.symbol === 'NET' ? 'NET (NetNet)' : asset.symbol}
                      </span>
                      <span className="text-[var(--color-text-tertiary)]">
                        {asset.assetId === 'usdg' ? 'Direct' : `${asset.symbol} → USDG`}
                      </span>
                    </span>
                    <span className="text-[var(--color-text-tertiary)]">
                      {executable
                        ? `Recommended${feeLabel ? ` · ${feeLabel}` : ''}`
                        : 'Coming soon'}
                    </span>
                  </button>
                </li>
              );
            })}
        </ul>
        <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">
          Stock Tokens
        </p>
        <ul className="flex flex-col gap-2">
          {checkoutVisibleAssets()
            .filter((asset) => asset.kind === 'stock-token')
            .map((asset) => {
              const cartId = cartPaymentId(asset.assetId);
              const method = paymentMethods.find((m) => m.assetId === asset.assetId);
              const regionBlocked =
                method?.reasonCode === 'REGION_RESTRICTED' || method?.reasonCode === 'REGION_UNKNOWN';
              const geoAllowed = method?.available === true;
              const selected = cartId !== null && phase.payment.assetId === cartId;
              const feeLabel = `+${((method?.feeBps ?? asset.feeBps) / 100).toFixed(1)}%`;
              return (
                <li key={asset.assetId}>
                  <button
                    type="button"
                    disabled={!geoAllowed || !cartId}
                    onClick={() => {
                      if (!cartId || !geoAllowed) return;
                      setPhase({
                        kind: 'payment_select',
                        items: displayItems,
                        payment: { assetId: cartId },
                      });
                    }}
                    className={cn(
                      'flex w-full items-start justify-between rounded-[var(--radius-sm)] border px-3 py-2 text-left text-[12px]',
                      selected && geoAllowed
                        ? 'border-[var(--color-net-green)] bg-[rgba(72,235,145,0.08)]'
                        : 'border-[var(--color-border-subtle)]',
                      (!geoAllowed || !cartId) && 'cursor-not-allowed opacity-50',
                    )}
                  >
                    <span className="flex flex-col gap-0.5">
                      <span className="font-semibold text-[var(--color-text-primary)]">
                        {selected ? '● ' : '○ '}
                        {asset.symbol}
                      </span>
                      <span className="text-[var(--color-text-tertiary)]">
                        {asset.symbol} → USDG
                      </span>
                    </span>
                    <span className="text-[var(--color-text-tertiary)]">
                      {regionBlocked
                        ? 'Unavailable in your region'
                        : geoAllowed
                          ? `${feeLabel} · convert to USDG`
                          : `Coming soon · ${feeLabel}`}
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
            Required:{' '}
            <span className="text-numeral">{payment(currentTotal, currency)}</span>
          </p>
          <p>
            Spender:{' '}
            {usdgStatus?.spender.address
              ? `${usdgStatus.spender.source} ${usdgStatus.spender.address.slice(0, 10)}…`
              : 'unresolved'}
          </p>
          <p>{usdgStatus?.spender.note ?? 'Unknown is never shown as 0.'}</p>
        </div>
        {insufficient ? (
          <div className="rounded-[var(--radius-sm)] border border-[var(--color-warning)] px-3 py-2 text-[12px] text-[var(--color-text-primary)]">
            Insufficient USDG. Add funds — this checkout will continue automatically when the
            balance covers {payment(currentTotal, currency)}.
          </div>
        ) : null}
        {stockSelected ? (
          <div className="rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] px-3 py-2 text-[12px] text-[var(--color-text-primary)]">
            {phase.payment.assetId} is allowed outside the US. Conversion to USDG is not live yet —
            complete this purchase with USDG.
          </div>
        ) : null}
        {stockSelected ? (
          <button type="button" disabled className="nv-button w-full cursor-not-allowed opacity-50">
            Conversion to USDG not live
          </button>
        ) : needsApprove && !insufficient ? (
          <button type="button" onClick={() => void onApproveUsdg()} className="nv-button w-full">
            Approve {payment(currentTotal, currency)}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void onCheckout()}
            disabled={insufficient || usdgStatus?.spender.address == null || needsApprove}
            className={cn(
              'nv-button w-full',
              (insufficient || usdgStatus?.spender.address == null || needsApprove) &&
                'cursor-not-allowed opacity-50',
            )}
          >
            {insufficient ? 'Insufficient USDG' : 'Review purchase'}
          </button>
        )}
        <button
          type="button"
          onClick={() => setPhase({ kind: 'review', items: displayItems })}
          className="text-[12px] text-[var(--color-text-tertiary)]"
        >
          Back to listings
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
