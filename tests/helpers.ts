import { sha256, utf8ToBin } from "@bitauth/libauth";
import {
  testBchKeyPair,
  type BchKeyPair,
} from "@kyvera/bch";
import {
  buildRecordEvent,
  generateNostrSecretKey,
  recordTags,
  signerFromSecretKey,
  type NostrSigner,
} from "@kyvera/nostr";
import {
  createBindRecord,
  createRotateRecord,
  createRevokeRecord,
  verifyEventRecord,
  type CreatedRecord,
} from "@kyvera/verifier";
import type { KyveraEvent, SignedRecord } from "@kyvera/core";
import { canonicalRecord } from "@kyvera/core";
import { finalizeEvent } from "nostr-tools/pure";

export const T0 = 1_794_000_000;

export function testNostrSecret(label: string): Uint8Array {
  return sha256.hash(utf8ToBin(`kyvera test nostr key: ${label}`));
}

export interface TestIdentity {
  label: string;
  secret: Uint8Array;
  subject: string;
  signer: NostrSigner;
  bchA: BchKeyPair;
  bchB: BchKeyPair;
  bchC: BchKeyPair;
  bind: CreatedRecord;
}

export async function makeIdentity(label: string, issuedAt = T0): Promise<TestIdentity> {
  const secret = testNostrSecret(label);
  const signer = signerFromSecretKey(secret);
  const subject = await signer.getPublicKey();
  const bchA = testBchKeyPair(`${label} bch A`);
  const bchB = testBchKeyPair(`${label} bch B`);
  const bchC = testBchKeyPair(`${label} bch C`);
  const bind = await createBindRecord({
    signer,
    bchPrivateKey: bchA.privateKey,
    bch: bchA.identity,
    issuedAt,
  });
  return { label, secret, subject, signer, bchA, bchB, bchC, bind };
}

export async function rotate(
  identity: TestIdentity,
  from: CreatedRecord,
  fromKey: BchKeyPair,
  toKey: BchKeyPair,
  issuedAt = from.record.payload.issuedAt + 60,
): Promise<CreatedRecord> {
  if (!from.record.payload.bch) throw new Error("cannot rotate a revoke record");
  return createRotateRecord({
    signer: identity.signer,
    previous: {
      recordId: from.recordId,
      sequence: from.record.payload.sequence,
      bch: from.record.payload.bch,
    },
    currentBchPrivateKey: fromKey.privateKey,
    newBchPrivateKey: toKey.privateKey,
    newBch: toKey.identity,
    issuedAt,
  });
}

export async function revoke(
  identity: TestIdentity,
  from: CreatedRecord,
  key: BchKeyPair,
  issuedAt = from.record.payload.issuedAt + 60,
): Promise<CreatedRecord> {
  if (!from.record.payload.bch) throw new Error("cannot revoke a revoke record");
  return createRevokeRecord({
    signer: identity.signer,
    previous: {
      recordId: from.recordId,
      sequence: from.record.payload.sequence,
      bch: from.record.payload.bch,
    },
    currentBchPrivateKey: key.privateKey,
    issuedAt,
  });
}

/** Re-signs arbitrary record content with the Nostr key, as an attacker with the identity key could. */
export async function reSign(record: SignedRecord, secret: Uint8Array): Promise<KyveraEvent> {
  const built = await buildRecordEvent(record, signerFromSecretKey(secret));
  if (!built.ok || !built.event) throw new Error(built.message);
  return built.event;
}

/** Builds a signed event without validating the record shape (for negative tests). */
export function rawEvent(record: SignedRecord, secret: Uint8Array): KyveraEvent {
  return finalizeEvent(
    {
      kind: 30078,
      created_at: record.payload.issuedAt,
      tags: recordTags(record),
      content: canonicalRecord(record),
    },
    secret,
  ) as KyveraEvent;
}

/** Finalizes an event with arbitrary content, for canonical-encoding tests. */
export function eventWithContent(event: KyveraEvent, content: string, secret: Uint8Array): KyveraEvent {
  return finalizeEvent(
    {
      kind: event.kind,
      created_at: event.created_at,
      tags: event.tags,
      content,
    },
    secret,
  ) as KyveraEvent;
}

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function verifyAt(event: KyveraEvent, now = T0 + 3600, network: "mainnet" | "chipnet" = "mainnet") {
  return verifyEventRecord(event, { now, network });
}

export function randomUnusedSecret(): Uint8Array {
  return generateNostrSecretKey();
}

/** Builds a fresh identity with an arbitrary Nostr key, used for forgery tests. */
export async function strangerSigner(): Promise<{ secret: Uint8Array; signer: NostrSigner; subject: string }> {
  const secret = randomUnusedSecret();
  const signer = signerFromSecretKey(secret);
  return { secret, signer, subject: await signer.getPublicKey() };
}
