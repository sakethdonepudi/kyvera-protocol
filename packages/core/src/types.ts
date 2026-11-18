import { sha256 } from "@bitauth/libauth";
import { binToHex, utf8ToBin } from "@bitauth/libauth";
import { canonicalize } from "./canonical.js";

export const PROTOCOL = "kyvera" as const;
export const PROTOCOL_VERSION = 1 as const;

/** NIP-78 application-specific data event kind. */
export const NOSTR_KIND = 30078 as const;
/** Value of the `k` tag. Indexable via `{"#k":["kyvera-v1"]}`. */
export const NOSTR_K_TAG = "kyvera-v1" as const;
/** Addressable-event `d` tag prefix. One event per subject/sequence/digest. */
export const NOSTR_D_PREFIX = "kyvera:v1" as const;

export type BchNetwork = "mainnet" | "chipnet";

export interface BchIdentity {
  /** CashAddr with prefix, e.g. bitcoincash:q... (mainnet) or bchtest:q... (chipnet). */
  address: string;
  network: BchNetwork;
  /**
   * 33-byte compressed secp256k1 public key, lowercase hex, or null when the
   * signer is an external wallet. The verifier always recovers the key from the
   * BCH proof, so this field is informative rather than trusted.
   */
  publicKey: string | null;
}

export type RecordType = "bind" | "rotate" | "revoke";
export type BchProofRole = "current" | "new";

/**
 * The signed part of a record. `subject` is the Nostr x-only public key; the
 * Nostr signature over the enclosing event is the proof of control of it.
 */
export interface KyveraPayload {
  protocol: typeof PROTOCOL;
  version: typeof PROTOCOL_VERSION;
  type: RecordType;
  subject: string;
  sequence: number;
  /** sha256 of the previous record's canonical bytes, or null for genesis. */
  previous: string | null;
  /** New/current BCH identity. Null for revocations. */
  bch: BchIdentity | null;
  /** Unix seconds. Must equal the Nostr event's created_at. */
  issuedAt: number;
  expiresAt: number | null;
  /** 32-byte random hex; prevents identical records and aids deduplication. */
  nonce: string;
}

export interface BchProof {
  algorithm: "bch-signmessage-v1";
  role: BchProofRole;
  address: string;
  /** Base64 compact recoverable ECDSA signature (65 bytes decoded). */
  signature: string;
}

export interface SignedRecord {
  payload: KyveraPayload;
  proofs: {
    bch: BchProof[];
  };
}

/** Minimal structural shape of a Nostr event as used by KYVERA. */
export interface KyveraEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

/** A record whose cryptographic proofs and canonical encoding have been verified. */
export interface VerifiedRecord {
  record: SignedRecord;
  /** sha256 hex over canonical bytes of the full signed record (including proofs). */
  recordId: string;
  /** sha256 hex over canonical bytes of the payload only (what BCH keys sign). */
  payloadDigest: string;
  eventId: string | null;
  /** The verified Nostr event, retained so inspecting tools can show its signature. */
  event?: KyveraEvent;
  /** Unix seconds at which the record was observed (local verification time). */
  observedAt: number;
}

export type IdentityStatus =
  | "ACTIVE"
  | "SUPERSEDED"
  | "REVOKED"
  | "EXPIRED"
  | "CONFLICT"
  | "STALE"
  | "UNKNOWN"
  | "INVALID";

export interface ChainStep {
  record: SignedRecord;
  recordId: string;
  payloadDigest: string;
  eventId: string | null;
  /** Verified Nostr event, available for proof inspection UIs. */
  event?: KyveraEvent;
}

export interface SupersededBinding {
  address: string;
  sequence: number;
  recordId: string;
  replacedBy: string;
}

export interface RecordRejection {
  eventId: string | null;
  code: string;
  message: string;
  /** Sequence/type when the record parsed but failed verification. */
  sequence?: number;
  type?: string;
  record?: SignedRecord;
}

export interface ChainResolution {
  status: IdentityStatus;
  /** Stable machine-readable reason code, e.g. `ACTIVE_HEAD`, `CHAIN_FORK`. */
  reasonCode: string;
  reason: string;
  subject: string;
  /** Head of the longest valid authorization chain, if one exists. */
  head: ChainStep | null;
  /** Currently authorized BCH identity when status is ACTIVE or EXPIRED. */
  activeBch: BchIdentity | null;
  /** Valid chain, oldest first. The head is the last element. */
  history: ChainStep[];
  /** Addresses that were authorized earlier in the chain (oldest first). */
  superseded: SupersededBinding[];
  conflict: { sequence: number; recordIds: string[] } | null;
  /** Structurally well-formed events that failed individual verification. */
  rejected: RecordRejection[];
  checkedAt: number;
  /** Unix seconds of the head record, if any. */
  headIssuedAt: number | null;
}

export interface VerifyContext {
  now: number;
  /** Reject records issued more than this many seconds in the future. */
  maxClockSkewSeconds: number;
  /** When set, BCH identities must be on this network. */
  expectedNetwork?: BchNetwork;
}

export interface RecordCheck {
  ok: boolean;
  code: string;
  message: string;
}

/** Domain-separated message a BCH key signs for a given role. */
export function buildBchProofMessage(
  role: BchProofRole,
  address: string,
  payloadDigest: string,
): string {
  if (!/^[0-9a-f]{64}$/.test(payloadDigest)) {
    throw new Error("payloadDigest must be 32-byte lowercase hex");
  }
  // Kept under 253 bytes so every wallet `signmessage` implementation can sign
  // it (several BCH wallets mishandle longer messages).
  return [
    "KYVERA/v1/bch-proof",
    `role:${role}`,
    `address:${address}`,
    `record:${payloadDigest}`,
  ].join("\n");
}

export function sha256Hex(bytes: Uint8Array): string {
  return binToHex(sha256.hash(bytes));
}

export function utf8Bytes(text: string): Uint8Array {
  return utf8ToBin(text);
}

export function payloadDigest(payload: KyveraPayload): string {
  return sha256Hex(utf8ToBin(canonicalize(payload)));
}

export function recordId(record: SignedRecord): string {
  return sha256Hex(utf8ToBin(canonicalize(record)));
}

export function canonicalRecord(record: SignedRecord): string {
  return canonicalize(record);
}
