# Paytaca Bounty Compliance Matrix

**Date:** 2026-11-18
**Project:** KYVERA
**Bounty:** BCH Blaze 2026 · Paytaca Decentralized Identity ($500 PUSD)
**Source:** https://bchblaze.cash/bounties/decentralized-identity/

This matrix records evidence for the full user journey, not merely the existence of primitives. The authentication demonstration is an independent relying party at `/auth-demo`; it never asks KYVERA for a login decision.

---

## 1. Requirement 1 — Identity creation & management

> "Users hold their own keys and link a BCH wallet identity with a Nostr identity, with no centralized identity provider or custodial service."

| Evidence | Location |
| --- | --- |
| Create browser-local keys or NIP-07 signing; automatic WizardConnect address retrieval plus verified `signmessage`; manual paste fallback | `/create`, `apps/web/lib/identity.ts` |
| Binding, rotation, revocation construction | `packages/verifier/src/create.ts` |
| No KYVERA account/backend; no private key transmission | UI copy, architecture docs, bundle scan |
| Automated | `tests/binding.test.ts`, `tests/rotation.test.ts`, `tests/revocation.test.ts` |
| Browser | QA check "create page publishes a binding" |

**Status: demonstrated.**

---

## 2. Requirement 2 — Cryptographic identity binding

> "A verifiable link between the BCH and Nostr identities, backed by proofs of control over both, without exposing private keys or reusing the same key across both."

| Evidence | Location |
| --- | --- |
| Canonical KCJ-1 record and strict schema | `packages/core/src/canonical.ts`, `schema.ts` |
| BCH `signmessage` recovery and address association | `packages/bch/src/signmessage.ts`, `identity.ts` |
| Nostr BIP-340 event signature | `packages/nostr/src/event.ts` |
| Distinct-key enforcement (`KEY_REUSE`) | `packages/verifier/src/record.ts`, `tests/binding.test.ts` |
| Independent BCH vector | `tests/interop.test.ts` |
| Property/fuzz | `tests/property.test.ts` |
| Browser | `/demo`, `/lab`, create flow |

**Status: demonstrated.**

---

## 3. Requirement 3 — Decentralized discovery

> "Third parties can find identity data through Nostr or another decentralized method, with enough information to verify the link, and without relying on a proprietary database."

| Evidence | Location |
| --- | --- |
| NIP-78 kind 30078 events, `d`/`k`/`b`/`s` tags | `packages/nostr/src/event.ts` |
| Multi-relay queries, per-relay reports, partial sync | `packages/nostr/src/relay.ts`, `packages/verifier/src/discovery.ts` |
| Address discovery and subject discovery | `packages/verifier/src/discovery.ts` |
| Automated | `tests/relay.test.ts` (13), `tests/chain.test.ts` |
| Browser | `/verify` resolves from relays; relay panel shows per-relay status |

**Status: demonstrated.**

---

## 4. Requirement 4 — Verification & authentication

> "Independent applications can verify the association and authenticate users (e.g. via challenge-response) without contacting a central authority."

The compliance gate is implemented at `/auth-demo` and `packages/verifier/src/auth.ts`.

### 4.1 Full authentication journey

| Gate step | Implementation | Evidence |
| --- | --- | --- |
| Random single-use challenge | 32-byte CSPRNG challenge; service consumes on success | `createAuthRequest`, `AuthRequestService`; `tests/auth-request.test.ts` "rejects replay" |
| Short expiry | 120s request; 900s session | `tests/auth-request.test.ts` "rejects an expired request" |
| Bind origin | `request.origin`; event `relay` tag; `expectedOrigin` | "rejects a different origin" |
| Bind relying-party session | Random `sessionId`; event `session` tag; `expectedSessionId` | "rejects a different origin or session context" |
| Bind intended identity | `expectedSubject`; event author; resolution subject | "rejects an event intended for another identity" |
| Bind intended BCH address | `expectedAddress`; re-checked against `activeBch` | "rejects an event intended for another identity or address" |
| Bind protocol context | `kyvera-auth-request-v1` + whole-request digest tag | `verifyAuthRequestEvent`, request digest tests |
| Sign without private-key disclosure | Demo local signer, NIP-07 path, external wallet path | `/auth-demo`; no key export |
| Verify public-key signature | Fresh-copy Schnorr verification | `verifyAuthRequestEvent`; "rejects unauthorized signer" |
| Resolve BCH–Nostr association independently | Same `resolveIdentity` chain verifier as `/verify` | `refreshIdentity`, chain tests |
| Enforce current authorization | `status === ACTIVE` required | "rejects revoked and stale identities" |
| Enforce relay freshness | `UNSYNCED` rejected; `PARTIAL` allowed | `validateAppSession`, `checkPayable` equivalents |
| Reject malformed | Tag/shape checks; structured errors | tests/verifier |
| Reject mismatched | Origin/session/subject/address/digest checks | tests |
| Issue session only on success | `issueAppSession` called after successful verification | `tests/auth-request.test.ts` "issues a session" |
| Logout / invalidation | `AuthRequestService.logout`, session map removal | "invalidates a session after … logout" |
| Failure after revocation | Session invalidated; sign-in unavailable | "invalidates a session after rotation, revocation…"; browser QA |
| Failure after unauthorized rotation | Forged record rejected; auth for attacker address returns `ADDRESS_MISMATCH` | "does not issue a session for an unauthorized rotation attempt"; `/auth-demo` negative check |
| No centralized authority | Challenge/session state is local to the RP; identity state resolved from relays | `docs/ARCHITECTURE.md`, `/auth-demo` copy |

### 4.2 Authentication evidence

- Automated: `tests/auth-request.test.ts` — 12 tests, including replay, expiry, origin/session/identity/address mismatch, revoked/stale, session rotation/revocation/logout, unauthorized rotation.
- Browser: `/auth-demo` session issuance, replay rejection, unauthorized-rotation check, session invalidation after rotation, logout, revoked-identity block (43/43 browser checks overall).
- The relying party is separate from the identity dashboard and has its own origin/session state.
- NIP-07 signing path is implemented; demo local signer is exercised; physical wallet signing is not yet recorded.

**Status: demonstrated (local signer and browser journey).** NIP-07/external-wallet proof remains a manual interoperability test.

---

## 5. Requirement 5 — Working demonstration & documentation

> "A working prototype covering the above, plus source code, setup instructions, and documentation of the architecture and verification process."

| Deliverable | Location |
| --- | --- |
| Working app | `/create`, `/demo`, `/verify`, `/auth-demo`, `/lab`, `/pay` |
| Source | monorepo packages/apps |
| Setup | `README.md`, `docs/DEPLOYMENT.md` |
| Architecture | `docs/ARCHITECTURE.md`, README Mermaid |
| Verification process | `docs/PROTOCOL.md`, `/verify`, CLI |
| Auth process | `docs/PAYTACA_COMPLIANCE.md`, `packages/verifier/src/auth.ts` |
| Judge script | `docs/JUDGE_DEMO_SCRIPT.md` |
| Independent offline demo | `demo/kyvera-standalone.html` |

**Status: demonstrated locally; public deployment pending.**

---

## 6. Stretch goals status

| Stretch goal | Status | Evidence |
| --- | --- | --- |
| Key rotation/recovery with verifiable authorization | Rotation demonstrated; recovery not claimed | `tests/rotation.test.ts`; `/demo` |
| Identity-based BCH payments | Verified BIP21 handoff, no txid/in-app broadcast | `/pay`, `docs/KYVERA_PAY.md` |
| Reusable libraries/spec | SDK + CLI + protocol spec | packages, `docs/PROTOCOL.md` |
| Attestations/VCs/reputation | Not implemented | — |
| On-chain commitments | Not implemented | — |

---

## 7. Remaining compliance risks

1. Public deployment and Mainnet Track eligibility are unresolved (`SUBMISSION_ELIGIBILITY.md`).
2. Physical wallet authentication/signing was not available; the demo signer and NIP-07 path are implemented.
3. Session state is local/in-memory for the demo; production RPs must persist challenges and sessions.
4. No independent security audit.
5. Repository is currently private.

No requirement above is marked complete solely because a primitive exists; authentication is demonstrated end to end in the browser at `/auth-demo`.
