# Competitive Differentiation

**Date:** 2026-11-19
**Caveat:** based on the repository's public-source audit (`docs/COMPETITIVE_AUDIT_2026.md`, `docs/FINAL_COMPETITIVE_AUDIT.md`) and public project descriptions checked during this project. Re-check before making a submission claim. Absence of a feature in an inspected repository is not proof that no private or newer implementation exists.

## 1. What KYVERA implements

- Separate BCH and Nostr keys, with key-reuse rejection.
- Canonical signed record containing both proofs.
- Hash-linked authorization chain: bind → rotate/revoke.
- Explicit `SUPERSEDED`, `REVOKED`, `CONFLICT`, `STALE`, `UNSYNCED` outcomes.
- Current authorization separated from historical proof validity.
- Multi-relay discovery with per-relay evidence.
- Checkpoint-based rollback detection.
- Single-use challenge-response and session invalidation on rotation/revocation.
- Reusable SDK and wallet capability adapter.
- Public regular-event discovery mirror (experimental kind 1078) with NIP-78 compatibility.

## 2. Comparison table

| Project / standard | Closest capability | KYVERA difference | Confidence |
| --- | --- | --- | --- |
| BCH Identity Bridge | Signed binding + revocation/supersession events | KYVERA uses a hash-linked authorization chain and explicit conflict/stale outcomes | Inspected public repo during prior audit; re-check required |
| Kola Link | Signed Nostr binding + optional XO anchor | KYVERA does not use newest-event-wins; rotation is an authorized chain transition | Inspected public gist/project during prior audit |
| CashLink ID | On-chain-ordered rotations | KYVERA is off-chain and hash-linked; no on-chain ordering claim | Inspected during prior audit |
| BCH DID Binding | BCH-linked DID-style binding | KYVERA does not claim a DID method; it focuses on wallet continuity and lifecycle states | Prior audit; re-check required |
| did:webvh | DID method with pre-rotation/version history | Different scope; KYVERA uses BCH/Nostr proofs and is not a registered DID method | Standards-level comparison only |
| Veramo | DID/VC agent framework | KYVERA is not a Veramo plugin yet; integration is deferred | No compatibility claim |
| Credo | Agent framework / credentials | No KYVERA integration or compatibility claim | No comparison claimed |
| Universal Resolver | DID method resolution | No KYVERA DID driver or registration | No claim |

## 3. Claims that are safe

- KYVERA demonstrates a hash-linked BCH–Nostr authorization chain with explicit supersession, revocation, conflict and stale states.
- KYVERA separates cryptographic validity from current authorization and evidence completeness in its SDK.
- KYVERA's public discovery path now uses a regular event mirror rather than relying solely on NIP-78.
- KYVERA has an independent relying-party flow with durable session persistence in an example.

## 4. Claims that are not safe

- "First" or "only" implementation.
- "Registered DID method", "NIP-standard kind", "Veramo-compatible" or "Universal Resolver-compatible".
- "Audited", "production-ready" or "mainnet-ready".
- "Public relay retention verified" or "real-wallet tested" until evidence exists.
- Any implication that another project is insecure.
