# BCH Blaze 2026 — Paytaca Decentralized Identity Bounty Requirements

**Research date:** 2026-11-18
**Official bounty page:** https://bchblaze.cash/bounties/decentralized-identity/
**Hackathon page:** https://dorahacks.io/hackathon/bchblaze2026
**Full specification link on the bounty page:** https://docs.google.com/document/d/161UkJvxh3bdSYZi0ky-rZNyhgYOf595Fpopo9iDN2yw/edit
**Prize:** $500 PUSD, sponsored by Paytaca
**Contact listed on page:** Paytaca Telegram group

The Google Doc was not read directly (access/link may require a browser session). This document records the publicly visible bounty page text and marks anything that needs confirmation. Do not treat this file as a substitute for the official rules.

---

## 1. Deadline and eligibility

| Item | Official/public text | Status |
| --- | --- | --- |
| Hackathon dates | DoraHacks event timeline: **deadline 2026/11/22 14:00 UTC** (= 19:30 IST). Site footer still says "Nov 14 – 28". | DoraHacks is authoritative; **22 Nov 2026, 19:30 IST confirmed** |
| Workspace brief | 22 November 2026, 19:30 IST | Matches DoraHacks |
| Registration | "Register on DoraHacks"; pre-registration 2026/10/10, submission opens 2026/11/13 | Not performed in this workspace |
| Eligibility | Mainnet Track: developers worldwide, individuals or teams of 2–4; must register and submit a valid project | Not independently verified for this entry |
| Submission platform | DoraHacks BUIDL; organizer is currently reviewing Builds | Not submitted |
| Licensing/IP | Bounty page does not state additional terms | Repository is MIT |
| Network | Identity bounty does not mandate mainnet; the Mainnet Track does require at least one BCH mainnet transaction | Demo uses mainnet-format unfunded addresses; no mainnet transaction performed |

### 1.1 Mainnet Track requirements (from the DoraHacks Tracks page)

These are separate from the Paytaca bounty requirements and are a **submission risk** if KYVERA is entered in the Mainnet Track:

- short presentation based on the BCH Blaze "Widget Factory" template;
- original or significantly improved during the hackathon;
- **at least one feature involving sending a BCH mainnet transaction**;
- **live, usable demo** reachable by a website link;
- **WizardConnect integration** for BCH wallet connection;
- at least one representative attended a BLAZE preparation stream;
- confirmation in the BCH BLAZE Telegram channel.

The Paytaca bounty page also says: "A focused proof of concept covering binding, discovery, verification and authentication is sufficient." That may govern bounty judging, but it does **not** waive the track-level requirements. Confirm with the organizers which requirements apply to a bounty-only entry.

**Important platform finding:** the DoraHacks "Bounties" tab says **"No Bounties — There are no Bounties for this hackathon."** The Paytaca bounty is listed on bchblaze.cash, not DoraHacks. There is therefore no confirmed bounty-only submission path on DoraHacks. This is a critical ambiguity; see [`SUBMISSION_ELIGIBILITY.md`](SUBMISSION_ELIGIBILITY.md).

**Action required before submission:** confirm the deadline, eligibility, and submission fields on DoraHacks, and resolve whether the Mainnet Track's live demo, WizardConnect and mainnet-transaction requirements apply to this bounty entry.

**Action required before submission:** confirm the exact deadline, eligibility, and submission fields on DoraHacks. The discrepancy above is recorded rather than resolved by assumption.

---

## 2. Mandatory requirements (verbatim intent from the official page)

### R1 — Identity creation & management

> "Users hold their own keys and link a BCH wallet identity with a Nostr identity, with no centralized identity provider or custodial service."

**Mandatory.** No custodial service, no KYVERA account, no backend-held keys.

### R2 — Cryptographic identity binding

> "A verifiable link between the BCH and Nostr identities, backed by proofs of control over both, without exposing private keys or reusing the same key across both. Simply listing a BCH address in a Nostr profile does not count."

**Mandatory.** Both keys must prove control; keys must be distinct; private keys must not be transmitted.

### R3 — Decentralized discovery

> "Third parties can find identity data through Nostr or another decentralized method, with enough information to verify the link, and without relying on a proprietary database."

**Mandatory.** Nostr relay discovery; no proprietary database.

### R4 — Verification & authentication

> "Independent applications can verify the association and authenticate users (e.g. via challenge-response) without contacting a central authority."

**Mandatory.** Independent verification and a challenge-response flow.

### R5 — Working demonstration & documentation

> "A working prototype covering the above, plus source code, setup instructions, and documentation of the architecture and verification process."

**Mandatory.** Runnable demo, source, setup, architecture and verification docs.

### Stretch goals (official page)

> "Send BCH or CashTokens to someone via their identity, without manually exchanging addresses."
> "Third-party attestations / verifiable credentials…"
> "Reputation that is portable across applications."
> "Key rotation and recovery with independently verifiable authorization."
> "Privacy-preserving selective disclosure…"
> "Reusable libraries, APIs or protocol specs that wallets and Nostr clients can adopt."
> "BCH transactions or CashTokens used as identity commitments, where they clearly improve on off-chain proofs."

### Evaluation criteria (official page)

> "Submissions are evaluated on technical correctness, security, decentralization, interoperability, usability and demo quality."

Additional note:

> "Build on existing open standards rather than inventing proprietary mechanisms. Good starting points include Nostr NIPs, BCH signatures & transactions, CashTokens, DIDs and W3C Verifiable Credentials."

> "A focused proof of concept covering binding, discovery, verification and authentication is sufficient."

---

## 3. Implementation status against each requirement

Status values: **Implemented** (code + automated evidence), **Partial** (works but a stated gap remains), **Not started**, **Not verified**.

| ID | Requirement | Status | Implementation | Verification evidence | Remaining gap |
| --- | --- | --- | --- | --- | --- |
| R1 | Self-custodial identity creation and management | Implemented | `apps/web/app/create/page.tsx`, `apps/web/lib/identity.ts`, `packages/verifier/src/create.ts` | Browser E2E create flow; `tests/binding.test.ts` | Demo keys live in browser localStorage; explicitly labelled, not production custody |
| R2 | Dual-key binding, distinct keys, no private-key exposure | Implemented | `packages/bch/src/signmessage.ts`, `packages/core/src/schema.ts`, `packages/verifier/src/record.ts` | `tests/binding.test.ts` (17 tests), `tests/interop.test.ts` (independent BCH vector) | Live wallet test outstanding |
| R3 | Decentralized discovery with enough data to verify | Implemented | `packages/nostr/src/event.ts`, `packages/nostr/src/relay.ts`, `packages/verifier/src/discovery.ts` | `tests/relay.test.ts` (13 tests), `pnpm demo:lifecycle` | Relays may prune history; documented as `STALE` |
| R4 | Independent verification and challenge-response auth | Implemented | `packages/verifier/src/record.ts`, `.../discovery.ts`, `.../auth.ts`, `packages/verifier/src/cli.ts` | `tests/auth.test.ts` (11), `tests/chain.test.ts` (9), CLI E2E | Challenge store is in-memory; production persistence documented |
| R5 | Working demo + source + setup + architecture/verification docs | Implemented | `apps/web`, `scripts/local-relay.mjs`, `scripts/seed-demo.ts`, `docs/` | Browser E2E (11 screens), `pnpm demo:lifecycle`, build | Deployment, public repo push and video not done |
| S1 | Key rotation and recovery with independently verifiable authorization | Rotation implemented; recovery explicitly not claimed | `createRotateRecord`, `resolveChain`, dashboard controls | `tests/rotation.test.ts` (15), lifecycle demo | Recovery policy is future work; docs state no recovery |
| S2 | Reusable libraries / protocol spec | Implemented | `packages/core`, `bch`, `nostr`, `verifier`; `docs/PROTOCOL.md`; CLI | Build, tests, `pnpm cli` | Not yet published to npm |
| S3 | Send BCH via identity | Not started | — | — | Explicitly P2, not attempted |
| S4 | Third-party attestations / VCs | Not started | — | — | Future work |
| S5 | Portable reputation | Not started | — | — | Future work |
| S6 | Privacy-preserving selective disclosure | Not started | — | — | Future work |
| S7 | On-chain identity commitments | Not started | — | — | `wc-tx`-style proof listed as future work |

---

## 4. Traceability matrix

### 4.1 Requirement → source → tests → demo

| Requirement | Primary source files | Tests | Demo step |
| --- | --- | --- | --- |
| R1 create identity | `apps/web/app/create/page.tsx`, `apps/web/lib/identity.ts` | `tests/binding.test.ts` | Create page: generate keys, preview, publish |
| R1 manage lifecycle | `apps/web/app/identity/[npub]/page.tsx`, `packages/verifier/src/create.ts` | `tests/rotation.test.ts`, `tests/revocation.test.ts` | Dashboard: rotate / revoke |
| R2 canonical binding | `packages/core/src/canonical.ts`, `.../schema.ts`, `.../record.ts` | `tests/vectors.test.ts`, `tests/binding.test.ts` | Create page payload preview |
| R2 BCH proof | `packages/bch/src/signmessage.ts`, `.../identity.ts` | `tests/binding.test.ts`, `tests/interop.test.ts` | "BCH proof message" panel |
| R2 Nostr proof | `packages/nostr/src/event.ts` | `tests/binding.test.ts` | Signed event preview |
| R2 key separation | `packages/bch/src/signmessage.ts` (`sameSecp256k1Key`), `packages/verifier/src/record.ts` | `tests/binding.test.ts` "rejects reuse" | UI generates independent keys |
| R3 event publication | `packages/nostr/src/event.ts`, `.../relay.ts` | `tests/relay.test.ts` | Publish button + relay report |
| R3 discovery | `packages/verifier/src/discovery.ts` | `tests/relay.test.ts` | Verify page resolves from relays |
| R3 conflict handling | `packages/core/src/chain.ts` | `tests/chain.test.ts`, `tests/rotation.test.ts` | Lifecycle demo step 6 |
| R3 stale handling | `packages/verifier/src/discovery.ts` | `tests/relay.test.ts` rollback/partial | Verify page assurance + relay table |
| R4 independent verifier | `packages/verifier/src/index.ts`, `.../cli.ts` | all suites plus CLI E2E | `pnpm cli npub1… --relay …` |
| R4 authentication | `packages/verifier/src/auth.ts` | `tests/auth.test.ts` | `/auth` page |
| R5 reproducible demo | `scripts/local-relay.mjs`, `scripts/seed-demo.ts`, `examples/identity-lifecycle/run.ts` | `pnpm demo:lifecycle` | Three-terminal demo in README §7 |
| R5 docs | `docs/*.md`, `README.md` | review | — |

### 4.2 Test → requirement coverage

| Test file | Tests | Covers |
| --- | --- | --- |
| `tests/binding.test.ts` | 17 | R2: valid binding, bad BCH/Nostr sig, wrong wallet, mismatched payload, malformed keys, key reuse, network, future timestamp, canonical encoding, proof matrix, independent vector recovery |
| `tests/rotation.test.ts` | 15 | S1: valid rotation, unauthorized current key, missing new proof, wrong previous, replay, equivocation, forged transition, same address, stale key, chain mismatch, after revocation, time monotonicity, sequence gap |
| `tests/revocation.test.ts` | 9 | S1: valid/unauthorized revocation, Nostr-only revocation, replayed binding, post-rotation revocation, wrong chain key, expiry, competing revocations, historical address |
| `tests/chain.test.ts` | 9 | R3: unknown/invalid, genesis conflict, missing genesis, order independence, subject isolation, orphan handling, record-vs-state |
| `tests/auth.test.ts` | 11 | R4: valid, replay, expiry, wrong domain/challenge, unrelated key, revoked, stale, address binding, tamper, window |
| `tests/relay.test.ts` | 13 | R3: publish/query, dedupe, partial sync, unreachable, no relays, rollback checkpoint, conflicting chains, hostile event, no EOSE, address resolution, multi-identity address, invalid address |
| `tests/vectors.test.ts` | 5 | Published vectors: canonical, BCH message, record ids, chain outcomes |
| `tests/interop.test.ts` | 2 | Independent BCH `signmessage` vector |
| `tests/property.test.ts` | 12 | Property/fuzz: canonical idempotence, key order, NFC, numeric edges, duplicate keys, depth limits; chain subsets/mutations; malformed event metadata |
| `tests/smoke.test.ts` | 1 | End-to-end creation |
| **Total** | **94** | |

---

## 5. Submission checklist

| Deliverable | Status | Notes |
| --- | --- | --- |
| Public GitHub repository | **Not done** | Local git repository only; pushing requires authorization |
| Live application URL | **Not done** | Build verified locally; no deployment performed |
| Working demonstration | **Done locally** | Browser E2E + terminal lifecycle demo pass; single-file demo in `demo/kyvera-standalone.html` |
| Identity Time Machine | **Done** | `/demo`, `/verify`, dashboard and `/identity/[npub]/time-machine` |
| Security laboratory | **Done** | `/lab`, six real scenarios, simple/advanced modes |
| Competitive audit | **Done** | `docs/COMPETITIVE_AUDIT_2026.md` |
| Design system | **Done** | `docs/DESIGN_SYSTEM.md` |
| Wallet probe | **Done** | `/interop` + `docs/WALLET_INTEROP.md`; live wallet rows still empty |
| Verification SDK | **Done** | `@kyvera/verifier` + CLI |
| Documentation | **Done** | Protocol, threat model, architecture, security, competitor, requirements |
| Security test report | **Done** | `docs/SECURITY_TEST_REPORT.md` |
| Demo video | **Not done** | Must record the running application |
| Submission description | **Draft** | README §14 and §15 can seed it |
| Architecture diagram | **Done** | Mermaid in README and `docs/ARCHITECTURE.md` |
| Known limitations | **Done** | `docs/SECURITY_LIMITATIONS.md` |
| Live wallet interoperability test | **Not done** | Blocking credibility gap for the "wallet integration" expectation |
| BCH Blaze registration / BUIDL submission | **Not done** | Not performed without authorization |

---

## 6. Notes on standards alignment

| Standard / primitive | Use in KYVERA |
| --- | --- |
| NIP-01 | Event serialization, id and Schnorr signature |
| NIP-78 | Kind 30078 application-specific data events |
| NIP-07 | Browser signer interface |
| NIP-42 | Shape of kind 22242 challenge events (adapted for app auth) |
| BIP-340 | Schnorr signatures |
| BCH `signmessage` | Compact recoverable ECDSA proof of address control |
| CashAddr | Address encoding; P2PKH only |
| RFC 8785 (JCS) | Inspiration for KCJ-1; KYVERA restricts to safe integers and exact canonical text |
| W3C DID / VC | Not implemented; noted as future work |

KYVERA does not invent a new curve, signature scheme or address format. Its novel part is the authorization chain and verifier semantics.

---

## 7. Things not to claim

- Do not claim production readiness or a security audit.
- Do not claim recovery after losing all authorized keys.
- Do not claim absolute rollback protection against a relay set that withholds history.
- Do not claim wallet interoperability that has not been tested live, despite format compatibility.
- Do not claim deployment, a demo video, or bounty submission until each is actually completed and verified.
- Do not claim that missing features in competitors are vulnerabilities.
