import type { NativeOfferParameters } from './seaport-offer';
import { assetKey } from './identity';
import { deriveGroupStatus, type NativeOfferStatus, type OfferGroupStatus } from './status';

export type StoredNativeOffer = {
  id: string;
  offerGroupId: string | null;
  parameters: NativeOfferParameters;
  seaportOrderHash: `0x${string}`;
  signature: `0x${string}` | null;
  status: NativeOfferStatus;
  createdAt: number;
};

export type StoredOfferGroup = {
  id: string;
  buyerAddress: `0x${string}`;
  strategy: string;
  requestedAssetCount: number;
  maximumLiabilityUsdgRaw: string;
  startsAt: number;
  expiresAt: number;
  status: OfferGroupStatus;
  createdAt: number;
};

export interface NativeOfferStore {
  putDraft(row: StoredNativeOffer): Promise<void>;
  get(id: string): Promise<StoredNativeOffer | null>;
  getByHash(hash: string): Promise<StoredNativeOffer | null>;
  listForToken(collectionId: string, tokenId: string): Promise<StoredNativeOffer[]>;
  listForBuyer(buyer: string): Promise<StoredNativeOffer[]>;
  activeExposure(buyer: string): Promise<bigint>;
  setSignature(id: string, signature: `0x${string}`, hash: `0x${string}`): Promise<void>;
  setStatus(id: string, status: NativeOfferStatus): Promise<void>;
  putGroup(row: StoredOfferGroup): Promise<void>;
  getGroup(id: string): Promise<StoredOfferGroup | null>;
  listGroupOffers(groupId: string): Promise<StoredNativeOffer[]>;
  refreshGroupStatus(groupId: string): Promise<OfferGroupStatus>;
}

export class MemoryNativeOfferStore implements NativeOfferStore {
  private offers = new Map<string, StoredNativeOffer>();
  private byHash = new Map<string, string>();
  private groups = new Map<string, StoredOfferGroup>();

  async putDraft(row: StoredNativeOffer): Promise<void> {
    this.offers.set(row.id, row);
    this.byHash.set(row.seaportOrderHash.toLowerCase(), row.id);
  }

  async get(id: string): Promise<StoredNativeOffer | null> {
    return this.offers.get(id) ?? null;
  }

  async getByHash(hash: string): Promise<StoredNativeOffer | null> {
    const id = this.byHash.get(hash.toLowerCase());
    return id ? this.offers.get(id) ?? null : null;
  }

  async listForToken(collectionId: string, tokenId: string): Promise<StoredNativeOffer[]> {
    return [...this.offers.values()].filter(
      (row) =>
        row.parameters.identity.collectionId === collectionId &&
        row.parameters.identity.tokenId === tokenId,
    );
  }

  async listForBuyer(buyer: string): Promise<StoredNativeOffer[]> {
    const needle = buyer.toLowerCase();
    return [...this.offers.values()].filter((row) => row.parameters.offerer === needle);
  }

  async activeExposure(buyer: string): Promise<bigint> {
    const now = Math.floor(Date.now() / 1000);
    const rows = await this.listForBuyer(buyer);
    return rows
      .filter((row) => row.status === 'ACTIVE' && row.parameters.endTime > now)
      .reduce((sum, row) => sum + BigInt(row.parameters.offerUsdgRaw), 0n);
  }

  async setSignature(id: string, signature: `0x${string}`, hash: `0x${string}`): Promise<void> {
    const row = this.offers.get(id);
    if (!row) throw new Error('offer: unknown draft');
    row.signature = signature;
    row.seaportOrderHash = hash;
    row.status = 'ACTIVE';
    this.byHash.set(hash.toLowerCase(), id);
  }

  async setStatus(id: string, status: NativeOfferStatus): Promise<void> {
    const row = this.offers.get(id);
    if (!row) throw new Error('offer: unknown offer');
    row.status = status;
  }

  async putGroup(row: StoredOfferGroup): Promise<void> {
    this.groups.set(row.id, row);
  }

  async getGroup(id: string): Promise<StoredOfferGroup | null> {
    return this.groups.get(id) ?? null;
  }

  async listGroupOffers(groupId: string): Promise<StoredNativeOffer[]> {
    return [...this.offers.values()].filter((row) => row.offerGroupId === groupId);
  }

  async refreshGroupStatus(groupId: string): Promise<OfferGroupStatus> {
    const group = this.groups.get(groupId);
    if (!group) throw new Error('offer: unknown group');
    const members = await this.listGroupOffers(groupId);
    group.status = deriveGroupStatus(members.map((row) => row.status));
    return group.status;
  }
}

export function newOfferId(): string {
  return `off_${crypto.randomUUID()}`;
}

export function newGroupId(): string {
  return `og_${crypto.randomUUID()}`;
}

export function identityOf(row: StoredNativeOffer): string {
  return assetKey(row.parameters.identity);
}

let singleton: MemoryNativeOfferStore | null = null;

export function getMemoryOfferStore(): MemoryNativeOfferStore {
  if (!singleton) singleton = new MemoryNativeOfferStore();
  return singleton;
}

export function resetMemoryOfferStore(): void {
  singleton = new MemoryNativeOfferStore();
}
