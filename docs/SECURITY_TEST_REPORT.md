# Security Test Report

**Project:** KYVERA v1
**Date:** 2026-11-18
**Environment:** macOS 27.2 (Apple Silicon), Node.js 20.17.0, pnpm 9.15.9, Vitest 2.1.9, Next.js 15.5.29, Chrome (Playwright 1.65.1, `channel: chrome`)
**Status:** all automated suites pass. This is not an independent security audit.

---

## 1. Summary

| Check | Result |
| --- | --- |
| `pnpm test` | **136 / 136 tests pass** across 13 files |
| `pnpm typecheck` | **pass** for core, bch, nostr, verifier and web |
| `pnpm build` | **pass** (Next.js production build; one third-party top-level-await warning) |
| `pnpm demo:lifecycle` | **all assertions pass** (6 lifecycle scenarios) |
| Browser end-to-end | **pass** (56/56 checks: create → challenge demo/live → merchant rotation → pay handoff → auth-demo session → tutorial video → time machine → verify → auth → revoke, WizardConnect dialog, mobile, reduced motion, warm light, keyboard; 0 console errors) |
| Deterministic vectors | **byte-identical on regeneration** (`sha256 074af1d4…`) |
| Independent BCH interop vector | **pass** (signature from `nostr-bch-bind v1`) |
| CLI end-to-end against local relay | **pass** (exit code 0 for ACTIVE and SUPERSEDED) |

No failing tests were skipped or silenced. There is no mock verification path.

---

## 2. Commands and results

```text
$ pnpm test
 ✓ tests/vectors.test.ts (5 tests)
 ✓ tests/chain.test.ts (9 tests)
 ✓ tests/binding.test.ts (17 tests)
 ✓ tests/auth.test.ts (11 tests)
 ✓ tests/revocation.test.ts (9 tests)
 ✓ tests/rotation.test.ts (15 tests)
 ✓ tests/interop.test.ts (2 tests)
 ✓ tests/property.test.ts (12 tests)
 ✓ tests/auth-request.test.ts (13 tests)
 ✓ tests/security-challenge.test.ts (16 tests)
 ✓ tests/pay.test.ts (12 tests)
 ✓ tests/smoke.test.ts (1 test)
 ✓ tests/relay.test.ts (14 tests)
 Test Files  13 passed (13)
      Tests  136 passed (136)
   Duration  ~2.7s
```

```text
$ pnpm typecheck
packages/core      Done
packages/bch       Done
packages/nostr     Done
packages/verifier  Done
apps/web           Done
```

```text
$ pnpm build
packages/core      Done
packages/bch       Done
packages/nostr     Done
packages/verifier  Done
apps/web           Done (9 static/dynamic routes)
```

Build warning: `@bitauth/libauth` uses top-level await. Next's client bundle emits a warning that the configured target may not support async/await. The application was exercised end-to-end in current Chrome; older browsers are not claimed. This is a third-party packaging warning, not a test failure.

```text
$ pnpm demo:lifecycle
1. Genesis binding                      ok
2. Rotation: A authorizes B             ok
3. Unauthorized rotation rejected       ok
4. Revocation by current keys           ok
5. Stale relay rollback detection       ok
6. Conflicting histories                ok
All checks passed.
```

---

## 3. Test inventory

### 3.1 Binding (`tests/binding.test.ts` — 17)

| Case | Expected |
| --- | --- |
| Valid dual-signature bind | accept |
| Nostr and BCH keys are distinct | accept |
| Altered BCH signature | reject (`BCH_SIGNATURE_INVALID` / `NOT_BY_ADDRESS`) |
| BCH proof from a different wallet | reject |
| Signature over a different payload digest | reject |
| Declared BCH key does not control address | reject (`BCH_PROOF_KEY_MISMATCH`) |
| Malformed subject key (uppercase) | reject (`SUBJECT_INVALID`) |
| Unsupported signature format | reject (`BCH_PROOF_SIGNATURE_SHAPE`) |
| Event edited after signing | reject (`NOSTR_SIGNATURE_INVALID`) |
| Invalid Nostr signature | reject |
| Non-canonical JSON with valid Nostr sig | reject (`CONTENT_NOT_CANONICAL`) |
| Future-dated record | reject (`ISSUED_IN_FUTURE`) |
| Nostr key reused as BCH key | reject (`KEY_REUSE`) |
| Wrong network | reject (`BCH_NETWORK_UNEXPECTED`) |
| Exact key recovery from wallet format | accept |
| Valid signature presented for another address | reject |
| Missing / extra proof on bind | reject (`PROOF_ROLE_MATRIX`) |

### 3.2 Rotation (`tests/rotation.test.ts` — 15)

| Case | Expected |
| --- | --- |
| Valid rotation by current + new + Nostr | accept, address changes, old `SUPERSEDED` |
| Current-role proof by unauthorized key | reject |
| Missing new-key proof | reject |
| Wrong `previous` reference | verify as record, resolve `CONFLICT` (`CHAIN_FORK`) |
| Replayed rotation / bind | dedupe, state unchanged |
| Two rotations at the same sequence | `CONFLICT` (`SEQUENCE_EQUIVOCATION`) |
| Stolen Nostr key rotating without old BCH key | reject |
| Forged transition payload | reject (`PROOF_ADDRESS_MISMATCH`) |
| Rotation to the same address | reject (`ROTATION_ADDRESS_REUSED`) |
| Second rotation signed with superseded key | reject |
| Current proof address does not match chain | verify as record, resolve `INVALID` (`CURRENT_PROOF_MISMATCH`) |
| Transition after revocation | `CONFLICT` (`TRANSITION_AFTER_REVOKE`) |
| Non-monotonic `issuedAt` | `INVALID` (`TIME_NOT_MONOTONIC`) |
| Skipped sequence | `STALE` (`MISSING_CHAIN_SEGMENT`) |
| Record remains independently valid when chain is not | accept record, reject state |

### 3.3 Revocation (`tests/revocation.test.ts` — 9)

| Case | Expected |
| --- | --- |
| Valid revocation by Nostr + current BCH | `REVOKED`, no active address |
| Unauthorized BCH proof | reject |
| Missing BCH proof (Nostr only) | reject |
| Old binding replayed after revocation | stays `REVOKED` |
| Revocation after rotation | revokes the new wallet; history preserved |
| Revocation by a key not current in chain | `INVALID` |
| Expiry | `EXPIRED`, last address visible |
| Competing revocations | `CONFLICT` |
| Historical address lookup | returns the superseded step |

### 3.4 Chain and discovery (`tests/chain.test.ts` — 9, `tests/relay.test.ts` — 14)

| Case | Expected |
| --- | --- |
| No events | `UNKNOWN` |
| No verifiable events | `INVALID` with rejections |
| Wrong network | `INVALID` |
| Two genesis bindings | `CONFLICT` (`GENESIS_EQUIVOCATION`) |
| Only a transition | `STALE` (`MISSING_GENESIS`) |
| Event order shuffled | identical state |
| Records from another subject | rejected (`SUBJECT_MISMATCH`) |
| Orphaned higher sequence | `STALE`/`CONFLICT`, no active address |
| Publish/query | `ACTIVE`, `FULL` assurance |
| Duplicate events | deduped |
| One relay unreachable | Resolution `ACTIVE`, `PARTIAL`; payment/auth blocked |
| All relays unreachable | `STALE`, `UNSYNCED`, no address |
| No relays configured | `STALE` |
| Rollback with checkpoint | `STALE` (`ROLLBACK_DETECTED`) |
| Conflicting chains on two relays | `CONFLICT` |
| Malformed KYVERA event from hostile relay | rejected, good state retained |
| Relay without EOSE | Resolution `ACTIVE`, `PARTIAL`; payment/auth blocked |
| Address current / superseded / revoked | `ACTIVE` / `SUPERSEDED` / `REVOKED` |
| Address with no binding | `UNKNOWN` |
| One address, two identities | both bindings reported, `ACTIVE` |
| Malformed address | `INVALID`, no query |

### 3.5 Authentication (`tests/auth.test.ts` — 11)

The older `/auth` page tests the core challenge-response primitive. The full relying-party journey is covered separately by `tests/auth-request.test.ts` (13): origin/session/intended-identity/address binding, whole-request digest, replay, expiry, unauthorized signer, revoked/stale identity, session invalidation after rotation/revocation/logout, and the unauthorized-rotation fixture.

| Case | Expected |
| --- | --- |
| Valid fresh challenge | authenticated |
| Replayed response | `UNKNOWN_CHALLENGE` |
| Expired challenge | `CHALLENGE_EXPIRED` |
| Wrong domain | `DOMAIN_MISMATCH` |
| Wrong challenge | `CHALLENGE_MISMATCH` |
| Unrelated signer | `SUBJECT_MISMATCH` |
| Revoked identity | `IDENTITY_REVOKED` |
| Stale identity | `IDENTITY_STALE` |
| Expected address mismatch | `ADDRESS_MISMATCH` |
| Event edited after signing | `EVENT_SIGNATURE` |
| Outside time window | `TIMESTAMP_OUT_OF_WINDOW` |

### 3.6 Security challenge suite (`tests/security-challenge.test.ts` — 16)

Explicit adversarial cases:

| Case | Expected |
| --- | --- |
| BCH proof signed by a different wallet | `BCH_SIGNATURE_NOT_BY_ADDRESS` |
| Tampered Nostr event | `NOSTR_SIGNATURE_INVALID` |
| Unauthorized rotation | rejected; wallet A remains current |
| Replayed login challenge | `UNKNOWN_CHALLENGE` |
| Expired login challenge | `CHALLENGE_EXPIRED` |
| Revoked identity + session | `REVOKED`; `SESSION_IDENTITY_REVOKED` |
| Missing chain segment | `STALE` / `MISSING_CHAIN_SEGMENT`; head stays at the last known sequence |
| Conflicting sequence records | `CONFLICT` / `SEQUENCE_EQUIVOCATION` |
| Rollback against a checkpoint | `STALE` / `ROLLBACK_DETECTED` |
| Payment destination not ACTIVE or changed | blocked / intent cancelled |
| Challenge signed by an unrelated key | `SUBJECT_MISMATCH` |

### 3.7 Vectors and interoperability

- `tests/vectors.test.ts` (5): canonical encodings, wallet message hash, record ids/digests, six chain outcomes.
- `tests/interop.test.ts` (2): verifies a BCH `signmessage` signature published by the independent `nostr-bch-bind v1` implementation; rejects the same signature over a different message.

### 3.8 Property-based and malformed-input tests (`tests/property.test.ts` — 12)

| Property | Runs | Assertion |
| --- | --- | --- |
| Canonical JSON idempotence | 150 | `canonicalize(parse(canonicalize(v))) === canonicalize(v)` and `isCanonicalJson` accepts it |
| Insertion-order independence | 100 | Reversing object key insertion order produces identical bytes |
| Unicode NFC | 100 | A string and its NFC form canonicalize identically |
| Float/non-finite rejection | 50 + edges | Floats, `NaN`, `Infinity`, unsafe integers and `undefined` throw |
| Numeric edges | edge | `-0` normalizes to `0`; safe integer bounds accepted; overflow rejected |
| Duplicate keys / whitespace | edge | `{"a":1,"a":2}` and non-minified JSON are rejected |
| Depth/size bounds | edge | 40-deep nesting throws; 200KB string remains bounded |
| Chain subset fuzz | 60 | Any subset/order of real events never throws; status is in the enum |
| Active-address invariant | 70 | `activeBch` is non-null only for `ACTIVE`/`EXPIRED`; conflict/stale/invalid/revoked are null |
| Chain integrity | 50 | Every accepted history has sequence 0..n, correct `previous`, and individually verifiable events |
| Malformed event metadata | 100 | Arbitrary id/pubkey/tags/content/sig never throws in parser or verifier |
| Oversized content | edge | A correctly signed 20KB content is rejected with `CONTENT_LENGTH` |

Fast-check seeds are randomized per run; failures print a reproducible counterexample. Runs are bounded to keep the suite under a few seconds.

---

## 4. Adversarial coverage matrix (bounty brief categories)

| Brief category | Covered by | Status |
| --- | --- | --- |
| Valid dual-signature binding | binding | ✅ |
| Invalid BCH signature | binding | ✅ |
| Invalid Nostr signature | binding | ✅ |
| Mismatched signed payloads | binding, rotation | ✅ |
| Malformed public keys | binding | ✅ |
| Incorrect address association | binding | ✅ |
| Unsupported signature format | binding | ✅ |
| Expired challenge | auth | ✅ |
| Replayed challenge | auth | ✅ |
| Valid authorized rotation | rotation | ✅ |
| Rotation by unauthorized key | rotation | ✅ |
| Missing new-wallet proof | rotation | ✅ |
| Incorrect previous-state reference | rotation | ✅ |
| Duplicate sequence | rotation | ✅ |
| Replayed rotation | rotation | ✅ |
| Forged transition | rotation | ✅ |
| Conflicting authorized updates | rotation | ✅ |
| Valid revocation | revocation | ✅ |
| Unauthorized revocation | revocation | ✅ |
| Revoked binding presented as active | revocation, chain | ✅ |
| Historical proof after rotation | rotation, revocation, lifecycle demo | ✅ |
| Expired binding | revocation | ✅ |
| Conflicting state history | revocation, chain | ✅ |
| Missing relay response | relay | ✅ |
| Malformed Nostr event | chain, relay | ✅ |
| Invalid event signature | binding, relay (client layer) | ✅ |
| Duplicate events | relay | ✅ |
| Conflicting relay results | relay | ✅ |
| Stale relay returning old binding | relay (checkpoint) | ✅ with checkpoint; limitation stated |
| Partial synchronization | relay | ✅ |
| Event ordering manipulation | chain, relay | ✅ |

---

## 5. Browser end-to-end evidence

Executed with Playwright (`scripts/qa-browser.mjs`) against `localhost:3000` and the local relay `ws://127.0.0.1:7777`. **56/56 checks passed, 0 console/page errors.**

Flow:

1. Landing renders; the embedded lifecycle instrument runs the real resolver and switches between bind/rotate/revoke.
2. Guided `/demo` resolves deterministic fixtures, shows rotation, unauthorized rejection and revocation.
3. `/lab` executes all six scenarios; equivocation returns `CONFLICT`, withheld history returns `STALE`; advanced mode exposes the signed input events.
4. `/interop` verifies the independent BCH vector.
5. Create page exposes Connect → Sign → Verified → Publish states, opens the WizardConnect pairing dialog, and defaults to Connect Wallet. The Demo tab still generates real keys, displays the proof/event preview, publishes, and stores a local demo identity. The Paste path rejects an invalid signature automatically, keeps publishing locked, then verifies a real wallet-style signature, unlocks publishing and publishes a second binding.
6. `/challenge` guided demo authenticates, rejects unauthorized rotation, and proves that wallet A's historical proof remains valid while its authorization is superseded.
7. `/challenge` live mode resolves a stored identity and issues a relying-party session from a single-use challenge.
8. `/merchant` verifies a self-asserted merchant, unlocks the payment destination, rotates the wallet, moves the destination to wallet B and reports wallet A superseded.
9. Dashboard renders the Time Machine; selecting the genesis record and switching to cryptographic mode exposes the payload digest and exact BCH proof message; Compare mode shows historical validity beside current authorization.
10. KYVERA Pay resolves an active identity, enforces payment policy, accepts an amount/confirmation and produces a BIP21 handoff; WizardConnect opens a pairing dialog.
11. `/auth-demo` resolves an identity, issues an origin/session/identity-bound request, signs with the local demo key, issues a session, rejects replay, invalidates the session after rotation and after logout, and blocks a revoked identity.
12. Rotation publishes sequence 1; the historical record reports `SUPERSEDED`.
13. Public verifier resolves the identity and renders the Time Machine.
14. Address lookup for the old address returns `SUPERSEDED`.
15. Challenge-response authentication succeeds with the demo key.
16. Revocation publishes sequence 2 and the verifier returns `REVOKED`; Pay and auth-demo block the identity.
17. Mobile viewport (390×844): landing, demo, lab, create, pay, challenge and merchant have no horizontal overflow.
18. Reduced motion: transitions collapse to ~0ms.
19. Warm-light theme toggles via `data-theme`.
20. Keyboard: Tab reaches navigation links with a visible focus target.
21. `/tutorial` renders both MP4 players with posters, native controls and WebVTT caption tracks; muted playback advances `currentTime` without errors.

Screenshots: `.context/screens/qa/01-landing.png` … `13-pay-revoked.png` (gitignored, local evidence).

The standalone `demo/kyvera-standalone.html` was also loaded from `file://`, executed all six scenarios and exposed advanced input events with zero console errors.

---

## 6. Determinism

`pnpm vectors` regenerates `tests/fixtures/vectors.json` from fixed keys and fixed nonces. Two consecutive runs produced byte-identical output:

```text
074af1d4a86d03bbc084e69b1e230f38e011992b  tests/fixtures/vectors.json
074af1d4a86d03bbc084e69b1e230f38e011992b  tests/fixtures/vectors.json
```

BIP-340 signing normally uses auxiliary randomness; the vector generator uses fixed all-zero auxiliary randomness so signatures are reproducible. Verifiers accept any valid Schnorr signature.

---

## 7. Not tested / unresolved

| Item | Risk | Status |
| --- | --- | --- |
| Live Electron Cash / Cashonize / Paytaca signing | Wallet-specific message prefix/encoding differences | **Not tested**; format cross-verified against an independent vector |
| Mainnet transactions | No funds were spent; no transactions are part of the protocol | Not applicable to v1 proofs |
| Real public relay retention and pruning | `STALE` behaviour may appear in practice | Simulated via fixtures, not observed on public relays |
| Relay collusion showing one branch | Undetectable without checkpoints | Documented limitation |
| Mobile browsers and Safari/Firefox | UI and WebSocket differences | Only Chrome exercised |
| Denial of service / rate limiting | Relay and app availability | Out of scope for the prototype |
| Supply chain / dependency audit | Build integrity | No SBOM or audit; minimal dependency set |
| XSS against demo localStorage | Demo keys are throwaway | Labelled demo-only; no funds |
| Independent security review | Unknown bugs | **Not performed** |

---

## 8. History-wide secret scan

A manual scan across all 32 commits checked tracked paths and patches for private keys, seed phrases, `xprv`/WIF material, credential files and populated environment secrets.

- No `.env`, `.env.local` or credential file is tracked; only `.env.example` and production example values.
- All tracked `NEXT_PUBLIC_*` values are public build-time configuration.
- Demo keys are labelled throwaway keys in `localStorage` and are not funded.
- The repository is still private; a dedicated secret scanner and independent review are still recommended before making it public.

## 9. Conclusion

Within the tested scope, the implementation behaves as specified: valid dual-key bindings are accepted, unauthorized lifecycle transitions are rejected, historical addresses are not presented as current, revoked identities cannot authenticate, and incomplete or conflicting history is surfaced rather than hidden.

These results do **not** constitute a security guarantee. The protocol and implementation are hackathon prototypes and must not be used to protect real funds without an independent review, live wallet testing, and a production key-management design.
