'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';

/**
 * Pulsing dot used to mark live data sources, network heartbeat, etc.
 * `tone` picks the dot color while the size prop controls diameter.
 */
export function LiveIndicator({
  tone = 'green',
  size = 8,
  label,
  className,
}: {
  tone?: 'green' | 'amber' | 'red' | 'muted';
  size?: number;
  label?: string;
  className?: string;
}) {
  const color =
    tone === 'amber' ? 'var(--color-warning)' :
    tone === 'red' ? 'var(--color-danger)' :
    tone === 'muted' ? 'var(--color-text-tertiary)' :
    'var(--color-net-green)';
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span
        className="relative inline-block"
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        <motion.span
          className="absolute inset-0 rounded-full"
          style={{ background: color, opacity: 0.4 }}
          animate={{ scale: [1, 2.4], opacity: [0.45, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: [0.16, 1, 0.3, 1] }}
        />
        <motion.span
          className="absolute inset-0 rounded-full"
          style={{ background: color }}
          animate={{ opacity: [1, 0.55, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: [0.16, 1, 0.3, 1] }}
        />
      </span>
      {label ? (
        <span className="text-label">{label}</span>
      ) : null}
    </span>
  );
}