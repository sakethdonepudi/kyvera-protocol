# KYVERA 3.0 — Competitive Analysis

**Date:** 2026-11-18
**Method:** public repositories cloned and read at pinned commits; README/spec/source/tests inspected; live demos loaded, not exercised with signatures or transactions. No intrusive testing.

| Project | Repository | Commit inspected | Live demo |
| --- | --- | --- | --- |
| Kola Link | https://github.com/mbanyadev/kola-link | `b222d6048d5df8728e152a4bfc6076114b74735c` | https://mbanyadev.github.io/kola-link/ |
| CashLink ID | https://github.com/chaboss-work/cashlink-id | `e4d59ef1ea9453cf9bb95856018525a5c1430767` | https://chaboss-work.github.io/cashlink-id/ |
| BCH Identity Bridge | https://github.com/alberdioni8406/BCH-Identity-Bridge | `cad784c5035cdcea91a8a31fc5e59e22598cd941` | https://bch-id-bridge.vercel.app/ |
| bch-did-binding | https://github.com/georgeonweb3/bch-did-binding | `aea2889b88d6b89395a460ed4137ddf0d9d6171b` | none found |
| KYVERA 3.0 | local working tree on `82a3e1b` | release candidate | local only |

---

## 1. Verified capability matrix

Legend: ✅ confirmed implemented; ◐ partial/claim only; ❌ absent; ? unverified.

| Capability | KYVERA 3.0 | Kola Link | CashLink ID | BCH Identity Bridge | bch-did-binding |
| --- | --- | --- | --- | --- | --- |
| Dual-key BCH/Nostr binding | ✅ | ✅ | ✅ | ✅ | ✅ |
| Distinct-key enforcement | ✅ verifier | ✅ spec | ✅ | ◐ | ❌ |
| Relay discovery | ✅ | ✅ | ✅ | ✅ | ❌ |
| Challenge-response auth | ✅ | ✅ | ✅ | ✅ | ❌ |
| Hash-linked sequence / previous digest | ✅ | ❌ | ❌ | ❌ | ❌ |
| Dual-key rotation intent | ✅ old + new + Nostr | ◐ new binding / anchor | ◐ new statement | ◐ new binding | ❌ |
| Dual-key revocation | ✅ current BCH + Nostr | ◐ | ◐ Nostr statement | ◐ event | ❌ |
| Explicit `SUPERSEDED` from chain | ✅ | ❌ | ❌ | ◐ flag | ❌ |
| `CONFLICT` / equivocation | ✅ | ❌ | ❌ | ❌ | ❌ |
| `STALE` / relay assurance | ✅ | ❌ | ❌ | ❌ | ❌ |
| Checkpoint rollback detection | ✅ | ❌ | ❌ | ❌ | ❌ |
| Historical validity vs current auth comparison | ✅ Time Machine compare | ❌ | ❌ | ❌ | ❌ |
| Time Machine proof inspection | ✅ | ❌ | ◐ DID/badge | ◐ checks list | ❌ |
| Security lab (real verifier) | ✅ 6 scenarios | ❌ | ❌ | ◐ replay demo | ◐ 8-case script |
| On-chain commitment | ❌ | ✅ optional XO | ✅ CLID tx | ❌ | ❌ |
| WizardConnect wallet connection | ✅ adapter integrated; **untested with a wallet** | ✅ | ✅ | ❌ | ❌ |
| Identity payments | ◐ verified BIP21 handoff; no txid | ✅ | ✅ | ❌ | ❌ |
| Live hosted demo | ❌ | ✅ | ✅ | ✅ | ❌ |
| Property/fuzz tests | ✅ | ❌ | ❌ | ❌ | ❌ |
| Automated tests | ✅ 128 | ◐ statement only | ◐ protocol/live | ◐ 2 files | ◐ 8 checks |
| Warm light / dark theme | ✅ | ◐ light only | ❌ dark only | ❌ dark only | ❌ |
| Documented limitations | ✅ extensive | ✅ | ✅ | ✅ | ✅ |

---

## 2. Three highest-value differentiation opportunities

### D1 — Authorization continuity as a first-class object

**Gap:** Kola and CashLink explicitly use “newest wins” for Nostr state; BCH Identity Bridge marks individual bindings. None resolves a hash-linked chain with explicit supersession, conflict and stale results.

**Implemented:** `packages/core/src/chain.ts`, `Identity Time Machine 3.0`, `/verify`, `/lab`, CLI. The Time Machine now has a **Compare** view that shows historical proof validity and current authorization side by side, without implying one guarantees the other.

### D2 — Uncertainty and equivocation as protocol results

**Gap:** No competitor models partial relay sync, withheld history, or two valid records at the same position.

**Implemented:** per-relay `FULL`/`PARTIAL`/`UNSYNCED` assurance, `CONFLICT` evidence, optional `(sequence, recordId)` checkpoint, `STALE` refusal to fall back. Covered by `tests/chain.test.ts`, `tests/relay.test.ts`, `tests/property.test.ts`.

### D3 — Verified payment handoff with a real wallet adapter

**Gap:** Kola/CashLink have stronger on-chain/payment products; KYVERA had no wallet connection or payment workflow.

**Implemented:** WizardConnect adapter (`@wizardconnect/dapp`/`react`), local wallet address derivation, payment policy blocking non-ACTIVE/stale/conflicted/revoked identities, amount validation, BIP21/QR handoff, destination re-resolution and change cancellation, explicit no-txid limitation.

**Status:** the adapter is a real supported-library integration but is **untested with a physical wallet** in this environment. The handoff does not build/broadcast transactions; no receipt is fabricated. See `KYVERA_PAY.md`.

---

## 3. Where competitors remain stronger

- **Kola Link:** live demo, XO chipnet anchor, payments, attestations, WizardConnect, editorial product breadth.
- **CashLink ID:** real on-chain commitment, Fulcrum verification, payments, NIP-05, DID/badge, live demo.
- **BCH Identity Bridge:** live demo, exportable bindings, explicit replay demo.
- **bch-did-binding:** minimal, easy-to-audit negative tests.

KYVERA remains weaker on live deployment, on-chain commitments, transaction-level payments, attestations and wallet testing. Those are submission risks, not cryptographic claims.

---

## 4. Evidence and limits

- Commits pinned; source read directly. README claims distinguished from confirmed behavior.
- No competitor vulnerability is asserted. Missing features are scope differences.
- Live demos were loaded, not exercised with signatures/transactions.
- KYVERA wallet/payment paths are untested with a physical wallet; Mainnet Track eligibility remains unresolved (`SUBMISSION_ELIGIBILITY.md`).
