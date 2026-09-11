'use client';

import { useEffect, useState } from 'react';
import { checkoutVisibleAssets } from '@net-vision/payment-router';
import { cn } from '@/lib/cn';

type Method = {
  assetId: string;
  available: boolean;
  feeBps: number;
  routeStatus?: string;
  reasonCode?: string;
};

function statusLabel(method: Method | undefined, enabled: boolean): string {
  if (!method) return enabled ? 'Coming soon' : 'Coming soon';
  if (method.reasonCode === 'REGION_RESTRICTED' || method.reasonCode === 'REGION_UNKNOWN') {
    return 'Unavailable in your region';
  }
  if (method.available && method.routeStatus === 'AVAILABLE') return 'Live';
  if (method.available) return 'Coming soon';
  return 'Coming soon';
}

/**
 * Decorative payment identity strip. Availability is server policy.
 * This is not a checkout control.
 */
export function PaymentMethodStrip() {
  const [methods, setMethods] = useState<Method[]>([]);
  useEffect(() => {
    let cancelled = false;
    void fetch('/api/payment/methods')
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { methods?: Method[] } | null) => {
        if (!cancelled && json?.methods) setMethods(json.methods);
      })
      .catch(() => {
        if (!cancelled) setMethods([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const assets = checkoutVisibleAssets();
  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] px-4 py-4 md:flex-row md:items-center md:px-6">
      <span className="text-eyebrow-muted shrink-0">Pay with</span>
      <div className="flex flex-wrap items-center gap-2">
        {assets.map((asset) => {
          const method = methods.find((row) => row.assetId === asset.assetId);
          const live = method?.available === true && method.routeStatus === 'AVAILABLE';
          return (
            <span
              key={asset.assetId}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px]',
                live
                  ? 'border-[var(--color-border-active)] text-[var(--color-text-primary)]'
                  : 'border-[var(--color-border-subtle)] text-[var(--color-text-tertiary)]',
              )}
              title={statusLabel(method, asset.status === 'ENABLED')}
            >
              <span className="font-semibold tracking-tight">{asset.symbol}</span>
              <span className="text-[10px] uppercase tracking-[0.12em]">
                {statusLabel(method, asset.status === 'ENABLED')}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
