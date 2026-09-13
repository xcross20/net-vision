'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, ArrowsClockwise } from '@phosphor-icons/react/dist/ssr';

/**
 * Root Next.js error boundary.
 *
 * Catches render-time failures from any server or client component under app/
 * so the operator sees a coherent message instead of the raw Next.js default.
 * Market data may be temporarily unavailable while this surfaces; trading
 * surfaces are independently gated by the kill switch in lib/trade/kill-switch.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface to the browser console so we can correlate the boundary with
    // the digest in Railway logs. Do not swallow the original stack.
    console.error('[net-vision] route error boundary', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-start justify-center gap-5 py-16">
      <span className="text-eyebrow">Something went wrong</span>
      <h1 className="text-display text-[clamp(2.5rem,5vw,4rem)] text-[var(--color-text-primary)]">
        Market data temporarily unavailable.
      </h1>
      <p className="text-body max-w-[52ch] text-[var(--color-text-secondary)]">
        We hit an unexpected error rendering this page. Market data, listings,
        and portfolio state are read-only operations and may be briefly out of
        sync while we recover. Trading remains gated by the kill switch and is
        unaffected.
      </p>
      {error.digest ? (
        <p className="text-caption font-mono text-[var(--color-text-tertiary)]">
          digest: {error.digest}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={reset}
          className="nv-button"
          data-testid="error-boundary-retry"
        >
          Retry
          <ArrowsClockwise size={14} weight="bold" />
        </button>
        <Link href="/" className="nv-button nv-button-ghost">
          Return home
          <ArrowRight size={14} weight="bold" />
        </Link>
      </div>
    </div>
  );
}