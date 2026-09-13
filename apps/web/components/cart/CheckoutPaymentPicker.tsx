'use client';

import { useMemo } from 'react';
import { Hex, CheckIcon } from '@/components/icons';
import { cn } from '@/lib/cn';
import type { PaymentAsset } from '@net-vision/payment-router';
import type { RouteStatus } from '@/lib/payment/selected-payment-status';
import { StockTickerGlyph } from './StockTickerGlyph';

export type PaymentAvailability = {
  assetId: string;
  available: boolean;
  feeBps: number;
  /**
   * The UI-level routeStatus for this asset. Drives selection gating
   * and tile labels per the Selected-Payment Invariant.
   * See docs/launch/CHECKOUT_PAYMENT_STATE.md §5.2.
   */
  routeStatus: RouteStatus;
  /** Machine-readable code from the backend; null when not provided. */
  routeReasonCode?: string | null;
  /** Human-readable explanation; null when not provided. */
  routeNote?: string | null;
};

type Group = {
  kind: 'core' | 'stock';
  title: string;
  description: string;
  badge: string;
  badgeTone: 'green' | 'amber';
  assets: PaymentAsset[];
};

export function CheckoutPaymentPicker({
  assets,
  availability,
  selectedAssetId,
  onSelect,
  onSelectCrypto,
}: {
  assets: PaymentAsset[];
  availability: PaymentAvailability[];
  selectedAssetId: string;
  onSelect: (assetId: string) => void;
  onSelectCrypto: (assetId: string) => void;
}) {
  const groups = useMemo(() => buildGroups(assets), [assets]);
  return (
    <section
      aria-label="Select payment method"
      className="nv-glass-2 flex flex-col gap-5 rounded-[20px] p-5"
    >
      {groups.map((group) => (
        <PaymentGroup
          key={group.kind}
          group={group}
          availability={availability}
          selectedAssetId={selectedAssetId}
          onSelect={onSelect}
          onSelectCrypto={onSelectCrypto}
        />
      ))}

      <footer className="flex flex-wrap items-center gap-3 rounded-[14px] border border-[var(--color-border-subtle)] bg-[rgba(5,9,8,0.5)] px-4 py-3 text-[11px] text-[var(--color-text-tertiary)]">
        <span className="inline-flex items-center gap-1.5">
          <Hex size={11} weight="bold" className="text-[var(--color-net-green)]" />
          Secure. Compliant. Global.
        </span>
        <span className="text-[var(--color-text-tertiary)]/80">·</span>
        <span>
          All transactions are powered by secure on-chain infrastructure with AML/KYC compliance.
        </span>
        <span className="text-[var(--color-text-tertiary)]/80">·</span>
        <span>Availability of payment methods may vary by region.</span>
      </footer>
    </section>
  );
}

function PaymentGroup({
  group,
  availability,
  selectedAssetId,
  onSelect,
  onSelectCrypto,
}: {
  group: Group;
  availability: PaymentAvailability[];
  selectedAssetId: string;
  onSelect: (assetId: string) => void;
  onSelectCrypto: (assetId: string) => void;
}) {
  return (
    <article className="flex flex-col gap-3 rounded-[16px] border border-[var(--color-border-subtle)] bg-[rgba(7,14,11,0.55)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-[10px] border border-[var(--color-net-green)]/30 bg-[rgba(72,235,145,0.1)] text-[var(--color-net-green)]">
            <Hex size={14} weight="bold" />
          </span>
          <div className="flex flex-col gap-0.5">
            <h3 className="text-[14px] font-semibold text-[var(--color-text-primary)]">
              {group.title}
            </h3>
            <p className="text-[11px] text-[var(--color-text-secondary)]">{group.description}</p>
          </div>
        </div>
        <span
          className={cn(
            'rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide',
            group.badgeTone === 'green'
              ? 'border border-[var(--color-net-green)]/40 bg-[var(--color-net-green)]/10 text-[var(--color-net-green)]'
              : 'border border-[#E4A24C]/40 bg-[#E4A24C]/10 text-[#F0C68A]',
          )}
        >
          {group.badge}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {group.assets.map((asset) => {
          const method = availability.find((m) => m.assetId === asset.assetId);
          // routeStatus is the single authority on whether this tile is
          // selectable. Conflating `available` with `routeStatus` was the
          // original bug — ETH/NET are policy-allowed but routeStatus
          // is COMING_SOON, so they must render disabled.
          const routeStatus: RouteStatus =
            method?.routeStatus ?? deriveFallbackRouteStatus(asset);
          const offered = routeStatus === 'AVAILABLE';
          const regionBlocked = routeStatus === 'REGION_RESTRICTED';
          const comingSoon = routeStatus === 'COMING_SOON';
          const selected = selectedAssetId === asset.assetId;
          const isCore = group.kind === 'core';
          return (
            <PaymentTile
              key={asset.assetId}
              asset={asset}
              isCore={isCore}
              routeStatus={routeStatus}
              offered={offered}
              regionBlocked={regionBlocked}
              comingSoon={comingSoon}
              feeBps={method?.feeBps ?? asset.feeBps}
              selected={selected}
              onSelect={() => {
                if (!offered) return;
                if (isCore) onSelectCrypto(asset.assetId);
                else onSelect(asset.assetId);
              }}
            />
          );
        })}
      </div>
    </article>
  );
}

/**
 * Last-resort fallback when /api/payment/methods has not responded yet.
 * Approximates the server's mapping without country context:
 *   - USDG has a direct settlement route, so AVAILABLE
 *   - ETH / NetNet NET have no router pinned yet, so COMING_SOON
 *   - Stock tokens have no router pinned yet, so COMING_SOON
 *   - DISABLED assets become UNSUPPORTED
 * Region-restricted is impossible without country; the server supplies
 * the real signal.
 */
function deriveFallbackRouteStatus(asset: PaymentAsset): RouteStatus {
  if (asset.status === 'DISABLED') return 'UNSUPPORTED';
  if (asset.assetId === 'usdg') return 'AVAILABLE';
  return 'COMING_SOON';
}

function PaymentTile({
  asset,
  isCore,
  routeStatus,
  offered,
  regionBlocked,
  comingSoon,
  feeBps,
  selected,
  onSelect,
}: {
  asset: PaymentAsset;
  isCore: boolean;
  routeStatus: RouteStatus;
  offered: boolean;
  regionBlocked: boolean;
  comingSoon: boolean;
  feeBps: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const symbolLabel = isCore && asset.symbol === 'NET' ? 'NET' : asset.symbol;
  const subLabel = issuerLabel(asset);
  // Tile matrix per §5.2:
  //   AVAILABLE + 0 fee → 'Active' (green)
  //   AVAILABLE + fee   → '+N% FEE' (amber)
  //   COMING_SOON       → 'Coming soon' (amber)
  //   REGION_RESTRICTED → 'Region restricted' (amber)
  //   UNSUPPORTED       → 'Coming soon' (amber)
  const feeLabel = feeChipLabel(routeStatus, feeBps);
  const feeTone = feeChipTone(routeStatus, feeBps);
  const disabledLabel = regionBlocked
    ? 'Unavailable in your region'
    : !offered
      ? 'Coming soon'
      : null;
  // When the route is unavailable, the status chip already says
      // 'Coming soon' or 'Region restricted' — duplicate the disabledLabel
      // only when the fee chip is purely financial (AVAILABLE + fee > 0).
  const showDisabledLabel =
    disabledLabel !== null && !(routeStatus === 'AVAILABLE' && feeBps > 0);

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!offered}
      aria-pressed={selected}
      className={cn(
        'group relative flex min-h-[4.5rem] items-center gap-3 rounded-[16px] border px-3.5 py-3 pr-10 text-left transition-all',
        selected && offered
          ? 'border-[var(--color-net-green)] bg-[rgba(72,235,145,0.10)] shadow-[0_0_24px_rgba(72,235,145,0.16)]'
          : 'border-[var(--color-border-subtle)] bg-[rgba(7,14,11,0.55)] hover:border-[var(--color-border-active)]',
        !offered && 'cursor-not-allowed opacity-50',
      )}
    >
      <PaymentSymbol asset={asset} isCore={isCore} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 pr-8">
        <span className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--color-text-primary)]">
          {symbolLabel}
          {selected ? (
            <CheckIcon size={12} weight="bold" className="text-[var(--color-net-green)]" />
          ) : null}
        </span>
        <span className="truncate text-[11px] text-[var(--color-text-tertiary)]">{subLabel}</span>
      </span>
      <span className="absolute right-2 top-2">
        <FeeChip label={feeLabel} tone={feeTone} />
      </span>
      <span className="absolute bottom-3 right-3">
        <Radio selected={selected} disabled={!offered} />
      </span>
      {showDisabledLabel ? (
        <span className="absolute bottom-2 right-2 text-[10px] text-[var(--color-text-tertiary)]">
          {disabledLabel}
        </span>
      ) : null}
    </button>
  );
}

function feeChipLabel(routeStatus: RouteStatus, feeBps: number): string {
  if (routeStatus === 'COMING_SOON' || routeStatus === 'UNSUPPORTED') return 'Coming soon';
  if (routeStatus === 'REGION_RESTRICTED') return 'Region restricted';
  if (feeBps > 0) return `+${(feeBps / 100).toFixed(0)}% FEE`;
  return 'Active';
}

function feeChipTone(
  routeStatus: RouteStatus,
  feeBps: number,
): 'green' | 'amber' {
  if (routeStatus === 'AVAILABLE' && feeBps === 0) return 'green';
  return 'amber';
}

function PaymentSymbol({ asset, isCore }: { asset: PaymentAsset; isCore: boolean }) {
  if (asset.symbol === 'USDG') {
    return (
      <span
        aria-hidden="true"
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0b3d22] text-[var(--color-net-green)]"
      >
        <Hex size={16} weight="bold" />
      </span>
    );
  }
  if (asset.symbol === 'ETH') {
    return (
      <span
        aria-hidden="true"
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0c1f3a] text-[#9CC0FF]"
      >
        <svg viewBox="0 0 32 32" width="18" height="18" fill="currentColor" aria-hidden="true">
          <path d="M16 2 8 17.5l8 4.6 8-4.6L16 2Zm0 22.6L8 19.6 16 30l8-10.4-8 5Z" />
        </svg>
      </span>
    );
  }
  if (asset.symbol === 'NET') {
    return (
      <span
        aria-hidden="true"
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1a1a1a] text-[var(--color-net-green)]"
      >
        <span className="text-[14px] font-bold">N</span>
      </span>
    );
  }
  if (!isCore) {
    return (
      <StockTickerGlyph
        ticker={asset.symbol as 'AAPL' | 'NVDA' | 'TSLA' | 'COIN' | 'MSFT' | 'SPY' | 'GOOGL' | 'AMZN' | 'SPCX'}
        size={36}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgba(255,255,255,0.08)] text-[13px] font-semibold text-[var(--color-text-secondary)]"
    >
      {asset.symbol[0]}
    </span>
  );
}

function Radio({ selected, disabled }: { selected: boolean; disabled: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border',
        selected
          ? 'border-[var(--color-net-green)] bg-[var(--color-net-green)]'
          : disabled
            ? 'border-[var(--color-border-subtle)] bg-transparent'
            : 'border-[var(--color-text-tertiary)] bg-transparent',
      )}
    >
      {selected ? <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-bg)]" /> : null}
    </span>
  );
}

function FeeChip({ label, tone }: { label: string; tone: 'green' | 'amber' }) {
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em]',
        tone === 'green'
          ? 'border border-[var(--color-net-green)]/40 bg-[var(--color-net-green)]/10 text-[var(--color-net-green)]'
          : 'border border-[#E4A24C]/40 bg-[#E4A24C]/10 text-[#F0C68A]',
      )}
    >
      {label}
    </span>
  );
}

function issuerLabel(asset: PaymentAsset): string {
  switch (asset.assetId) {
    case 'usdg':
      return 'Global Dollar';
    case 'eth':
      return 'Ethereum';
    case 'netnet-net':
      return 'NetNet Capital';
    case 'rh-aapl':
      return 'Apple';
    case 'rh-nvda':
      return 'NVIDIA';
    case 'rh-tsla':
      return 'Tesla';
    case 'rh-coin':
      return 'Coinbase';
    case 'rh-msft':
      return 'Microsoft';
    case 'rh-spy':
      return 'S&P 500 ETF';
    case 'rh-googl':
      return 'Alphabet';
    case 'rh-amzn':
      return 'Amazon';
    case 'rh-spcx':
      return 'S&P 500 ex-Top 10';
    default:
      return asset.displayName;
  }
}

function buildGroups(assets: PaymentAsset[]): Group[] {
  const core = assets.filter((a) => a.kind !== 'stock-token');
  const stock = assets.filter((a) => a.kind === 'stock-token');
  // Stock token tile order to match the reference mock:
  const STOCK_ORDER = ['AAPL', 'NVDA', 'TSLA', 'COIN', 'MSFT', 'SPY', 'GOOGL', 'AMZN', 'SPCX'];
  const stockSorted = [...stock].sort(
    (a, b) =>
      STOCK_ORDER.indexOf(a.symbol) - STOCK_ORDER.indexOf(b.symbol),
  );
  return [
    {
      kind: 'core',
      title: 'Crypto Payments (No Fee)',
      description: 'Pay with supported crypto tokens. No marketplace fees.',
      badge: 'Instant · Global access',
      badgeTone: 'green',
      assets: core,
    },
    {
      kind: 'stock',
      title: 'Stock Token Payments (+2% Fee)',
      description: 'Pay with tokenized stocks. A 2% marketplace fee applies.',
      badge: 'Region restricted · Coming soon',
      badgeTone: 'amber',
      assets: stockSorted,
    },
  ];
}
