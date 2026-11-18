import {
  NOSTR_D_PREFIX,
  NOSTR_K_TAG,
  NOSTR_KIND,
  canonicalRecord,
  payloadDigest as computePayloadDigest,
  recordId as computeRecordId,
  validateSignedRecord,
  type KyveraEvent,
  type SignedRecord,
} from "@kyvera/core";
import { finalizeEvent, generateSecretKey, getPublicKey, verifyEvent } from "nostr-tools/pure";
import { nip19 } from "nostr-tools";

export interface UnsignedEventTemplate {
  kind: number;
  created_at: number;
  tags: string[][];
  content: string;
}

export interface NostrSigner {
  getPublicKey(): Promise<string>;
  signEvent(event: UnsignedEventTemplate): Promise<KyveraEvent>;
}

export function signerFromSecretKey(secretKey: Uint8Array): NostrSigner {
  const pubkey = getPublicKey(secretKey);
  return {
    getPublicKey: async () => pubkey,
    signEvent: async (template) =>
      finalizeEvent(
        {
          kind: template.kind,
          created_at: template.created_at,
          tags: template.tags,
          content: template.content,
        },
        secretKey,
      ) as KyveraEvent,
  };
}

/** NIP-07 browser extension signer. */
export interface Nip07Provider {
  getPublicKey(): Promise<string>;
  signEvent(event: UnsignedEventTemplate): Promise<KyveraEvent>;
}

export function signerFromNip07(provider: Nip07Provider): NostrSigner {
  return {
    getPublicKey: () => provider.getPublicKey(),
    signEvent: async (template) => {
      const signed = await provider.signEvent(template);
      return signed;
    },
  };
}

export function generateNostrSecretKey(): Uint8Array {
  return generateSecretKey();
}

/** Fresh copy: nostr-tools caches verification on the object, which would let a mutated event "verify". */
export function freshEvent(event: KyveraEvent): KyveraEvent {
  return {
    id: event.id,
    pubkey: event.pubkey,
    created_at: event.created_at,
    kind: event.kind,
    tags: event.tags.map((entry) => [...entry]),
    content: event.content,
    sig: event.sig,
  };
}

export function recordTags(record: SignedRecord): string[][] {
  const { payload, proofs } = record;
  const digest = computePayloadDigest(payload);
  const dTag = `${NOSTR_D_PREFIX}:${payload.subject}:${payload.sequence}:${digest}`;
  const addresses = [...new Set(proofs.bch.map((proof) => proof.address))].sort();
  return [
    ["d", dTag],
    ["k", NOSTR_K_TAG],
    ["s", payload.subject],
    ["seq", String(payload.sequence)],
    ["prev", payload.previous ?? "genesis"],
    ...addresses.map((address) => ["b", address]),
    ["alt", `KYVERA identity record v1 (${payload.type})`],
  ];
}

export interface BuildEventResult {
  ok: boolean;
  code: string;
  message: string;
  event?: KyveraEvent;
}

/**
 * Signs a record as a NIP-78 event. The signer's public key MUST be the
 * record's subject; this is the Nostr half of the dual-key authorization.
 */
export async function buildRecordEvent(record: SignedRecord, signer: NostrSigner): Promise<BuildEventResult> {
  const pubkey = await signer.getPublicKey();
  if (pubkey !== record.payload.subject) {
    return {
      ok: false,
      code: "SIGNER_SUBJECT_MISMATCH",
      message: "the Nostr signer is not the identity the record governs",
    };
  }
  const template: UnsignedEventTemplate = {
    kind: NOSTR_KIND,
    created_at: record.payload.issuedAt,
    tags: recordTags(record),
    content: canonicalRecord(record),
  };
  const event = await signer.signEvent(template);
  const parsed = parseRecordEvent(event);
  if (!parsed.ok) return { ok: false, code: parsed.code, message: parsed.message };
  return { ok: true, code: "OK", message: "ok", event };
}

export interface ParsedRecordEvent {
  ok: boolean;
  code: string;
  message: string;
  record?: SignedRecord;
  recordId?: string;
  payloadDigest?: string;
}

/**
 * Validates everything about a KYVERA event that can be checked without BCH
 * cryptography: event signature, canonical content, tags, author binding and
 * timestamp equality. BCH proofs are checked by @kyvera/verifier.
 */
export function parseRecordEvent(event: KyveraEvent): ParsedRecordEvent {
  let fresh: KyveraEvent;
  try {
    fresh = freshEvent(event);
  } catch {
    return { ok: false, code: "NOSTR_EVENT_SHAPE", message: "malformed Nostr event" };
  }
  let signatureValid = false;
  try {
    signatureValid = verifyEvent(fresh as never);
  } catch {
    signatureValid = false;
  }
  if (!signatureValid) {
    return { ok: false, code: "NOSTR_SIGNATURE_INVALID", message: "event id or Schnorr signature is invalid" };
  }
  if (fresh.kind !== NOSTR_KIND) {
    return { ok: false, code: "NOSTR_KIND_INVALID", message: `expected kind ${NOSTR_KIND}` };
  }
  if (typeof fresh.content !== "string" || fresh.content.length === 0 || fresh.content.length > 16_384) {
    return { ok: false, code: "CONTENT_LENGTH", message: "event content is empty or too large" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(fresh.content);
  } catch {
    return { ok: false, code: "CONTENT_JSON", message: "event content is not JSON" };
  }
  let canonical: string;
  try {
    canonical = canonicalRecord(parsed as SignedRecord);
  } catch {
    return { ok: false, code: "CONTENT_NOT_CANONICAL", message: "content is not canonical KYVERA JSON" };
  }
  if (canonical !== fresh.content) {
    return { ok: false, code: "CONTENT_NOT_CANONICAL", message: "content must use KYVERA canonical JSON exactly" };
  }

  const shape = validateSignedRecord(parsed);
  if (!shape.ok || !shape.value) {
    return { ok: false, code: shape.code, message: shape.message };
  }
  const record = shape.value;

  if (fresh.pubkey !== record.payload.subject) {
    return { ok: false, code: "SUBJECT_MISMATCH", message: "event author is not the record subject" };
  }
  if (fresh.created_at !== record.payload.issuedAt) {
    return { ok: false, code: "TIMESTAMP_MISMATCH", message: "created_at must equal payload.issuedAt" };
  }

  const one = (name: string) => {
    const matches = fresh.tags.filter((entry) => entry[0] === name);
    return matches.length === 1 ? matches[0]![1] : undefined;
  };

  const digest = computePayloadDigest(record.payload);
  const expectedDTag = `${NOSTR_D_PREFIX}:${record.payload.subject}:${record.payload.sequence}:${digest}`;
  const expectedAddresses = [...new Set(record.proofs.bch.map((proof) => proof.address))].sort();
  const addressTags = fresh.tags.filter((entry) => entry[0] === "b").map((entry) => entry[1] ?? "").sort();

  const checks: Array<[boolean, string, string]> = [
    [one("d") === expectedDTag, "D_TAG_INVALID", "d tag must occur exactly once and commit to subject, sequence and payload"],
    [one("k") === NOSTR_K_TAG, "K_TAG_INVALID", `k tag must occur exactly once and equal ${NOSTR_K_TAG}`],
    [one("s") === record.payload.subject, "SUBJECT_TAG_INVALID", "s tag must occur exactly once and match subject"],
    [one("seq") === String(record.payload.sequence), "SEQ_TAG_INVALID", "seq tag must occur exactly once and match payload"],
    [
      one("prev") === (record.payload.previous ?? "genesis"),
      "PREV_TAG_INVALID",
      "prev tag must occur exactly once and match payload",
    ],
    [
      addressTags.length === expectedAddresses.length &&
        addressTags.every((address, index) => address === expectedAddresses[index]),
      "ADDRESS_TAGS_INVALID",
      "b tags must list exactly the proof addresses",
    ],
  ];
  for (const [condition, code, message] of checks) {
    if (!condition) return { ok: false, code, message };
  }

  return {
    ok: true,
    code: "OK",
    message: "ok",
    record,
    recordId: computeRecordId(record),
    payloadDigest: digest,
  };
}

export function normalizeNostrPublicKey(input: string): string | null {
  const trimmed = input.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) return trimmed.toLowerCase();
  try {
    const decoded = nip19.decode(trimmed);
    if (decoded.type === "npub") return decoded.data;
    if (decoded.type === "nprofile") return decoded.data.pubkey;
  } catch {
    return null;
  }
  return null;
}

export function toNpub(publicKeyHex: string): string {
  return nip19.npubEncode(publicKeyHex);
}
