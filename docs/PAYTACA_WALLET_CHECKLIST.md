# Paytaca Real-Wallet Checklist

**Status:** not executed. This checklist requires a physical Paytaca installation and explicit tester action.
**Rule:** never enter, paste or transmit a seed phrase or private key into KYVERA.

---

## Preconditions

- [ ] Paytaca version recorded: `__________`
- [ ] Platform recorded: Android / iOS / browser extension / desktop
- [ ] Network matches KYVERA: `mainnet` / `chipnet`
- [ ] Dedicated unfunded P2PKH address, or chipnet address
- [ ] KYVERA running locally with a reachable relay
- [ ] Fresh browser profile; no other identity left in `localStorage`
- [ ] Tester understands that signing a message authorizes no payment

## A. Pair and derive

- [ ] Open `/create`
- [ ] Click **Connect Wallet**
- [ ] Confirm QR/dialog says **Paytaca**
- [ ] Approve the connection in Paytaca
- [ ] KYVERA shows the Paytaca wallet name
- [ ] KYVERA shows a P2PKH address on the selected network
- [ ] Badge says **address connected**, not **verified**
- [ ] Copy the full address and compare it with Paytaca’s receive address
- [ ] Address matches: yes / no

Record:

```text
KYVERA address:
Paytaca address:
Match:
Pairing result: approved / rejected / timeout
```

## B. Sign the proof message

- [ ] Click **Copy message**
- [ ] In Paytaca, open **Sign Message**
- [ ] Paste the exact message; do not edit it
- [ ] Confirm the message begins `KYVERA/v1/bch-proof`
- [ ] Confirm the signer address matches the connected address
- [ ] Sign
- [ ] Copy the base64 signature
- [ ] Paste it into KYVERA
- [ ] Badge changes to **verified** only after the local check
- [ ] Publish the identity
- [ ] Dashboard resolves it

Record:

```text
Message hash / exact text:
Signature (test address only):
Signature recovered to:
Badge after paste: verified / unchanged
Publish result:
Relay result:
```

## C. Negative tests

- [ ] Reject the pairing request: KYVERA shows an error or remains disconnected
- [ ] Disconnect in Paytaca: KYVERA returns to **Connect** and clears the proof
- [ ] Switch Paytaca account, reconnect: derived address changes, or signing fails safely
- [ ] Select the wrong network in KYVERA: wallet/address mismatch is handled safely
- [ ] Paste a truncated signature: KYVERA rejects it and keeps publishing locked
- [ ] Reuse a signature from a different message: rejected

## D. Privacy checks

- [ ] No seed phrase or WIF was requested
- [ ] No private key appeared in the browser console, network tab or DOM
- [ ] No transaction was constructed or broadcast
- [ ] The proof message and signature are public evidence only

## Result

- [ ] **PASS** — all pairing, signature and negative checks pass
- [ ] **BLOCKED** — Paytaca has no Sign Message feature or rejects the message
- [ ] **FAIL** — record the exact error; do not claim compatibility

Do not claim Paytaca compatibility until this checklist is complete and the
evidence is recorded in `docs/WALLET_INTEROP.md`.
