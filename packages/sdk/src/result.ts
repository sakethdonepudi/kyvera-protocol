import type {
  IdentityStatus,
  RecordRejection,
  SupersededBinding,
  ChainStep,
} from "@kyvera/core";
import type { Assurance, IdentityResolution, RelayStatus } from "@kyvera/verifier";

export interface KyveraCheck {
  id: string;
  ok: boolean;
  detail: string;
}

export interface KyveraHistoricalRecord {
  sequence: number;
  type: "bind" | "rotate" | "revoke";
  recordId: string;
  payloadDigest: string;
  eventId: string | null;
  address: string | null;
  issuedAt: number;
}

/**
 * Structured verification output. Never collapses to a single boolean:
 * cryptographic validity, historical validity, current authorization and
 * evidence completeness are separate facts.
 */
export interface KyveraVerificationResult {
  protocol: "kyvera";
  version: 1;
  subject: string;
  npub: string;
  status: IdentityStatus;
  reasonCode: string;
  reason: string;

  /** True when at least one record verified and no structurally valid record failed proof verification. */
  cryptographicValidity: boolean;

  historicalValidity: {
    valid: boolean;
    records: KyveraHistoricalRecord[];
    superseded: SupersededBinding[];
    rejected: RecordRejection[];
    conflict: IdentityResolution["conflict"];
    head: KyveraHistoricalRecord | null;
  };

  currentAuthorization: {
    /** True only when the resolved chain is ACTIVE and asserts a BCH address. */
    authorized: boolean;
    /** True only when current authorization is also backed by FULL relay agreement. */
    usableForSensitiveOperations: boolean;
    address: string | null;
    sequence: number | null;
    headRecordId: string | null;
    expiresAt: number | null;
  };

  evidenceCompleteness: {
    assurance: Assurance;
    full: boolean;
    responded: number;
    total: number;
    relays: RelayStatus[];
    sources: Record<string, string[]>;
  };

  checks: KyveraCheck[];
  /** Raw resolution, including verified events, for evidence inspection/export. */
  resolution: IdentityResolution;
  checkedAt: number;
}

function toHistorical(step: ChainStep): KyveraHistoricalRecord {
  return {
    sequence: step.record.payload.sequence,
    type: step.record.payload.type,
    recordId: step.recordId,
    payloadDigest: step.payloadDigest,
    eventId: step.eventId,
    address: step.record.payload.bch?.address ?? null,
    issuedAt: step.record.payload.issuedAt,
  };
}

export function toVerificationResult(
  resolution: IdentityResolution,
  npub: string,
): KyveraVerificationResult {
  const records = resolution.history.map(toHistorical);
  const historicalValid = records.length > 0 && resolution.rejected.length === 0;
  const cryptographicValidity =
    historicalValid && resolution.status !== "INVALID" && resolution.status !== "UNKNOWN";
  const authorized = resolution.status === "ACTIVE" && resolution.activeBch !== null;
  const full = resolution.assurance === "FULL";
  const head = records.length > 0 ? records[records.length - 1]! : null;
  const expiredAt = resolution.head?.record.payload.expiresAt ?? null;

  const checks: KyveraCheck[] = [
    {
      id: "cryptographic_proofs",
      ok: cryptographicValidity,
      detail: historicalValid
        ? `${records.length} valid record(s), ${resolution.rejected.length} rejected`
        : `${records.length} valid record(s), ${resolution.rejected.length} rejected; status ${resolution.status}`,
    },
    {
      id: "chain_active",
      ok: resolution.status === "ACTIVE",
      detail: `${resolution.status} · ${resolution.reasonCode}`,
    },
    {
      id: "current_address",
      ok: resolution.activeBch !== null,
      detail: resolution.activeBch?.address ?? "no current address asserted",
    },
    {
      id: "full_relay_agreement",
      ok: full,
      detail: `${resolution.assurance} · ${resolution.sync.responded}/${resolution.sync.total} relays responded`,
    },
    {
      id: "no_conflict",
      ok: resolution.conflict === null,
      detail: resolution.conflict
        ? `sequence #${resolution.conflict.sequence} · ${resolution.conflict.recordIds.length} competing records`
        : "none",
    },
    {
      id: "no_rejected_records",
      ok: resolution.rejected.length === 0,
      detail: resolution.rejected.length === 0 ? "none" : `${resolution.rejected.length} rejected`,
    },
  ];

  return {
    protocol: "kyvera",
    version: 1,
    subject: resolution.subject,
    npub,
    status: resolution.status,
    reasonCode: resolution.reasonCode,
    reason: resolution.reason,
    cryptographicValidity,
    historicalValidity: {
      valid: historicalValid,
      records,
      superseded: resolution.superseded,
      rejected: resolution.rejected,
      conflict: resolution.conflict,
      head,
    },
    currentAuthorization: {
      authorized,
      usableForSensitiveOperations: authorized && full,
      address: resolution.activeBch?.address ?? null,
      sequence: resolution.head?.record.payload.sequence ?? null,
      headRecordId: resolution.head?.recordId ?? null,
      expiresAt: expiredAt,
    },
    evidenceCompleteness: {
      assurance: resolution.assurance,
      full,
      responded: resolution.sync.responded,
      total: resolution.sync.total,
      relays: resolution.sync.relays,
      sources: resolution.sources,
    },
    checks,
    resolution,
    checkedAt: resolution.checkedAt,
  };
}
