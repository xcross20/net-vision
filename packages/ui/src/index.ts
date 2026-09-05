/**
 * Net Vision shared UI tokens and primitives.
 *
 * The application must feel like a native module of the NetNet product
 * family. These tokens are the implementation defaults; the final UI
 * must cross-check the live app.netnet.capital production values and
 * update if the family changes.
 */

export const designTokens = {
  color: {
    bg: '#08110D',
    bgElev: '#0B1612',
    panel: '#101B15',
    panelElevated: '#14231B',
    panelSoft: '#0E1A14',
    green: '#74F0A7',
    greenStrong: '#35C97B',
    greenDim: '#2A8A57',
    text: '#EAF5EE',
    textSoft: '#C9DCD0',
    muted: '#9FB6A8',
    mutedDim: '#6E8479',
    border: '#1E3329',
    borderStrong: '#294335',
    danger: '#FF6B6B',
    warning: '#E8C86A',
  },
  font: {
    sans: 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: 'var(--font-geist-mono), ui-monospace, "SF Mono", Menlo, monospace',
  },
  radius: {
    xs: '4px',
    sm: '6px',
    md: '10px',
    lg: '16px',
    xl: '24px',
  },
  easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
} as const;

export type DesignTokens = typeof designTokens;

export function formatPrice(value: number | null | undefined, currency: string = 'ETH'): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  if (value === 0) return `0 ${currency}`;
  if (value < 0.001) return `${value.toExponential(2)} ${currency}`;
  if (value < 1) return `${value.toFixed(4)} ${currency}`;
  return `${value.toFixed(3)} ${currency}`;
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${(value * 100).toFixed(1)}%`;
}

export function formatRelativeTime(epochSeconds: number | null | undefined): string {
  if (!epochSeconds) return '—';
  const diff = Math.floor(Date.now() / 1000 - epochSeconds);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86_400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86_400)}d ago`;
}
