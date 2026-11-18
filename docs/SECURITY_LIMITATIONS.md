# Security Limitations

**Project:** KYVERA v1
**Date:** 2026-11-18

KYVERA is a hackathon prototype. This file lists what it does **not** protect against. It is part of the deliverable, not a disclaimer buried at the end.

---

## 1. Protocol limitations

### 1.1 No recovery

If the current BCH key and the Nostr key are both unavailable, the identity cannot be rotated or revoked. There is no recovery key, social recovery, threshold policy or escrow. This is intentional: adding a hidden recovery path would weaken the authorization policy and is not claimed.

A future version could define a pre-authorized recovery key, but users must then accept that the recovery key is an additional compromise target.

### 1.2 Rollback protection requires external state

A verifier with no prior knowledge cannot prove that a relay set is returning all records. A relay that withholds a newer rotation can make an older binding look current. KYVERA mitigates this with:

- querying multiple relays;
- per-relay assurance (`FULL` / `PARTIAL` / `UNSYNCED`);
- `STALE` when history is incomplete or no relay responds;
- an optional checkpoint on `(sequence, recordId)` that detects rollback and history rewriting.

It does **not** claim absolute rollback protection. Checkpoints work only if the caller retains the last verified head. A first-time verifier trusts the relay set it queries to be complete.

### 1.3 Relay retention

Off-chain records live on relays. Relays may prune, censor or lose events. A verifier that cannot retrieve a link in the chain reports `STALE` and refuses to present an older address as active. There is no protocol-level guarantee that history remains retrievable.

### 1.4 Equivocation is visible, not prevented

The subject can sign two different valid records at the same sequence. KYVERA reports `CONFLICT` and refuses to assert a current address. It cannot prevent the equivocation or force all verifiers to see both branches.

### 1.5 Public metadata

Records publicly link a Nostr key to BCH addresses, timestamps and lifecycle events. There is no selective disclosure, encryption or anonymity. Address reuse and timing correlation are observable by anyone with relay access.

### 1.6 No on-chain commitment

v1 proofs are entirely off-chain. A verifier relies on relay availability and its own clock. The `wc-tx` pattern used by prior art (a non-broadcastable transaction committing to the message) could add an independent timestamp/anchor but is not implemented.

### 1.7 Key policy trade-offs

| Policy | Consequence |
| --- | --- |
| Rotation requires the current BCH key | Losing it blocks rotation |
| Revocation requires the current BCH key | Losing it blocks revocation |
| The Nostr key is required for every transition | Losing it freezes the identity |
| No timeout-based recovery | Lost keys are permanent |

These are documented consequences, not bugs.

### 1.8 v1 scope excludes

- multisig and P2SH addresses;
- hardware-wallet PSBT signing flows;
- CashTokens and on-chain identity commitments;
- DIDs and W3C Verifiable Credentials;
- third-party attestations, reputation and portable credentials;
- sending BCH to an npub;
- privacy-preserving selective disclosure;
- post-quantum signatures.

---

## 2. Implementation limitations

### 2.1 P2PKH and `signmessage` only

BCH control is proven by a compact recoverable ECDSA signature over the Bitcoin Signed Message hash. Only P2PKH CashAddrs are accepted. This means:

- a P2SH/multisig wallet cannot produce a valid proof;
- token-aware addresses are rejected;
- wallet-specific differences in the message prefix or encoding are not abstracted beyond the standard convention.

### 2.2 Live wallet interoperability is not verified

The format matches the convention used by Electron Cash, Cashonize and Paytaca, and an independent `nostr-bch-bind` vector is verified in `tests/interop.test.ts`. However, no signature was produced by a live wallet in this workspace. Do not claim "tested with Electron Cash" until that is done.

KYVERA Pay integrates WizardConnect and opens a real pairing dialog, but no physical wallet was available to complete pairing or payment. KYVERA Pay is a BIP21 handoff: it does not construct/broadcast a transaction and does not receive a txid. Do not claim transaction-level payment or a receipt.

A related prior-art observation: Paytaca's extension reportedly mis-encoded message lengths above 252 bytes (paytaca/paytaca-app#831, fixed in #832). KYVERA keeps proof messages short (~150 bytes) but has not independently re-tested that wallet build.

### 2.3 Demo key and session storage

The browser demo stores throwaway Nostr and BCH private keys in `localStorage` so rotation and revocation can be demonstrated in one tab. This is **not** a secure keystore:

- any XSS or malicious extension can read them;
- they survive browser restarts;
- they are not encrypted;
- they must never hold funds.

NIP-07 and external-wallet modes avoid storage; the demo mode is clearly labelled in the UI and README.

`/auth-demo` is an independent relying-party demonstration. Its pending challenges and sessions are held in memory for the page lifecycle; a production relying party must persist used challenge IDs and sessions for the TTL, bind them to a server-side session, and protect them from theft. The cryptographic verification itself is real; the session store is demo infrastructure.

### 2.4 No audit

No independent security review, formal verification or external fuzzing campaign has been performed. The chain state machine has 128 automated tests, including property-based canonicalization/chain fuzzing and adversarial cases, but tests cannot prove the absence of bugs.

### 2.5 Dependency risk

The implementation depends on `@bitauth/libauth`, `nostr-tools`, `ws` (Node), and the Next.js/React stack. A compromise in any dependency could affect signing or verification. There is no SBOM, reproducible-build attestation or dependency signature verification. The project deliberately avoids custom elliptic-curve code.

### 2.6 Browser and runtime coverage

- UI E2E was run only in Chrome via Playwright.
- Safari, Firefox and mobile layouts were not exercised.
- Node 20.17 was used; older Node versions are not supported.
- The Next.js client build emits a top-level-await warning from `libauth`; older browsers may fail.

### 2.7 Demo relay

`scripts/local-relay.mjs` is not a production relay:

- no rate limiting or authentication;
- no NIP-11 relay information document;
- no pruning or persistence guarantees beyond a JSON snapshot;
- single process, in-memory index;
- accepts only NIP-01 EVENT/REQ/CLOSE.

### 2.8 Performance and availability

- The web app resolves on every page load and has no cache or service worker.
- Relay queries are parallel but unbounded in count; a large relay list could be slow.
- There is no retry/backoff policy, relay reputation or failover logic.
- No load, memory or long-running soak tests were performed.

### 2.9 Time handling

- Records more than 600 seconds in the future are rejected.
- Transitions require strictly increasing `issuedAt`.
- Challenges allow 120 seconds of clock skew.
- A verifier with a substantially wrong clock can misclassify a record. No trusted time source is built in.

### 2.10 Error handling

Malformed input is expected to return structured errors, not throw. Tests cover many malformed cases, but no exhaustive fuzzing of JSON, tag arrays, base64 or CashAddr inputs was performed.

---

## 3. Operational limitations

- **No deployment.** The app was built and run locally; there is no public URL.
- **No demo video.** Required by the bounty; not recorded.
- **No public repository push.** The work is committed locally only; pushing requires explicit authorization.
- **No bounty submission.** Not performed.
- **No mainnet transactions.** Addresses are real-format but unfunded; no BCH was spent.
- **No monitoring or logging.** The demo does not emit telemetry.
- **No privacy policy or terms.** The app is a technical prototype.

---

## 4. Threat-model assumptions that may not hold

| Assumption | If false |
| --- | --- |
| SHA-256 and secp256k1 are secure | Complete compromise |
| The user's device and signer are uncompromised | Keys can be stolen; no protocol defence |
| Relays cannot forge signatures | Forgery is already cryptographically prevented |
| At least one queried relay is honest or complete | The verifier may be stale or misled |
| The verifier's clock is roughly correct | Timestamp and challenge windows misbehave |
| Users inspect what their wallet signs | A malicious signer can sign a different payload |
| Demo keys never hold value | Local storage theft becomes financially relevant |

---

## 5. What would be required for production

1. Independent security audit and formal review of the chain state machine.
2. Live wallet interoperability tests on mainnet/chipnet with Electron Cash, Cashonize and Paytaca.
3. A production keystore (hardware wallet or NIP-46 remote signer); no localStorage keys.
4. A recovery policy with explicit, documented authorization and tests.
5. Checkpoint storage and a strategy for first-contact trust.
6. Relay diversity, retention monitoring, retries and DoS protections.
7. A stable published package, versioning policy and migration plan.
8. Privacy design for selective disclosure and metadata minimization.
9. Browser and mobile compatibility testing.
10. Operational monitoring, incident response and a funded security budget.

None of these are claimed as complete.

---

## 6. Honest summary

KYVERA demonstrates a defensible lifecycle model and a working verifier. It does not solve decentralized identity recovery, relay completeness, wallet interoperability or production key management. The code and documentation say so explicitly, and the UI never presents a mock or unverified state as active.
