# Submission GO / NO-GO

**Date:** 2026-11-19
**Project:** KYVERA
**Bounty:** Paytaca Decentralized Identity · BCH Blaze 2026
**Baseline:** commit `02c2512` (fail-closed hardening; audit fixes in `dfb0023`)

---

## Verdict

# Public demo: GO · Production/real funds: NO-GO

**GO** for the public hackathon demonstration at https://kyvera-alpha.vercel.app.

**NO-GO** for any claim of real-wallet interoperability, production readiness,
real-funds safety, Mainnet Track eligibility, or a completed on-chain payment.

The conditions are listed in §4. They are not optional if the submission claims
those capabilities.

---

## 1. Evidence by environment

| Environment | Status | What was actually verified |
| --- | --- | --- |
| **Verified locally** | ✅ | 136/136 tests across 13 files; strict typecheck; production build (17 routes); 56/56 browser checks; `pnpm rp:demo` 10/10; local relay discovery tests; fresh-clone install/test/build (see §3); no production dependency vulnerabilities |
| **Verified with real wallets** | ❌ | No Paytaca, Cashonize or Selene installation was available. No wallet pairing, wallet-produced message signature, account switch, wrong network, rejection or disconnect was recorded |
| **Verified on public relays** | ◐ | Read-only probe only: `wss://relay.damus.io` failed from this environment; `wss://nos.lol` connected and answered a kind-30078 query. No KYVERA event was published; retention was not tested |
| **Verified in production** | ✅ limited | Public Vercel deployment at https://kyvera-alpha.vercel.app; HTTPS routes, headers, video and bundle smoke pass. Full production auth/payment behavior still depends on external relays |
| **Untested / blocked** | ❌ | Real-wallet signing, public-relay retention, mainnet transaction, txid receipt, third-party attestation, full accessibility audit, independent security review |

---

## 2. Bounty requirement status

| Requirement | Local status | Evidence | Submission claim |
| --- | --- | --- | --- |
| **R1** Self-held identity creation/management | ✅ | `/create`, 136 tests, browser QA | Local prototype |
| **R2** Dual-key BCH–Nostr binding | ✅ | Canonical records, proof verification, key-reuse tests | Local prototype |
| **R3** Decentralized discovery | ✅ local / ◐ public | Multi-relay tests, `STALE`/`PARTIAL`; no public KYVERA event | Do not claim public retention |
| **R4** Independent verification and authentication | ✅ local | `@kyvera/verifier`, `/auth-demo`, `/challenge`, `pnpm rp:demo` 10/10; fail-closed on PARTIAL | Strong local evidence |
| **R5** Working prototype + documentation | ✅ | Live Vercel app, SDK, CLI, standalone verifier, videos, docs; repository remains private | Public demo ready |
| Rotation stretch goal | ✅ | Rotation, revocation, Time Machine, challenge stage | Local prototype |
| Payment stretch goal | ◐ | BIP21 handoff only; no transaction or txid | **Do not claim completed payment** |
| Mainnet Track | ❌ | No wallet-tested integration, no mainnet tx, no deployment | **No claim** |

---

## 3. Reproduced commands and results

```text
pnpm install --frozen-lockfile   PASS (fresh clone)
pnpm test                        PASS 136/136, 13 files
pnpm typecheck                   PASS
pnpm build                       PASS, 17 routes
pnpm qa:browser                  PASS 56/56, 0 console/page errors
pnpm rp:demo                     PASS 10/10, no KYVERA API/relay
pnpm audit --prod                PASS, 0 known vulnerabilities
```

Fresh clone: `git clone` of `02c2512`, `pnpm install --frozen-lockfile`,
`pnpm test` (136/136) and `pnpm build` passed. The install emits a non-fatal warning that
the `kyvera-verify` bin points to an unbuilt `dist/cli.js`; it resolves after
`pnpm build` or `pnpm cli`.

Public relay read-only probe:

```text
wss://relay.damus.io  ok=false eose=false events=0 error=connection failed
wss://nos.lol         ok=true  eose=true  events=1
```

Accessibility probe: no unnamed `button`/`a` controls on `/`, `/challenge`,
`/merchant`, `/create`, `/pay`, `/auth-demo`, `/developers`. Keyboard focus and
reduced-motion checks pass in browser QA. This is not a full WCAG audit.

---

## 4. Conditions for GO

1. **Real-wallet evidence.** Execute `docs/WALLET_DEVICE_TEST.md` on Paytaca and
   Cashonize. Record pairing approval, address match, exact message, wallet
   signature, account switch, wrong network, rejection and disconnect. Selene is
   BIP21-only unless a WizardConnect implementation is confirmed.
2. **Do not claim payment completion.** `/pay` is a BIP21 handoff. Either present
   it as such, or integrate a wallet-approved transaction with source outputs and
   display a real txid/result. Do not fabricate one.
3. **Retain the fail-closed policy.** Payment, authentication and session
   validation now require `FULL` relay agreement. Monitor the configured relay
   set; one failing relay will (by design) block sensitive actions. Persist
   checkpoints for known rollbacks.
4. **Production monitoring.** The Vercel deployment is live. Monitor the relay
   health check; one failing relay blocks sensitive actions by design. Redeploy
   after relay or domain changes and rerun `smoke:deploy`.
5. **Public-relay retention.** Only with explicit authorization, run
   `docs/PUBLIC_RELAY_TEST.md` and `scripts/public-relay-identity-test.mjs`; verify
   kind-30078 retention and discovery over time.
6. **Licensing.** Review `THIRD_PARTY_NOTICES.md`; confirm the LGPL-3.0-or-later
   status of `@wizardconnect/*` for the exact versions distributed.
7. **Real Paytaca test.** Follow `docs/PAYTACA_WALLET_CHECKLIST.md`; never expose
   a seed phrase or private key.
8. **Independent review.** This audit is internal. Obtain a separate review before
   protecting real funds or making security guarantees.

---

## 5. What is safe to say

- KYVERA is a local, open-source prototype for BCH–Nostr identity continuity.
- It binds two independent keys, verifies both proofs, resolves a hash-linked
  authorization chain and rejects unauthorized transitions.
- It demonstrates rotation, revocation, conflicts, stale history and independent
  relying-party authentication.
- It has 136 automated tests, 56 browser checks and a 10/10 standalone relying
  party demonstration.
- It is honest about wallet and payment limitations.

## 6. What is not safe to say

- “Works with Paytaca / Cashonize / Selene” without a real-device row.
- “Production ready”, “audited” or “real-funds safe”.
- “Mainnet Track eligible”.
- “Completed BCH payment” or “transaction confirmed”.
- “Public relay history is complete” or “rollback-proof”.
- “Independent security audit completed”.

---

## 7. Final recommendation

Submit the current build as a **local prototype** with the Trust Challenge,
standalone relying party, merchant demonstration and explicit limitations. Treat
the missing real-wallet and transaction evidence as disclosed gaps rather than
completed features.

**GO** for the public identity-prototype demonstration. **NO-GO** for production
authentication, real-funds payments or Mainnet Track claims until the remaining
conditions are met.
