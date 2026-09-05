/**
 * Server-side trading kill switches.
 * Prefer these over NEXT_PUBLIC_* for enforcement — public flags are UX only.
 */

export type TradeSurface = 'buy' | 'list' | 'offer' | 'sweep' | 'accept_offer';

function flag(name: string, defaultValue = true): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (raw === undefined || raw === '') return defaultValue;
  return raw === '1' || raw === 'true' || raw === 'yes';
}

/** Master switch — when false, all prepare routes refuse. */
export function isTradingEnabled(): boolean {
  // Support both names during migration.
  if (process.env.TRADING_ENABLED !== undefined) {
    return flag('TRADING_ENABLED', false);
  }
  return flag('NEXT_PUBLIC_TRADING_ENABLED', false);
}

export function isSurfaceEnabled(surface: TradeSurface): boolean {
  if (!isTradingEnabled()) return false;
  switch (surface) {
    case 'buy':
      return flag('BUY_ENABLED', true);
    case 'list':
      return flag('LIST_ENABLED', true);
    case 'offer':
      return flag('OFFER_ENABLED', true);
    case 'sweep':
      return flag('SWEEP_ENABLED', false);
    case 'accept_offer':
      // Disabled until Seaport offer extraction matches buy-path hardening.
      return flag('ACCEPT_OFFER_ENABLED', false);
    default:
      return false;
  }
}

export function tradingDisabledResponse(surface: TradeSurface) {
  return {
    error: 'trading_temporarily_disabled',
    surface,
    message: 'Market data is available; trading is temporarily disabled.',
  };
}
