import type { BchNetwork, KyveraEvent } from "@kyvera/core";
import { normalizeNostrPublicKey, toNpub } from "@kyvera/nostr";
import {
  resolveAddress as resolveAddressInternal,
  resolveIdentity as resolveIdentityInternal,
  verifyEventRecord as verifyEventRecordInternal,
  type AddressResolution,
  type IdentityResolution,
  type ResolveAddressOptions,
  type ResolveIdentityOptions,
  type VerifyEventResult,
} from "@kyvera/verifier";
import { KyveraSdkError } from "./errors.js";
import { toVerificationResult, type KyveraVerificationResult } from "./result.js";

export interface KyveraClientOptions {
  /** Relays queried independently. An empty list returns an offline/UNSYNCED result. */
  relays: string[];
  network?: BchNetwork;
  /** Unix seconds. Defaults to the current time. */
  now?: number | (() => number);
  connectionTimeoutMs?: number;
  queryTimeoutMs?: number;
  /** Last verified state, used to detect rollback/withholding by the relay set. */
  checkpoint?: { sequence: number; recordId: string };
  /** Locally cached events merged with relay results. */
  additionalEvents?: KyveraEvent[];
}

export interface ResolveOptions {
  relays?: string[];
  network?: BchNetwork;
  now?: number;
  connectionTimeoutMs?: number;
  queryTimeoutMs?: number;
  checkpoint?: { sequence: number; recordId: string };
  additionalEvents?: KyveraEvent[];
}

export interface VerifyOptions extends ResolveOptions {
  /** Include verified events in the returned evidence object. Defaults to true. */
  includeEvents?: boolean;
}

export interface AddressOptions {
  relays?: string[];
  network?: BchNetwork;
  now?: number;
  connectionTimeoutMs?: number;
  queryTimeoutMs?: number;
}

function clockValue(clock: number | (() => number) | undefined): number {
  if (typeof clock === "function") return clock();
  if (typeof clock === "number") return clock;
  return Math.floor(Date.now() / 1000);
}

/**
 * Stable developer-facing façade over the KYVERA verifier. It has no hosted
 * KYVERA dependency, no telemetry and no embedded secrets.
 */
export class KyveraClient {
  readonly relays: string[];
  private readonly options: KyveraClientOptions;

  constructor(options: KyveraClientOptions) {
    if (!Array.isArray(options.relays)) {
      throw new KyveraSdkError("INVALID_OPTIONS", "relays must be an array of wss:// URLs");
    }
    this.options = { ...options, relays: [...options.relays] };
    this.relays = options.relays;
  }

  /** Resolve an npub/hex subject through the configured relay set. */
  async resolve(input: string, options: ResolveOptions = {}): Promise<IdentityResolution> {
    const subject = normalizeNostrPublicKey(input);
    if (!subject) {
      throw new KyveraSdkError("INVALID_SUBJECT", "expected an npub, nprofile or 32-byte hex public key");
    }
    try {
      return await resolveIdentityInternal({
        subject,
        relays: options.relays ?? this.options.relays,
        network: options.network ?? this.options.network,
        now: options.now ?? clockValue(this.options.now),
        connectionTimeoutMs: options.connectionTimeoutMs ?? this.options.connectionTimeoutMs,
        queryTimeoutMs: options.queryTimeoutMs ?? this.options.queryTimeoutMs,
        checkpoint: options.checkpoint ?? this.options.checkpoint,
        additionalEvents: options.additionalEvents ?? this.options.additionalEvents,
      });
    } catch (cause) {
      throw new KyveraSdkError(
        "RESOLUTION_FAILED",
        cause instanceof Error ? cause.message : String(cause),
        cause,
      );
    }
  }

  /**
   * Resolve and return the structured authorization/evidence result. The
   * caller receives separate cryptographic, historical, current-authorization
   * and evidence-completeness fields rather than a single boolean.
   */
  async verify(input: string, options: VerifyOptions = {}): Promise<KyveraVerificationResult> {
    const resolution = await this.resolve(input, options);
    const result = toVerificationResult(resolution, toNpub(resolution.subject));
    if (options.includeEvents === false) {
      return {
        ...result,
        resolution: {
          ...resolution,
          history: resolution.history.map((step) => ({ ...step, event: undefined })),
        },
      };
    }
    return result;
  }

  /** Resolve whether a BCH address is current, superseded, revoked or unknown. */
  async resolveAddress(address: string, options: AddressOptions = {}): Promise<AddressResolution> {
    const trimmed = address.trim();
    if (!trimmed) throw new KyveraSdkError("ADDRESS_INVALID", "address is required");
    return resolveAddressInternal({
      address: trimmed,
      relays: options.relays ?? this.options.relays,
      network: options.network ?? this.options.network,
      now: options.now ?? clockValue(this.options.now),
      connectionTimeoutMs: options.connectionTimeoutMs ?? this.options.connectionTimeoutMs,
      queryTimeoutMs: options.queryTimeoutMs ?? this.options.queryTimeoutMs,
    } satisfies ResolveAddressOptions);
  }

  /** Verify one signed Nostr event/record without resolving a chain. */
  verifyRecord(event: KyveraEvent, options: { now?: number; network?: BchNetwork } = {}): VerifyEventResult {
    return verifyEventRecordInternal(event, {
      now: options.now ?? clockValue(this.options.now),
      network: options.network ?? this.options.network,
    });
  }

  /**
   * Export the resolution evidence as a JSON-safe object. Private keys are
   * never part of a resolution, a record or an event.
   */
  exportEvidence(result: KyveraVerificationResult): string {
    return JSON.stringify(
      {
        protocol: "kyvera-evidence",
        version: 1,
        generatedAt: clockValue(this.options.now),
        result: {
          ...result,
          resolution: {
            ...result.resolution,
            history: result.resolution.history.map((step) => ({
              recordId: step.recordId,
              payloadDigest: step.payloadDigest,
              eventId: step.eventId,
              record: step.record,
              event: step.event,
            })),
          },
        },
      },
      null,
      2,
    );
  }
}
