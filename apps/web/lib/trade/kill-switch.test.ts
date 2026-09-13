import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { isSurfaceEnabled, isTradingEnabled, tradingDisabledResponse } from './kill-switch';

const TRADING_KEYS = [
  'TRADING_ENABLED',
  'NEXT_PUBLIC_TRADING_ENABLED',
  'BUY_ENABLED',
  'LIST_ENABLED',
  'OFFER_ENABLED',
  'SWEEP_ENABLED',
  'ACCEPT_OFFER_ENABLED',
] as const;

function clearEnv(): void {
  for (const key of TRADING_KEYS) {
    delete process.env[key];
  }
}

describe('kill-switch fail-closed defaults', () => {
  beforeEach(() => {
    clearEnv();
  });
  afterEach(() => {
    clearEnv();
  });

  it('treats undefined trading flag as disabled', () => {
    expect(isTradingEnabled()).toBe(false);
  });

  it('requires TRADING_ENABLED=true before any surface can be on', () => {
    process.env.LIST_ENABLED = 'true';
    process.env.OFFER_ENABLED = 'true';
    process.env.BUY_ENABLED = 'true';
    expect(isSurfaceEnabled('list')).toBe(false);
    expect(isSurfaceEnabled('offer')).toBe(false);
    expect(isSurfaceEnabled('buy')).toBe(false);
  });

  it('defaults Buy to ON when trading is enabled', () => {
    process.env.TRADING_ENABLED = 'true';
    expect(isSurfaceEnabled('buy')).toBe(true);
  });

  it('defaults List to OFF (fail-closed) when trading is enabled', () => {
    process.env.TRADING_ENABLED = 'true';
    expect(isSurfaceEnabled('list')).toBe(false);
  });

  it('defaults Offer to OFF (fail-closed) when trading is enabled', () => {
    process.env.TRADING_ENABLED = 'true';
    expect(isSurfaceEnabled('offer')).toBe(false);
  });

  it('defaults Sweep to OFF when trading is enabled', () => {
    process.env.TRADING_ENABLED = 'true';
    expect(isSurfaceEnabled('sweep')).toBe(false);
  });

  it('defaults AcceptOffer to OFF when trading is enabled', () => {
    process.env.TRADING_ENABLED = 'true';
    expect(isSurfaceEnabled('accept_offer')).toBe(false);
  });

  it('honors LIST_ENABLED=true to override the fail-closed default', () => {
    process.env.TRADING_ENABLED = 'true';
    process.env.LIST_ENABLED = 'true';
    expect(isSurfaceEnabled('list')).toBe(true);
  });

  it('honors OFFER_ENABLED=true to override the fail-closed default', () => {
    process.env.TRADING_ENABLED = 'true';
    process.env.OFFER_ENABLED = 'true';
    expect(isSurfaceEnabled('offer')).toBe(true);
  });

  it('treats TRADING_ENABLED=false as a hard kill', () => {
    process.env.TRADING_ENABLED = 'false';
    process.env.BUY_ENABLED = 'true';
    process.env.LIST_ENABLED = 'true';
    process.env.OFFER_ENABLED = 'true';
    expect(isSurfaceEnabled('buy')).toBe(false);
    expect(isSurfaceEnabled('list')).toBe(false);
    expect(isSurfaceEnabled('offer')).toBe(false);
  });

  it('falls back to NEXT_PUBLIC_TRADING_ENABLED when TRADING_ENABLED is unset', () => {
    process.env.NEXT_PUBLIC_TRADING_ENABLED = 'true';
    expect(isTradingEnabled()).toBe(true);
    expect(isSurfaceEnabled('buy')).toBe(true);
  });

  it('treats empty / whitespace flag values as the default', () => {
    process.env.TRADING_ENABLED = '   ';
    expect(isTradingEnabled()).toBe(false);
  });

  it('returns a structured 503-shaped payload from tradingDisabledResponse', () => {
    expect(tradingDisabledResponse('list')).toEqual({
      error: 'trading_temporarily_disabled',
      surface: 'list',
      message: 'Market data is available; trading is temporarily disabled.',
    });
  });
});