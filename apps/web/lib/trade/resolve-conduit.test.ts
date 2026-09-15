import { describe, expect, it } from 'vitest';
import { isZeroConduitKey, normalizeConduitKey, resolveApprovalSpender } from './resolve-conduit';
import { ALLOWLISTED_PROTOCOLS, ZERO_CONDUIT_KEY } from '@net-vision/chain-config';

describe('conduit key', () => {
  it('rejects malformed keys', () => {
    expect(normalizeConduitKey(null)).toBeNull();
    expect(normalizeConduitKey('0x1234')).toBeNull();
    expect(normalizeConduitKey('61159fefdfada89302ed55f8b9e89e2d67d8258712b3a3f89aa88525877f1d5e')).toBeNull();
  });

  it('accepts the live Robinhood listing key and distinguishes zero', () => {
    const live = normalizeConduitKey(
      '0x61159fefdfada89302ed55f8b9e89e2d67d8258712b3a3f89aa88525877f1d5e',
    );
    expect(live).toBe('0x61159fefdfada89302ed55f8b9e89e2d67d8258712b3a3f89aa88525877f1d5e');
    expect(isZeroConduitKey(live!)).toBe(false);
    expect(isZeroConduitKey(ZERO_CONDUIT_KEY)).toBe(true);
  });

  it('resolves the live Robinhood OpenSea conduit from ConduitController', async () => {
    const resolved = await resolveApprovalSpender(
      '0x61159fefdfada89302ed55f8b9e89e2d67d8258712b3a3f89aa88525877f1d5e',
    );
    expect(resolved.source).toBe('conduit');
    expect(resolved.exists).toBe(true);
    expect(resolved.codeBytes).toBeGreaterThan(0);
    expect(resolved.seaportChannelOpen).toBe(true);
    expect(resolved.spender.toLowerCase()).toBe(
      '0x963F00d3ff000064fFCbA824b800c0000000C300'.toLowerCase(),
    );
    expect(resolved.spender.toLowerCase()).not.toBe(
      ALLOWLISTED_PROTOCOLS.seaport16.toLowerCase(),
    );
  });

  it('uses Seaport itself when conduitKey is zero', async () => {
    const resolved = await resolveApprovalSpender(ZERO_CONDUIT_KEY);
    expect(resolved.source).toBe('seaport-direct');
    expect(resolved.spender.toLowerCase()).toBe(ALLOWLISTED_PROTOCOLS.seaport16.toLowerCase());
  });
});
