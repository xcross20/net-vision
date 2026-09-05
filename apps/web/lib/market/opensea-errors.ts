import { OpenSeaResponseError } from '@net-vision/opensea-client';

export function isOpenSeaRateLimited(err: unknown): boolean {
  return err instanceof OpenSeaResponseError && err.status === 429;
}

export function isMissingOpenSeaResource(err: unknown): boolean {
  return err instanceof OpenSeaResponseError && err.status === 404;
}
