'use client';

import { useEffect, useRef, useState } from 'react';
import type { SerializedCacheCoverage } from '@/lib/index/canonical-metadata';

const POLL_MS = 10_000;

type Snapshot = SerializedCacheCoverage & { sampledAt: number };

function formatEta(hours: number | null): string {
  if (hours == null) return 'calculating…';
  if (hours <= 0) return 'done';
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m}m`;
}

function formatPct(n: number): string {
  return `${n.toFixed(2)}%`;
}

export function CoverageTracker({ initial }: { initial: SerializedCacheCoverage | null }) {
  const [current, setCurrent] = useState<Snapshot | null>(
    initial ? { ...initial, sampledAt: Date.now() } : null,
  );
  const [error, setError] = useState<string | null>(null);
  const prev = useRef<Snapshot | null>(current);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch('/api/v1/health/coverage', { cache: 'no-store' });
        if (!res.ok) throw new Error(`coverage ${res.status}`);
        const json = (await res.json()) as { cacheCoverage: SerializedCacheCoverage | null };
        if (cancelled) return;
        if (!json.cacheCoverage) {
          setError('DATABASE_URL not configured');
          return;
        }
        setError(null);
        setCurrent((prevSnap) => {
          prev.current = prevSnap;
          return { ...json.cacheCoverage!, sampledAt: Date.now() };
        });
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    };
    const id = setInterval(tick, POLL_MS);
    void tick();
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const rate = (() => {
    const a = prev.current;
    const b = current;
    if (!a || !b) return null;
    const dtMin = (b.sampledAt - a.sampledAt) / 60_000;
    if (dtMin <= 0) return null;
    const delta = Math.max(0, b.imagesCached - a.imagesCached);
    return delta / dtMin;
  })();
  const eta =
    current == null
      ? null
      : current.remaining <= 0
        ? 0
        : rate && rate > 0
          ? current.remaining / rate / 60
          : null;

  if (!current) {
    return (
      <section className="nv-glass-2 rounded-[20px] p-6">
        <p className="text-sm text-[var(--color-text-secondary)]">
          {error ?? '— (DATABASE_URL not configured)'}
        </p>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Bar
        label="Official metadata verified"
        count={current.metadataVerified}
        total={current.officialSupply}
        pct={current.metadataCoveragePct}
        testId="metadata-coverage-bar"
      />
      <Bar
        label="Images cached (rendered)"
        count={current.imagesCached}
        total={current.officialSupply}
        pct={current.imageCoveragePct}
        testId="image-cache-coverage"
      />
      <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
        <Stat label="Remaining" value={current.remaining.toLocaleString()} />
        <Stat label="ETA" value={formatEta(current.complete ? 0 : eta)} />
        <Stat
          label="Rate"
          value={rate != null && rate > 0 ? `${rate.toFixed(1)} tokens/min` : '—'}
        />
        <Stat label="Cursor" value={current.lastTokenId.toLocaleString()} />
        <Stat label="Retry" value={current.retry.toLocaleString()} />
        <Stat label="Unknown" value={current.unknown.toLocaleString()} />
        <Stat label="Invalid" value={current.invalid.toLocaleString()} />
        <Stat label="Identity block" value={current.identityBlock.toLocaleString()} />
        <Stat
          label="Worker heartbeat"
          value={current.heartbeatFresh ? 'live' : current.lastSuccessAt ? 'stale' : 'never'}
        />
      </dl>
      <p className="text-xs text-[var(--color-text-tertiary)]" data-testid="coverage-status">
        {current.complete
          ? `100% of ${current.officialSupply.toLocaleString()} official tokens cached.`
          : `Walking 1..${current.officialSupply.toLocaleString()} via on-chain tokenURI. ${formatPct(current.imageCoveragePct)} images · ${formatPct(current.metadataCoveragePct)} metadata.`}
        {error ? ` · ${error}` : ''}
      </p>
    </div>
  );
}

function Bar({
  label,
  count,
  total,
  pct,
  testId,
}: {
  label: string;
  count: number;
  total: number;
  pct: number;
  testId: string;
}) {
  return (
    <section className="nv-glass-2 rounded-[20px] p-6">
      <div className="flex flex-col gap-1">
        <span className="text-eyebrow text-[var(--color-text-tertiary)]">{label}</span>
        <span
          className="text-display text-[clamp(2.4rem,5vw,3.6rem)] text-[var(--color-net-green)]"
          data-testid={testId}
        >
          {count.toLocaleString()}{' '}
          <span className="text-[var(--color-text-tertiary)] text-[0.6em]">/ {total.toLocaleString()}</span>
        </span>
        <span className="text-numeral text-sm text-[var(--color-text-secondary)]">
          {formatPct(pct)} complete
        </span>
      </div>
      <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-[rgba(72,235,145,0.08)]">
        <div
          className="h-full rounded-full bg-[var(--color-net-green)] transition-all"
          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        />
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="nv-glass-1 rounded-[14px] p-3">
      <span className="block text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">
        {label}
      </span>
      <span className="text-numeral text-sm text-[var(--color-text-primary)]">{value}</span>
    </div>
  );
}
