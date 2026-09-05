'use client';

import { CollectibleCard } from '@/components/market/CollectibleCard';
import { EmptyState } from '@/components/ui/EmptyState';
import type { Token } from '@/lib/market';

export function CategoryListings({
  tokens,
  selectedIds,
  onToggle,
  syncing,
  memberSupply,
  verifiedCount,
}: {
  tokens: Token[];
  selectedIds: Set<string>;
  onToggle: (token: Token) => void;
  syncing: boolean;
  memberSupply: number;
  verifiedCount: number;
}) {
  if (tokens.length === 0) {
    return (
      <EmptyState
        title={syncing ? 'Syncing market data' : 'No verified listings for this category'}
        body={
          syncing
            ? `${verifiedCount.toLocaleString()} of ${memberSupply.toLocaleString()} members have verified market state. Unknown tokens are not treated as unlisted.`
            : `${memberSupply.toLocaleString()} tokens belong to this category, but none currently have a verified active listing.`
        }
        tone="muted"
      />
    );
  }
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:gap-5 xl:grid-cols-4">
      {tokens.map((token, index) => (
        <CollectibleCard
          key={token.tokenId}
          token={token}
          selected={selectedIds.has(token.tokenId)}
          onToggle={onToggle}
          priority={index < 4}
        />
      ))}
    </div>
  );
}
