# KYVERA Trust Challenge

**Route:** `/challenge`
**Purpose:** demonstrate the complete trust story in five executable stages.

The challenge is not a slideshow. Every verdict is produced by the same verifier
functions exported by `@kyvera/verifier`.

---

## Stages

| Stage | Question | Real logic |
| --- | --- | --- |
| **Bind** | Are the BCH and Nostr keys one identity? | `verifyEventRecord` checks the Schnorr event and the recovered BCH `signmessage` proof. |
| **Verify** | Does the chain resolve from signed records? | `resolveEvents` validates the canonical chain and reports status/assurance. |
| **Authenticate** | Can an independent relying party issue a session? | `AuthRequestService` issues a single-use challenge; `buildAuthRequestEvent` signs it; replay and unauthorized rotation are rejected. |
| **Rotate** | Can wallet A authorize wallet B? | `createRotateRecord` is verified; the unauthorized rotation fixture is rejected. |
| **Prove** | Is wallet A still valid history but no longer current? | The historical proof verifies, wallet A is superseded, and the pre-rotation session returns `SESSION_ADDRESS_CHANGED`. |

## Modes

### Guided demo

- Deterministic, unspendable fixtures from `apps/web/lib/lab.ts`.
- No network, wallet or relay.
- The fixture clock is fixed; timestamps are not presented as current time.
- All five stage results are computed on load by the real SDK.

### Live identity

- Reads browser-local identities created at `/create`.
- Resolves from the configured relays via `refreshIdentity`.
- Authenticates with the stored demo key or a NIP-07 signer.
- Rotation publishes a real signed record to the configured relays, only for
  identities whose current BCH key and Nostr key are in this browser.
- External-wallet identities can be verified and authenticated; rotation is
  directed to the identity dashboard where the wallet authorized the chain.

Demo and live results are kept in separate state. They are never merged.

## Evidence inspector

Each stage has an expandable **Evidence** panel with machine-readable inputs
(record IDs, digests, challenge/session values, relay sync, rejected records).
Copy it to reproduce a verdict with the CLI or standalone RP.

## What is not claimed

- Deterministic fixtures are not real-world identities.
- A live rotation publishes to the configured relay; it is not a mainnet
  payment.
- No physical wallet was available for the release environment. The live
  authentication path uses browser-local keys or NIP-07, not a hardware wallet.
- No third-party attestation is implied by the merchant example.

## Reproduce

Browser:

```bash
pnpm relay
pnpm dev
# open http://localhost:3000/challenge
```

Terminal:

```bash
pnpm rp:demo
```

The terminal example reaches the same conclusions without the website.

## Browser QA

`scripts/qa-browser.mjs` checks:

- the five stages render;
- the demo authenticates and rejects unauthorized rotation;
- the demo separates historical proof from current authorization;
- live mode resolves a stored identity and completes authentication.

## Files

- `apps/web/app/challenge/page.tsx` — route and mode switching.
- `apps/web/lib/challenge.ts` — deterministic evidence and auth checks.
- `tests/security-challenge.test.ts` — adversarial suite.
- `examples/relying-party/demo.mjs` — standalone RP.
