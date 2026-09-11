import { describe, expect, it } from 'vitest';
import { parseUsdgDecimalToRaw } from './fees';
import { planBulkOffers } from './offers';

const BALANCE = parseUsdgDecimalToRaw('10000');

describe('bulk offer planner', () => {
  it('creates exactly 5 independent same-price offers', () => {
    const plan = planBulkOffers({
      strategy: 'SAME_PRICE',
      samePriceUsdg: '100',
      buyerBalanceUsdgRaw: BALANCE,
      selections: [
        { tokenId: '966', askUsdgRaw: parseUsdgDecimalToRaw('140') },
        { tokenId: '777', askUsdgRaw: parseUsdgDecimalToRaw('125') },
        { tokenId: '1221', askUsdgRaw: parseUsdgDecimalToRaw('160') },
        { tokenId: '333', askUsdgRaw: parseUsdgDecimalToRaw('110') },
        { tokenId: '870', askUsdgRaw: parseUsdgDecimalToRaw('180') },
      ],
    });
    expect(plan.offers).toHaveLength(5);
    expect(plan.offers.map((o) => o.tokenId)).toEqual(['966', '777', '1221', '333', '870']);
    expect(plan.offers.every((o) => o.offerUsdgRaw === parseUsdgDecimalToRaw('100'))).toBe(true);
    expect(plan.maximumLiabilityUsdgRaw).toBe(parseUsdgDecimalToRaw('500'));
  });

  it('computes percent below ask exactly', () => {
    const plan = planBulkOffers({
      strategy: 'PERCENT_BELOW_ASK',
      percentBelowAskBps: 1000n,
      buyerBalanceUsdgRaw: BALANCE,
      selections: [
        { tokenId: '966', askUsdgRaw: parseUsdgDecimalToRaw('120') },
        { tokenId: '777', askUsdgRaw: parseUsdgDecimalToRaw('200') },
      ],
    });
    expect(plan.offers[0].offerUsdgRaw).toBe(parseUsdgDecimalToRaw('108'));
    expect(plan.offers[1].offerUsdgRaw).toBe(parseUsdgDecimalToRaw('180'));
  });

  it('computes percent below floor exactly', () => {
    const plan = planBulkOffers({
      strategy: 'PERCENT_BELOW_FLOOR',
      percentBelowFloorBps: 500n,
      floorUsdgRaw: parseUsdgDecimalToRaw('100'),
      buyerBalanceUsdgRaw: BALANCE,
      selections: [
        { tokenId: '1', askUsdgRaw: parseUsdgDecimalToRaw('140') },
        { tokenId: '2', askUsdgRaw: parseUsdgDecimalToRaw('90') },
      ],
    });
    expect(plan.offers.every((o) => o.offerUsdgRaw === parseUsdgDecimalToRaw('95'))).toBe(true);
  });

  it('dedupes duplicate token ids deterministically', () => {
    const plan = planBulkOffers({
      strategy: 'SAME_PRICE',
      samePriceUsdg: '10',
      buyerBalanceUsdgRaw: BALANCE,
      selections: [
        { tokenId: '5', askUsdgRaw: null },
        { tokenId: '5', askUsdgRaw: null },
        { tokenId: '6', askUsdgRaw: null },
      ],
    });
    expect(plan.offers.map((o) => o.tokenId)).toEqual(['5', '6']);
  });

  it('blocks underfunded aggregate exposure', () => {
    expect(() =>
      planBulkOffers({
        strategy: 'SAME_PRICE',
        samePriceUsdg: '100',
        buyerBalanceUsdgRaw: parseUsdgDecimalToRaw('499'),
        selections: [
          { tokenId: '1', askUsdgRaw: null },
          { tokenId: '2', askUsdgRaw: null },
          { tokenId: '3', askUsdgRaw: null },
          { tokenId: '4', askUsdgRaw: null },
          { tokenId: '5', askUsdgRaw: null },
        ],
      }),
    ).toThrow(/underfunded/);
  });

  it('rejects more than 20 selections', () => {
    expect(() =>
      planBulkOffers({
        strategy: 'SAME_PRICE',
        samePriceUsdg: '1',
        buyerBalanceUsdgRaw: BALANCE,
        selections: Array.from({ length: 21 }, (_, i) => ({
          tokenId: String(i + 1),
          askUsdgRaw: null,
        })),
      }),
    ).toThrow(/20-offer cap/);
  });
});
