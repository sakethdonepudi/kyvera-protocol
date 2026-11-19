# KYVERA V5 Baseline Audit

**Audit date:** 2026-11-19
**Repository:** https://github.com/sakethdonepudi/kyvera-protocol
**Branch:** `main`
**HEAD at audit:** `6620fad` (docs after deployed app commit)
**Deployed app commit:** `e01eaea` (`<meta name="kyvera-commit">`)
**Release:** `v4.3.0`
**Live:** https://kyvera-alpha.vercel.app

This baseline is based on the repository, local test execution, the production deployment and read-only public sources. It does not treat prior reports as evidence.

---

## 1. Confirmed capabilities

| Capability | Evidence | Status |
| --- | --- | --- |
| Separate BCH and Nostr keys | `packages/core/src/schema.ts`, key-reuse tests, `apps/web/app/create` | **PASS** |
| Hash-linked authorization chain | `packages/core/src/chain.ts`, `tests/chain.test.ts` | **PASS** |
| Bind / rotate / revoke lifecycle | `packages/verifier/src/create.ts`, `tests/binding.test.ts`, `tests/rotation.test.ts`, `tests/revocation.test.ts` | **PASS** |
| BCH `signmessage` verification | `packages/bch/src/signmessage.ts`, independent vectors in `tests/interop.test.ts` | **PASS** |
| Nostr Schnorr event verification | `packages/nostr/src/event.ts`, `nostr-tools` verification | **PASS** |
| Canonical JSON and duplicate-tag rejection | `packages/core/src/canonical.ts`, `tests/security-challenge.test.ts` | **PASS** |
| Multi-relay discovery and uncertainty states | `packages/nostr/src/relay.ts`, `packages/verifier/src/discovery.ts`, `tests/relay.test.ts` | **PASS** |
| Fail-closed `PARTIAL` / `UNSYNCED` behavior | `packages/verifier/src/auth.ts`, browser QA | **PASS** |
| Challenge-response authentication | kind 22242 request event, `AuthRequestService`, replay rejection | **PASS** |
| Independent relying-party CLI | `examples/relying-party/demo.mjs`, `pnpm rp:demo` | **PASS** (fixtures, 10/10) |
| Identity Time Machine evidence | `apps/web/components/time-machine.tsx` | **PASS** |
| Security lab scenarios | `apps/web/app/lab`, `packages/verifier/src/lab` | **PASS** |
| Standalone bundled verifier | `apps/web/public/kyvera-standalone.html` | **PASS** |
| Browser and mobile QA | `scripts/qa-browser.mjs`, 57/57 at 1440 and 390 | **PASS** |
| Responsive UI evidence | `docs/screenshots/4.3/`, 375/390/768/1440 | **PASS** |
| Narrated films | `/tutorial`, 96.93s and 188.53s MP4 with captions | **PASS** |
| Official brand assets | `apps/web/public/brand`, favicon, manifest, OG | **PASS** |

### Test results at baseline

```text
pnpm test            136/136 passing, 13 files
pnpm typecheck       pass (5 projects)
pnpm build           pass (Next.js production build)
pnpm qa:browser      57/57, 0 console/page errors
pnpm rp:demo         10/10
```

The local relay was used for browser QA. Public-relay publishing was **not** executed.

---

## 2. Partially implemented capabilities

| Capability | Current state | Gap |
| --- | --- | --- |
| Public Nostr discovery | A public regular-event mirror (kind 1078) is dual-published with the legacy kind-30078 envelope; both are queried and de-duplicated | Public lifecycle PASS on two relays; short-term retention observed |
| Reusable SDK | `@kyvera/sdk` exposes `KyveraClient`, structured verification, auth helpers, evidence export and creation primitives | Not published to npm; browser bundling and package exports validated by typecheck/build only |
| Wallet integration | `@kyvera/wallet-bch` provides capability reporting, WizardConnect address adapter and manual `signmessage` verification | WizardConnect does not expose message signing; no physical-wallet signing evidence |
| Independent relying party | CLI + durable file-store demos verify bind, rotate, revoke, replay, session persistence and invalidation | File store is single-process; no separately hosted web origin |
| Portable evidence | Time Machine and record inspectors expose proofs | No signed/exportable proof bundle or offline `verify` CLI |
| Veramo integration | None | No plugin, resolver or compatibility test. Explicitly P1 |

---

## 3. Missing capabilities

- Real Paytaca/Cashonize/Selene signing evidence on a physical wallet.
- A production (multi-process) relying-party database; the example file store is single-process.
- `@kyvera/proof-bundle` and offline bundle verification CLI.
- Veramo plugin and example agent.
- Third-party attestations, portable reputation and recovery.
- Independent security audit.

---

## 4. Security limitations

- A first-time verifier cannot prove that every relay disclosed the latest revocation. `FULL` means all configured relays answered with EOSE, not that the global Nostr network is complete.
- No global ordering, no consensus and no economic finality.
- Relay retention can change without notice.
- The in-memory `AuthRequestService` is not durable and is not a production session store.
- WizardConnect does not provide arbitrary message signing in the integrated version, so the wallet proof remains a manual two-step flow.
- No production-wallet or real-funds test has been performed.
- No independent audit has been performed.

---

## 5. Compatibility limitations

- BCH proofs require P2PKH `signmessage`; P2SH and token-aware addresses are rejected by design.
- Public discovery uses NIP-78 kind 30078 with a unique Addressable Event `d` tag. This is an application-data convention, not a registered DID method or new NIP.
- The protocol is not a W3C DID method. No DID document or Universal Resolver integration is claimed.
- The SDK is not published to npm. Workspace imports are the supported development path until ownership, naming and release authorization are confirmed.

---

## 6. Existing bugs / release blockers

No release-blocking bug was reproduced in the baseline suite.

Observed engineering gaps, not protocol failures:

1. The public-relay test publishes only `bind` and `revoke`; it does not exercise a full public `bind → rotate → revoke` lifecycle.
2. The durable relying-party demo uses a single-process file store, not a production database or multi-process lock.
3. The standalone HTML and web UI use the same verifier package, so they are independent of a KYVERA server but not independent implementations.
4. The narrated films still show the pre-4.3 UI.
5. The public kind 1078 is experimental and unregistered; relay support must be measured, not assumed.

---

## 7. Actual deployment state

| Item | Value |
| --- | --- |
| Vercel project | `kyvera` / `sakethdonepudis-projects` |
| Production alias | https://kyvera-alpha.vercel.app |
| App commit | `e01eaea` |
| Repository HEAD | `6620fad` |
| Latest release | `v4.3.0` → `e01eaea` |
| Repository visibility | public |
| Production smoke | pass (9 routes, headers, bundle) |
| Production read-only QA | pass (12 routes, reload, mobile, video) |

---

## 8. V5 priority conclusion

The primary bounty is the **Paytaca Decentralized Identity** bounty. The protocol already satisfies the core creation, binding, discovery, verification and authentication requirements at proof-of-concept level.

The highest-value V5 work is:

1. Public or local lifecycle-retention evidence for the dual-envelope discovery format.
2. A physical-wallet signing test (or an explicit, truthful limitation report).
3. A production relying-party session store if the example is deployed.
4. Proof bundles and Veramo integration as P1 work.
5. Submission documentation grounded in executed tests.

Veramo, proof bundles and additional wallets remain P1/P2 unless the P0 items are stable.

---

## 9. Post-baseline V5 progress

Implemented after this baseline:

- `@kyvera/sdk` with structured verification, auth helpers and evidence export.
- `@kyvera/wallet-bch` with capability reporting and manual proof verification.
- Dual-envelope discovery: public kind `1078` + legacy kind `30078`.
- Public lifecycle PASS on `wss://nos.lol` and `wss://relay.primal.net`, including forged-rotation rejection and short-term retention.
- `pnpm rp:persist` durable file-backed session demo (7/7).
- 154 tests across 16 files.

Still open:

- Physical-wallet signing evidence.
- Indefinite public retention (not claimed).
- Production/multi-process relying-party database.
- Proof bundles and Veramo (P1).
