# Submission Draft

**Project:** KYVERA — The Identity Continuity Protocol
**Tagline:** Keys change. Trust shouldn't disappear.
**Track:** Paytaca Decentralized Identity bounty (eligibility question for Mainnet Track is unresolved — see `SUBMISSION_ELIGIBILITY.md`)
**Repository:** https://github.com/sakethdonepudi/kyvera-protocol
**Live demo:** `<add deployed URL>`
**Standalone demo:** `demo/kyvera-standalone.html` (or `<deployed URL>/kyvera-standalone.html`)
**Demo video:** `<add URL>`
**Presentation:** `<add Widget Factory deck URL>`

---

## Short description

KYVERA is an open-source identity continuity protocol for Bitcoin Cash and Nostr. It cryptographically binds a BCH wallet to a Nostr key, then keeps that binding verifiable through authorized rotation, revocation and compromise. Verifiers distinguish a valid historical proof from the currently authorized payment identity — without a KYVERA server, account or API key.

## The problem

Existing BCH↔Nostr bindings prove that two keys were associated at some point. They do not answer the question a payer or application actually has: **which address is authorized now?**

A signature from a retired wallet remains valid forever. Selecting the newest event by timestamp cannot distinguish a replay from a rotation, or a quiet identity from a relay withholding history. Revocation by one key alone weakens the binding. These are lifecycle problems, not signature problems.

## The solution

KYVERA treats identity as a hash-linked authorization sequence:

- **Bind** — new BCH key + Nostr key, sequence 0.
- **Rotate** — current BCH key + new BCH key + Nostr key.
- **Revoke** — current BCH key + Nostr key; no transition may follow.

Every record commits to the previous record digest. Records are NIP-78 kind 30078 events signed by the Nostr key; the BCH key signs a domain-separated `signmessage` proof. Verification is pure and local.

Eight outcomes: `ACTIVE`, `SUPERSEDED`, `REVOKED`, `EXPIRED`, `CONFLICT`, `STALE`, `UNKNOWN`, `INVALID`. A verifier never falls back to a historical address when it cannot establish current state.

## What is genuinely new

- **Lifecycle chain, not newest-wins.** Tested against public BCH Blaze identity projects (Kola Link, CashLink ID, BCH Identity Bridge) in `docs/COMPETITIVE_AUDIT_2026.md`. None resolves a hash-linked chain with explicit supersession, conflict and stale outcomes.
- **Identity Time Machine.** Every record exposes payload/record/previous digests, both proofs, the exact BCH proof message, relay observations and the acceptance explanation.
- **Uncertainty as a result.** Per-relay `FULL`/`PARTIAL`/`UNSYNCED` assurance, equivocation evidence, optional checkpoint rollback detection.
- **Reproducible adversarial lab.** Six scenarios run the real verifier in the browser; no mock verdicts.
- **Independent SDK and CLI.** Third parties can verify without the app.

## How to try it (90 seconds)

1. Open `/demo` (or `demo/kyvera-standalone.html`).
2. Step through bind → verify → rotate → superseded history → unauthorized rejection → CLI.
3. Open `/lab` for conflict and missing-history scenarios.
4. Open `/verify` with a real npub to inspect live relay state.

## Verification

```bash
pnpm install
pnpm test        # 94 tests
pnpm build
pnpm cli <npub> --relay wss://relay.damus.io
```

No API key or hosted verifier is used.

## Architecture

`@kyvera/core` (canonical JSON + chain), `@kyvera/bch` (CashAddr + signmessage), `@kyvera/nostr` (NIP-78 + relays), `@kyvera/verifier` (record/chain verification, discovery, auth, CLI), Next.js web app. See `docs/PROTOCOL.md` and `docs/ARCHITECTURE.md`.

## Bounty requirement mapping

| Requirement | Evidence |
| --- | --- |
| Identity creation/management, self-custodial | `/create`, tests, browser E2E |
| Dual-key binding, no key reuse | `tests/binding.test.ts`, `tests/interop.test.ts`, `KEY_REUSE` rule |
| Decentralized discovery | `tests/relay.test.ts`, `/verify` |
| Verification + challenge-response auth | `tests/auth.test.ts`, `/auth`, CLI |
| Working demo + docs | `/demo`, `/lab`, standalone, `docs/` |
| Rotation stretch goal | `tests/rotation.test.ts`, dashboard controls |
| Reusable library/spec | packages + `docs/PROTOCOL.md` + CLI |

## Honest limitations

- No recovery if both authorized keys are lost.
- No absolute rollback protection without a checkpoint.
- P2PKH only; no multisig, hardware-wallet PSBT or CashTokens.
- No live wallet compatibility recorded yet.
- No independent security audit.
- **Not currently eligible for the Mainnet Track** without a live deployment, WizardConnect/XO and a mainnet transaction feature.
- Demo keys are throwaway browser-local material.

## Team

`<name, role, contact>`

## Links

- Source: https://github.com/sakethdonepudi/kyvera-protocol
- Protocol: `docs/PROTOCOL.md`
- Competitive audit: `docs/COMPETITIVE_AUDIT_2026.md`
- Security limitations: `docs/SECURITY_LIMITATIONS.md`
- Independent verifier: `packages/verifier`
