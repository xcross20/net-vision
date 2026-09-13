/**
 * Client-side hook for the selected-payment status of the checkout flow.
 *
 * The selected-payment invariant forbids letting the picker fall back to a
 * USDG-state view when a non-USDG asset is selected. This hook is the only
 * path through which the checkout component reads payment state for the
 * SELECTED asset — it calls /api/payment/status, polls every 8 seconds,
 * cancels in-flight fetches when the inputs change, and resets state
 * cleanly when no payment is selected.
 *
 * See docs/launch/CHECKOUT_PAYMENT_STATE.md for the Selected-Payment
 * Invariant and §4 for the request/response contract.
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import type { Address } from 'viem';

import type { SelectedPaymentStatus } from './selected-payment-status';

export type UseSelectedPaymentStatusInput = {
  /** Connected buyer address. Null when the wallet is not connected. */
  buyer: Address | null;
  /** The router assetId (e.g. 'usdg', 'eth', 'rh-aapl'). Null when no payment is selected. */
  assetId: string | null;
  /** Cart total in USDG (6dp bigint). Null when the cart is empty. */
  requiredUsdgRaw: bigint | null;
  /** Conduit key from the revalidated listings (USDG path only). */
  conduitKey: string | null;
  /** Set false to pause polling (e.g. outside the payment_select phase). */
  enabled: boolean;
};

export type UseSelectedPaymentStatusResult = {
  status: SelectedPaymentStatus | null;
  loading: boolean;
  error: string | null;
};

/**
 * Pure helper: build the POST body the hook sends to /api/payment/status.
 * Exposed so it can be unit-tested without React. The hook passes the
 * returned init to fetch().
 */
export function buildPaymentStatusRequest(input: {
  buyer: Address;
  assetId: string;
  requiredUsdgRaw: bigint | null;
  conduitKey: string | null;
}): {
  url: string;
  init: { method: 'POST'; headers: Record<string, string>; body: string };
} {
  return {
    url: '/api/payment/status',
    init: {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        buyer: input.buyer,
        assetId: input.assetId,
        requiredUsdgRaw:
          input.requiredUsdgRaw === null ? null : input.requiredUsdgRaw.toString(),
        conduitKey: input.conduitKey,
      }),
    },
  };
}

/**
 * Fetch the SelectedPaymentStatus for the (buyer, asset, cart) tuple and
 * poll every 8 seconds. Cancels any in-flight fetch when the inputs
 * change so a previous asset's response cannot bleed into the new asset's
 * state — that bleed is exactly the bug the invariant forbids.
 */
export function useSelectedPaymentStatus(
  input: UseSelectedPaymentStatusInput,
): UseSelectedPaymentStatusResult {
  const [status, setStatus] = useState<SelectedPaymentStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqRef = useRef(0);

  useEffect(() => {
    if (!input.enabled || !input.buyer || !input.assetId) {
      // No selection — clear state so the previous asset's status cannot
      // leak into the next render.
      reqRef.current += 1;
      setStatus(null);
      setError(null);
      setLoading(false);
      return;
    }

    const buyer = input.buyer;
    const assetId = input.assetId;
    const requiredUsdgRaw = input.requiredUsdgRaw;
    const conduitKey = input.conduitKey;
    const reqId = ++reqRef.current;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const req = buildPaymentStatusRequest({
          buyer,
          assetId,
          requiredUsdgRaw,
          conduitKey,
        });
        const res = await fetch(req.url, req.init);
        if (cancelled || reqId !== reqRef.current) return;
        if (!res.ok) {
          setError(`payment status ${res.status}`);
          setStatus(null);
          setLoading(false);
          return;
        }
        const json = (await res.json()) as SelectedPaymentStatus;
        if (cancelled || reqId !== reqRef.current) return;
        setStatus(json);
        setError(null);
      } catch (err) {
        if (cancelled || reqId !== reqRef.current) return;
        setError(err instanceof Error ? err.message : String(err));
        setStatus(null);
      } finally {
        if (!cancelled && reqId === reqRef.current) {
          setLoading(false);
        }
      }
    };

    void load();
    const interval = window.setInterval(() => void load(), 8000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
    // We deliberately depend on the string form of requiredUsdgRaw so
    // bigint reference changes (which happen every render) do not refetch.
  }, [
    input.enabled,
    input.buyer,
    input.assetId,
    input.requiredUsdgRaw === null ? null : input.requiredUsdgRaw.toString(),
    input.conduitKey,
  ]);

  return { status, loading, error };
}
