'use client';

import { useMemo, useState } from 'react';
import { useAccount, useSendTransaction } from 'wagmi';
import type { Offer } from '@/lib/market';
import { address, payment } from '@/lib/format';

function expiryLabel(epoch: number | null): string {
  if (!epoch) return 'no expiry';
  const diff = epoch - Math.floor(Date.now() / 1000);
  if (diff <= 0) return 'expired';
  if (diff < 3600) return `expires in ${Math.floor(diff / 60)}m`;
  if (diff < 86_400) return `expires in ${Math.floor(diff / 3600)}h`;
  return `expires in ${Math.floor(diff / 86_400)}d`;
}

type Phase =
  | { phase: 'idle' }
  | { phase: 'preparing'; orderHash: string }
  | { phase: 'signing'; orderHash: string }
  | { phase: 'sent'; hash: string }
  | { phase: 'error'; message: string };

export function OfferActions({
  tokenId,
  ownerAddress,
  offers,
}: {
  tokenId: string;
  ownerAddress: string | null;
  offers: Offer[];
}) {
  const { address: wallet, isConnected } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();
  const [state, setState] = useState<Phase>({ phase: 'idle' });
  const [declined, setDeclined] = useState<Set<string>>(new Set());

  const isOwner =
    Boolean(wallet) &&
    Boolean(ownerAddress) &&
    wallet!.toLowerCase() === ownerAddress!.toLowerCase();

  const visibleOffers = useMemo(
    () => offers.filter((offer) => !declined.has(offer.orderHash)),
    [declined, offers],
  );

  const accept = async (offer: Offer) => {
    if (!wallet) return;
    setState({ phase: 'preparing', orderHash: offer.orderHash });
    try {
      const res = await fetch('/api/trade/offer/accept', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          tokenId,
          sellerAddress: wallet,
          orderHash: offer.orderHash,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        reason?: string;
        transaction?: { to: string; data?: string; value?: string };
      };
      if (!res.ok || !data.transaction?.to) {
        setState({
          phase: 'error',
          message: data.reason ?? data.error ?? `request failed: ${res.status}`,
        });
        return;
      }
      setState({ phase: 'signing', orderHash: offer.orderHash });
      const hash = await sendTransactionAsync({
        to: data.transaction.to as `0x${string}`,
        data: (data.transaction.data ?? '0x') as `0x${string}`,
        value: data.transaction.value ? BigInt(data.transaction.value) : BigInt(0),
      });
      setState({ phase: 'sent', hash });
    } catch (err) {
      setState({
        phase: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  if (visibleOffers.length === 0) {
    return (
      <p className="text-sm text-[var(--color-text-secondary)]">
        No open offers on this token right now.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col divide-y divide-[var(--color-border-subtle)]">
        {visibleOffers.map((offer) => (
          <li key={offer.orderHash} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
            <div className="flex items-baseline gap-3">
              <span className="text-numeral text-sm font-semibold text-[var(--color-text-primary)]">
                {payment(offer.price, offer.currency)}
              </span>
              <span className="text-[11px] text-[var(--color-text-tertiary)]">
                from {address(offer.maker)}
              </span>
              <span className="ml-auto text-numeral text-[11px] text-[var(--color-text-tertiary)]">
                {expiryLabel(offer.expiresAt)}
              </span>
            </div>
            {isOwner && isConnected ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="nv-button"
                  disabled={state.phase === 'preparing' || state.phase === 'signing'}
                  onClick={() => void accept(offer)}
                >
                  {state.phase !== 'idle' &&
                  'orderHash' in state &&
                  state.orderHash === offer.orderHash
                    ? state.phase === 'preparing'
                      ? 'Preparing...'
                      : 'Sign in wallet...'
                    : 'Accept offer'}
                </button>
                <button
                  type="button"
                  className="nv-button nv-button-ghost"
                  onClick={() =>
                    setDeclined((current) => new Set(current).add(offer.orderHash))
                  }
                >
                  Decline
                </button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {isOwner ? (
        <p className="text-[11px] text-[var(--color-text-tertiary)]">
          Decline hides the offer on Net Vision. It stays open on OpenSea until the bidder
          cancels it or it expires.
        </p>
      ) : (
        <p className="text-[11px] text-[var(--color-text-tertiary)]">
          Connect the owner wallet to accept or decline incoming offers.
        </p>
      )}
      {state.phase === 'sent' ? (
        <p className="text-sm text-[var(--color-net-green)]">Offer accepted. Tx {state.hash}</p>
      ) : null}
      {state.phase === 'error' ? (
        <p className="text-sm text-[var(--color-danger)]">{state.message}</p>
      ) : null}
    </div>
  );
}
