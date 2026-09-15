'use client';

import { useAccount, useDisconnect } from 'wagmi';
import { motion } from 'framer-motion';
import { CloseIcon, WalletIcon } from '@/components/icons';
import { useWalletConnectModal } from '@/lib/wallet/WalletConnectProvider';

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { openConnectModal } = useWalletConnectModal();

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
          className="nv-icon-btn"
          aria-label="Disconnect wallet"
          title="Disconnect"
        >
          <CloseIcon size={14} />
        </button>
      </div>
    );
  }

  return (
    <motion.button
      type="button"
      onClick={() => openConnectModal()}
      className="nv-button nv-button-ghost"
      whileTap={{ scale: 0.97 }}
    >
      <WalletIcon size={14} weight="duotone" />
      Connect
    </motion.button>
  );
}

function shortenAddress(addr: string): string {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
