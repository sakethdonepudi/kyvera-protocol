# KYVERA Security Model

**Status:** research prototype, not independently audited
**Detailed threats:** [`docs/security/THREAT_MODEL_V5.md`](security/THREAT_MODEL_V5.md)
**Known limitations:** [`docs/security/KNOWN_LIMITATIONS.md`](security/KNOWN_LIMITATIONS.md)

## 1. Trust boundaries

| Component | Trusted for | Not trusted for |
| --- | --- | --- |
| BCH `signmessage` | Proof of control of a P2PKH address | Current authorization |
| Nostr event signature | Authorship by the identity key | Chain completeness |
| Relay set | Supplying candidate events | Honesty, completeness or freshness |
| KYVERA verifier | Deterministic proof/chain checking | Global knowledge of undisclosed history |
| Relying party | Its own session policy | Identity truth without verification |
| Browser localStorage | Convenience cache of demo events | Authoritative identity state |

## 2. Guarantees

- A record is accepted only if canonical encoding, both proofs and the tag matrix are valid.
- A chain is accepted only from a valid genesis through explicit hash-linked transitions.
- A rotate requires the current wallet and the new wallet; a revoke requires the current wallet.
- A revoked or superseded address is never returned as current.
- `CONFLICT`, `STALE`, `UNSYNCED`, `INVALID` and `REVOKED` cannot be rendered as `ACTIVE`.
- Sensitive authentication/payment policy requires `ACTIVE + FULL`.
- A consumed challenge cannot be reused, even after a failed verification.
- Session validation re-resolves the chain and rejects address changes, revocation and partial evidence.

## 3. Non-guarantees

- No global completeness of Nostr history.
- No protection from a colluding or uniformly withholding relay set.
- No detection of an undisclosed revocation by a first-time verifier.
- No recovery after loss of all authorized keys.
- No production-grade session database in the example.
- No real-wallet interoperability claim.
- No mainnet transaction or payment finality claim.
- No independent audit.

## 4. Trust model for discovery

`FULL` means every configured relay completed the query with EOSE. It is evidence of agreement among the chosen relays, not proof that no other relay holds a newer revocation.

A checkpoint (`{sequence, recordId}`) detects a relay set that drops a previously verified head. Without a checkpoint, a uniformly stale relay set is indistinguishable from a genuinely quiet identity.

## 5. Failure policy

Fail closed:

- missing genesis → `STALE`;
- signature jump → `STALE`;
- same-sequence equivocation → `CONFLICT`;
- invalid proof → `INVALID` or rejected record;
- no relay → `UNSYNCED` / `STALE`;
- partial relay set → `PARTIAL`, blocked for sensitive operations.

## 6. Reporting

Report security issues privately to the repository maintainer. Do not publish private keys, funded addresses or personal identity data in an issue.
