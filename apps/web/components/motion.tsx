/**
 * Motion primitives isolated as 'use client' leaf components.
 *
 * The design-taste-frontend-v1 skill requires perpetual motion and
 * stagger reveals to live in their own memoized client islands so
 * parent server components can stay static.
 */
'use client';

import { motion, type HTMLMotionProps, type Variants } from 'framer-motion';
import { memo } from 'react';

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const SPRING = {
  type: 'spring' as const,
  stiffness: 100,
  damping: 20,
};

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 100, damping: 20 },
  },
};

export const staggerParent: Variants = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
};

export const staggerChild: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 110, damping: 22 },
  },
};

type DivProps = HTMLMotionProps<'div'> & { children?: React.ReactNode };

/**
 * StaggeredList — a parent that cascades child mounts.
 * Children wrapped in <StaggerItem /> (or marked with layout variants)
 * will reveal sequentially.
 */
export const StaggerList = memo(function StaggerList({ children, ...rest }: DivProps) {
  return (
    <motion.div
      variants={staggerParent}
      initial="hidden"
      animate="visible"
      {...rest}
    >
      {children}
    </motion.div>
  );
});

export const StaggerItem = memo(function StaggerItem({ children, ...rest }: DivProps) {
  return (
    <motion.div variants={staggerChild} {...rest}>
      {children}
    </motion.div>
  );
});

/**
 * LivePulse — a breathing status indicator.
 * MOTION_INTENSITY 6 = subtle perpetual animation.
 */
export const LivePulse = memo(function LivePulse({
  size = 8,
  color = 'var(--nv-green)',
}: {
  size?: number;
  color?: string;
}) {
  return (
    <span
      style={{
        display: 'inline-block',
        position: 'relative',
        width: size,
        height: size,
      }}
    >
      <motion.span
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: color,
          opacity: 0.35,
        }}
        animate={{ scale: [1, 2.4], opacity: [0.45, 0] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: EASE_OUT }}
      />
      <motion.span
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: color,
        }}
        animate={{ opacity: [1, 0.55, 1] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: EASE_OUT }}
      />
    </span>
  );
});