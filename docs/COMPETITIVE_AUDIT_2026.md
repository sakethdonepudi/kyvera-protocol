# Competitive Audit 2026

**Date:** 2026-11-18
**Scope:** public BCH Blaze 2026 identity submissions and prior art
**Method:** public repositories cloned at the commit below, README/spec/source reading, live demo page inspection. No intrusive testing, no mainnet transactions, no third-party keys.

> This audit records observable design choices, not vulnerabilities. Missing features are not security defects, and claims are separated from verified behaviour.

---

## 1. Snapshot

| Project | Repository | Commit inspected | Created | Live demo | License | Submission evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Kola Link | https://github.com/mbanyadev/kola-link | `b222d6048d5df8728e152a4bfc6076114b74735c` (2026-11-15) | 2026-11-14 | https://mbanyadev.github.io/kola-link/ (HTTP 200) | MIT | README: BCH Blaze 2026, Paytaca identity + Build with XO |
| CashLink ID | https://github.com/chaboss-work/cashlink-id | `e4d59ef1ea9453cf9bb95856018525a5c1430767` (2026-11-14) | 2026-11-14 | https://chaboss-work.github.io/cashlink-id/ (HTTP 200) | MIT | README: BCH Blaze 2026, mainnet track + Paytaca bounty |
| BCH Identity Bridge | https://github.com/alberdioni8406/BCH-Identity-Bridge | `cad784c5035cdcea91a8a31fc5e59e22598cd941` (2026-10-26) | 2026-10-26 | https://bch-id-bridge.vercel.app/ (HTTP 200) | none declared | README: Paytaca bounty; repo predates BLAZE |
| bch-did-binding | https://github.com/georgeonweb3/bch-did-binding | `aea2889b88d6b89395a460ed4137ddf0d9d6171b` (2026-11-14) | 2026-11-14 | none found (GitHub Pages 404) | none declared | README: BCH BLAZE 2026 Paytaca bounty PoC |
| KYVERA | https://github.com/sakethdonepudi/kyvera-protocol (local; not pushed) | working tree at 2026-11-18 | 2026-11-18 | local only | MIT | BCH Blaze 2026 Paytaca bounty |

DoraHacks' Builds tab reports **"The organizer is reviewing Builds"**, so official submission status for every project is not independently confirmable from public pages. Repository README claims are the only evidence of intended track for the others.

---

## 2. Kola Link

### 2.1 Verified implemented features (source/README)

- Nostr + BCH binding with a canonical statement (`kola-link:v1|npub=…|bch=…|created=…|nonce=…`) and `sha256(statement)` commitment.
- BCH proof: Bitcoin Signed Message; optional XO on-chain identity anchor on chipnet with `rotate`/`revoke` spending paths.
- Nostr proof: kind 30078, `d=kola-link`, `i`/`c` tags, content JSON with proofs.
- NIP-07 — signer, WizardConnect wallet connection, relay publishing/discovery.
- Challenge-response authentication (NIP-98-style kind 27235).
- Identity payments by npub, a demo marketplace ("Sawa Market"), and salted-attribute attestations ("Kumba Verify").
- Live chipnet XO bind/revoke transactions linked in README.
- **Rotation:** publish a new binding event; optional anchor rotate. **Revocation:** publish a new binding/withdrawal and optionally spend the anchor back.
- **Resolution model:** no sequence/previous digest. A verifier takes a binding event (or newest, depending on client path); the spec says "Key rotation: publish a new binding event" and the anchor gives ordering when present.

### 2.2 Security model

- Relays untrusted; verify locally.
- On-chain anchor adds an ordered commitment and authorized rotate/revoke.
- Demo nsec/WIF in localStorage, labelled chipnet-only.
- A signed message proves control at a point in time; spec explicitly says it does not revoke a leaked key by itself.

### 2.3 Tests and documentation

- Specification: `docs/SPEC.md` (KL-1), architecture, XO reproduce guide, developer feedback.
- Tests: `src/lib/statement.test.ts` only (statement parsing/canonicalization). No automated suite for chain/rotation/conflict semantics was found in the inspected commit.
- README is unusually honest about limitations and pre-hackathon work.

### 2.4 UX

Cream editorial landing page with serif display, a "60-second path", step-by-step create/bind/discover/pay/auth pages, explicit chipnet default and a prominent pre-hackathon/placeholder banner. Strong product breadth and clarity.

### 2.5 Confirmed limitations relative to lifecycle problem

- **Newest binding wins.** There is no `sequence` or `previous` digest; old and new bindings are independent records.
- **No explicit `SUPERSEDED`, `CONFLICT` or `STALE` result.** A verifier returning an old event cannot communicate that newer history may exist.
- **No per-relay freshness/assurance model.** The architecture notes relays can serve stale events, but the protocol has no result state for it.
- **Off-chain revocation is a new statement/binding event**, not a chained, dual-key-authorized transition at a sequence.

### 2.6 Unverified claims

- XO transactions were not re-verified on chipnet by this audit.
- Attestation and payment flows were not exercised end-to-end.
- "Live demo" was loaded; its full create/publish flow was not run (would publish to public relays).

---

## 3. CashLink ID

### 3.1 Verified implemented features (source/README)

- On-chain commitment transaction (`OP_RETURN "CLID" 0x01 <nostr pubkey> <sha256(statement)>`) spending from the linked P2PKH address with a `SIGHASH_ALL`-based signature.
- Nostr kind 30078 event (`d=cashlink-id`) with NIP-73 `i` tags for address and commitment txid.
- Independent verifier: Nostr signature, canonical statement, Fulcrum transaction fetch, CLID output match, BCH VM evaluation of the address input, confirmation height.
- Pay by npub/NIP-05, reverse address lookup, sign-in with challenge-response (kind 22242 plus optional zero-fee wallet step-up), DID view, embeddable badge.
- WizardConnect wallet integration and address scanning.
- **Rotation:** a new statement/commitment transaction and a new binding event; "newest event wins". **Revocation:** a revocation statement in a binding event; README notes lost Nostr key cannot update the old binding; lost wallet can link a new address with the same npub.

### 3.2 Security model

- Both halves required: on-chain commitment signed by the address key and Nostr event signed by the identity key.
- Statement hash includes timestamp, so a commitment cannot be reused for another statement.
- Relays untrusted; Fulcrum untrusted but transaction hash/VM checked.
- Coins with CashTokens are never spent; payments re-verified before signing.
- Demo keys in browser storage; no seed phrases requested.

### 3.3 Tests and documentation

- `app/test/run.ts` protocol tests plus "live checks against Fulcrum and Nostr relays" per README. The live checks were not executed by this audit.
- `SPEC.md` is detailed and unusually precise about the on-chain commitment and VM checks.
- Pre-hackathon snapshot branch declared in README.

### 3.4 UX

Dark, product-led landing page ("Pay anyone on Nostr in Bitcoin Cash"), immediate lookup, clear identity linking/pay/sign-in cards, wallet connection, and a public "recently linked" feed. Strong transactional use case.

### 3.5 Confirmed limitations relative to lifecycle problem

- **Newest event wins** for the Nostr record; on-chain transaction order gives rotation ordering only when the chain is inspected.
- **No hash-linked authorization chain** with explicit predecessor digests or sequence numbers.
- **No conflict/equivocation state.** Competing valid bindings are resolved by recency.
- **No partial-sync/assurance model.** Fulcrum and relay availability are implementation concerns, not verifier result states.
- **Revocation is a Nostr statement**, not a dual-key-signed chained transition. It is authenticated by the Nostr key; the on-chain commitment is not spent/updated by the revocation path described.
- Verification requires a Fulcrum server and mainnet access; not purely relay/offline.

### 3.6 Unverified claims

- The round-trip mainnet commitment flow was not executed.
- Live test suite results were not reproduced.
- Confirmation-height handling was read, not observed on a live tx.

---

## 4. BCH Identity Bridge

### 4.1 Verified implemented features (source/README)

- Canonical binding record (`bch-identity-bridge`, version 1.0.0) with `bindingId = sha256(canonical fields)`.
- BCH proof: Bitcoin-style signed message over a domain-separated string containing the canonical binding fields.
- Nostr proof: custom addressable kind **31234**, `d=<bindingId>`, `bch`/`protocol` tags, content canonical JSON.
- NIP-07 and wallet address input; local storage; portable JSON export.
- Relay publish/discover; independent verifier page; challenge-response with nonce/audience/expiry and an in-memory replay cache.
- Revocation/supersession: a later kind 31235 or tag can mark a `bindingId` revoked/superseded; verifier checks discovery-time.
- Live Vercel app.

### 4.2 Security model

- Domain separation and canonical binding id; BCH address/network checked; future/expiry checks.
- Relays untrusted; no central identity provider.
- In-memory replay cache for the demo; durable store recommended for production.

### 4.3 Tests and documentation

- `tests/binding-and-auth.test.ts` (146 lines) and `tests/canonicalize.test.ts` (52 lines).
- Protocol spec, architecture, threat/security model, bounty walkthrough.
- Repository created **2026-10-26**, before BLAZE began; README says "built from scratch for the Paytaca-sponsored bounty". Whether the code was written before the event is not independently verified. This is a rules/timing question, not a security finding.

### 4.4 UX

Conventional dark SaaS interface with explicit pages for Link, My Identity, Discover, Verify, Authenticate, Developer, Settings. Clear status vocabulary including revoked/superseded/replay_detected. Less editorial than Kola/CashLink, but very legible.

### 4.5 Confirmed limitations relative to lifecycle problem

- **Binding-scoped revocation/supersession**, not a sequence chain. There is no `previous` digest or monotonic sequence linking one binding to the next.
- A verifier must discover separate revocation/supersession events; there is no single head that mathematically commits to all prior transitions.
- **No conflict/equivocation state** in the protocol: competing bindings for the same key/address are not resolved by a chain.
- **No stale/partial relay assurance model.**
- Binding expiry is a field, but no explicit `EXPIRED`/`STALE` resolution semantics across a history.

### 4.6 Unverified claims

- Live demo flow was loaded but not exercised with real signatures.
- No on-chain/transaction anchoring.
- Repository date raises a timing question, unresolved.

---

## 5. bch-did-binding

### 5.1 Verified implemented features

- Minimal JavaScript PoC: BCH key signs `bch-nostr-binding:<nostr_pubkey_hex>` in Bitcoin signed-message format; Nostr key signs a **kind 1** event whose content carries the BCH address and signature, tagged `["bch","<address>"]`.
- `demo.mjs` runs 8 checks: valid binding plus wrong address/pubkey/signature/content/event/garbage.
- No relay publishing (README calls it the obvious next step), no live demo, no rotation/revocation, no challenge auth, no canonical record beyond the message string.

### 5.2 Assessment

A clean cryptographic PoC and a useful negative-test example, but not a lifecycle system. The choice of kind 1 avoids a dedicated identity event and pollutes the social feed; the author acknowledges this.

### 5.3 Unverified claims

- 8/8 checks were not rerun by this audit (source read only; running requires only local dependencies and is non-intrusive, but the code was not executed).

---

## 6. Prior art (not necessarily BLAZE submissions)

| Project | Confirmed behaviour | Relevance |
| --- | --- | --- |
| `nostr-bch-bind v1` gist | kind 30078, `d=bch-bind:<addr>`, signmessage or wc-tx proofs, newest-valid resolution, Nostr-only revocation | Closest minimal binding; no chain/rotation/conflict/stale. KYVERA verifies its published signmessage vector in `tests/interop.test.ts`. |
| Paytaca BCH OAuth | Server-side OAuth2 with BCH ECDSA, timestamp window, DB/token blacklist | Central authority; no Nostr, no lifecycle chain. |
| Electron Cash Nostron | NIP-01 posting/fetching inside Electron Cash | A Nostr client, not an identity binding. |
| nostr-key-demo | Derives BTC/BCH/ETH addresses from the same nsec | Explicit key reuse anti-pattern the bounty warns against. |

---

## 7. Comparison matrix

Legend: ✅ confirmed, ◐ partial/claim only, ❌ absent.

| Capability | KYVERA | Kola Link | CashLink ID | BCH Identity Bridge | bch-did-binding |
| --- | --- | --- | --- | --- | --- |
| Dual-key BCH + Nostr binding | ✅ | ✅ | ✅ | ✅ | ✅ |
| Distinct keys enforced by verifier | ✅ | ✅ (spec) | ✅ | ◐ (address/network checks; no explicit same-key check found) | ❌ |
| Decentralized relay discovery | ✅ | ✅ | ✅ | ✅ | ❌ |
| On-chain commitment | ❌ v1 | ✅ optional XO | ✅ required CLID | ❌ | ❌ |
| WizardConnect | ❌ | ✅ | ✅ | ❌ | ❌ |
| Pay by identity | ❌ | ✅ | ✅ | ❌ | ❌ |
| Attestations / VC-like | ❌ | ✅ salted attributes | ◐ DID/badge | ❌ | ❌ |
| Hash-linked sequence (`previous`) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Rotation as authorized transition | ✅ current+new+Nostr | ◐ new binding, optional anchor | ◐ new statement, newest wins | ◐ new binding / supersession flag | ❌ |
| Revocation authorization | ✅ current BCH + Nostr | ◐ new event; anchor spend optional | ◐ Nostr statement | ◐ revocation event | ❌ |
| Explicit `SUPERSEDED` derived from chain | ✅ | ❌ | ❌ | ◐ flag/tag | ❌ |
| Equivocation / `CONFLICT` evidence | ✅ | ❌ | ❌ | ❌ | ❌ |
| Partial/unsynced relay assurance | ✅ | ❌ | ❌ | ❌ | ❌ |
| Checkpoint rollback detection | ✅ optional | ❌ | ❌ | ❌ | ❌ |
| Challenge-response auth | ✅ kind 22242 | ✅ kind 27235 | ✅ kind 22242 | ✅ custom | ❌ |
| Independent CLI verifier | ✅ | ❌ | ❌ | ❌ | ◐ local script |
| Interactive lifecycle/proof inspector | ✅ Time Machine | ❌ | ◐ DID/badge | ◐ details list | ❌ |
| Executable adversarial lab in browser | ✅ | ❌ | ❌ | ◐ auth replay test | ◐ 8-case script |
| Automated protocol tests | ✅ 105 tests (incl. property/fuzz) | ◐ statement tests | ◐ protocol/live tests | ◐ 2 files | ◐ 8 checks |
| Live hosted demo | ❌ (build verified locally) | ✅ | ✅ | ✅ | ❌ |
| Mainnet transaction | ❌ | ❌ (chipnet) | ✅ claim | ❌ | ❌ |

---

## 8. Evidence-backed differentiation opportunities

1. **Current authorization as a chain, not a recency contest.**
   Kola and CashLink explicitly use "newest wins"; BCH Identity Bridge marks individual bindings. None provides a `previous` digest chain with explicit `SUPERSEDED`/`CONFLICT`/`STALE` outcomes. KYVERA's head is the only record that can authorize payment, and the verifier refuses to fall back.

2. **Dual-key transition authorization.**
   Kola/CashLink rotation is a new record/binding. KYVERA's rotate requires current BCH + new BCH + Nostr; revocation requires current BCH + Nostr and terminates the chain. This is a stronger statement about intent, at the documented cost of losing recovery if the old key is lost.

3. **Uncertainty and equivocation as first-class results.**
   Competitors do not model partial relay sync, withheld history, or two valid records at the same position. KYVERA exposes per-relay assurance, `PARTIAL`/`UNSYNCED`, `CONFLICT` evidence, and optional checkpoints.

4. **Proof-level inspection.**
   KYVERA's Time Machine exposes payload/record digests, predecessor links, the exact BCH proof message, recovered address, Nostr signature and relay observations. Competitor UIs show statuses and checks but not a guided lifecycle instrument.

5. **Reproducible adversarial demonstration.**
   A browser lab runs real verifier functions for authorized rotation, forgery, replay, equivocation, missing history and revocation; every scenario cites its test. This is a presentation advantage for judges who cannot install dependencies.

## 9. Where competitors are stronger (honest assessment)

- **Kola Link:** on-chain XO anchor, WizardConnect, identity payments, attestations, live demo, and a strong editorial brand. Broader product surface.
- **CashLink ID:** a real payment flow, on-chain commitment, Fulcrum verification, NIP-05, DID/badge, WizardConnect, live demo. Strongest transactional story.
- **BCH Identity Bridge:** clear auth/replay demo, portable JSON export, live demo, explicit revoked/superseded statuses.
- **bch-did-binding:** minimal and easy to audit; good negative-test discipline.

KYVERA currently lacks a hosted demo, WizardConnect, mainnet transactions and payments. Those are submission risks, not cryptographic differentiators. Deploying and adding WizardConnect are the highest-value next steps after the lifecycle work.

## 10. Threats to this audit's validity

- All repositories are moving targets; commits are pinned above.
- README claims are distinguished from source-confirmed behaviour.
- Live demos were loaded, not exercised with signatures or transactions.
- DoraHacks Builds are under organizer review; submission status is not public.
- No third-party service was probed beyond public page loads.
- Absence of a feature is a scope observation, not a vulnerability claim.
