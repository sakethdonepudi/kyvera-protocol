# Wallet UX and WizardConnect API Audit

**Date:** 2026-11-18
**Commit:** `4234953` + working tree
**Scope:** `/create`, `/pay`, `apps/web/lib/wallet.ts`, WizardConnect packages, Paytaca / Cashonize / Selene public source.

---

## 1. Installed WizardConnect versions

| Package | Version |
| --- | --- |
| `@wizardconnect/dapp` | 0.2.8 |
| `@wizardconnect/react` | 0.2.7 |
| `@wizardconnect/core` | 0.2.11 |

The integration uses `useWizardConnect({ dappName: "KYVERA", sessionKey })`, `wallet.connect()`, `wallet.disconnect()`, `wallet.manager.getPubkey(0, 0n)`, and `WizardConnectQRDialog`.

Address derivation uses the documented receive path (`0`) and index `0n`, then `publicKeyToP2pkhCashAddress` with the selected network. This matches the official dapp guide (`getPubkey(RECEIVE, 0n)`).

---

## 2. Protocol surface (official documentation)

Source: <https://gitlab.com/riftenlabs/lib/wizardconnect/-/blob/master/docs/dapp.md>

The `DappConnectionManager` exposes:

- `connect()` / relay pairing and `wallet_ready` handshake;
- `getPubkey(childIndex, index)` for local address derivation from xpubs;
- `sendSignRequest` / `signTransaction` for **transaction** signing only;
- `sendSignCancel`, `sendDisconnect`, session persistence and reconnect.

The only well-known signing action in `@wizardconnect/core` is:

```text
sign_transaction_request → sign_transaction_response
```

There is **no standard message-signing action**. The protocol supports extension-defined custom actions, but no message-signing extension is standardized or advertised by Paytaca or Cashonize. A dapp must not invent one or bypass wallet approval.

**Conclusion:** WizardConnect is suitable for automatic BCH address retrieval and transaction approval, not for proving address ownership through `signmessage`.

---

## 3. Wallet-by-wallet findings

### Paytaca

- Public source: <https://github.com/paytaca/paytaca-app>
- WizardConnect wallet package: `@wizardconnect/wallet` `^0.2.0` (`package.json`).
- Internal `src/pages/sign/message.vue` exists for Paytaca's own signing flows.
- The extension app listens for `bex.paytaca.signMessage` and routes to that page.
- This is internal BEX/extension messaging. No documented public `window.paytaca` provider or dapp-facing `signMessage` method was found. The extension does not expose a standard injected API for arbitrary websites.
- **Decision:** do not call internal BEX events. Use Pair → automatic address → wallet's visible **Sign Message** UI → paste signature.

### Cashonize

- Public source: <https://github.com/cashonize/cashonize-wallet>
- WizardConnect is implemented (`wizardconnectStore`, `connectDapp.vue`, `wizSigning.ts`).
- `wizSigning.ts` signs **transactions and contract inputs only**. No message-signing action.
- WizardConnect requires an HD wallet; single-address wallets must be converted by the user.
- **Decision:** same two-step proof; no invented API.

### Selene

- Public source: <https://github.com/fyookball/selene3>
- No WizardConnect dapp integration was found in the source tree.
- Selene can still open a BIP21 URI, so it remains a valid **payment handoff** target.
- The UI no longer claims Selene for WizardConnect. Previous copy was corrected.

### Other protocols checked

- **CashConnect** (used by Cashonize): public types are session proposals and `ExecuteActionRequest` / `ExecuteActionResponse` wallet actions. No message-signing primitive is documented. Not integrated here.
- **BCH WalletConnect**: transaction signing. Not integrated here.
- **Electron Cash**: has a user-facing Sign Message feature, but no documented dapp provider for arbitrary web pages. The manual `/interop` probe remains the only supported path.

No official BCH wallet API was found that provides direct, approval-gated arbitrary message signing to a web dapp. The safe path remains the wallet's own Sign Message UI plus independent verification.

---

## 4. UX audit and fixes

| Issue | Resolution |
| --- | --- |
| Two `SignatureStep` blocks rendered in wallet mode | Removed the duplicate; only the active Sign state renders one |
| No explicit connect/sign/verified/publish states | Added the `WizardSteps` rail driven by wallet, signature and publish state |
| Address badge could imply verification after connection | Badge is **address connected** until `verifyBitcoinMessageSignature` succeeds, then **verified** |
| Manual "Verify ownership" click | Signature verification now runs automatically once the pasted value is plausibly complete (≥ 80 base64 chars) |
| Proof message had a generic copy control | Single explicit **Copy message** button |
| Long helper copy during connect | Only a concise active-state instruction is shown during Sign |
| Selene claimed as WizardConnect wallet | Removed from `/create`, `/pay`, landing copy and docs |
| Stale publish success after switching mode/network/address | Publish state resets when the wallet context changes |

The signing step shows:

> In {wallet}, choose **Sign Message**, then paste the signature.

and the proof message with one copy action. No private key or seed phrase is ever requested. Publishing remains blocked until the signature verifies, and `completeExternalBind` verifies again at publish time.

---

## 5. Residual risks / untested behavior

- No physical Paytaca, Cashonize or Selene device/extension was available. Pairing approval, rejection, account switching, wrong network and disconnection are **not verified**.
- The handshake exposes xpubs, not the wallet's network. KYVERA derives the address from the selected `mainnet`/`chipnet` setting; the user must select the network that matches the wallet. A wrong-network warning is not available from the protocol.
- The `useWizardConnect` hook does not expose a documented account-change event. If the wallet rotates its receive key, the derived address may not update until a reconnect/re-render. Treat this as untested.
- WizardConnect session persistence is enabled with the `kyvera-create-wallet` storage key. A stale session can be restored; the UI derives the address again, but users should still compare it with the wallet.
- The proof message and signature are public evidence. Do not sign on a funded address unless the message is the exact KYVERA proof text.

The device procedure is in [`WALLET_DEVICE_TEST.md`](WALLET_DEVICE_TEST.md).
