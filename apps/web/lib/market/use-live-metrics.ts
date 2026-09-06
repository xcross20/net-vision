'use client';

import { useEffect, useState } from 'react';
import type { CategoryMetrics } from './types';

type CategoryPayload = {
  slug: string;
  verifiedMarketMembers: number;
  unknownCount?: number;
  staleListedCount?: number;
  coveragePercent: number;
  marketStatus: 'syncing' | 'live';
  market: {
    listed: number;
    floor: number | null;
    lastKnownFloor?: number | null;
  };
};

function mergeMetrics(current: CategoryMetrics, next: CategoryPayload): CategoryMetrics {
  return {
    ...current,
    listedCount: next.market.listed,
    staleListedCount: next.staleListedCount ?? current.staleListedCount,
    verifiedCount: next.verifiedMarketMembers,
    unknownCount: next.unknownCount ?? current.unknownCount,
    coveragePercent: next.coveragePercent,
    marketStatus: next.marketStatus,
    floorPrice: next.market.floor,
    lastKnownFloorPrice: next.market.lastKnownFloor ?? current.lastKnownFloorPrice,
  };
}

export function useLiveCategories(
  initial: CategoryMetrics[],
  intervalMs = 10_000,
): CategoryMetrics[] {
  const [categories, setCategories] = useState(initial);

  useEffect(() => {
    setCategories(initial);
  }, [initial]);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch('/api/categories');
        if (!res.ok) return;
        const body = (await res.json()) as { categories?: CategoryPayload[] };
        const incoming = body.categories ?? [];
        if (cancelled || incoming.length === 0) return;
        setCategories((prev) =>
          prev.map((row) => {
            const next = incoming.find((item) => item.slug === row.slug);
            return next ? mergeMetrics(row, next) : row;
          }),
        );
      } catch {
        /* keep last good metrics */
      }
    };
    const id = setInterval(() => void tick(), intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [intervalMs]);

  return categories;
}

export function useLiveCategory(
  initial: CategoryMetrics,
  intervalMs = 8_000,
): CategoryMetrics {
  const [metrics, setMetrics] = useState(initial);

  useEffect(() => {
    setMetrics(initial);
  }, [initial]);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/categories/${encodeURIComponent(initial.slug)}`);
        if (!res.ok) return;
        const body = (await res.json()) as CategoryPayload;
        if (cancelled || !body.slug) return;
        setMetrics((prev) => mergeMetrics(prev, body));
      } catch {
        /* keep last good metrics */
      }
    };
    const id = setInterval(() => void tick(), intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [initial.slug, intervalMs]);

  return metrics;
}
