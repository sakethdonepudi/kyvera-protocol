#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { normalizeNostrPublicKey, toNpub } from "@kyvera/nostr";
import type { KyveraEvent } from "@kyvera/core";
import { resolveAddress, resolveEvents, resolveIdentity, summarizeRelays } from "./index.js";

interface Args {
  command: "identity" | "address" | "file";
  target: string;
  relays: string[];
  json: boolean;
  network: "mainnet" | "chipnet";
  now?: number;
}

const DEFAULT_RELAYS = "wss://relay.damus.io,wss://nos.lol";

function usage(): string {
  return `KYVERA independent verifier

Usage:
  kyvera-verify <npub|hex>                 Resolve the current authorized state
  kyvera-verify --address <cashaddr>       Resolve a BCH payment address
  kyvera-verify --file <events.json>       Verify an offline event set

Options:
  --relay <url>        Relay to query (repeatable). Default: $KYVERA_RELAYS
  --network <net>      mainnet | chipnet (default: mainnet)
  --now <unix>         Override verification time (testing only)
  --json               Print machine-readable JSON
  -h, --help           Show this help

Exit codes: 0 conclusive state, 1 uncertain or invalid, 2 usage error.
`;
}

function parse(argv: string[]): Args | string {
  let command: Args["command"] = "identity";
  let target = "";
  let relays: string[] = [];
  let json = false;
  let network: "mainnet" | "chipnet" = "mainnet";
  let now: number | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (arg === "-h" || arg === "--help") return "help";
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--relay") {
      const value = argv[++index];
      if (!value) return "missing value for --relay";
      relays.push(value);
      continue;
    }
    if (arg === "--network") {
      const value = argv[++index];
      if (value !== "mainnet" && value !== "chipnet") return "network must be mainnet or chipnet";
      network = value;
      continue;
    }
    if (arg === "--now") {
      const value = Number(argv[++index]);
      if (!Number.isSafeInteger(value) || value <= 0) return "invalid --now";
      now = value;
      continue;
    }
    if (arg === "--address") {
      command = "address";
      target = argv[++index] ?? "";
      continue;
    }
    if (arg === "--file") {
      command = "file";
      target = argv[++index] ?? "";
      continue;
    }
    if (arg.startsWith("-")) return `unknown option: ${arg}`;
    if (target) return "unexpected extra argument";
    target = arg;
  }

  if (!target) return "missing target";
  if (relays.length === 0) {
    relays = (process.env.KYVERA_RELAYS ?? DEFAULT_RELAYS)
      .split(",")
      .map((url) => url.trim())
      .filter(Boolean);
  }
  return { command, target, relays, json, network, now };
}

function line(...parts: string[]): string {
  return parts.filter(Boolean).join(" ");
}

function humanIdentity(result: Awaited<ReturnType<typeof resolveIdentity>>): string {
  const out: string[] = [];
  out.push("KYVERA identity resolution");
  out.push(line(" subject:  ", toNpub(result.subject)));
  out.push(line("           ", result.subject));
  out.push(line(" status:   ", result.status, `(${result.reasonCode})`));
  out.push(line(" reason:   ", result.reason));
  out.push(line(" assurance:", result.assurance, `${result.sync.responded}/${result.sync.total} relays`));
  if (result.activeBch) {
    out.push(line(" BCH:      ", result.activeBch.address));
    out.push(line(" network:  ", result.activeBch.network));
  }
  if (result.head) {
    out.push(line(" sequence: ", String(result.head.record.payload.sequence)));
    out.push(
      line(" issued:   ", new Date(result.head.record.payload.issuedAt * 1000).toISOString()),
    );
  }
  if (result.history.length > 0) {
    out.push(" history:");
    for (const step of result.history) {
      const payload = step.record.payload;
      out.push(
        line(
          `  #${payload.sequence}`,
          payload.type.padEnd(6),
          payload.bch?.address ?? "(no address)",
          new Date(payload.issuedAt * 1000).toISOString(),
          step.recordId.slice(0, 12),
        ),
      );
    }
  }
  if (result.superseded.length > 0) {
    out.push(" superseded:");
    for (const old of result.superseded) {
      out.push(`  #${old.sequence} ${old.address} → ${old.replacedBy}`);
    }
  }
  if (result.rejected.length > 0) {
    out.push(" rejected records:");
    for (const rejected of result.rejected.slice(0, 5)) {
      out.push(`  ${rejected.code}: ${rejected.message}`);
    }
  }
  out.push(" relays:");
  for (const relay of result.sync.relays) {
    out.push(
      `  ${relay.ok ? "ok  " : "fail"} ${relay.url} ${relay.ok ? `${relay.events} events${relay.eose ? "" : " (no EOSE)"}` : relay.error ?? ""}`,
    );
  }
  return out.join("\n");
}

async function main(): Promise<number> {
  const parsed = parse(process.argv.slice(2));
  if (parsed === "help") {
    process.stdout.write(usage());
    return 0;
  }
  if (typeof parsed === "string") {
    process.stderr.write(`error: ${parsed}\n\n${usage()}`);
    return 2;
  }

  if (parsed.command === "address") {
    const result = await resolveAddress({
      address: parsed.target,
      relays: parsed.relays,
      network: parsed.network,
      now: parsed.now,
    });
    if (parsed.json) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      process.stdout.write(`KYVERA address resolution\n`);
      process.stdout.write(` address:   ${result.address}\n`);
      process.stdout.write(` status:    ${result.status}\n`);
      process.stdout.write(` reason:    ${result.reason}\n`);
      process.stdout.write(` assurance: ${result.assurance} (${result.sync.responded}/${result.sync.total} relays)\n`);
      for (const binding of result.bindings) {
        process.stdout.write(
          ` binding:   ${toNpub(binding.subject)} → ${binding.currentAddress ?? "(none)"} [${binding.status}]\n`,
        );
      }
    }
    return ["ACTIVE", "SUPERSEDED", "REVOKED", "EXPIRED"].includes(result.status) ? 0 : 1;
  }

  if (parsed.command === "file") {
    const raw = readFileSync(parsed.target, "utf8");
    const events = JSON.parse(raw) as KyveraEvent[];
    if (!Array.isArray(events)) {
      process.stderr.write("error: file must contain a JSON array of Nostr events\n");
      return 2;
    }
    const now = parsed.now ?? Math.floor(Date.now() / 1000);
    const { resolution } = resolveEvents(events, { now, network: parsed.network });
    const result = {
      ...resolution,
      assurance: "UNSYNCED" as const,
      sync: summarizeRelays([]),
      sources: {},
    };
    if (parsed.json) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      process.stdout.write(humanIdentity(result));
      process.stdout.write("\n note: offline verification; current-state freshness is not asserted.\n");
    }
    return ["ACTIVE", "SUPERSEDED", "REVOKED", "EXPIRED"].includes(result.status) ? 0 : 1;
  }

  const subject = normalizeNostrPublicKey(parsed.target);
  if (!subject) {
    process.stderr.write(`error: not an npub or 32-byte hex public key: ${parsed.target}\n`);
    return 2;
  }
  const result = await resolveIdentity({
    subject,
    relays: parsed.relays,
    network: parsed.network,
    now: parsed.now,
  });
  if (parsed.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(`${humanIdentity(result)}\n`);
  }
  return ["ACTIVE", "SUPERSEDED", "REVOKED", "EXPIRED"].includes(result.status) ? 0 : 1;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    process.stderr.write(`fatal: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exit(1);
  });
