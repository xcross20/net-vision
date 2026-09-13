import { CoverageTracker } from '@/components/coverage/CoverageTracker';
import { readCanonicalCoverage } from '@/lib/index/canonical-metadata-store';
import { serializeCacheCoverage } from '@/lib/index/canonical-metadata';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CoveragePage() {
  let initial = null;
  try {
    const coverage = await readCanonicalCoverage();
    if (coverage) initial = serializeCacheCoverage(coverage);
  } catch {
    initial = null;
  }
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 md:px-0">
      <header className="flex flex-col gap-2">
        <span className="text-eyebrow">Metadata bootstrap</span>
        <h1 className="text-display text-[clamp(2rem,4vw,3rem)]">Canonical Coverage</h1>
        <p className="text-[14px] text-[var(--color-text-secondary)]">
          On-chain <code>tokenURI</code> for every official Button Presser (1–62,093). Images are the
          cached SVG bytes, same persistence as listings. This page polls every 10s until both bars
          hit 100%.
        </p>
      </header>
      <CoverageTracker initial={initial} />
    </div>
  );
}
