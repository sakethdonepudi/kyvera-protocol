# SDK Quickstart

`@kyvera/sdk` is a developer-facing wrapper over the KYVERA verifier. It has no hosted KYVERA dependency, no telemetry and no embedded secrets.

## 1. Build the workspace

```bash
pnpm install --frozen-lockfile
pnpm build
```

The SDK is a workspace package (`packages/sdk`). It is not published to npm.

## 2. Resolve and verify

```ts
import { KyveraClient } from "@kyvera/sdk";

const client = new KyveraClient({
  relays: ["wss://nos.lol", "wss://relay.primal.net"],
});

const result = await client.verify(npub);

if (!result.currentAuthorization.usableForSensitiveOperations) {
  console.error(result.status, result.reasonCode, result.evidenceCompleteness.assurance);
}
```

`verify()` returns:

| Field | Meaning |
| --- | --- |
| `status` | ACTIVE / SUPERSEDED / REVOKED / EXPIRED / CONFLICT / STALE / UNKNOWN / INVALID |
| `cryptographicValidity` | At least one valid record and no rejected valid-shaped record |
| `historicalValidity.records` | Each authorized record with sequence, digests and address |
| `currentAuthorization.authorized` | Chain is ACTIVE with a destination |
| `currentAuthorization.usableForSensitiveOperations` | Also requires FULL relay agreement |
| `evidenceCompleteness` | FULL / PARTIAL / UNSYNCED, per-relay status and sources |
| `checks` | Explicit check list |
| `resolution` | Raw evidence, including verified events |

## 3. Address lookup

```ts
const address = await client.resolveAddress("bitcoincash:q...");
console.log(address.status, address.bindings);
```

## 4. One record

```ts
const checked = client.verifyRecord(event);
if (!checked.ok) console.log(checked.code, checked.message);
```

## 5. Challenge-response

```ts
import {
  AuthRequestService,
  buildAuthRequestEvent,
} from "@kyvera/sdk/auth";

const service = new AuthRequestService({
  origin: "https://app.example",
  ttlSeconds: 120,
  sessionTtlSeconds: 900,
});

const request = service.issue({ expectedSubject: subject });
const event = await buildAuthRequestEvent({ request, signer });
const { check, session } = service.verify(event, resolution);
```

`AuthRequestService` consumes a challenge before verification, so a failed attempt cannot be retried with the same challenge. Pass a durable `AuthRequestStore` for a standalone relying party.

## 6. Evidence export

```ts
const json = client.exportEvidence(result);
```

No private keys, secrets or live session tokens are included.

## 7. Runnable examples

```bash
pnpm rp:demo       # independent relying-party flow, 13 checks
pnpm rp:persist    # durable file-backed sessions, 7 checks
node examples/sdk-node/verify.mjs <npub> --relay wss://...
```

## 8. Errors

`KyveraSdkError` exposes a stable `code`:

- `INVALID_SUBJECT`
- `INVALID_OPTIONS`
- `RESOLUTION_FAILED`
- `ADDRESS_INVALID`

## 9. Status

The SDK passes strict TypeScript and the repository test suite. It is not independently audited and is not published to npm.
