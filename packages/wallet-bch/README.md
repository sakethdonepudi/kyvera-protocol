# @kyvera/wallet-bch

Capability-based BCH wallet adapters for KYVERA, plus independent verification of wallet `signmessage` proofs.

## Capability model

The adapter API distinguishes five separate facts:

1. the wallet connected;
2. an address was retrieved;
3. the wallet reports whether it supports arbitrary message signing;
4. a signature was produced;
5. the application independently verified it.

A connected address is **not** a signature. A wallet that cannot sign is never presented as if it can.

```ts
import { WizardConnectAdapter, verifyManualSignature } from "@kyvera/wallet-bch";

const adapter = new WizardConnectAdapter({
  manager,              // WizardConnect manager
  network: "mainnet",
  name: "Paytaca",
});

const connection = await adapter.connect();
console.log(connection.address);
console.log(connection.capabilities.signMessage); // false for the integrated WizardConnect flow
```

## Manual signing

WizardConnect reads a public key/address but does not expose arbitrary message signing in the integrated version. The supported proof workflow is:

1. create the canonical KYVERA message with `createKyveraSigningRequest()`;
2. the user signs it in Paytaca/Cashonize/Selene/Electron Cash;
3. paste the base64 signature back;
4. call `verifyManualSignature()`.

```ts
const result = verifyManualSignature({
  address,
  message: request.message,
  signature: pastedSignature,
  expectedNetwork: "mainnet",
});

if (!result.ok) console.error(result.code, result.message);
```

This is a genuine wallet-produced proof when a real wallet is used. The repository does **not** claim a physical-wallet test or an automated signing API until that evidence exists.

## Network and address checks

- Only P2PKH CashAddr is supported.
- Wrong-network addresses are rejected.
- Malformed signatures are rejected.
- Signature recovery must match the declared address.
- Private keys never enter the adapter or the verifier.

See [`docs/WALLET_ADAPTERS.md`](../../docs/WALLET_ADAPTERS.md) and [`docs/security/KNOWN_LIMITATIONS.md`](../../docs/security/KNOWN_LIMITATIONS.md).
