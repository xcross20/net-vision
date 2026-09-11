import type { MetadataCoverage } from '@/lib/index/store';
import { metadataCoverage } from '@/lib/index/store';
import { relative } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function CoveragePage() {
  const data: MetadataCoverage = metadataCoverage();
  const remaining = Math.max(0, data.total - data.verified);
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 md:px-0">
      <header className="flex flex-col gap-2">
        <span className="text-eyebrow">Metadata bootstrap</span>
        <h1 className="text-display text-[clamp(2rem,4vw,3rem)]">Canonical Coverage</h1>
        <p className="text-[14px] text-[var(--color-text-secondary)]">
          On-chain <code>tokenURI</code> for every official Button Presser. Image pending on a token page
          means this row has not been verified yet.
        </p>
      </header>
      <section className="nv-glass-2 rounded-[20px] p-6">
        <div className="flex flex-col gap-1">
          <span className="text-eyebrow text-[var(--color-text-tertiary)]">Verified</span>
          <span className="text-display text-[clamp(2.4rem,5vw,3.6rem)] text-[var(--color-net-green)]">
            {data.verified.toLocaleString()} <span className="text-[var(--color-text-tertiary)] text-[0.6em]">/ {data.total.toLocaleString()}</span>
          </span>
          <span className="text-numeral text-sm text-[var(--color-text-secondary)]">
            {data.coveragePct.toFixed(1)}% complete · {remaining.toLocaleString()} remaining
          </span>
        </div>
        <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-[rgba(72,235,145,0.08)]">
          <div
            className="h-full rounded-full bg-[var(--color-net-green)] transition-all"
            style={{ width: `${Math.max(0, Math.min(100, data.coveragePct))}%` }}
          />
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
          <Stat label="Retry queue" value={data.retry.toLocaleString()} />
          <Stat label="Worker cursor" value={data.cursor.toLocaleString()} />
          <Stat label="Processed total" value={data.processedTotal.toLocaleString()} />
          <Stat
            label="Last success"
            value={data.lastSuccessAt ? relative(data.lastSuccessAt) : 'never'}
          />
          <Stat
            label="Rate (tokens/min)"
            value={data.rate !== null ? data.rate.toFixed(1) : '—'}
          />
          <Stat label="Last error" value={data.lastError ?? '—'} mono />
        </dl>
      </section>
    </div>
  );
}

function Stat({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="nv-glass-1 rounded-[14px] p-3">
      <span className="block text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">
        {label}
      </span>
      <span className={mono ? 'text-numeral text-xs break-all text-[var(--color-text-primary)]' : 'text-numeral text-sm text-[var(--color-text-primary)]'}>
        {value}
      </span>
    </div>
  );
}
