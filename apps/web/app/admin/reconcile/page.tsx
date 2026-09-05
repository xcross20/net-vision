import { getMarketSource } from '@/lib/market';
import { buildIndexerHealthReport } from '@/lib/index/health';
import { hydrateIndexFromPostgres } from '@/lib/index/store';

export const dynamic = 'force-dynamic';

function ageLabel(ms: number | null | undefined, now: number): string {
  if (ms == null) return 'never';
  const ageSec = Math.max(0, Math.round((now - ms) / 1000));
  if (ageSec < 60) return `${ageSec}s ago`;
  const ageMin = Math.round(ageSec / 60);
  if (ageMin < 60) return `${ageMin}m ago`;
  return `${Math.round(ageMin / 60)}h ago`;
}

export default async function ReconcilePage() {
  await hydrateIndexFromPostgres().catch(() => undefined);
  const categories = await getMarketSource().listCategories();
  const health = buildIndexerHealthReport();
  const now = Date.now();
  const online = health.workerOnline;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-12">
      <header className="flex flex-col gap-2">
        <span className="text-eyebrow">Internal QA</span>
        <h1 className="text-display text-4xl text-[var(--color-text-primary)]">
          Category reconciliation
        </h1>
        <p className="text-body max-w-[60ch] text-[var(--color-text-secondary)]">
          Net Vision counts come from verified listing state. OpenSea column is a
          manual oracle during the rebuild — paste filtered collection counts
          from the OpenSea UI.
        </p>
      </header>

      <section className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-eyebrow">Indexer</h2>
          <span
            className="text-sm font-medium"
            style={{ color: online ? 'var(--color-text-primary)' : 'var(--color-danger, #c44)' }}
          >
            {online ? '● WORKER ONLINE' : '○ WORKER OFFLINE'}
          </span>
        </div>
        <dl className="grid gap-3 sm:grid-cols-2 text-sm">
          <div>
            <dt className="text-eyebrow-muted">Listing bootstrap</dt>
            <dd className="text-numeral">
              {health.listingCursor.toLocaleString()} processed · {health.listingProgressPercent}%
            </dd>
          </div>
          <div>
            <dt className="text-eyebrow-muted">Metadata bootstrap</dt>
            <dd className="text-numeral">
              {health.metadataCursor.toLocaleString()} / ~62,095 · {health.metadataProgressPercent}%
            </dd>
          </div>
          <div>
            <dt className="text-eyebrow-muted">Brass</dt>
            <dd className="text-numeral">
              {health.brassMetadataVerified} / {health.brassExpected}
              {health.brassComplete ? ' · 100%' : ''}
            </dd>
          </div>
          <div>
            <dt className="text-eyebrow-muted">Steel</dt>
            <dd className="text-numeral">
              {health.steelMetadataVerified} / {health.steelExpected}
            </dd>
          </div>
          <div>
            <dt className="text-eyebrow-muted">Anodised</dt>
            <dd className="text-numeral">
              {health.anodisedMetadataVerified} / {health.anodisedExpected}
            </dd>
          </div>
          <div>
            <dt className="text-eyebrow-muted">Printed Phenolic</dt>
            <dd className="text-numeral">
              {health.printedMetadataVerified} / {health.printedExpected}
            </dd>
          </div>
          <div>
            <dt className="text-eyebrow-muted">Retries queued</dt>
            <dd className="text-numeral">{health.retriesQueued}</dd>
          </div>
          <div>
            <dt className="text-eyebrow-muted">Last successful listing</dt>
            <dd>{ageLabel(health.lastSuccessfulListingCheck, now)}</dd>
          </div>
          <div>
            <dt className="text-eyebrow-muted">Last successful metadata</dt>
            <dd>{ageLabel(health.lastSuccessfulMetadataCheck, now)}</dd>
          </div>
          <div>
            <dt className="text-eyebrow-muted">Last OpenSea 429</dt>
            <dd>{ageLabel(health.last429, now)}</dd>
          </div>
          <div>
            <dt className="text-eyebrow-muted">Postgres</dt>
            <dd>
              {health.postgresConnected ? 'connected' : 'not configured'} · restored{' '}
              {health.restoredFrom ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="text-eyebrow-muted">Last error</dt>
            <dd className="truncate">{health.lastError ?? '—'}</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-[var(--color-text-tertiary)]">
          Live JSON: <code>/api/v1/health/indexer</code>
        </p>
      </section>

      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)]">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--color-border-subtle)] text-eyebrow-muted">
            <tr>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3 text-right">Members</th>
              <th className="px-4 py-3 text-right">Verified</th>
              <th className="px-4 py-3 text-right">Listed</th>
              <th className="px-4 py-3 text-right">Coverage</th>
              <th className="px-4 py-3 text-right">Status</th>
              <th className="px-4 py-3 text-right">OpenSea</th>
              <th className="px-4 py-3 text-right">Δ</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.slug} className="border-b border-[var(--color-border-subtle)]">
                <td className="px-4 py-3">{c.name}</td>
                <td className="px-4 py-3 text-right text-numeral">{c.memberSupply}</td>
                <td className="px-4 py-3 text-right text-numeral">{c.verifiedCount}</td>
                <td className="px-4 py-3 text-right text-numeral">{c.listedCount}</td>
                <td className="px-4 py-3 text-right text-numeral">
                  {(c.coveragePercent * 100).toFixed(1)}%
                </td>
                <td className="px-4 py-3 text-right">{c.marketStatus}</td>
                <td className="px-4 py-3 text-right text-[var(--color-text-tertiary)]">—</td>
                <td className="px-4 py-3 text-right text-[var(--color-text-tertiary)]">—</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
