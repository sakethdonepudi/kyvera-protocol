#!/usr/bin/env node
/**
 * Verify a wallet-produced signmessage signature for the KYVERA probe.
 *
 *   node scripts/verify-wallet-signature.mjs <address> <base64-signature>
 *
 * The message is the fixed probe from /interop. Nothing is transmitted.
 */
import { hashBitcoinMessage, verifyBitcoinMessageSignature } from "@kyvera/bch";
import { binToHex } from "@bitauth/libauth";

const PROBE_MESSAGE = [
  "KYVERA wallet compatibility probe v1",
  "This signature proves control of this BCH address for testing.",
  "It authorizes no payment and can be discarded.",
  "nonce: 7f3a9c2e5b1d8046a9c4e2f7b0d6a1c8",
].join("\n");

const [address, signature] = process.argv.slice(2);
if (!address || !signature) {
  console.error("usage: node scripts/verify-wallet-signature.mjs <cashaddr> <base64-signature>");
  process.exit(2);
}

console.log("KYVERA wallet probe");
console.log(`  address   ${address}`);
console.log(`  message   ${JSON.stringify(PROBE_MESSAGE)}`);
console.log(`  hash      ${binToHex(hashBitcoinMessage(PROBE_MESSAGE))}`);

const check = verifyBitcoinMessageSignature(address.trim().toLowerCase(), PROBE_MESSAGE, signature.trim());
console.log(`  result    ${check.ok ? "VERIFIED" : "REJECTED"}`);
console.log(`  code      ${check.code}`);
console.log(`  detail    ${check.message}`);
if (check.publicKey) console.log(`  pubkey    ${check.publicKey}`);
process.exit(check.ok ? 0 : 1);
