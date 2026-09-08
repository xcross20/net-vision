import { afterEach, describe, expect, it } from 'vitest';
import { isNextProductionBuild, marketReadModel } from './sql-read-flags';

describe('marketReadModel', () => {
  const previous = process.env.MARKET_READ_MODEL;

  afterEach(() => {
    if (previous === undefined) delete process.env.MARKET_READ_MODEL;
    else process.env.MARKET_READ_MODEL = previous;
  });

  it('defaults to blob so A4 does not flip staging or production', () => {
    delete process.env.MARKET_READ_MODEL;
    expect(marketReadModel()).toBe('blob');
  });

  it('selects sql only when explicitly set', () => {
    process.env.MARKET_READ_MODEL = 'sql';
    expect(marketReadModel()).toBe('sql');
  });

  it('detects next production build so SQL reads do not hit Postgres during prerender', () => {
    const prev = process.env.NEXT_PHASE;
    process.env.NEXT_PHASE = 'phase-production-build';
    expect(isNextProductionBuild()).toBe(true);
    if (prev === undefined) delete process.env.NEXT_PHASE;
    else process.env.NEXT_PHASE = prev;
    expect(isNextProductionBuild()).toBe(false);
  });
});
