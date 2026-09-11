'use client';

import { motion } from 'framer-motion';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@/components/ConnectButton';
import { AddToCartButton, BuyNowButton } from '@/components/cart';
import { ArrowUR, WalletIcon } from '@/components/icons';
import { ROBINHOOD_CHAIN } from '@net-vision/chain-config';
import type { Token } from '@/lib/market';

export function TokenCommercePanel({
  tokenId,
  imageUrl,
  ask,
  lastSale,
  openseaUrl,
  contractAddress,
  currency,
  listingOrderHash,
  listingPriceRaw,
}: {
  tokenId: string;
  imageUrl: string;
  ask: number | null;
  lastSale: number | null;
  openseaUrl: string;
  contractAddress: string;
  currency: string;
  listingOrderHash?: string | null;
  listingPriceRaw?: string | null;
}) {
  const { isConnected } = useAccount();
  const token: Token = {
    tokenId,
    contractAddress,
    chainId: ROBINHOOD_CHAIN.id,
    imageUrl,
    name: `#${tokenId}`,
    listingPrice: ask,
    currency,
    listingOrderHash: listingOrderHash ?? null,
    listingPriceRaw: listingPriceRaw ?? null,
    lastSalePrice: lastSale,
    ownerAddress: null,
    traits: [],
    rarityRank: null,
    listedAt: null,
    lastSaleAt: null,
  };
  const draft = { token, displayedPriceDecimal: ask !== null ? String(ask) : null };
  return (
    <div className="flex flex-col gap-5">
      <dl className="nv-panel-soft divide-y divide-[var(--nv-border)] p-4">
        <Row label="Best ask" value={ask} currency={currency} emphasis />
        <Row label="Last sale" value={lastSale} currency={currency} />
      </dl>

      <div className="flex flex-col gap-2 sm:flex-row">
        <BuyNowButton
          draft={draft}
          disabled={!isConnected || ask === null}
          label={isConnected ? 'Buy now' : 'Connect to buy'}
        />
        <AddToCartButton variant="primary" draft={draft} />
        <motion.button
          type="button"
          className="nv-button nv-button-ghost nv-button-disabled"
          disabled
          whileTap={{ scale: 0.98 }}
        >
          Make offer
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
    </div>
  );
}

function Row({
  label,
  value,
  currency,
  emphasis = false,
}: {
  label: string;
  value: number | null;
  currency: string;
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
        {value !== null && Number.isFinite(value) ? `${value} ${currency}` : '—'}
      </dd>
    </div>
  );
}