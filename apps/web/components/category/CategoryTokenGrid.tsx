'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AssetCard } from '@/components/ui/AssetCard';
import type { Token, TokenListingStatus } from '@/lib/market';

type CategoryTokenPage = {
  tokens: Token[];
  total: number;
  nextOffset: number | null;
};

type CategoryTokenGridProps = {
  slug: string;
  activeDigits: number[];
  listingStatus: TokenListingStatus;
  initialTokens: Token[];
  initialNextOffset: number | null;
  total: number;
};

export function CategoryTokenGrid({
  slug,
  activeDigits,
  listingStatus,
  initialTokens,
  initialNextOffset,
  total,
}: CategoryTokenGridProps) {
  const [tokens, setTokens] = useState(initialTokens);
  const [nextOffset, setNextOffset] = useState(initialNextOffset);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const activeDigitsKey = activeDigits.join(',');

  const loadMore = useCallback(async () => {
    if (isLoading || nextOffset === null) return;
    setIsLoading(true);
    setLoadError(false);

    try {
      const url = new URL(
        `/api/v1/virtual-collections/${encodeURIComponent(slug)}/tokens`,
        window.location.origin,
      );
      url.searchParams.set('offset', String(nextOffset));
      url.searchParams.set('limit', '24');
      url.searchParams.set('status', listingStatus);
      if (activeDigitsKey) url.searchParams.set('digits', activeDigitsKey);

      const response = await fetch(url);
      if (!response.ok) throw new Error(`Category request failed with ${response.status}`);
      const body: unknown = await response.json();
      if (!isCategoryTokenPage(body)) throw new Error('Category response had an invalid shape');

      setTokens((currentTokens) => appendUniqueTokens(currentTokens, body.tokens));
      setNextOffset(body.nextOffset);
    } catch {
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, [activeDigitsKey, isLoading, listingStatus, nextOffset, slug]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || nextOffset === null) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: '600px 0px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, nextOffset]);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:gap-5 xl:grid-cols-4">
        {tokens.map((token, index) => (
          <AssetCard key={token.tokenId} token={token} priority={index < 4} />
        ))}
      </div>

      {nextOffset !== null ? (
        <div
          ref={sentinelRef}
          className="flex min-h-16 items-center justify-center"
          role="status"
          aria-live="polite"
        >
          {loadError ? (
            <button
              type="button"
              onClick={() => void loadMore()}
              className="rounded-[var(--radius-md)] border border-[var(--color-border-default)] px-4 py-2 text-sm text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-active)] hover:text-[var(--color-text-primary)]"
            >
              Try loading more
            </button>
          ) : isLoading ? (
            <span className="text-sm text-[var(--color-text-tertiary)]">
              Loading more tokens...
            </span>
          ) : (
            <span className="text-sm text-[var(--color-text-tertiary)]">
              Scroll for more tokens
            </span>
          )}
        </div>
      ) : (
        <p className="text-center text-sm text-[var(--color-text-tertiary)]">
          {tokens.length.toLocaleString()} of {total.toLocaleString()} matching tokens loaded
        </p>
      )}
    </div>
  );
}

function appendUniqueTokens(currentTokens: Token[], incomingTokens: Token[]): Token[] {
  const currentIds = new Set(currentTokens.map((token) => token.tokenId));
  const nextTokens = incomingTokens.filter((token) => {
    if (currentIds.has(token.tokenId)) return false;
    currentIds.add(token.tokenId);
    return true;
  });
  return [...currentTokens, ...nextTokens];
}

function isCategoryTokenPage(value: unknown): value is CategoryTokenPage {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CategoryTokenPage>;
  return (
    Array.isArray(candidate.tokens) &&
    typeof candidate.total === 'number' &&
    (candidate.nextOffset === null || typeof candidate.nextOffset === 'number')
  );
}
