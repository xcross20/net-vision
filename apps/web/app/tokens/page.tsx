import { getSeededTokens } from '@/lib/data/seed';
import { TokenCard } from '@/components/TokenCard';

export const metadata = {
  title: 'Tokens — Net Vision',
};

export default function TokensPage() {
  const tokens = getSeededTokens();
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <span className="nv-section-title">All tokens</span>
        <h1 className="text-2xl md:text-3xl font-semibold">Indexed supply</h1>
        <p className="text-[var(--nv-muted)]">
          The seeded slice of the Button Presser collection. The production indexer will
          replace this view with the full on-chain supply.
        </p>
      </header>
      <div className="nv-grid">
        {tokens.map((t) => (
          <TokenCard key={t.tokenId} token={t} />
        ))}
      </div>
    </div>
  );
}
