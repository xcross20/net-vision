/**
 * Home page composition — broken out so the server page can fetch data
 * while motion + interactivity live inside 'use client' leaves.
 */
'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { TokenCard } from '@/components/TokenCard';
import { DataFreshnessBadge } from '@/components/DataFreshnessBadge';
import {
  StaggerList,
  StaggerItem,
  SPRING,
  fadeUp,
} from '@/components/motion';
import { ArrowR, ArrowUR, CubeIcon, StarIcon } from '@/components/icons';
import { formatPrice } from '@net-vision/ui';
import type {
  CategoryMetrics,
  CollectionSnapshot,
  DataFreshness,
  Token,
} from '@/lib/market';

export function HomeHero({
  snapshot,
  freshness,
}: {
  snapshot: CollectionSnapshot;
  freshness: DataFreshness;
}) {
  return (
    <section className="relative">
      <div className="grid grid-cols-1 gap-10 md:grid-cols-12 md:gap-8">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          transition={SPRING}
          className="md:col-span-7 flex flex-col gap-7"
        >
          <div className="flex items-center gap-3">
            <span className="nv-eyebrow">{snapshot.name}</span>
            <DataFreshnessBadge freshness={freshness} />
          </div>
          <h1 className="nv-display text-[clamp(2.5rem,7vw,5rem)]">
            The market
            <br />
            for numbers.
          </h1>
          <p className="nv-body text-base md:text-lg">
            Net Vision is a non-custodial terminal for the Button Presser collection on Robinhood
            Chain. Browse every active listing, dig into trait categories, and trade directly
            from your wallet.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href="/market" className="nv-button">
              Explore market
              <ArrowR size={14} weight="bold" />
            </Link>
            <Link href="/categories" className="nv-button nv-button-ghost">
              Browse categories
            </Link>
          </div>
        </motion.div>

        <motion.aside
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING, delay: 0.16 }}
          className="md:col-span-5 md:pl-8 md:border-l md:border-[var(--nv-border)] flex flex-col gap-5"
        >
          <span className="nv-eyebrow-muted">Collection pulse</span>
          <StaggerList className="grid grid-cols-2 gap-x-6 gap-y-5">
            <StatTile label="Listed" value={snapshot.listedCount.toLocaleString()} />
            <StatTile label="Floor" value={formatPrice(snapshot.floorPriceEth)} accent />
            <StatTile label="Volume 24h" value={formatPrice(snapshot.volume24hEth)} />
            <StatTile label="Sales 24h" value={snapshot.sales24h.toLocaleString()} />
          </StaggerList>
          <div className="nv-panel-soft mt-2 flex items-center justify-between p-3 text-xs text-[var(--nv-muted)]">
            <span className="inline-flex items-center gap-2">
              <CubeIcon size={14} weight="duotone" />
              Chain {snapshot.chainId}
            </span>
            <a
              href={`https://opensea.io/assets/robinhood/${snapshot.contractAddress}/1`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[var(--nv-text-soft)] transition-colors hover:text-[var(--nv-green)]"
            >
              View on OpenSea
              <ArrowUR size={11} weight="bold" />
            </a>
          </div>
        </motion.aside>
      </div>
    </section>
  );
}

function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <StaggerItem className="flex flex-col gap-1">
      <span className="nv-stat-label">{label}</span>
      <span className={accent ? 'nv-stat-value nv-stat-value-strong' : 'nv-stat-value'}>
        {value}
      </span>
    </StaggerItem>
  );
}

export function HomeCategories({ categories }: { categories: CategoryMetrics[] }) {
  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <span className="nv-eyebrow-muted">Browse</span>
          <h2 className="nv-display text-2xl md:text-3xl">Trending categories</h2>
        </div>
        <Link
          href="/categories"
          className="nv-link inline-flex items-center gap-1 whitespace-nowrap text-sm"
        >
          All categories
          <ArrowR size={12} weight="bold" />
        </Link>
      </div>

      {categories.length === 0 ? (
        <EmptyState
          title="No categories yet"
          body="Categories become visible as the indexer surfaces trait data for the collection."
        />
      ) : (
        <StaggerList className="grid grid-cols-1 gap-px overflow-hidden rounded-[var(--nv-radius-lg)] border border-[var(--nv-border)] bg-[var(--nv-border)] md:grid-cols-2">
          {categories.map((c, idx) => (
            <StaggerItem
              key={c.slug}
              className={
                idx === 0 && categories.length > 2
                  ? 'md:col-span-2 bg-[var(--nv-panel)]'
                  : 'bg-[var(--nv-panel)]'
              }
            >
              <CategoryRow
                metrics={c}
                featured={idx === 0 && categories.length > 2}
              />
            </StaggerItem>
          ))}
        </StaggerList>
      )}
    </section>
  );
}

function CategoryRow({
  metrics,
  featured,
}: {
  metrics: CategoryMetrics;
  featured?: boolean;
}) {
  return (
    <Link
      href={`/categories/${metrics.slug}`}
      className="group flex h-full flex-col gap-4 p-5 transition-colors hover:bg-[var(--nv-panel-elevated)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <StarIcon size={14} weight="duotone" className="text-[var(--nv-green)]" />
            <span className="text-base font-semibold tracking-tight text-[var(--nv-text)]">
              {metrics.name}
            </span>
          </div>
          <span className="text-xs text-[var(--nv-muted)]">{metrics.description}</span>
        </div>
        <ArrowR
          size={14}
          weight="bold"
          className="text-[var(--nv-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--nv-green)]"
        />
      </div>
      <div className="mt-auto grid grid-cols-3 gap-4">
        <MicroStat label="Floor" value={formatPrice(metrics.floorPriceEth)} accent />
        <MicroStat label="Listed" value={metrics.listedCount.toLocaleString()} />
        <MicroStat label="Owners" value={metrics.owners.toLocaleString()} />
      </div>
      {featured ? (
        <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-[var(--nv-green)]">
          Featured category
        </div>
      ) : null}
    </Link>
  );
}

function MicroStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="nv-stat-label">{label}</span>
      <span
        className={
          accent
            ? 'nv-mono text-sm font-semibold text-[var(--nv-green)]'
            : 'nv-mono text-sm text-[var(--nv-text)]'
        }
      >
        {value}
      </span>
    </div>
  );
}

export function HomeMarket({ tokens }: { tokens: Token[] }) {
  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <span className="nv-eyebrow-muted">Live listings</span>
          <h2 className="nv-display text-2xl md:text-3xl">Market activity</h2>
        </div>
        <Link
          href="/market"
          className="nv-link inline-flex items-center gap-1 whitespace-nowrap text-sm"
        >
          All listings
          <ArrowR size={12} weight="bold" />
        </Link>
      </div>

      {tokens.length === 0 ? (
        <EmptyState
          title="Live listings are warming up"
          body="The OpenSea indexer has not yet surfaced active listings for Button Presser. Pull in a few minutes, or browse categories to discover trait combinations."
          action={
            <Link href="/categories" className="nv-button nv-button-ghost">
              Browse categories
            </Link>
          }
        />
      ) : (
        <StaggerList className="nv-grid-tokens">
          {tokens.slice(0, 8).map((t: Token) => (
            <StaggerItem key={t.tokenId} className="h-full">
              <TokenCard token={t} />
            </StaggerItem>
          ))}
        </StaggerList>
      )}
    </section>
  );
}

function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="nv-panel-soft flex flex-col gap-3 p-6 md:p-8">
      <span className="text-base font-semibold tracking-tight text-[var(--nv-text)]">{title}</span>
      <p className="text-sm leading-relaxed text-[var(--nv-muted)]">{body}</p>
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  );
}