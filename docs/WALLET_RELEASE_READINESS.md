# Wallet Release-Readiness Report

**Date:** 2026-11-18
**Branch:** `run-again-push-to-github`
**Base commit:** `4234953`
**Status:** implementation complete; real-device wallet verification still required.

---

## 1. What is complete

- `/create` defaults to **Connect Wallet** and exposes **Connect → Sign → Verified → Publish**.
- WizardConnect retrieves the BCH public key and derives the P2PKH CashAddr locally.
- The proof message has one **Copy message** action.
- The signature input is compact and verifies automatically after paste.
- The address is labelled **address connected** until `verifyBitcoinMessageSignature` succeeds; only then does it become **verified**.
- Publishing is disabled until verification and re-verifies inside `completeExternalBind`.
- Demo and manual Paste fallbacks remain.
- The shared address adapter is in `apps/web/lib/wallet.ts`.
- Paytaca and Cashonize are the only wallets named for WizardConnect. Selene is BIP21-only.
- Public verifier, Time Machine, rotation, revocation, authentication and Pay flows are unchanged and still tested.

## 2. Verification evidence

| Check | Result |
| --- | --- |
| `pnpm test` | **136/136**, 13 files |
| `pnpm typecheck` | pass (all packages + web) |
| `pnpm qa:browser` | **64/64**, 0 console/page errors |
| `pnpm build` | pass, 17 routes |
| `next start` production smoke | pass |
| `pnpm audit --prod` | 0 known vulnerabilities |

Browser checks include:

- the four wallet states are rendered;
- the WizardConnect dialog opens;
- an invalid signature is rejected automatically and publishing stays locked;
- a real wallet-style signature (generated against the live proof message) is verified, unlocks publishing and publishes;
- existing demo, Pay, auth-demo, rotation, revocation, verifier, mobile, reduced-motion, theme and keyboard checks still pass.

## 3. Confirmed vs untested

| Capability | Status |
| --- | --- |
| WizardConnect pairing dialog opens | Confirmed in browser QA |
| Address derivation from a pubkey | Implemented; unit vector by construction; **no live xpub test** |
| BCH proof signature verification | Confirmed with generated keys and independent vectors |
| Paytaca real-device connect + Sign Message | **Untested** |
| Cashonize real-device connect + message signing | **Untested** (likely blocked: transaction signing only) |
| Selene WizardConnect | **Not supported / not claimed** |
| Account switch, rejection, disconnect, wrong network | **Untested** |
| Mainnet payment / txid receipt | Not implemented; BIP21 handoff only |

## 4. Remaining manual requirements

1. Run `docs/WALLET_DEVICE_TEST.md` on Paytaca and Cashonize.
2. Record wallet versions, addresses, signatures and screenshots.
3. Confirm whether Paytaca and Cashonize expose a message-signing UI that can sign the exact KYVERA proof text.
4. Test rejection, disconnect, account switch and wrong-network behavior.
5. If a wallet cannot sign messages, record **blocked** and keep the Paste fallback.
6. Do not claim compatibility or Mainnet Track eligibility until a real device test and a public deployment exist.

## 5. Release recommendation

The implementation is release-ready for a local prototype and judge demonstration. It is **not** ready to claim real-wallet interoperability. The remaining work is manual device testing, not code completion.
