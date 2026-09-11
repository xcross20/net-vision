import type { ReactNode } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/cn';
import { GlassMetrics, type GlassMetric } from './GlassMetrics';

/**
 * Full-width photographic showroom banner.
 * Background is decorative brand photography. Never pass canonical NFT media here.
 */
export function CinematicHero({
  imageSrc,
  imageAlt,
  eyebrow,
  title,
  kicker,
  body,
  actions,
  metrics,
  metricsVariant = 'chips',
  aside,
  children,
  minHeightClass = 'min-h-[28rem] md:min-h-[32rem]',
  priority = false,
}: {
  imageSrc: string;
  imageAlt: string;
  eyebrow?: string;
  title: ReactNode;
  kicker?: ReactNode;
  body?: ReactNode;
  actions?: ReactNode;
  metrics?: GlassMetric[];
  metricsVariant?: 'chips' | 'bar';
  aside?: ReactNode;
  children?: ReactNode;
  minHeightClass?: string;
  priority?: boolean;
}) {
  return (
    <section
      className={cn(
        'relative isolate overflow-hidden rounded-[24px] border border-[var(--color-border-subtle)]',
        minHeightClass,
      )}
    >
      <Image
        src={imageSrc}
        alt={imageAlt}
        fill
        priority={priority}
        sizes="(min-width: 1280px) 100rem, 100vw"
        className="object-cover object-right"
      />
      <div className="nv-showroom-scrim pointer-events-none absolute inset-0" />
      <div className="nv-showroom-vignette pointer-events-none absolute inset-0" />

      <div className="relative z-10 flex h-full flex-col justify-between gap-8 p-5 sm:p-8 lg:p-10">
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
          <div className="flex max-w-[40rem] flex-col gap-5 lg:col-span-7">
            {eyebrow ? <span className="text-eyebrow">{eyebrow}</span> : null}
            <h1 className="text-display text-[clamp(2.75rem,7vw,5.5rem)] text-[var(--color-text-primary)]">
              {title}
            </h1>
            {kicker ? (
              <p className="text-[1.15rem] font-medium leading-snug text-[var(--color-text-primary)] md:text-[1.35rem]">
                {kicker}
              </p>
            ) : null}
            {body ? (
              <p className="max-w-[46ch] text-[15px] leading-relaxed text-[var(--color-text-secondary)] md:text-[16px]">
                {body}
              </p>
            ) : null}
            {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
            {children}
          </div>
          {aside ? (
            <div className="hidden lg:col-span-5 lg:flex lg:justify-end">{aside}</div>
          ) : null}
        </div>

        {metrics && metrics.length > 0 ? (
          <GlassMetrics items={metrics} variant={metricsVariant} />
        ) : null}
      </div>
    </section>
  );
}

export function ShowroomAside({
  lines,
  footer,
}: {
  lines: string[];
  footer?: ReactNode;
}) {
  return (
    <div className="flex max-w-[14rem] flex-col items-end gap-6 pt-2 text-right">
      <p className="text-[11px] font-medium uppercase leading-relaxed tracking-[0.22em] text-[var(--color-text-secondary)]">
        {lines.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </p>
      <span className="h-px w-10 bg-[var(--color-net-green)]" />
      {footer}
    </div>
  );
}
