/**
 * Diagnostic helpers used by build-time tooling and the number identity
 * probe. These bypass the MarketSource layer because they need raw
 * OpenSea fields (`identifier`, `Presser` trait) that the public Token
 * shape does not expose. Never call from a public route.
 */
import {
  BUTTON_PRESSER_COLLECTION,
  ROBINHOOD_CHAIN,
} from '@net-vision/chain-config';
import { createOpenSeaClient } from '@net-vision/opensea-client';

export type NumberIdentitySample = {
  requestedTokenId: string;
  identifier: string | null;
  name: string | null;
  presserTraitValue: string | null;
  collection: string | null;
  contract: string | null;
};

function readDiagnosticEnv() {
  return {
    OPENSEA_API_KEY: process.env.OPENSEA_API_KEY,
    OPENSEA_BASE_URL: process.env.OPENSEA_BASE_URL,
    OPENSEA_CHAIN: process.env.OPENSEA_CHAIN,
  };
}

export function createDiagnosticOpenSeaClient() {
  const env = readDiagnosticEnv();
  if (!env.OPENSEA_API_KEY) {
    throw new Error('OPENSEA_API_KEY is required for diagnostic probes');
  }
  return createOpenSeaClient(env);
}

export async function fetchRawNftForIdentity(
  client: ReturnType<typeof createOpenSeaClient>,
  tokenId: string,
): Promise<NumberIdentitySample> {
  let chain = envFallbackChain();
  if (!chain) {
    chain = (await client.resolveChainSlug()).chain;
  }

  let identifier: string | null = null;
  let name: string | null = null;
  let presserTraitValue: string | null = null;
  let collection: string | null = null;
  let contract: string | null = null;

  try {
    const nft = await client.getNFT({
      chain,
      contractAddress: BUTTON_PRESSER_COLLECTION.contractAddress,
      tokenId,
    });
    identifier = String(nft.identifier);
    name = nft.name ?? null;
    collection = nft.collection ?? null;
    contract = nft.contract ?? null;
    const presserTrait = (nft.traits ?? []).find((t) => {
      const type = String(t.trait_type ?? '').toLowerCase();
      return type === 'presser';
    });
    if (presserTrait?.value != null) {
      presserTraitValue = String(presserTrait.value);
    }
  } catch {
    // Sample is partial; the probe reports which fields are present.
  }

  return {
    requestedTokenId: tokenId,
    identifier,
    name,
    presserTraitValue,
    collection,
    contract,
  };
}

function envFallbackChain(): string | null {
  const explicit = process.env.OPENSEA_CHAIN;
  if (explicit && explicit.trim()) return explicit.trim();
  // The opensea-client documents Robinhood Chain's slug as 'robinhood'.
  // Resolve lazily so we don't burn an API call when the caller passes
  // OPENSEA_CHAIN explicitly.
  if (ROBINHOOD_CHAIN.id === 1311) return 'robinhood';
  return null;
}