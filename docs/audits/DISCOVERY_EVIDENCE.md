# Nostr Discovery Evidence

**Date:** 2026-11-19
**Format:** public kind `1078` + legacy kind `30078`
**Status:** local lifecycle PASS; **public lifecycle PASS on two relays**; short-term retention observed; indefinite retention not claimed.

---

## 1. Read-only public relay health

Command:

```bash
pnpm relay:health wss://nos.lol wss://relay.primal.net
```

Observed:

| Relay | ok | EOSE | events | latency |
| --- | --- | --- | --- | --- |
| `wss://nos.lol` | true | true | 1 | 818 ms |
| `wss://relay.primal.net` | true | true | 1 | 1304 ms |

Result: **2/2 healthy**. No KYVERA event was published.

---

## 2. Local full-lifecycle relay test

Command:

```bash
I_AUTHORIZE_LOCAL_RELAY_TEST=yes \
KYVERA_PUBLIC_RELAY=ws://127.0.0.1:7777 \
node scripts/public-relay-identity-test.mjs
```

Observed:

- `bind` accepted as both legacy and public envelopes.
- `rotate A→B` accepted as both envelopes.
- Full history reconstructed: 2 valid records, wallet A superseded, wallet B active.
- Forged rotation (Nostr key + attacker wallet, no valid current-key proof) accepted by the relay as an event but **rejected by the verifier**; wallet B stayed active and the forged event appeared in `rejected`.
- `revoke` accepted as both envelopes.
- Final resolution: `REVOKED · REVOKED_HEAD · FULL`; no active address.
- Retrieval: 3 public events, 4 legacy events (including the forged legacy event).
- Missing rotation: `STALE · MISSING_CHAIN_SEGMENT`; no fallback to wallet A.
- The identity ended revoked; no active public address remains.

This proves the dual-envelope format, full local lifecycle reconstruction, rejection of an unauthorized transition, and fail-closed missing-history behavior.

It does not prove public relay retention or third-party discovery.

---

## 3. Public lifecycle test

Executed with explicit authorization on 2026-11-19 against:

- `wss://nos.lol`
- `wss://relay.primal.net`

Command:

```bash
I_AUTHORIZE_PUBLIC_RELAY_TEST=yes \
KYVERA_PUBLIC_RELAY=wss://nos.lol,wss://relay.primal.net \
node scripts/public-relay-identity-test.mjs
```

### Observed result

| Item | Result |
| --- | --- |
| Disposable npub | `npub18r22gp9eml92422y5m5fq7lryws22vgcek4prqgt6spqwdfy07cq6u6hs4` |
| Relays | `wss://nos.lol`, `wss://relay.primal.net` |
| Bind accepted | legacy + public, both relays |
| Rotate A→B accepted | legacy + public, both relays |
| Forged rotate accepted by relay | yes, legacy, both relays |
| Forged rotate rejected by verifier | yes; wallet B stayed active |
| Revoke accepted | legacy + public, both relays |
| Final status | `REVOKED · REVOKED_HEAD · FULL` |
| History | 3 valid records |
| Retrieved | 3 public + 4 legacy events |
| Missing history | `STALE · MISSING_CHAIN_SEGMENT` |
| Follow-up re-query | both relays returned 7 events each; status still `REVOKED` |

The full machine-readable evidence is in [`docs/audits/public-relay-evidence-2026-11-19.json`](public-relay-evidence-2026-11-19.json).

### Public event IDs

| Record | Public kind 1078 | Legacy kind 30078 |
| --- | --- | --- |
| bind | `9f5d4de0f57db9370ad19f503ced24197f43ff0be8f13f4c47b62b129c4d0db3` | `211dc8a96f25e5da3807ae75e6b1354f32bb609695d5d0aa0a8ad7b3049d4abc` |
| rotate | `4db78488888ae7e853dc0b16b9e8007d89abd9b711bb53b26f6ef88bb8bd0250` | `f57a69db8dfe2d82c3519456ea2bdfe1c761545891a3ddebb32bdd99b285a182` |
| revoke | `32b0fe22bb3f742748a10d9753a96cc6392e32f556048bda62d2c66d42a52791` | `65e6fdad9e4469481274d7e0e6f910c02267f5b08c34b614283632760560b231` |
| forged rotate | not mirrored | `7336cf43c5eca692c07a9cb699438f25280c82e925873b8047ebcad3ff598b89` |

The disposable identity is revoked. The attack wallet was never funded and no transaction was broadcast.

---

## 4. Checks performed

| Check | Status |
| --- | --- |
| Public event kind is regular (`1078`) and not addressable | PASS |
| Unique `d` tag per record | PASS |
| Legacy `30078` mirror parses | PASS |
| Both kinds queried by subject | PASS |
| Both kinds queried by address | PASS |
| Full lifecycle from public events alone | PASS (local test) |
| Forged rotation rejected | PASS (local test) |
| Missing history fails closed | PASS (local test) |
| Public relay retention | PASS (short-term, two relays) |
| Independent third-party client retrieval | PASS (two relays, full lifecycle) |
| Indefinite retention | NOT CLAIMED |

---

## 5. What remains

1. Re-query after 24–48 hours to observe longer retention/pruning.
2. Do not promote the revoked identity or fund the disposable addresses.
3. Re-run before the final submission if the event IDs are needed in the BUIDL description.
4. Mark any future relay set as observed, not guaranteed.
