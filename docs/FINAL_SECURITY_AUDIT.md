# KYVERA Final Security Audit

**Date:** 2026-11-19
**Scope:** audit began at `6cc811f`; fixes in `dfb0023`; fail-closed hardening in `02c2512`; release in `2f16977`
**Type:** internal red-team review and reproducible test audit
**Not:** an independent third-party security audit, a formal verification, or a warranty

This document treats earlier reports as claims and re-checks them against source,
tests, local relays, a production build, a fresh clone and a public-relay probe.
No mainnet transaction was broadcast and no external Nostr event was published.

---

## 1. Evidence boundary

| Category | Status | Evidence |
| --- | --- | --- |
| **Verified locally** | Yes | 136 unit/integration/security tests; typecheck; production build; 56 browser checks; `pnpm rp:demo` 10/10; local relay tests; fresh clone of `2f16977` with `--frozen-lockfile`, test and build |
| **Verified with real wallets** | No | No Paytaca, Cashonize or Selene device/extension was available; no wallet-produced signature was recorded |
| **Verified on public relays** | Partial | Read-only probe: `wss://relay.damus.io` failed, `wss://nos.lol` connected and answered a kind-30078 query. No KYVERA event was published |
| **Verified in production** | Yes, limited | Public Vercel deployment at https://kyvera-alpha.vercel.app; HTTPS smoke covers routes, headers, video and bundle. No real-wallet or public-relay publication. |
| **Untested / blocked** | Yes | Wallet pairing, message signing, account switching, wrong network, rejection, mainnet payment, public-relay retention, third-party integration |

---

## 2. Findings summary

| ID | Severity | Finding | Status |
| --- | --- | --- | --- |
| H-01 | HIGH | BCH/Nostr key-reuse check bypassed for external-wallet and uncompressed BCH keys | **Fixed** |
| H-02 | HIGH | Browser relying party authenticated against a cached resolution | **Fixed** |
| H-03 | HIGH | Revoked address could be reported as SUPERSEDED after A→B→A→revoke | **Fixed** |
| H-04 | HIGH | First-contact relay withholding can hide a newer rotation or revocation | **Open / partially mitigated** |
| H-05 | HIGH | PARTIAL relay sync accepted for payment and session validation | **Fixed (fail-closed)** |
| H-06 | HIGH | Real-wallet pairing and message signing are unverified | **Blocked** |
| H-07 | HIGH | Default production relay set/public retention; failed-relay WebSocket crash | **Partially fixed** |
| H-08 | HIGH | KYVERA Pay is a BIP21 handoff, not a wallet-approved transaction/receipt | **Open (bounty gap)** |
| M-01 | MEDIUM | Auth challenges/sessions are in-memory and not durable | Open |
| M-02 | MEDIUM | WizardConnect has no account-change/network event in the integration | Open |
| M-03 | MEDIUM | Demo private keys live in `localStorage`; CSP allows inline script | Open (demo-only) |
| M-04 | MEDIUM | WizardConnect LGPL metadata is `Unknown`; notices were missing | **Fixed (docs)** |
| M-05 | MEDIUM | Discovery depends on relay tag-filter and retention behavior | Open |
| M-06 | MEDIUM | No independent audit, SBOM or formal verification | Open |
| M-07 | MEDIUM | Accessibility is only partially tested | Open |
| L-01 | LOW | Canonicalization normalizes string values but not object keys | Open; schema exact keys mitigate |
| L-02 | LOW | `pnpm install` leaves a broken package bin until packages are built | Open |
| L-03 | LOW | Address lookup lets ACTIVE outrank another binding's CONFLICT/STALE | Open |
| L-04 | LOW | Public address discovery has no result bound/rate limit | Open |

No **CRITICAL** findings were confirmed.

---

## 3. High findings

### H-01 — Key-reuse check bypass (fixed)

**Files/functions**

- `packages/bch/src/identity.ts` — `verifyBchIdentityProof`
- `packages/bch/src/signmessage.ts` — `sameSecp256k1Key`

**Scenario**

The protocol requires the BCH and Nostr keys to be distinct. The old check only
ran when the optional `bch.publicKey` was declared. External-wallet binds publish
`publicKey: null`, so a reused secret key passed verification. The helper also
compared only compressed 66-hex keys, so a reused key producing an uncompressed
65-byte BCH signature bypassed the check even when `publicKey` was present.

**Impact**

A user could bind the same secp256k1 key as both the BCH and Nostr identity,
violating the separation requirement and weakening the “two independent keys”
claim.

**Evidence**

New tests in `tests/security-challenge.test.ts`:

- `rejects an external-wallet bind that reuses the Nostr key`
- `rejects an uncompressed BCH proof that reuses the Nostr key`

Both regression tests exercise the previously accepted cases and pass with the fix (part of 136/136).

**Fix**

`verifyBchIdentityProof` now checks the **recovered** public key against the
Nostr subject for every proof, independent of `publicKey`. `sameSecp256k1Key`
compares the x-coordinate for both compressed (`02/03…`) and uncompressed
(`04…`) BCH keys.

**Regression tests**

`tests/security-challenge.test.ts` (15 tests), plus existing `tests/binding.test.ts` and `tests/rotation.test.ts`.

---

### H-02 — Stale authorization in browser auth flows (fixed)

**Files/functions**

- `apps/web/app/auth-demo/page.tsx` — `signIn`
- `apps/web/app/challenge/page.tsx` — `authenticateLive`

**Scenario**

Both flows held an `IdentityResolution` from an earlier resolve. If the identity
rotated or was revoked between resolution and sign-in, the signature could be
verified against the stale `ACTIVE` state and a session issued.

**Impact**

A relying party could authenticate a superseded wallet after rotation, or a
revoked identity, until the page was manually refreshed.

**Evidence**

`tests/auth-request.test.ts` already demonstrates that an address mismatch and
revoked/stale resolution are rejected. The UI path did not call it with fresh
state. Browser QA covers the normal and rotated flows; the specific race is
code-reviewed rather than timed in the browser.

**Fix**

Both flows now call `refreshIdentity(...)` immediately before building/verifying
the auth event, and use the fresh resolution. `/challenge` also re-resolves before
publishing a live rotation. Dashboard and auth-demo rotate/revoke actions now
re-resolve before using a head.

**Regression tests**

`tests/auth-request.test.ts`, `tests/security-challenge.test.ts`, `/challenge` and `/auth-demo` browser checks.

---

### H-03 — Revoked address misclassified (fixed)

**Files/functions**

- `packages/verifier/src/discovery.ts` — `addressStatus`

**Scenario**

If an identity rotated A→B→A and then revoked, the same address A appeared in
`superseded` twice: an early historical entry (`replacedBy: B`) and the final
revoked entry (`replacedBy: "revoked"`). The old code used `.find()`, so it
returned the first entry and labelled the revoked address **SUPERSEDED**.

**Impact**

`/verify?address=…` could tell a payer that a revoked address was merely
historical, understating the risk.

**Evidence**

New relay-backed test in `tests/relay.test.ts`:
`reports a revoked address that appeared earlier as REVOKED, not SUPERSEDED`.
The test exercises the A→B→A→revoke path; the old `.find()` logic would have selected the first A entry, while the latest-entry fix returns REVOKED.

**Fix**

Use the latest supersession entry for the address (reverse search), so the final
revocation wins.

**Regression tests**

`tests/relay.test.ts` (14 tests).

---

### H-04 — First-contact rollback / hidden revocation (open, partially mitigated)

**Files/functions**

- `packages/verifier/src/discovery.ts` — `resolveIdentity` (`checkpoint`)
- `apps/web/app/pay/page.tsx` — `prepareHandoff`
- `apps/web/lib/pay.ts` — `destinationChanged`

**Scenario**

A relay set that withholds a newer rotation or revocation and returns the prior
valid `ACTIVE` chain is indistinguishable from a genuinely quiet identity on
first contact. Payment can show the old address as current.

**Impact**

A payer may hand off payment to an address that was rotated away or revoked.
This is the fundamental off-chain history-completeness limitation; no local
protocol change can prove that a relay set is not withholding newer events.

**Mitigation added**

`/pay` now snapshots the observed head `(sequence, recordId)` and passes it as a
checkpoint on re-resolution. A rollback of a previously seen head, or a different
record at the same head, cancels the intent. Test added in `tests/pay.test.ts`.

**Residual risk**

A revocation that was never observed before cannot be detected by a local
checkpoint. Colluding relays returning a consistent old chain remain possible.

**Recommended fix**

Persist checkpoints across sessions, require multiple independent relay
operators, require a confirmation/freshness delay for high-value payments, and
use a wallet or indexer that confirms the recipient’s current authorization at
broadcast time.

---

### H-05 — PARTIAL sync accepted for payment and sessions (fixed, fail-closed)

**Files/functions**

- `apps/web/lib/pay.ts` — `checkPayable`
- `packages/verifier/src/auth.ts` — `verifyAuthRequestEvent`, `validateAppSession`
- `apps/web/lib/challenge.ts` — `proveSuperseded`
- `apps/web/app/challenge/page.tsx` — live Verify/Prove results
- `apps/web/components/resolution.tsx` — UI status badge

**Scenario**

If one of several configured relays returned an older chain and another was
unreachable, `assurance` was `PARTIAL`. Payment returned `ok: true` with a
warning, authentication/session validation accepted the stale address, and the
UI labelled the chain “Current authorization.”

**Impact**

A stale or censoring relay could preserve an old payment destination or session
while the relay set was only partially available.

**Fix**

Sensitive actions now fail closed:

- Payment requires `ACTIVE` **and** `assurance === "FULL"`; otherwise
  `PARTIAL_SYNC`.
- Auth request verification returns `IDENTITY_PARTIAL` for `PARTIAL`.
- Session validation returns `SESSION_PARTIAL`.
- `UNSYNCED`, `STALE`, `CONFLICT`, `REVOKED`, `INVALID` and other non-ACTIVE
  statuses remain blocked.
- Live challenge Verify/Prove require `FULL`; partial results say current
  authorization is not final.
- Resolution UI shows `ACTIVE · not final` and “Reported current under partial
  sync” instead of “Current authorization” when assurance is not FULL.

Independent historical-record verification remains available:
`verifyEventRecord` and the Time Machine still verify individual proofs even when
the current chain is `STALE`/`CONFLICT`/`REVOKED`. Regression:
`keeps historical proof verification available when current state is STALE`.

**Evidence**

- `tests/pay.test.ts` — `fails closed on partial relay synchronization`.
- `tests/auth-request.test.ts` — `requires FULL relay agreement for authentication and session validation`.
- `tests/security-challenge.test.ts` — historical-proof/STALE test.
- `tests/relay.test.ts` — partial sync and unreachable relay tests.

**Residual**

A caller using the offline SDK with a bare `ChainResolution` (no `assurance`)
is treated as a local proof, not a networked current-state assertion. Networked
relying parties must pass `assurance` from `resolveIdentity`.

---

### H-06 — Real-wallet integration unverified (blocked)

**Files/functions**

- `apps/web/app/create/page.tsx`
- `apps/web/lib/wallet.ts` — `deriveWalletAddress`
- `docs/WALLET_UX_AUDIT.md`, `docs/WALLET_DEVICE_TEST.md`

**Scenario**

No physical Paytaca, Cashonize or Selene installation was available. Pairing
approval, wallet-produced message signatures, account switching, wrong network,
rejection and disconnection remain untested.

**Impact**

Do not claim wallet interoperability. The automatic address path is only known to
work against the library and local derivation.

**Evidence**

Source review of Paytaca (`sign/message.vue` uses the same compact signature
format) and Cashonize (WizardConnect transaction signing only). No live signature
row exists.

**Recommended fix**

Execute `docs/WALLET_DEVICE_TEST.md` on real devices and record the evidence
before claiming compatibility.

---

### H-07 — Production relay configuration / public retention (partially fixed)

**Files/functions**

- `apps/web/lib/config.ts` — production relay fallback
- `packages/nostr/src/relay.ts` — relay transport
- `scripts/relay-health.mjs`, `scripts/post-deploy-smoke.mjs`
- `docs/VERCEL_DEPLOYMENT.md`, `docs/PUBLIC_RELAY_TEST.md`

**Scenario**

The old production fallback included `relay.damus.io` and `nos.lol`. Read-only
probing found relays fail intermittently, and a failed `wss://` connection could
emit an unhandled WebSocket error that crashed the Node client. Public
kind-30078 retention was not verified.

**Impact**

A deployment could fail closed unexpectedly, show console errors, or rely on a
relay that later disappears. Public history retention remains an external risk.

**Evidence (read-only, 2026-11-19)**

```text
wss://nos.lol              ok=true  eose=true
wss://relay.primal.net     ok=true  eose=true
wss://relay.snort.social   ok=true  eose=true
wss://offchain.pub         ok=true  eose=true
wss://relay.damus.io       ok=true  eose=true (failed in an earlier probe)
wss://relay.nostr.band     ok=false timeout
wss://nostr.wine           ok=false connection failed
```

The unhandled WebSocket crash was reproduced while probing the failing
candidates and fixed with a no-op `error` listener wrapper in
`packages/nostr/src/relay.ts` (`safeWebSocket`).

**Fix**

- Production fallback is now `wss://nos.lol,wss://relay.primal.net`; both answered
  a read-only kind-30078 probe.
- Relay list remains configurable through `NEXT_PUBLIC_KYVERA_RELAYS`.
- `pnpm relay:health <urls>` checks reachability and EOSE without publishing.
- `pnpm smoke:deploy` checks deployed routes, headers, console errors and rejects
  a bundle containing a local relay.
- Sensitive actions fail closed unless every configured relay responds.

**Residual**

A public deployment now exists, but no public KYVERA event was published, so retention over time and relay-set completeness remain **unverified**. Run `docs/PUBLIC_RELAY_TEST.md`
only with explicit authorization.

---

### H-08 — KYVERA Pay is a BIP21 handoff (open)

**Files/functions**

- `apps/web/app/pay/page.tsx` — `prepareHandoff`, handoff UI
- `docs/KYVERA_PAY.md`

**Scenario**

The app verifies the destination and produces a BIP21 URI/QR. It does not build
or broadcast a transaction, receive a txid, or display a wallet-approved
transaction result.

**Impact**

The “wallet-approved transaction / actual result” part of the brief is not
implemented. Do not claim a completed on-chain payment or receipt.

**Evidence**

The UI and docs explicitly state that the wallet broadcasts and KYVERA does not
receive the txid. No transaction test exists.

**Recommended fix**

Integrate a wallet transaction path only with a sound UTXO/source-output source
and a chipnet test flow, then display the signed/broadcast result. This is a
product feature and was not added during the audit.

---

## 4. Medium and low findings

### M-01 — In-memory auth state

`AuthRequestService` keeps challenges and sessions in `Map`s. A restart loses
challenges (safe denial) and sessions (forced logout); multiple instances cannot
share state. Atomic single-use is safe in one JS thread but not a multi-process
deployment. Persist challenge IDs/session hashes with TTL and atomic consume.

### M-02 — No WizardConnect account-change signal

`useWizardConnect` exposes `state`, `manager`, `walletName`, `uri` and `error`, not
an account-change event. The derived address may remain displayed after the
wallet switches accounts until a reconnect/re-render. Test it manually.

### M-03 — Demo keys in localStorage / CSP

`apps/web/lib/store.ts` stores throwaway demo Nostr/BCH private keys in
`localStorage`. `apps/web/next.config.mjs` production CSP still allows
`'unsafe-inline'` scripts. Any XSS could read demo keys. Do not store real keys;
move to a nonce-based CSP when the Next runtime permits.

### M-04 — Third-party licenses

`@wizardconnect/*` is LGPL-3.0-or-later upstream, but npm metadata reports
`Unknown`. `THIRD_PARTY_NOTICES.md` was added; legal review is still required
before commercial redistribution.

### M-05 — Relay tag-filter dependence

Discovery uses `#k` and `#b` filters (`packages/nostr/src/relay.ts`). Relays that
do not index these tags may return incomplete history, surfacing as `STALE` /
`UNKNOWN`. This is safe but may reduce availability. Verify each production relay.

### M-06 — No independent audit/SBOM

`pnpm audit --prod` is clean, but there is no SBOM, signed build, reproducible
build attestation or independent review. This document is not a substitute.

### M-07 — Accessibility

A browser probe found no unnamed `button`/`a` controls on `/`, `/challenge`,
`/merchant`, `/create`, `/pay`, `/auth-demo`, `/developers`; keyboard focus and
reduced-motion checks pass. Full screen-reader, contrast and zoom testing was not
performed.

### M-09 — Failed relay WebSocket error crash (fixed)

`packages/nostr/src/relay.ts` now installs `safeWebSocket`, a wrapper that keeps a
no-op `error` listener on the underlying socket after nostr-tools clears its own
`onerror` during timeout/close. A failed `wss://` probe now returns a structured
`ok:false` report instead of crashing Node. Verified by re-running the
multi-relay read-only probe, including failing candidates.

### L-01 — Canonical key normalization

`packages/core/src/canonical.ts` normalizes string values to NFC but not object
keys. Protocol records use an exact ASCII key set, so this is not exploitable in
v1; document it for future schemas.

### L-02 — Install-time bin warning

`pnpm install --frozen-lockfile` warns that the `kyvera-verify` bin points to an
unbuilt `dist/cli.js`. Running `pnpm build` or `pnpm cli` resolves it. It is a
packaging polish issue.

### L-03 — Address status priority

`STATUS_PRIORITY` in `packages/verifier/src/discovery.ts` ranks `ACTIVE` before
`CONFLICT`/`STALE` across multiple identities that share an address. This is
acceptable when the address is genuinely active for one binding, but the UI
should always show all bindings. Review before relying on a single status.

### L-04 — Unbounded address query

`resolveAddress` queries `#b` events without a result cap. A hostile relay can
return a large event set. Add a cap/timeout before production.

---

## 5. Cryptographic review

- **Canonicalization:** KCJ-1 rejects floats, `undefined`, unsafe integers,
  non-plain objects, duplicate/whitespace JSON and non-NFC strings; published
  content must equal canonical bytes exactly. Exact key sets are enforced.
- **Domain separation:** BCH proofs sign
  `KYVERA/v1/bch-proof\nrole:…\naddress:…\nrecord:<digest>`; Nostr events sign the
  canonical record; auth requests commit to origin, session, subject, address,
  protocol and expiry through a digest tag. No cross-protocol signature reuse
  was found.
- **BCH format:** `hash256("\x18Bitcoin Signed Message:\n" + compactSize + message)`,
  65-byte compact recoverable signatures, compressed/uncompressed headers
  accepted only when hash160 matches the P2PKH payload. Key reuse is now checked
  on the recovered key.
- **Nostr format:** kind 30078, BIP-340 signature verified on a fresh copy,
  `created_at = issuedAt`, canonical content, and exact `d`/`k`/`s`/`seq`/`prev`
  tags. Duplicate protocol tags are now rejected.
- **Chain:** genesis required; sequence +1; exact previous digest; monotonic
  `issuedAt`; current-key proof must match the prior address; rotations require
  a distinct new address and new-key proof; revocation ends the chain.
- **Conflicts:** competing genesis/sequence/branches return `CONFLICT`; missing
  segments return `STALE`; no silent fallback to an older binding.

---

## 6. Nostr retention review

- `packages/nostr/src/event.ts` uses a unique `d` tag:
  `kyvera:v1:<subject>:<sequence>:<payload digest>`.
- A test now asserts bind/rotate/revoke produce three distinct `d` tags.
- If a relay keeps only the latest addressable event, the verifier returns
  `STALE` / `MISSING_GENESIS` and asserts no active address. Test:
  `uses unique addressable d tags and detects latest-only history loss`.
- Local relay tests cover duplicate events, partial sync, unreachable relays and
  EOSE timeouts.
- Public relay retention of kind 30078 was **not** published/tested. `nos.lol`
  answered a read-only query; Damus failed. Do not claim public retention.

---

## 7. Authentication review

- 32-byte CSPRNG challenge; 120s request TTL; 900s session TTL.
- Origin, domain, session id, intended subject, expected address, protocol and
  expiry are committed in the signed request digest.
- Challenge is consumed on first successful verification; replay returns
  `UNKNOWN_CHALLENGE`.
- Expired, malformed, mismatched origin/session/subject/address and unauthorized
  rotation are rejected.
- Session validation rejects rotation (`SESSION_ADDRESS_CHANGED`), revocation
  (`SESSION_IDENTITY_REVOKED`), expiry and logout.
- Browser flows now re-resolve current authorization immediately before sign-in.
- **Residual:** in-memory state, PARTIAL sync policy, no multi-instance atomic
  consume.

---

## 8. Payment review

- `/pay` resolves the recipient, checks `ACTIVE`, network, P2PKH validity and
  relay assurance, then re-resolves before handoff.
- Destination changes cancel the intent; head rollback/checkpoint mismatch now
  cancels too.
- `checkPayable` blocks `REVOKED`, `CONFLICT`, `STALE`, `EXPIRED` and `UNSYNCED`.
- **Residual:** PARTIAL accepted; hidden newer revocation cannot be ruled out on
  first contact; BIP21 handoff has no transaction/txid.

---

## 9. Wallet review

- Automatic address derivation uses `getPubkey(0, 0n)` and P2PKH CashAddr.
- The address is labelled **address connected** until the pasted signature
  verifies; publishing is gated on the check and re-checks in
  `completeExternalBind`.
- WizardConnect has no message-signing action. Paytaca’s internal Sign Message
  format matches the expected 31+recovery header; Cashonize uses transaction
  signing only. No live wallet was available.
- Account switching, wrong network, rejection and disconnection remain untested.

---

## 10. Production, privacy and supply chain

- Public Vercel deployment is live at https://kyvera-alpha.vercel.app; HTTPS smoke passes. No real-wallet or public-relay publication was performed.
- Security headers exist in `next.config.mjs`; CSP allows inline scripts and
  broad `ws:`/`wss:` connections. Demo-only keys make this a demo risk, not a
  production key risk.
- No analytics or third-party tracking was found. No private keys are logged.
- `pnpm audit --prod`: 0 known vulnerabilities.
- History-wide secret scan: no tracked `nsec1`/`xprv`/private-key blocks or
  populated environment secrets (generated bundles excluded).
- Fresh-clone install/test/build is recorded in the GO/NO-GO document.

---

## 11. Reproduced test commands

```bash
pnpm install --frozen-lockfile
pnpm test                 # 136 tests, 13 files
pnpm typecheck
pnpm build                # 17 routes
pnpm qa:browser           # 56/56, 0 console/page errors
pnpm rp:demo              # 10/10, no KYVERA API/relay
pnpm audit --prod
```

Fresh clone of deployed commit `2f16977`: `pnpm install --frozen-lockfile` (non-fatal unbuilt-bin warning), `pnpm test` 136/136, `pnpm build` pass.

---

## 12. Conclusion

The locally testable core is internally consistent. Confirmed HIGH code defects
(H-01, H-02, H-03) were fixed with regression tests; H-05 now fails closed and
H-07 is partially fixed with tested relay defaults, health checks and a relay
transport error fix. The remaining HIGH risks are architectural or external:
first-contact relay withholding (H-04), real-wallet behavior (H-06), public-relay
retention/deployment (H-07) and the absence of a transaction-level payment flow
(H-08).

This is **not** an independent security audit, and it is **not** evidence of
production readiness or real-wallet compatibility.
