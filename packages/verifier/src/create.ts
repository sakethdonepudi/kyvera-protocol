import {
  buildBchProofMessage,
  createBindPayload,
  createRevokePayload,
  createRotatePayload,
  digestOf,
  recordDigest,
  sealRecord,
  type BchIdentity,
  type BchProof,
  type BchProofRole,
  type KyveraEvent,
  type SignedRecord,
} from "@kyvera/core";
import { signBitcoinMessage } from "@kyvera/bch";
import { buildPublicRecordEvent, buildRecordEvent, type NostrSigner } from "@kyvera/nostr";

export function signBchProof(
  privateKey: Uint8Array,
  role: BchProofRole,
  address: string,
  payloadDigest: string,
): BchProof {
  return {
    algorithm: "bch-signmessage-v1",
    role,
    address,
    signature: signBitcoinMessage(privateKey, buildBchProofMessage(role, address, payloadDigest)),
  };
}

export interface CreatedRecord {
  record: SignedRecord;
  /** Legacy kind-30078 envelope (retained for compatibility). */
  event: KyveraEvent;
  /** Public regular-event mirror. Publish this for public discovery. */
  publicEvent: KyveraEvent;
  recordId: string;
  payloadDigest: string;
}

async function finish(record: SignedRecord, signer: NostrSigner): Promise<CreatedRecord> {
  const built = await buildRecordEvent(record, signer);
  if (!built.ok || !built.event) throw new Error(`${built.code}: ${built.message}`);
  const publicBuilt = await buildPublicRecordEvent(record, signer);
  if (!publicBuilt.ok || !publicBuilt.event) throw new Error(`${publicBuilt.code}: ${publicBuilt.message}`);
  return {
    record,
    event: built.event,
    publicEvent: publicBuilt.event,
    recordId: recordDigest(record),
    payloadDigest: digestOf(record.payload),
  };
}

export async function createBindRecord(input: {
  signer: NostrSigner;
  bchPrivateKey: Uint8Array;
  bch: BchIdentity;
  issuedAt?: number;
  expiresAt?: number | null;
  nonce?: string;
}): Promise<CreatedRecord> {
  const subject = await input.signer.getPublicKey();
  const payload = createBindPayload({
    subject,
    bch: input.bch,
    issuedAt: input.issuedAt ?? Math.floor(Date.now() / 1000),
    expiresAt: input.expiresAt,
    nonce: input.nonce,
  });
  const digest = digestOf(payload);
  const proof = signBchProof(input.bchPrivateKey, "new", input.bch.address, digest);
  return finish(sealRecord(payload, [proof]), input.signer);
}

export interface PreviousState {
  recordId: string;
  sequence: number;
  bch: BchIdentity;
}

export function previousStateFrom(record: SignedRecord): PreviousState {
  if (!record.payload.bch) throw new Error("previous record has no BCH identity");
  return {
    recordId: recordDigest(record),
    sequence: record.payload.sequence,
    bch: record.payload.bch,
  };
}

export async function createRotateRecord(input: {
  signer: NostrSigner;
  previous: PreviousState;
  currentBchPrivateKey: Uint8Array;
  newBchPrivateKey: Uint8Array;
  newBch: BchIdentity;
  issuedAt?: number;
  expiresAt?: number | null;
  nonce?: string;
}): Promise<CreatedRecord> {
  const subject = await input.signer.getPublicKey();
  const payload = createRotatePayload({
    subject,
    previousRecordId: input.previous.recordId,
    sequence: input.previous.sequence + 1,
    bch: input.newBch,
    issuedAt: input.issuedAt ?? Math.floor(Date.now() / 1000),
    expiresAt: input.expiresAt,
    nonce: input.nonce,
  });
  const digest = digestOf(payload);
  const proofs = [
    signBchProof(input.currentBchPrivateKey, "current", input.previous.bch.address, digest),
    signBchProof(input.newBchPrivateKey, "new", input.newBch.address, digest),
  ];
  return finish(sealRecord(payload, proofs), input.signer);
}

export async function createRevokeRecord(input: {
  signer: NostrSigner;
  previous: PreviousState;
  currentBchPrivateKey: Uint8Array;
  issuedAt?: number;
  nonce?: string;
}): Promise<CreatedRecord> {
  const subject = await input.signer.getPublicKey();
  const payload = createRevokePayload({
    subject,
    previousRecordId: input.previous.recordId,
    sequence: input.previous.sequence + 1,
    issuedAt: input.issuedAt ?? Math.floor(Date.now() / 1000),
    nonce: input.nonce,
  });
  const digest = digestOf(payload);
  const proof = signBchProof(input.currentBchPrivateKey, "current", input.previous.bch.address, digest);
  return finish(sealRecord(payload, [proof]), input.signer);
}
