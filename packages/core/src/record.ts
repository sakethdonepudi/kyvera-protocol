import { canonicalize } from "./canonical.js";
import {
  PROTOCOL,
  PROTOCOL_VERSION,
  payloadDigest as computePayloadDigest,
  recordId as computeRecordId,
  type BchIdentity,
  type BchProof,
  type KyveraPayload,
  type RecordType,
  type SignedRecord,
} from "./types.js";

export interface PayloadInput {
  type: RecordType;
  subject: string;
  sequence: number;
  previous: string | null;
  bch: BchIdentity | null;
  issuedAt: number;
  expiresAt?: number | null;
  nonce?: string;
}

export function randomNonce(): string {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function createPayload(input: PayloadInput): KyveraPayload {
  return {
    protocol: PROTOCOL,
    version: PROTOCOL_VERSION,
    type: input.type,
    subject: input.subject,
    sequence: input.sequence,
    previous: input.previous,
    bch: input.bch,
    issuedAt: input.issuedAt,
    expiresAt: input.expiresAt ?? null,
    nonce: input.nonce ?? randomNonce(),
  };
}

export function createBindPayload(input: {
  subject: string;
  bch: BchIdentity;
  issuedAt: number;
  expiresAt?: number | null;
  nonce?: string;
}): KyveraPayload {
  return createPayload({ ...input, type: "bind", sequence: 0, previous: null });
}

export function createRotatePayload(input: {
  subject: string;
  previousRecordId: string;
  sequence: number;
  bch: BchIdentity;
  issuedAt: number;
  expiresAt?: number | null;
  nonce?: string;
}): KyveraPayload {
  return createPayload({
    type: "rotate",
    subject: input.subject,
    sequence: input.sequence,
    previous: input.previousRecordId,
    bch: input.bch,
    issuedAt: input.issuedAt,
    expiresAt: input.expiresAt,
    nonce: input.nonce,
  });
}

export function createRevokePayload(input: {
  subject: string;
  previousRecordId: string;
  sequence: number;
  issuedAt: number;
  nonce?: string;
}): KyveraPayload {
  return createPayload({
    type: "revoke",
    subject: input.subject,
    sequence: input.sequence,
    previous: input.previousRecordId,
    bch: null,
    issuedAt: input.issuedAt,
    nonce: input.nonce,
  });
}

/** Canonical bytes that BCH keys sign for this payload. */
export function digestOf(payload: KyveraPayload): string {
  return computePayloadDigest(payload);
}

/** Assembles the final record; the payload digest is unaffected by proofs. */
export function sealRecord(payload: KyveraPayload, bchProofs: BchProof[]): SignedRecord {
  return { payload, proofs: { bch: bchProofs } };
}

export function recordDigest(record: SignedRecord): string {
  return computeRecordId(record);
}

export function canonicalBytes(record: SignedRecord): string {
  return canonicalize(record);
}
