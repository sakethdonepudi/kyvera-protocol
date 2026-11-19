# @kyvera/sdk

Developer-facing KYVERA SDK. It resolves BCH–Nostr identity lifecycles, verifies both proofs, reports current authorization separately from historical validity, and provides challenge-response helpers.

The SDK has **no hosted KYVERA dependency, no telemetry and no embedded secrets**. It uses the public relay set you provide.

```bash
pnpm add @kyvera/sdk @kyvera/core
```

## Resolve and verify

```ts
import { KyveraClient } from "@kyvera/sdk";

const client = new KyveraClient({
  relays: ["wss://nos.lol", "wss://relay.primal.net"],
});

const result = await client.verify(npub);

console.log(result.status);                                // ACTIVE, STALE, REVOKED, ...
console.log(result.currentAuthorization.authorized);       // chain-level current authorization
console.log(result.currentAuthorization.usableForSensitiveOperations); // also requires FULL relay agreement
console.log(result.evidenceCompleteness.assurance);        // FULL, PARTIAL, UNSYNCED
console.log(result.historicalValidity.records);
console.log(result.checks);
```

`verify()` never returns only `true`/`false`. It separates:

- **cryptographic validity** — signatures and proofs;
- **historical validity** — whether each record was authorized at its position;
- **current authorization** — whether the chain is `ACTIVE` with a destination;
- **evidence completeness** — relay agreement (`FULL`, `PARTIAL`, `UNSYNCED`).

## Address lookup

```ts
const address = await client.resolveAddress("bitcoincash:q...");
console.log(address.status, address.bindings);
```

## Record verification

```ts
const checked = client.verifyRecord(event);
if (!checked.ok) console.log(checked.code, checked.message);
```

## Challenge-response

```ts
import { AuthRequestService, buildAuthRequestEvent, validateAppSession } from "@kyvera/sdk/auth";

const service = new AuthRequestService({
  origin: "https://app.example",
  ttlSeconds: 120,
  sessionTtlSeconds: 900,
});

const request = service.issue({ expectedSubject: subject });
// Sign the request with the user's Nostr key:
const event = await buildAuthRequestEvent({ request, signer });

const { check, session } = service.verify(event, resolution);
if (check.authenticated && session) {
  // Later, after re-resolving:
  const current = service.validate(session.token, freshResolution);
  if (!current.valid) {
    // SESSION_ADDRESS_CHANGED, SESSION_IDENTITY_REVOKED, SESSION_PARTIAL, ...
  }
}
```

`AuthRequestService` is in-memory. A production relying party must persist challenges and sessions atomically and enforce expiration server-side.

## Evidence export

```ts
const json = client.exportEvidence(result);
```

The exported object contains records, events, proofs, relay provenance and the structured result. It never contains private keys.

## Security

Read [`docs/SECURITY_MODEL.md`](../../docs/SECURITY_MODEL.md), [`docs/protocol/NOSTR_DISCOVERY_RFC.md`](../../docs/protocol/NOSTR_DISCOVERY_RFC.md) and [`docs/security/KNOWN_LIMITATIONS.md`](../../docs/security/KNOWN_LIMITATIONS.md).

No independent audit is claimed. Public relay retention and real-wallet signing remain untested until evidence is recorded.
