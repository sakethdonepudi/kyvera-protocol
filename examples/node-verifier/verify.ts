/**
 * Minimal independent verifier example.
 *
 *   pnpm build
 *   tsx examples/node-verifier/verify.ts <npub|hex> --relay ws://127.0.0.1:7777
 *
 * This file uses only the public SDK. It has no knowledge of the web app, the
 * demo relay, or any KYVERA service.
 */
import { normalizeNostrPublicKey, toNpub } from "@kyvera/nostr";
import { resolveAddress, resolveIdentity } from "@kyvera/verifier";

const args = process.argv.slice(2);
const relays: string[] = [];
let target = "";

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index]!;
  if (arg === "--relay") {
    const value = args[++index];
    if (value) relays.push(value);
  } else if (!target) {
    target = arg;
  }
}

if (!target) {
  console.error("usage: verify.ts <npub|hex> --relay wss://… [--relay …]");
  process.exit(2);
}

const subject = normalizeNostrPublicKey(target);
if (!subject) {
  console.error("not an npub or 32-byte hex public key");
  process.exit(2);
}

const result = await resolveIdentity({ subject, relays });

console.log(`subject   ${toNpub(subject)}`);
console.log(`status    ${result.status} (${result.reasonCode})`);
console.log(`assurance ${result.assurance} ${result.sync.responded}/${result.sync.total} relays`);
console.log(`reason    ${result.reason}`);

if (result.activeBch) {
  const address = await resolveAddress({ address: result.activeBch.address, relays });
  console.log(`address   ${result.activeBch.address} → ${address.status}`);
}

for (const step of result.history) {
  console.log(`  #${step.record.payload.sequence} ${step.record.payload.type.padEnd(6)} ${step.record.payload.bch?.address ?? "(revoked)"}`);
}

const conclusive = ["ACTIVE", "SUPERSEDED", "REVOKED", "EXPIRED"].includes(result.status);
process.exit(conclusive ? 0 : 1);
