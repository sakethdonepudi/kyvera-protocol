# Real-Device Wallet Test Procedure

**Status:** not executed. No physical wallet or browser extension was available in the release environment.
**Purpose:** produce reproducible evidence for Paytaca, Cashonize and Selene without ever exposing keys or spending funds.

Do not mark a wallet "confirmed" until the identity flow below passes on that wallet. A pairing dialog opening is not a compatibility result.

---

## 1. Support status

| Wallet | WizardConnect pairing | Automatic address | Wallet message signing | Confirmed real-device test |
| --- | --- | --- | --- | --- |
| Paytaca | Implemented in wallet source | Expected (xpub derivation) | Internal Sign Message UI; no public dapp API | **No** |
| Cashonize | Implemented in wallet source | Expected (xpub derivation) | Not exposed; transaction signing only | **No** |
| Selene | No integration found | Not applicable | Unknown | **No** |
| Electron Cash | Not integrated | Not applicable | `signmessage` (manual probe) | **No** |

`/pay` BIP21 handoff can be tested independently of WizardConnect.

---

## 2. Safety rules

1. Use a dedicated, unfunded P2PKH address or a chipnet wallet.
2. Never enter a seed phrase or private key into KYVERA.
3. Never sign a transaction during identity verification.
4. Read the exact proof message in the wallet before approving. It starts with `KYVERA/v1/bch-proof`.
5. Record only public data: address, message, signature, wallet version, screenshots.
6. Do not publish an identity on mainnet unless the relay and identity are intended to be public.

---

## 3. Common setup

1. Build and run the app with the local relay:

   ```bash
   pnpm relay
   pnpm dev
   ```

2. Open `http://localhost:3000/create` in a fresh browser profile.
3. Generate a throwaway Nostr key, or connect NIP-07.
4. Keep the browser console open. Record any errors.
5. Have the wallet on the same network shown in KYVERA (`mainnet` or `chipnet`).

---

## 4. Paytaca procedure

### 4.1 Connect and derive

1. Click **Connect Wallet**. Confirm the QR dialog says *Scan with Paytaca or Cashonize*.
2. Scan the QR with Paytaca, or paste the `wiz://` URI into Paytaca's WizardConnect screen if available.
3. Approve the connection.
4. Confirm KYVERA shows:
   - the Paytaca wallet name;
   - a P2PKH address on the selected network;
   - the badge **address connected** (not **verified**).
5. Compare the full address (copy button) with Paytaca's receive address.

Record: wallet version, platform, network, address, whether the address matches.

### 4.2 Prove ownership

1. Click **Copy message**.
2. In Paytaca, open **Sign Message** and paste the exact message.
3. Confirm Paytaca displays the same address and the exact `KYVERA/v1/bch-proof` text.
4. Sign. Copy the base64 signature.
5. Paste it into KYVERA. Do not press anything else.
6. Expected: the badge changes to **verified** only after the local signature check passes, and the Sign step becomes Verified.
7. Publish the identity and confirm the dashboard resolves it.

Record: signature, recovered address, badge transition, publish result, relay result.

### 4.3 Negative cases

- Reject the pairing request: KYVERA must show an error or remain disconnected.
- Disconnect in the wallet: KYVERA must return to **Connect** and clear the proof/signature.
- Switch accounts in the wallet, then reconnect: the displayed address must change; a signature for the old address must not verify.
- Paste an invalid/truncated signature: KYVERA must show an error and keep publishing disabled.
- Switch KYVERA to the other network: the wallet address must be rejected if the network differs.

---

## 5. Cashonize procedure

Repeat the Paytaca steps with these differences:

1. Cashonize must be an **HD wallet**. If it is a single-address wallet, follow Cashonize's conversion prompt before pairing.
2. Scan the WizardConnect QR or open the `wiz://` URI from Cashonize's dapp connection screen.
3. Cashonize exposes transaction signing, not message signing. Use Cashonize's own **Sign/Verify Message** feature if present. If it is unavailable, record **blocked** and do not claim success.
4. The same badge and publish gates apply.

---

## 6. Selene procedure (payment only)

Selene is not claimed as a WizardConnect wallet.

1. Resolve an ACTIVE identity at `/pay`.
2. Enter an amount, confirm the destination, and click **Re-verify and prepare payment**.
3. Open the BIP21 URI/QR in Selene.
4. Confirm Selene shows the same address, amount and network.
5. Do **not** broadcast unless explicitly authorized.

Record: whether Selene parsed the URI, the displayed recipient and amount, and any warning.

---

## 7. Evidence template

Copy this block per wallet:

```text
Wallet:
Version:
Platform / OS:
Network:
KYVERA commit:
Address shown by KYVERA:
Address shown by wallet:
Addresses match: yes / no
Pairing result: approved / rejected / timeout / blocked
Proof message shown by wallet: exact / altered / not shown
Signature verified by KYVERA: yes / no
Badge before signature: address connected
Badge after signature: verified / unchanged
Publish result: relay accepted / relay failed / not attempted
Account switch result:
Wrong network result:
Disconnect result:
Screenshots:
Notes:
```

---

## 8. Acceptance criteria

A wallet is **confirmed** only when:

- pairing and address derivation succeed;
- the derived address matches the wallet;
- the wallet signs the exact proof message;
- KYVERA independently verifies the signature;
- an invalid signature is rejected and publishing stays locked;
- disconnect/reconnect behaves safely;
- no key material is requested or exposed.

Otherwise record **untested** or **blocked**. Do not infer compatibility from source inspection alone.

---

## 9. Current blockers

- No Paytaca, Cashonize or Selene installation was available.
- Paytaca's message-signing route is internal extension UI, not a documented dapp API.
- Cashonize's WizardConnect path signs transactions only.
- Selene has no WizardConnect integration in public source.
- No mainnet transaction or payment broadcast was performed.
