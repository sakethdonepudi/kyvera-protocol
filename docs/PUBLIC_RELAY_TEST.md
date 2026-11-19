# Disposable Public-Relay Identity Test

**Status:** not executed. This procedure publishes public Nostr events and
requires explicit authorization first.

Do not run this against a production identity, a funded wallet, or without the
relay operator’s terms being acceptable to you.

---

## Authorization gate

The script refuses to run unless **both** are set:

```bash
export I_AUTHORIZE_PUBLIC_RELAY_TEST=yes
export KYVERA_PUBLIC_RELAY=wss://relay.example
```

`I_AUTHORIZE_PUBLIC_RELAY_TEST=yes` is an explicit statement that publishing two
disposable events to that relay is authorized. The script rejects localhost and
non-`wss://` endpoints.

## What it publishes

1. A **bind** record signed by a fresh Nostr key and a fresh unfunded BCH P2PKH key.
2. A **revoke** record for the same identity, immediately after the binding is observed.

The keys exist only in process memory and are discarded when the process exits.
No private key, seed phrase or WIF is printed. No transaction is created and no
funds are spent.

## Procedure

```bash
pnpm relay:health wss://relay.example
I_AUTHORIZE_PUBLIC_RELAY_TEST=yes \
KYVERA_PUBLIC_RELAY=wss://relay.example \
pnpm test:public-relay
```

Expected output:

```text
Disposable public-relay identity test
relay:   wss://relay.example
npub:    npub1…
address: bitcoincash:q…
bind:    <event id> [{"url":"…","ok":true,…}]
observed: ACTIVE · ACTIVE_HEAD · FULL
revoke:  <event id> [...]
observed: REVOKED · REVOKED_HEAD · FULL
Test complete. The identity is revoked; no active public address remains.
```

Then independently verify:

1. Open `/verify?npub=<printed npub>` and confirm `REVOKED` and both records.
2. Open `/verify?address=<printed address>` and confirm `REVOKED`, not `SUPERSEDED`.
3. Re-run `pnpm relay:health wss://relay.example` and confirm EOSE.
4. Wait and re-query to observe relay retention/pruning behavior.
5. Record the relay URL, timestamp, event IDs, observation results and whether
   history remained complete.

## What this proves

- A public relay accepted a KYVERA kind-30078 binding and revocation.
- Discovery can retrieve and resolve the lifecycle.
- The revoked address is not presented as active.
- Relay retention can be observed over time.

## What this does not prove

- That the relay retains history indefinitely.
- That the relay set cannot withhold events.
- Real-wallet compatibility.
- Mainnet payment or transaction finality.
- That the relay operator endorses KYVERA.

## Cleanup

The identity is revoked by the script, so no active address remains. If the
script is interrupted after bind but before revoke, publish the revocation from
the same process is not possible after exit; treat the test address as a
disposable, unfunded public record and record the partial result.
