'use client';

import { useState } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connectors, connect, status, error } = useConnect();
  const { disconnect } = useDisconnect();
  const [open, setOpen] = useState(false);

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        <span className="nv-chip nv-chip-strong">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--nv-green)]" />
          {shortenAddress(address)}
        </span>
        <button
          type="button"
          onClick={() => disconnect()}
          className="text-xs text-[var(--nv-muted)] hover:text-[var(--nv-text)]"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="nv-button nv-button-ghost text-xs px-3 py-1.5"
      >
        Connect
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="nv-panel p-6 w-full max-w-md flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Connect a wallet</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-[var(--nv-muted)] hover:text-[var(--nv-text)]"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-[var(--nv-muted)]">
              Net Vision is non-custodial. You sign every transaction with your own wallet;
              we never see your seed phrase or private key.
            </p>
            <div className="flex flex-col gap-2">
              {connectors.map((c) => (
                <button
                  key={c.uid}
                  type="button"
                  onClick={() => {
                    connect({ connector: c });
                    setOpen(false);
                  }}
                  disabled={status === 'pending'}
                  className="nv-button nv-button-ghost justify-start"
                >
                  {c.name}
                </button>
              ))}
            </div>
            {error ? (
              <div className="text-xs text-[var(--nv-danger)]">{error.message}</div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

function shortenAddress(addr: string): string {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
