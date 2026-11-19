#!/usr/bin/env node
/**
 * Disposable public-relay identity test.
 *
 * PUBLISHES TWO PUBLIC NOSTR EVENTS. Do not run without explicit authorization.
 *
 * Required:
 *   I_AUTHORIZE_PUBLIC_RELAY_TEST=yes
 *   KYVERA_PUBLIC_RELAY=wss://relay.example
 *
 * It generates throwaway keys in memory, publishes a binding, verifies it from
 * the relay, publishes a revocation, and verifies the revoked state. It never
 * spends funds, requests a wallet, or prints a private key.
 */
import { generateBchKeyPair } from "@kyvera/bch";
import { generateNostrSecretKey, signerFromSecretKey, toNpub } from "@kyvera/nostr";
import { publishToRelays } from "@kyvera/nostr";
import { createBindRecord, createRevokeRecord, resolveIdentity } from "@kyvera/verifier";

const relay = process.env.KYVERA_PUBLIC_RELAY ?? "";
if (process.env.I_AUTHORIZE_PUBLIC_RELAY_TEST !== "yes") {
  console.error("Refusing to publish: set I_AUTHORIZE_PUBLIC_RELAY_TEST=yes only with explicit authorization.");
  process.exit(2);
}
if (!/^wss:\/\//.test(relay) || /127\.0\.0\.1|localhost/.test(relay)) {
  console.error("KYVERA_PUBLIC_RELAY must be a public wss:// relay, not localhost.");
  process.exit(2);
}

const secret = generateNostrSecretKey();
const signer = signerFromSecretKey(secret);
const subject = await signer.getPublicKey();
const bch = generateBchKeyPair("mainnet");
const issuedAt = Math.floor(Date.now() / 1000);

console.log("Disposable public-relay identity test");
console.log(`relay:   ${relay}`);
console.log(`npub:    ${toNpub(subject)}`);
console.log(`address: ${bch.identity.address}`);
console.log("No private key will be printed. The key is discarded when this process exits.");

const bind = await createBindRecord({
  signer,
  bchPrivateKey: bch.privateKey,
  bch: bch.identity,
  issuedAt,
});
const bindReport = await publishToRelays([relay], bind.event);
console.log(`bind:    ${bind.event.id} ${JSON.stringify(bindReport)}`);
if (!bindReport[0]?.ok) {
  console.error("Binding was not accepted; stopping before revocation.");
  process.exit(1);
}

async function waitFor(status) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const resolution = await resolveIdentity({ subject, relays: [relay], now: Math.floor(Date.now() / 1000) });
    if (resolution.status === status) return resolution;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  return resolveIdentity({ subject, relays: [relay], now: Math.floor(Date.now() / 1000) });
}

const active = await waitFor("ACTIVE");
console.log(`observed: ${active.status} · ${active.reasonCode} · ${active.assurance}`);

const revoke = await createRevokeRecord({
  signer,
  previous: {
    recordId: bind.recordId,
    sequence: 0,
    bch: bch.identity,
  },
  currentBchPrivateKey: bch.privateKey,
  issuedAt: issuedAt + 1,
});
const revokeReport = await publishToRelays([relay], revoke.event);
console.log(`revoke:  ${revoke.event.id} ${JSON.stringify(revokeReport)}`);

const revoked = await waitFor("REVOKED");
console.log(`observed: ${revoked.status} · ${revoked.reasonCode} · ${revoked.assurance}`);
console.log("Test complete. The identity is revoked; no active public address remains.");
process.exit(revoked.status === "REVOKED" ? 0 : 1);
