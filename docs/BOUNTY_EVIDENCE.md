# Bounty Evidence Index

**Bounty:** Paytaca Decentralized Identity (BCH BLAZE 2026)
**Date:** 2026-11-19
**Primary source:** https://bchblaze.cash/bounties/decentralized-identity/
**Full specification:** Google Doc export linked from the bounty page

## 1. Requirement → evidence

| Requirement | Evidence | Status |
| --- | --- | --- |
| Identity creation with user-controlled keys | `/create`, `apps/web/lib/identity.ts`, generated demo signer or NIP-07 | **PASS** |
| BCH + Nostr integration | separate BCH P2PKH and Nostr Schnorr keys | **PASS** |
| No centralized provider/custody | browser-local keys, local verification, no KYVERA account | **PASS** |
| Cryptographic binding | canonical record + BCH `signmessage` + Nostr event signature | **PASS** |
| No private-key exposure/reuse | key-reuse rejection, no private key in records/events/SDK export | **PASS** |
| Decentralized discovery | kind 1078 public mirror + kind 30078 legacy; multi-relay resolver | **PASS** — public lifecycle + short-term retention on two relays |
| Independent verification | `@kyvera/sdk`, `@kyvera/verifier`, standalone verifier | **PASS** |
| Challenge-response authentication | single-use kind-22242 request, short session, replay rejection | **PASS** |
| Working demo + docs | live site, films, README, protocol/SDK/wallet/RP docs | **PASS** |
| Key rotation | authorized rotate with current + new proofs | **PASS** |
| Revocation | current-key revoke terminates chain | **PASS** |
| Identity-based payment | BIP21 handoff after `ACTIVE + FULL` re-resolution | **PARTIAL** — no in-app broadcast/receipt |
| Reusable libraries | `@kyvera/sdk`, `@kyvera/verifier`, `@kyvera/wallet-bch` | **PASS** |

## 2. Executed evidence

```text
pnpm test          153/153 (final V5 count)
pnpm typecheck     pass
pnpm build         pass
pnpm qa:browser    57/57, 0 console/page errors
pnpm rp:demo       13/13
pnpm rp:persist    7/7
```

Screenshots: `docs/screenshots/4.3/` (before/after, 375/390/768/1440).

## 3. Not executed / not claimed

| Item | Status | Reason |
| --- | --- | --- |
| Public relay lifecycle retention | **PASS** | Two relays; short-term retention observed; indefinite retention not claimed |
| Public event IDs / relay acknowledgements | **PASS** | `docs/audits/public-relay-evidence-2026-11-19.json` |
| Real Paytaca/Cashonize/Selene signing | **NOT TESTED** | No compatible physical wallet/signing API |
| Real-funds BCH payment | **NOT TESTED** | No funds spent |
| Mainnet Track eligibility | **NOT MET** | No banner/EMBER address/mainnet transaction feature |
| Independent audit | **NOT PERFORMED** | Out of scope |
| Veramo plugin | **DEFERRED** | P1; no compiled compatibility claim |

## 4. Submission checklist

- [x] Public repository
- [x] Live hosted demo
- [x] Source and setup instructions
- [x] Architecture and verification docs
- [x] Binding, discovery, verification, authentication demos
- [x] Rotation and revocation
- [x] Independent SDK and relying-party flow
- [x] Public relay evidence (two relays, short-term retention)
- [ ] Real-wallet evidence (wallet required)
- [ ] DoraHacks BUIDL submission (owner action)
- [ ] Top-of-page hackathon banner and EMBER address (Mainnet Track only)
