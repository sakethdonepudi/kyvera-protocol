# BCH BLAZE 2026 — Bounty Requirements Matrix

**Verification date:** 2026-11-19
**Project:** KYVERA
**Primary target:** Paytaca Decentralized Identity bounty
**Submission deadline:** 2026-11-22 14:00 UTC (DoraHacks)
**Repository:** https://github.com/sakethdonepudi/kyvera-protocol
**Live:** https://kyvera-alpha.vercel.app

Sources checked:

- https://bchblaze.cash/bounties/decentralized-identity/
- https://bchblaze.cash/bounties/
- https://dorahacks.io/hackathon/bchblaze2026/detail
- https://docs.google.com/document/d/161UkJvxh3bdSYZi0ky-rZNyhgYOf595Fpopo9iDN2yw/export?format=txt
- BCH BLAZE bounty rules panel linked from https://bchblaze.cash/bounties/#rules

All requirements below were read on 2026-11-19. If a source changes or a rule is clarified by the organiser, this matrix must be re-checked.

---

## 1. Paytaca — Decentralized Identity

| Field | Detail |
| --- | --- |
| Sponsor | Paytaca |
| Prize | $500 PUSD |
| Category | Identity |
| Network | No mainnet requirement in the bounty text |
| Primary source | https://bchblaze.cash/bounties/decentralized-identity/ |
| Full specification | Google Doc export linked above |

### Mandatory requirements

| # | Requirement | KYVERA implementation | Evidence | Status |
| --- | --- | --- | --- | --- |
| 1 | Users create/manage a decentralized identity with keys they control; BCH + Nostr; no centralized identity provider or custody | Separate BCH and Nostr keys; browser-local creation; NIP-07 or generated demo signer; no KYVERA account | `/create`, `packages/core`, `apps/web/lib/store.ts` | **PASS** |
| 2 | Cryptographic binding proving control of both identities without exposing or reusing private keys; profile listing alone insufficient | Canonical record with BCH `signmessage` proof and Nostr Schnorr event signature; key-reuse rejection | `packages/verifier/src/create.ts`, `tests/binding.test.ts`, `tests/interop.test.ts` | **PASS** |
| 3 | Decentralized discovery with enough data to verify, no proprietary database | Public regular-event mirror kind 1078 + legacy kind 30078, unique `d` tag, `k`/`s`/`seq`/`prev`/`b` tags, multi-relay discovery | `packages/nostr/src/event.ts`, `docs/protocol/NOSTR_DISCOVERY_RFC.md`, `tests/discovery-format.test.ts` | **PASS** — public lifecycle and short-term retention observed on two relays; indefinite retention not claimed |
| 4 | Independent verification and challenge-response authentication without a central authority | `@kyvera/verifier`, challenge kind 22242, single-use challenge, short session, replay/rotation/revocation invalidation | `packages/verifier/src/auth.ts`, `/challenge`, `/auth-demo`, `pnpm rp:demo` | **PASS** |
| 5 | Working demonstration + source + setup + architecture/verification docs | Live site, narrated films, standalone verifier, README, protocol docs, browser QA | `/`, `/tutorial`, `/verify`, `docs/`, `README.md` | **PASS** |

### Stretch goals

| Stretch goal | KYVERA status |
| --- | --- |
| Identity-based BCH payments | **PARTIAL** — verified BIP21 handoff to a wallet; no in-app broadcast and no fabricated receipt/txid |
| Verifiable credentials / third-party attestations | **NOT IMPLEMENTED** |
| Portable reputation | **NOT IMPLEMENTED** |
| Key rotation and recovery with independently verifiable authorization | **PARTIAL** — rotation and revocation are implemented; recovery after total key loss is not |
| Privacy-preserving selective disclosure | **NOT IMPLEMENTED** |
| Reusable libraries, APIs or protocol specs | **PASS** — `@kyvera/sdk`, `@kyvera/verifier`, `@kyvera/wallet-bch`, protocol spec and discovery RFC |
| BCH-backed identity commitments | **NOT IMPLEMENTED** — off-chain cryptographic proofs only |

### Eligibility conclusion

**Core proof-of-concept requirements: PASS (with discovery-evidence caveat).**
**Competitive strength: HIGH** for binding, rotation/revocation semantics, independent verification, challenge-response authentication and reusable verifier code.
**Main risk:** public relay retention/discovery has not been demonstrated with actual public events. Do not claim it until executed with explicit authorization.

---

## 2. BCH BLAZE Mainnet Track

| Requirement | KYVERA state | Status |
| --- | --- | --- |
| Original or significantly improved during BLAZE; pre-existing work disclosed | KYVERA has prior commits and a v4.2/v4.3 history | **PARTIAL** — no top-of-page pre-existing-work banner or old/new demo links yet |
| Live, usable demo | https://kyvera-alpha.vercel.app | **PASS** |
| At least one feature that sends a BCH mainnet transaction, usable by a judge | Wallet handoff can prepare a BIP21 payment, but there is no in-app broadcast or confirmed mainnet transaction | **PARTIAL / NOT TESTED** — do not claim a transaction |
| Top-of-page banner with presentation link, repository link, EMBER2026 CashTokens address | Not present | **FAIL** |
| WizardConnect or XO integration | WizardConnect address connection is integrated | **PASS** (address only; no message signing) |
| Roll-call / Telegram check-in | Not established in the repository | **UNVERIFIED** |
| DoraHacks registration and valid submission | Not established in the repository | **UNVERIFIED** |

**Mainnet Track eligibility: NOT MET as of this audit.**
The primary bounty does not require these items. Do not attempt to satisfy the Mainnet Track with mock transactions or an unverified donation address.

---

## 3. BCH BLAZE Media Track

| Requirement | KYVERA state | Status |
| --- | --- | --- |
| Inspirational/innovative BCH media | Two narrated product films exist | **PARTIAL** — they are product demos, not a media submission |
| Live hosted version | `/tutorial` | **PASS** |
| Top-of-page banner or accessible description with EMBER2026 address and pre-existing material links | Not present | **FAIL** |
| Roll-call / Telegram check-in | Not established | **UNVERIFIED** |

**Media Track eligibility: NOT APPLICABLE / NOT MET.**
The films document the product; they are not submitted as a separate media entry.

---

## 4. Other bounties

| Bounty | Prize | Mandatory requirement | KYVERA fit | Status |
| --- | --- | --- | --- | --- |
| Stablecoin Bridge | $750 PUSD | Build a stablecoin bridge | No bridge implementation | **NOT ELIGIBLE** |
| Build with XO | 0.3 BCH × 10 | Functional XO template used with the XO debug tool | No XO template | **NOT ELIGIBLE** |
| Migrate to XO | 1 BCH × 5 | Integrate XO into an existing project | No XO migration | **NOT ELIGIBLE** |
| Best SolidCash Application | 3.5 BCH | Solidity contract compiled to BCH, running on mainnet | No Solidity/SolidCash contract | **NOT ELIGIBLE** |
| FoldingCash reward claims | 26M FLDCH | Pull-based reward-claim pool with Merkle root | No FoldingCash integration | **NOT ELIGIBLE** |
| Community Choice | $750 PUSD | Eligible Mainnet/Media project with EMBER2026 address | No EMBER2026 address; Mainnet/Media not eligible | **NOT ELIGIBLE** |

Do not claim any of these categories on the strength of an optional identity feature.

---

## 5. Submission materials checklist

| Item | Status |
| --- | --- |
| Public GitHub repository | **PASS** |
| Live hosted demo | **PASS** |
| Source code and setup instructions | **PASS** |
| Architecture and verification documentation | **PASS** |
| BCH + Nostr binding demonstration | **PASS** |
| Independent verification path | **PASS** |
| Challenge-response authentication | **PASS** |
| Rotation/revocation demonstration | **PASS** |
| Public relay evidence | **BLOCKED** — requires explicit publication authorization |
| Real-wallet signing evidence | **NOT TESTED** — no compatible physical wallet/API |
| DoraHacks BUIDL submission | **NOT YET SUBMITTED** |
| Top-of-page hackathon banner | **FAIL** (Mainnet Track requirement only) |
| EMBER2026 donation address | **NOT PROVIDED** (Mainnet/Community Choice requirement) |

---

## 6. Decision

Proceed with the **Paytaca Decentralized Identity** bounty as the only defensible primary submission.

Do not claim Mainnet Track, Media Track, Community Choice or any other bounty until every mandatory item above is actually satisfied and evidenced.
