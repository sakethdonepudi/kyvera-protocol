# Known Limitations

**Status:** current as of 2026-11-19

## Discovery

- Public relay retention has not been measured. No public event IDs exist yet.
- A first-time verifier cannot prove that a relay set disclosed the latest revocation.
- `FULL` means all configured relays answered with EOSE, not global completeness.
- Kind `1078` is experimental and unregistered. Some relays may reject or prune it.
- The legacy kind-30078 mirror may be AUTH-gated by NIP-78-compliant relays.

## Wallet

- WizardConnect exposes an address but not arbitrary message signing in the integrated version.
- The supported proof workflow is manual `signmessage`.
- No physical Paytaca/Cashonize/Selene/Electron Cash signing test has been performed.
- Only P2PKH addresses are supported.
- The adapter cannot prove a wallet's internal key handling.

## Authentication

- The default `AuthRequestService` store is in-memory.
- The example file store is single-process, without multi-process locking.
- No production rate limiting, audit log or key management.
- Sessions are bearer tokens; transport security is the deployer's responsibility.
- Relay withholding can preserve a stale session until revalidation fails.

## Protocol

- No recovery after loss of all authorized keys.
- No threshold or witness-assisted history assurance.
- No global ordering or consensus.
- No on-chain identity commitments or CashTokens.
- No W3C DID method, DID document or Universal Resolver integration.
- No Verifiable Credentials, portable reputation or third-party attestations.
- No independent security audit.

## Product

- The narrated films show the pre-4.3 interface.
- The demo/lab use deterministic unspendable fixtures.
- Real-funds payment is a BIP21 handoff; no transaction or receipt is claimed.
- Mainnet Track eligibility is not met (top banner, EMBER address, mainnet transaction feature).
