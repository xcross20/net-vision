'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@/components/ConnectButton';
import { BuyDrawer } from '@/components/BuyDrawer';

export function TokenCommercePanel({
  tokenId,
  imageUrl,
  ask,
  lastSale,
  openseaUrl,
}: {
  tokenId: string;
  imageUrl: string;
  ask: number | null;
  lastSale: number | null;
  openseaUrl: string;
}) {
  const [buying, setBuying] = useState(false);
  const { isConnected } = useAccount();
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 border-y border-[var(--nv-border)] py-4">
        <Row label="Best ask" value={ask} emphasis />
        <Row label="Last sale" value={lastSale} />
      </div>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => (isConnected ? setBuying(true) : null)}
          className={`nv-button ${isConnected ? '' : 'nv-button-disabled'}`}
          disabled={!isConnected}
        >
          {isConnected ? 'Buy now' : 'Connect to buy'}
        </button>
        <button type="button" className="nv-button nv-button-ghost nv-button-disabled" disabled>
          Make offer
        </button>
        <button type="button" className="nv-button nv-button-ghost nv-button-disabled" disabled>
          Add to cart
        </button>
      </div>
      <div className="flex items-center gap-2 text-xs text-[var(--nv-muted)]">
        <a href={openseaUrl} target="_blank" rel="noreferrer" className="hover:text-[var(--nv-text)]">
          View on OpenSea ↗
        </a>
        <span className="ml-auto">
          <ConnectButton />
        </span>
      </div>
      {buying ? (
        <BuyDrawer
          tokenId={tokenId}
          imageUrl={imageUrl}
          fallbackPrice={ask !== null ? ask.toString() : null}
          onClose={() => setBuying(false)}
        />
      ) : null}
    </div>
  );
}

function Row({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: number | null;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-[var(--nv-muted)]">{label}</span>
      <span
        className={
          emphasis
            ? 'text-2xl font-semibold nv-mono'
            : 'text-sm nv-mono'
        }
      >
        {value === null
          ? '—'
          : value.toFixed(value < 1 ? 4 : 3) + ' ETH'}
      </span>
    </div>
  );
}
