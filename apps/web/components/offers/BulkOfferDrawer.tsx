'use client';

import { useState } from 'react';
import { useAccount, useSignTypedData } from 'wagmi';
import { Drawer } from '@/components/ui/Drawer';
import { parseUsdgDecimalToRaw } from '@/lib/native-market/fees';
import type { Token } from '@/lib/market';

export function BulkOfferDrawer({
  open,
  onClose,
  tokens,
}: {
  open: boolean;
  onClose: () => void;
  tokens: Token[];
}) {
  const { address, isConnected } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  const [amount, setAmount] = useState('100');
  const [hours, setHours] = useState(24);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const cap = Math.min(tokens.length, 20);
  const selected = tokens.slice(0, 20);
  const liability = Number(amount) * cap;

  const run = async () => {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      const prepareRes = await fetch('/api/offers/bulk/prepare', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          buyerAddress: address,
          assets: selected.map((token) => ({
            ecosystemId: 'helix',
            collectionId: 'button-presser',
            tokenId: token.tokenId,
          })),
          strategy: { type: 'SAME_PRICE', offerUsdgRaw: parseUsdgDecimalToRaw(amount).toString() },
          expirationSeconds: hours * 3600,
          balanceUsdgRaw: parseUsdgDecimalToRaw(String(liability)).toString(),
        }),
      });
      const prepared = (await prepareRes.json()) as {
        groupId?: string;
        offers?: Array<{ offerId: string; typedData: Parameters<typeof signTypedDataAsync>[0] }>;
        message?: string;
      };
      if (!prepareRes.ok || !prepared.groupId || !prepared.offers) {
        throw new Error(prepared.message ?? 'Could not prepare bulk offers');
      }
      const signatures = [];
      for (const offer of prepared.offers) {
        const signature = await signTypedDataAsync(offer.typedData);
        signatures.push({ offerId: offer.offerId, signature });
      }
      const submitRes = await fetch('/api/offers/bulk/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          groupId: prepared.groupId,
          buyerAddress: address,
          signatures,
        }),
      });
      const submitted = (await submitRes.json()) as { groupStatus?: string; message?: string };
      if (!submitRes.ok) throw new Error(submitted.message ?? 'submit failed');
      setStatus(submitted.groupStatus ?? 'ACTIVE');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'bulk offer failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer open={open} onClose={onClose} title="Make bulk offer" width="md">
      {!isConnected ? (
        <p className="text-sm text-[var(--color-text-secondary)]">Connect a wallet to offer.</p>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-[var(--color-text-secondary)]">
            {cap} Button Pressers selected. V1 strategy is same price for each, as independent Seaport bids.
          </p>
          <label className="flex flex-col gap-1 text-sm">
            Same price (USDG each)
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-10 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-2)] px-3"
            />
          </label>
          <p className="text-numeral text-sm">Maximum commitment {liability} USDG</p>
          {status ? <p className="text-sm text-[var(--color-net-green)]">Group {status}.</p> : null}
          {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
          <button type="button" className="nv-button" disabled={loading || cap === 0} onClick={() => void run()}>
            {loading ? 'Signing offers…' : `Review and sign ${cap} offers`}
          </button>
        </div>
      )}
    </Drawer>
  );
}
