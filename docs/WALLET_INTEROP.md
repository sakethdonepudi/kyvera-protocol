# Wallet Interoperability

**Date:** 2026-11-18
**Status:** format implemented and independently cross-verified; **no live wallet test has been completed**. No Paytaca, Electron Cash or Cashonize installation was available in the release environment, so this task pauses at the manual wallet step.

KYVERA proves BCH address control with the standard wallet `signmessage` format (compact recoverable ECDSA, 65 bytes, base64). The web app exposes an external-wallet path and a probe page so a real signature can be tested without sharing keys.

---

## 1. Evidence status

| Wallet | Version | Signing method | Address type | Signature format | Verification | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Paytaca | — | — | — | — | **Not tested** | — |
| Electron Cash | — | — | — | — | **Not tested** | — |
| Cashonize | — | — | — | — | **Not tested** | — |
| `nostr-bch-bind` reference implementation | published vector | `signmessage` | P2PKH mainnet | base64 compact recoverable | **Verified** | `tests/interop.test.ts` |
| WizardConnect (Paytaca / Cashonize) | — | pairing + address derivation | P2PKH | QR pairing; no message-signing API | **Pairing dialog verified; no physical wallet test** | `/create`, `/pay`, `@wizardconnect/react` |
| Selene | — | BIP21 handoff only | — | — | **No WizardConnect integration found in the public source** | `/pay` BIP21 output |

The independent vector proves the format is not merely self-consistent. It does **not** prove that a specific wallet version produces compatible signatures. Do not claim wallet compatibility until the table has a real row.

Prior art reports that Paytaca's extension mis-encoded message lengths above 252 bytes (paytaca/paytaca-app#831, fixed in #832). KYVERA keeps proof messages around 150 bytes, but this has not been re-tested against a live build. This is an interoperability note, not a vulnerability claim.

---

## 2. What the wallet signs

For an identity record:

```text
KYVERA/v1/bch-proof
role:new
address:bitcoincash:q…
record:<64-char payload digest>
```

For the compatibility probe (not an identity proof):

```text
KYVERA wallet compatibility probe v1
This signature proves control of this BCH address for testing.
It authorizes no payment and can be discarded.
nonce: 7f3a9c2e5b1d8046a9c4e2f7b0d6a1c8
```

The wallet hashes it with the standard Bitcoin/BCH convention:

```text
hash256(0x18 || "Bitcoin Signed Message:\n" || compactSize(len) || message)
```

The verifier recovers the public key from the 65-byte signature and requires:

```text
hash160(recoveredKey) == P2PKH payload of the declared address
```

A header byte of 31–34 means a compressed key; 27–30 means uncompressed. Both are accepted, and the recovered key form must hash to the address.

**Probe message hash (for independent checking):**

```text
42a17d5314963eb4e515c98a06680771a2dadf091a7f19cd07cd3e96c0e1c1bb
```

Verify a pasted signature without the browser:

```bash
pnpm wallet:verify <cashaddr> <base64-signature>
```

---

## 3. Manual probe procedure

1. Start the app (`pnpm relay`, `pnpm dev`) or use a deployed instance.
2. Open `/interop`.
3. Copy the probe message exactly. Do not edit it.
4. In a test wallet, find **Sign message**:
   - **Electron Cash:** open the Addresses tab, right-click the address, choose the message-signing action. Menu labels vary by version.
   - **Cashonize:** use the wallet's message-signing feature if present. Do not guess; record what you used.
   - **Paytaca:** use the wallet's message-signing feature if present. Do not guess; record what you used.
5. Use an **unfunded or dedicated test address**. Never paste a seed phrase or private key.
6. Sign the exact message, copy the base64 signature.
7. Enter wallet name, version, address and signature in `/interop`, then verify.

Stop at this step if a wallet is not installed or the feature is unavailable. A missing wallet is not a compatibility result.

---

## 4. What to record

For each tested wallet:

- wallet name and exact version;
- platform (browser extension, desktop, mobile);
- network and address type;
- signing method and menu path;
- whether the message was shown exactly as provided;
- verification result and recovered public key;
- any message-length or encoding issue;
- screenshot or signature vector (test address only).

The `/interop` page stores probe results in browser localStorage and shows them as a table. Export them into this document before submission.

---

## 5. Identity creation with a connected wallet

Create Identity defaults to **Connect Wallet**:

1. Pair Paytaca or Cashonize through WizardConnect.
2. KYVERA derives the P2PKH CashAddr from the wallet public key. No address is pasted.
3. KYVERA fixes the payload (address, network, nonce, issuedAt) and displays the exact proof message.
4. Sign that message with the wallet's **Sign Message** feature and paste the base64 signature.
5. KYVERA verifies the signature, recovers the key, and only then enables publishing.

WizardConnect exposes transaction signing and address derivation, not arbitrary message signing. The app therefore labels the wallet as **address connected**, not verified, until the signature check passes. The **Paste** tab remains as a manual fallback.

No private key touches the browser. The public key field in the record may be `null` for external wallets; the verifier recovers it from the proof.

Rotation with an external wallet requires signatures for both the current and new wallet keys. The current web demo automates this only for its labelled throwaway demo keys. A production client should integrate WizardConnect or a wallet adapter; that is future work.

---

## 6. WizardConnect connection (KYVERA Pay)

`/pay` integrates `@wizardconnect/core`, `@wizardconnect/dapp` and `@wizardconnect/react`:

- pairing QR/dialog opens and reports `connecting`/`connected`/`error`;
- the wallet name is displayed;
- the first receive address is derived locally from the wallet public key;
- no seed phrase or private key is requested;
- the connection is used to verify the wallet/network context, while payment is a BIP21 handoff.

This is a real library integration, but **no physical Paytaca/Cashonize wallet was available for the pairing test**. Do not claim wallet compatibility until a connection and a payment are recorded. Selene is not claimed as WizardConnect-compatible.

## 7. Known limitations

- Only P2PKH is supported. P2SH, multisig and token-aware addresses are rejected.
- Hardware-wallet PSBT flows are not implemented.
- Wallet-specific message prefixes other than the standard `Bitcoin Signed Message:\n` are not supported.
- Live wallet versions were not exercised in this workspace.
- No mainnet funds were used.

The wallet probe is deliberately separated from identity verification so a failed probe cannot masquerade as a valid identity.
