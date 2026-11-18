# Release Checklist

**Date:** 2026-11-18
**Candidate:** `ff3e69d` + release-candidate working tree
**Target:** BCH Blaze 2026 · Paytaca Decentralized Identity bounty
**Status:** local release candidate; **not deployed, not submitted**.

---

## 1. Baseline results (re-run at RC)

| Check | Command | Result |
| --- | --- | --- |
| Repository commit | `git rev-parse HEAD` | `ff3e69d…` (clean before RC changes) |
| Unit/integration/security tests | `pnpm test` | **94/94 pass**, 10 files, ~3s |
| Type checking | `pnpm typecheck` | pass, 5 projects |
| Production build | `pnpm build` | pass, 12 routes |
| Browser QA | `pnpm qa:browser` | **28/28**, 0 console/page errors |
| Lifecycle demo | `pnpm demo:lifecycle` | all assertions pass |
| Standalone HTML | `node scripts/test-standalone.mjs` | 6 scenarios, 0 errors |
| Dependency audit | `pnpm audit --prod` | **0 known vulnerabilities** |
| Production CSP/browser smoke | `scripts/prod-smoke.mjs` against `next start` | pass, 0 console errors |
| Production build from clean install | `rm -rf packages/*/dist apps/web/.next && pnpm install --frozen-lockfile && pnpm build` | pass (simulates Vercel clean checkout) |
| Offline demo/lab/interop (no relay) | `scripts/offline-smoke.mjs` | pass, 0 console errors |
| Production localhost scan | `.next/static` | 0 references |
| Production headers | `curl -sI` | CSP, HSTS, nosniff, frame deny, referrer, permissions present |

### 1.1 Build/runtime environment

- macOS 27.2 Apple Silicon, Node 20.17.0, pnpm 9.15.9.
- Next.js 15.5.29, React 19.3.1, Vitest 2.1.9, Chrome (Playwright 1.65.1).
- Production server tested on `127.0.0.1:3100`.
- Dev relay: `ws://127.0.0.1:7777` (not part of production defaults).

---

## 2. Evidence matrix

Every important claim links to a source, test or running demonstration.

| Claim | Source | Test / demonstration |
| --- | --- | --- |
| Canonical, deterministic record bytes | `packages/core/src/canonical.ts` | `tests/vectors.test.ts`, `tests/property.test.ts` |
| BCH key is recovered, not trusted | `packages/bch/src/signmessage.ts` | `tests/binding.test.ts` |
| BCH `signmessage` format is interoperable | `packages/bch`, `docs/PROTOCOL.md` §5 | `tests/interop.test.ts` (independent vector) |
| Nostr event is Schnorr-signed and fresh-copied | `packages/nostr/src/event.ts` | `tests/binding.test.ts`, `tests/auth.test.ts` |
| Rotation requires current + new + Nostr signatures | `packages/verifier/src/create.ts`, `packages/core/src/chain.ts` | `tests/rotation.test.ts`, `/demo` step 4 |
| Revocation requires current BCH + Nostr and is terminal | `packages/verifier/src/create.ts`, `chain.ts` | `tests/revocation.test.ts`, `/demo` step 8 |
| Historical proof remains valid but is SUPERSEDED | `chain.ts`, `discovery.ts` | `tests/rotation.test.ts`, `/demo` step 5, `/verify` |
| Equivocation yields CONFLICT, not a winner | `packages/core/src/chain.ts` | `tests/rotation.test.ts`, `/lab` scenario 4 |
| Missing history yields STALE, not fallback | `chain.ts`, `discovery.ts` | `tests/chain.test.ts`, `/lab` scenario 5 |
| Partial relay sync is explicit | `packages/nostr/src/relay.ts`, `discovery.ts` | `tests/relay.test.ts` |
| Checkpoint detects rollback | `discovery.ts` `applyCheckpointToResolution` | `tests/relay.test.ts`, `/lab` scenario 5 |
| Challenge-response auth is replay-resistant | `packages/verifier/src/auth.ts` | `tests/auth.test.ts`, `/auth` |
| Independent CLI verification | `packages/verifier/src/cli.ts` | `pnpm cli`, `/demo` step 7 |
| No backend/API key | `docs/ARCHITECTURE.md`, `packages/verifier` | `/verify`, standalone file from `file://` |
| 8 explicit statuses | `packages/core/src/types.ts` | landing status matrix, `ResolutionPanel` |
| Time Machine shows real proof data | `apps/web/components/time-machine.tsx` | browser QA step 6 |
| Lab runs real verifier functions | `apps/web/lib/lab.ts`, `app/lab` | browser QA, standalone |
| Mobile/reduced motion/keyboard | design system/global CSS | browser QA checks 12–14 |
| Production CSP permits WASM | `apps/web/next.config.mjs` | `scripts/prod-smoke.mjs` |
| No hardcoded private keys | client bundle scan | `docs/RELEASE_SECURITY_AUDIT.md` §4 |

---

## 3. Eligibility

See [`SUBMISSION_ELIGIBILITY.md`](SUBMISSION_ELIGIBILITY.md).

| Item | Status |
| --- | --- |
| Paytaca bounty requirements 1–5 | Met locally |
| Public deployment / live URL | ❌ |
| WizardConnect or XO integration | ❌ |
| BCH mainnet transaction feature | ❌ |
| Presentation deck + banner | ❌ |
| Registration / roll call / Telegram | ❌ unverified |
| Deadline | **22 Nov 2026, 14:00 UTC (19:30 IST)** |

**Do not submit as Mainnet Track eligible without deployment, WizardConnect/XO and a usable mainnet transaction. Confirm bounty-only eligibility with Paytaca/BLAZE organizers.**

---

## 4. Wallet interoperability

See [`WALLET_INTEROP.md`](WALLET_INTEROP.md).

| Wallet | Status |
| --- | --- |
| Paytaca | **Not tested** (no installation available) |
| Electron Cash | **Not tested** (not installed) |
| Cashonize | **Not tested** (no installation available) |
| Independent `nostr-bch-bind` vector | Verified |

Manual action: install a wallet, open `/interop`, sign the fixed probe message, paste the result, and record wallet/version. Terminal alternative: `pnpm wallet:verify <address> <signature>`.

---

## 5. Deployment readiness

See [`DEPLOYMENT.md`](DEPLOYMENT.md).

| Item | Status |
| --- | --- |
| `vercel.json` monorepo config | ✅ prepared |
| Production env template | ✅ `apps/web/.env.production.example` |
| Production relay fallback (no localhost) | ✅ `wss://relay.damus.io,wss://nos.lol` |
| Security headers | ✅ verified on `next start` |
| Static assets (`/vectors.json`, standalone, icon) | ✅ 200 |
| Routes | ✅ 12 routes build and render |
| CSP + WASM | ✅ fixed and smoke-tested |
| No secrets in client bundle | ✅ scanned |
| Demo/lab/standalone work without relay | ✅ |
| Public deployment | ❌ not authorized / not performed |
| Post-deploy smoke test | ☐ pending deployment |

---

## 6. Outstanding blockers

1. **Repository visibility** — `sakethdonepudi/kyvera-protocol` is currently **private**. Mainnet Track requires a public GitHub/lab link.
2. **Deployment** — no public URL; required for Mainnet Track and strongly expected for the bounty.
3. **Mainnet Track features** — WizardConnect/XO and a usable mainnet BCH transaction are absent.
4. **Wallet interoperability** — no real wallet signature recorded.
5. **Presentation** — Widget Factory deck and top-of-page banner not prepared.
6. **Video** — 90-second demo video not recorded.
7. **Registration/roll call/Telegram** — not confirmed.
8. **Independent audit** — not performed.

---

## 7. Exact manual actions required

1. **Confirm eligibility:** message Paytaca/BLAZE: "For the Decentralized Identity bounty, is a DoraHacks Mainnet Track submission required, and do the live-demo/WizardConnect/mainnet-transaction rules apply?" Record the answer in `SUBMISSION_ELIGIBILITY.md`.
2. **Make the repository public** (or grant judges access) after reviewing history for secrets. Current visibility is private.
3. **Deploy** to Vercel using `vercel.json` and the production env; verify headers/routes with `DEPLOYMENT.md` §4.
4. **Test one wallet:** install Electron Cash or Cashonize, open `/interop`, sign the fixed message, record a real signature/version in `WALLET_INTEROP.md`.
5. **Decide on Mainnet Track:** if required, add WizardConnect (or XO) and one clearly usable mainnet BCH transaction feature; do not spend BCH without authorization.
6. **Prepare deck/banner:** Widget Factory template, repo link, live demo link, EMBER2026 CashTokens address (if available).
7. **Record video:** follow `JUDGE_DEMO_SCRIPT.md`.
8. **Register/submit** on DoraHacks with the correct track after the above.
9. **Independent review** before any real-funds use.

---

## 8. Release recommendation

**Local release candidate: approved for demonstration.**
**Public submission: not yet approved.**

The code, tests, design, proof inspection and adversarial demos are in good shape. The remaining blockers are operational and eligibility-related, not cryptographic. The highest-risk assumption is that the Paytaca bounty can be won without satisfying Mainnet Track requirements; that must be confirmed before submission.
