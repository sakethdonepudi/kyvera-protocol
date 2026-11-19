# Disposable Nostr Relay Lifecycle Test

**Status:** local run PASS; public run PASS on `wss://nos.lol` and `wss://relay.primal.net` with explicit authorization on 2026-11-19. Short-term retention observed; indefinite retention is not claimed.

Do not run this against a production identity, a funded wallet, or without accepting the relay operator's terms.

---

## Local run (no public publication)

```bash
pnpm relay
I_AUTHORIZE_LOCAL_RELAY_TEST=yes \
KYVERA_PUBLIC_RELAY=ws://127.0.0.1:7777 \
node scripts/public-relay-identity-test.mjs
```

This publishes disposable records only to the local relay. See [`docs/audits/DISCOVERY_EVIDENCE.md`](audits/DISCOVERY_EVIDENCE.md) for observed results.

---

## Public run (explicit authorization required)

Executed evidence: [`docs/audits/DISCOVERY_EVIDENCE.md`](audits/DISCOVERY_EVIDENCE.md).

```bash
export I_AUTHORIZE_PUBLIC_RELAY_TEST=yes
export KYVERA_PUBLIC_RELAY=wss://relay.example
node scripts/public-relay-identity-test.mjs
```

The script refuses to run without both variables. It rejects non-`wss://` public endpoints.

### What it publishes

1. A **bind** record signed by a fresh Nostr key and a fresh unfunded BCH P2PKH key.
2. A **rotate A→B** record signed by wallet A, wallet B and the Nostr key.
3. A **forged rotate** event signed by the Nostr key and an attacker wallet, but without a valid current-wallet proof. The relay may accept the event; the verifier must reject it.
4. A **revoke** record signed by wallet B and the Nostr key.

Legacy kind `30078` and public kind `1078` envelopes are published for bind/rotate/revoke. The forged event is legacy-only.

Keys exist only in process memory. No private key, seed phrase or WIF is printed. No transaction is created and no funds are spent.

### Observed outputs to record

- relay URL and NIP-11/health result;
- public and legacy event IDs;
- relay `OK` acknowledgements;
- resolution status, assurance and history length after each step;
- forged rejection code;
- retrieval counts by kind;
- missing-history status;
- a later re-query to observe retention.

### What this proves

- A public relay accepted the dual-envelope format.
- Discovery can retrieve and reconstruct the full lifecycle.
- The revoked address is not presented as active.
- An unauthorized rotation is rejected even if a relay stores it.

### What this does not prove

- Indefinite retention.
- Global completeness or protection from a colluding relay set.
- Real-wallet compatibility.
- Mainnet payment or transaction finality.
- Relay endorsement of KYVERA.

### Cleanup

The identity ends revoked, so no active address remains. If the process is interrupted after bind, the unfunded disposable records may remain public; record the partial result and do not reuse the test label.
