# Requirements Matrix

**Project:** KYVERA
**Bounty:** Paytaca Decentralized Identity · BCH Blaze 2026
**Date:** 2026-11-19

This matrix maps each bounty requirement and the current release brief to
implementation, test evidence, demo route, documentation and remaining limits.

---

## 1. Paytaca bounty requirements

| Requirement | Implementation | Test evidence | Demo | Documentation | Remaining limitation |
| --- | --- | --- | --- | --- | --- |
| **R1** Identity creation and management with self-held keys | `/create`, `apps/web/lib/identity.ts`, `packages/verifier/src/create.ts` | `tests/binding.test.ts`, `tests/security-challenge.test.ts`, 56 browser checks | `/create` | README, `docs/PROTOCOL.md` | Physical wallet pairing untested; demo keys are browser-local |
| **R2** Cryptographic BCH–Nostr binding with distinct keys | Canonical KCJ-1 records; BCH `signmessage`; BIP-340 Nostr proof; `KEY_REUSE` check | `tests/binding.test.ts`, `tests/interop.test.ts`, `tests/property.test.ts` | `/challenge` stage Bind, `/demo` | `docs/PROTOCOL.md` | P2PKH only; no multisig/CashTokens |
| **R3** Decentralized discovery | kind 30078 events; multi-relay resolution; per-relay sync; `STALE`/`PARTIAL`/`UNSYNCED` | `tests/relay.test.ts`, `tests/chain.test.ts` | `/verify`, `/challenge` live mode | `docs/INTEGRATION.md` | Relay sets can withhold history; checkpoints detect known rollbacks only |
| **R4** Independent verification and authentication | `@kyvera/verifier`; `/auth-demo`; standalone RP; single-use challenges; origin/session/identity/address binding | `tests/auth-request.test.ts`, `tests/security-challenge.test.ts`, `/auth-demo` browser journey | `/auth-demo`, `/challenge` stage Authenticate, `pnpm rp:demo` | `docs/PAYTACA_COMPLIANCE.md`, `docs/INTEGRATION.md` | Browser session store is in-memory; production RP must persist |
| **R5** Working prototype, source and documentation | 17 routes; monorepo; CLI; standalone verifier | 136 tests, 56 browser checks, production build | all routes | README, `docs/`, `docs/JUDGE_3_MINUTE.md` | Repository is private; public Vercel demo is live |

---

## 2. Current release brief

| Area | Status | Evidence | Demo | Remaining limitation |
| --- | --- | --- | --- | --- |
| Trust Challenge with five real stages | Implemented | `apps/web/lib/challenge.ts`, `tests/security-challenge.test.ts`, browser checks | `/challenge` | Live rotation needs browser-local keys |
| Guided demo and live mode never mixed | Implemented | separate state in `challenge/page.tsx`; browser checks | `/challenge` | Live mode depends on configured relays |
| Independent relying-party application | Implemented | `examples/relying-party/demo.mjs`, `pnpm rp:demo` → 10/10 | terminal | Deterministic keys, no wallet |
| Real-wallet onboarding (Connect → Sign → Verified → Publish) | Implemented | `/create`, `apps/web/lib/wallet.ts`, 56 browser checks | `/create` | No physical wallet test; WizardConnect has no message signing |
| Secure manual signature fallback | Implemented | `/create` Paste tab; invalid signature rejected automatically | `/create` | Manual copy/paste is required by wallet API limits |
| Kyvera Pay policy and handoff | Implemented | `apps/web/lib/pay.ts`, `tests/pay.test.ts` | `/pay` | BIP21 handoff only; no wallet-approved transaction or txid |
| Merchant identity demonstration | Implemented | `/merchant`, deterministic verifier, browser check | `/merchant` | Self-asserted merchant; no third-party attestation |
| Premium minimal glass interface | Implemented | `globals.css`, all routes, light/dark, reduced motion | all routes | Not independently design-reviewed |
| Interoperability proof package | Implemented | `docs/INTEGRATION.md`, standalone RP, vectors, CLI, offline verifier | `/developers`, `pnpm rp:demo` | No third-party integration test |
| Security challenge suite | Implemented | `tests/security-challenge.test.ts` (16), 13 test files | `/lab`, `/challenge` | No independent audit |
| Video-ready judge experience | Implemented | `docs/JUDGE_3_MINUTE.md`, `/tutorial` MP4s | `/`, `/challenge`, `/merchant`, `/pay`, `/tutorial` | Real-wallet segment not available |
| Quality and release | Verified | 136 tests, typecheck, build, 56 browser checks, audit | — | Public deployment and real-device wallets outstanding |

---

## 3. Security scenarios

| Scenario | Result | Evidence |
| --- | --- | --- |
| Forged BCH signature | Rejected `BCH_SIGNATURE_NOT_BY_ADDRESS` | `tests/security-challenge.test.ts` |
| Forged Nostr signature | Rejected `NOSTR_SIGNATURE_INVALID` | `tests/security-challenge.test.ts` |
| Unauthorized rotation | Rejected; wallet A remains current | `tests/security-challenge.test.ts`, `/challenge` |
| Replayed login challenge | `UNKNOWN_CHALLENGE` | `tests/auth-request.test.ts`, `/auth-demo`, `pnpm rp:demo` |
| Expired challenge | `CHALLENGE_EXPIRED` | `tests/auth-request.test.ts`, `tests/security-challenge.test.ts` |
| Revoked identity | `REVOKED`; session `SESSION_IDENTITY_REVOKED` | `tests/security-challenge.test.ts`, `/lab` |
| Missing history | `STALE` / `MISSING_CHAIN_SEGMENT` | `tests/security-challenge.test.ts`, `pnpm rp:demo` |
| Relay censorship / incomplete results | `PARTIAL`/`STALE`; never a false ACTIVE guarantee | `tests/relay.test.ts`, `/lab` |
| Conflicting branches | `CONFLICT` / `SEQUENCE_EQUIVOCATION` | `tests/security-challenge.test.ts`, `/lab` |
| Stale/rollback observation | `STALE` / `ROLLBACK_DETECTED` | `tests/security-challenge.test.ts`, `/lab` |
| Payment destination changed | Intent cancelled; blocked when not ACTIVE | `tests/pay.test.ts` |

---

## 4. Commands

```bash
pnpm test          # 136 tests, 13 files
pnpm typecheck
pnpm build
pnpm qa:browser    # 56 checks
pnpm rp:demo       # 10/10 standalone RP checks
pnpm relay         # local relay for browser/live tests
pnpm dev
```

## 5. Explicit non-claims

- No physical Paytaca, Cashonize or Selene wallet was tested.
- WizardConnect does not expose arbitrary message signing.
- `pnpm rp:demo` uses deterministic local keys, not a real wallet.
- `/pay` is a BIP21 handoff; it does not construct or broadcast a transaction and
  does not display a txid.
- `/merchant` is a self-asserted demo; no third-party credential or attestation.
- Public deployment is live at https://kyvera-alpha.vercel.app; GitHub remains private; no bounty submission was performed.
