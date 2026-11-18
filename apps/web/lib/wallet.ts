import { publicKeyToP2pkhCashAddress } from "@bitauth/libauth";
import type { BchNetwork } from "@kyvera/core";

type PubkeySource = {
  getPubkey(childIndex: number, index: bigint): Uint8Array | undefined;
};

/**
 * Derives the first P2PKH CashAddr from a connected WizardConnect wallet.
 * Returns null when no wallet is connected or the wallet has not published a key.
 */
export function deriveWalletAddress(
  manager: PubkeySource | null | undefined,
  network: BchNetwork,
): string | null {
  if (!manager) return null;
  try {
    const publicKey = manager.getPubkey(0, 0n);
    if (!publicKey) return null;
    return publicKeyToP2pkhCashAddress({
      publicKey,
      prefix: network === "mainnet" ? "bitcoincash" : "bchtest",
      tokenSupport: false,
    }).address;
  } catch {
    return null;
  }
}
