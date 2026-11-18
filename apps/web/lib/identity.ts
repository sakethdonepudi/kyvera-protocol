"use client";

import {
  buildBchProofMessage,
  createBindPayload,
  digestOf,
  sealRecord,
  type BchNetwork,
  type KyveraEvent,
  type KyveraPayload,
  type SignedRecord,
} from "@kyvera/core";
import {
  decodeP2pkhAddress,
  generateBchKeyPair,
  hexToBytes,
  verifyBchIdentityProof,
} from "@kyvera/bch";
import {
  buildRecordEvent,
  generateNostrSecretKey,
  publishToRelays,
  signerFromSecretKey,
  toNpub,
  type NostrSigner,
  type RelayPublishReport,
} from "@kyvera/nostr";
import {
  createBindRecord,
  createRevokeRecord,
  createRotateRecord,
  previousStateFrom,
  resolveIdentity,
  type IdentityResolution,
} from "@kyvera/verifier";
import { appendEvent, addBchKey, getIdentity, saveIdentity, type StoredIdentity } from "./store";
import { binToHex } from "@bitauth/libauth";

export interface CreatedIdentity {
  stored: StoredIdentity;
  event: KyveraEvent;
}

export async function createDemoIdentity(
  network: BchNetwork,
  relays: string[],
): Promise<CreatedIdentity> {
  const secret = generateNostrSecretKey();
  const signer = signerFromSecretKey(secret);
  const subject = await signer.getPublicKey();
  const bch = generateBchKeyPair(network);
  const created = await createBindRecord({
    signer,
    bchPrivateKey: bch.privateKey,
    bch: bch.identity,
    issuedAt: Math.floor(Date.now() / 1000),
  });
  const stored: StoredIdentity = {
    subject,
    npub: toNpub(subject),
    mode: "demo",
    nostrSecret: binToHex(secret),
    bchKeys: [
      {
        address: bch.identity.address,
        network,
        publicKey: bch.publicKey,
        privateKey: binToHex(bch.privateKey),
      },
    ],
    events: [created.event],
    createdAt: Date.now(),
  };
  saveIdentity(stored);
  await publish(relays, created.event);
  return { stored, event: created.event };
}

export async function publish(relays: string[], event: KyveraEvent): Promise<RelayPublishReport[]> {
  return publishToRelays(relays, event);
}

export function signerFor(stored: StoredIdentity): NostrSigner {
  if (!stored.nostrSecret) throw new Error("this identity is controlled by a NIP-07 extension");
  return signerFromSecretKey(hexToBytes(stored.nostrSecret));
}

export async function refreshIdentity(
  subject: string,
  relays: string[],
  network: BchNetwork,
  checkpoint?: { sequence: number; recordId: string },
): Promise<IdentityResolution> {
  const stored = getIdentity(subject);
  return resolveIdentity({
    subject,
    relays,
    network,
    additionalEvents: stored?.events ?? [],
    checkpoint,
    now: Math.floor(Date.now() / 1000),
  });
}

export async function rotateDemoIdentity(
  stored: StoredIdentity,
  head: SignedRecord,
  relays: string[],
  network: BchNetwork,
): Promise<{ event: KyveraEvent; newAddress: string }> {
  if (!head.payload.bch) throw new Error("the current head has no BCH address");
  const current = stored.bchKeys.find((key) => key.address === head.payload.bch!.address);
  if (!current) throw new Error("this browser does not hold the current BCH key");
  const signer = signerFor(stored);
  const next = generateBchKeyPair(network);
  const created = await createRotateRecord({
    signer,
    previous: previousStateFrom(head),
    currentBchPrivateKey: hexToBytes(current.privateKey),
    newBchPrivateKey: next.privateKey,
    newBch: next.identity,
    issuedAt: Math.floor(Date.now() / 1000),
  });
  appendEvent(stored.subject, created.event);
  addBchKey(stored.subject, {
    address: next.identity.address,
    network,
    publicKey: next.publicKey,
    privateKey: binToHex(next.privateKey),
  });
  await publish(relays, created.event);
  return { event: created.event, newAddress: next.identity.address };
}

export async function revokeDemoIdentity(
  stored: StoredIdentity,
  head: SignedRecord,
  relays: string[],
): Promise<KyveraEvent> {
  if (!head.payload.bch) throw new Error("the current head has no BCH address");
  const current = stored.bchKeys.find((key) => key.address === head.payload.bch!.address);
  if (!current) throw new Error("this browser does not hold the current BCH key");
  const signer = signerFor(stored);
  const created = await createRevokeRecord({
    signer,
    previous: previousStateFrom(head),
    currentBchPrivateKey: hexToBytes(current.privateKey),
    issuedAt: Math.floor(Date.now() / 1000),
  });
  appendEvent(stored.subject, created.event);
  await publish(relays, created.event);
  return created.event;
}

export interface BindDraft {
  payload: KyveraPayload;
  digest: string;
  message: string;
}

/** Step 1 of external-wallet binding: fix the payload and display the message to sign. */
export function prepareExternalBind(input: {
  subject: string;
  address: string;
  network: BchNetwork;
}): BindDraft {
  const address = input.address.trim().toLowerCase();
  const decoded = decodeP2pkhAddress(address);
  if (typeof decoded === "string") throw new Error(`invalid CashAddr: ${decoded}`);
  if (decoded.network !== input.network) {
    throw new Error(`address is on ${decoded.network}, but the app expects ${input.network}`);
  }
  const payload = createBindPayload({
    subject: input.subject,
    bch: { address, network: input.network, publicKey: null },
    issuedAt: Math.floor(Date.now() / 1000),
  });
  const digest = digestOf(payload);
  return {
    payload,
    digest,
    message: buildBchProofMessage("new", address, digest),
  };
}

/** Step 2: verify the pasted wallet signature and sign the Nostr side. */
export async function completeExternalBind(input: {
  signer: NostrSigner;
  draft: BindDraft;
  signature: string;
}): Promise<KyveraEvent> {
  if (!input.draft.payload.bch) throw new Error("draft has no BCH identity");
  const subject = input.draft.payload.subject;
  const check = verifyBchIdentityProof({
    expectedAddress: input.draft.payload.bch.address,
    role: "new",
    payloadDigest: input.draft.digest,
    signature: input.signature.trim(),
    nostrPublicKey: subject,
  });
  if (!check.ok) throw new Error(`${check.code}: ${check.message}`);
  const record = sealRecord(input.draft.payload, [
    {
      algorithm: "bch-signmessage-v1",
      role: "new",
      address: input.draft.payload.bch.address,
      signature: input.signature.trim(),
    },
  ]);
  const built = await buildRecordEvent(record, input.signer);
  if (!built.ok || !built.event) throw new Error(`${built.code}: ${built.message}`);
  return built.event;
}

export async function storePublishedEvent(input: {
  subject: string;
  npub: string;
  mode: "demo" | "nip07";
  event: KyveraEvent;
}): Promise<StoredIdentity> {
  const existing = getIdentity(input.subject);
  const stored: StoredIdentity = existing ?? {
    subject: input.subject,
    npub: input.npub,
    mode: input.mode,
    nostrSecret: null,
    bchKeys: [],
    events: [],
    createdAt: Date.now(),
  };
  if (!stored.events.some((event) => event.id === input.event.id)) {
    stored.events = [...stored.events, input.event];
  }
  saveIdentity(stored);
  return stored;
}
