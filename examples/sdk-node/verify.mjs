#!/usr/bin/env node
/**
 * Minimal Node.js SDK example.
 *
 *   node examples/sdk-node/verify.mjs <npub|hex> \
 *     --relay wss://nos.lol --relay wss://relay.primal.net
 *
 * Read-only. No KYVERA website or API is contacted.
 */
import { KyveraClient } from "@kyvera/sdk";

const args = process.argv.slice(2);
const relays = [];
let target = "";

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === "--relay") {
    const value = args[++index];
    if (value) relays.push(value);
  } else if (!target) {
    target = arg;
  }
}

if (!target) {
  console.error("usage: node examples/sdk-node/verify.mjs <npub|hex> --relay wss://...");
  process.exit(2);
}

const effectiveRelays =
  relays.length > 0
    ? relays
    : (process.env.KYVERA_RELAYS ?? "wss://nos.lol,wss://relay.primal.net")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);

const client = new KyveraClient({ relays: effectiveRelays });
const result = await client.verify(target);

console.log(`subject              ${result.npub}`);
console.log(`status               ${result.status} (${result.reasonCode})`);
console.log(`cryptographic        ${result.cryptographicValidity}`);
console.log(`historical validity  ${result.historicalValidity.valid} (${result.historicalValidity.records.length} records)`);
console.log(`current authorized   ${result.currentAuthorization.authorized}`);
console.log(`sensitive operations ${result.currentAuthorization.usableForSensitiveOperations}`);
console.log(`destination          ${result.currentAuthorization.address ?? "none"}`);
console.log(`assurance            ${result.evidenceCompleteness.assurance} (${result.evidenceCompleteness.responded}/${result.evidenceCompleteness.total} relays)`);
console.log(`reason               ${result.reason}`);
console.log("");
for (const check of result.checks) {
  console.log(`${check.ok ? "PASS" : "FAIL"}  ${check.id} — ${check.detail}`);
}

process.exit(result.status === "UNKNOWN" || result.status === "STALE" ? 1 : 0);
