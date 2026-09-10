/**
 * Resumable on-chain tokenURI bootstrap for 1..62093.
 * Listing events never call this on the critical path.
 */
import { BUTTON_PRESSER_COLLECTION, ROBINHOOD_CHAIN } from '@net-vision/chain-config';
import {
  decodeAbiString,
  decodeSvgFromDataUri,
  officialSupply,
  parseOnChainTokenUri,
  tokenUriCalldata,
  verifyMetadataIdentity,
} from './canonical-metadata';
import {
  isCanonicalVerified,
  loadCheckpoint,
  markCanonicalFailure,
  nextOfficialTokenId,
  saveCheckpoint,
  upsertCanonicalVerified,
} from './canonical-metadata-store';

export type EthCall = (input: { to: `0x${string}`; data: `0x${string}` }) => Promise<string>;

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
  });
  const json = (await res.json()) as { result?: string; error?: { message?: string } };
  if (!json.result) throw new Error(json.error?.message ?? 'eth_call failed');
  return json.result;
}

export function bootstrapShardConfig(): { shard: number; shardCount: number; concurrency: number } {
  const shardCount = Math.max(1, Number(process.env.METADATA_BOOTSTRAP_SHARDS ?? 1) || 1);
  const shard = Math.min(shardCount - 1, Math.max(0, Number(process.env.METADATA_BOOTSTRAP_SHARD ?? 0) || 0));
  const concurrency = Math.min(16, Math.max(1, Number(process.env.METADATA_BOOTSTRAP_CONCURRENCY ?? 4) || 4));
  return { shard, shardCount, concurrency };
}

export async function bootstrapOneToken(
  tokenId: number,
  ethCall: EthCall = defaultEthCall,
): Promise<'VERIFIED' | 'IDENTITY_BLOCK' | 'INVALID' | 'RETRY'> {
  if (await isCanonicalVerified(tokenId)) return 'VERIFIED';
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
  options: { maxTokens?: number; ethCall?: EthCall } = {},
): Promise<{ processed: number; lastTokenId: number; done: boolean }> {
  const { shard, shardCount } = bootstrapShardConfig();
  const checkpoint = await loadCheckpoint(shard);
  let last = checkpoint.lastTokenId;
  const limit = options.maxTokens ?? 25;
  let processed = 0;
  let verified = 0;
  let retry = 0;
  let invalid = 0;
  let identityBlock = 0;
  for (let i = 0; i < limit; i += 1) {
    const tokenId = nextOfficialTokenId(last, shard, shardCount);
    if (tokenId == null) {
      await saveCheckpoint({
        shard,
        shardCount,
        lastTokenId: last,
        processedDelta: processed,
        verifiedDelta: verified,
        retryDelta: retry,
        invalidDelta: invalid,
        identityBlockDelta: identityBlock,
      });
      return { processed, lastTokenId: last, done: true };
    }
    const result = await bootstrapOneToken(tokenId, options.ethCall ?? defaultEthCall);
    last = tokenId;
    processed += 1;
    if (result === 'VERIFIED') verified += 1;
    else if (result === 'RETRY') retry += 1;
    else if (result === 'INVALID') invalid += 1;
    else identityBlock += 1;
  }
  await saveCheckpoint({
    shard,
    shardCount,
    lastTokenId: last,
    processedDelta: processed,
    verifiedDelta: verified,
    retryDelta: retry,
    invalidDelta: invalid,
    identityBlockDelta: identityBlock,
  });
  return { processed, lastTokenId: last, done: last >= officialSupply() };
}

let bootstrapRunning = false;

export function isCanonicalMetadataBootstrapRunning(): boolean {
  return bootstrapRunning;
}

export function startCanonicalMetadataBootstrap(): void {
  if (process.env.METADATA_BOOTSTRAP_ENABLED === 'false') return;
  if (bootstrapRunning) return;
  bootstrapRunning = true;
  const loop = async () => {
    while (bootstrapRunning) {
      try {
        const result = await runCanonicalMetadataPass({ maxTokens: 25 });
        if (result.done) {
          await new Promise((r) => setTimeout(r, 60_000));
          continue;
        }
        await new Promise((r) => setTimeout(r, 50));
      } catch (err) {
        console.error(
          '[metadata-bootstrap]',
          err instanceof Error ? err.message : err,
        );
        await new Promise((r) => setTimeout(r, 5_000));
      }
    }
  };
  void loop();
}

export function stopCanonicalMetadataBootstrap(): void {
  bootstrapRunning = false;
}
