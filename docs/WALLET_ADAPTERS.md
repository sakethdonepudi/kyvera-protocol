# BCH Wallet Adapters

`@kyvera/wallet-bch` implements a capability-based adapter model.

## 1. Capabilities

`WalletCapabilities` reports:

- `connect` — can establish a session;
- `address` — can expose a BCH address;
- `signMessage` — can sign an arbitrary message;
- `network` — mainnet or chipnet, when known.

These are separate facts. A connected wallet that exposes an address is **not** a signing integration.

## 2. WizardConnect

`WizardConnectAdapter` reads the wallet public key and derives the P2PKH CashAddr. The integrated WizardConnect API in this repository does **not** expose arbitrary message signing.

Therefore:

- `signMessage` is `false`;
- `adapter.signMessage` is `undefined`;
- the UI must not imply that Paytaca/Cashonize can sign automatically;
- the proof workflow remains a manual `signmessage` step.

## 3. Manual proof workflow

1. Build the canonical KYVERA message with `createKyveraSigningRequest()`.
2. The user signs it in Paytaca, Cashonize, Selene or Electron Cash.
3. The user pastes the 65-byte base64 signature.
4. `verifyManualSignature()` decodes the address, checks the network, recovers the public key and compares `hash160` with the P2PKH payload.
5. Ownership is accepted only when both the signature and address match.

This is a genuine wallet-produced proof when a real wallet is used. The repository has not performed a physical-wallet test, so no real-wallet compatibility is claimed.

## 4. Error codes

| Code | Meaning |
| --- | --- |
| `BCH_ADDRESS_INVALID` | Not a valid P2PKH CashAddr |
| `BCH_NETWORK_MISMATCH` | Address network differs from the expected network |
| `BCH_SIGNATURE_INVALID` | Malformed or unrecoverable signature |
| `BCH_SIGNATURE_NOT_BY_ADDRESS` | Recovered key does not control the declared address |

## 5. Integration

The Create Identity page uses `verifyManualSignature()` for pasted wallet signatures. The adapter package is covered by `tests/wallet-adapter.test.ts` with deterministic keys; that test is not evidence of real-wallet interoperability.

## 6. Required real-wallet evidence (not yet collected)

- Wallet name and version
- SDK version
- Address and network
- Canonical message
- Signature verification result
- Error cases
- Screenshot/record of the approval screen, if permitted

Do not fabricate approval screenshots or signatures.
