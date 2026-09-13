import Image from 'next/image';
import { Cube, Graph, Globe, Hash } from '@phosphor-icons/react/dist/ssr';
import { cn } from '@/lib/cn';
import { hasCategoryShowroom, showroomHeroForCategory } from '@/lib/brand/media';
import type { CategoryMetrics } from '@/lib/market';

const FAMILY_ICON = {
  number: Hash,
  material: Cube,
  pattern: Graph,
  culture: Globe,
} as const;

function glyphLabel(metrics: CategoryMetrics): string {
  if (metrics.family === 'number') {
    const digits = metrics.slug.match(/digits-(\d)/);
    if (digits) {
      return '123456789'.slice(0, Number(digits[1]));
    }
    if (metrics.slug.includes('palindrome')) return '111';
    if (metrics.slug.includes('repeat')) return '22';
    if (metrics.slug.includes('triple')) return '333';
    if (metrics.slug.includes('quad')) return '4444';
    if (metrics.slug.includes('year')) return '24';
  }
  return metrics.name.slice(0, 1).toUpperCase();
}

export function CategoryGlyph({
  metrics,
  size = 'md',
}: {
  metrics: CategoryMetrics;
  size?: 'sm' | 'md' | 'lg';
}) {
  const Icon = FAMILY_ICON[metrics.family as keyof typeof FAMILY_ICON] ?? Cube;
  const box =
    size === 'lg' ? 'h-16 w-16 text-[1.35rem]' : size === 'sm' ? 'h-9 w-9 text-[11px]' : 'h-12 w-12 text-sm';
  if (hasCategoryShowroom(metrics.slug)) {
    return (
      <span
        className={cn(
          'relative inline-flex shrink-0 overflow-hidden rounded-[12px] border border-[var(--color-border-subtle)]',
          box,
        )}
        aria-hidden="true"
      >
        <Image
          src={showroomHeroForCategory(metrics.slug)}
          alt=""
          fill
          sizes="64px"
          className="object-cover object-center"
        />
      </span>
    );
  }
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-[12px] border border-[var(--color-border-subtle)]',
        'bg-[rgba(72,235,145,0.08)] font-semibold tracking-tight text-[var(--color-net-green)]',
        box,
      )}
      aria-hidden="true"
    >
      {metrics.family === 'number' ? glyphLabel(metrics) : <Icon size={size === 'lg' ? 26 : size === 'sm' ? 14 : 18} weight="duotone" />}
    </span>
  );
}
