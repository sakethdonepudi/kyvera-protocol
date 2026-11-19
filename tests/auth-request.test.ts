import { beforeEach, describe, expect, it } from "vitest";
import {
  AuthRequestService,
  authRequestDigest,
  buildAuthRequestEvent,
  createAuthRequest,
  validateAppSession,
  verifyAuthRequestEvent,
} from "@kyvera/verifier";
import { resolveEvents } from "@kyvera/verifier";
import { T0, makeIdentity, revoke, rotate, strangerSigner, type TestIdentity } from "./helpers.js";

const T = T0 + 3_600;
const ORIGIN = "https://sawa.example";

function resolutionFor(identity: TestIdentity, extra: Parameters<typeof resolveEvents>[0] = [identity.bind.event]) {
  return resolveEvents(extra, { now: T + 5 }).resolution;
}

function service(now = () => T) {
  return new AuthRequestService({
    origin: ORIGIN,
    domain: "sawa.example",
    ttlSeconds: 120,
    sessionTtlSeconds: 900,
    now,
    sessionId: "ab".repeat(32),
  });
}

async function login(identity: TestIdentity, expectedAddress?: string) {
  const rp = service();
  const resolution = resolutionFor(identity);
  const request = rp.issue({
    expectedSubject: identity.subject,
    expectedAddress: expectedAddress ?? identity.bchA.identity.address,
  });
  const event = await buildAuthRequestEvent({ request, signer: identity.signer, createdAt: T });
  return { rp, resolution, request, event, result: rp.verify(event, resolution) };
}

describe("relying-party authentication request", () => {
  let identity: TestIdentity;

  beforeEach(async () => {
    identity = await makeIdentity("auth-rp", T0);
  });

  it("creates a random, short-lived, origin/session/identity-bound request", () => {
    const rp = service();
    const request = rp.issue({ expectedSubject: identity.subject, expectedAddress: identity.bchA.identity.address });
    expect(request.protocol).toBe("kyvera-auth-request-v1");
    expect(request.challenge).toMatch(/^[0-9a-f]{64}$/);
    expect(request.sessionId).toBe("ab".repeat(32));
    expect(request.origin).toBe(ORIGIN);
    expect(request.domain).toBe("sawa.example");
    expect(request.expectedSubject).toBe(identity.subject);
    expect(request.expectedAddress).toBe(identity.bchA.identity.address);
    expect(request.expiresAt - request.issuedAt).toBe(120);
    expect(authRequestDigest(request)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("authenticates a valid challenge and issues a short-lived session", async () => {
    const { result, request } = await login(identity);
    expect(result.check.authenticated).toBe(true);
    expect(result.session).toMatchObject({
      protocol: "kyvera-app-session-v1",
      subject: identity.subject,
      bchAddress: identity.bchA.identity.address,
      requestDigest: authRequestDigest(request),
    });
    expect(result.session!.token).toMatch(/^[0-9a-f]{64}$/);
    expect(result.session!.expiresAt - result.session!.issuedAt).toBe(900);
  });

  it("rejects replay of a consumed challenge", async () => {
    const { rp, resolution, event } = await login(identity);
    expect(rp.verify(event, resolution)).toMatchObject({
      check: { authenticated: false, code: "UNKNOWN_CHALLENGE" },
    });
  });

  it("rejects an expired request", () => {
    let now = T;
    const rp = new AuthRequestService({ origin: ORIGIN, ttlSeconds: 60, now: () => now, sessionId: "cd".repeat(32) });
    const request = rp.issue({ expectedSubject: identity.subject });
    const resolution = resolutionFor(identity);
    now = T + 61;
    return buildAuthRequestEvent({ request, signer: identity.signer, createdAt: T }).then((event) => {
      expect(rp.verify(event, resolution)).toMatchObject({
        check: { authenticated: false, code: "CHALLENGE_EXPIRED" },
      });
    });
  });

  it("requires FULL relay agreement for authentication and session validation", async () => {
    const identity = await makeIdentity("auth-partial");
    const base = resolutionFor(identity);
    const partial = {
      ...base,
      assurance: "PARTIAL",
      sync: { ...base.sync, assurance: "PARTIAL" },
    } as never;
    const rp = service();
    const request = rp.issue({ expectedSubject: identity.subject });
    const event = await buildAuthRequestEvent({ request, signer: identity.signer, createdAt: T });
    expect(rp.verify(event, partial).check).toMatchObject({
      authenticated: false,
      code: "IDENTITY_PARTIAL",
    });

    const full = await login(identity);
    expect(validateAppSession(full.result.session!, partial, T)).toMatchObject({
      valid: false,
      code: "SESSION_PARTIAL",
    });
  });

  it("rejects a different origin or session context", async () => {
    const rp = service();
    const request = rp.issue({ expectedSubject: identity.subject });
    const event = await buildAuthRequestEvent({ request, signer: identity.signer, createdAt: T });
    const resolution = resolutionFor(identity);

    expect(
      verifyAuthRequestEvent({
        event,
        request,
        resolution,
        now: T,
        expectedOrigin: "https://evil.example",
      }),
    ).toMatchObject({ authenticated: false, code: "ORIGIN_MISMATCH" });

    expect(
      verifyAuthRequestEvent({
        event,
        request,
        resolution,
        now: T,
        expectedSessionId: "ff".repeat(32),
      }),
    ).toMatchObject({ authenticated: false, code: "SESSION_MISMATCH" });
  });

  it("rejects an event intended for another identity or address", async () => {
    const rp = service();
    const request = rp.issue({ expectedSubject: "f".repeat(64), expectedAddress: identity.bchB.identity.address });
    const event = await buildAuthRequestEvent({ request, signer: identity.signer, createdAt: T });
    const resolution = resolutionFor(identity);
    expect(verifyAuthRequestEvent({ event, request, resolution, now: T })).toMatchObject({
      authenticated: false,
      code: "INTENDED_SUBJECT_MISMATCH",
    });

    const request2 = rp.issue({ expectedSubject: identity.subject, expectedAddress: identity.bchB.identity.address });
    const event2 = await buildAuthRequestEvent({ request: request2, signer: identity.signer, createdAt: T });
    expect(verifyAuthRequestEvent({ event: event2, request: request2, resolution, now: T })).toMatchObject({
      authenticated: false,
      code: "ADDRESS_MISMATCH",
    });
  });

  it("rejects a signer who is not the resolved identity", async () => {
    const rp = service();
    const request = rp.issue({ expectedSubject: identity.subject });
    const stranger = await strangerSigner();
    const event = await buildAuthRequestEvent({ request, signer: stranger.signer, createdAt: T });
    expect(rp.verify(event, resolutionFor(identity))).toMatchObject({
      check: { authenticated: false, code: "SUBJECT_MISMATCH" },
    });
  });

  it("rejects a modified request digest", async () => {
    const rp = service();
    const request = rp.issue({ expectedSubject: identity.subject });
    const event = await buildAuthRequestEvent({ request, signer: identity.signer, createdAt: T });
    const tampered = { ...event, tags: event.tags.map((tag) => (tag[0] === "request" ? ["request", "0".repeat(64)] : tag)) };
    // Tampering invalidates the Nostr signature; an attacker cannot re-sign without the key.
    expect(rp.verify(tampered, resolutionFor(identity))).toMatchObject({
      check: { authenticated: false, code: "EVENT_SIGNATURE" },
    });
  });

  it("rejects revoked and stale identities", async () => {
    const revocation = await revoke(identity, identity.bind, identity.bchA, T0 + 60);
    const revoked = resolveEvents([identity.bind.event, revocation.event], { now: T + 5 }).resolution;
    const rp = service();
    const request = rp.issue({ expectedSubject: identity.subject });
    const event = await buildAuthRequestEvent({ request, signer: identity.signer, createdAt: T });
    expect(rp.verify(event, revoked)).toMatchObject({
      check: { authenticated: false, code: "IDENTITY_REVOKED" },
    });

    const rotation = await rotate(identity, identity.bind, identity.bchA, identity.bchB, T0 + 60);
    const stale = resolveEvents([rotation.event], { now: T + 5 }).resolution;
    const rp2 = service();
    const request2 = rp2.issue({ expectedSubject: identity.subject });
    const event2 = await buildAuthRequestEvent({ request: request2, signer: identity.signer, createdAt: T });
    expect(rp2.verify(event2, stale)).toMatchObject({
      check: { authenticated: false, code: "IDENTITY_STALE" },
    });
  });

  it("invalidates a session after rotation, revocation, logout or expiry", async () => {
    const first = await login(identity);
    const token = first.result.session!.token;
    expect(validateAppSession(first.result.session!, first.resolution, T)).toMatchObject({ valid: true });

    const rotation = await rotate(identity, identity.bind, identity.bchA, identity.bchB, T0 + 60);
    const rotated = resolveEvents([identity.bind.event, rotation.event], { now: T + 5 }).resolution;
    expect(validateAppSession(first.result.session!, rotated, T)).toMatchObject({
      valid: false,
      code: "SESSION_ADDRESS_CHANGED",
    });

    const revocation = await revoke(identity, identity.bind, identity.bchA, T0 + 70);
    const revoked = resolveEvents([identity.bind.event, revocation.event], { now: T + 5 }).resolution;
    expect(validateAppSession(first.result.session!, revoked, T)).toMatchObject({
      valid: false,
      code: "SESSION_IDENTITY_REVOKED",
    });

    expect(first.rp.logout(token)).toBe(true);
    expect(first.rp.validate(token, first.resolution)).toMatchObject({
      valid: false,
      code: "SESSION_UNKNOWN",
    });
  });

  it("does not issue a session for an unauthorized rotation attempt", async () => {
    // A forged rotation (new key signs the current role) is rejected; the
    // authorized address remains wallet A. An attacker cannot obtain a session
    // for wallet C.
    const forged = await (await import("@kyvera/verifier")).createRotateRecord({
      signer: identity.signer,
      previous: { recordId: identity.bind.recordId, sequence: 0, bch: identity.bchA.identity },
      currentBchPrivateKey: identity.bchC.privateKey,
      newBchPrivateKey: identity.bchC.privateKey,
      newBch: identity.bchC.identity,
      issuedAt: T0 + 60,
    });
    const resolution = resolveEvents([identity.bind.event, forged.event], { now: T + 5 }).resolution;
    expect(resolution.status).toBe("ACTIVE");
    expect(resolution.activeBch?.address).toBe(identity.bchA.identity.address);

    const rp = service();
    const request = rp.issue({ expectedSubject: identity.subject, expectedAddress: identity.bchC.identity.address });
    const event = await buildAuthRequestEvent({ request, signer: identity.signer, createdAt: T });
    expect(rp.verify(event, resolution)).toMatchObject({
      check: { authenticated: false, code: "ADDRESS_MISMATCH" },
    });
  });

  it("expires an application session independently of the challenge", async () => {
    let now = T;
    const rp = new AuthRequestService({
      origin: ORIGIN,
      ttlSeconds: 120,
      sessionTtlSeconds: 60,
      now: () => now,
      sessionId: "ef".repeat(32),
    });
    const resolution = resolutionFor(identity);
    const request = rp.issue({ expectedSubject: identity.subject });
    const event = await buildAuthRequestEvent({ request, signer: identity.signer, createdAt: T });
    const result = rp.verify(event, resolution);
    expect(result.session).toBeDefined();
    now = T + 61;
    expect(validateAppSession(result.session!, resolution, now)).toMatchObject({
      valid: false,
      code: "SESSION_EXPIRED",
    });
  });
  it("consumes a challenge even when the first verification fails", async () => {
    const rp = service();
    const request = rp.issue({ expectedSubject: identity.subject });
    const stranger = await strangerSigner();
    const bad = await buildAuthRequestEvent({ request, signer: stranger.signer, createdAt: T });
    expect(rp.verify(bad, resolutionFor(identity)).check.code).toBe("SUBJECT_MISMATCH");
    const good = await buildAuthRequestEvent({ request, signer: identity.signer, createdAt: T });
    expect(rp.verify(good, resolutionFor(identity)).check.code).toBe("UNKNOWN_CHALLENGE");
  });

});
