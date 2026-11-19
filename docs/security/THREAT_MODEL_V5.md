# KYVERA V5 Threat Model

**Date:** 2026-11-19
**Scope:** protocol records, public discovery, BCH proofs, lifecycle resolution, relying-party authentication, SDK and wallet adapter
**Status:** implementation threat model, not a formal audit

---

## 1. Assets

- Nostr identity key (never exported by KYVERA).
- BCH private key (never exported by KYVERA).
- Canonical signed records and lifecycle history.
- Current authorized BCH destination.
- Relying-party challenges and sessions.
- User privacy (identity-to-wallet linkage).

## 2. Trust boundaries

1. Browser ↔ wallet (WizardConnect / manual signing).
2. Browser/server ↔ Nostr relay.
3. Record ↔ chain resolver.
4. Verifier ↔ relying party.
5. SDK consumer ↔ remote relay set.
6. Demo store ↔ process restart (file-backed RP example).

## 3. Threats and controls

| # | Threat | Control | Test / evidence | Residual risk |
| --- | --- | --- | --- | --- |
| 1 | Forged BCH signature | Recover key and compare hash160 to P2PKH payload | `tests/binding.test.ts`, `tests/security-challenge.test.ts` | None in model |
| 2 | Forged Nostr signature | BIP-340 event verification + author/subject equality | `tests/security-challenge.test.ts` | None in model |
| 3 | Wrong BCH address | Proof domain binds address + record digest | `tests/rotation.test.ts` | None in model |
| 4 | Cross-identity key substitution | Subject/author equality, chain subject check | `tests/chain.test.ts` | None in model |
| 5 | Malformed canonical JSON | KCJ-1 byte equality, duplicate keys rejected | `tests/security-challenge.test.ts` | None in model |
| 6 | Duplicate protocol tags | Exactly-one checks for `d`, `k`, `s`, `seq`, `prev` | `tests/security-challenge.test.ts`, `tests/discovery-format.test.ts` | None in model |
| 7 | Unauthorized rotation | Current-key BCH proof required | `tests/rotation.test.ts` | A compromised current key can rotate |
| 8 | Rotation after revocation | Revoke terminates chain; later records rejected | `tests/revocation.test.ts` | None in model |
| 9 | Conflicting branches | Same-sequence duplicate returns `CONFLICT`, no address | `tests/rotation.test.ts`, lab equivocation | A verifier seeing one branch cannot detect |
| 10 | Missing lifecycle record | Sequence gap returns `STALE`, no fallback | `tests/relay.test.ts` | Relay set can hide both sides |
| 11 | Replay of old records | Hash-linked sequence; replay cannot move head backwards | `tests/revocation.test.ts` | Old record remains valid history |
| 12 | Replayed auth challenge | Challenge consumed before verification | `tests/auth-request.test.ts` | None in single-process store |
| 13 | Challenge expiration | TTL and clock-skew checks | `tests/auth-request.test.ts` | Clock drift |
| 14 | Session reuse after rotation | Re-resolve at validation; address change rejects | `tests/auth-request.test.ts`, `pnpm rp:persist` | Relay withholding |
| 15 | Session reuse after revocation | Revoked status rejects session | `tests/auth-request.test.ts`, `pnpm rp:persist` | Relay withholding |
| 16 | Relay withholding | Multi-relay query, `PARTIAL`/`STALE`, checkpoint | `tests/relay.test.ts`, `pnpm rp:demo` | Uniform withholding undetectable without checkpoint |
| 17 | Partial synchronization | Sensitive policy requires `FULL` | `tests/auth-request.test.ts` | None in policy |
| 18 | Rollback to old checkpoint | Checkpoint mismatch → `STALE`/`CONFLICT` | `tests/relay.test.ts` | First-time verifier has no checkpoint |
| 19 | Malformed relay events | Signature/kind/content/tag validation; rejected list | `tests/relay.test.ts`, `tests/security-challenge.test.ts` | Relay may send arbitrary bytes |
| 20 | Resource exhaustion | 16 KiB content limit, schema/depth limits, per-relay timeouts | `tests/security-challenge.test.ts` | No global rate limiting |
| 21 | Oversized payloads | Length checks and canonical schema | `tests/property.test.ts` | Relay bandwidth |
| 22 | Invalid sequence transition | Transition matrix validation | `tests/chain.test.ts` | None in model |
| 23 | Unsupported protocol version | Version check rejects unknown | `tests/security-challenge.test.ts` | Future migration required |
| 24 | NIP-78 AUTH/privacy lockout | Public kind 1078 mirror; both kinds queried | `tests/discovery-format.test.ts` | Public relay retention unverified |
| 25 | Addressable replacement collapse | Unique `d` per record; regular mirror | `tests/discovery-format.test.ts` | Relay pruning |
| 26 | Duplicate envelopes create fork | De-duplicate by recordId | `tests/discovery-format.test.ts` | None after de-dup |
| 27 | Wallet address presented as signature | Capability model; `signMessage:false` for WizardConnect | `tests/wallet-adapter.test.ts` | Manual signature required |
| 28 | Wrong-network wallet proof | Network check before recovery | `tests/wallet-adapter.test.ts` | None in model |
| 29 | Private key leakage | No private key in records/events/bundles/SDK output | `tests/sdk.test.ts` evidence check | Browser compromise |
| 30 | Session store loss on restart | File-backed RP store | `pnpm rp:persist` | Single-process only |

## 4. Out of scope

- Global Nostr consensus or complete-history proofs.
- Key recovery after loss of all authorized keys.
- Threshold or witness-assisted recovery.
- Production session database, rate limiting, WAF or key management.
- CashToken/on-chain identity commitments.
- Real-wallet signing interoperability until a physical-wallet test exists.
- Independent audit.
