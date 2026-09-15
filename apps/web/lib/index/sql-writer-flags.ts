/**
 * A2 writer flags. Isolated so `pg.ts` can gate destructive rebuilds
 * without importing the writer (circular).
 */

export function sqlWriterEnabled(): boolean {
  if (process.env.MARKET_SQL_WRITER === '0') return false;
  const url = process.env.DATABASE_URL?.trim();
  return Boolean(url);
}

export function destructiveNormalizedRebuildEnabled(): boolean {
  return process.env.MARKET_SQL_REBUILD_DESTRUCTIVE === '1';
}
