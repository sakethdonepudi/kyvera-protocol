# Independent relying-party example

A framework-independent Node application that verifies KYVERA identities and
issues its own authentication session using only the public packages.

It does **not** call the KYVERA website, a KYVERA API, a relay, or a proprietary
service. It builds deterministic sample records, then exercises the same
verifier functions a third-party app would import.

## Run

```bash
pnpm rp:demo
```

Expected: `10/10 checks passed`.

## What it demonstrates

1. A dual-signed genesis binding resolves as `ACTIVE`.
2. A relying party issues a fresh 32-byte challenge bound to its origin and
   session, and verifies the user's Nostr signature.
3. Replaying the same challenge returns `UNKNOWN_CHALLENGE`.
4. A different signer returns `SUBJECT_MISMATCH`.
5. Authorized rotation moves the current address from wallet A to wallet B and
   marks A as superseded.
6. Wallet A's historical proof remains independently valid.
7. A pre-rotation session is invalidated with `SESSION_ADDRESS_CHANGED`.
8. Revocation terminates the chain and invalidates the session.
9. A sequence-2 record without sequence 1 produces `STALE` /
   `MISSING_CHAIN_SEGMENT`; the resolver does not silently claim sequence 2.

## Code shape

```js
import {
  AuthRequestService,
  buildAuthRequestEvent,
  resolveEvents,
  validateAppSession,
} from "@kyvera/verifier";

const resolution = resolveEvents(events, { now }).resolution;
const rp = new AuthRequestService({ origin: "https://app.example" });
const request = rp.issue({
  expectedSubject: resolution.subject,
  expectedAddress: resolution.activeBch?.address,
});
const event = await buildAuthRequestEvent({ request, signer });
const { check, session } = rp.verify(event, resolution);
```

The relying party owns its challenge/session state. It never asks KYVERA for a
login decision.

## Limits

- Deterministic local keys, not a real wallet or NIP-07 signer.
- No relay I/O in this example; see `apps/web/lib/identity.ts` and
  `tests/relay.test.ts` for relay discovery.
- Session state is in memory. A production relying party must persist used
  challenge IDs and sessions for their TTL and bind them to a server-side
  session.

## Related

- [`docs/PROTOCOL.md`](../../docs/PROTOCOL.md) — canonical records and verification.
- [`docs/WALLET_UX_AUDIT.md`](../../docs/WALLET_UX_AUDIT.md) — wallet API findings.
- [`/auth-demo`](../../apps/web/app/auth-demo/page.tsx) — browser relying party.
- [`demo/kyvera-standalone.html`](../../demo/kyvera-standalone.html) — offline verifier.
