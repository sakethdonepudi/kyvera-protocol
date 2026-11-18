# Judge Demo Script — 90 seconds

**Goal:** make the difference between a valid historical proof and a currently authorized binding obvious, fast.

**Before the clock starts**

- Open `http://localhost:3000/demo` (or the deployed `/demo`).
- Have `demo/kyvera-standalone.html` open in a second tab as fallback.
- Do not open the create flow; it adds friction and is not needed for the core argument.
- Do not claim wallet compatibility, deployment, or Mainnet Track eligibility unless those are true at submission time.

---

## 0:00 — Landing (10s)

**Show:** `/`

**Say:** "Keys change. Trust shouldn't disappear. KYVERA is an identity continuity protocol for Bitcoin Cash and Nostr."

**Point at:** the live instrument. "This is not a mockup — the resolver runs in the browser on deterministic unspendable fixtures."

---

## 0:10 — Two independent keys and binding (15s)

**Show:** `/demo`, Step 01 "Two independent keys" → Step 02 "Bind".

**Say:** "A Nostr key and a BCH wallet key. Neither is derived from the other. Both sign one canonical record at sequence zero."

**Point at:** the Nostr identity, wallet A, and the genesis record.

---

## 0:25 — Independent verification (10s)

**Show:** Step 03 "Verify independently".

**Say:** "The verifier checks the Schnorr signature, recovers the BCH key from the `signmessage` signature, verifies `hash160(key) == address`, and walks the chain from genesis. No KYVERA server."

---

## 0:35 — Authorized rotation (15s)

**Show:** Step 04 "Rotate".

**Say:** "Rotation needs three signatures: the old wallet authorizes leaving, the new wallet proves control, and the identity key binds the transition."

**Point at:** wallet A → SUPERSEDED, wallet B → current.

---

## 0:50 — Historical proof remains valid (10s)

**Show:** Step 05 "History stays valid".

**Say:** "Wallet A's signature is still cryptographically true. It is not the current destination. That distinction is the whole project."

---

## 1:00 — Unauthorized rotation rejected (10s)

**Show:** Step 06 "Unauthorized rotation".

**Say:** "A thief with the Nostr key and a new wallet still cannot rotate, because the current wallet's BCH signature is missing."

**Point at:** the rejection code and "state unchanged".

---

## 1:10 — SDK / CLI evidence (10s)

**Show:** Step 07 "Same answer in the CLI" (SDK snippet + CLI output).

**Say:** "The same public SDK powers the UI, the CLI and the lab. Anyone can reproduce this result from the signed events."

---

## 1:20 — Revocation and limits (10s)

**Show:** Step 08 "Revoke" → then `/lab` if time permits.

**Say:** "Revocation is signed by the current wallet and the identity key and ends the chain. No recovery, no absolute rollback protection without a checkpoint, no production audit claim."

---

## Optional 20-second Trust Challenge hook

Open `/challenge`. Click **Prove**. Say: "Wallet A's historical signature is still mathematically valid, but the chain moved to wallet B. That is the difference between a proof that a key existed and proof of what is authorized now." If time permits, click **Authenticate** to show the single-use challenge and replay rejection.

## Optional 10-second auth-demo hook

Open `/auth-demo`, select the demo identity, create a sign-in request and sign. Show the issued session, replay rejection, logout, and the rotation/revocation session invalidation. Say: "An independent relying party verifies the signature and resolves the chain itself; it never asks KYVERA for a login decision."

## Optional 10-second Pay hook

Open `/pay?npub=<demo npub>`, show the ACTIVE destination and policy, enter an amount, confirm, and show the BIP21/QR handoff. Say: "The wallet verifies and broadcasts; KYVERA does not fabricate a receipt." Do not claim a wallet transaction unless one was actually performed.

## Optional 10-second lab hook

Open `/lab`, click **Equivocation**.

**Say:** "Two valid rotations at the same sequence produce CONFLICT with evidence. The verifier refuses to pick a winner."

---

## Fallback path (no app running)

Open `demo/kyvera-standalone.html` directly. It contains the same six scenarios and uses the real verifier. No install, server or relay.

## Claims that are safe

- 134 automated tests across 13 files, including property/fuzz tests and an explicit adversarial suite.
- `pnpm rp:demo` — independent relying party, 10/10 checks with no KYVERA API or relay.
- Independent BCH `signmessage` vector verified.
- Eight explicit statuses, including `SUPERSEDED`, `CONFLICT`, `STALE`.
- BCH + Nostr dual-key binding, rotation, revocation.
- Independent SDK and CLI.
- Browser E2E 54/54, mobile and reduced motion tested.

## Claims to avoid until completed

- "Supports Electron Cash / Paytaca / Cashonize" unless a real signature row is recorded.
- "Deployed" or "live" before a public URL exists.
- "Mainnet Track eligible" without live demo, WizardConnect/XO and a mainnet transaction feature.
- "Recoverable" — recovery is explicitly not implemented.
- "Production ready" or "audited".
