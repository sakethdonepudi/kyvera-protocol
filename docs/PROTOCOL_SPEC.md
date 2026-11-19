# KYVERA Protocol Specification (V5 entry point)

**Status:** implementation specification, not an audited standard
**Protocol:** `kyvera` v1
**Reference implementation:** TypeScript in `packages/core`, `packages/bch`, `packages/nostr`, `packages/verifier`
**Byte-level details:** [`docs/PROTOCOL.md`](PROTOCOL.md)
**Public discovery:** [`docs/protocol/NOSTR_DISCOVERY_RFC.md`](protocol/NOSTR_DISCOVERY_RFC.md)

---

## 1. Identity model

An identity is a Nostr x-only secp256k1 public key (`subject`). It controls a hash-linked sequence of BCH wallet authorizations.

- The BCH key and Nostr key MUST be independent. Reusing the same secp256k1 key is rejected (`KEY_REUSE`).
- BCH control is proven by a 65-byte `signmessage` signature; the verifier recovers the key and compares `hash160(key)` with the P2PKH payload.
- The Nostr half is proven by a BIP-340 Schnorr event signature whose author equals `subject`.
- Private keys are never part of a record, event, bundle or resolution.

## 2. Record schema

A record is `{ payload, proofs.bch[] }`.

Payload fields: `protocol`, `version`, `type`, `subject`, `sequence`, `previous`, `bch`, `issuedAt`, `expiresAt`, `nonce`.

Transition matrix:

| Type | Sequence | Previous | BCH destination | Proof roles |
| --- | --- | --- | --- | --- |
| `bind` | 0 | null | new wallet | `new` |
| `rotate` | > 0 | previous record id | new wallet | `current` + `new` |
| `revoke` | > 0 | previous record id | null | `current` |

Canonicalization, exact field constraints, proof message format and signature encoding are defined in [`docs/PROTOCOL.md`](PROTOCOL.md).

## 3. Authorization rules

A verifier MUST:

1. Verify the canonical record and both signatures independently.
2. Start at exactly one valid sequence-0 `bind`.
3. Require every next sequence to reference the previous record id.
4. Reject an unauthorized rotate/revoke (`current` proof missing or invalid).
5. Stop at `revoke`; later records are not current.
6. Return `CONFLICT` when multiple valid records occupy the same sequence or a fork exists.
7. Return `STALE` when a signed sequence jump cannot be placed on the chain.
8. Return `INVALID` when proofs or transitions fail.
9. Never return `ACTIVE` without a current BCH address and a valid chain.
10. Enforce network matching when a network is configured.

## 4. Discovery

New records use two envelopes:

- **Public discovery:** regular event kind `1078`, `k=kyvera-v1`, unique `d` tag, `s`, `seq`, `prev`, `b` tags.
- **Legacy/mirror:** addressable event kind `30078` (NIP-78) with the same content and tags.

The verifier accepts both kinds, queries both, and de-duplicates by `recordId`. Kind `1078` is experimental and unregistered; KYVERA does not claim a NIP or DID method. See the discovery RFC for the NIP-78/AUTH analysis and migration.

## 5. Verification result model

The SDK never returns only `true`/`false`. It separates:

- **cryptographic validity** — proofs and signatures;
- **historical validity** — each record at its position;
- **current authorization** — `ACTIVE` plus a destination;
- **evidence completeness** — `FULL`, `PARTIAL`, `UNSYNCED`;
- **sensitive-operation usability** — current authorization plus `FULL`.

`FULL` means every configured relay completed with EOSE. It does not prove global history completeness.

## 6. Conflict and failure semantics

| Status | Meaning |
| --- | --- |
| `ACTIVE` | Valid chain, current destination. |
| `SUPERSEDED` | Historical binding, no longer current. |
| `REVOKED` | Chain explicitly ended; no destination. |
| `EXPIRED` | Current authorization outlived `expiresAt`. |
| `CONFLICT` | Equivocation or fork; no current destination. |
| `STALE` | Missing history or insufficient relay evidence; no current destination. |
| `UNKNOWN` | No records found. |
| `INVALID` | Proofs, encoding or transitions failed. |

`PARTIAL` and `UNSYNCED` are assurance states. A sensitive operation requires `ACTIVE + FULL`.

## 7. Versioning and compatibility

- Payload version is `1`; unknown versions are rejected.
- Event kind `30078` remains accepted for existing records.
- Event kind `1078` is a new public mirror; it is experimental and may be versioned separately.
- Removing the legacy mirror requires a future major migration.
- No registered DID method, W3C DID document or official NIP kind is claimed.

## 8. Security assumptions

- secp256k1 and SHA-256 are secure.
- The Nostr event signature is checked by `nostr-tools`.
- The BCH `signmessage` convention is implemented and tested against independent vectors.
- Relay sets can withhold or prune events; checkpoints detect known rollbacks only.
- No consensus, global ordering or economic finality is provided.
- No independent audit has been performed.
