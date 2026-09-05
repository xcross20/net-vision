/**
 * Centralized Phosphor icon barrel for the Net Vision web app.
 *
 * The design-taste-frontend-v1 skill bans emoji and arbitrary unicode
 * glyphs in UI surfaces. All icons route through this barrel so:
 *  - we standardize strokeWidth / weight (skill: globally 1.5 or 2.0)
 *  - swapping icon families is one diff
 *  - tree-shaking is preserved via named exports
 */
'use client';

import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CircleNotch,
  Clock,
  Cube,
  Funnel,
  Hexagon,
  Pulse,
  Sparkle,
  Star,
  Storefront,
  Tag,
  Wallet,
  Warning,
  X,
} from '@phosphor-icons/react';

const baseProps = {
  size: 16,
  weight: 'regular' as const,
  'aria-hidden': true,
};

export const Hex = (p: React.ComponentProps<typeof Hexagon>) => (
  <Hexagon {...baseProps} weight="duotone" {...p} />
);
export const CloseIcon = (p: React.ComponentProps<typeof X>) => (
  <X {...baseProps} weight="bold" {...p} />
);
export const ArrowR = (p: React.ComponentProps<typeof ArrowRight>) => (
  <ArrowRight {...baseProps} {...p} />
);
export const ArrowUR = (p: React.ComponentProps<typeof ArrowUpRight>) => (
  <ArrowUpRight {...baseProps} {...p} />
);
export const StarIcon = (p: React.ComponentProps<typeof Star>) => (
  <Star {...baseProps} weight="duotone" {...p} />
);
export const TagIcon = (p: React.ComponentProps<typeof Tag>) => (
  <Tag {...baseProps} weight="duotone" {...p} />
);
export const StoreIcon = (p: React.ComponentProps<typeof Storefront>) => (
  <Storefront {...baseProps} weight="duotone" {...p} />
);
export const WalletIcon = (p: React.ComponentProps<typeof Wallet>) => (
  <Wallet {...baseProps} weight="duotone" {...p} />
);
export const PulseIcon = (p: React.ComponentProps<typeof Pulse>) => (
  <Pulse {...baseProps} weight="duotone" {...p} />
);
export const SparkIcon = (p: React.ComponentProps<typeof Sparkle>) => (
  <Sparkle {...baseProps} weight="duotone" {...p} />
);
export const ClockIcon = (p: React.ComponentProps<typeof Clock>) => (
  <Clock {...baseProps} {...p} />
);
export const FilterIcon = (p: React.ComponentProps<typeof Funnel>) => (
  <Funnel {...baseProps} {...p} />
);
export const CubeIcon = (p: React.ComponentProps<typeof Cube>) => (
  <Cube {...baseProps} weight="duotone" {...p} />
);
export const SpinnerIcon = (p: React.ComponentProps<typeof CircleNotch>) => (
  <CircleNotch {...baseProps} {...p} />
);
export const WarnIcon = (p: React.ComponentProps<typeof Warning>) => (
  <Warning {...baseProps} weight="duotone" {...p} />
);
export const CheckIcon = (p: React.ComponentProps<typeof Check>) => (
  <Check {...baseProps} weight="bold" {...p} />
);

export { ArrowRight, ArrowUpRight, Hexagon };