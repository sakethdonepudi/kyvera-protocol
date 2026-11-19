import type { BchNetwork } from "@kyvera/core";

// Production fallback: two independently operated relays that answered a
// read-only kind-30078 probe on 2026-11-19. Set NEXT_PUBLIC_KYVERA_RELAYS to
// your own audited relay set; sensitive actions require FULL agreement.
const fallbackRelays =
  process.env.NODE_ENV === "production"
    ? "wss://nos.lol,wss://relay.primal.net"
    : "ws://127.0.0.1:7777";

export const DEFAULT_RELAYS = (
  process.env.NEXT_PUBLIC_KYVERA_RELAYS ?? fallbackRelays
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
