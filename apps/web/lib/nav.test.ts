import { describe, expect, it } from 'vitest';
import { PRIMARY_NAV } from './nav';

describe('primary navigation', () => {
  it('is Market, Categories, Activity, Portfolio only', () => {
    expect(PRIMARY_NAV.map((item) => item.label)).toEqual([
      'Market',
      'Categories',
      'Activity',
      'Portfolio',
    ]);
  });

  it('does not include Gacha or other parked product', () => {
    const haystack = PRIMARY_NAV.map((item) => `${item.href} ${item.label}`.toLowerCase()).join(' ');
    expect(haystack).not.toMatch(/gacha/);
    expect(haystack).not.toMatch(/rewards/);
    expect(PRIMARY_NAV).toHaveLength(4);
  });
});
