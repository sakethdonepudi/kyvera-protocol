import { hasExactKeys, isPlainObject } from "./canonical.js";
import type { BchIdentity, BchProof, KyveraPayload, SignedRecord } from "./types.js";
import { PROTOCOL, PROTOCOL_VERSION } from "./types.js";

export interface ShapeResult<T> {
  ok: boolean;
  code: string;
  message: string;
  value?: T;
}

const HEX64 = /^[0-9a-f]{64}$/;
const HEX66 = /^[0-9a-f]{66}$/;
const ADDRESS = /^(bitcoincash|bchtest):[a-z0-9]{40,}$/;
const BASE64 = /^[A-Za-z0-9+/]{86,90}={0,2}$/;
const TYPES = new Set(["bind", "rotate", "revoke"]);
const ROLES = new Set(["current", "new"]);

function fail<T>(code: string, message: string): ShapeResult<T> {
  return { ok: false, code, message };
}

function isInt(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

export function validateBchIdentity(value: unknown, expectedNetwork?: string): ShapeResult<BchIdentity> {
  if (!hasExactKeys(value, ["address", "network", "publicKey"])) {
    return fail("BCH_IDENTITY_SHAPE", "bch identity must have exactly address, network, publicKey");
  }
  const { address, network, publicKey } = value;
  if (typeof address !== "string" || !ADDRESS.test(address) || address !== address.toLowerCase()) {
    return fail("BCH_ADDRESS_INVALID", "bch.address must be a lowercase prefixed CashAddr");
  }
  if (network !== "mainnet" && network !== "chipnet") {
    return fail("BCH_NETWORK_INVALID", "bch.network must be mainnet or chipnet");
  }
  const prefix = address.startsWith("bitcoincash:") ? "mainnet" : "chipnet";
  if (prefix !== network) {
    return fail("BCH_NETWORK_MISMATCH", `address prefix implies ${prefix}, payload says ${network}`);
  }
  if (expectedNetwork && network !== expectedNetwork) {
    return fail("BCH_NETWORK_UNEXPECTED", `expected ${expectedNetwork} identity, got ${network}`);
  }
  if (publicKey !== null && (typeof publicKey !== "string" || !HEX66.test(publicKey))) {
    return fail("BCH_PUBLIC_KEY_INVALID", "bch.publicKey must be null or a 33-byte compressed key in lowercase hex");
  }
  return { ok: true, code: "OK", message: "ok", value: { address, network, publicKey: publicKey ?? null } };
}

export function validateBchProof(value: unknown): ShapeResult<BchProof> {
  if (!hasExactKeys(value, ["algorithm", "role", "address", "signature"])) {
    return fail("BCH_PROOF_SHAPE", "bch proof must have exactly algorithm, role, address, signature");
  }
  const { algorithm, role, address, signature } = value;
  if (algorithm !== "bch-signmessage-v1") {
    return fail("BCH_PROOF_ALGORITHM", `unsupported proof algorithm: ${String(algorithm)}`);
  }
  if (typeof role !== "string" || !ROLES.has(role)) {
    return fail("BCH_PROOF_ROLE", "bch proof role must be current or new");
  }
  if (typeof address !== "string" || !ADDRESS.test(address) || address !== address.toLowerCase()) {
    return fail("BCH_PROOF_ADDRESS", "bch proof address must be a lowercase prefixed CashAddr");
  }
  if (typeof signature !== "string" || !BASE64.test(signature)) {
    return fail("BCH_PROOF_SIGNATURE_SHAPE", "bch proof signature must be 65-byte base64");
  }
  return {
    ok: true,
    code: "OK",
    message: "ok",
    value: { algorithm, role: role as BchProof["role"], address, signature },
  };
}

/**
 * Structural validation only. Cryptographic verification happens in
 * @kyvera/verifier. This function enforces the type/sequence/proof-role matrix
 * so malformed records can never reach signature checking.
 */
export function validatePayload(value: unknown, expectedNetwork?: string): ShapeResult<KyveraPayload> {
  if (!isPlainObject(value)) return fail("PAYLOAD_SHAPE", "payload must be an object");
  if (
    !hasExactKeys(value, [
      "protocol",
      "version",
      "type",
      "subject",
      "sequence",
      "previous",
      "bch",
      "issuedAt",
      "expiresAt",
      "nonce",
    ])
  ) {
    return fail("PAYLOAD_SHAPE", "payload has missing or unknown fields");
  }

  const { protocol, version, type, subject, sequence, previous, bch, issuedAt, expiresAt, nonce } = value;

  if (protocol !== PROTOCOL) return fail("PROTOCOL_INVALID", `protocol must be "${PROTOCOL}"`);
  if (version !== PROTOCOL_VERSION) return fail("VERSION_UNSUPPORTED", `unsupported version: ${String(version)}`);
  if (typeof type !== "string" || !TYPES.has(type)) return fail("TYPE_INVALID", "type must be bind, rotate or revoke");
  if (typeof subject !== "string" || !HEX64.test(subject)) {
    return fail("SUBJECT_INVALID", "subject must be a 32-byte lowercase hex Nostr public key");
  }
  if (!isInt(sequence) || sequence < 0 || sequence > 1_000_000) {
    return fail("SEQUENCE_INVALID", "sequence must be a non-negative integer");
  }
  if (previous !== null && (typeof previous !== "string" || !HEX64.test(previous))) {
    return fail("PREVIOUS_INVALID", "previous must be null or a 32-byte lowercase hex digest");
  }
  if (typeof nonce !== "string" || !HEX64.test(nonce)) {
    return fail("NONCE_INVALID", "nonce must be 32-byte lowercase hex");
  }
  if (!isInt(issuedAt) || issuedAt <= 0) return fail("ISSUED_AT_INVALID", "issuedAt must be a positive integer");
  if (expiresAt !== null && (!isInt(expiresAt) || expiresAt <= issuedAt)) {
    return fail("EXPIRES_AT_INVALID", "expiresAt must be null or greater than issuedAt");
  }

  if (type === "bind") {
    if (sequence !== 0) return fail("BIND_SEQUENCE", "bind must be sequence 0");
    if (previous !== null) return fail("BIND_PREVIOUS", "bind must not reference a previous record");
  } else {
    if (sequence === 0) return fail("TRANSITION_SEQUENCE", `${type} must be sequence > 0`);
    if (previous === null) return fail("TRANSITION_PREVIOUS", `${type} must reference the previous record`);
  }

  if (type === "revoke") {
    if (bch !== null) return fail("REVOKE_BCH", "revoke must not carry a bch identity");
  } else {
    const check = validateBchIdentity(bch, expectedNetwork);
    if (!check.ok) return fail(check.code, check.message);
  }

  return {
    ok: true,
    code: "OK",
    message: "ok",
    value: {
      protocol: PROTOCOL,
      version: PROTOCOL_VERSION,
      type: type as KyveraPayload["type"],
      subject,
      sequence,
      previous,
      bch: type === "revoke" ? null : (bch as BchIdentity),
      issuedAt,
      expiresAt,
      nonce,
    },
  };
}

export function validateSignedRecord(value: unknown, expectedNetwork?: string): ShapeResult<SignedRecord> {
  if (!hasExactKeys(value, ["payload", "proofs"])) {
    return fail("RECORD_SHAPE", "record must have exactly payload and proofs");
  }
  const payload = validatePayload(value.payload, expectedNetwork);
  if (!payload.ok || !payload.value) return fail(payload.code, payload.message);

  const proofsValue = value.proofs;
  if (!hasExactKeys(proofsValue, ["bch"]) || !Array.isArray(proofsValue.bch)) {
    return fail("PROOFS_SHAPE", "proofs must contain exactly a bch array");
  }

  const proofs: BchProof[] = [];
  for (const raw of proofsValue.bch) {
    const proof = validateBchProof(raw);
    if (!proof.ok || !proof.value) return fail(proof.code, proof.message);
    proofs.push(proof.value);
  }

  const p = payload.value;
  const byRole = new Map<string, BchProof>();
  for (const proof of proofs) {
    if (byRole.has(proof.role)) return fail("DUPLICATE_PROOF_ROLE", `duplicate ${proof.role} proof`);
    byRole.set(proof.role, proof);
  }

  if (p.type === "bind") {
    if (proofs.length !== 1 || !byRole.has("new")) {
      return fail("PROOF_ROLE_MATRIX", "bind requires exactly one new-key proof");
    }
    if (!p.bch || byRole.get("new")!.address !== p.bch.address) {
      return fail("PROOF_ADDRESS_MISMATCH", "new-key proof address must match bch.address");
    }
  } else if (p.type === "rotate") {
    if (proofs.length !== 2 || !byRole.has("current") || !byRole.has("new")) {
      return fail("PROOF_ROLE_MATRIX", "rotate requires current-key and new-key proofs");
    }
    if (!p.bch || byRole.get("new")!.address !== p.bch.address) {
      return fail("PROOF_ADDRESS_MISMATCH", "new-key proof address must match bch.address");
    }
    if (byRole.get("current")!.address === byRole.get("new")!.address) {
      return fail("ROTATION_ADDRESS_REUSED", "rotation must change the BCH address");
    }
  } else {
    if (proofs.length !== 1 || !byRole.has("current")) {
      return fail("PROOF_ROLE_MATRIX", "revoke requires exactly one current-key proof");
    }
  }

  return {
    ok: true,
    code: "OK",
    message: "ok",
    value: { payload: p, proofs: { bch: proofs } },
  };
}

export function proofsByRole(record: SignedRecord): { current?: BchProof; new?: BchProof } {
  const result: { current?: BchProof; new?: BchProof } = {};
  for (const proof of record.proofs.bch) result[proof.role] = proof;
  return result;
}
