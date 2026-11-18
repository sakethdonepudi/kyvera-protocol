import type { ChainResolution, KyveraEvent } from "@kyvera/core";
import { freshEvent, type NostrSigner } from "@kyvera/nostr";
import { verifyEvent } from "nostr-tools/pure";

export const AUTH_KIND = 22242 as const;
export const AUTH_PROTOCOL = "kyvera-auth-v1" as const;

export interface AuthChallenge {
  protocol: typeof AUTH_PROTOCOL;
  /** 32-byte random hex. */
  challenge: string;
  /** The relying application's domain or origin (NIP-42 `relay` tag value). */
  domain: string;
  issuedAt: number;
  expiresAt: number;
}

export function createAuthChallenge(input: {
  domain: string;
  ttlSeconds?: number;
  now?: number;
}): AuthChallenge {
  const now = input.now ?? Math.floor(Date.now() / 1000);
  const ttl = input.ttlSeconds ?? 300;
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return {
    protocol: AUTH_PROTOCOL,
    challenge: [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join(""),
    domain: input.domain,
    issuedAt: now,
    expiresAt: now + ttl,
  };
}

/** Human-readable summary of what the challenge authorizes. */
export function authChallengeText(challenge: AuthChallenge): string {
  return [
    `KYVERA authentication challenge (${AUTH_PROTOCOL})`,
    `domain: ${challenge.domain}`,
    `challenge: ${challenge.challenge}`,
    `issued: ${challenge.issuedAt}`,
    `expires: ${challenge.expiresAt}`,
  ].join("\n");
}

/**
 * Builds a NIP-42-shaped client authentication event (kind 22242) signed by the
 * identity's Nostr key. `relay` carries the relying domain, as NIP-42 does.
 */
export async function buildAuthEvent(input: {
  challenge: AuthChallenge;
  signer: NostrSigner;
  createdAt?: number;
}): Promise<KyveraEvent> {
  const event = await input.signer.signEvent({
    kind: AUTH_KIND,
    created_at: input.createdAt ?? Math.floor(Date.now() / 1000),
    tags: [
      ["challenge", input.challenge.challenge],
      ["relay", input.challenge.domain],
      ["k", AUTH_PROTOCOL],
    ],
    content: "",
  });
  return event;
}

export interface AuthCheck {
  authenticated: boolean;
  code: string;
  message: string;
  subject?: string;
  bchAddress?: string;
}

export interface VerifyAuthOptions {
  event: KyveraEvent;
  challenge: AuthChallenge;
  resolution: Pick<ChainResolution, "subject" | "status" | "activeBch" | "reason"> & {
    assurance?: "FULL" | "PARTIAL" | "UNSYNCED";
  };
  now?: number;
  maxClockSkewSeconds?: number;
  /** When set, the current BCH identity must equal this address. */
  expectedAddress?: string;
}

/**
 * Verifies a challenge-response login without any KYVERA server.
 *
 * The caller must ensure the challenge is unique and unused; use
 * `ChallengeService` for an in-memory implementation.
 */
export function verifyAuthEvent(options: VerifyAuthOptions): AuthCheck {
  const now = options.now ?? Math.floor(Date.now() / 1000);
  const skew = options.maxClockSkewSeconds ?? 120;
  const { event, challenge, resolution } = options;

  let fresh: KyveraEvent;
  try {
    fresh = freshEvent(event);
  } catch {
    return { authenticated: false, code: "EVENT_MALFORMED", message: "malformed authentication event" };
  }

  let signatureValid = false;
  try {
    signatureValid = verifyEvent(fresh as never);
  } catch {
    signatureValid = false;
  }
  if (!signatureValid) {
    return { authenticated: false, code: "EVENT_SIGNATURE", message: "authentication event signature is invalid" };
  }

  if (fresh.kind !== AUTH_KIND) {
    return { authenticated: false, code: "WRONG_KIND", message: `expected kind ${AUTH_KIND}` };
  }
  if (fresh.content !== "") {
    return { authenticated: false, code: "NON_EMPTY_CONTENT", message: "authentication event content must be empty" };
  }

  const one = (name: string) => {
    const matches = fresh.tags.filter((tag) => tag[0] === name);
    return matches.length === 1 ? matches[0]![1] : undefined;
  };

  if (one("challenge") !== challenge.challenge) {
    return { authenticated: false, code: "CHALLENGE_MISMATCH", message: "challenge tag does not match" };
  }
  if (one("relay") !== challenge.domain) {
    return { authenticated: false, code: "DOMAIN_MISMATCH", message: "relay/domain tag does not match" };
  }
  if (one("k") !== AUTH_PROTOCOL) {
    return { authenticated: false, code: "PROTOCOL_MISMATCH", message: "authentication protocol tag does not match" };
  }
  if (!Number.isSafeInteger(fresh.created_at)) {
    return { authenticated: false, code: "TIMESTAMP_INVALID", message: "created_at must be an integer" };
  }
  if (fresh.created_at < challenge.issuedAt - skew || fresh.created_at > challenge.expiresAt) {
    return { authenticated: false, code: "TIMESTAMP_OUT_OF_WINDOW", message: "event is outside the challenge window" };
  }
  if (now > challenge.expiresAt + skew) {
    return { authenticated: false, code: "CHALLENGE_EXPIRED", message: "challenge has expired" };
  }
  if (now < challenge.issuedAt - skew) {
    return {
      authenticated: false,
      code: "CHALLENGE_NOT_YET_VALID",
      message: "challenge is not valid yet; check the verifier clock",
    };
  }
  if (fresh.pubkey !== resolution.subject) {
    return {
      authenticated: false,
      code: "SUBJECT_MISMATCH",
      message: "authentication event was not signed by the resolved identity key",
    };
  }
  if (resolution.status !== "ACTIVE") {
    return {
      authenticated: false,
      code: `IDENTITY_${resolution.status}`,
      message: `identity is not active: ${resolution.reason}`,
    };
  }
  if (resolution.assurance === "UNSYNCED") {
    return {
      authenticated: false,
      code: "IDENTITY_UNSYNCED",
      message: "identity state could not be refreshed from any relay",
    };
  }
  if (options.expectedAddress && resolution.activeBch?.address !== options.expectedAddress.toLowerCase()) {
    return {
      authenticated: false,
      code: "ADDRESS_MISMATCH",
      message: "identity is not currently bound to the requested BCH address",
    };
  }

  return {
    authenticated: true,
    code: "OK",
    message: "authenticated",
    subject: resolution.subject,
    bchAddress: resolution.activeBch?.address,
  };
}

/**
 * Single-use challenge registry for a relying application. In-memory only:
 * production apps should persist used challenges for the TTL window.
 */
export class ChallengeService {
  private readonly pending = new Map<string, AuthChallenge>();
  private readonly domain: string;
  private readonly ttlSeconds: number;
  private readonly clock: () => number;

  constructor(options: { domain: string; ttlSeconds?: number; now?: () => number }) {
    this.domain = options.domain;
    this.ttlSeconds = options.ttlSeconds ?? 300;
    this.clock = options.now ?? (() => Math.floor(Date.now() / 1000));
  }

  issue(): AuthChallenge {
    this.prune();
    const challenge = createAuthChallenge({
      domain: this.domain,
      ttlSeconds: this.ttlSeconds,
      now: this.clock(),
    });
    this.pending.set(challenge.challenge, challenge);
    return challenge;
  }

  verify(
    event: KyveraEvent,
    resolution: Parameters<typeof verifyAuthEvent>[0]["resolution"],
    expectedAddress?: string,
  ): AuthCheck {
    let value: string | undefined;
    try {
      value = freshEvent(event).tags.find((tag) => tag[0] === "challenge")?.[1];
    } catch {
      return { authenticated: false, code: "EVENT_MALFORMED", message: "malformed authentication event" };
    }
    const challenge = value ? this.pending.get(value) : undefined;
    if (!challenge) {
      return { authenticated: false, code: "UNKNOWN_CHALLENGE", message: "challenge was not issued or was already used" };
    }
    const result = verifyAuthEvent({
      event,
      challenge,
      resolution,
      now: this.clock(),
      expectedAddress,
    });
    if (result.authenticated) this.pending.delete(challenge.challenge);
    return result;
  }

  prune(): void {
    const now = this.clock();
    for (const [key, challenge] of this.pending) {
      if (now > challenge.expiresAt) this.pending.delete(key);
    }
  }
}
