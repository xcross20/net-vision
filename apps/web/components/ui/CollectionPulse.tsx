'use client';

import { useEffect, useState } from 'react';
import { MetricStrip } from './MetricStrip';
import type { CollectionSnapshot, DataFreshness } from '@/lib/market';

export function CollectionPulse({
  snapshot: initialSnapshot,
  freshness: initialFreshness,
}: {
  snapshot: CollectionSnapshot;
  freshness: DataFreshness;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [freshness, setFreshness] = useState(initialFreshness);

  useEffect(() => {
    setSnapshot(initialSnapshot);
    setFreshness(initialFreshness);
  }, [initialSnapshot, initialFreshness]);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch('/api/v1/collection');
        if (!res.ok) return;
        const body = (await res.json()) as {
          snapshot?: CollectionSnapshot;
          freshness?: DataFreshness;
        };
        if (cancelled || !body.snapshot) return;
        setSnapshot(body.snapshot);
        if (body.freshness) setFreshness(body.freshness);
      } catch {
        /* keep last good pulse */
      }
    };
    const id = setInterval(() => void tick(), 10_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return <MetricStrip snapshot={snapshot} freshness={freshness} />;
}
