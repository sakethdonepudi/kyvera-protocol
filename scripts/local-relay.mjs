#!/usr/bin/env node
/**
 * Minimal local Nostr relay for the KYVERA offline demonstration.
 *
 *   node scripts/local-relay.mjs --port 7777
 *
 * Supports NIP-01 EVENT / REQ / CLOSE, verifies event signatures and persists
 * to `.context/relay-events.json` so a restart keeps the demo history.
 * This is a demo tool, not a production relay: no rate limits, no auth,
 * no NIP-11 document, no pruning.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { WebSocketServer } from "ws";
import { matchFilter, verifyEvent } from "nostr-tools";

const args = process.argv.slice(2);
const get = (flag, fallback) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : fallback;
};
const port = Number(get("--port", process.env.PORT ?? 7777));
const storePath = resolve(get("--store", ".context/relay-events.json"));
const reset = args.includes("--reset");

const events = new Map();

if (!reset && existsSync(storePath)) {
  try {
    const stored = JSON.parse(readFileSync(storePath, "utf8"));
    for (const event of stored) events.set(event.id, event);
    console.log(`loaded ${events.size} events from ${storePath}`);
  } catch (error) {
    console.warn(`could not load ${storePath}: ${error.message}`);
  }
}

let saveTimer = null;
function save() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      mkdirSync(dirname(storePath), { recursive: true });
      writeFileSync(storePath, JSON.stringify([...events.values()], null, 2));
    } catch (error) {
      console.warn(`could not save relay state: ${error.message}`);
    }
  }, 150);
}

const server = new WebSocketServer({ port, host: "127.0.0.1" });

server.on("listening", () => {
  console.log(`KYVERA demo relay listening on ws://127.0.0.1:${port}`);
  console.log(`store: ${storePath}${reset ? " (reset)" : ""}`);
  console.log("press Ctrl+C to stop");
});

server.on("connection", (socket) => {
  socket.on("message", (raw) => {
    let message;
    try {
      message = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (!Array.isArray(message)) return;
    const [type] = message;

    if (type === "EVENT") {
      const event = message[1];
      if (!event?.id || !verifyEvent(event)) {
        socket.send(JSON.stringify(["OK", event?.id ?? "", false, "invalid: bad event"]));
        return;
      }
      events.set(event.id, event);
      save();
      socket.send(JSON.stringify(["OK", event.id, true, ""]));
      console.log(`[event] ${event.kind} ${event.id.slice(0, 12)}… by ${event.pubkey.slice(0, 12)}… (${events.size} total)`);
      return;
    }

    if (type === "REQ") {
      const subscriptionId = String(message[1]);
      const filters = message.slice(2);
      for (const event of events.values()) {
        if (filters.some((filter) => matchFilter(filter, event))) {
          socket.send(JSON.stringify(["EVENT", subscriptionId, event]));
        }
      }
      socket.send(JSON.stringify(["EOSE", subscriptionId]));
      return;
    }

    if (type === "CLOSE") return;
  });
});

function shutdown() {
  console.log("\nsaving relay state…");
  try {
    mkdirSync(dirname(storePath), { recursive: true });
    writeFileSync(storePath, JSON.stringify([...events.values()], null, 2));
  } catch (error) {
    console.warn(`could not save relay state: ${error.message}`);
  }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 500);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
