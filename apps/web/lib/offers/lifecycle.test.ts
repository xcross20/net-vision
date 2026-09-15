import { describe, expect, it } from 'vitest';
import { privateKeyToAccount } from 'viem/accounts';
import { recoverTypedDataAddress } from 'viem';
import { parseUsdgDecimalToRaw } from '../native-market/fees';
import { encodeSeaportCancel } from './cancel';
import { assertOfferCapacity } from './exposure';
import { MemoryNativeOfferStore, newOfferId } from './store';
import { assertCanMarkCancelled, assertCanMarkFilled } from './status';
import { ALLOWLISTED_PROTOCOLS } from '@net-vision/chain-config';
import {
  buildNativeOfferParameters,
  computeOfferOrderHash,
  seaportTypedData,
} from './seaport-offer';

const BUYER_KEY = '0x2222222222222222222222222222222222222222222222222222222222222222' as const;
const FEE = '0x1111111111111111111111111111111111111111';
const SALT = '0x5555555555555555555555555555555555555555555555555555555555555555' as const;

describe('native offer lifecycle', () => {
  it('blocks unfunded new exposure', () => {
    expect(() =>
      assertOfferCapacity({
        balanceUsdgRaw: parseUsdgDecimalToRaw('1000'),
        existingActiveExposureUsdgRaw: parseUsdgDecimalToRaw('700'),
        newLiabilityUsdgRaw: parseUsdgDecimalToRaw('500'),
      }),
    ).toThrow(/insufficient offer capacity/);
    assertOfferCapacity({
      balanceUsdgRaw: parseUsdgDecimalToRaw('1000'),
      existingActiveExposureUsdgRaw: parseUsdgDecimalToRaw('300'),
      newLiabilityUsdgRaw: parseUsdgDecimalToRaw('500'),
    });
  });

  it('does not mark FILLED on submit — only on successful receipt', async () => {
    const account = privateKeyToAccount(BUYER_KEY);
    const store = new MemoryNativeOfferStore();
    const params = buildNativeOfferParameters({
      buyer: account.address,
      tokenId: '870',
      offerUsdgRaw: parseUsdgDecimalToRaw('10'),
      durationSeconds: 3600,
      feeRecipient: FEE,
      salt: SALT,
    });
    const id = newOfferId();
    const hash = computeOfferOrderHash(params);
    await store.putDraft({
      id,
      offerGroupId: null,
      parameters: params,
      seaportOrderHash: hash,
      signature: null,
      status: 'DRAFT',
      createdAt: Date.now(),
    });
    const signature = await account.signTypedData(seaportTypedData(params));
    const recovered = await recoverTypedDataAddress({ ...seaportTypedData(params), signature });
    expect(recovered.toLowerCase()).toBe(account.address.toLowerCase());
    await store.setSignature(id, signature, hash);
    const active = await store.get(id);
    expect(active?.status).toBe('ACTIVE');
    expect(() =>
      assertCanMarkFilled({ status: 'ACTIVE', receiptStatus: 'unknown' }),
    ).toThrow(/successful receipt/);
    assertCanMarkFilled({ status: 'ACTIVE', receiptStatus: 'success' });
    await store.setStatus(id, 'FILLED');
    expect((await store.get(id))?.status).toBe('FILLED');
  });

  it('encodes a real Seaport cancel and refuses CANCELLED without receipt', () => {
    const params = buildNativeOfferParameters({
      buyer: privateKeyToAccount(BUYER_KEY).address,
      tokenId: '1',
      offerUsdgRaw: parseUsdgDecimalToRaw('10'),
      durationSeconds: 3600,
      feeRecipient: FEE,
      salt: SALT,
    });
    const tx = encodeSeaportCancel([params]);
    expect(tx.to).toBe(ALLOWLISTED_PROTOCOLS.seaport16);
    expect(tx.data.startsWith('0x')).toBe(true);
    expect(tx.data.length).toBeGreaterThan(10);
    expect(() =>
      assertCanMarkCancelled({ status: 'ACTIVE', cancelReceiptStatus: 'unknown' }),
    ).toThrow(/cancel receipt/);
    assertCanMarkCancelled({ status: 'ACTIVE', cancelReceiptStatus: 'success' });
    expect(() =>
      assertCanMarkCancelled({ status: 'FILLED', cancelReceiptStatus: 'success' }),
    ).toThrow(/filled/);
  });
});
