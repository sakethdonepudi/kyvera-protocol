# Demonstration Guide

This is the reproducible demo promised in the bounty submission. Everything below runs locally with no accounts, no API keys and no KYVERA server.

---

## 1. What the demo proves

1. A user controls a Nostr key and a separate BCH wallet key.
2. Both keys sign one canonical record; neither key is derivable from the other.
3. A third party discovers the record from a Nostr relay and verifies it independently.
4. The wallet can be rotated. The old address becomes `SUPERSEDED`, never `ACTIVE`.
5. A stolen Nostr key alone cannot rotate or revoke.
6. The identity can be revoked. Historical proofs remain valid but no address is current.
7. A stale relay cannot roll the state back when a checkpoint is supplied.
8. Equivocation produces `CONFLICT`, not a silent winner.

---

## 2. Setup

```bash
npm install -g pnpm@9.15.9     # or use: npx pnpm@9.15.9 <command>
pnpm install
pnpm build
```

Optional: create `apps/web/.env.local` to change relays or network.

```bash
cp apps/web/.env.example apps/web/.env.local
```

---

## 3. Three-terminal demo

### Terminal 1 — relay

```bash
pnpm relay
```

Expected:

```text
KYVERA demo relay listening on ws://127.0.0.1:7777
store: …/.context/relay-events.json
```

Use `pnpm relay --reset` for a clean store.

### Terminal 2 — web app

```bash
pnpm dev
```

Open <http://localhost:3000>.

### Terminal 3 — seed an identity (optional)

```bash
pnpm demo
```

This creates a random throwaway identity, publishes `bind` and `rotate` to the relay, and prints:

- the npub;
- the current and superseded addresses;
- the exact CLI commands to verify them;
- deep links to the identity, verifier and address lookup.

Add `--revoke` to seed a revoked identity instead of an active one.

---

## 4. Manual walkthrough

### 4.1 Create

1. Open `/create`.
2. Under **Nostr identity**, click **Generate key** (or connect NIP-07).
3. Under **Bitcoin Cash identity**, click **Generate demo wallet**.
4. Read the **BCH proof message** and the canonical Nostr event content. Nothing is hidden.
5. Click **Sign and publish binding**.

Expected: **Binding published**, with one relay accepted. The dashboard link opens `/identity/<npub>`.

### 4.2 Verify independently

1. Open `/verify?npub=<npub>`.
2. Observe `ACTIVE`, `FULL` sync, sequence `#0`, and the current address.
3. In the terminal:

```bash
pnpm cli <npub> --relay ws://127.0.0.1:7777
```

Expected: `status: ACTIVE (ACTIVE_HEAD)` and exit code `0`.

### 4.3 Rotate

1. Return to the dashboard.
2. Click **Prepare rotation**, then **Rotate now**.
3. Observe the new address as current and the old address under **Superseded addresses**.

Verify the old address:

```bash
pnpm cli --address <old-address> --relay ws://127.0.0.1:7777
```

Expected: `status: SUPERSEDED`, exit code `0`.

The historical `bind` signature still verifies — that is the point. It is simply not current.

### 4.4 Revoke

1. On the dashboard, click **Revoke binding**.
2. Type `REVOKE`, confirm.
3. Observe `REVOKED` and no current address.
4. Re-run the CLI for the npub and for the last address.

Expected: `REVOKED` for both. No fallback to the old address.

### 4.5 Authenticate

1. Open `/auth?npub=<npub>`.
2. **Resolve**, then **Create challenge**, then **Sign and verify**.

Expected: `Authenticated`. After revocation, the same flow returns `IDENTITY_REVOKED`.

### 4.6 Adversarial evidence in one command

```bash
pnpm demo:lifecycle
```

Expected: `All checks passed.` This runs an in-process relay and asserts:

- genesis → active;
- rotation → new active, old superseded;
- forged rotation → rejected record;
- revocation → revoked, address lookup revoked;
- stale relay + checkpoint → `ROLLBACK_DETECTED`;
- equivocation → `CONFLICT` with no active address.

---

## 5. Suggested demo video script (3–4 minutes)

| Time | Shot | Narration |
| --- | --- | --- |
| 0:00–0:25 | Landing page | "A signature proves what happened. It doesn't prove what is authorized now." |
| 0:25–0:55 | Create page | "Two independent keys. Here is the exact BCH message and the exact Nostr content each one signs." |
| 0:55–1:15 | Publish + dashboard | "The binding resolves as ACTIVE from signed events. No KYVERA server." |
| 1:15–1:45 | Rotation | "The old wallet explicitly authorizes the new one. The old address is now SUPERSEDED." |
| 1:45–2:10 | Old address verifier | "Same signature, same historical validity — different current authorization." |
| 2:10–2:35 | CLI | "The standalone CLI reaches the same result. Exit code zero." |
| 2:35–2:55 | Revocation | "Signed by the current wallet and the identity key. No fallback." |
| 2:55–3:15 | Auth | "A relying app checks the live key against the active state. Single-use challenge." |
| 3:15–3:40 | `pnpm demo:lifecycle` | "Unauthorized rotation, rollback and equivocation are executable tests, not claims." |
| 3:40–4:00 | Limitations slide | "No recovery, no absolute rollback protection, no production audit. The protocol says so." |

Do not claim a live wallet test in the video unless one is actually performed on camera.

---

## 6. Evidence to capture for submission

- Screenshots: create preview, dashboard ACTIVE, dashboard after rotation, verifier SUPERSEDED, auth success, dashboard REVOKED.
- Terminal: `pnpm test` summary (82 tests), `pnpm demo:lifecycle` (all checks).
- CLI output for ACTIVE and SUPERSEDED.
- A short screen recording following the script above.

Screenshots from the local validation run are in `.context/screens/` and are gitignored. Copy the final set into a public location (repository `docs/` or the submission gallery) before submitting.
