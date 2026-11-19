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
  buildPublicRecordEvent,
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
  type CreatedRecord,
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
    events: [created.event, created.publicEvent],
    createdAt: Date.now(),
  };
  saveIdentity(stored);
  await publishRecord(relays, created);
  return { stored, event: created.event };
}

export async function publish(relays: string[], event: KyveraEvent): Promise<RelayPublishReport[]> {
  return publishToRelays(relays, event);
}

/**
 * Publishes the public discovery event and the legacy kind-30078 mirror.
 * Reports are merged per relay so the UI can show whether either envelope was
 * accepted. The public event is authoritative for new verifiers.
 */
export async function publishRecord(
  relays: string[],
  created: Pick<CreatedRecord, "event" | "publicEvent">,
): Promise<RelayPublishReport[]> {
  const [legacy, publicReports] = await Promise.all([
    publishToRelays(relays, created.event),
    publishToRelays(relays, created.publicEvent),
  ]);
  return legacy.map((report, index) => {
    const pub = publicReports[index];
    return {
      ...report,
      ok: report.ok || Boolean(pub?.ok),
      message: [
        report.ok ? "legacy accepted" : `legacy: ${report.message}`,
        pub?.ok ? "public accepted" : `public: ${pub?.message ?? "not attempted"}`,
      ].join(" · "),
    };
  });
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
  appendEvent(stored.subject, created.publicEvent);
  addBchKey(stored.subject, {
    address: next.identity.address,
    network,
    publicKey: next.publicKey,
    privateKey: binToHex(next.privateKey),
  });
  await publishRecord(relays, created);
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
  appendEvent(stored.subject, created.publicEvent);
  await publishRecord(relays, created);
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
}): Promise<{ event: KyveraEvent; publicEvent: KyveraEvent }> {
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
  const publicBuilt = await buildPublicRecordEvent(record, input.signer);
  if (!publicBuilt.ok || !publicBuilt.event) throw new Error(`${publicBuilt.code}: ${publicBuilt.message}`);
  return { event: built.event, publicEvent: publicBuilt.event };
}

export async function storePublishedEvent(input: {
  subject: string;
  npub: string;
  mode: "demo" | "nip07";
  event: KyveraEvent;
  publicEvent?: KyveraEvent;
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
  for (const event of [input.event, input.publicEvent]) {
    if (event && !stored.events.some((existing) => existing.id === event.id)) {
      stored.events = [...stored.events, event];
    }
  }
  saveIdentity(stored);
  return stored;
}
