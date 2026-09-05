'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { MagnifyingGlass, X, ArrowRight, Hash, Coins } from '@phosphor-icons/react/dist/ssr';
import { cn } from '@/lib/cn';
import type { Token, CategoryMetrics } from '@/lib/market';
import { payment, relative } from '@/lib/format';

/**
 * Cmd+K command palette. Searches across categories and tokens; opens
 * full-screen on mobile and as a centered overlay on desktop.
 *
 * This is a presentation layer. The caller wires it to a real search
 * backend. Today it filters whatever arrays are passed in.
 */
export function SearchCommand({
  open,
  onClose,
  tokens = [],
  categories = [],
  onQuery,
  emptyHint = 'Try "1221", "palindromes", or any token id.',
}: {
  open: boolean;
  onClose: () => void;
  tokens?: Token[];
  categories?: CategoryMetrics[];
  onQuery?: (q: string) => void;
  emptyHint?: string;
}) {
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
    setQ('');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const filteredCategories = useMemo(() => {
    if (!q.trim()) return categories.slice(0, 4);
    const needle = q.toLowerCase();
    return categories.filter(
      (c) =>
        c.name.toLowerCase().includes(needle) ||
        c.slug.toLowerCase().includes(needle) ||
        c.description.toLowerCase().includes(needle),
    );
  }, [categories, q]);

  const filteredTokens = useMemo(() => {
    if (!q.trim()) return tokens.slice(0, 6);
    const needle = q.toLowerCase();
    return tokens.filter((t) => t.tokenId.toLowerCase().includes(needle)).slice(0, 8);
  }, [tokens, q]);

  const hasAny = filteredCategories.length > 0 || filteredTokens.length > 0;

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[8vh] md:pt-[14vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-[rgba(5,9,8,0.72)] backdrop-blur-sm" aria-hidden="true" />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Search"
            onClick={(e) => e.stopPropagation()}
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            className="relative z-10 flex max-h-[80dvh] w-full max-w-xl flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] shadow-[0_24px_72px_-24px_rgba(0,0,0,0.7)]"
          >
            <div className="flex items-center gap-3 border-b border-[var(--color-border-subtle)] px-4 py-3">
              <MagnifyingGlass size={16} weight="bold" className="text-[var(--color-text-tertiary)]" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  onQuery?.(e.target.value);
                }}
                placeholder="Search tokens or categories"
                className="flex-1 bg-transparent text-[15px] tracking-tight text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none"
              />
              <button
                type="button"
                onClick={onClose}
                aria-label="Close search"
                className="nv-icon-btn h-8 w-8"
              >
                <X size={12} weight="bold" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {!hasAny ? (
                <div className="px-5 py-10 text-center">
                  <p className="text-sm text-[var(--color-text-secondary)]">{emptyHint}</p>
                </div>
              ) : (
                <>
                  {filteredCategories.length > 0 ? (
                    <Section title="Categories" icon={<Coins size={11} weight="duotone" />}>
                      {filteredCategories.map((c) => (
                        <Link
                          key={c.slug}
                          href={`/categories/${c.slug}`}
                          onClick={onClose}
                          className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--color-surface-hover)]"
                        >
                          <span className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] bg-[rgba(72,235,145,0.10)] text-[var(--color-net-green)]">
                            <Coins size={14} weight="duotone" />
                          </span>
                          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="truncate text-sm font-semibold tracking-tight text-[var(--color-text-primary)]">
                              {c.name}
                            </span>
                            <span className="truncate text-[11px] text-[var(--color-text-tertiary)]">
                              {c.description}
                            </span>
                          </span>
                          <span className="text-numeral text-xs text-[var(--color-text-secondary)]">
                            Floor {c.floorPrice !== null ? payment(c.floorPrice, c.currency) : '—'}
                          </span>
                        </Link>
                      ))}
                    </Section>
                  ) : null}

                  {filteredTokens.length > 0 ? (
                    <Section title="Tokens" icon={<Hash size={11} weight="duotone" />}>
                      {filteredTokens.map((t) => {
                        const ask = t.listingPrice;
                        return (
                          <Link
                            key={t.tokenId}
                            href={`/tokens/${t.tokenId}`}
                            onClick={onClose}
                            className={cn(
                              'flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--color-surface-hover)]',
                            )}
                          >
                            <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-[var(--color-surface-2)]">
                              <Image src={t.imageUrl} alt="" fill sizes="2rem" className="object-cover" />
                            </span>
                            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                              <span className="text-numeral text-sm font-semibold tracking-tight text-[var(--color-text-primary)]">
                                #{t.tokenId}
                              </span>
                              <span className="truncate text-[11px] text-[var(--color-text-tertiary)]">
                                Listed {t.listedAt ? relative(t.listedAt) : '—'}
                              </span>
                            </span>
                            <span className="text-numeral text-xs text-[var(--color-text-secondary)]">
                              {payment(ask, t.currency, '—')}
                            </span>
                          </Link>
                        );
                      })}
                    </Section>
                  ) : null}
                </>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-[var(--color-border-subtle)] px-4 py-2.5 text-[11px] text-[var(--color-text-tertiary)]">
              <span className="inline-flex items-center gap-1.5">
                <kbd className="rounded border border-[var(--color-border-subtle)] px-1 py-px text-[10px]">esc</kbd>
                to close
              </span>
              <span className="inline-flex items-center gap-1">
                <ArrowRight size={11} weight="bold" />
                Net Vision
              </span>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 py-2">
      <div className="flex items-center gap-2 px-4 py-1 text-eyebrow-muted">
        {icon}
        {title}
      </div>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}
