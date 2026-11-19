# Veramo Integration (Deferred)

**Status:** **DEFERRED** — P1. No plugin has been compiled against a Veramo version.
**Reason:** the P0 SDK, discovery and relying-party work take precedence before the submission deadline.

## 1. What would be built

A package `@kyvera/veramo-plugin` that wraps `@kyvera/sdk` and exposes:

- BCH–Nostr identity resolution;
- dual-key binding verification;
- historical authorization inspection;
- current wallet authorization checks;
- rotation/revocation evaluation.

The plugin would call the SDK and would not duplicate cryptographic verification.

## 2. DID boundary

KYVERA is **not** a registered DID method. A Veramo resolver would need a mapping from a KYVERA identifier (npub/hex) to a DID document. That mapping is application-specific and must not be presented as a W3C DID method without a method specification.

Possible mapping:

```json
{
  "id": "did:kyvera:<subject>",
  "verificationMethod": [
    { "id": "#nostr", "type": "SchnorrSecp256k1VerificationKey2019", "publicKeyHex": "<subject>" }
  ],
  "service": [
    { "id": "#bch", "type": "BCHWalletAuthorization", "serviceEndpoint": "<current address>" }
  ],
  "kyvera": {
    "status": "ACTIVE",
    "assurance": "FULL",
    "sequence": 1,
    "recordId": "..."
  }
}
```

This is a design sketch, not a compiled or tested DID document.

## 3. Required before implementation

1. Pin a current Veramo version.
2. Read its actual plugin/resolver interfaces.
3. Implement a resolver that calls `KyveraClient.verify()`.
4. Add unit and integration tests against a Veramo agent.
5. Document compatibility and limitations.
6. Do not claim a DID method registration.

## 4. Recommendation

Do not include Veramo in the primary bounty submission unless the plugin is compiled, tested and documented before the deadline. The SDK is the integration surface for now.
