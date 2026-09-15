import { describe, expect, it } from 'vitest';
import { previewFloorSweep, parseSweepPreviewInput, SWEEP_CART_CAP } from './engine';
import { assertSweepCartMatchesPreview, sweepPreviewToCartDrafts } from './sweep-cart';

const listings = [
  { tokenId: '8', price: 8, currency: 'USDG', listedAt: 1, ownerAddress: null, orderHash: 'h8' },
  { tokenId: '2', price: 2, currency: 'USDG', listedAt: 1, ownerAddress: null, orderHash: 'h2' },
  { tokenId: '5', price: 5, currency: 'USDG', listedAt: 1, ownerAddress: null, orderHash: 'h5' },
];

describe('sweep invariants', () => {
  it('orders cheapest-first', () => {
    const preview = previewFloorSweep(listings, { quantity: 2 });
    expect(preview.items.map((i) => i.tokenId)).toEqual(['2', '5']);
  });

  it('honors quantity 1, 5, and caps 20', () => {
    const many = Array.from({ length: 25 }, (_, i) => ({
      tokenId: String(i + 1),
      price: i + 1,
      currency: 'USDG',
      listedAt: 1,
      ownerAddress: null,
      orderHash: `h${i + 1}`,
    }));
    expect(previewFloorSweep(many, { quantity: 1 }).count).toBe(1);
    expect(previewFloorSweep(many, { quantity: 5 }).count).toBe(5);
    expect(previewFloorSweep(many, { quantity: 20 }).count).toBe(20);
    expect(() => parseSweepPreviewInput({ quantity: 21 })).toThrow(/exceeds cap/);
    expect(SWEEP_CART_CAP).toBe(20);
  });

  it('enforces max price per item', () => {
    const preview = previewFloorSweep(
      [
        { tokenId: '1', price: 1, currency: 'USDG', listedAt: 1, ownerAddress: null, orderHash: 'a' },
        { tokenId: '2', price: 2, currency: 'USDG', listedAt: 1, ownerAddress: null, orderHash: 'b' },
        { tokenId: '3', price: 3, currency: 'USDG', listedAt: 1, ownerAddress: null, orderHash: 'c' },
      ],
      { quantity: 5, maxPricePerItem: 2 },
    );
    expect(preview.items.map((i) => i.tokenId)).toEqual(['1', '2']);
  });

  it('enforces max spend without exceeding it', () => {
    const preview = previewFloorSweep(
      [
        { tokenId: '2', price: 2, currency: 'USDG', listedAt: 1, ownerAddress: null, orderHash: 'a' },
        { tokenId: '3', price: 3, currency: 'USDG', listedAt: 1, ownerAddress: null, orderHash: 'b' },
        { tokenId: '4', price: 4, currency: 'USDG', listedAt: 1, ownerAddress: null, orderHash: 'c' },
      ],
      { maxSpend: 5 },
    );
    expect(preview.items.map((i) => i.tokenId)).toEqual(['2', '3']);
    expect(preview.total).toBe(5);
  });

  it('builds cart drafts from the preview, not a page of tokens', () => {
    const preview = previewFloorSweep(listings, { quantity: 2 });
    preview.items.forEach((item) => {
      item.imageUrl = `/art/${item.tokenId}`;
      item.contractAddress = '0xE5143de9D3CcBc31Ffb4e7Fc66d8320e0E2693D2';
    });
    const drafts = sweepPreviewToCartDrafts(preview);
    expect(drafts.map((d) => d.token.tokenId)).toEqual(['2', '5']);
    expect(drafts[0].token.imageUrl).toBe('/art/2');
    assertSweepCartMatchesPreview(preview, drafts.map((d) => d.token.tokenId));
  });

  it('fails closed on silent drop', () => {
    const preview = previewFloorSweep(listings, { quantity: 2 });
    expect(() => assertSweepCartMatchesPreview(preview, ['2'])).toThrow(/silent drop/);
  });

  it('dedupes duplicate market rows', () => {
    const preview = previewFloorSweep(
      [
        { tokenId: '2', price: 2, currency: 'USDG', listedAt: 1, ownerAddress: null, orderHash: 'a' },
        { tokenId: '2', price: 2, currency: 'USDG', listedAt: 1, ownerAddress: null, orderHash: 'a-dup' },
        { tokenId: '5', price: 5, currency: 'USDG', listedAt: 1, ownerAddress: null, orderHash: 'b' },
      ],
      { quantity: 5 },
    );
    expect(preview.items.map((i) => i.tokenId)).toEqual(['2', '5']);
  });

  it('rejects mixed currencies', () => {
    expect(() =>
      previewFloorSweep(
        [
          { tokenId: '1', price: 1, currency: 'USDG', listedAt: 1, ownerAddress: null, orderHash: 'a' },
          { tokenId: '2', price: 1, currency: 'ETH', listedAt: 1, ownerAddress: null, orderHash: 'b' },
        ],
        { quantity: 2 },
      ),
    ).toThrow(/mixed-currency/);
  });
});
