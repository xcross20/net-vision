'use client';

import { useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { ArrowRight, ChartLine } from '@phosphor-icons/react/dist/ssr';
import { SHOWROOM_MEDIA } from '@/lib/brand/media';
import { GlassMetrics, type GlassMetric } from '@/components/showroom/GlassMetrics';

export function MarketHero({
  metrics,
}: {
  metrics: GlassMetric[];
}) {
  const ref = useRef<HTMLElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const x = useSpring(mx, { stiffness: 60, damping: 22 });
  const y = useSpring(my, { stiffness: 60, damping: 22 });
  const bgX = useTransform(x, [-40, 40], [-12, 12]);
  const bgY = useTransform(y, [-40, 40], [-8, 8]);
  const fogX = useTransform(x, [-40, 40], [8, -8]);

  return (
    <section
      ref={ref}
      onPointerMove={(e) => {
        const box = ref.current?.getBoundingClientRect();
        if (!box) return;
        mx.set(((e.clientX - box.left) / box.width - 0.5) * 48);
        my.set(((e.clientY - box.top) / box.height - 0.5) * 48);
      }}
      onPointerLeave={() => {
        mx.set(0);
        my.set(0);
      }}
      className="relative isolate min-h-[28rem] overflow-hidden rounded-[28px] border border-[rgba(92,255,153,0.16)] md:min-h-[32rem]"
    >
      <motion.div className="absolute -inset-8" style={{ x: bgX, y: bgY }}>
        <Image
          src={SHOWROOM_MEDIA.marketHero}
          alt="Cinematic Button Presser plaques staged in a showroom environment"
          fill
          priority
          sizes="(min-width: 1280px) 110rem, 100vw"
          className="object-cover object-[68%_48%]"
        />
      </motion.div>
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ x: fogX }}
      >
        <div className="nv-showroom-scrim absolute inset-0" />
        <div className="nv-showroom-vignette absolute inset-0" />
      </motion.div>

      <div className="relative z-10 flex min-h-[28rem] flex-col justify-between gap-8 p-6 pb-8 md:min-h-[32rem] md:p-10 md:pb-9 lg:px-12 lg:pt-12">
        <div className="grid grid-cols-1 lg:grid-cols-12">
          <div className="flex max-w-[46rem] flex-col gap-5 lg:col-span-7">
            <span className="text-[11px] font-medium uppercase tracking-[0.24em] text-[var(--color-net-green)]">
              Marketplace · Live
            </span>
            <h1 className="text-display text-[clamp(3.25rem,6.2vw,4.6rem)] leading-[0.94] text-[var(--color-text-primary)]">
              Button Presser
              <span className="mt-1 block whitespace-nowrap text-[clamp(2.1rem,4.4vw,3.35rem)] leading-[1.02] text-[var(--color-net-green)]">
                The Market for Numbers.
              </span>
            </h1>
            <p className="max-w-[42ch] text-[16px] leading-relaxed text-[var(--color-text-secondary)] md:text-[17px]">
              Collect. Trade. Build what's next. Iconic numbers. Real ownership. A more connected tomorrow.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/categories" className="nv-button h-12 px-6 text-[15px]">
                Explore collection
                <ArrowRight size={16} weight="bold" />
              </Link>
              <Link href="/activity" className="nv-button nv-button-ghost nv-glass-2 h-12 px-6 text-[15px]">
                <ChartLine size={16} weight="bold" />
                View analytics
              </Link>
            </div>
          </div>
          <div className="hidden lg:col-span-5 lg:flex lg:justify-end">
            <p className="max-w-[11rem] pt-3 text-right text-[11px] font-medium uppercase leading-[1.7] tracking-[0.22em] text-[var(--color-text-secondary)]">
              Same numbers.
              <span className="block">Bigger</span>
              <span className="block">possibilities.</span>
              <span className="mt-4 inline-block h-px w-10 bg-[var(--color-net-green)]" />
            </p>
          </div>
        </div>
        <GlassMetrics items={metrics} variant="chips" />
      </div>
    </section>
  );
}
