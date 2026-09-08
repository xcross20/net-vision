/**
 * A4 read-model flag. Isolated so the request path can branch without
 * importing SQL repositories (circular with pg / OpenSea source).
 *
 * Default is blob. Staging and production stay blob until A5/A6.
 */

export type MarketReadModel = 'blob' | 'sql';

export function marketReadModel(): MarketReadModel {
  return process.env.MARKET_READ_MODEL === 'sql' ? 'sql' : 'blob';
}
