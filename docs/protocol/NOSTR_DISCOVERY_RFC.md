# KYVERA Public Nostr Discovery RFC

**Status:** implemented, pending public-relay evidence
**Date:** 2026-11-19
**Scope:** how KYVERA identity records are published, discovered and retained on Nostr
**Verifier:** `@kyvera/verifier` / `@kyvera/nostr`

---

## 1. Decision

KYVERA now publishes **two envelopes for every record**:

| Envelope | Kind | Role |
| --- | --- | --- |
| Public discovery event | **1078** (experimental regular kind) | Primary public record for new verifiers |
| Legacy/mirror event | **30078** (NIP-78 application data) | Backward compatibility and relays that accept application data |

Both envelopes contain the same canonical signed record and the same tags. The verifier accepts either and de-duplicates by `recordId`, so representing one record twice cannot create a false fork.

**Kind 1078 is not a registered NIP kind.** It is an experimental regular event kind in the NIP-01 `1000–9999` range. KYVERA does not claim that it is a standard or that any relay is required to support it.

---

## 2. Why NIP-78 alone is insufficient

NIP-78 states:

> The goal of this NIP is to enable remoteStorage-like capabilities for custom applications that do not care about interoperability.

and:

> These kinds are not meant to be used as a generic interchange format for data that should be public or exchanged between different applications. Applications that need such interoperability should use dedicated kinds instead.

The NIP also says relays **SHOULD** require NIP-42 `AUTH` before accepting or serving kind `30078`, and **SHOULD** only serve those events to the authenticated owner.

That is the opposite of public identity discovery. A relay may legitimately:

- reject an unauthenticated kind-30078 write;
- serve a kind-30078 event only to its author;
- treat the event as private application data and prune it.

The current unique `d` tag (`kyvera:v1:<subject>:<sequence>:<payload-digest>`) prevents records from overwriting each other under addressable-event rules, but it does not fix the privacy/AUTH semantics. The format was therefore not sufficient as the sole public discovery layer.

---

## 3. Alternatives considered

| Option | Result |
| --- | --- |
| Keep only kind 30078 | Rejected. NIP-78 is explicitly for private app data and may be AUTH-gated. |
| Use kind 1 (short text note) | Rejected as the primary format. Kind 1 is broadly stored, but identity JSON would pollute social feeds and be subject to note-oriented client behaviour. |
| Use kind 78 (NIP-78 regular event) | Rejected. Same private-application-data semantics as 30078. |
| Use an existing registered identity kind | None exists that matches the lifecycle record and is supported by BCH/Nostr clients. |
| Invent and claim a new NIP number | Rejected. No false standards claim. |
| Dedicated experimental regular kind | **Selected.** Regular events are expected to be stored by relays under NIP-01, are not replaceable, and can be filtered by single-letter tags. |
| Dual-publish public + legacy | **Selected as migration path.** Preserves compatibility while moving new discovery to a public regular kind. |

---

## 4. Wire format

Both envelopes use the existing canonical record as `content` and the existing tags:

```json
[
  ["d", "kyvera:v1:<subject>:<sequence>:<payload-digest>"],
  ["k", "kyvera-v1"],
  ["s", "<subject>"],
  ["seq", "<sequence>"],
  ["prev", "<previous-record-id-or-genesis>"],
  ["b", "<bch-address>"],
  ["alt", "KYVERA identity record v1 (bind|rotate|revoke)"]
]
```

Rules:

- The event author MUST equal the record `subject` (the Nostr x-only key).
- `created_at` MUST equal `payload.issuedAt`.
- The `d` tag MUST occur exactly once and commit to subject, sequence and payload digest.
- `k` MUST be `kyvera-v1` for both kinds.
- `b` tags MUST list exactly the proof addresses, sorted.
- `prev` MUST equal the payload predecessor or `genesis`.
- `seq` MUST equal the payload sequence.
- Content MUST be canonical KYVERA JSON.

### Discovery filters

```json
{
  "kinds": [1078, 30078],
  "authors": ["<subject>"],
  "#k": ["kyvera-v1"]
}
```

Address lookup:

```json
{
  "kinds": [1078, 30078],
  "#k": ["kyvera-v1"],
  "#b": ["bitcoincash:..."]
}
```

`k`, `b`, `s`, `d` are single-letter tags, which NIP-01 expects relays to index.

---

## 5. Retention and replacement analysis

### Legacy kind 30078

Kind `30078` is an **addressable** event (`30000 ≤ kind < 40000`). Under NIP-01, only the latest event for each `(kind, pubkey, d)` combination MUST be stored. KYVERA uses a unique `d` per subject/sequence/digest, so three lifecycle records produce three distinct addressable slots. The lifecycle does not collapse into one event.

However:

- A relay may still AUTH-gate or prune kind-30078 events.
- Relays may apply application-data retention policies.
- Unique `d` tags are necessary but not sufficient for public retention.

### Public kind 1078

Kind `1078` is a **regular** event (`1000 ≤ kind < 10000`). Under NIP-01, regular events are “expected to be stored by relays”; there is no per-`d` replacement rule. Every record remains a separate event.

Retention is still not guaranteed. A relay may apply rate limits, age limits, storage quotas or moderation. `FULL` assurance means every configured relay completed the request with EOSE; it does not mean every relay in the world disclosed all history.

---

## 6. Threat model

| Threat | Mitigation | Residual risk |
| --- | --- | --- |
| A relay withholds a revocation | Query multiple independent relays; checkpoint comparison; surface `PARTIAL` / `STALE` | A first-time verifier cannot prove global completeness |
| A relay serves an old head | Chain resolution requires a hash-linked predecessor; checkpoint detects rollback | Without a checkpoint, a uniformly withholding relay set is undetectable |
| Addressable-event replacement hides history | Unique `d` per record; public regular kind avoids replacement semantics | Relay pruning remains possible |
| NIP-42 AUTH blocks public reads | Public kind 1078 is a regular event; verifier queries both kinds | Some relays may still restrict unknown kinds |
| Duplicate envelopes look like a fork | De-duplicate verified records by `recordId` | None after de-duplication |
| Event spam / oversized content | 16 KiB content cap; strict schema/tag checks; canonical JSON | Relay-level rate limits vary |
| Equivocation | Same sequence with different records returns `CONFLICT`; no address is asserted | A verifier that sees only one branch cannot detect it |
| Forged author | Nostr event signature + author/subject equality + BCH proof recovery | None within the cryptographic model |
| Replay of an old record | Sequence/previous link; replay cannot move the head backwards | Older record remains a valid historical proof by design |

### Trust statement

KYVERA does **not** claim that two agreeing relays prove complete history. It claims:

- signatures and lifecycle transitions are independently verifiable;
- a record that cannot be placed on the hash-linked chain is not treated as current;
- missing or conflicting evidence is reported explicitly;
- a previously verified checkpoint can detect rollback.

---

## 7. Migration

1. New records are signed twice: legacy kind 30078 and public kind 1078.
2. Both envelopes are published. The public envelope is authoritative for new verifiers.
3. The verifier accepts both kinds and de-duplicates by recordId.
4. Existing kind-30078-only records remain verifiable.
5. The web app stores both envelopes in its local browser cache.
6. No record content, proof, sequence or authorization rule changes.

The legacy mirror may be removed in a future major version once public kind 1078 is observed to be accepted and retained by the configured relay set.

---

## 8. Interoperability tests

Implemented tests (`tests/discovery-format.test.ts`):

- public kind is in the regular range and distinct from kind 30078;
- every lifecycle record has a unique `d` tag committed to subject/sequence/digest;
- both envelopes parse; an unrelated kind is rejected;
- tampering with the `d` tag is rejected;
- filters request both kinds and the indexed `k`/`b` tags;
- a full bind → rotate → revoke lifecycle resolves from public events alone.

Local relay tests use the same filters and both envelopes through `resolveIdentity`.

### Public relay status

**NOT EXECUTED.** `scripts/public-relay-identity-test.mjs` publishes disposable `bind` and `revoke` records to a public relay only when both `I_AUTHORIZE_PUBLIC_RELAY_TEST=yes` and `KYVERA_PUBLIC_RELAY=wss://...` are set.

Explicit authorization is required before executing it. Until then:

- do not claim public retention;
- do not claim third-party public discovery was demonstrated;
- do not claim public relay event IDs.

---

## 9. Compatibility statement

- NIP-01: kind ranges, tags, filters and EOSE are used as specified.
- NIP-78: supported as a legacy/mirror envelope, not claimed as the public discovery mechanism.
- NIP-42: no claim that kind-30078 reads are universally public.
- No new NIP number, DID method or registered event kind is claimed.
- Kind 1078 is experimental and may be changed only with a versioned migration.
