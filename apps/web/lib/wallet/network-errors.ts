/**
 * Normalized wallet-network errors. UI must never surface raw
 * viem/wagmi Request Arguments dumps as the primary message.
 */
export type NetworkErrorCode =
  | 'WRONG_NETWORK'
  | 'SWITCH_REJECTED'
  | 'CHAIN_NOT_CONFIGURED'
  | 'CHAIN_ADD_REJECTED'
  | 'WALLET_SWITCH_UNSUPPORTED'
  | 'RPC_UNAVAILABLE'
  | 'UNKNOWN_NETWORK_ERROR';

export const NETWORK_ERROR_COPY: Record<NetworkErrorCode, string> = {
  WRONG_NETWORK: 'Switch to Robinhood Chain to continue.',
  SWITCH_REJECTED: 'Network switch cancelled. No transaction was submitted.',
  CHAIN_NOT_CONFIGURED:
    "Robinhood Chain isn't configured in this wallet yet. Net Vision can add the official network settings for you.",
  CHAIN_ADD_REJECTED: 'Adding Robinhood Chain was cancelled. No transaction was submitted.',
  WALLET_SWITCH_UNSUPPORTED:
    'This wallet cannot switch networks programmatically. Add Robinhood Chain using the details below.',
  RPC_UNAVAILABLE: 'Robinhood Chain RPC is unavailable. Try again in a moment.',
  UNKNOWN_NETWORK_ERROR: 'Could not switch networks. No transaction was submitted.',
};

export class NetworkGateError extends Error {
  readonly code: NetworkErrorCode;
  readonly fromChainId: number | null;
  readonly targetChainId: number;

  constructor(
    code: NetworkErrorCode,
    opts?: { fromChainId?: number | null; targetChainId?: number; cause?: unknown },
  ) {
    super(NETWORK_ERROR_COPY[code]);
    this.name = 'NetworkGateError';
    this.code = code;
    this.fromChainId = opts?.fromChainId ?? null;
    this.targetChainId = opts?.targetChainId ?? 4663;
    if (opts?.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = opts.cause;
    }
  }
}

function errorCode(err: unknown): number | undefined {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const code = (err as { code?: unknown }).code;
    if (typeof code === 'number') return code;
    if (typeof code === 'string' && /^-?\d+$/.test(code)) return Number(code);
  }
  return undefined;
}

function errorName(err: unknown): string {
  if (err instanceof Error) return err.name;
  return '';
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err ?? '');
}

export function classifyWalletError(err: unknown): NetworkErrorCode {
  if (err instanceof NetworkGateError) return err.code;
  const name = errorName(err);
  const message = errorMessage(err).toLowerCase();
  const code = errorCode(err);

  if (code === 4001 || name === 'UserRejectedRequestError' || message.includes('user rejected')) {
    if (message.includes('add') || message.includes('ethereum chain')) return 'CHAIN_ADD_REJECTED';
    return 'SWITCH_REJECTED';
  }
  if (
    code === 4902 ||
    name === 'ChainNotConfiguredError' ||
    message.includes('unrecognized chain') ||
    message.includes('not configured') ||
    message.includes('unknown chain')
  ) {
    return 'CHAIN_NOT_CONFIGURED';
  }
  if (
    name === 'SwitchChainNotSupportedError' ||
    message.includes('does not support programmatic') ||
    message.includes('switchchainnotsupported')
  ) {
    return 'WALLET_SWITCH_UNSUPPORTED';
  }
  if (
    name === 'ChainMismatchError' ||
    message.includes('does not match the target chain') ||
    message.includes('current chain of the wallet')
  ) {
    return 'WRONG_NETWORK';
  }
  if (message.includes('rpc') && (message.includes('unavailable') || message.includes('failed to fetch'))) {
    return 'RPC_UNAVAILABLE';
  }
  return 'UNKNOWN_NETWORK_ERROR';
}

export function userMessageForWalletError(err: unknown): string {
  return NETWORK_ERROR_COPY[classifyWalletError(err)];
}

/** Network errors get product copy; all other failures keep their own message. */
export function checkoutFailureMessage(err: unknown): string {
  if (err instanceof NetworkGateError) return err.message;
  const code = classifyWalletError(err);
  if (code === 'UNKNOWN_NETWORK_ERROR') {
    return err instanceof Error ? err.message : String(err);
  }
  return NETWORK_ERROR_COPY[code];
}
