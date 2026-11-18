import { NOSTR_KIND, NOSTR_K_TAG, type KyveraEvent } from "@kyvera/core";
import { Relay, useWebSocketImplementation, type Subscription } from "nostr-tools/relay";
import type { Filter } from "nostr-tools";

export interface RelayQueryReport {
  url: string;
  ok: boolean;
  /** Whether the relay sent EOSE within the timeout. */
  eose: boolean;
  events: KyveraEvent[];
  error?: string;
  latencyMs: number;
}

export interface RelayPublishReport {
  url: string;
  ok: boolean;
  message: string;
  latencyMs: number;
}

export interface RelayOptions {
  /** Time to wait for the connection handshake. */
  connectionTimeoutMs?: number;
  /** Time to collect events after subscribing. */
  queryTimeoutMs?: number;
  publishTimeoutMs?: number;
}

const DEFAULTS: Required<RelayOptions> = {
  connectionTimeoutMs: 6_000,
  queryTimeoutMs: 8_000,
  publishTimeoutMs: 8_000,
};

let websocketReady: Promise<void> | null = null;

/**
 * Node 20 has no global WebSocket; browsers do. nostr-tools lets us install a
 * WebSocket implementation once, so this stays a single code path for the CLI,
 * the SDK and the web app.
 */
function ensureWebSocket(): Promise<void> {
  if (typeof (globalThis as { WebSocket?: unknown }).WebSocket !== "undefined") {
    return Promise.resolve();
  }
  if (!websocketReady) {
    websocketReady = import(/* webpackIgnore: true */ "ws").then((module) => {
      useWebSocketImplementation(module.WebSocket);
    });
  }
  return websocketReady;
}

export function subjectFilter(subject: string): Filter {
  return { kinds: [NOSTR_KIND], authors: [subject], "#k": [NOSTR_K_TAG] };
}

export function addressFilter(address: string): Filter {
  return { kinds: [NOSTR_KIND], "#k": [NOSTR_K_TAG], "#b": [address.toLowerCase()] };
}

function withDefaults(options: RelayOptions): Required<RelayOptions> {
  return {
    connectionTimeoutMs: options.connectionTimeoutMs ?? DEFAULTS.connectionTimeoutMs,
    queryTimeoutMs: options.queryTimeoutMs ?? DEFAULTS.queryTimeoutMs,
    publishTimeoutMs: options.publishTimeoutMs ?? DEFAULTS.publishTimeoutMs,
  };
}

export async function queryRelay(
  url: string,
  filters: Filter[],
  options: RelayOptions = {},
): Promise<RelayQueryReport> {
  const config = withDefaults(options);
  const started = Date.now();
  let relay: Relay | null = null;
  let subscription: Subscription | null = null;
  let eose = false;

  try {
    await ensureWebSocket();
    relay = new Relay(url, { enableReconnect: false, enablePing: false });
    await relay.connect({ timeout: config.connectionTimeoutMs });

    const events: KyveraEvent[] = [];
    const seen = new Set<string>();

    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      const timer = setTimeout(finish, config.queryTimeoutMs);
      subscription = relay!.subscribe(filters, {
        onevent: (event) => {
          if (seen.has(event.id)) return;
          seen.add(event.id);
          events.push(event as KyveraEvent);
        },
        oneose: () => {
          eose = true;
          clearTimeout(timer);
          finish();
        },
        onclose: () => {
          clearTimeout(timer);
          finish();
        },
      });
    });

    return { url, ok: true, eose, events, latencyMs: Date.now() - started };
  } catch (error) {
    return {
      url,
      ok: false,
      eose: false,
      events: [],
      error: error instanceof Error ? error.message : String(error),
      latencyMs: Date.now() - started,
    };
  } finally {
    // Send CLOSE while the socket is still open, then give the frame a moment
    // to leave. Closing the relay with an open subscription makes nostr-tools
    // send CLOSE as the socket closes, which browsers report as a console error.
    const closeSubscription = () => {
      if (subscription) subscription.close();
    };
    closeSubscription();
    if (subscription) await new Promise((resolve) => setTimeout(resolve, 15));
    relay?.close();
  }
}

export interface QueryAggregate {
  reports: RelayQueryReport[];
  events: KyveraEvent[];
}

/** Queries every relay independently so partial synchronization is visible. */
export async function queryRelays(
  urls: string[],
  filters: Filter[],
  options: RelayOptions = {},
): Promise<QueryAggregate> {
  const reports = await Promise.all(urls.map((url) => queryRelay(url, filters, options)));
  const byId = new Map<string, KyveraEvent>();
  for (const report of reports) {
    for (const event of report.events) {
      if (!byId.has(event.id)) byId.set(event.id, event);
    }
  }
  return { reports, events: [...byId.values()] };
}

export async function publishToRelay(
  url: string,
  event: KyveraEvent,
  options: RelayOptions = {},
): Promise<RelayPublishReport> {
  const config = withDefaults(options);
  const started = Date.now();
  let relay: Relay | null = null;
  try {
    await ensureWebSocket();
    relay = new Relay(url, { enableReconnect: false, enablePing: false });
    relay.publishTimeout = config.publishTimeoutMs;
    await relay.connect({ timeout: config.connectionTimeoutMs });
    // nostr-tools rejects on an OK=false response, so reaching here means the
    // relay accepted the event (possibly reporting it as a duplicate).
    const message = await relay.publish(event as never);
    return {
      url,
      ok: true,
      message: message || "accepted",
      latencyMs: Date.now() - started,
    };
  } catch (error) {
    return {
      url,
      ok: false,
      message: error instanceof Error ? error.message : String(error),
      latencyMs: Date.now() - started,
    };
  } finally {
    relay?.close();
  }
}

export async function publishToRelays(
  urls: string[],
  event: KyveraEvent,
  options: RelayOptions = {},
): Promise<RelayPublishReport[]> {
  return Promise.all(urls.map((url) => publishToRelay(url, event, options)));
}
