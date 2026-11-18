"use client";

import type { BchNetwork, KyveraEvent } from "@kyvera/core";

const STORAGE_KEY = "kyvera.identities.v1";

export interface StoredBchKey {
  address: string;
  network: BchNetwork;
  publicKey: string;
  /** Demo-only. Never store a real wallet key here. */
  privateKey: string;
}

export interface StoredIdentity {
  subject: string;
  npub: string;
  mode: "demo" | "nip07";
  /** Demo-only. Never store a real Nostr key here. */
  nostrSecret: string | null;
  bchKeys: StoredBchKey[];
  events: KyveraEvent[];
  createdAt: number;
}

type IdentityMap = Record<string, StoredIdentity>;

function read(): IdentityMap {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as IdentityMap;
  } catch {
    return {};
  }
}

function write(map: IdentityMap): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  window.dispatchEvent(new Event("kyvera:store"));
}

export function listIdentities(): StoredIdentity[] {
  return Object.values(read()).sort((a, b) => b.createdAt - a.createdAt);
}

export function getIdentity(subject: string): StoredIdentity | null {
  return read()[subject] ?? null;
}

export function saveIdentity(identity: StoredIdentity): void {
  const map = read();
  map[identity.subject] = identity;
  write(map);
}

export function removeIdentity(subject: string): void {
  const map = read();
  delete map[subject];
  write(map);
}

export function appendEvent(subject: string, event: KyveraEvent): void {
  const identity = getIdentity(subject);
  if (!identity) return;
  if (identity.events.some((existing) => existing.id === event.id)) return;
  identity.events = [...identity.events, event];
  saveIdentity(identity);
}

export function addBchKey(subject: string, key: StoredBchKey): void {
  const identity = getIdentity(subject);
  if (!identity) return;
  identity.bchKeys = [...identity.bchKeys.filter((entry) => entry.address !== key.address), key];
  saveIdentity(identity);
}
