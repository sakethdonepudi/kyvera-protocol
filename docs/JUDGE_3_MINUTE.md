# Three-Minute Judge Experience

Everything below runs locally. No deployment, wallet or mainnet transaction is required for the core argument.

---

## 90-second explanation

> A BCH–Nostr binding is usually a claim that two keys were associated once.
> That is not enough. A retired or compromised wallet still has a mathematically
> valid signature forever, and a directory entry cannot tell a payer which
> address is authorized now.
>
> KYVERA treats identity as an authorization chain. A genesis record is signed by
> both the BCH wallet and the Nostr key. Every later record commits to the
> previous record's digest. Rotation requires the current BCH key, the new BCH
> key and the Nostr key. Revocation ends the chain.
>
> The verifier resolves the signed records itself. It does not call a KYVERA
> server, because there is none. The same library also issues and validates
> short-lived relying-party sessions.
>
> The proof is the distinction in stage five: wallet A's historical proof still
> verifies, but wallet A is superseded and no longer authorized. That is the
> problem a simple binding cannot answer.
>
> Everything here is open source, testable, and honest about what is not yet
> verified against physical wallets.

---

## Three-minute walkthrough

### 0:00–0:30 — Landing

Open `/`.

- Read the headline: **Your keys change. Your identity continues.**
- Use the lifecycle instrument to move from bind to rotate.
- Point out: the old signature stays valid; the authorization moves.

### 0:30–1:15 — Trust Challenge

Open `/challenge` (guided demo).

1. **Bind** — two independent signatures create one identity.
2. **Verify** — the chain resolves from signed records.
3. **Authenticate** — a relying party issues a single-use challenge; replay is
   rejected; an unauthorized rotation cannot sign in.
4. **Rotate** — wallet A authorizes wallet B; the forged branch is rejected.
5. **Prove** — wallet A's proof still verifies, wallet A is superseded, and the
   pre-rotation session returns `SESSION_ADDRESS_CHANGED`.

Say: “This is the whole submission in five clicks.”

### 1:15–1:50 — Independent relying party

Option A (browser): `/auth-demo` — resolve, create a sign-in request, sign, show
the session, replay rejection, logout, then rotate/revoke to invalidate it.

Option B (terminal):

```bash
pnpm rp:demo
```

Expected: `10/10 checks passed`, with no KYVERA website, API, relay or
proprietary service.

### 1:50–2:25 — Wallet onboarding and payment

Open `/create`.

- Default state is **Connect Wallet** (WizardConnect).
- If a wallet is available, pair and show the automatic address.
- Otherwise use the labelled demo path and explain the limitation: WizardConnect
  does not expose arbitrary message signing, so the wallet signs the proof
  message and KYVERA verifies the pasted signature.
- Show the **address connected → verified → publish** gate.

Open `/merchant`.

- Verify the self-asserted demo merchant.
- Show the payment destination unlock.
- Rotate; the destination moves to wallet B and wallet A becomes superseded.

Open `/pay` and show the BIP21 handoff and the policy blocks. State clearly:
**this is a wallet handoff, not a fabricated transaction receipt.**

### 2:25–3:00 — Evidence

Open `/lab` or scroll to the Trust Challenge evidence.

- Show a real verifier result: `CONFLICT`, `STALE`, `REVOKED`, or
  `MISSING_CHAIN_SEGMENT`.
- Open `/developers` and show `pnpm rp:demo`, the vectors and the protocol docs.
- Close with the honest limitation: physical wallet pairing and message signing
  are not claimed; the manual procedure is documented.

---

## Reproducible procedure

```bash
pnpm install
pnpm test          # 128 tests, 13 files
pnpm typecheck
pnpm build
pnpm relay         # terminal 1
pnpm dev           # terminal 2
pnpm qa:browser    # 54 browser checks
pnpm rp:demo       # 10/10 independent RP checks
```

Routes: `/`, `/demo`, `/challenge`, `/lab`, `/verify`, `/create`, `/merchant`,
`/pay`, `/auth-demo`, `/interop`, `/developers`.

---

## Submission-ready technical summary

KYVERA is a BCH–Nostr identity-continuity protocol. It binds two independent
keys in a canonical record, verifies both proofs locally, and resolves
authorization through a hash-linked chain. Rotation requires signatures from the
current BCH key, the new BCH key and the Nostr key. Revocation terminates the
chain. Relying parties can authenticate users with single-use,
origin/session-bound challenges and short-lived sessions without a KYVERA
backend. The same verifier powers the browser, CLI, standalone HTML demo and an
independent relying-party example.

**Not claimed:** physical wallet interoperability, mainnet payment, transaction
receipts, third-party merchant attestations, or completeness against a relay set
that withholds history.
