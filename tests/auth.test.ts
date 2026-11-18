import { describe, expect, it } from "vitest";
import {
  ChallengeService,
  buildAuthEvent,
  createAuthChallenge,
  resolveEvents,
  verifyAuthEvent,
} from "@kyvera/verifier";
import { finalizeEvent } from "nostr-tools/pure";
import { T0, makeIdentity, revoke, rotate, strangerSigner } from "./helpers.js";
import type { KyveraEvent } from "@kyvera/core";

const NOW = T0 + 3600;

async function activeResolution(label: string) {
  const identity = await makeIdentity(label);
  const { resolution } = resolveEvents([identity.bind.event], { now: NOW });
  return { identity, resolution };
}

describe("challenge-response authentication", () => {
  it("authenticates a live identity key against a fresh challenge", async () => {
    const { identity, resolution } = await activeResolution("auth-valid");
    const challenge = createAuthChallenge({ domain: "app.kyvera.test", now: NOW });
    const event = await buildAuthEvent({ challenge, signer: identity.signer, createdAt: NOW });
    const result = verifyAuthEvent({ event, challenge, resolution, now: NOW });
    expect(result).toMatchObject({
      authenticated: true,
      subject: identity.subject,
      bchAddress: identity.bchA.identity.address,
    });
  });

  it("rejects a replayed authentication response", async () => {
    const { identity, resolution } = await activeResolution("auth-replay");
    const service = new ChallengeService({ domain: "app.kyvera.test", now: () => NOW });
    const challenge = service.issue();
    const event = await buildAuthEvent({ challenge, signer: identity.signer, createdAt: NOW });
    expect(service.verify(event, resolution).authenticated).toBe(true);
    expect(service.verify(event, resolution)).toMatchObject({
      authenticated: false,
      code: "UNKNOWN_CHALLENGE",
    });
  });

  it("rejects an expired challenge", async () => {
    const { identity, resolution } = await activeResolution("auth-expired");
    const challenge = createAuthChallenge({ domain: "app.kyvera.test", ttlSeconds: 60, now: NOW });
    const event = await buildAuthEvent({ challenge, signer: identity.signer, createdAt: NOW });
    const result = verifyAuthEvent({
      event,
      challenge,
      resolution,
      now: NOW + 600,
      maxClockSkewSeconds: 30,
    });
    expect(result.authenticated).toBe(false);
    expect(result.code).toBe("CHALLENGE_EXPIRED");
  });

  it("rejects a response for a different domain", async () => {
    const { identity, resolution } = await activeResolution("auth-domain");
    const challenge = createAuthChallenge({ domain: "app.kyvera.test", now: NOW });
    const otherDomain = { ...challenge, domain: "evil.example" };
    const event = await buildAuthEvent({ challenge: otherDomain, signer: identity.signer, createdAt: NOW });
    const result = verifyAuthEvent({ event, challenge, resolution, now: NOW });
    expect(result.authenticated).toBe(false);
    expect(result.code).toBe("DOMAIN_MISMATCH");
  });

  it("rejects a response for a different challenge", async () => {
    const { identity, resolution } = await activeResolution("auth-wrong-challenge");
    const challenge = createAuthChallenge({ domain: "app.kyvera.test", now: NOW });
    const other = { ...challenge, challenge: "33".repeat(32) };
    const event = await buildAuthEvent({ challenge: other, signer: identity.signer, createdAt: NOW });
    const result = verifyAuthEvent({ event, challenge, resolution, now: NOW });
    expect(result.authenticated).toBe(false);
    expect(result.code).toBe("CHALLENGE_MISMATCH");
  });

  it("rejects authentication by an unrelated key", async () => {
    const { resolution } = await activeResolution("auth-stranger");
    const stranger = await strangerSigner();
    const challenge = createAuthChallenge({ domain: "app.kyvera.test", now: NOW });
    const event = await buildAuthEvent({ challenge, signer: stranger.signer, createdAt: NOW });
    const result = verifyAuthEvent({ event, challenge, resolution, now: NOW });
    expect(result.authenticated).toBe(false);
    expect(result.code).toBe("SUBJECT_MISMATCH");
  });

  it("refuses to authenticate a revoked identity", async () => {
    const identity = await makeIdentity("auth-revoked");
    const revocation = await revoke(identity, identity.bind, identity.bchA);
    const { resolution } = resolveEvents([identity.bind.event, revocation.event], { now: NOW });
    const challenge = createAuthChallenge({ domain: "app.kyvera.test", now: NOW });
    const event = await buildAuthEvent({ challenge, signer: identity.signer, createdAt: NOW });
    const result = verifyAuthEvent({ event, challenge, resolution, now: NOW });
    expect(result.authenticated).toBe(false);
    expect(result.code).toBe("IDENTITY_REVOKED");
  });

  it("refuses to authenticate an identity whose state is stale", async () => {
    const identity = await makeIdentity("auth-stale");
    const rotation = await rotate(identity, identity.bind, identity.bchA, identity.bchB);
    const { resolution } = resolveEvents([rotation.event], { now: NOW });
    expect(resolution.status).toBe("STALE");
    const challenge = createAuthChallenge({ domain: "app.kyvera.test", now: NOW });
    const event = await buildAuthEvent({ challenge, signer: identity.signer, createdAt: NOW });
    const result = verifyAuthEvent({ event, challenge, resolution, now: NOW });
    expect(result.authenticated).toBe(false);
    expect(result.code).toBe("IDENTITY_STALE");
  });

  it("enforces the expected payment address", async () => {
    const { identity, resolution } = await activeResolution("auth-address");
    const challenge = createAuthChallenge({ domain: "app.kyvera.test", now: NOW });
    const event = await buildAuthEvent({ challenge, signer: identity.signer, createdAt: NOW });
    const wrong = verifyAuthEvent({
      event,
      challenge,
      resolution,
      now: NOW,
      expectedAddress: identity.bchB.identity.address,
    });
    expect(wrong.authenticated).toBe(false);
    expect(wrong.code).toBe("ADDRESS_MISMATCH");
  });

  it("rejects an authentication event edited after signing", async () => {
    const { identity, resolution } = await activeResolution("auth-tampered");
    const challenge = createAuthChallenge({ domain: "app.kyvera.test", now: NOW });
    const event = await buildAuthEvent({ challenge, signer: identity.signer, createdAt: NOW });
    const tampered: KyveraEvent = {
      ...event,
      tags: event.tags.map((tag) => (tag[0] === "relay" ? ["relay", "evil.example"] : tag)),
    };
    const result = verifyAuthEvent({ event: tampered, challenge, resolution, now: NOW });
    expect(result.authenticated).toBe(false);
    expect(result.code).toBe("EVENT_SIGNATURE");
  });

  it("requires the authentication event to be inside the challenge window", async () => {
    const { identity, resolution } = await activeResolution("auth-window");
    const challenge = createAuthChallenge({ domain: "app.kyvera.test", now: NOW, ttlSeconds: 60 });
    const event = finalizeEvent(
      {
        kind: 22242,
        created_at: NOW - 600,
        tags: [
          ["challenge", challenge.challenge],
          ["relay", challenge.domain],
          ["k", "kyvera-auth-v1"],
        ],
        content: "",
      },
      identity.secret,
    ) as KyveraEvent;
    const result = verifyAuthEvent({ event, challenge, resolution, now: NOW });
    expect(result.authenticated).toBe(false);
    expect(result.code).toBe("TIMESTAMP_OUT_OF_WINDOW");
  });
});
