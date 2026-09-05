'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { MagnifyingGlass, ShoppingBag, Hexagon, List, X } from '@phosphor-icons/react/dist/ssr';
import { useState } from 'react';
import { cn } from '@/lib/cn';
import { WalletControl } from './WalletControl';

const NAV = [
  { href: '/market', label: 'Market' },
  { href: '/categories', label: 'Categories' },
  { href: '/activity', label: 'Activity' },
];

/**
 * Sticky top navigation. ~72 px tall, graphite translucent backdrop
 * with a subtle bottom hairline. Logo at left, primary nav centered
 * against the available space, utilities at right.
 *
 * The search button is wired through `onOpenSearch` so the host can
 * mount a SearchCommand panel alongside the header.
 */
export function MarketHeader({ onOpenSearch }: { onOpenSearch?: () => void }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <header className="sticky top-0 z-30 h-[72px] border-b border-[var(--color-border-subtle)] bg-[color-mix(in_srgb,var(--color-bg)_85%,transparent)] backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-7xl items-center gap-6 px-4 md:px-8">
        <Link
          href="/"
          className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-[var(--color-text-primary)]"
        >
          <motion.span
            initial={{ rotate: 0 }}
            whileHover={{ rotate: 30 }}
            transition={{ type: 'spring', stiffness: 220, damping: 14 }}
            className="flex h-8 w-8 items-center justify-center rounded-md bg-[rgba(72,235,145,0.10)] text-[var(--color-net-green)]"
          >
            <Hexagon size={18} weight="duotone" />
          </motion.span>
          <span>Net Vision</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => {
            const active =
              item.href === '/'
                ? pathname === '/'
                : pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'relative rounded-md px-3 py-2 text-sm transition-colors',
                  active
                    ? 'text-[var(--color-text-primary)]'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
                )}
              >
                <span className="relative inline-flex">
                  {item.label}
                  {active ? (
                    <motion.span
                      layoutId="nav-underline"
                      className="absolute -bottom-1 left-0 right-0 h-px bg-[var(--color-net-green)]"
                      transition={{ type: 'spring', stiffness: 240, damping: 26 }}
                    />
                  ) : null}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1 md:gap-2">
          <button
            type="button"
            aria-label="Search"
            onClick={() => onOpenSearch?.()}
            className="hidden h-10 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] px-3 text-sm text-[var(--color-text-tertiary)] transition-colors hover:border-[var(--color-border-default)] hover:text-[var(--color-text-primary)] md:inline-flex"
          >
            <MagnifyingGlass size={14} weight="bold" />
            <span>Search</span>
            <kbd className="text-numeral ml-3 hidden rounded border border-[var(--color-border-subtle)] px-1.5 py-0.5 text-[10px] text-[var(--color-text-tertiary)] md:inline">
              K
            </kbd>
          </button>
          <button
            type="button"
            onClick={() => onOpenSearch?.()}
            aria-label="Search"
            className="nv-icon-btn md:hidden"
          >
            <MagnifyingGlass size={16} weight="bold" />
          </button>
          <button
            type="button"
            aria-label="Cart"
            className="nv-icon-btn"
          >
            <ShoppingBag size={16} weight="regular" />
          </button>
          <WalletControl />
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
            className="nv-icon-btn md:hidden"
          >
            <List size={16} weight="bold" />
          </button>
        </div>

        <AnimatePresence>
          {mobileOpen ? (
            <motion.div
              className="fixed inset-0 z-40 md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setMobileOpen(false)}
            >
              <div className="absolute inset-0 bg-[rgba(5,9,8,0.72)] backdrop-blur-sm" aria-hidden="true" />
              <motion.div
                onClick={(e) => e.stopPropagation()}
                initial={{ y: -16, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -8, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 28 }}
                className="relative z-10 flex flex-col gap-2 border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] px-4 py-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-eyebrow-muted">Menu</span>
                  <button
                    type="button"
                    aria-label="Close menu"
                    onClick={() => setMobileOpen(false)}
                    className="nv-icon-btn h-9 w-9"
                  >
                    <X size={14} weight="bold" />
                  </button>
                </div>
                <div className="flex flex-col">
                  {NAV.map((item) => {
                    const active =
                      item.href === '/'
                        ? pathname === '/'
                        : pathname?.startsWith(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          'rounded-md px-3 py-3 text-sm transition-colors',
                          active
                            ? 'bg-[var(--color-surface-3)] text-[var(--color-text-primary)]'
                            : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]',
                        )}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </header>
  );
}