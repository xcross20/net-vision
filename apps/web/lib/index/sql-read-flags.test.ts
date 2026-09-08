import { afterEach, describe, expect, it } from 'vitest';
import { marketReadModel } from './sql-read-flags';

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
});
