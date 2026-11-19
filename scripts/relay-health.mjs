#!/usr/bin/env node
/**
 * Read-only relay health check.
 *
 * Usage:
 *   node scripts/relay-health.mjs wss://relay-a wss://relay-b
 *   KYVERA_RELAYS=wss://relay-a,wss://relay-b node scripts/relay-health.mjs
 *
 * Queries KYVERA public and legacy kinds with limit 1. It never publishes.
 * Exit code 0 only when every requested relay responded with EOSE.
 */
import { queryRelay } from "@kyvera/nostr";
import { NOSTR_KINDS } from "@kyvera/core";

const args = process.argv.slice(2);
const env = (process.env.KYVERA_RELAYS ?? "").split(",").map((value) => value.trim()).filter(Boolean);
const relays = [...args, ...env];

if (relays.length === 0) {
  console.error("usage: node scripts/relay-health.mjs <wss://relay> [...]");
  process.exit(2);
}

let failed = 0;
for (const url of relays) {
  const report = await queryRelay(url, [{ kinds: [...NOSTR_KINDS], limit: 1 }], {
    connectionTimeoutMs: 6_000,
    queryTimeoutMs: 8_000,
  });
  const ok = report.ok && report.eose;
  if (!ok) failed += 1;
  console.log(
    JSON.stringify({
      url,
      ok: report.ok,
      eose: report.eose,
      events: report.events.length,
      error: report.error ?? null,
      latencyMs: report.latencyMs,
    }),
  );
}

console.log(`\n${relays.length - failed}/${relays.length} relays healthy (EOSE)`);
process.exit(failed === 0 ? 0 : 1);
