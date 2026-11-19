# Independent Relying Party Guide

KYVERA's relying-party flow is implemented in `examples/relying-party` and uses only `@kyvera/sdk`. It does not call the KYVERA website, API or relay.

## 1. Standard demo

```bash
pnpm rp:demo
```

It demonstrates:

- genesis binding resolves ACTIVE;
- single-use challenge authentication;
- replay rejection;
- a different signer is rejected;
- authorized rotation moves the destination;
- historical proof remains valid;
- session invalidation after rotation and revocation;
- missing history returns STALE;
- public regular-event records resolve the lifecycle;
- the SDK separates cryptographic validity from current authorization;
- an offline client reports UNSYNCED.

Result: **13/13 checks passed**.

## 2. Durable store demo

```bash
pnpm rp:persist
```

It uses a file-backed `AuthRequestStore` and simulates process restarts:

1. process A writes a challenge;
2. process B consumes it once and issues a session;
3. process C reads the persisted session;
4. rotation invalidates the session (`SESSION_ADDRESS_CHANGED`);
5. revocation invalidates the session (`SESSION_IDENTITY_REVOKED`);
6. logout removes the session.

Result: **7/7 checks passed**.

## 3. Store contract

`AuthRequestService` accepts an `AuthRequestStore`:

```ts
interface AuthRequestStore {
  putRequest(request: AuthRequest): void;
  takeRequest(challenge: string): AuthRequest | undefined;
  putSession(session: AppSession): void;
  getSession(token: string): AppSession | undefined;
  deleteSession(token: string): boolean;
  prune(now: number): void;
}
```

`takeRequest` MUST atomically remove and return the challenge. The default is in-memory.

The example file store uses atomic temp-file rename and is single-process only. A production RP should use a transactional database with a unique constraint on the challenge and session token.

## 4. Session policy

A session is invalid when:

- it expired;
- the subject changed;
- the chain is no longer ACTIVE;
- assurance is `PARTIAL` or `UNSYNCED`;
- the current BCH address changed;
- the token was logged out or never issued.

Sensitive operations require `ACTIVE + FULL`. A relay withholding a revocation remains a fundamental limitation; a checkpoint detects known rollbacks only.

## 5. Integration boundary

The relying party must:

- use its own origin/domain in the challenge;
- bind the intended subject and address when known;
- re-resolve at authentication and revalidation time;
- never trust cached ACTIVE state;
- verify the signed request digest, origin, session and subject;
- treat `PARTIAL`/`UNSYNCED` as non-final.

## 6. Not production infrastructure

The example store is not a production session database. It does not provide multi-process locking, rate limiting, audit logs or key management.
