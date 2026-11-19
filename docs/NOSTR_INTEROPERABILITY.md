# Nostr Interoperability

**Full analysis:** [`docs/protocol/NOSTR_DISCOVERY_RFC.md`](protocol/NOSTR_DISCOVERY_RFC.md)

## Summary

KYVERA publishes each signed record twice:

- **kind 1078** — experimental regular-event public discovery;
- **kind 30078** — legacy NIP-78 application-data mirror.

Both contain identical canonical content and tags. The verifier accepts either and de-duplicates by record ID.

## Why not NIP-78 alone

NIP-78 is explicitly for private application data and says relays **SHOULD** require NIP-42 AUTH and serve it only to the owner. It is not a public interchange format. Using only kind 30078 would make public discovery relay-dependent and potentially AUTH-gated.

Kind 1078 is in the NIP-01 regular range (`1000–9999`), so it is expected to be stored and is not subject to addressable-event replacement. It is **not** a registered kind and KYVERA does not claim a NIP.

## Tags and filters

```json
{
  "kinds": [1078, 30078],
  "authors": ["<subject>"],
  "#k": ["kyvera-v1"]
}
```

```json
{
  "kinds": [1078, 30078],
  "#k": ["kyvera-v1"],
  "#b": ["bitcoincash:..."]
}
```

## Retention

- Unique `d` tags prevent lifecycle collapse under addressable-event rules.
- Regular public events avoid replacement semantics.
- Relays can still prune, rate-limit or moderation-block events.
- `FULL` means every configured relay answered with EOSE; it does not prove global completeness.
- A checkpoint from a previous verification detects a rollback by the current relay set.

## Evidence status

- Local relay tests pass.
- Public relay publication is **BLOCKED** pending explicit authorization.
- No public event IDs or retention claims exist yet.

## Commands

```bash
pnpm relay                     # local demo relay
pnpm relay:health wss://...    # read-only EOSE check
I_AUTHORIZE_PUBLIC_RELAY_TEST=yes KYVERA_PUBLIC_RELAY=wss://... pnpm test:public-relay
```

The public test publishes disposable `bind` and `revoke` records (legacy + public mirrors). It never spends funds or prints private keys.
