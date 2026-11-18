# Release Security Audit

**Date:** 2026-11-18
**Baseline:** `ff3e69d` + release-candidate working tree
**Scope:** canonical serialization, signature verification, authorization-chain parsing, relay freshness, checkpoint rollback detection, revocation, demo key handling, HTTP/bundle surface, dependencies.

This is a self-audit by the implementation team, not an independent security review.

---

## 1. Results

| Area | Check | Result |
| --- | --- | --- |
| Canonical JSON | Sorted keys, no whitespace, NFC, safe integers only | Pass |
| Canonical JSON | Rejects floats, NaN, Infinity, unsafe integers, `undefined` | Pass |
| Canonical JSON | Rejects duplicate keys and non-canonical text | Pass |
| Canonical JSON | Depth bound (32) and 200KB input remain bounded | Pass |
| Canonical JSON | 150-run idempotence property + order independence | Pass |
| BCH signature | Recovers key, `hash160(key) == P2PKH payload` | Pass |
| BCH signature | Compressed/uncompressed headers 27–34 | Pass |
| BCH signature | Independent `nostr-bch-bind` vector | Pass |
| Key separation | Rejects same x-only key across BCH/Nostr | Pass |
| Nostr signature | Fresh-copy Schnorr/id verification (no cached verify flag) | Pass |
| Chain | Sequence 0 genesis, `previous` digest, +1 transitions | Pass |
| Chain | Forks/duplicate sequences → `CONFLICT`, no address | Pass |
| Chain | Missing genesis/link → `STALE`, no fallback | Pass |
| Chain | Rotation without current/new proof rejected | Pass |
| Chain | Transition after revocation rejected | Pass |
| Revocation | Requires current BCH + Nostr; terminal | Pass |
| Relay | Partial sync → `PARTIAL`; no EOSE handled | Pass |
| Relay | No relays → `STALE`/`UNSYNCED`, no address | Pass |
| Relay | Malformed KYVERA event rejected, good state retained | Pass |
| Checkpoint | `ROLLBACK_DETECTED`, `CHECKPOINT_MISMATCH` | Pass |
| Demo keys | Throwaway only, labelled, no funds | Pass with stated risk |
| Client bundle | No `nsec1`/private-key blocks | Pass |
| Client bundle | Production default relays are public | Pass |
| Client bundle | Localhost appears only in explicit demo CLI commands | Pass |
| Dependencies | `pnpm audit --prod` | **0 vulnerabilities** after override |
| HTTP headers | CSP, HSTS, nosniff, frame deny, referrer, permissions | Pass (production tested) |
| WASM | CSP permits `WebAssembly.instantiate` | Pass after adding `'wasm-unsafe-eval'` |

---

## 2. Findings and fixes during release

### F-1 — CSP blocked WebAssembly (high impact, fixed)

The first production CSP (`script-src 'self' 'unsafe-inline'`) caused the client to crash with:

> `WebAssembly.instantiate(): Compiling or instantiating WebAssembly module violates ... 'unsafe-eval' is not an allowed source`

`libauth` uses WebAssembly in the browser. Fixed by adding `'wasm-unsafe-eval'` to `script-src`. Production browser smoke tests now pass with zero console errors.

### F-2 — Transitive PostCSS advisories (high/moderate, fixed)

`next@15.5.29` pins `postcss@8.4.31`; `pnpm audit --prod` reported 2 high + 2 moderate advisories (path traversal / arbitrary file read via source maps, CSS stringify XSS). Added a pnpm override:

```json
"pnpm": { "overrides": { "postcss": "8.5.33" } }
```

`pnpm audit --prod` now reports **0 vulnerabilities**; the production build and browser suite pass with the override. This is a build-time dependency in Next, but removing known advisories is the correct default.

### F-3 — Production fallback pointed at localhost (medium, fixed)

The production client could default to `ws://127.0.0.1:7777` if no environment variable was set. Changed to a production fallback of `wss://relay.damus.io,wss://nos.lol`, while development keeps the local relay. Production bundle scan now finds localhost only in explicit demo/CLI instructional text.

### F-4 — Demo assertions and fixture labelling (low, fixed earlier)

Deterministic fixtures now show `LOCAL FIXTURE · NO RELAY QUERIED` rather than `FULL 0/0 RELAYS`. No real view presents fixture data as live evidence.

---

## 3. Dependency audit details

Command: `pnpm audit --prod`

Final result:

```text
No known vulnerabilities found
```

The lockfile is committed. The only override is `postcss@8.5.33`, applied to resolve the advisories above. No dependency has post-install scripts beyond esbuild's binary installer (development only).

Residual supply-chain risk: no SBOM, no reproducible-build attestation, no dependency signing. Dependencies are intentionally minimal: `@bitauth/libauth`, `nostr-tools`, `ws` (Node only), Next/React, Tailwind (build).

---

## 4. Demo key handling

- Demo Nostr and BCH seeds are generated at runtime in the browser; only throwaway `localStorage` entries are created.
- The UI labels demo mode, warns about browser storage, and generates unfunded addresses.
- Deterministic lab keys are derived from public labels (`"kyvera test key: …"`); they are explicitly unspendable. They are not secrets and should never be funded.
- External wallet mode never receives a private key; the user pastes a signature only.
- No secret exists in `.env.example`, `NEXT_PUBLIC_*` variables, or the client bundle.

**Residual risk:** XSS or a malicious extension can read localStorage demo keys. This is acceptable only because they are throwaway and unfunded; production clients must use NIP-07/WizardConnect or a secure keystore.

---

## 5. Relay and freshness review

- Each relay is queried independently with a connection timeout and EOSE timeout.
- `FULL` requires every configured relay to answer and EOSE; otherwise `PARTIAL`.
- Zero responders forces `STALE`/`UNSYNCED` and clears `activeBch`.
- Duplicate events dedupe by id; `recordId` dedupes equivalent signed records.
- The client never trusts the `b`/`d` discovery tags alone; it resolves the full chain by author.
- A relay that withholds a newer record is undetectable without a checkpoint; the optional `(sequence, recordId)` checkpoint detects a known rollback or a rewritten history.
- No claim of absolute rollback protection is made in the UI or docs.

---

## 6. Residual risks (unchanged)

- No recovery if all authorized keys are lost.
- No absolute rollback protection without a checkpoint.
- Relay collusion/withholding can still mislead a first-contact verifier.
- P2PKH only; no multisig/hardware-wallet/CashTokens.
- No live wallet compatibility recorded.
- No independent audit.
- Demo localStorage is not a keystore.
- Mainnet Track requirements (live demo, WizardConnect/XO, mainnet transaction) are not met.

---

## 7. Recommendation

From a code/security standpoint, the release candidate is coherent and passes its full suite, production build, CSP/browser smoke test and dependency audit. It is **not** a production security guarantee and **not** Mainnet Track eligible as-is.

Manual actions still required before submission are listed in `RELEASE_CHECKLIST.md`.
