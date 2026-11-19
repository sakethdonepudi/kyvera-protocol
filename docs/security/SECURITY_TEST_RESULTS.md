# KYVERA V5 Security Test Results

**Date:** 2026-11-19
**Baseline:** `da86470` (V5)
**Status:** executed locally; not independently audited

## 1. Commands

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm qa:browser
pnpm rp:demo
pnpm rp:persist
```

## 2. Results

| Suite | Result |
| --- | --- |
| Unit/integration/security tests | **154/154** (see final count after V5 additions) |
| Typecheck | pass (7 projects) |
| Production build | pass |
| Browser QA | 64/64, 0 console/page errors |
| Independent RP demo | 13/13 |
| Durable RP demo | 7/7 |
| Local relay discovery | pass |
| Public relay lifecycle | **PASS** — 2 relays, full lifecycle, short-term retention observed |
| Real-wallet signing | **NOT TESTED** — no compatible physical wallet |
| Independent audit | **NOT PERFORMED** |

The final test count is recorded in the release report and CI output. New V5 suites:

- `tests/discovery-format.test.ts` — 6 tests for public kind, unique `d`, filters, tamper rejection, full lifecycle from public events.
- `tests/sdk.test.ts` — 6 tests for structured output, PARTIAL vs FULL, revocation, typed errors, offline UNSYNCED, evidence export.
- `tests/wallet-adapter.test.ts` — 4 tests for manual proof verification, mismatch, malformed/wrong-network signatures, WizardConnect capability reporting.
- `tests/auth-request.test.ts` — added challenge consumption on failed verification.

## 3. What the tests prove

- Both envelopes parse and resolve identically.
- A lifecycle can be reconstructed from public kind-1078 events alone.
- Unique `d` tags prevent addressable replacement collapse.
- Public filters request both kinds and the indexed `k`/`b` tags.
- The SDK returns separate cryptographic, historical, authorization and assurance fields.
- A revoked identity is never authorized.
- A session survives a process restart with a file store and is invalidated by rotation/revocation.
- A malformed signature or wrong-network address is rejected before acceptance.

## 4. What they do not prove

- Indefinite public relay retention. Short-term retention was observed.
- Real Paytaca/Cashonize/Selene signing.
- Global revocation awareness.
- Production session security.
- Mainnet transaction finality.
