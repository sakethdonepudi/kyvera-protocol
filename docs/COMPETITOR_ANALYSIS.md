# Competitor and Prior-Art Analysis

> **Updated 2026-11-18:** a broader audit of current BCH Blaze 2026 identity submissions (Kola Link, CashLink ID, BCH Identity Bridge, bch-did-binding) is in [`COMPETITIVE_AUDIT_2026.md`](COMPETITIVE_AUDIT_2026.md). This document remains the closer source-level analysis of `nostr-bch-bind`, BCH OAuth, Nostron and key-reuse prior art.

**Research date:** 2026-11-18
**Method:** public repository and gist inspection, source reading, execution of published vectors where available.
**Rule applied:** confirmed behaviour is separated from README claims. Missing documentation is not treated as a vulnerability. No vulnerability is asserted without a reproducible path, and no funds or private keys were used.

---

## 1. Scope and sources

| Project | Source | What was inspected | Access |
| --- | --- | --- | --- |
| `nostr-bch-bind v1` (apeirs) | https://gist.github.com/apeirs/aff6b63931c57e1a0729a72770abb325 | `bind.mjs`, `bindverify.mjs`, `bind-vectors.json`, gist README | Public; full source read |
| Pot / BountyEscrow demo page | https://apeir.dk/online/pot-chipnet/ | Landing page only (chipnet demo) | Public; not relevant to identity logic |
| Paytaca BCH OAuth | https://github.com/paytaca/bitcoincash-oauth | README, package layout, message format | Public; README/claims |
| Nostron | https://github.com/Electron-Cash/Nostron | README, plugin purpose | Public; README |
| nostr-key-demo | https://github.com/bastiancarmy/nostr-key-demo | README, key-derivation claims | Public; README |
| nos2bch | https://github.com/bastiancarmy/nos2bch | Repository URL from the brief | `main/README.md` returned 404 at research time; no functionality claims made |
| Cashlet DID / `did-beta-bch` | — | Search | Not publicly locatable at research time; no claims |
| libauth | https://github.com/bitjson/libauth | API usage | Used as a dependency |
| CashScript | https://github.com/CashScript/cashscript | Relevance | Not required by KYVERA v1 (off-chain proofs) |

The official bounty requirements are analysed separately in [`HACKATHON_REQUIREMENTS.md`](HACKATHON_REQUIREMENTS.md).

---

## 2. Closest implementation: `nostr-bch-bind v1`

This is the most directly comparable public work. It is a compact reference implementation and vector set for binding a BCH address to a Nostr key.

### 2.1 Confirmed mechanics (from source)

- **Event:** kind `30078`, `d` tag `bch-bind:<address>`, `i` tag `bch:<address>`, `proof` tag, `alt` tag. Content is a newline message:
  ```text
  nostr-bch-bind:v1
  npub:<hex>
  bch:<cashaddr>
  created:<unix>
  ```
- **Nostr proof:** the event signature; content npub must equal the event author; `created` must be within ±5 minutes of `created_at`.
- **BCH proof 2a (`signmessage`):** compact recoverable ECDSA over the Bitcoin Signed Message hash, header 27–34, address = `hash160(recovered key)`.
- **BCH proof 2b (`wc-tx`):** a non-broadcastable transaction spending one UTXO of the address, with an `OP_RETURN` committing to the protocol string and `sha256(message)`. Guards: locktime ≥ 2100-01-01, non-final sequence, change only back to the same address.
- **Resolution:** `resolve(events, addr)` filters events by `d` tag, sorts by `created_at` descending, returns the first event that verifies; an event with content `revoked` returns `revoked`.
- **Vectors:** 10 cases, including wrong address, different npub, replay window violation, wrong BCH key, broadcastable proof transaction, wrong OP_RETURN hash, edited event, and revocation overriding an older binding.

KYVERA independently verifies their published `signmessage` vector in [`tests/interop.test.ts`](../tests/interop.test.ts), confirming byte-level compatibility of the BCH proof convention.

### 2.2 What it does well

- Correct use of wallet `signmessage` and recovery rather than trusting a supplied public key.
- A second proof mechanism (`wc-tx`) that commits to the message in a transaction structure without broadcasting.
- Explicit replay-window check and vector-driven negative tests.
- Practical interoperability research on Cashonize, Electron Cash and Paytaca formats, including the 253-byte message limit and a reported Paytaca length bug (paytaca/paytaca-app#831, fixed in #832). Treat these as interoperability findings, not security vulnerabilities.

### 2.3 Lifecycle gaps (the basis for KYVERA)

These are design-scope observations, evidenced by source, not vulnerability claims.

1. **No state chain.** There is no `sequence` and no `previous` digest. `resolve` selects the newest individually valid event. A relay that only returns an old binding produces `ok: true`; the verifier has no way to express "I may be missing newer state".
2. **No rotation.** A new BCH address is a new independent binding with a different `d` tag. Nothing cryptographically links wallet A to wallet B, so "A was intentionally superseded by B" is not provable from the records. Consumers must guess from recency.
3. **Revocation is Nostr-only.** The revocation vector contains no `proof` tag; `verifyBindingUnsafe` returns `{revoked:true}` before checking a BCH proof. Anyone who obtains the Nostr key can revoke the binding without the BCH key. Conversely, the BCH key alone cannot revoke. KYVERA requires the current BCH key and the Nostr key for revocation.
4. **No equivocation detection.** Two valid records for the same address at the same time are resolved by sort order. The losing record is silently ignored. There is no `CONFLICT` state.
5. **No freshness model.** Relay failures, missing EOSE, partial histories and stale relays are not represented. The function returns a binary valid/invalid result.
6. **No authentication protocol.** The reference verifies a static binding; it does not define a challenge-response flow for relying applications.
7. **Address-keyed discovery.** `d = bch-bind:<address>` means discovery starts from an address. There is no identity-keyed chain that answers "what is this npub's current address?" across rotations.

### 2.4 Where KYVERA deliberately differs

| Capability | `nostr-bch-bind v1` | KYVERA v1 |
| --- | --- | --- |
| Binding proof | Nostr + BCH signmessage or wc-tx | Nostr + BCH signmessage |
| Hash-linked sequence | No | Yes |
| Rotation | New unrelated binding | First-class `rotate` requiring old + new + Nostr |
| Revocation authorization | Nostr key only | Current BCH key + Nostr key |
| Current-state semantics | Newest valid event | Chain resolution with 8 statuses |
| Equivocation / fork | Not represented | `CONFLICT` with evidence |
| Partial / stale sync | Not represented | `PARTIAL` / `UNSYNCED` / `STALE` |
| Challenge-response auth | Not defined | Kind 22242 verification against ACTIVE state |
| Independent CLI | No | Yes |
| On-chain commitment option | `wc-tx` proof | Not implemented (future work) |

The `wc-tx` idea is genuinely useful and is listed as an interoperability/future-work item for KYVERA rather than dismissed.

---

## 3. Paytaca `bitcoincash-oauth`

**Confirmed from README:**

- OAuth2 authentication library using BCH ECDSA signatures, with JavaScript client, Django and FastAPI server packages.
- Message format: `bitcoincash-oauth|domain|userId|timestamp`, 5-minute timestamp window.
- Registration with signature verification to prevent address squatting.
- Server-side database persistence, token blacklisting and refresh-token rotation.
- Production-oriented claims: database persistence, token revocation, Redis cache for blacklists.

**Assessment:**

- This is a server-centric authentication system. The application's backend is the authority for user records and tokens; verification is not independent of that service.
- An address is registered to a `userId`; there is no Nostr identity and no cross-protocol binding.
- Signature replay protection is timestamp-window based; there is no hash-linked lifecycle or rotation of the identity binding itself (token refresh is a session mechanism, not key rotation).
- The OAuth pattern is useful prior art for domain separation (`domain` in the message) and timestamp windows. KYVERA uses a random challenge and single-use semantics instead, which avoids relying on clock accuracy alone.

**Differentiation:** KYVERA's binding and current-state resolution are verifiable from Nostr events with no database or authorization server; authentication checks the same public state, so a third-party app does not need to trust a KYVERA-run token issuer.

---

## 4. Electron Cash `Nostron`

**Confirmed from README:**

- A plugin for Electron Cash implementing minimal NIP-01 posting and fetching.
- Manages aliases, friends and relays; can create or import a Nostr key.
- Known issues include UI responsiveness and multiple wallet files; roadmap mentions richer Nostr features.

**Assessment:**

- This is a Nostr client inside a BCH wallet, not an identity binding protocol.
- No proof that a BCH address belongs to a Nostr key, no lifecycle, no revocation registry.
- Useful evidence that BCH wallet users and Nostr keys coexist in one client, which supports the product premise but not the cryptographic problem KYVERA addresses.

---

## 5. `nostr-key-demo`

**Confirmed from README:**

- Single-key demo decodes an `nsec` and derives BTC, BCH and ETH addresses from the same secp256k1 key.
- Multi-key demo derives multiple BCH addresses from an `npub` using nonces.
- The README states: "Nostr keys are standard secp256k1 keypairs, compatible with BTC, BCH and ETH address derivation."

**Assessment:**

- This is a key-reuse pattern. Deriving a BCH payment address from the Nostr key directly contradicts the bounty requirement to link identities "without ... reusing the same key across both".
- Reuse collapses the two authorization domains: compromise of one key compromises both, and a signature on one side can be replayed in the other context if domain separation is absent.
- KYVERA enforces distinct keys at verification time (`KEY_REUSE`) and uses a BCH-specific domain-separated proof message.
- The multi-key derivation idea is interesting for payment privacy but does not solve identity lifecycle; it is out of scope for v1.

---

## 6. Comparison matrix

Legend: ✅ confirmed implemented, ◐ partial/claim only, ❌ absent.

| Property | KYVERA | nostr-bch-bind | BCH OAuth | Nostron | nostr-key-demo |
| --- | --- | --- | --- | --- | --- |
| BCH↔Nostr binding | ✅ | ✅ | ❌ (BCH only) | ❌ | ◐ (address derivation) |
| Proof of BCH key control | ✅ recovered key | ✅ recovered key / wc-tx | ✅ ECDSA | ❌ | ❌ |
| Proof of Nostr key control | ✅ event signature | ✅ event signature | ❌ | ✅ event signature | ❌ |
| Enforces distinct keys | ✅ | ✅ in reference code | n/a | n/a | ❌ explicit reuse |
| Rotation as authorized transition | ✅ | ❌ | ❌ | ❌ | ❌ |
| Revocation requires current BCH key | ✅ | ❌ (Nostr only) | token revocation only | ❌ | ❌ |
| Hash-linked history | ✅ | ❌ | ❌ | ❌ | ❌ |
| Conflict / equivocation result | ✅ | ❌ | ❌ | ❌ | ❌ |
| Stale / partial sync result | ✅ | ❌ | ❌ | ❌ | ❌ |
| Challenge-response authentication | ✅ | ❌ | ✅ (OAuth tokens) | ❌ | ❌ |
| Independent verifier without vendor backend | ✅ SDK + CLI | ✅ reference script | ❌ server required | n/a | n/a |
| Published negative test vectors | ✅ 134 tests + vectors | ✅ 10 vectors | ◐ README claims | ❌ | ❌ |
| On-chain commitment | ❌ v1 | ✅ wc-tx proof | ❌ | ❌ | ❌ |
| Live wallet interoperability evidence | ◐ format + independent vector | ✅ README claims formats checked | ✅ own client | n/a | n/a |

---

## 7. Evidence-backed differentiation opportunities

### 7.1 Historical validity vs current authorization

**Evidence:** `nostr-bch-bind`'s `resolve()` sorts by `created_at` and returns the first valid record. There is no sequence, previous digest or stale signal. A relay returning only the older binding yields a valid result.

**Opportunity:** a hash-linked chain resolved from a mandatory genesis, with explicit `SUPERSEDED`, `CONFLICT` and `STALE` outcomes. This is the central contribution and maps directly to the bounty's stretch goal "key rotation and recovery with independently verifiable authorization".

### 7.2 Rotation that proves intent, not just recency

**Evidence:** the closest implementation keys records by address (`d = bch-bind:<address>`); a new wallet creates an unrelated record. There is no transition signed by the old wallet.

**Opportunity:** require current BCH + new BCH + Nostr signatures for rotation. This makes "wallet A authorized wallet B" a verifiable statement and prevents an attacker who only has the new wallet from claiming succession.

### 7.3 Revocation that cannot be triggered by one compromised key

**Evidence:** the public revocation vector has no BCH proof; resolution treats content `revoked` as terminal based on the Nostr signature alone.

**Opportunity:** require the current BCH key and the Nostr key for revocation, and reject every transition after it. The trade-off (lost BCH key blocks revocation) is documented rather than hidden.

### 7.4 Uncertainty as a protocol result

**Evidence:** existing verifiers return a binary ok/false reason. Partial relay responses, forks and missing history have no representation.

**Opportunity:** eight statuses plus per-relay assurance and optional checkpoints. Applications can make risk-aware decisions instead of treating "I found something" as "this is current".

### 7.5 Independent authentication, not just binding inspection

**Evidence:** the closest binding implementation exposes verification only. BCH OAuth authenticates through a central server and database.

**Opportunity:** challenge-response with kind 22242, verified against the same resolved state, with no token issuer in the loop. This directly addresses bounty requirement 4.

---

## 8. Threats to the validity of this analysis

- The closest competitor is a gist/draft, not a maintained product. Its author may add lifecycle features; this analysis reflects the revision fetched on 2026-11-18.
- `nos2bch` and Cashlet DID were not inspectable. No claims are made about them.
- README claims (e.g. wallet format coverage) are distinguished from source-confirmed behaviour. KYVERA's own live-wallet testing is also incomplete, so it does not claim superior wallet coverage.
- Absence of a feature is not, by itself, a security vulnerability. The observations above are about scope and lifecycle semantics, and are framed as differentiation rather than exploits.

---

## 9. Conclusion

The prior art establishes that BCH↔Nostr key binding is feasible and that wallet `signmessage` is the practical BCH proof primitive. It does not solve the harder lifecycle question. KYVERA's contribution is the authorization chain and the verifier semantics around it, not a new curve or a new signature scheme.

The strongest, most honest claim is narrow:

> KYVERA makes the difference between a valid historical proof and a currently authorized binding explicit, testable and independently verifiable.
