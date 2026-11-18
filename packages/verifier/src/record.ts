import {
  digestOf,
  recordDigest,
  resolveChain,
  validateSignedRecord,
  type BchNetwork,
  type ChainResolution,
  type KyveraEvent,
  type RecordCheck,
  type SignedRecord,
  type VerifiedRecord,
} from "@kyvera/core";
import { sameSecp256k1Key, verifyBchIdentityProof } from "@kyvera/bch";
import { parseRecordEvent } from "@kyvera/nostr";

export interface VerifyOptions {
  now: number;
  /** Reject records issued further than this into the future. */
  maxClockSkewSeconds?: number;
  network?: BchNetwork;
}

export interface VerifyRecordResult extends RecordCheck {
  recordId?: string;
  payloadDigest?: string;
}

/**
 * Full cryptographic verification of one record, independent of any chain.
 *
 * A record being valid here means "the authorizations it contains are real".
 * It does NOT mean the record is the current identity state; that requires
 * `resolveChain` over the full history.
 */
export function verifyRecord(record: SignedRecord, options: VerifyOptions): VerifyRecordResult {
  const maxSkew = options.maxClockSkewSeconds ?? 600;
  const shape = validateSignedRecord(record, options.network);
  if (!shape.ok || !shape.value) return { ok: false, code: shape.code, message: shape.message };
  const parsed = shape.value;
  const { payload } = parsed;

  if (payload.issuedAt > options.now + maxSkew) {
    return {
      ok: false,
      code: "ISSUED_IN_FUTURE",
      message: `record is issued ${payload.issuedAt - options.now}s in the future`,
    };
  }

  const digest = digestOf(payload);
  const currentProof = parsed.proofs.bch.find((proof) => proof.role === "current");
  const newProof = parsed.proofs.bch.find((proof) => proof.role === "new");

  if (payload.type === "bind") {
    if (!newProof || !payload.bch) {
      return { ok: false, code: "PROOF_ROLE_MATRIX", message: "bind requires a new-key proof" };
    }
    const check = verifyBchIdentityProof({
      expectedAddress: payload.bch.address,
      expectedPublicKey: payload.bch.publicKey ?? undefined,
      role: "new",
      payloadDigest: digest,
      signature: newProof.signature,
      nostrPublicKey: payload.subject,
    });
    if (!check.ok) return { ok: false, code: check.code, message: check.message };
  }

  if (payload.type === "rotate") {
    if (!currentProof || !newProof || !payload.bch) {
      return { ok: false, code: "PROOF_ROLE_MATRIX", message: "rotate requires current and new proofs" };
    }
    const current = verifyBchIdentityProof({
      expectedAddress: currentProof.address,
      role: "current",
      payloadDigest: digest,
      signature: currentProof.signature,
    });
    if (!current.ok) return { ok: false, code: current.code, message: `current-key proof: ${current.message}` };
    if (current.publicKey && sameSecp256k1Key(current.publicKey, payload.subject)) {
      return { ok: false, code: "KEY_REUSE", message: "the current BCH key is also the Nostr key" };
    }

    const nextProof = verifyBchIdentityProof({
      expectedAddress: payload.bch.address,
      expectedPublicKey: payload.bch.publicKey ?? undefined,
      role: "new",
      payloadDigest: digest,
      signature: newProof.signature,
      nostrPublicKey: payload.subject,
    });
    if (!nextProof.ok) return { ok: false, code: nextProof.code, message: `new-key proof: ${nextProof.message}` };
  }

  if (payload.type === "revoke") {
    if (!currentProof) {
      return { ok: false, code: "PROOF_ROLE_MATRIX", message: "revoke requires a current-key proof" };
    }
    const current = verifyBchIdentityProof({
      expectedAddress: currentProof.address,
      role: "current",
      payloadDigest: digest,
      signature: currentProof.signature,
    });
    if (!current.ok) return { ok: false, code: current.code, message: `current-key proof: ${current.message}` };
    if (current.publicKey && sameSecp256k1Key(current.publicKey, payload.subject)) {
      return { ok: false, code: "KEY_REUSE", message: "the current BCH key is also the Nostr key" };
    }
  }

  return {
    ok: true,
    code: "OK",
    message: "ok",
    recordId: recordDigest(parsed),
    payloadDigest: digest,
  };
}

export interface VerifyEventResult extends VerifyRecordResult {
  verified?: VerifiedRecord;
}

/** Parses a KYVERA Nostr event and verifies both the Nostr and BCH proofs. */
export function verifyEventRecord(event: KyveraEvent, options: VerifyOptions): VerifyEventResult {
  const parsed = parseRecordEvent(event);
  if (!parsed.ok || !parsed.record) return { ok: false, code: parsed.code, message: parsed.message };
  const checked = verifyRecord(parsed.record, options);
  if (!checked.ok) return checked;
  return {
    ok: true,
    code: "OK",
    message: "ok",
    recordId: checked.recordId,
    payloadDigest: checked.payloadDigest,
    verified: {
      record: parsed.record,
      recordId: checked.recordId!,
      payloadDigest: checked.payloadDigest!,
      eventId: event.id,
      observedAt: options.now,
    },
  };
}

export interface ResolutionWithRejections {
  resolution: ChainResolution;
  rejected: Array<{ eventId: string | null; code: string; message: string }>;
}

export function resolveEvents(
  events: KyveraEvent[],
  options: VerifyOptions & { subject?: string },
): ResolutionWithRejections {
  const verified: VerifiedRecord[] = [];
  const rejected: Array<{ eventId: string | null; code: string; message: string }> = [];
  const unique = new Map<string, KyveraEvent>();
  for (const event of events) {
    if (!unique.has(event.id)) unique.set(event.id, event);
  }

  let subject = options.subject;
  for (const event of unique.values()) {
    const result = verifyEventRecord(event, options);
    if (result.ok && result.verified) {
      if (!subject) subject = result.verified.record.payload.subject;
      if (subject && result.verified.record.payload.subject !== subject) {
        rejected.push({ eventId: event.id, code: "SUBJECT_MISMATCH", message: "record belongs to another subject" });
        continue;
      }
      verified.push(result.verified);
    } else {
      rejected.push({ eventId: event.id, code: result.code, message: result.message });
    }
  }

  if (verified.length === 0 && rejected.length > 0) {
    return {
      resolution: {
        status: "INVALID",
        reasonCode: "NO_VERIFIABLE_RECORDS",
        reason: "No record passed cryptographic verification.",
        subject: options.subject ?? "",
        head: null,
        activeBch: null,
        history: [],
        superseded: [],
        conflict: null,
        rejected,
        checkedAt: options.now,
        headIssuedAt: null,
      },
      rejected,
    };
  }

  const resolution = resolveChain(verified, { now: options.now });
  resolution.rejected = rejected;
  return { resolution, rejected };
}
