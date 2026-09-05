'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/cn';

/**
 * Mobile bottom sheet. Slides up from the bottom edge, with a drag
 * handle, scrim, and Escape support. On desktop the same surface still
 * renders as a centered card so callers can mount it unconditionally.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  height = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  height?: 'sm' | 'md' | 'lg' | 'full';
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const heightClass =
    height === 'full'
      ? 'h-[92dvh]'
      : height === 'lg'
        ? 'h-[75dvh]'
        : height === 'sm'
          ? 'h-[40dvh]'
          : 'h-[60dvh]';

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-[rgba(5,9,8,0.72)] backdrop-blur-sm" aria-hidden="true" />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === 'string' ? title : 'Sheet'}
            onClick={(e) => e.stopPropagation()}
            initial={{ y: 48, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            className={cn(
              'relative z-10 flex w-full max-w-md flex-col overflow-hidden rounded-t-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)]',
              heightClass,
            )}
          >
            <div className="flex justify-center pt-2.5">
              <span className="h-1 w-10 rounded-full bg-[var(--color-border-default)]" />
            </div>
            <div className="flex-1 overflow-y-auto px-5 pb-6 pt-3">{children}</div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
