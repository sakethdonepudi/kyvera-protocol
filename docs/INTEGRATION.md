# Integration Guide

KYVERA verification is a library call, not a hosted decision. This guide is for
a developer who wants to verify identities and authenticate users without using
the KYVERA website or any proprietary service.

---

## 1. Packages

| Package | Responsibility |
| --- | --- |
| `@kyvera/core` | Canonical KCJ-1 records, schema, digests, BCH proof message. |
| `@kyvera/bch` | CashAddr handling, `signmessage` signing/recovery. |
| `@kyvera/nostr` | NIP-01 events, BIP-340 signatures, record events. |
| `@kyvera/verifier` | Record verification, chain resolution, relay discovery, auth/session. |

The packages have no KYVERA backend dependency.

## 2. Verify a record

```ts
import { verifyEventRecord } from "@kyvera/verifier";

const result = verifyEventRecord(event, { now, network: "mainnet" });
if (!result.ok) throw new Error(`${result.code}: ${result.message}`);
```

A valid result means:

- the Nostr event signature is valid;
- the canonical record parses strictly;
- the BCH `signmessage` proof recovers to the declared address;
- the payload digest matches;
- the record type and sequence constraints hold.

## 3. Resolve an authorization chain

```ts
import { resolveEvents } from "@kyvera/verifier";

const { resolution, rejected } = resolveEvents(events, { now });
```

`resolution.status` is one of `ACTIVE`, `REVOKED`, `EXPIRED`, `CONFLICT`,
`STALE` or `UNVERIFIED`.

`resolution.history` is the valid chain, oldest first. `resolution.superseded`
lists earlier addresses. `resolution.rejected` contains structurally valid
events that failed verification.

**Never treat an incomplete relay result as a complete chain.** `resolveEvents`
is the pure local chain verdict; `resolveIdentity` adds relay freshness and
per-relay reports. A missing sequence produces `STALE` /
`MISSING_CHAIN_SEGMENT`; conflicting sequence records produce `CONFLICT`.

## 4. Discover from relays

```ts
import { resolveIdentity } from "@kyvera/verifier";

const resolution = await resolveIdentity({
  subject,
  relays: ["wss://relay.example"],
  network: "mainnet",
  now,
  additionalEvents: locallyKnownEvents,
});
```

Inspect `resolution.sync` and `resolution.assurance`:

- `FULL` — every configured relay responded;
- `PARTIAL` — some relays responded;
- `UNSYNCED` — current state could not be established.

An `UNSYNCED` identity must not be treated as current.

## 5. Authenticate a user

```ts
import {
  AuthRequestService,
  buildAuthRequestEvent,
  validateAppSession,
} from "@kyvera/verifier";

const rp = new AuthRequestService({
  origin: "https://app.example",
  ttlSeconds: 120,
  sessionTtlSeconds: 900,
});

const request = rp.issue({
  expectedSubject: resolution.subject,
  expectedAddress: resolution.activeBch?.address,
});

// The user's signer signs the request event.
const event = await buildAuthRequestEvent({ request, signer, createdAt: now });
const { check, session } = rp.verify(event, resolution);
```

The request commits to origin, session, intended subject, expected address,
protocol and expiry through a whole-request digest. A challenge is consumed on
first success; replay returns `UNKNOWN_CHALLENGE`.

Validate the session on every protected request:

```ts
const validity = rp.validate(session.token, freshResolution);
if (!validity.valid) logout();
```

Rotation returns `SESSION_ADDRESS_CHANGED`; revocation returns
`SESSION_IDENTITY_REVOKED`.

## 6. Standalone relying party

```bash
pnpm rp:demo
```

`examples/relying-party/demo.mjs` builds deterministic records, resolves them,
authenticates, checks replay, tests an unrelated signer, rotates, revokes, and
verifies missing history. It prints `10/10 checks passed`.

No KYVERA website, API, relay or proprietary service is used.

## 7. Sample records and vectors

| Resource | Location |
| --- | --- |
| Deterministic identity records | `examples/relying-party/demo.mjs` |
| Canonical/proof vectors | `tests/fixtures/vectors.json`, served at `/vectors.json` |
| Valid and invalid signature tests | `tests/binding.test.ts`, `tests/rotation.test.ts`, `tests/revocation.test.ts` |
| Offline verifier | `demo/kyvera-standalone.html` |
| Chain outcomes | `tests/chain.test.ts`, `tests/property.test.ts` |

All fixture keys are unspendable and derived from labels. Never fund their
addresses.

## 8. Reproducible commands

```bash
pnpm test                 # 134 tests
pnpm rp:demo              # standalone relying party, 10/10
pnpm cli <npub> --relay wss://relay.example
pnpm wallet:verify <cashaddr> <base64-signature>
```

## 9. Trust boundary

- The verifier does not trust a KYVERA server, because there is none.
- It trusts the configured relays only for **availability**, not for truth; every
  signature is checked locally.
- It cannot prove that a relay set is withholding history. Checkpoints detect
  known rollbacks; first-contact completeness remains an explicit limitation.
- Wallet message signing is not available through WizardConnect. `/create` uses
  the wallet's own Sign Message UI and verifies the pasted signature.

## 10. Related documents

- [`PROTOCOL.md`](PROTOCOL.md)
- [`THREAT_MODEL.md`](THREAT_MODEL.md)
- [`SECURITY_LIMITATIONS.md`](SECURITY_LIMITATIONS.md)
- [`TRUST_CHALLENGE.md`](TRUST_CHALLENGE.md)
- [`WALLET_UX_AUDIT.md`](WALLET_UX_AUDIT.md)
