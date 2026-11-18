import {
  NOSTR_KIND,
  NOSTR_K_TAG,
  findAddressInChain,
  type BchNetwork,
  type ChainResolution,
  type IdentityStatus,
  type KyveraEvent,
} from "@kyvera/core";
import {
  addressFilter,
  queryRelays,
  subjectFilter,
  type RelayQueryReport,
} from "@kyvera/nostr";
import { decodeP2pkhAddress } from "@kyvera/bch";
import { resolveEvents, type VerifyOptions } from "./record.js";

export type Assurance = "FULL" | "PARTIAL" | "UNSYNCED";

export interface RelayStatus {
  url: string;
  ok: boolean;
  eose: boolean;
  events: number;
  error?: string;
  latencyMs: number;
}

export interface SyncSummary {
  relays: RelayStatus[];
  /** Relays that completed a request (with or without EOSE). */
  responded: number;
  total: number;
  assurance: Assurance;
}

export interface IdentityResolution extends ChainResolution {
  assurance: Assurance;
  sync: SyncSummary;
  /** event id → relays (or "local cache") that supplied the record. */
  sources: Record<string, string[]>;
}

export function summarizeRelays(reports: RelayQueryReport[]): SyncSummary {
  const relays: RelayStatus[] = reports.map((report) => ({
    url: report.url,
    ok: report.ok,
    eose: report.eose,
    events: report.events.length,
    error: report.error,
    latencyMs: report.latencyMs,
  }));
  const responded = relays.filter((relay) => relay.ok).length;
  const allComplete = relays.length > 0 && relays.every((relay) => relay.ok && relay.eose);
  const assurance: Assurance = responded === 0 ? "UNSYNCED" : allComplete ? "FULL" : "PARTIAL";
  return { relays, responded, total: relays.length, assurance };
}

export interface ResolveIdentityOptions {
  subject: string;
  relays: string[];
  now?: number;
  network?: BchNetwork;
  maxClockSkewSeconds?: number;
  connectionTimeoutMs?: number;
  queryTimeoutMs?: number;
  /**
   * Last state this caller previously verified. Detects a relay set that is
   * withholding newer history (rollback). Without a checkpoint, no off-chain
   * protocol can distinguish a stale relay from a genuinely quiet identity.
   */
  checkpoint?: { sequence: number; recordId: string };
  /**
   * Locally cached events (e.g. from this browser's own publishing). They are
   * merged with relay results so a transient relay outage does not hide history;
   * assurance still reflects relay reachability.
   */
  additionalEvents?: KyveraEvent[];
}

/**
 * Discovers and resolves an identity from multiple independent relays.
 *
 * Failure to reach every relay is surfaced as PARTIAL assurance. Failure to
 * reach any relay is surfaced as STALE — never as ACTIVE — because a verifier
 * that cannot refresh state cannot claim the head it has is current.
 */
export async function resolveIdentity(options: ResolveIdentityOptions): Promise<IdentityResolution> {
  const now = options.now ?? Math.floor(Date.now() / 1000);
  const verifyOptions: VerifyOptions = {
    now,
    network: options.network,
    maxClockSkewSeconds: options.maxClockSkewSeconds,
  };

  if (!/^[0-9a-f]{64}$/.test(options.subject)) {
    throw new Error("subject must be a 32-byte lowercase hex Nostr public key");
  }
  if (options.relays.length === 0) {
    return offlineResolution(options.subject, now, "NO_RELAYS_CONFIGURED");
  }

  const aggregate = await queryRelays(options.relays, [subjectFilter(options.subject)], {
    connectionTimeoutMs: options.connectionTimeoutMs,
    queryTimeoutMs: options.queryTimeoutMs,
  });
  const sync = summarizeRelays(aggregate.reports);
  const merged = new Map<string, KyveraEvent>();
  const sources: Record<string, string[]> = {};
  for (const event of aggregate.events) merged.set(event.id, event);
  for (const event of options.additionalEvents ?? []) {
    if (!merged.has(event.id) && event.pubkey === options.subject) merged.set(event.id, event);
  }
  for (const [eventId, relays] of Object.entries(aggregate.sources)) sources[eventId] = [...relays];
  for (const event of options.additionalEvents ?? []) {
    if (event.pubkey !== options.subject) continue;
    const list = sources[event.id] ?? (sources[event.id] = []);
    if (!list.includes("local cache")) list.push("local cache");
  }
  const { resolution } = resolveEvents([...merged.values()], {
    ...verifyOptions,
    subject: options.subject,
  });
  return applyCheckpointToResolution(attachSync(resolution, sync, sources), options.checkpoint);
}

export interface AddressBinding {
  subject: string;
  currentAddress: string | null;
  status: IdentityStatus;
  reasonCode: string;
  reason: string;
  resolution: IdentityResolution;
}

export interface AddressResolution {
  address: string;
  status: IdentityStatus;
  reason: string;
  assurance: Assurance;
  sync: SyncSummary;
  bindings: AddressBinding[];
}

const STATUS_PRIORITY: IdentityStatus[] = [
  "ACTIVE",
  "EXPIRED",
  "REVOKED",
  "SUPERSEDED",
  "STALE",
  "CONFLICT",
  "INVALID",
  "UNKNOWN",
];

export interface ResolveAddressOptions {
  address: string;
  relays: string[];
  now?: number;
  network?: BchNetwork;
  maxClockSkewSeconds?: number;
  connectionTimeoutMs?: number;
  queryTimeoutMs?: number;
}

/**
 * Resolves whether a BCH address is currently authorized by any KYVERA identity.
 *
 * One address may legitimately be bound to several Nostr identities, so the
 * result lists every binding. An address appearing in a historical binding is
 * SUPERSEDED, never ACTIVE.
 */
export async function resolveAddress(options: ResolveAddressOptions): Promise<AddressResolution> {
  const now = options.now ?? Math.floor(Date.now() / 1000);
  const address = options.address.trim().toLowerCase();
  const decoded = decodeP2pkhAddress(address);
  if (typeof decoded === "string") {
    return {
      address,
      status: "INVALID",
      reason: `not a valid P2PKH CashAddr: ${decoded}`,
      assurance: "UNSYNCED",
      sync: { relays: [], responded: 0, total: 0, assurance: "UNSYNCED" },
      bindings: [],
    };
  }
  if (options.network && decoded.network !== options.network) {
    return {
      address,
      status: "INVALID",
      reason: `address is on ${decoded.network}, but this verifier expects ${options.network}`,
      assurance: "UNSYNCED",
      sync: { relays: [], responded: 0, total: 0, assurance: "UNSYNCED" },
      bindings: [],
    };
  }

  if (options.relays.length === 0) {
    const offline = offlineResolution("", now, "NO_RELAYS_CONFIGURED");
    return {
      address,
      status: "STALE",
      reason: "No relays configured; address state cannot be established.",
      assurance: "UNSYNCED",
      sync: offline.sync,
      bindings: [],
    };
  }

  const first = await queryRelays(options.relays, [addressFilter(address)], {
    connectionTimeoutMs: options.connectionTimeoutMs,
    queryTimeoutMs: options.queryTimeoutMs,
  });
  const firstSync = summarizeRelays(first.reports);
  const subjects = [...new Set(first.events.map((event) => event.pubkey).filter((pubkey) => /^[0-9a-f]{64}$/.test(pubkey)))];

  if (subjects.length === 0) {
    return {
      address,
      status: firstSync.responded === 0 ? "STALE" : "UNKNOWN",
      reason:
        firstSync.responded === 0
          ? "No relay responded; address state cannot be established."
          : "No KYVERA binding references this address.",
      assurance: firstSync.assurance,
      sync: firstSync,
      bindings: [],
    };
  }

  const full = await queryRelays(
    options.relays,
    [{ kinds: [NOSTR_KIND], authors: subjects, "#k": [NOSTR_K_TAG] }],
    { connectionTimeoutMs: options.connectionTimeoutMs, queryTimeoutMs: options.queryTimeoutMs },
  );
  const sync = summarizeRelays(full.reports);

  const bindings: AddressBinding[] = [];
  for (const subject of subjects) {
    const events = full.events.filter((event: KyveraEvent) => event.pubkey === subject);
    const { resolution } = resolveEvents(events, {
      now,
      network: options.network,
      maxClockSkewSeconds: options.maxClockSkewSeconds,
      subject,
    });
    const withSync = attachSync(resolution, sync, full.sources);
    const step = findAddressInChain(resolution, address);
    const status = addressStatus(resolution, address, step !== null);
    bindings.push({
      subject,
      currentAddress: resolution.activeBch?.address ?? null,
      status,
      reasonCode: resolution.reasonCode,
      reason: resolution.reason,
      resolution: withSync,
    });
  }

  const status = bindings
    .map((binding) => binding.status)
    .sort((a, b) => STATUS_PRIORITY.indexOf(a) - STATUS_PRIORITY.indexOf(b))[0] ?? "UNKNOWN";

  return {
    address,
    status,
    reason: reasonForAddressStatus(status),
    assurance: sync.assurance,
    sync,
    bindings,
  };
}

function addressStatus(
  resolution: ChainResolution,
  address: string,
  inHistory: boolean,
): IdentityStatus {
  if (!inHistory) return resolution.status === "UNKNOWN" ? "UNKNOWN" : "INVALID";
  if (resolution.status === "CONFLICT" || resolution.status === "STALE" || resolution.status === "INVALID") {
    return resolution.status;
  }
  if (resolution.status === "REVOKED") {
    // An address can appear more than once (A → B → A). Use the latest
    // supersession entry; otherwise an earlier historical occurrence could
    // mask the fact that the currently revoked address was revoked.
    const entry = [...resolution.superseded]
      .reverse()
      .find((candidate) => candidate.address.toLowerCase() === address.toLowerCase());
    if (entry && entry.replacedBy !== "revoked") return "SUPERSEDED";
    return "REVOKED";
  }
  const current = resolution.activeBch?.address;
  if (current === address) {
    return resolution.status === "EXPIRED" ? "EXPIRED" : "ACTIVE";
  }
  if (resolution.status === "EXPIRED") return "EXPIRED";
  return "SUPERSEDED";
}

function reasonForAddressStatus(status: IdentityStatus): string {
  switch (status) {
    case "ACTIVE":
      return "The address is the currently authorized payment identity of at least one verified binding.";
    case "SUPERSEDED":
      return "The address was authorized historically but has been rotated away from.";
    case "REVOKED":
      return "The address belongs to a binding that was explicitly revoked.";
    case "EXPIRED":
      return "The address belongs to a binding whose authorization expired.";
    case "CONFLICT":
      return "The identity published conflicting authorizations; the address cannot be trusted.";
    case "STALE":
      return "Only part of the authorization history could be retrieved; the address cannot be trusted.";
    case "INVALID":
      return "Records referencing this address are cryptographically invalid.";
    default:
      return "No current authorization could be established for this address.";
  }
}

function attachSync(
  resolution: ChainResolution,
  sync: SyncSummary,
  sources: Record<string, string[]> = {},
): IdentityResolution {
  const withSync: IdentityResolution = { ...resolution, assurance: sync.assurance, sync, sources };
  if (sync.assurance === "UNSYNCED") {
    withSync.status = "STALE";
    withSync.reasonCode = "RELAYS_UNREACHABLE";
    withSync.reason = "No relay responded; the verifier cannot establish current state.";
    withSync.activeBch = null;
  }
  return withSync;
}

export function applyCheckpointToResolution(
  resolution: IdentityResolution,
  checkpoint: { sequence: number; recordId: string } | undefined,
): IdentityResolution {
  if (!checkpoint) return resolution;
  if (resolution.reasonCode === "RELAYS_UNREACHABLE") return resolution;

  const step = resolution.history.find(
    (entry) => entry.record.payload.sequence === checkpoint.sequence,
  );
  const headSequence = resolution.head?.record.payload.sequence ?? -1;

  if (!step && headSequence < checkpoint.sequence) {
    return {
      ...resolution,
      status: "STALE",
      reasonCode: "ROLLBACK_DETECTED",
      reason: `Previously verified sequence ${checkpoint.sequence} is missing; relays may be withholding newer history.`,
      activeBch: null,
    };
  }
  if (step && step.recordId !== checkpoint.recordId) {
    return {
      ...resolution,
      status: "CONFLICT",
      reasonCode: "CHECKPOINT_MISMATCH",
      reason: `Sequence ${checkpoint.sequence} no longer matches the previously verified record.`,
      activeBch: null,
      conflict: {
        sequence: checkpoint.sequence,
        recordIds: [checkpoint.recordId, step.recordId].sort(),
      },
    };
  }
  return resolution;
}

function offlineResolution(subject: string, now: number, reasonCode: string): IdentityResolution {
  return {
    status: "STALE",
    reasonCode,
    reason:
      reasonCode === "NO_RELAYS_CONFIGURED"
        ? "No relays were configured; current state cannot be established."
        : "State cannot be established.",
    subject,
    head: null,
    activeBch: null,
    history: [],
    superseded: [],
    conflict: null,
    rejected: [],
    checkedAt: now,
    headIssuedAt: null,
    assurance: "UNSYNCED",
    sync: { relays: [], responded: 0, total: 0, assurance: "UNSYNCED" },
    sources: {},
  };
}
