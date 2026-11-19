# KYVERA Protocol Specification v1

**Status:** implementation specification, not an audited standard
**Version:** 1 (`kyvera`, payload `version: 1`)
**Editors:** KYVERA contributors
**Last updated:** 2026-11-18

This document defines the byte-level rules an independent implementation must follow to interoperate with the reference SDK. The reference implementation is TypeScript in [`packages/core`](../packages/core) and [`packages/verifier`](../packages/verifier).

---

## 1. Conventions

- `sha256(x)` is SHA-256 over the exact bytes of `x`.
- `hex32` is 32 bytes encoded as 64 lowercase hexadecimal characters.
- `||` is byte concatenation.
- Unix times are integer seconds.
- "MUST", "MUST NOT", "SHOULD" follow RFC 2119.
- Keys are secp256k1. No other curve is supported in v1.

## 2. Identity model

An identity is identified by its **Nostr public key** (`subject`), a 32-byte x-only secp256k1 key.

An identity MAY have:

- a current BCH **P2PKH** CashAddr (`bch.address`);
- a 33-byte compressed BCH public key (`bch.publicKey`, optional/informative);
- an expires-at timestamp.

The BCH key and the Nostr key MUST be different keys. A record whose BCH public key has the same x-only coordinate as `subject` MUST be rejected (`KEY_REUSE`). Deriving one key from the other is forbidden.

A BCH address is not treated as a public key. Control is established only by recovering the signing key from a `signmessage` signature and comparing `hash160(recoveredKey)` with the P2PKH payload.

## 3. Canonical JSON (KCJ-1)

All signed records are serialized with KCJ-1. Implementations MUST produce and accept exactly these bytes:

1. UTF-8 encoding.
2. No whitespace between tokens.
3. Object keys sorted ascending by UTF-16 code unit order.
4. Strings are normalized to Unicode NFC and escaped with standard JSON escaping.
5. Numbers MUST be safe integers (`|n| ≤ 2^53 − 1`). Floating point, `NaN`, `Infinity` and `-0` are forbidden (`-0` serializes as `0`).
6. Values are limited to `null`, booleans, safe integers, strings, arrays and plain objects.
7. Unknown fields are forbidden at every level of the record schema.
8. Nesting depth is limited to 32.

A published event is valid only if its `content` string is **byte-identical** to `KCJ-1(JSON.parse(content))`. This prevents duplicate encodings of one authorization.

Test vector (from `tests/fixtures/vectors.json`):

```json
{
  "value": { "b": 2, "a": 1 },
  "canonical": "{\"a\":1,\"b\":2}",
  "sha256": "43258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777"
}
```

## 4. Record payload

```json
{
  "protocol": "kyvera",
  "version": 1,
  "type": "bind",
  "subject": "<hex32>",
  "sequence": 0,
  "previous": null,
  "bch": {
    "address": "bitcoincash:q…",
    "network": "mainnet",
    "publicKey": "<66 hex or null>"
  },
  "issuedAt": 1794000000,
  "expiresAt": null,
  "nonce": "<hex32>"
}
```

### 4.1 Fields

| Field | Type | Rules |
| --- | --- | --- |
| `protocol` | string | MUST be `"kyvera"`. |
| `version` | integer | MUST be `1`. |
| `type` | string | `bind`, `rotate` or `revoke`. |
| `subject` | hex32 | Nostr public key; MUST equal the event author. Lowercase. |
| `sequence` | integer | 0 ≤ n ≤ 1,000,000. `bind` MUST be 0; other types MUST be > 0. |
| `previous` | hex32 \| null | `null` for `bind`; otherwise the digest of the preceding signed record. |
| `bch` | object \| null | Required for `bind`/`rotate`; MUST be `null` for `revoke`. |
| `bch.address` | string | Lowercase prefixed CashAddr. MUST decode as P2PKH. Network prefix must match `bch.network`. |
| `bch.network` | string | `mainnet` (`bitcoincash:`) or `chipnet` (`bchtest:`). |
| `bch.publicKey` | hex66 \| null | Optional compressed key. If present it MUST hash to the address and match the recovered proof key. |
| `issuedAt` | integer | > 0. MUST equal the Nostr event `created_at`. |
| `expiresAt` | integer \| null | If non-null, MUST be > `issuedAt`. |
| `nonce` | hex32 | Random per record. Prevents duplicate digests for otherwise identical authorizations. |

### 4.2 Type matrix

| Type | Sequence | `previous` | `bch` | BCH proofs |
| --- | --- | --- | --- | --- |
| `bind` | 0 | `null` | object | one, role `new` |
| `rotate` | > 0 | digest | object (new wallet) | one `current`, one `new` |
| `revoke` | > 0 | digest | `null` | one, role `current` |

For `rotate`, the `current` and `new` addresses MUST differ. For `bind`/`rotate`, the `new` proof address MUST equal `bch.address`.

## 5. BCH proof

### 5.1 Proof object

```json
{
  "algorithm": "bch-signmessage-v1",
  "role": "new",
  "address": "bitcoincash:q…",
  "signature": "<base64, 65 bytes decoded>"
}
```

`role` is `current` or `new`. Roles are unique within a record. The reference implementation serializes proofs in role order: `bind` → `[new]`, `rotate` → `[current, new]`, `revoke` → `[current]`. Verifiers must accept any order, but the published byte order determines the record id and therefore the next record's `previous` value.

### 5.2 Signed message

The message is UTF-8 text with `\n` separators and no trailing newline:

```text
KYVERA/v1/bch-proof
role:<current|new>
address:<cashaddr>
record:<payload digest>
```

- `payload digest = sha256(KCJ-1(payload))`, lowercase hex.
- The domain string is fixed and includes the protocol version.
- The role prevents a `new`-key proof from being reused as a `current`-key authorization.
- The address prevents cross-address substitution.
- The record digest binds sequence, subject, type, timestamps, nonce and the destination address.
- The message is ~150 bytes, below the 253-byte interoperability limit of several wallet `signmessage` implementations.

### 5.3 Wallet signature hash

The signed bytes follow the Bitcoin/BCH `signmessage` convention exactly:

```text
hash256( 0x18 || "Bitcoin Signed Message:\n" || compactSize(len(message)) || message )
```

where `0x18` is the CompactSize length of the magic string. `hash256(x) = sha256(sha256(x))`.

### 5.4 Signature encoding

65 bytes, base64:

- byte 0: header.
  - `27..30`: uncompressed public key, recovery id = header − 27.
  - `31..34`: compressed public key, recovery id = header − 31.
- bytes 1..64: compact ECDSA signature `(r || s)`.

A verifier MUST:

1. recover the public key from the signature and message hash;
2. reject if `hash160(recoveredKey)` does not equal the address payload;
3. if `bch.publicKey` is present, require it to equal the recovered key;
4. reject if the recovered key shares its x-coordinate with `subject`.

Because the signature lives inside the Nostr-signed content, ECDSA malleability cannot create a new authorization: changing any signature byte changes the event content and requires a new Nostr signature.

### 5.5 Address type

Only P2PKH is supported. P2SH and token-aware addresses are rejected, because `signmessage` proves possession of one key, not a script policy.

### 5.6 Interoperability evidence

`tests/interop.test.ts` verifies a signmessage signature published by the independent `nostr-bch-bind v1` implementation against the same CashAddr and message. This confirms the format is not merely self-consistent.

## 6. Nostr event

### 6.1 Envelopes

A record is published in two envelopes with identical `content` and tags:

| Kind | Role |
| --- | --- |
| `1078` | Public regular-event discovery (experimental, unregistered) |
| `30078` | Legacy NIP-78 application-data mirror |

```json
{
  "kind": 1078,
  "created_at": 1794000000,
  "tags": [...],
  "content": "<KCJ-1 signed record>",
  "pubkey": "<subject>",
  "id": "...",
  "sig": "..."
}
```

`created_at` MUST equal `payload.issuedAt`. `pubkey` MUST equal `payload.subject`. The event `id`/`sig` follow NIP-01 and are BIP-340 Schnorr signatures. A verifier MUST accept both kinds and de-duplicate by record id.

NIP-78 kind `30078` is private application data and may be AUTH-gated; it is retained for compatibility, not as the sole public discovery mechanism. See [`docs/protocol/NOSTR_DISCOVERY_RFC.md`](protocol/NOSTR_DISCOVERY_RFC.md).

### 6.2 Tags

Exactly these tags are written by the reference implementation:

```text
["d",    "kyvera:v1:<subject>:<sequence>:<payload digest>"]
["k",    "kyvera-v1"]
["s",    "<subject>"]
["seq",  "<sequence>"]
["prev", "<previous digest>" | "genesis"]
["b",    "<address>" ]   (one per distinct proof address, sorted)
["alt",  "KYVERA identity record v1 (<type>)"]
```

Verification rules:

- exactly one `d` tag, equal to the computed value above;
- exactly one `k` tag with `kyvera-v1`;
- `s`, `seq`, `prev` match the payload;
- the set of `b` tags equals the set of proof addresses;
- `alt` is optional and unvalidated;
- unknown tags are ignored for forward compatibility, but cannot change the computed authorizations.

The `d` value includes the payload digest, so two conflicting records at the same sequence produce different keys and can both be retained. For public kind `1078`, regular-event semantics mean records are not replaced; for legacy kind `30078`, the unique `d` value prevents addressable replacement from collapsing the lifecycle. This is what makes equivocation observable.

### 6.3 Discovery filters

By subject:

```json
{ "kinds": [1078, 30078], "authors": ["<subject>"], "#k": ["kyvera-v1"] }
```

By address:

```json
{ "kinds": [1078, 30078], "#k": ["kyvera-v1"], "#b": ["<cashaddr>"] }
```

A verifier MUST NOT trust the `b` tag alone. It uses the tag only to discover candidate subjects, then fetches each subject's full chain and re-verifies it.

## 7. Digests and chaining

```text
payload digest = sha256(KCJ-1(payload))
record id      = sha256(KCJ-1({ payload, proofs }))
```

`previous` in record N is the **record id** of record N−1, so the entire signed artifact — including its proofs — is committed to. Genre-appropriate substitution of a proof is therefore a different record and breaks the chain.

## 8. Transition rules

Given the current head H and candidate next record N:

1. H MUST NOT be a `revoke`.
2. N MUST NOT be a `bind`.
3. `N.sequence = H.sequence + 1`.
4. `N.previous = recordId(H)`.
5. `N.issuedAt > H.issuedAt`.
6. H MUST authorize a BCH identity.
7. N's `current` proof MUST be by H's authorized BCH address.
8. For `rotate`, N's `new` proof MUST be by `N.bch.address`, and the two addresses MUST differ.

Any failure yields `INVALID` with a specific reason code (`TRANSITION_AFTER_REVOKE`, `BIND_AFTER_GENESIS`, `SEQUENCE_GAP`, `WRONG_PREVIOUS`, `TIME_NOT_MONOTONIC`, `CURRENT_PROOF_MISMATCH`, `MISSING_NEW_PROOF`, `ROTATION_ADDRESS_REUSED`).

## 9. Resolution algorithm

Input: a set of candidate events for one subject, verification time `now`, optional expected network.

### 9.1 Individual verification

For each unique event:

1. verify the Nostr event id and Schnorr signature;
2. reject non-canonical content;
3. validate the strict schema;
4. require author = subject and `created_at = issuedAt`;
5. reject `issuedAt > now + 600`;
6. verify all BCH proofs as in §5;
7. enforce distinct keys;
8. compute payload digest and record id.

A record can be individually valid and still not belong to the authorized chain. Both results are exposed separately.

### 9.2 Chain construction

1. If there are no valid records:
   - no candidates at all → `UNKNOWN`;
   - candidates but all invalid → `INVALID` (`NO_VERIFIABLE_RECORDS`).
2. There must be exactly one valid sequence-0 `bind`.
   - none, with transitions present → `STALE` (`MISSING_GENESIS`);
   - more than one → `CONFLICT` (`GENESIS_EQUIVOCATION`).
3. At each step, examine all valid records at `head.sequence + 1`.
   - more than one → `CONFLICT` (`SEQUENCE_EQUIVOCATION`);
   - exactly one whose `previous` does not match → `CONFLICT` (`CHAIN_FORK`);
   - one that fails §8 → `INVALID`.
4. Continue until there is no next-sequence record or the head is a `revoke`.
5. Examine all valid records not in the chain:
   - any at a sequence ≤ head → `CONFLICT` (`HISTORICAL_EQUIVOCATION`);
   - any after a revocation → `CONFLICT` (`TRANSITION_AFTER_REVOKE`);
   - lowest sequence greater than `head + 1` → `STALE` (`MISSING_CHAIN_SEGMENT`);
   - otherwise → `CONFLICT` (`CHAIN_FORK`).
6. If the head is `revoke` → `REVOKED`.
7. Else if `expiresAt` is non-null and `now > expiresAt` → `EXPIRED`.
8. Else → `ACTIVE`.

`activeBch` is populated only for `ACTIVE` and `EXPIRED`. It is `null` for `REVOKED`, `CONFLICT`, `STALE`, `INVALID` and `UNKNOWN`. A verifier MUST NOT fall back to the last historical address.

### 9.3 Superseded history

For the valid chain, every BCH address replaced by a later address is listed as superseded. If the head is a revocation, the last authorized address is marked `replacedBy: "revoked"`.

## 10. Address lookup

Given an address A:

1. Discover candidate subjects via the `#b` filter.
2. Fetch and resolve each subject's full chain.
3. Classify A relative to each chain:
   - current address of an `ACTIVE` chain → `ACTIVE`;
   - current address of an `EXPIRED` chain → `EXPIRED`;
   - address that was current at revocation → `REVOKED`;
   - an address rotated away earlier → `SUPERSEDED` (even after the identity is later revoked);
   - chain `CONFLICT`/`STALE`/`INVALID` → propagate that uncertainty;
   - referenced but never authorized → `INVALID`.
4. Multiple identities may bind the same address; all bindings are reported. The overall result takes the strongest conclusive status (`ACTIVE` first).

## 11. Freshness and assurance

Relays are queried independently and reported individually:

| Assurance | Condition |
| --- | --- |
| `FULL` | Every configured relay connected and sent EOSE. |
| `PARTIAL` | At least one relay responded; some failed or lacked EOSE. |
| `UNSYNCED` | No relay responded. |

`UNSYNCED` forces the status to `STALE` (`RELAYS_UNREACHABLE`) and `activeBch = null`, even if cached events are present. Cached events may still be displayed as history.

### 11.1 Checkpoints

A caller that previously verified `(sequence S, recordId R)` may pass a checkpoint:

- sequence S missing and head < S → `STALE` (`ROLLBACK_DETECTED`);
- sequence S present but a different record id → `CONFLICT` (`CHECKPOINT_MISMATCH`).

Without a checkpoint, an off-chain verifier cannot distinguish a relay withholding newer history from an identity that has not published anything newer. This limitation is explicit.

## 12. Challenge-response authentication

Authentication proves possession of the identity key **and** that the identity is currently active.

### 12.1 Challenge

```json
{
  "protocol": "kyvera-auth-v1",
  "challenge": "<hex32>",
  "domain": "app.example",
  "issuedAt": 1794000000,
  "expiresAt": 1794000300
}
```

The challenge MUST be unpredictable and single-use. Default TTL is 300 seconds.

### 12.2 Response event

NIP-42-shaped kind `22242`, content `""`, tags:

```text
["challenge", "<hex32>"]
["relay",     "<domain>"]
["k",         "kyvera-auth-v1"]
```

`relay` carries the relying application's domain, as NIP-42 uses it for the relay URL. The event is signed by the identity's Nostr key.

### 12.3 Verification

The response is accepted only if:

1. the event id/signature is valid;
2. kind is 22242 and content is empty;
3. exactly one `challenge`, `relay`, `k` tag, all matching;
4. `created_at` is within `[issuedAt − skew, expiresAt]`;
5. `now ≤ expiresAt + skew` (default skew 120 s);
6. author = resolved subject;
7. resolved status is `ACTIVE` and assurance is not `UNSYNCED`;
8. if the caller requires an address, it equals `activeBch.address`.

The relying application MUST store used challenges for at least the TTL. The shipped `ChallengeService` is an in-memory example, not a production challenge store.

## 13. Test vectors

[`tests/fixtures/vectors.json`](../tests/fixtures/vectors.json) contains:

- canonicalization samples with SHA-256;
- a wallet signmessage message, hash and signature;
- valid `bind`, `rotate`, `revoke` events with record ids and payload digests;
- a tampered proof expected to fail;
- six chain outcomes: bind, rotation, revocation, missing genesis, equivocation, expiry.

Selected values (regenerated deterministically with `pnpm vectors`):

```text
subject            cec40c9d4c5a64972e3f4a2d59c9fe365362e2ffe4d10ecd8c3207bff4808462
canonical sample   {"a":1,"b":2}
                   sha256 43258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777
signmessage hash   bc8e9c85cdfc1e11a447dcc7f847474e467add84867f0e1175b956e305ac39bc
bind record id     9ee42f25755fd2a0e6165f9deef94376f31877559b84e0843e34207c5d1676f8
bind payload       95c752ad01b1fc3bfd45cddbde7736f34f1b093e664e49147ae9f63d7479f765
rotate record id   df50d206cf9e496ad554e2a5338c0e126152a0522d7727156ccfe5097aa780ff
revoke record id   01ba8e06bc4a0ff0753b49f2ec70096f14e00b43699adbcf522f4de753845395
```

Nostr signatures in regenerated vectors use fixed BIP-340 auxiliary randomness so the file is byte-identical across runs. This affects only the test generator; any valid Schnorr signature is accepted by verifiers.

## 14. Versioning

- `version` is part of the canonical payload, the BCH domain string (`KYVERA/v1/...`) and the `d` tag prefix (`kyvera:v1`).
- A future version MUST use a different `k` tag and `d` prefix so v1 verifiers ignore it rather than misinterpret it.
- Unknown record types or versions are invalid, not "best effort".

## 15. Out of scope for v1

- recovery policies, social recovery or threshold authorization;
- multisig, P2SH, CashTokens and hardware-wallet proofs;
- relay authentication and private/encrypted discovery;
- on-chain anchoring;
- selective disclosure and verifiable credentials;
- proving completeness of off-chain history without a checkpoint.

These are documented as limitations, not implied guarantees.
