'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@/components/ConnectButton';
import { BuyDrawer } from '@/components/BuyDrawer';
import { ArrowUR, WalletIcon } from '@/components/icons';

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
    <div className="flex flex-col gap-5">
      <dl className="nv-panel-soft divide-y divide-[var(--nv-border)] p-4">
        <Row label="Best ask" value={ask} emphasis />
        <Row label="Last sale" value={lastSale} />
      </dl>

      <div className="flex flex-col gap-2">
        <motion.button
          type="button"
          onClick={() => (isConnected ? setBuying(true) : null)}
          className={`nv-button ${isConnected ? '' : 'nv-button-disabled'}`}
          disabled={!isConnected}
          whileTap={{ scale: 0.98 }}
        >
          {isConnected ? 'Buy now' : 'Connect to buy'}
        </motion.button>
        <motion.button
          type="button"
          className="nv-button nv-button-ghost nv-button-disabled"
          disabled
          whileTap={{ scale: 0.98 }}
        >
          Make offer
        </motion.button>
        <motion.button
          type="button"
          className="nv-button nv-button-ghost nv-button-disabled"
          disabled
          whileTap={{ scale: 0.98 }}
        >
          Add to cart
        </motion.button>
      </div>

      <div className="flex items-center gap-3 text-xs text-[var(--nv-muted)]">
        <a
          href={openseaUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 transition-colors hover:text-[var(--nv-text)]"
        >
          View on OpenSea
          <ArrowUR size={12} weight="bold" />
        </a>
        {!isConnected ? (
          <span className="ml-auto inline-flex items-center gap-1.5">
            <WalletIcon size={12} weight="duotone" />
            <ConnectButton />
          </span>
        ) : null}
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
    <div className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
      <dt className="nv-label">{label}</dt>
      <dd
        className={
          emphasis
            ? 'nv-numeral text-2xl font-semibold'
            : 'nv-mono text-sm text-[var(--nv-text-soft)]'
        }
      >
        {value !== null && Number.isFinite(value) ? `${value} ETH` : '—'}
      </dd>
    </div>
  );
}