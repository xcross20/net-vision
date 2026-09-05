import { getMarketSource } from '@/lib/market';
import { workerCheckpoint } from '@/lib/index/store';

export const dynamic = 'force-dynamic';

export default async function ReconcilePage() {
  const categories = await getMarketSource().listCategories();
  const worker = workerCheckpoint();
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
          from the OpenSea UI. Worker cursor {worker.cursor}, phase {worker.phase},
          processed {worker.processedTotal}.
        </p>
      </header>
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
