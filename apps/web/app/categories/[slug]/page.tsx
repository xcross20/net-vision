import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, ArrowUpRight, Check } from '@phosphor-icons/react/dist/ssr';
import {
  getCategoryMetrics,
  listCategoryTokens,
} from '@/lib/data/categories';
import { VIRTUAL_COLLECTION_CATALOG } from '@net-vision/taxonomy';
import { LiveIndicator } from '@/components/ui/LiveIndicator';
import { AssetCard } from '@/components/ui/AssetCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { compact, payment } from '@/lib/format';
import { getMarketSource } from '@/lib/market';

export const dynamic = 'force-dynamic';

export function generateStaticParams() {
  return VIRTUAL_COLLECTION_CATALOG.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const meta = VIRTUAL_COLLECTION_CATALOG.find((c) => c.slug === slug);
  return {
    title: meta ? `${meta.name} \u2014 Net Vision` : 'Category \u2014 Net Vision',
    description: meta?.description ?? 'Button Presser category on Robinhood Chain.',
  };
}

const PALINDROME_DIGIT_KEY = 'digits';
const SUPPORTED_DIGIT_COUNTS = new Set([2, 3, 4, 5]);

function parseDigitsParam(value: string | string[] | undefined): number[] {
  if (!value) return [];
  const raw = Array.isArray(value) ? value.join(',') : value;
  return raw
    .split(',')
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isInteger(n) && SUPPORTED_DIGIT_COUNTS.has(n));
}

function buildDigitsHref(current: number[], toggle: number): string {
  const set = new Set(current);
  if (set.has(toggle)) set.delete(toggle);
  else set.add(toggle);
  const next = [...set].sort((a, b) => a - b);
  if (next.length === 0) return '';
  return `?${PALINDROME_DIGIT_KEY}=${next.join(',')}`;
}

export default async function CategoryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug }, search] = await Promise.all([params, searchParams]);
  const activeDigits = parseDigitsParam(search[PALINDROME_DIGIT_KEY]);
  const facets =
    activeDigits.length > 0
      ? activeDigits.map((d) => `digits-${d}`)
      : undefined;
  const [metrics, tokens, freshness] = await Promise.all([
    getCategoryMetrics(slug),
    listCategoryTokens(slug, { facets, limit: 60 }),
    getMarketSource().getFreshness(),
  ]);
  if (!metrics) {
    notFound();
  }
  const memberSupplyForView =
    activeDigits.length === 0 || !metrics.subFilter
      ? metrics.memberSupply
      : metrics.subFilter.facets
          .filter((f) => activeDigits.includes(Number(f.value.replace('digits-', ''))))
          .reduce((sum, f) => sum + f.memberCount, 0);
  const listedCountForView =
    activeDigits.length === 0 || !metrics.subFilter
      ? metrics.listedCount
      : metrics.subFilter.facets
          .filter((f) => activeDigits.includes(Number(f.value.replace('digits-', ''))))
          .reduce((sum, f) => sum + f.listedCount, 0);
  const listedPct =
    memberSupplyForView > 0 ? (listedCountForView / memberSupplyForView) * 100 : 0;

  return (
    <div className="flex flex-col gap-12">
      <nav className="flex items-center gap-2 text-sm text-[var(--color-text-tertiary)]">
        <Link href="/categories" className="transition-colors hover:text-[var(--color-text-primary)]">
          Categories
        </Link>
        <span className="text-[var(--color-text-tertiary)]">/</span>
        <span className="text-[var(--color-text-primary)]">{metrics.name}</span>
      </nav>

      <header className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <span className="text-eyebrow">{metrics.family}</span>
          <LiveIndicator
            tone={freshness.fresh ? 'green' : 'amber'}
            size={6}
            label={freshness.fresh ? 'Live' : 'Warming'}
          />
        </div>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-12 md:gap-10">
          <div className="md:col-span-7 flex flex-col gap-4">
            <h1 className="text-display text-[clamp(2.5rem,5.5vw,4.25rem)] text-[var(--color-text-primary)]">
              {metrics.name}
            </h1>
            <p className="text-body max-w-[58ch] text-[var(--color-text-secondary)] md:text-[17px]">
              {metrics.description}
            </p>
          </div>
          <div className="md:col-span-5 flex flex-col gap-4">
            <span className="text-eyebrow-muted">Collection pulse</span>
            <div className="grid grid-cols-2 gap-x-8 gap-y-6 border-y border-[var(--color-border-subtle)] py-6 md:grid-cols-2">
              <Stat label="Floor" value={payment(metrics.floorPrice, metrics.currency)} emphasis />
              <Stat
                label="Listed"
                value={listedCountForView.toLocaleString()}
                sub={
                  activeDigits.length > 0
                    ? `${listedPct.toFixed(1)}% of ${memberSupplyForView.toLocaleString()} filtered`
                    : `${listedPct.toFixed(1)}% of members`
                }
              />
              <Stat label="Owners" value={metrics.owners.toLocaleString()} />
              <Stat
                label="Members"
                value={memberSupplyForView.toLocaleString()}
                sub={
                  metrics.memberSupply !== memberSupplyForView
                    ? `of ${metrics.memberSupply.toLocaleString()} total`
                    : 'all eligible'
                }
              />
            </div>
          </div>
        </div>

        {metrics.subFilter ? (
          <FacetFilter
            slug={slug}
            facets={metrics.subFilter.facets}
            activeDigits={activeDigits}
          />
        ) : null}
      </header>

      <section className="flex flex-col gap-6">
        <div className="flex items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-eyebrow-muted">Listings</span>
            <h2 className="text-display text-2xl text-[var(--color-text-primary)] md:text-3xl">
              Active in this category
            </h2>
          </div>
          <Link
            href="/market"
            className="inline-flex items-center gap-1 text-sm text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-net-green)]"
          >
            Open market
            <ArrowRight size={12} weight="bold" />
          </Link>
        </div>

        {tokens.length === 0 ? (
          <EmptyState
            title="No live listings for this category"
            body={
              memberSupplyForView > 0
                ? `${memberSupplyForView.toLocaleString()} tokens belong to this category, but none are currently listed on the OpenSea orderbook.`
                : 'No tokens have been classified into this category yet.'
            }
            tone="muted"
          />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:gap-5 xl:grid-cols-4">
            {tokens.slice(0, 12).map((t, idx) => (
              <AssetCard key={t.tokenId} token={t} priority={idx < 4} />
            ))}
          </div>
        )}
      </section>

      <Link
        href="/market"
        className="nv-button nv-button-ghost self-start"
      >
        All listings
        <ArrowUpRight size={12} weight="bold" />
      </Link>
    </div>
  );
}

function FacetFilter({
  slug,
  facets,
  activeDigits,
}: {
  slug: string;
  facets: NonNullable<NonNullable<Awaited<ReturnType<typeof getCategoryMetrics>>>['subFilter']>['facets'];
  activeDigits: number[];
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-[var(--color-border-subtle)] pt-6">
      <div className="flex items-center justify-between gap-3">
        <span className="text-eyebrow-muted">Filter by digit count</span>
        {activeDigits.length > 0 ? (
          <Link
            href={`/categories/${slug}`}
            className="text-[12px] text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-net-green)]"
          >
            Clear filter
          </Link>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {facets.map((f) => {
          const digits = Number(f.value.replace('digits-', ''));
          const active = activeDigits.includes(digits);
          const href = buildDigitsHref(activeDigits, digits);
          return (
            <Link
              key={f.value}
              href={href || `/categories/${slug}`}
              className={[
                'group/filter inline-flex items-center gap-2 rounded-[var(--radius-md)] border px-3 py-2 text-[13px] transition-colors',
                active
                  ? 'border-[var(--color-net-green)] bg-[rgba(72,235,145,0.08)] text-[var(--color-net-green)]'
                  : 'border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] text-[var(--color-text-secondary)] hover:border-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]',
              ].join(' ')}
              aria-pressed={active}
            >
              <span
                aria-hidden="true"
                className={[
                  'flex h-4 w-4 items-center justify-center rounded-[3px] border transition-colors',
                  active
                    ? 'border-[var(--color-net-green)] bg-[var(--color-net-green)] text-[var(--color-surface-0)]'
                    : 'border-[var(--color-border-strong)] bg-transparent',
                ].join(' ')}
              >
                {active ? <Check size={11} weight="bold" /> : null}
              </span>
              <span className="font-medium">{f.label}</span>
              <span className="text-numeral text-[11px] text-[var(--color-text-tertiary)]">
                {f.memberCount.toLocaleString()}
              </span>
            </Link>
          );
        })}
      </div>
      {activeDigits.length > 0 ? (
        <p className="text-[12px] text-[var(--color-text-tertiary)]">
          Showing{' '}
          {activeDigits
            .map((d) => `${d}-digit`)
            .join(', ')}{' '}
          palindromes only.
        </p>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  emphasis,
}: {
  label: string;
  value: string;
  sub?: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-eyebrow-muted">{label}</span>
      <span
        className={
          emphasis
            ? 'text-numeral text-xl font-semibold tracking-tight text-[var(--color-net-green)] md:text-2xl'
            : 'text-numeral text-xl font-semibold tracking-tight text-[var(--color-text-primary)] md:text-2xl'
        }
      >
        {value}
      </span>
      {sub ? <span className="text-numeral text-[11px] text-[var(--color-text-tertiary)]">{sub}</span> : null}
    </div>
  );
}