/**
 * Resumable on-chain tokenURI bootstrap for 1..62093.
 * Listing events never call this on the critical path.
 *
 * Runs until every official token is VERIFIED and has a cached SVG.
 * First pass walks token ids forward from the shard checkpoint; later
 * passes repair RETRY / holes / verified-without-image.
 */
import { BUTTON_PRESSER_COLLECTION, ROBINHOOD_CHAIN } from '@net-vision/chain-config';
import {
  decodeAbiString,
  decodeSvgFromDataUri,
  isCanonicalBootstrapComplete,
  officialSupply,
  parseOnChainTokenUri,
  tokenUriCalldata,
  verifyMetadataIdentity,
} from './canonical-metadata';
import {
  hasCanonicalMedia,
  isCanonicalVerified,
  listTokensNeedingBootstrap,
  loadCheckpoint,
  markCanonicalFailure,
  nextOfficialTokenId,
  readCanonicalCoverage,
  saveCheckpoint,
  upsertCanonicalVerified,
} from './canonical-metadata-store';

export type EthCall = (input: { to: `0x${string}`; data: `0x${string}` }) => Promise<string>;

export type BootstrapPassResult = {
  processed: number;
  verified: number;
  retry: number;
  invalid: number;
  identityBlock: number;
  lastTokenId: number;
  done: boolean;
  complete: boolean;
};

function rpcUrl(): string {
  return (
    process.env.ROBINHOOD_RPC_PRIMARY?.trim() ||
    process.env.RPC_URL?.trim() ||
    ROBINHOOD_CHAIN.rpcUrls.default.http[0]
  );
}

export async function defaultEthCall(input: { to: `0x${string}`; data: `0x${string}` }): Promise<string> {
  const res = await fetch(rpcUrl(), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': 'NetVisionMetadataBootstrap/1' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [input, 'latest'] }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`eth_call HTTP ${res.status}`);
  const json = (await res.json()) as { result?: string; error?: { message?: string } };
  if (!json.result) throw new Error(json.error?.message ?? 'eth_call failed');
  return json.result;
}

export function bootstrapShardConfig(): { shard: number; shardCount: number; concurrency: number } {
  const shardCount = Math.max(1, Number(process.env.METADATA_BOOTSTRAP_SHARDS ?? 1) || 1);
  const shard = Math.min(shardCount - 1, Math.max(0, Number(process.env.METADATA_BOOTSTRAP_SHARD ?? 0) || 0));
  const concurrency = Math.min(16, Math.max(1, Number(process.env.METADATA_BOOTSTRAP_CONCURRENCY ?? 8) || 8));
  return { shard, shardCount, concurrency };
}

export function planForwardIds(
  lastTokenId: number,
  shard: number,
  shardCount: number,
  limit: number,
): number[] {
  const ids: number[] = [];
  let last = lastTokenId;
  for (let i = 0; i < limit; i += 1) {
    const next = nextOfficialTokenId(last, shard, shardCount);
    if (next == null) break;
    ids.push(next);
    last = next;
  }
  return ids;
}

/** Bounded parallel map. Results stay in input order. */
export async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(
    Array.from({ length: workers }, async () => {
      for (;;) {
        const i = next;
        next += 1;
        if (i >= items.length) return;
        results[i] = await fn(items[i]);
      }
    }),
  );
  return results;
}

export async function bootstrapOneToken(
  tokenId: number,
  ethCall: EthCall = defaultEthCall,
): Promise<'VERIFIED' | 'IDENTITY_BLOCK' | 'INVALID' | 'RETRY'> {
  if ((await isCanonicalVerified(tokenId)) && (await hasCanonicalMedia(tokenId))) {
    return 'VERIFIED';
  }
  try {
    const data = await ethCall({
      to: BUTTON_PRESSER_COLLECTION.contractAddress,
      data: tokenUriCalldata(tokenId),
    });
    const uri = decodeAbiString(data);
    const parsed = parseOnChainTokenUri(uri);
    const identity = verifyMetadataIdentity(String(tokenId), parsed);
    if (!identity.ok) {
      await markCanonicalFailure({
        tokenId,
        status: 'IDENTITY_BLOCK',
        reason: identity.reason,
        attempt: 1,
      });
      return 'IDENTITY_BLOCK';
    }
    const image = decodeSvgFromDataUri(parsed.imageDataUri);
    const saved = await upsertCanonicalVerified({
      tokenId,
      parsed,
      image,
      metadataUriKind: 'data:application/json;base64',
    });
    const { persistNftMetadata } = await import('./store');
    persistNftMetadata(String(tokenId), {
      name: saved.name,
      imageUrl: saved.imageUrl,
      traits: parsed.attributes.map((a) => ({ trait_type: a.traitType, value: a.value })),
    });
    return 'VERIFIED';
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    const status = reason.includes('unsupported tokenURI') ? 'INVALID' : 'RETRY';
    await markCanonicalFailure({ tokenId, status, reason, attempt: 1 });
    return status;
  }
}

export async function runCanonicalMetadataPass(
  options: { maxTokens?: number; ethCall?: EthCall; concurrency?: number } = {},
): Promise<BootstrapPassResult> {
  const { shard, shardCount, concurrency: envConcurrency } = bootstrapShardConfig();
  const concurrency = options.concurrency ?? envConcurrency;
  const checkpoint = await loadCheckpoint(shard);
  const limit = options.maxTokens ?? 32;
  const forward = planForwardIds(checkpoint.lastTokenId, shard, shardCount, limit);
  const ids =
    forward.length >= limit ? forward : [...forward, ...(await listTokensNeedingBootstrap(limit - forward.length))];
  const unique = [...new Set(ids)];

  let verified = 0;
  let retry = 0;
  let invalid = 0;
  let identityBlock = 0;
  const ethCall = options.ethCall ?? defaultEthCall;

  const results = await mapPool(unique, concurrency, (tokenId) => bootstrapOneToken(tokenId, ethCall));
  for (const result of results) {
    if (result === 'VERIFIED') verified += 1;
    else if (result === 'RETRY') retry += 1;
    else if (result === 'INVALID') invalid += 1;
    else identityBlock += 1;
  }

  const lastTokenId = forward.length > 0 ? forward[forward.length - 1]! : checkpoint.lastTokenId;
  await saveCheckpoint({
    shard,
    shardCount,
    lastTokenId,
    processedDelta: unique.length,
    verifiedDelta: verified,
    retryDelta: retry,
    invalidDelta: invalid,
    identityBlockDelta: identityBlock,
  });

  const coverage = await readCanonicalCoverage();
  const complete = coverage ? isCanonicalBootstrapComplete(coverage) : false;
  const done = complete || (forward.length === 0 && unique.length === 0);
  return {
    processed: unique.length,
    verified,
    retry,
    invalid,
    identityBlock,
    lastTokenId,
    done,
    complete,
  };
}

let bootstrapRunning = false;

export function isCanonicalMetadataBootstrapRunning(): boolean {
  return bootstrapRunning;
}

export function startCanonicalMetadataBootstrap(): void {
  if (process.env.METADATA_BOOTSTRAP_ENABLED === 'false') {
    console.log('[metadata-bootstrap] disabled via METADATA_BOOTSTRAP_ENABLED=false');
    return;
  }
  if (bootstrapRunning) return;
  bootstrapRunning = true;
  const { shard, shardCount, concurrency } = bootstrapShardConfig();
  console.log(
    `[metadata-bootstrap] starting shard=${shard}/${shardCount} concurrency=${concurrency} supply=${officialSupply()}`,
  );
  const loop = async () => {
    while (bootstrapRunning) {
      try {
        const started = Date.now();
        const result = await runCanonicalMetadataPass({ maxTokens: 32 });
        const elapsedMs = Date.now() - started;
        const tpm = elapsedMs > 0 ? (result.processed / elapsedMs) * 60_000 : 0;
        console.log(
          `[metadata-bootstrap] pass processed=${result.processed} verified=${result.verified} retry=${result.retry} last=${result.lastTokenId} tpm=${tpm.toFixed(1)} complete=${result.complete} ${elapsedMs}ms`,
        );
        if (result.complete) {
          await new Promise((r) => setTimeout(r, 60_000));
          continue;
        }
        if (result.processed === 0) {
          await new Promise((r) => setTimeout(r, 5_000));
          continue;
        }
        await new Promise((r) => setTimeout(r, 50));
      } catch (err) {
        console.error('[metadata-bootstrap]', err instanceof Error ? err.message : err);
        await new Promise((r) => setTimeout(r, 5_000));
      }
    }
  };
  void loop();
}

export function stopCanonicalMetadataBootstrap(): void {
  bootstrapRunning = false;
}
