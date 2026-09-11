import { describe, expect, it } from 'vitest';
import { privateKeyToAccount } from 'viem/accounts';
import { parseUsdgDecimalToRaw } from '../native-market/fees';
import { prepareBulkSamePrice } from './bulk';
import { MemoryNativeOfferStore } from './store';
import { submitNativeOffer } from './service';
import { seaportTypedData } from './seaport-offer';

const BUYER_KEY = '0x3333333333333333333333333333333333333333333333333333333333333333' as const;
const FEE = '0x1111111111111111111111111111111111111111';

describe('bulk as orchestration of single offers', () => {
  it('prepares five independent drafts in one group', async () => {
    const account = privateKeyToAccount(BUYER_KEY);
    const store = new MemoryNativeOfferStore();
    const result = await prepareBulkSamePrice({
      buyer: account.address,
      assets: [
        { tokenId: '966' },
        { tokenId: '777' },
        { tokenId: '1221' },
        { tokenId: '333' },
        { tokenId: '870' },
      ],
      offerUsdgRaw: parseUsdgDecimalToRaw('100'),
      durationSeconds: 86400,
      balanceUsdgRaw: parseUsdgDecimalToRaw('1450'),
      store,
      feeRecipient: FEE,
    });
    expect(result.prepared).toHaveLength(5);
    expect(result.maximumLiabilityUsdgRaw).toBe(parseUsdgDecimalToRaw('500'));
    const group = await store.getGroup(result.groupId);
    expect(group?.requestedAssetCount).toBe(5);
    expect(group?.status).toBe('DRAFT');
    const first = result.prepared[0];
    const signature = await account.signTypedData(seaportTypedData(first.parameters));
    const submitted = await submitNativeOffer({
      offerId: first.id,
      buyer: account.address,
      signature,
      store,
      feeRecipient: FEE,
    });
    expect(submitted.status).toBe('ACTIVE');
    const siblings = await store.listGroupOffers(result.groupId);
    expect(siblings.filter((row) => row.status === 'DRAFT')).toHaveLength(4);
    expect(siblings.filter((row) => row.status === 'ACTIVE')).toHaveLength(1);
  });
});
