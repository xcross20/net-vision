/**
 * In-memory MarketRepository for A2 adversarial tests.
 * Mirrors uniqueness and transaction rollback; not a SQL parser.
 */
import type { TokenFacet } from '@net-vision/taxonomy';
import type { CanonicalMarketEvent } from './canonical-event';
import { MARKET_EVENT_SOURCE } from './canonical-event';
import type {
  MarketRepository,
  SaleAttributionInsert,
  SaleInsert,
  SqlTokenMarketState,
  TokenUpsert,
  WorkerStateUpsert,
} from './market-repository';

type DbState = {
  events: Map<string, CanonicalMarketEvent>;
  tokens: Map<string, TokenUpsert>;
  market: Map<string, SqlTokenMarketState>;
  facets: Map<string, TokenFacet[]>;
  categories: Map<string, string[]>;
  sales: Map<string, SaleInsert>;
  attributions: SaleAttributionInsert[];
  worker: Map<string, WorkerStateUpsert>;
};

function tokenKey(collectionId: string, tokenId: number): string {
  return `${collectionId}:${tokenId}`;
}

function eventKey(source: string, sourceEventId: string): string {
  return `${source}:${sourceEventId}`;
}

function cloneState(state: DbState): DbState {
  return structuredClone(state);
}

export class MemoryMarketRepository implements MarketRepository {
  private state: DbState = {
    events: new Map(),
    tokens: new Map(),
    market: new Map(),
    facets: new Map(),
    categories: new Map(),
    sales: new Map(),
    attributions: [],
    worker: new Map(),
  };
  private inTransaction = false;
  private queue: Promise<unknown> = Promise.resolve();

  async insertMarketEvent(event: CanonicalMarketEvent): Promise<'inserted' | 'duplicate'> {
    const key = eventKey(MARKET_EVENT_SOURCE, event.sourceEventId);
    if (this.state.events.has(key)) return 'duplicate';
    this.state.events.set(key, { ...event, source: MARKET_EVENT_SOURCE });
    return 'inserted';
  }

  async getTokenMarketState(collectionId: string, tokenId: number): Promise<SqlTokenMarketState | null> {
    const row = this.state.market.get(tokenKey(collectionId, tokenId));
    return row ? { ...row } : null;
  }

  async upsertToken(token: TokenUpsert): Promise<void> {
    const key = tokenKey(token.collectionId, token.tokenId);
    const prev = this.state.tokens.get(key);
    this.state.tokens.set(key, {
      ...token,
      ownerAddress: token.ownerAddress ?? prev?.ownerAddress ?? null,
      name: token.name ?? prev?.name ?? null,
      imageUrl: token.imageUrl ?? prev?.imageUrl ?? null,
      metadataJson: token.metadataJson ?? prev?.metadataJson ?? null,
      metadataVerifiedAt: token.metadataVerifiedAt ?? prev?.metadataVerifiedAt ?? null,
    });
  }

  async replaceTokenFacetsForToken(
    collectionId: string,
    tokenId: number,
    facets: TokenFacet[],
    _taxonomyVersion: string,
  ): Promise<void> {
    const key = tokenKey(collectionId, tokenId);
    this.state.facets.set(key, [...facets]);
    this.state.categories.set(key, [...new Set(facets.map((f) => f.slug))]);
  }

  async upsertTokenMarketState(state: SqlTokenMarketState): Promise<void> {
    this.state.market.set(tokenKey(state.collectionId, state.tokenId), { ...state });
  }

  async insertSale(sale: SaleInsert): Promise<void> {
    if (this.state.sales.has(sale.saleEventId)) return;
    this.state.sales.set(sale.saleEventId, { ...sale });
  }

  async insertSaleAttributions(rows: SaleAttributionInsert[]): Promise<void> {
    for (const row of rows) {
      const exists = this.state.attributions.some(
        (a) => a.saleEventId === row.saleEventId && a.categorySlug === row.categorySlug,
      );
      if (!exists) this.state.attributions.push({ ...row });
    }
  }

  async updateWorkerState(row: WorkerStateUpsert): Promise<void> {
    this.state.worker.set(row.workerId, { ...row });
  }

  async withTransaction<T>(fn: (repo: MarketRepository) => Promise<T>): Promise<T> {
    const run = async (): Promise<T> => {
      if (this.inTransaction) return fn(this);
      const snapshot = cloneState(this.state);
      this.inTransaction = true;
      try {
        const result = await fn(this);
        this.inTransaction = false;
        return result;
      } catch (err) {
        this.state = snapshot;
        this.inTransaction = false;
        throw err;
      }
    };
    const next = this.queue.then(run, run);
    this.queue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  eventCount(): number {
    return this.state.events.size;
  }

  saleCount(): number {
    return this.state.sales.size;
  }

  token(collectionId: string, tokenId: number): TokenUpsert | undefined {
    return this.state.tokens.get(tokenKey(collectionId, tokenId));
  }

  facets(collectionId: string, tokenId: number): TokenFacet[] {
    return this.state.facets.get(tokenKey(collectionId, tokenId)) ?? [];
  }
}
