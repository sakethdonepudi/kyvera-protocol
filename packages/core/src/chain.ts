import type {
  BchIdentity,
  ChainResolution,
  ChainStep,
  IdentityStatus,
  SupersededBinding,
  VerifiedRecord,
} from "./types.js";

export interface ResolveChainOptions {
  now: number;
}

function toStep(record: VerifiedRecord): ChainStep {
  return {
    record: record.record,
    recordId: record.recordId,
    payloadDigest: record.payloadDigest,
    eventId: record.eventId,
  };
}

function buildResolution(
  subject: string,
  now: number,
  fields: Partial<ChainResolution> & {
    status: IdentityStatus;
    reasonCode: string;
    reason: string;
  },
): ChainResolution {
  return {
    status: fields.status,
    reasonCode: fields.reasonCode,
    reason: fields.reason,
    subject,
    head: fields.head ?? null,
    activeBch: fields.activeBch ?? null,
    history: fields.history ?? [],
    superseded: fields.superseded ?? [],
    conflict: fields.conflict ?? null,
    rejected: fields.rejected ?? [],
    checkedAt: now,
    headIssuedAt: fields.headIssuedAt ?? null,
  };
}

/**
 * Resolves the globally authorized state from a set of individually verified
 * records belonging to one subject.
 *
 * The chain is only trusted from its genesis (sequence 0, bind). Every later
 * record must reference the exact previous record digest, and transitions must
 * be authorized under the policy:
 *
 *   bind   : new BCH key + Nostr key
 *   rotate : current BCH key + new BCH key + Nostr key
 *   revoke : current BCH key + Nostr key
 *
 * Any competing record at a sequence, or any valid record that cannot be
 * placed on the chain, is treated as equivocation (CONFLICT) rather than being
 * silently ignored. A missing link in otherwise valid history is STALE, never
 * an excuse to fall back to an older binding.
 */
export function resolveChain(verified: VerifiedRecord[], options: ResolveChainOptions): ChainResolution {
  const { now } = options;

  // De-duplicate by record digest. The same record may arrive from many relays
  // or under different event ids; they are identical authorizations.
  const unique = new Map<string, VerifiedRecord>();
  for (const item of verified) {
    if (!unique.has(item.recordId)) unique.set(item.recordId, item);
  }
  const records = [...unique.values()];
  const subject = records[0]?.record.payload.subject ?? "";

  if (records.length === 0) {
    return buildResolution(subject, now, {
      status: "UNKNOWN",
      reasonCode: "NO_RECORDS",
      reason: "No KYVERA records were found for this identity.",
    });
  }

  const bySequence = new Map<number, VerifiedRecord[]>();
  for (const record of records) {
    const seq = record.record.payload.sequence;
    const bucket = bySequence.get(seq) ?? [];
    bucket.push(record);
    bySequence.set(seq, bucket);
  }

  const genesis = bySequence.get(0) ?? [];
  if (genesis.length === 0) {
    const higher = records.some((record) => record.record.payload.sequence > 0);
    if (higher) {
      return buildResolution(subject, now, {
        status: "STALE",
        reasonCode: "MISSING_GENESIS",
        reason:
          "Transitions exist but the genesis binding is unavailable. Fetch a relay that retains the full history.",
        headIssuedAt: Math.min(...records.map((record) => record.record.payload.issuedAt)),
      });
    }
    return buildResolution(subject, now, {
      status: "INVALID",
      reasonCode: "MISSING_GENESIS",
      reason: "Records exist but none is a valid sequence-0 binding.",
    });
  }
  if (genesis.length > 1) {
    return buildResolution(subject, now, {
      status: "CONFLICT",
      reasonCode: "GENESIS_EQUIVOCATION",
      reason: "The identity key published more than one valid genesis binding.",
      conflict: { sequence: 0, recordIds: genesis.map((record) => record.recordId).sort() },
    });
  }

  let head = genesis[0]!;
  const history: ChainStep[] = [toStep(head)];
  const chainIds = new Set<string>([head.recordId]);

  while (true) {
    const next = bySequence.get(head.record.payload.sequence + 1) ?? [];
    if (next.length === 0) break;

    if (next.length > 1) {
      return buildResolution(subject, now, {
        status: "CONFLICT",
        reasonCode: "SEQUENCE_EQUIVOCATION",
        reason: `The identity key published ${next.length} competing records at sequence ${head.record.payload.sequence + 1}.`,
        head: toStep(head),
        history,
        headIssuedAt: head.record.payload.issuedAt,
        conflict: {
          sequence: head.record.payload.sequence + 1,
          recordIds: next.map((record) => record.recordId).sort(),
        },
      });
    }

    const candidate = next[0]!;
    if (candidate.record.payload.previous !== head.recordId) {
      return buildResolution(subject, now, {
        status: "CONFLICT",
        reasonCode: "CHAIN_FORK",
        reason: "A next-sequence record references a different predecessor than the resolved chain.",
        head: toStep(head),
        history,
        headIssuedAt: head.record.payload.issuedAt,
        conflict: {
          sequence: candidate.record.payload.sequence,
          recordIds: [head.recordId, candidate.recordId].sort(),
        },
      });
    }

    const transition = validateTransition(head, candidate);
    if (!transition.ok) {
      return buildResolution(subject, now, {
        status: "INVALID",
        reasonCode: transition.code,
        reason: transition.message,
        head: toStep(head),
        history,
        headIssuedAt: head.record.payload.issuedAt,
      });
    }

    head = candidate;
    history.push(toStep(head));
    chainIds.add(head.recordId);
    if (head.record.payload.type === "revoke") break;
  }

  const headStep = toStep(head);

  // Any valid record that is not part of the chain is evidence of equivocation
  // or of history this verifier has not received. Never silently prefer the
  // head we happen to have.
  const orphans = records.filter((record) => !chainIds.has(record.recordId));
  const afterRevoke = head.record.payload.type === "revoke" && orphans.some(
    (record) => record.record.payload.sequence > head.record.payload.sequence,
  );
  if (orphans.length > 0) {
    const equivocations = orphans.filter(
      (record) => record.record.payload.sequence <= head.record.payload.sequence,
    );
    if (equivocations.length > 0) {
      return buildResolution(subject, now, {
        status: "CONFLICT",
        reasonCode: "HISTORICAL_EQUIVOCATION",
        reason: "Competing valid records exist at a sequence already present in the chain.",
        head: headStep,
        history,
        headIssuedAt: head.record.payload.issuedAt,
        conflict: {
          sequence: Math.min(...equivocations.map((record) => record.record.payload.sequence)),
          recordIds: equivocations.map((record) => record.recordId).sort(),
        },
      });
    }

    if (afterRevoke) {
      return buildResolution(subject, now, {
        status: "CONFLICT",
        reasonCode: "TRANSITION_AFTER_REVOKE",
        reason: "A valid record attempts to continue the identity after its revocation.",
        head: headStep,
        history,
        headIssuedAt: head.record.payload.issuedAt,
        conflict: {
          sequence: Math.min(...orphans.map((record) => record.record.payload.sequence)),
          recordIds: orphans.map((record) => record.recordId).sort(),
        },
      });
    }

    const minOrphanSequence = Math.min(...orphans.map((record) => record.record.payload.sequence));
    if (minOrphanSequence > head.record.payload.sequence + 1) {
      return buildResolution(subject, now, {
        status: "STALE",
        reasonCode: "MISSING_CHAIN_SEGMENT",
        reason: `A valid record exists at sequence ${minOrphanSequence} but sequence ${head.record.payload.sequence + 1} is unavailable.`,
        head: headStep,
        history,
        headIssuedAt: head.record.payload.issuedAt,
      });
    }

    return buildResolution(subject, now, {
      status: "CONFLICT",
      reasonCode: "CHAIN_FORK",
      reason: "Valid records form more than one competing chain.",
      head: headStep,
      history,
      headIssuedAt: head.record.payload.issuedAt,
      conflict: {
        sequence: minOrphanSequence,
        recordIds: orphans.map((record) => record.recordId).sort(),
      },
    });
  }

  const superseded = collectSuperseded(history);
  const expiresAt = head.record.payload.expiresAt;

  if (head.record.payload.type === "revoke") {
    return buildResolution(subject, now, {
      status: "REVOKED",
      reasonCode: "REVOKED_HEAD",
      reason: "The identity was explicitly revoked by its authorized keys.",
      head: headStep,
      history,
      superseded,
      headIssuedAt: head.record.payload.issuedAt,
    });
  }

  const bch = head.record.payload.bch;
  if (expiresAt !== null && now > expiresAt) {
    return buildResolution(subject, now, {
      status: "EXPIRED",
      reasonCode: "HEAD_EXPIRED",
      reason: `The current binding expired at ${new Date(expiresAt * 1000).toISOString()}.`,
      head: headStep,
      activeBch: bch,
      history,
      superseded,
      headIssuedAt: head.record.payload.issuedAt,
    });
  }

  return buildResolution(subject, now, {
    status: "ACTIVE",
    reasonCode: "ACTIVE_HEAD",
    reason: "The binding is cryptographically valid, current, and not revoked.",
    head: headStep,
    activeBch: bch,
    history,
    superseded,
    headIssuedAt: head.record.payload.issuedAt,
  });
}

interface TransitionCheck {
  ok: boolean;
  code: string;
  message: string;
}

export function validateTransition(current: VerifiedRecord, next: VerifiedRecord): TransitionCheck {
  const currentPayload = current.record.payload;
  const nextPayload = next.record.payload;

  if (currentPayload.type === "revoke") {
    return { ok: false, code: "TRANSITION_AFTER_REVOKE", message: "No transition may follow a revocation." };
  }
  if (nextPayload.type === "bind") {
    return { ok: false, code: "BIND_AFTER_GENESIS", message: "A bind record may only appear at sequence 0." };
  }
  if (nextPayload.sequence !== currentPayload.sequence + 1) {
    return { ok: false, code: "SEQUENCE_GAP", message: "Sequence must increase by exactly one." };
  }
  if (nextPayload.previous !== current.recordId) {
    return { ok: false, code: "WRONG_PREVIOUS", message: "previous must be the digest of the preceding record." };
  }
  if (nextPayload.issuedAt <= currentPayload.issuedAt) {
    return { ok: false, code: "TIME_NOT_MONOTONIC", message: "issuedAt must increase with the sequence." };
  }
  if (currentPayload.bch === null) {
    return { ok: false, code: "NO_CURRENT_BCH", message: "The preceding record authorizes no BCH identity." };
  }

  const currentProof = next.record.proofs.bch.find((proof) => proof.role === "current");
  if (!currentProof) {
    return { ok: false, code: "MISSING_CURRENT_PROOF", message: "The transition lacks a current-key proof." };
  }
  if (currentProof.address !== currentPayload.bch.address) {
    return {
      ok: false,
      code: "CURRENT_PROOF_MISMATCH",
      message: "The current-key proof is not by the currently authorized BCH address.",
    };
  }

  if (nextPayload.type === "rotate") {
    if (nextPayload.bch === null) {
      return { ok: false, code: "ROTATE_NO_BCH", message: "A rotation must declare the new BCH identity." };
    }
    const newProof = next.record.proofs.bch.find((proof) => proof.role === "new");
    if (!newProof || newProof.address !== nextPayload.bch.address) {
      return { ok: false, code: "MISSING_NEW_PROOF", message: "The rotation lacks proof of the new BCH key." };
    }
    if (newProof.address === currentProof.address) {
      return { ok: false, code: "ROTATION_ADDRESS_REUSED", message: "A rotation must move to a different address." };
    }
  }

  return { ok: true, code: "OK", message: "ok" };
}

function collectSuperseded(history: ChainStep[]): SupersededBinding[] {
  const result: SupersededBinding[] = [];
  for (let index = 0; index < history.length; index += 1) {
    const step = history[index]!;
    const bch = step.record.payload.bch;
    if (!bch) continue;
    const later = history.slice(index + 1).find((candidate) => candidate.record.payload.bch !== null);
    if (later?.record.payload.bch) {
      result.push({
        address: bch.address,
        sequence: step.record.payload.sequence,
        recordId: step.recordId,
        replacedBy: later.record.payload.bch.address,
      });
    } else if (step !== history[history.length - 1] || history[history.length - 1]!.record.payload.type === "revoke") {
      result.push({
        address: bch.address,
        sequence: step.record.payload.sequence,
        recordId: step.recordId,
        replacedBy: "revoked",
      });
    }
  }
  return result;
}

/** Returns the address authorized by the chain, or null when none is current. */
export function currentAddress(resolution: ChainResolution): string | null {
  return resolution.activeBch?.address ?? null;
}

/** Finds the sequence at which an address was authorized in this chain. */
export function findAddressInChain(resolution: ChainResolution, address: string): ChainStep | null {
  const wanted = address.toLowerCase();
  const steps = resolution.history.filter(
    (step) => step.record.payload.bch?.address.toLowerCase() === wanted,
  );
  return steps.length > 0 ? steps[steps.length - 1]! : null;
}

export function sameIdentity(a: BchIdentity, b: BchIdentity): boolean {
  return a.address.toLowerCase() === b.address.toLowerCase() && a.publicKey === b.publicKey;
}
