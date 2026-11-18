"use client";

import type { KyveraEvent } from "@kyvera/core";
import { signerFromNip07, type NostrSigner } from "@kyvera/nostr";

export interface Nip07Provider {
  getPublicKey(): Promise<string>;
  signEvent(event: {
    kind: number;
    created_at: number;
    tags: string[][];
    content: string;
  }): Promise<KyveraEvent>;
}

declare global {
  interface Window {
    nostr?: Nip07Provider;
  }
}

export function getNip07Provider(): Nip07Provider | null {
  if (typeof window === "undefined") return null;
  return window.nostr ?? null;
}

export function nip07Signer(provider: Nip07Provider): NostrSigner {
  return signerFromNip07(provider);
}
