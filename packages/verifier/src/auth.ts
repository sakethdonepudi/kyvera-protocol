import type { ChainResolution, KyveraEvent } from "@kyvera/core";
import { canonicalize, sha256Hex, utf8Bytes } from "@kyvera/core";
import { freshEvent, type NostrSigner } from "@kyvera/nostr";
import { verifyEvent } from "nostr-tools/pure";

export const AUTH_KIND = 22242 as const;
export const AUTH_PROTOCOL = "kyvera-auth-v1" as const;
export const AUTH_REQUEST_PROTOCOL = "kyvera-auth-request-v1" as const;
export const APP_SESSION_PROTOCOL = "kyvera-app-session-v1" as const;

function randomHex(bytes = 32): string {
  const value = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(value);
  return [...value].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function isHex32(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

export interface AuthRequest {
  protocol: typeof AUTH_REQUEST_PROTOCOL;
  version: 1;
  /** 32-byte random, single-use challenge. */
  challenge: string;
  /** Exact relying-party origin, e.g. https://app.example. */
  origin: string;
  /** Hostname/domain context, typically the origin host. */
  domain: string;
  /** Random relying-party browser/session context. */
  sessionId: string;
  /** Identity the challenge was issued for (null only for a generic request). */
  expectedSubject: string | null;
  /** Payment address that must be current at authentication time, if pinned. */
  expectedAddress: string | null;
  issuedAt: number;
  expiresAt: number;
}

export function createAuthRequest(input: {
  origin: string;
  domain?: string;
  expectedSubject?: string | null;
  expectedAddress?: string | null;
  ttlSeconds?: number;
  now?: number;
}): AuthRequest {
  const now = input.now ?? Math.floor(Date.now() / 1000);
  const ttl = input.ttlSeconds ?? 120;
  let domain = input.domain;
  if (!domain) {
    try {
      domain = new URL(input.origin).host;
    } catch {
      domain = input.origin;
    }
  }
  if (input.expectedSubject && !isHex32(input.expectedSubject)) {
    throw new Error("expectedSubject must be a 32-byte lowercase hex key");
  }
  return {
    protocol: AUTH_REQUEST_PROTOCOL,
    version: 1,
    challenge: randomHex(32),
    origin: input.origin,
    domain,
    sessionId: randomHex(32),
    expectedSubject: input.expectedSubject ?? null,
    expectedAddress: input.expectedAddress?.toLowerCase() ?? null,
    issuedAt: now,
    expiresAt: now + ttl,
  };
}

export function authRequestDigest(request: AuthRequest): string {
  return sha256Hex(utf8Bytes(canonicalize(request)));
}

/**
 * Builds the relying-party authentication event. The event commits to the
 * whole request (origin, session, intended identity, expected address,
 * protocol and expiry) through the request digest.
 */
export async function buildAuthRequestEvent(input: {
  request: AuthRequest;
  signer: NostrSigner;
  createdAt?: number;
}): Promise<KyveraEvent> {
  const subject = await input.signer.getPublicKey();
  return input.signer.signEvent({
    kind: AUTH_KIND,
    created_at: input.createdAt ?? Math.floor(Date.now() / 1000),
    tags: [
      ["challenge", input.request.challenge],
      ["relay", input.request.origin],
      ["k", AUTH_REQUEST_PROTOCOL],
      ["request", authRequestDigest(input.request)],
      ["session", input.request.sessionId],
      ["s", subject],
    ],
    content: "",
  });
}

export interface VerifyAuthRequestOptions {
  event: KyveraEvent;
  request: AuthRequest;
  resolution: Pick<ChainResolution, "subject" | "status" | "activeBch" | "reason"> & {
    assurance?: "FULL" | "PARTIAL" | "UNSYNCED";
  };
  now?: number;
  maxClockSkewSeconds?: number;
  /** Relying-party values that must match the issued request. */
  expectedOrigin?: string;
  expectedSessionId?: string;
  expectedSubject?: string;
  expectedAddress?: string;
}

/**
 * Full relying-party verification: request binding, event signature, subject,
 * address, chain status and relay assurance.
 */
export function verifyAuthRequestEvent(options: VerifyAuthRequestOptions): AuthCheck {
  const now = options.now ?? Math.floor(Date.now() / 1000);
  const skew = options.maxClockSkewSeconds ?? 120;
  const { event, request, resolution } = options;

  if (request.protocol !== AUTH_REQUEST_PROTOCOL || request.version !== 1) {
    return { authenticated: false, code: "REQUEST_PROTOCOL", message: "unsupported authentication request" };
  }
  if (!isHex32(request.challenge) || !isHex32(request.sessionId)) {
    return { authenticated: false, code: "REQUEST_MALFORMED", message: "challenge or session id is malformed" };
  }
  if (!Number.isSafeInteger(request.issuedAt) || !Number.isSafeInteger(request.expiresAt) || request.expiresAt <= request.issuedAt) {
    return { authenticated: false, code: "REQUEST_WINDOW", message: "authentication request window is invalid" };
  }
  if (options.expectedOrigin && request.origin !== options.expectedOrigin) {
    return { authenticated: false, code: "ORIGIN_MISMATCH", message: "request origin is not this relying party" };
  }
  if (options.expectedSessionId && request.sessionId !== options.expectedSessionId) {
    return { authenticated: false, code: "SESSION_MISMATCH", message: "request session does not match this browser session" };
  }
  if (options.expectedSubject && request.expectedSubject !== options.expectedSubject) {
    return { authenticated: false, code: "INTENDED_SUBJECT_MISMATCH", message: "request was issued for a different identity" };
  }
  if (options.expectedAddress && request.expectedAddress !== options.expectedAddress.toLowerCase()) {
    return { authenticated: false, code: "INTENDED_ADDRESS_MISMATCH", message: "request was issued for a different address" };
  }

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

  const expectedDigest = authRequestDigest(request);
  if (one("challenge") !== request.challenge) {
    return { authenticated: false, code: "CHALLENGE_MISMATCH", message: "challenge tag does not match" };
  }
  if (one("relay") !== request.origin) {
    return { authenticated: false, code: "ORIGIN_MISMATCH", message: "relay/origin tag does not match" };
  }
  if (one("k") !== AUTH_REQUEST_PROTOCOL) {
    return { authenticated: false, code: "PROTOCOL_MISMATCH", message: "authentication protocol tag does not match" };
  }
  if (one("request") !== expectedDigest) {
    return { authenticated: false, code: "REQUEST_DIGEST_MISMATCH", message: "request digest does not match the signed context" };
  }
  if (one("session") !== request.sessionId) {
    return { authenticated: false, code: "SESSION_TAG_MISMATCH", message: "session tag does not match" };
  }
  if (one("s") !== fresh.pubkey) {
    return { authenticated: false, code: "SUBJECT_TAG_MISMATCH", message: "subject tag does not match the signer" };
  }
  if (!Number.isSafeInteger(fresh.created_at)) {
    return { authenticated: false, code: "TIMESTAMP_INVALID", message: "created_at must be an integer" };
  }
  if (fresh.created_at < request.issuedAt - skew || fresh.created_at > request.expiresAt) {
    return { authenticated: false, code: "TIMESTAMP_OUT_OF_WINDOW", message: "event is outside the request window" };
  }
  if (now > request.expiresAt + skew) {
    return { authenticated: false, code: "CHALLENGE_EXPIRED", message: "authentication request has expired" };
  }
  if (now < request.issuedAt - skew) {
    return { authenticated: false, code: "CHALLENGE_NOT_YET_VALID", message: "authentication request is not valid yet" };
  }
  if (fresh.pubkey !== resolution.subject) {
    return { authenticated: false, code: "SUBJECT_MISMATCH", message: "event was not signed by the resolved identity key" };
  }
  if (request.expectedSubject && request.expectedSubject !== resolution.subject) {
    return { authenticated: false, code: "INTENDED_SUBJECT_MISMATCH", message: "resolved identity is not the intended identity" };
  }
  if (resolution.status !== "ACTIVE") {
    return {
      authenticated: false,
      code: `IDENTITY_${resolution.status}`,
      message: `identity is not active: ${resolution.reason}`,
    };
  }
  if (resolution.assurance === "UNSYNCED") {
    return { authenticated: false, code: "IDENTITY_UNSYNCED", message: "identity state could not be refreshed from any relay" };
  }
  if (!resolution.activeBch) {
    return { authenticated: false, code: "NO_CURRENT_ADDRESS", message: "identity asserts no current BCH address" };
  }
  const pins = [request.expectedAddress, options.expectedAddress]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase());
  if (pins.some((pinned) => resolution.activeBch!.address !== pinned)) {
    return { authenticated: false, code: "ADDRESS_MISMATCH", message: "identity is not currently bound to the requested address" };
  }

  return {
    authenticated: true,
    code: "OK",
    message: "authenticated",
    subject: resolution.subject,
    bchAddress: resolution.activeBch.address,
  };
}

export interface AppSession {
  protocol: typeof APP_SESSION_PROTOCOL;
  token: string;
  subject: string;
  bchAddress: string;
  requestDigest: string;
  issuedAt: number;
  expiresAt: number;
}

export function issueAppSession(
  request: AuthRequest,
  resolution: Pick<ChainResolution, "subject" | "activeBch">,
  input: { ttlSeconds?: number; now?: number } = {},
): AppSession {
  if (!resolution.activeBch) throw new Error("cannot issue a session without a current BCH address");
  const now = input.now ?? Math.floor(Date.now() / 1000);
  return {
    protocol: APP_SESSION_PROTOCOL,
    token: randomHex(32),
    subject: resolution.subject,
    bchAddress: resolution.activeBch.address,
    requestDigest: authRequestDigest(request),
    issuedAt: now,
    expiresAt: now + (input.ttlSeconds ?? 900),
  };
}

export interface SessionCheck {
  valid: boolean;
  code: string;
  message: string;
}

export function validateAppSession(
  session: AppSession,
  resolution: Pick<ChainResolution, "subject" | "status" | "activeBch" | "reason"> & {
    assurance?: "FULL" | "PARTIAL" | "UNSYNCED";
  },
  now = Math.floor(Date.now() / 1000),
): SessionCheck {
  if (session.protocol !== APP_SESSION_PROTOCOL) {
    return { valid: false, code: "SESSION_PROTOCOL", message: "unsupported session format" };
  }
  if (now > session.expiresAt) {
    return { valid: false, code: "SESSION_EXPIRED", message: "application session has expired" };
  }
  if (resolution.subject !== session.subject) {
    return { valid: false, code: "SESSION_SUBJECT_CHANGED", message: "session identity no longer matches" };
  }
  if (resolution.status !== "ACTIVE") {
    return {
      valid: false,
      code: `SESSION_IDENTITY_${resolution.status}`,
      message: `identity is no longer active: ${resolution.reason}`,
    };
  }
  if (resolution.assurance === "UNSYNCED") {
    return { valid: false, code: "SESSION_UNSYNCED", message: "identity state could not be refreshed" };
  }
  if (!resolution.activeBch || resolution.activeBch.address !== session.bchAddress) {
    return { valid: false, code: "SESSION_ADDRESS_CHANGED", message: "authorized BCH address changed; sign in again" };
  }
  return { valid: true, code: "OK", message: "session is valid" };
}

/**
 * Temporary relying-party state: single-use requests and short-lived sessions.
 * This is deliberately in-memory; a production RP would persist it.
 */
export class AuthRequestService {
  readonly origin: string;
  readonly domain: string;
  readonly sessionId: string;
  private readonly ttlSeconds: number;
  private readonly sessionTtlSeconds: number;
  private readonly clock: () => number;
  private readonly pending = new Map<string, AuthRequest>();
  private readonly sessions = new Map<string, AppSession>();

  constructor(options: {
    origin: string;
    domain?: string;
    ttlSeconds?: number;
    sessionTtlSeconds?: number;
    now?: () => number;
    sessionId?: string;
  }) {
    this.origin = options.origin;
    this.domain = options.domain ?? (() => {
      try {
        return new URL(options.origin).host;
      } catch {
        return options.origin;
      }
    })();
    this.sessionId = options.sessionId ?? randomHex(32);
    this.ttlSeconds = options.ttlSeconds ?? 120;
    this.sessionTtlSeconds = options.sessionTtlSeconds ?? 900;
    this.clock = options.now ?? (() => Math.floor(Date.now() / 1000));
  }

  issue(input: { expectedSubject?: string | null; expectedAddress?: string | null } = {}): AuthRequest {
    this.prune();
    const request = createAuthRequest({
      origin: this.origin,
      domain: this.domain,
      expectedSubject: input.expectedSubject ?? null,
      expectedAddress: input.expectedAddress ?? null,
      ttlSeconds: this.ttlSeconds,
      now: this.clock(),
    });
    request.sessionId = this.sessionId;
    this.pending.set(request.challenge, request);
    return request;
  }

  verify(
    event: KyveraEvent,
    resolution: VerifyAuthRequestOptions["resolution"],
  ): { check: AuthCheck; session?: AppSession } {
    let challenge: string | undefined;
    try {
      const tags = freshEvent(event).tags.filter((tag) => tag[0] === "challenge");
      challenge = tags.length === 1 ? tags[0]![1] : undefined;
    } catch {
      return { check: { authenticated: false, code: "EVENT_MALFORMED", message: "malformed authentication event" } };
    }
    const request = challenge ? this.pending.get(challenge) : undefined;
    if (!request) {
      return { check: { authenticated: false, code: "UNKNOWN_CHALLENGE", message: "request was not issued or was already used" } };
    }
    if (this.clock() > request.expiresAt) {
      this.pending.delete(request.challenge);
      return { check: { authenticated: false, code: "CHALLENGE_EXPIRED", message: "authentication request has expired" } };
    }
    const check = verifyAuthRequestEvent({
      event,
      request,
      resolution,
      now: this.clock(),
      expectedOrigin: this.origin,
      expectedSessionId: this.sessionId,
    });
    if (!check.authenticated) return { check };
    this.pending.delete(request.challenge);
    const session = issueAppSession(request, resolution, {
      ttlSeconds: this.sessionTtlSeconds,
      now: this.clock(),
    });
    this.sessions.set(session.token, session);
    return { check, session };
  }

  validate(token: string, resolution: VerifyAuthRequestOptions["resolution"]): SessionCheck {
    const session = this.sessions.get(token);
    if (!session) return { valid: false, code: "SESSION_UNKNOWN", message: "application session was logged out or never issued" };
    return validateAppSession(session, resolution, this.clock());
  }

  logout(token: string): boolean {
    return this.sessions.delete(token);
  }

  getSession(token: string): AppSession | undefined {
    return this.sessions.get(token);
  }

  prune(): void {
    const now = this.clock();
    for (const [key, request] of this.pending) {
      if (now > request.expiresAt) this.pending.delete(key);
    }
    for (const [key, session] of this.sessions) {
      if (now > session.expiresAt) this.sessions.delete(key);
    }
  }
}


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
