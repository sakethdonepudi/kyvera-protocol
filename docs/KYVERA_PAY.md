# KYVERA Pay

**Positioning:** Pay the person. Verify the destination.
**Status:** implemented as a verified BIP21 wallet handoff. Real wallet transaction construction/broadcast is **not** implemented; no transaction id is fabricated.

---

## 1. What it does

1. Enter a recipient npub / 32-byte public key.
2. Resolve the identity from configured Nostr relays using the same verifier as `/verify`.
3. Require an `ACTIVE` chain and a current BCH address on the expected network.
4. Show the resolved address, sequence, assurance, and time-machine link.
5. Enter an optional BCH amount, label and message.
6. Require an explicit confirmation that the user verified the recipient.
7. Re-resolve immediately before payment. If the address or status changed, cancel the intent and require a new review.
8. Build a BIP21 URI and QR code.
9. Open the user's BCH wallet (Paytaca, Selene, Cashonize, Electron Cash) to preview and broadcast.

The wallet approves and broadcasts. KYVERA does not request a seed phrase or private key, does not auto-broadcast, and does not display a receipt it cannot verify.

---

## 2. Payment policy

`apps/web/lib/pay.ts`:

- only `ACTIVE` status is payable;
- `REVOKED`, `CONFLICT`, `EXPIRED`, `STALE`, `SUPERSEDED`, `UNKNOWN`, `INVALID` are blocked;
- `UNSYNCED` relay assurance is blocked;
- `PARTIAL` assurance is allowed with a warning;
- the address must be P2PKH and match the configured network;
- amounts are parsed as decimal strings with at most 8 places, no floats, > 0, ≤ 21M BCH;
- the destination is snapshotted and compared after re-resolution; any address/subject/status change cancels the handoff.

Tests: `tests/pay.test.ts` (11 cases).

---

## 3. WizardConnect adapter

`@wizardconnect/core`, `@wizardconnect/dapp`, `@wizardconnect/react` are integrated in `/pay`.

Implemented:

- connect / disconnect;
- wallet name and QR pairing dialog;
- local address derivation from the wallet public key (`getPubkey(0, 0n)` → P2PKH CashAddr);
- explicit idle / connecting / connected / error states;
- no seed phrase or private key request.

**Not yet tested with a physical wallet.** No Paytaca/Selene/Cashonize installation was available in this environment. The connection is a real library integration, but compatibility is not claimed until tested.

WizardConnect is **not** used to sign or broadcast in KYVERA Pay yet. Doing so requires UTXO discovery, transaction construction, fee policy, signed-transaction validation and broadcast. That is a larger integration and is documented as future work.

---

## 4. Payment handoff limitations

- No transaction id is returned by BIP21/deep-link handoff. The UI states this explicitly and shows no receipt.
- The app cannot confirm that the wallet broadcast, or to which amount.
- A future txid-aware path should use WizardConnect `sendSignRequest` with a locally built transaction and a Fulcrum/indexer connection, then validate the signed transaction before broadcast.
- Mainnet vs chipnet is determined by `NEXT_PUBLIC_KYVERA_NETWORK`; no mainnet transaction was executed during development.
- No BCH was spent.

---

## 5. Failure states

| State | Behavior |
| --- | --- |
| Identity not ACTIVE | Payment blocked with the verifier reason |
| No current address | Payment blocked |
| Wrong network | Payment blocked |
| No relays / UNSYNCED | Payment blocked |
| Partial sync | Warning; payment allowed with explicit confirmation |
| Invalid/malformed amount | Inline error; handoff disabled |
| Destination changed on re-resolve | Handoff cancelled; warning displayed |
| Wallet unavailable/rejects | WizardConnect state/error shown |
| QR generation failure | URI remains copyable; no fake QR |

---

## 6. Files

- `apps/web/app/pay/page.tsx` — payment UI and WizardConnect session
- `apps/web/lib/pay.ts` — pure policy/amount/BIP21 helpers
- `tests/pay.test.ts` — payment policy tests
- `docs/WALLET_INTEROP.md` — wallet testing status
- `docs/SUBMISSION_ELIGIBILITY.md` — Mainnet Track payment requirement (still unmet)
