'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from '@phosphor-icons/react/dist/ssr';
import { cn } from '@/lib/cn';

/**
 * Side drawer. Used for filters, asset details, etc.
 *
 * - Desktop: slides in from the right with a translucent scrim.
 * - Mobile: reuses the BottomSheet primitive; the drawer becomes a
 *   bottom sheet automatically because it uses the same mount point.
 *
 * The component is intentionally headless: callers supply a title and
 * the content. Closes on scrim click and Escape.
 */
export function Drawer({
  open,
  onClose,
  title,
  side = 'right',
  width = 'md',
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  side?: 'right' | 'left';
  width?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const widthClass =
    width === 'lg' ? 'md:max-w-xl' : width === 'sm' ? 'md:max-w-sm' : 'md:max-w-md';

  const isRight = side === 'right';
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center md:items-stretch md:justify-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
        >
          <motion.div
            className="absolute inset-0 bg-[rgba(5,9,8,0.72)] backdrop-blur-sm"
            aria-hidden="true"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === 'string' ? title : 'Drawer'}
            onClick={(e) => e.stopPropagation()}
            initial={isRight ? { x: 32, opacity: 0 } : { x: -32, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={isRight ? { x: 24, opacity: 0 } : { x: -24, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            className={cn(
              'relative z-10 flex w-full flex-col overflow-hidden',
              'rounded-t-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)]',
              'max-h-[92dvh]',
              'md:rounded-none md:rounded-l-[var(--radius-lg)] md:max-h-none md:h-full',
              widthClass,
              className,
            )}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-[var(--color-border-subtle)] px-5 py-4">
              <span className="text-sm font-semibold tracking-tight text-[var(--color-text-primary)]">
                {title}
              </span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="nv-icon-btn h-9 w-9"
              >
                <X size={14} weight="bold" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
