import type { BchNetwork } from "@kyvera/core";

export const DEFAULT_RELAYS = (
  process.env.NEXT_PUBLIC_KYVERA_RELAYS ?? "ws://127.0.0.1:7777"
)
  .split(",")
  .map((relay) => relay.trim())
  .filter(Boolean);

export const NETWORK: BchNetwork =
  process.env.NEXT_PUBLIC_KYVERA_NETWORK === "chipnet" ? "chipnet" : "mainnet";

export const AUTH_DOMAIN = process.env.NEXT_PUBLIC_KYVERA_DOMAIN ?? "kyvera.local";

export const EXPLORER = NETWORK === "mainnet" ? "https://explorer.bitcoin.com/bch" : "https://chipnet.imaginary.cash";

export function relayLabel(url: string): string {
  return url.replace(/^wss?:\/\//, "");
}
